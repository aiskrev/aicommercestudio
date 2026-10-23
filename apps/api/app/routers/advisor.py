"""Public, anonymous AI Business Automation Advisor endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request, Response, status

from app.advisor import service
from app.advisor.schemas import AdvisorRequest, AdvisorResponse, AdvisorStatus
from app.ai.factory import get_ai_provider
from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.spam import check_form_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/public/advisor", tags=["advisor"])

_ERRORS: dict[str, tuple[int, str, str]] = {
    "timeout": (
        status.HTTP_504_GATEWAY_TIMEOUT,
        "advisor_timeout",
        "Анализът отне твърде дълго и беше прекъснат. Моля, опитайте отново след малко.",
    ),
    "rate_limited": (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "advisor_busy",
        "Услугата е натоварена в момента. Моля, опитайте отново след няколко минути.",
    ),
    "invalid_output": (
        status.HTTP_502_BAD_GATEWAY,
        "advisor_invalid_output",
        "Не успяхме да съставим валидна оценка. Моля, опитайте отново или опишете процеса по-конкретно.",
    ),
    "declined": (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "advisor_declined",
        "Не можем да оценим този текст. Моля, опишете конкретен бизнес процес, който искате да автоматизирате.",
    ),
    "unavailable": (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "advisor_unavailable",
        "Услугата за анализ временно не е достъпна. Моля, опитайте отново по-късно.",
    ),
}


def advisor_rate_limit(request: Request) -> None:
    """Runs before body validation, so invalid requests count too (protects AI provider spend)."""
    settings = get_settings()
    enforce_rate_limit(
        f"advisor:{client_ip(request)}", settings.advisor_rate_limit, settings.advisor_rate_window_seconds
    )
    enforce_rate_limit("advisor:global", settings.advisor_global_rate_limit, settings.advisor_rate_window_seconds)


@router.get("/status", response_model=AdvisorStatus)
def advisor_status(settings: AppSettings) -> AdvisorStatus:
    mode = service.mode_for(get_ai_provider())
    return AdvisorStatus(
        mode=mode.value, disclaimer=service.disclaimer_for(mode), retention_days=settings.advisor_retention_days
    )


@router.post(
    "/assessments",
    status_code=status.HTTP_201_CREATED,
    response_model=AdvisorResponse,
    dependencies=[Depends(advisor_rate_limit)],
    summary="Generate an automation assessment (no personal data required)",
)
def create_assessment(
    payload: AdvisorRequest, response: Response, db: DbSession, settings: AppSettings
) -> AdvisorResponse:
    response.headers["Cache-Control"] = "no-store"
    problem = check_form_token(
        payload.form_token, settings.secret_key, settings.form_token_min_seconds, settings.form_token_max_age_seconds
    )
    if problem:
        logger.info("advisor_form_token_rejected", extra={"reason": problem})
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "Формулярът е изпратен твърде бързо или е изтекъл. Моля, презаредете страницата и опитайте отново.",
            "form_token_invalid",
        )
    try:
        return service.create_assessment(db, settings, get_ai_provider(), payload)
    except service.AdvisorError as exc:
        code_status, code, detail = _ERRORS.get(exc.kind, _ERRORS["unavailable"])
        raise ApiError(code_status, detail, code) from exc
