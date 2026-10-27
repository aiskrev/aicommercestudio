"""Public AI team configurator endpoints: metadata, plan with cost estimate, PDF plan, saved
configurations and an optional consultation request.

Only the consultation creates a lead; a saved configuration holds enumerated values only and is
retrieved with a secret token sent in the request body (never in a URL, so it cannot end up in access
logs). Logs carry enumerations and counts only.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from pydantic import Field

from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.notifications import notify_new_lead
from app.readiness.report import ReportUnavailable
from app.routers.public import contact_rate_limit
from app.schemas import StrictModel
from app.security import hash_ip
from app.spam import check_form_token, looks_like_link_spam
from app.team import costs, service
from app.team.report import build_team_report
from app.team.schemas import (
    TeamConfigurationOut,
    TeamEstimateRequest,
    TeamMeta,
    TeamPlanOut,
    TeamReportRequest,
    TeamSavedOut,
    TeamSaveRequest,
    TeamSubmissionCreate,
    TeamSubmitted,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/public/team", tags=["team"])

SUBMITTED_MESSAGES = {
    "bg": "Благодарим ви! Получихме конфигурацията и ще се свържем с вас в работно време.",
    "en": "Thank you! We have received your configuration and will get back to you during business hours.",
}
# A user-facing message, not a credential.
_TOKEN_ERROR = "Формулярът е изпратен твърде бързо или е изтекъл. Моля, опитайте отново след няколко секунди."  # noqa: S105
_NOT_FOUND = "Запазената конфигурация не е намерена или е изтекла."


def _limit(kind: str, limit_setting: str):
    def dependency(request: Request) -> None:
        settings = get_settings()
        window = settings.team_rate_window_seconds
        enforce_rate_limit(f"team-{kind}:{client_ip(request)}", getattr(settings, limit_setting), window)
        enforce_rate_limit("team:global", settings.team_global_rate_limit, window)

    return dependency


def _require_form_token(token: str, settings: AppSettings, event: str) -> None:
    problem = check_form_token(
        token, settings.secret_key, settings.form_token_min_seconds, settings.form_token_max_age_seconds
    )
    if problem:
        logger.info(event, extra={"reason": problem})
        raise ApiError(status.HTTP_400_BAD_REQUEST, _TOKEN_ERROR, "form_token_invalid")


def _assumptions(settings: AppSettings) -> dict:
    try:
        return service.assumptions(settings)
    except (OSError, ValueError) as exc:
        logger.error("team_assumptions_unavailable", extra={"error": type(exc).__name__})
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Разходите временно не могат да бъдат изчислени. Моля, опитайте отново по-късно.",
            "estimate_unavailable",
        ) from exc


@router.get("/meta", response_model=TeamMeta)
def team_meta(response: Response, settings: AppSettings) -> TeamMeta:
    response.headers["Cache-Control"] = "no-store"
    return TeamMeta(
        privacy_notice_version=settings.privacy_notice_version,
        marketing_consent_version=settings.marketing_consent_version,
        retention_days=settings.team_configuration_retention_days,
        submission_retention_days=min(settings.team_lead_retention_days, settings.lead_retention_days),
        assumptions=costs.public_assumptions(_assumptions(settings)),
    )


@router.post(
    "/estimate",
    response_model=TeamPlanOut,
    dependencies=[Depends(_limit("estimate", "team_estimate_rate_limit"))],
    summary="Plan and cost estimate for a configuration (anonymous; nothing is stored)",
)
def team_estimate(payload: TeamEstimateRequest, response: Response, settings: AppSettings) -> TeamPlanOut:
    response.headers["Cache-Control"] = "no-store"
    plan = service.build_plan(payload.config.to_model(), _assumptions(settings), payload.applied_overrides())
    logger.info(
        "team_estimate_generated",
        extra={"agents": len(plan["summary"]["selected"]), "complexity": plan["summary"]["complexity"]["band"]},
    )
    return TeamPlanOut.model_validate(plan)


@router.post(
    "/report",
    dependencies=[Depends(_limit("report", "team_report_rate_limit"))],
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}, "description": "The PDF plan"}},
    summary="Render the PDF plan for a configuration (anonymous; nothing is stored)",
)
def team_report(payload: TeamReportRequest, settings: AppSettings) -> Response:
    _require_form_token(payload.form_token, settings, "team_report_token_rejected")
    config = payload.config.to_model()
    plan = service.build_plan(config, _assumptions(settings), payload.applied_overrides())
    try:
        pdf = build_team_report(config, plan, payload.locale.value, payload.company)
    except ReportUnavailable as exc:
        logger.error("team_report_unavailable", extra={"reason": str(exc)})
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Отчетът временно не може да бъде създаден. Моля, опитайте отново по-късно.",
            "report_unavailable",
        ) from exc
    logger.info(
        "team_report_generated", extra={"agents": len(plan["summary"]["selected"]), "locale": payload.locale.value}
    )
    filename = "ai-team-plan.pdf" if payload.locale.value == "en" else "ai-ekip-plan.pdf"
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
    "/configurations",
    status_code=status.HTTP_201_CREATED,
    response_model=TeamSavedOut,
    dependencies=[Depends(_limit("save", "team_save_rate_limit"))],
    summary="Save a configuration (enumerated values only) and get a secret link token",
)
def save_configuration(
    payload: TeamSaveRequest, response: Response, db: DbSession, settings: AppSettings
) -> TeamSavedOut:
    _require_form_token(payload.form_token, settings, "team_save_token_rejected")
    _assumptions(settings)
    row, token = service.save_configuration(db, payload, settings)
    response.headers["Cache-Control"] = "no-store"
    logger.info("team_configuration_saved", extra={"configuration": row.reference})
    return TeamSavedOut(reference=row.reference, token=token, expires_at=row.expires_at)


class ConfigurationLookup(StrictModel):
    token: str = Field(min_length=20, max_length=100)


@router.post(
    "/configurations/lookup",
    response_model=TeamConfigurationOut,
    dependencies=[Depends(_limit("lookup", "team_lookup_rate_limit"))],
    summary="Load a saved configuration by its secret token (sent in the body, never in the URL)",
)
def lookup_configuration(payload: ConfigurationLookup, response: Response, db: DbSession) -> TeamConfigurationOut:
    response.headers["Cache-Control"] = "no-store"
    row = service.find_configuration(db, payload.token)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, _NOT_FOUND, "team_configuration_not_found")
    return TeamConfigurationOut(
        reference=row.reference,
        created_at=row.created_at,
        expires_at=row.expires_at,
        schema_version=row.schema_version,
        model_version=row.model_version,
        assumptions_version=row.assumptions_version,
        locale=row.locale,
        config=row.config,
        overrides=row.overrides or {},
    )


@router.post(
    "/submissions",
    status_code=status.HTTP_201_CREATED,
    response_model=TeamSubmitted,
    dependencies=[Depends(contact_rate_limit)],
    summary="Request a consultation about a configuration (creates a lead)",
)
def submit_team(
    payload: TeamSubmissionCreate,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> TeamSubmitted:
    ip_hash = hash_ip(client_ip(request), settings.secret_key)
    locale = payload.locale.value
    if payload.website:
        # Honeypot filled: pretend success so bots get no signal, but store nothing.
        logger.warning("team_spam_rejected", extra={"reason": "honeypot", "ip_hash": ip_hash})
        return TeamSubmitted(reference=secrets.token_hex(4).upper(), message=SUBMITTED_MESSAGES[locale])
    _require_form_token(payload.form_token, settings, "team_form_token_rejected")
    if looks_like_link_spam(payload.message):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "Съобщението съдържа твърде много връзки. Моля, опишете проекта си с думи.",
            "spam_suspected",
        )
    _assumptions(settings)
    lead, _estimate = service.create_submission(db, payload, settings, ip_hash=ip_hash)
    logger.info(
        "team_submission_created",
        extra={"lead": lead.reference, "agents": len(lead.service_details["agents"]), "locale": locale},
    )
    background.add_task(
        notify_new_lead, settings, str(lead.id), lead.reference, lead.service, lead.inquiry_type, lead.locale
    )
    return TeamSubmitted(reference=lead.reference, message=SUBMITTED_MESSAGES[locale])
