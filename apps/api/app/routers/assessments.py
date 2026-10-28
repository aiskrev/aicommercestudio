"""Public assessment engine endpoints (docs/ASSESSMENT_PLATFORM_ARCHITECTURE.md).

Anonymous by design: scoring needs no personal data and stores nothing unless the visitor opts in
with `save: true`. Saved results are reachable and deletable only with the secret token returned
once at save time. Every request is rate limited per client and globally.
"""

from __future__ import annotations

import logging
import secrets
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from fastapi.responses import JSONResponse

from app.assessments import service
from app.assessments.answers import ERROR_MESSAGES
from app.assessments.api_schemas import (
    AssessmentDefinitionOut,
    AssessmentListOut,
    AssessmentResultOut,
    AssessmentScoreRequest,
    ConsultationOut,
    ResultConsultationRequest,
    ResultReportRequest,
    ResultTokenRequest,
)
from app.assessments.definition import AssessmentDefinition
from app.assessments.presenter import present_result, public_definition, public_summary
from app.assessments.registry import registry
from app.assessments.report import FILE_NAMES, build_document
from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.notifications import notify_new_lead
from app.readiness.report import ReportUnavailable
from app.reports.document import ReportTooLarge
from app.reports.pdf import render_pdf
from app.routers.public import contact_rate_limit
from app.security import hash_ip
from app.spam import check_form_token, looks_like_link_spam

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/public/assessments", tags=["assessments"])

Locale = Literal["bg", "en"]

_NOT_FOUND = {"bg": "Оценката не е намерена.", "en": "Assessment not found."}
_RESULT_NOT_FOUND = {
    "bg": "Запазеният резултат не е намерен или е изтекъл.",
    "en": "The saved result was not found or has expired.",
}
_OUTDATED = {
    "bg": "Въпросите са обновени. Моля, презаредете страницата и отговорете отново.",
    "en": "The questions have been updated. Please reload the page and answer again.",
}
_INVALID = {"bg": "Някои отговори са невалидни или липсват.", "en": "Some answers are invalid or missing."}
_REPORT_FAILED = {"bg": "Отчетът временно не може да бъде създаден.", "en": "The report cannot be created right now."}
_REPORT_TOO_LARGE = {"bg": "Докладът е твърде голям.", "en": "The report is too large."}
_CONSULTATION_EXISTS = {
    "bg": "За този резултат вече е изпратено запитване.",
    "en": "A consultation request has already been sent for this result.",
}
_CONSULTATION_SENT = {
    "bg": "Благодарим! Получихме запитването ви и ще се свържем с вас.",
    "en": "Thank you! We received your request and will get in touch.",
}
_TOKEN_ERROR = {
    "bg": "Формулярът е изпратен твърде бързо или е изтекъл. Моля, презаредете страницата и опитайте отново.",
    "en": "The form was sent too quickly or has expired. Please reload the page and try again.",
}
_SPAM = {
    "bg": "Съобщението съдържа твърде много връзки. Моля, опишете проекта си с думи.",
    "en": "The message contains too many links. Please describe your project in words.",
}


def _limit(kind: str, setting: str):
    def dependency(request: Request) -> None:
        settings = get_settings()
        window = settings.assessment_rate_window_seconds
        enforce_rate_limit(f"assessment-{kind}:{client_ip(request)}", getattr(settings, setting), window)
        enforce_rate_limit("assessment:global", settings.assessment_global_rate_limit, window)

    return Depends(dependency)


def _available(key: str, settings: AppSettings, locale: str) -> AssessmentDefinition:
    definition = registry().current(key)
    if definition is None or (definition.status == "preview" and not settings.assessments_preview_enabled):
        raise ApiError(status.HTTP_404_NOT_FOUND, _NOT_FOUND[locale], "assessment_not_found")
    return definition


@router.get("", response_model=AssessmentListOut, dependencies=[_limit("read", "assessment_rate_limit")])
def list_assessments(
    response: Response, settings: AppSettings, locale: Locale = Query(default="bg")
) -> AssessmentListOut:
    response.headers["Cache-Control"] = "no-store"
    items = [
        public_summary(d, locale) for d in registry().available(preview_enabled=settings.assessments_preview_enabled)
    ]
    return AssessmentListOut.model_validate({"locale": locale, "items": items})


@router.get("/{key}", response_model=AssessmentDefinitionOut, dependencies=[_limit("read", "assessment_rate_limit")])
def get_assessment(
    key: str, response: Response, settings: AppSettings, locale: Locale = Query(default="bg")
) -> AssessmentDefinitionOut:
    definition = _available(key, settings, locale)
    response.headers["Cache-Control"] = "no-store"
    return AssessmentDefinitionOut.model_validate(public_definition(definition, locale))


@router.post(
    "/{key}/score",
    response_model=AssessmentResultOut,
    dependencies=[_limit("score", "assessment_rate_limit")],
    summary="Score answers on the server; with save=true also store the result and return a link token",
)
def score_assessment(
    key: str, payload: AssessmentScoreRequest, request: Request, db: DbSession, settings: AppSettings
) -> AssessmentResultOut:
    locale = payload.locale.value
    definition = _available(key, settings, locale)
    if payload.definition_version != definition.version:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            _OUTDATED[locale],
            "assessment_version_outdated",
            errors=[{"field": "definition_version", "message": definition.version, "type": "version_outdated"}],
        )
    try:
        answers, result = service.assess(definition, payload.answers)
    except service.InvalidAnswers as exc:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            _INVALID[locale],
            "assessment_invalid_answers",
            errors=[
                {"field": f"answers.{e.question}", "message": ERROR_MESSAGES[locale][e.code], "type": e.code}
                for e in exc.errors
            ],
        ) from exc

    body = present_result(definition, result, locale, answers)
    if payload.save:
        enforce_rate_limit(
            f"assessment-save:{client_ip(request)}",
            settings.assessment_save_rate_limit,
            settings.assessment_rate_window_seconds,
        )
        row, token = service.save_result(
            db, definition, answers, result, locale=locale, retention_days=settings.assessment_retention_days
        )
        body["saved"] = {"reference": row.reference, "token": token, "expires_at": row.expires_at}
    logger.info(
        "assessment_scored",
        extra={
            "assessment": definition.key,
            "version": definition.version,
            "band": result.band,
            "fingerprint": result.fingerprint,
            "saved": payload.save,
        },
    )
    return AssessmentResultOut.model_validate(body)


@router.post(
    "/results/lookup",
    response_model=AssessmentResultOut,
    dependencies=[_limit("lookup", "assessment_lookup_rate_limit")],
    summary="Open a saved result with its link token (POST keeps the token out of URLs and logs)",
)
def lookup_result(
    payload: ResultTokenRequest, response: Response, db: DbSession, locale: Locale = Query(default="bg")
) -> AssessmentResultOut:
    response.headers["Cache-Control"] = "no-store"
    row = service.find_result(db, payload.token)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, _RESULT_NOT_FOUND[locale], "assessment_result_not_found")
    try:
        definition, answers, result = service.rescore_saved(row)
    except LookupError as exc:
        raise ApiError(status.HTTP_404_NOT_FOUND, _RESULT_NOT_FOUND[locale], "assessment_result_not_found") from exc
    body = present_result(definition, result, locale, answers)
    body["saved"] = {"reference": row.reference, "token": None, "expires_at": row.expires_at}
    return AssessmentResultOut.model_validate(body)


@router.post(
    "/results/delete",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[_limit("lookup", "assessment_lookup_rate_limit")],
    summary="Delete a saved result with its link token (idempotent)",
)
def delete_result(payload: ResultTokenRequest, db: DbSession) -> Response:
    deleted = service.delete_result(db, payload.token)
    logger.info("assessment_result_deleted", extra={"deleted": deleted})
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})


def _saved(db: DbSession, token: str, locale: str):
    row = service.find_result(db, token)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, _RESULT_NOT_FOUND[locale], "assessment_result_not_found")
    try:
        definition, answers, result = service.rescore_saved(row)
    except LookupError as exc:
        raise ApiError(status.HTTP_404_NOT_FOUND, _RESULT_NOT_FOUND[locale], "assessment_result_not_found") from exc
    return row, definition, answers, result


@router.post(
    "/results/report",
    response_model=None,
    dependencies=[_limit("report", "assessment_report_rate_limit")],
    summary="Report of a saved result: PDF, or the same document as JSON for the HTML view",
)
def result_report(
    payload: ResultReportRequest, db: DbSession, locale: Locale = Query(default="bg")
) -> Response:
    """Only the result the token opens is ever rendered (the token is the access right). Expired,
    unknown and tampered results are 404. The file name carries no reference, token or name."""
    row, definition, answers, result = _saved(db, payload.token, locale)
    view = present_result(definition, result, locale, answers)
    document = build_document(
        view, locale=locale, created_at=row.created_at, expires_at=row.expires_at, reference=row.reference
    )
    headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
    if payload.format == "json":
        return JSONResponse(document.to_dict(), headers=headers)
    try:
        pdf = render_pdf(document)
    except ReportTooLarge as exc:
        logger.warning("assessment_report_too_large", extra={"assessment": definition.key, "reason": str(exc)})
        raise ApiError(status.HTTP_413_CONTENT_TOO_LARGE, _REPORT_TOO_LARGE[locale], "report_too_large") from exc
    except ReportUnavailable as exc:
        logger.error("assessment_report_unavailable", extra={"assessment": definition.key})
        raise ApiError(status.HTTP_503_SERVICE_UNAVAILABLE, _REPORT_FAILED[locale], "report_unavailable") from exc
    logger.info(
        "assessment_report_generated",
        extra={"assessment": definition.key, "version": definition.version, "bytes": len(pdf), "locale": locale},
    )
    headers["Content-Disposition"] = f'attachment; filename="{FILE_NAMES[locale]}"'
    return Response(pdf, media_type="application/pdf", headers=headers)


@router.post(
    "/results/consultation",
    status_code=status.HTTP_201_CREATED,
    response_model=ConsultationOut,
    dependencies=[Depends(contact_rate_limit)],
    summary="Optional consultation about a saved result (creates a lead; marketing consent is separate)",
)
def result_consultation(
    payload: ResultConsultationRequest,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> ConsultationOut:
    locale = payload.locale.value
    ip_hash = hash_ip(client_ip(request), settings.secret_key)
    if payload.website:
        # Honeypot filled: pretend success, store nothing.
        logger.warning("assessment_spam_rejected", extra={"reason": "honeypot", "ip_hash": ip_hash})
        return ConsultationOut(reference=secrets.token_hex(4).upper(), message=_CONSULTATION_SENT[locale])
    problem = check_form_token(
        payload.form_token, settings.secret_key, settings.form_token_min_seconds, settings.form_token_max_age_seconds
    )
    if problem:
        logger.info("assessment_form_token_rejected", extra={"reason": problem})
        raise ApiError(status.HTTP_400_BAD_REQUEST, _TOKEN_ERROR[locale], "form_token_invalid")
    if looks_like_link_spam(payload.message):
        raise ApiError(status.HTTP_400_BAD_REQUEST, _SPAM[locale], "spam_suspected")
    row, definition, _answers, result = _saved(db, payload.token, locale)
    # Lock the row, so two simultaneous requests cannot both create a lead for the same result.
    db.refresh(row, with_for_update=True)
    if row.lead_id is not None:
        raise ApiError(status.HTTP_409_CONFLICT, _CONSULTATION_EXISTS[locale], "assessment_consultation_exists")
    lead = service.create_consultation(
        db,
        row,
        definition,
        result,
        name=payload.name,
        email=payload.email,
        company=payload.company,
        message=payload.message,
        locale=locale,
        marketing_consent=payload.marketing_consent,
        privacy_notice_version=settings.privacy_notice_version,
        marketing_consent_version=settings.marketing_consent_version,
        ip_hash=ip_hash,
    )
    logger.info(
        "assessment_consultation_created",
        extra={"lead": lead.reference, "assessment": definition.key, "band": result.band, "locale": locale},
    )
    background.add_task(
        notify_new_lead, settings, str(lead.id), lead.reference, lead.service, lead.inquiry_type, lead.locale
    )
    return ConsultationOut(reference=lead.reference, message=_CONSULTATION_SENT[locale])
