"""Protected administration endpoints. Every route depends on `require_admin`."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, status
from pydantic import ValidationError

from app import audit
from app.advisor import service as advisor
from app.ai.base import AIProviderError, LeadTriageInput
from app.ai.factory import get_ai_provider
from app.ai.policy import ActionType, evaluate
from app.assessments import service as assessment_service
from app.deps import Admin, AppSettings, DbSession
from app.errors import ApiError
from app.integrations import integration_status
from app.models import AIActionStatus, InquiryType, Lead, LeadLocale, LeadNote, LeadStatus, ServiceKey
from app.readiness.report import ReportUnavailable, build_report
from app.readiness.scoring import ReadinessResult
from app.schemas import (
    AIActionDecision,
    AIActionOut,
    AiManagedDetails,
    AuditLogOut,
    AuditPage,
    DashboardStats,
    IntegrationStatus,
    LeadDetailOut,
    LeadNoteCreate,
    LeadNoteOut,
    LeadPage,
    LeadSummaryOut,
    LeadTriageOut,
    LeadUpdate,
    ReadinessDetailsOut,
    RetentionPreview,
    RetentionRunIn,
    RetentionRunOut,
    SystemStatus,
    TeamDetailsOut,
)
from app.services import ai_actions, leads
from app.team import service as team_service
from app.team.report import build_team_report

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

NOT_FOUND = "Запитването не е намерено."


def _note_out(note: LeadNote) -> LeadNoteOut:
    return LeadNoteOut(
        id=note.id,
        body=note.body,
        created_at=note.created_at,
        author_name=note.author.full_name if note.author else None,
    )


def _ai_managed_details(lead: Lead) -> AiManagedDetails | None:
    """Validated AI Managed Services details, or None (other services, older leads, unexpected data)."""
    details = lead.service_details or {}
    if details.get("kind") != "ai_managed":
        return None
    try:
        return AiManagedDetails.model_validate({k: v for k, v in details.items() if k != "kind"})
    except ValidationError:
        logger.warning("lead_service_details_invalid", extra={"lead": lead.reference})
        return None


def _readiness_details(lead: Lead) -> ReadinessDetailsOut | None:
    """Validated readiness submission details, or None (other leads, unexpected data)."""
    details = lead.service_details or {}
    if details.get("kind") != "readiness":
        return None
    result = details.get("result") or {}
    try:
        return ReadinessDetailsOut(
            model_version=details.get("model_version", ""),
            role=details.get("role", ""),
            consultation_requested=bool(details.get("consultation_requested")),
            overall=result.get("overall"),
            band=result.get("band"),
            dimensions=result.get("dimensions"),
            blockers=result.get("blockers"),
            actions=result.get("actions"),
        )
    except ValidationError:
        logger.warning("lead_service_details_invalid", extra={"lead": lead.reference})
        return None


def _team_details(db: DbSession, lead: Lead) -> TeamDetailsOut | None:
    """Validated configurator consultation details, or None (other leads, unexpected data)."""
    details = lead.service_details or {}
    if details.get("kind") != "team":
        return None
    row = team_service.configuration_for_lead(db, lead.id)
    ranges = details.get("ranges") or {}
    expected = details.get("expected") or {}
    try:
        return TeamDetailsOut(
            reference=row.reference if row else None,
            model_version=details.get("model_version", ""),
            assumptions_version=details.get("assumptions_version", ""),
            role=details.get("role", ""),
            agents=details.get("agents"),
            complexity=(details.get("complexity") or {}).get("band"),
            deployment=details.get("deployment"),
            operations=details.get("operations"),
            currency=details.get("currency", "EUR"),
            one_time_range=ranges.get("one_time"),
            monthly_range=ranges.get("monthly"),
            expected_one_time=expected.get("one_time"),
            expected_monthly=expected.get("monthly"),
        )
    except ValidationError:
        logger.warning("lead_service_details_invalid", extra={"lead": lead.reference})
        return None


def _lead_detail(db: DbSession, lead: Lead) -> LeadDetailOut:
    base = LeadSummaryOut.model_validate(lead).model_dump()
    return LeadDetailOut(
        **base,
        phone=lead.phone,
        message=lead.message,
        privacy_acknowledged_at=lead.privacy_acknowledged_at,
        privacy_notice_version=lead.privacy_notice_version,
        marketing_consent=lead.marketing_consent,
        marketing_consent_at=lead.marketing_consent_at,
        marketing_consent_version=lead.marketing_consent_version,
        status_changed_at=lead.status_changed_at,
        submitted_service=lead.submitted_service,
        platform=lead.platform,
        budget_range=lead.budget_range,
        timeline=lead.timeline,
        website_url=lead.website_url,
        notes=[_note_out(n) for n in lead.notes],
        advisor_assessment=advisor.summary_for_lead(db, lead.id),
        ai_managed=_ai_managed_details(lead),
        readiness=_readiness_details(lead),
        team=_team_details(db, lead),
    )


def _get_lead_or_404(db: DbSession, lead_id: uuid.UUID, *, for_update: bool = False) -> Lead:
    lead = leads.get_lead(db, lead_id, for_update=for_update)
    if lead is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "lead_not_found")
    return lead


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


# --------------------------------------------------------------------------- dashboard & system


@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(ctx: Admin, db: DbSession, response: Response) -> DashboardStats:
    _no_store(response)
    return DashboardStats.model_validate(leads.dashboard_stats(db))


@router.get("/audit", response_model=AuditPage)
def audit_log(
    ctx: Admin,
    db: DbSession,
    response: Response,
    action: Annotated[str | None, Query(max_length=64)] = None,
    action_prefix: Annotated[str | None, Query(max_length=40, description="e.g. 'lead.' or 'auth.'")] = None,
    entity_type: Annotated[str | None, Query(max_length=40)] = None,
    entity_id: Annotated[str | None, Query(max_length=64)] = None,
    actor: Annotated[str | None, Query(max_length=120)] = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AuditPage:
    """Searchable, paginated audit trail (newest first)."""
    _no_store(response)
    filters = leads.AuditFilters(
        action=action or None,
        action_prefix=action_prefix or None,
        entity_type=entity_type or None,
        entity_id=entity_id or None,
        actor=actor or None,
        created_from=created_from,
        created_to=created_to,
    )
    items, total = leads.search_audit(db, filters, page, page_size)
    return AuditPage(
        items=[AuditLogOut.model_validate(e) for e in items], total=total, page=page, page_size=page_size
    )


@router.get("/system/status", response_model=SystemStatus)
def system_status(ctx: Admin, settings: AppSettings) -> SystemStatus:
    return SystemStatus(
        environment=settings.app_env,
        ai_provider=get_ai_provider().name,
        email_enabled=settings.email_enabled,
        lead_retention_days=settings.lead_retention_days,
        integrations=[IntegrationStatus(**vars(i)) for i in integration_status(settings)],
    )


@router.get("/retention", response_model=RetentionPreview)
def retention_preview(ctx: Admin, db: DbSession, settings: AppSettings, response: Response) -> RetentionPreview:
    """What the retention policy would delete right now (nothing is changed)."""
    _no_store(response)
    preview = leads.retention_preview(
        db,
        settings.lead_retention_days,
        settings.audit_retention_days,
        readiness_retention_days=settings.readiness_retention_days,
        team_retention_days=settings.team_lead_retention_days,
    )
    return RetentionPreview(
        lead_retention_days=settings.lead_retention_days,
        audit_retention_days=settings.audit_retention_days,
        leads_due=preview.leads_due,
        audit_entries_due=preview.audit_entries_due,
        lead_cutoff=preview.lead_cutoff,
        audit_cutoff=preview.audit_cutoff,
        advisor_retention_days=settings.advisor_retention_days,
        advisor_assessments_due=advisor.count_expired(db),
        team_configuration_retention_days=settings.team_configuration_retention_days,
        team_configurations_due=team_service.count_expired(db),
        assessment_retention_days=settings.assessment_retention_days,
        assessment_results_due=assessment_service.count_expired(db),
    )


@router.post("/retention/run", response_model=RetentionRunOut)
def retention_run(payload: RetentionRunIn, ctx: Admin, db: DbSession, settings: AppSettings) -> RetentionRunOut:
    """Apply the retention policy now. Requires `{"confirm": true}`; the run itself is audited."""
    result = leads.purge_expired(
        db,
        settings.lead_retention_days,
        settings.audit_retention_days,
        readiness_retention_days=settings.readiness_retention_days,
        team_retention_days=settings.team_lead_retention_days,
    )
    assessments = advisor.purge_expired(db)
    configurations = team_service.purge_expired(db)
    saved_assessments = assessment_service.purge_expired(db)
    audit.record(
        db, "retention.run", actor=ctx.user, entity_type="system",
        details={
            "leads_deleted": result.leads_deleted,
            "audit_entries_deleted": result.audit_entries_deleted,
            "advisor_assessments_deleted": assessments.deleted,
            "team_configurations_deleted": configurations.deleted,
            "assessment_results_deleted": saved_assessments.deleted,
        },
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    return RetentionRunOut(
        leads_deleted=result.leads_deleted,
        audit_entries_deleted=result.audit_entries_deleted,
        advisor_assessments_deleted=assessments.deleted,
        team_configurations_deleted=configurations.deleted,
        assessment_results_deleted=saved_assessments.deleted,
    )


# --------------------------------------------------------------------------- leads


@router.get("/leads", response_model=LeadPage)
def list_leads(
    ctx: Admin,
    db: DbSession,
    response: Response,
    status_filter: Annotated[LeadStatus | None, Query(alias="status")] = None,
    service: ServiceKey | None = None,
    inquiry_type: InquiryType | None = None,
    locale: LeadLocale | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    sort: Literal["newest", "oldest"] = "newest",
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> LeadPage:
    _no_store(response)
    filters = leads.LeadFilters(
        status=status_filter,
        service=service,
        inquiry_type=inquiry_type,
        locale=locale,
        q=q or None,
        created_from=created_from,
        created_to=created_to,
        sort=sort,
    )
    items, total = leads.list_leads(db, filters, page, page_size)
    return LeadPage(
        items=[LeadSummaryOut.model_validate(i) for i in items], total=total, page=page, page_size=page_size
    )


@router.get("/leads/{lead_id}", response_model=LeadDetailOut)
def get_lead(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> LeadDetailOut:
    """Lead details. Access to personal data is audited (`lead.viewed`, throttled per admin)."""
    _no_store(response)
    lead = _get_lead_or_404(db, lead_id)
    leads.record_view(db, lead, ctx.user, ctx.ip_hash)
    return _lead_detail(db, _get_lead_or_404(db, lead_id))


@router.patch(
    "/leads/{lead_id}",
    response_model=LeadDetailOut,
    responses={409: {"description": "`expected_status` no longer matches (concurrent change)"}},
)
def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, ctx: Admin, db: DbSession) -> LeadDetailOut:
    lead = _get_lead_or_404(db, lead_id, for_update=True)
    try:
        leads.apply_update(db, lead, payload, ctx.user, ctx.ip_hash)
    except leads.LeadConflictError as exc:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "Запитването е променено от друг администратор. Презаредете страницата и опитайте отново.",
            "status_conflict",
        ) from exc
    return _lead_detail(db, _get_lead_or_404(db, lead_id))


@router.post("/leads/{lead_id}/notes", response_model=LeadNoteOut, status_code=status.HTTP_201_CREATED)
def add_note(lead_id: uuid.UUID, payload: LeadNoteCreate, ctx: Admin, db: DbSession) -> LeadNoteOut:
    lead = _get_lead_or_404(db, lead_id)
    return _note_out(leads.add_note(db, lead, payload.body, ctx.user, ctx.ip_hash))


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: uuid.UUID, ctx: Admin, db: DbSession) -> Response:
    lead = _get_lead_or_404(db, lead_id)
    leads.delete_lead(db, lead, ctx.user, ctx.ip_hash, reason="admin_erasure_request")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/leads/{lead_id}/readiness-report",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    summary="PDF report of a lead's AI readiness submission (admins only)",
)
def lead_readiness_report(lead_id: uuid.UUID, ctx: Admin, db: DbSession) -> Response:
    lead = _get_lead_or_404(db, lead_id)
    details = lead.service_details or {}
    stored = details.get("result")
    if details.get("kind") != "readiness" or not isinstance(stored, dict):
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "readiness_not_found")
    # Rebuilt from the stored result, so the report matches what the visitor saw even after a model change.
    try:
        result = ReadinessResult(**stored)
        version = str(details.get("model_version", "2026-10.2"))
        pdf = build_report(result, lead.locale, lead.company, model_version=version)
    except (TypeError, KeyError, ValueError, ReportUnavailable) as exc:
        logger.warning("readiness_report_failed", extra={"lead": lead.reference, "error": type(exc).__name__})
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Отчетът не може да бъде създаден.", "report_unavailable"
        ) from exc
    audit.record(
        db, "lead.readiness_report_downloaded", actor=ctx.user, entity_type="lead", entity_id=str(lead.id),
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="readiness-{lead.reference}.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.get(
    "/leads/{lead_id}/team-report",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    summary="PDF plan of a lead's AI team configuration (admins only)",
)
def lead_team_report(lead_id: uuid.UUID, ctx: Admin, db: DbSession, settings: AppSettings) -> Response:
    lead = _get_lead_or_404(db, lead_id)
    is_team = (lead.service_details or {}).get("kind") == "team"
    row = team_service.configuration_for_lead(db, lead.id) if is_team else None
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "team_configuration_not_found")
    # Priced with the assumptions version stored with the configuration while that file is available.
    try:
        config = team_service.config_from_row(row)
        doc = team_service.assumptions_for_version(settings, row.assumptions_version)
        plan = team_service.build_plan(config, doc, row.overrides or {})
        pdf = build_team_report(config, plan, lead.locale, lead.company)
    except (TypeError, KeyError, ValueError, ReportUnavailable) as exc:
        logger.warning("team_report_failed", extra={"lead": lead.reference, "error": type(exc).__name__})
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Отчетът не може да бъде създаден.", "report_unavailable"
        ) from exc
    audit.record(
        db, "lead.team_report_downloaded", actor=ctx.user, entity_type="lead", entity_id=str(lead.id),
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="ai-team-{lead.reference}.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/leads/{lead_id}/audit", response_model=list[AuditLogOut])
def lead_audit(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> list[AuditLogOut]:
    _no_store(response)
    _get_lead_or_404(db, lead_id)
    return [AuditLogOut.model_validate(e) for e in leads.lead_audit(db, lead_id)]


@router.post("/leads/{lead_id}/ai/triage", response_model=LeadTriageOut)
def triage_lead(lead_id: uuid.UUID, ctx: Admin, db: DbSession) -> LeadTriageOut:
    """Read-only AI suggestion. Classification is a low-risk action under the approval policy."""
    lead = _get_lead_or_404(db, lead_id)
    if evaluate(ActionType.CLASSIFY_LEAD).requires_approval:
        raise ApiError(status.HTTP_403_FORBIDDEN, "Действието изисква одобрение.", "approval_required")
    provider = get_ai_provider()
    try:
        result = provider.triage_lead(LeadTriageInput(service=lead.service, message=lead.message))
    except AIProviderError as exc:
        logger.warning("ai_triage_failed", extra={"error": str(exc)})
        raise ApiError(status.HTTP_502_BAD_GATEWAY, "AI услугата не е достъпна в момента.", "ai_unavailable") from exc
    audit.record(
        db, "ai.lead_triage", actor=ctx.user, entity_type="lead", entity_id=str(lead.id),
        details={"provider": result.provider, "suggested_service": result.suggested_service,
                 "priority": result.priority},
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    return LeadTriageOut(**vars(result))


# --------------------------------------------------------------------------- AI approvals


def _action_out(action) -> AIActionOut:
    out = AIActionOut.model_validate(action)
    out.decided_by_name = action.decided_by.full_name if action.decided_by else None
    return out


@router.get("/ai/actions", response_model=list[AIActionOut])
def list_ai_actions(
    ctx: Admin,
    db: DbSession,
    response: Response,
    status_filter: Annotated[AIActionStatus | None, Query(alias="status")] = None,
) -> list[AIActionOut]:
    _no_store(response)
    return [_action_out(a) for a in ai_actions.list_actions(db, status_filter)]


@router.post("/ai/actions/{action_id}/decision", response_model=AIActionOut)
def decide_ai_action(action_id: uuid.UUID, payload: AIActionDecision, ctx: Admin, db: DbSession) -> AIActionOut:
    try:
        action = ai_actions.decide(db, action_id, payload.decision == "approve", ctx.user, payload.comment, ctx.ip_hash)
    except LookupError as exc:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Действието не е намерено.", "action_not_found") from exc
    except ai_actions.ActionStateError as exc:
        raise ApiError(status.HTTP_409_CONFLICT, str(exc), "already_decided") from exc
    return _action_out(action)
