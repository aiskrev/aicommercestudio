"""Public AI Readiness Assessment endpoints: metadata, anonymous PDF report, optional submission.

Nothing here returns stored data. The report endpoint stores nothing; the submission endpoint
creates a lead only on the visitor's explicit request (see app/readiness/service.py).
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status

from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.notifications import notify_new_lead
from app.readiness import service
from app.readiness.report import ReportUnavailable, build_report
from app.readiness.schemas import (
    ReadinessMeta,
    ReadinessReportRequest,
    ReadinessSubmissionCreate,
    ReadinessSubmitted,
)
from app.routers.public import contact_rate_limit
from app.security import hash_ip
from app.spam import check_form_token, looks_like_link_spam

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/public/readiness", tags=["readiness"])

SUBMITTED_MESSAGES = {
    "bg": "Благодарим ви! Получихме резултата и ще се свържем с вас в работно време.",
    "en": "Thank you! We have received your results and will get back to you during business hours.",
}
# A user-facing message, not a credential.
_TOKEN_ERROR = (
    "Формулярът е изпратен твърде бързо или е изтекъл. Моля, опитайте отново след няколко секунди."  # noqa: S105
)


def report_rate_limit(request: Request) -> None:
    """Runs before body validation; report rendering is CPU-bound, so invalid requests count too."""
    settings = get_settings()
    enforce_rate_limit(
        f"readiness-report:{client_ip(request)}",
        settings.readiness_report_rate_limit,
        settings.readiness_report_rate_window_seconds,
    )
    enforce_rate_limit(
        "readiness-report:global",
        settings.readiness_report_global_rate_limit,
        settings.readiness_report_rate_window_seconds,
    )


def _require_form_token(token: str, settings: AppSettings, event: str) -> None:
    problem = check_form_token(
        token, settings.secret_key, settings.form_token_min_seconds, settings.form_token_max_age_seconds
    )
    if problem:
        logger.info(event, extra={"reason": problem})
        raise ApiError(status.HTTP_400_BAD_REQUEST, _TOKEN_ERROR, "form_token_invalid")


@router.get("/meta", response_model=ReadinessMeta)
def readiness_meta(response: Response, settings: AppSettings) -> ReadinessMeta:
    response.headers["Cache-Control"] = "no-store"
    return ReadinessMeta(
        privacy_notice_version=settings.privacy_notice_version,
        marketing_consent_version=settings.marketing_consent_version,
        retention_days=min(settings.readiness_retention_days, settings.lead_retention_days),
    )


@router.post(
    "/report",
    dependencies=[Depends(report_rate_limit)],
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}, "description": "The PDF report"}},
    summary="Render the PDF report for a set of answers (anonymous; nothing is stored)",
)
def readiness_report(payload: ReadinessReportRequest, settings: AppSettings) -> Response:
    _require_form_token(payload.form_token, settings, "readiness_report_token_rejected")
    result = service.score_request(payload)
    try:
        pdf = build_report(result, payload.locale.value, payload.company)
    except ReportUnavailable as exc:
        logger.error("readiness_report_unavailable", extra={"reason": str(exc)})
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Отчетът временно не може да бъде създаден. Моля, опитайте отново по-късно.",
            "report_unavailable",
        ) from exc
    logger.info("readiness_report_generated", extra={"band": result.band, "locale": payload.locale.value})
    filename = "ai-readiness-report.pdf" if payload.locale.value == "en" else "ai-gotovnost-otchet.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/submissions",
    status_code=status.HTTP_201_CREATED,
    response_model=ReadinessSubmitted,
    dependencies=[Depends(contact_rate_limit)],
    summary="Send assessment results and contact details to the team (creates a lead)",
)
def submit_readiness(
    payload: ReadinessSubmissionCreate,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> ReadinessSubmitted:
    ip_hash = hash_ip(client_ip(request), settings.secret_key)
    locale = payload.locale.value
    result = service.score_request(payload)
    if payload.website:
        # Honeypot filled: pretend success so bots get no signal, but store nothing.
        logger.warning("readiness_spam_rejected", extra={"reason": "honeypot", "ip_hash": ip_hash})
        return ReadinessSubmitted(
            reference=secrets.token_hex(4).upper(),
            message=SUBMITTED_MESSAGES[locale],
            overall=result.overall,
            band=result.band,
        )
    _require_form_token(payload.form_token, settings, "readiness_form_token_rejected")
    if looks_like_link_spam(payload.message):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "Съобщението съдържа твърде много връзки. Моля, опишете проекта си с думи.",
            "spam_suspected",
        )
    lead = service.create_submission(
        db,
        payload,
        result,
        privacy_notice_version=settings.privacy_notice_version,
        marketing_consent_version=settings.marketing_consent_version,
        ip_hash=ip_hash,
    )
    logger.info(
        "readiness_submission_created",
        extra={
            "lead": lead.reference,
            "band": result.band,
            "model_version": service.MODEL_VERSION,
            "consultation": payload.consultation_requested,
        },
    )
    background.add_task(
        notify_new_lead, settings, str(lead.id), lead.reference, lead.service, lead.inquiry_type, lead.locale
    )
    return ReadinessSubmitted(
        reference=lead.reference, message=SUBMITTED_MESSAGES[locale], overall=result.overall, band=result.band
    )
