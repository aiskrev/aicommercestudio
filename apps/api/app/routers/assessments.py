"""Public assessment engine endpoints (docs/ASSESSMENT_PLATFORM_ARCHITECTURE.md).

Anonymous by design: scoring needs no personal data and stores nothing unless the visitor opts in
with `save: true`. Saved results are reachable and deletable only with the secret token returned
once at save time. Every request is rate limited per client and globally.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.assessments import service
from app.assessments.answers import ERROR_MESSAGES
from app.assessments.api_schemas import (
    AssessmentDefinitionOut,
    AssessmentListOut,
    AssessmentResultOut,
    AssessmentScoreRequest,
    ResultTokenRequest,
)
from app.assessments.definition import AssessmentDefinition
from app.assessments.presenter import present_result, public_definition, public_summary
from app.assessments.registry import registry
from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError

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

    body = present_result(definition, result, locale)
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
        definition, result = service.rescore_saved(row)
    except LookupError as exc:
        raise ApiError(status.HTTP_404_NOT_FOUND, _RESULT_NOT_FOUND[locale], "assessment_result_not_found") from exc
    body = present_result(definition, result, locale)
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
