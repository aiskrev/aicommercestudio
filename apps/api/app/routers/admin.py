"""Protected administration endpoints. Every route depends on `require_admin`."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response, status

from app import audit
from app.ai.base import AIProviderError, LeadTriageInput
from app.ai.factory import get_ai_provider
from app.ai.policy import ActionType, evaluate
from app.deps import Admin, AppSettings, DbSession
from app.integrations import integration_status
from app.models import AIActionStatus, Lead, LeadNote, LeadStatus, ServiceKey
from app.schemas import (
    AIActionDecision,
    AIActionOut,
    AuditLogOut,
    DashboardStats,
    IntegrationStatus,
    LeadDetailOut,
    LeadNoteCreate,
    LeadNoteOut,
    LeadPage,
    LeadSummaryOut,
    LeadTriageOut,
    LeadUpdate,
    SystemStatus,
)
from app.services import ai_actions, leads

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

NOT_FOUND = "Запитването не е намерено."


def _note_out(note: LeadNote) -> LeadNoteOut:
    return LeadNoteOut(
        id=note.id, body=note.body, created_at=note.created_at,
        author_name=note.author.full_name if note.author else None,
    )


def _lead_detail(lead: Lead) -> LeadDetailOut:
    base = LeadSummaryOut.model_validate(lead).model_dump()
    return LeadDetailOut(
        **base,
        phone=lead.phone,
        message=lead.message,
        privacy_acknowledged_at=lead.privacy_acknowledged_at,
        privacy_notice_version=lead.privacy_notice_version,
        marketing_consent=lead.marketing_consent,
        marketing_consent_at=lead.marketing_consent_at,
        status_changed_at=lead.status_changed_at,
        notes=[_note_out(n) for n in lead.notes],
    )


def _get_lead_or_404(db: DbSession, lead_id: uuid.UUID) -> Lead:
    lead = leads.get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return lead


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


# --------------------------------------------------------------------------- dashboard


@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(ctx: Admin, db: DbSession, response: Response) -> DashboardStats:
    _no_store(response)
    return DashboardStats.model_validate(leads.dashboard_stats(db))


@router.get("/audit", response_model=list[AuditLogOut])
def audit_log(
    ctx: Admin, db: DbSession, response: Response, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> list[AuditLogOut]:
    _no_store(response)
    return [AuditLogOut.model_validate(e) for e in leads.recent_audit(db, limit=limit)]


@router.get("/system/status", response_model=SystemStatus)
def system_status(ctx: Admin, settings: AppSettings) -> SystemStatus:
    return SystemStatus(
        environment=settings.app_env,
        ai_provider=get_ai_provider().name,
        email_enabled=settings.email_enabled,
        lead_retention_days=settings.lead_retention_days,
        integrations=[IntegrationStatus(**vars(i)) for i in integration_status(settings)],
    )


# --------------------------------------------------------------------------- leads


@router.get("/leads", response_model=LeadPage)
def list_leads(
    ctx: Admin,
    db: DbSession,
    response: Response,
    status_filter: Annotated[LeadStatus | None, Query(alias="status")] = None,
    service: ServiceKey | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    sort: Literal["newest", "oldest"] = "newest",
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> LeadPage:
    _no_store(response)
    filters = leads.LeadFilters(
        status=status_filter, service=service, q=q or None,
        created_from=created_from, created_to=created_to, sort=sort,
    )
    items, total = leads.list_leads(db, filters, page, page_size)
    return LeadPage(
        items=[LeadSummaryOut.model_validate(i) for i in items], total=total, page=page, page_size=page_size
    )


@router.get("/leads/{lead_id}", response_model=LeadDetailOut)
def get_lead(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> LeadDetailOut:
    _no_store(response)
    return _lead_detail(_get_lead_or_404(db, lead_id))


@router.patch("/leads/{lead_id}", response_model=LeadDetailOut)
def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, ctx: Admin, db: DbSession) -> LeadDetailOut:
    lead = _get_lead_or_404(db, lead_id)
    leads.update_status(db, lead, payload.status, ctx.user, ctx.ip_hash)
    return _lead_detail(_get_lead_or_404(db, lead_id))


@router.post("/leads/{lead_id}/notes", response_model=LeadNoteOut, status_code=status.HTTP_201_CREATED)
def add_note(lead_id: uuid.UUID, payload: LeadNoteCreate, ctx: Admin, db: DbSession) -> LeadNoteOut:
    lead = _get_lead_or_404(db, lead_id)
    return _note_out(leads.add_note(db, lead, payload.body, ctx.user, ctx.ip_hash))


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: uuid.UUID, ctx: Admin, db: DbSession) -> Response:
    lead = _get_lead_or_404(db, lead_id)
    leads.delete_lead(db, lead, ctx.user, ctx.ip_hash, reason="admin_erasure_request")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Действието изисква одобрение.")
    provider = get_ai_provider()
    try:
        result = provider.triage_lead(LeadTriageInput(service=lead.service, message=lead.message))
    except AIProviderError as exc:
        logger.warning("ai_triage_failed", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI услугата не е достъпна в момента."
        ) from exc
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
        action = ai_actions.decide(
            db, action_id, payload.decision == "approve", ctx.user, payload.comment, ctx.ip_hash
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Действието не е намерено.") from exc
    except ai_actions.ActionStateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _action_out(action)
