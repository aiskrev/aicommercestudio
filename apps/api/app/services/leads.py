"""Lead business logic, kept independent of HTTP so it can be reused by CLI and tests."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import Select, delete, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app import audit
from app.advisor import service as advisor
from app.models import (
    AdminUser,
    AIActionRequest,
    AIActionStatus,
    AuditLog,
    InquiryType,
    Lead,
    LeadLocale,
    LeadNote,
    LeadStatus,
    ServiceKey,
    utcnow,
)
from app.schemas import LeadCreate, LeadUpdate, QuoteRequestCreate

OPEN_STATUSES = (LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL)


def create_lead(
    db: Session,
    data: LeadCreate,
    *,
    privacy_notice_version: str,
    ip_hash: str | None,
    source: str = "website_contact_form",
    marketing_consent_version: str | None = None,
) -> Lead:
    now = utcnow()
    is_quote = isinstance(data, QuoteRequestCreate)
    lead = Lead(
        service=data.service.value,
        submitted_service=data.service.value,
        inquiry_type=InquiryType.QUOTE.value if is_quote else InquiryType.CONTACT.value,
        platform=data.platform.value if is_quote else None,
        budget_range=data.budget_range.value if is_quote else None,
        timeline=data.timeline.value if is_quote else None,
        website_url=data.website_url if is_quote else None,
        locale=data.locale.value,
        service_details=(
            {"kind": "ai_managed", **data.ai_managed.model_dump(mode="json")} if data.ai_managed is not None else None
        ),
        name=data.name,
        company=data.company,
        email=data.email,
        phone=data.phone,
        message=data.message,
        status=LeadStatus.NEW.value,
        source=source,
        privacy_acknowledged_at=now,
        privacy_notice_version=privacy_notice_version,
        marketing_consent=data.marketing_consent,
        marketing_consent_at=now if data.marketing_consent else None,
        marketing_consent_version=marketing_consent_version if data.marketing_consent else None,
        ip_hash=ip_hash,
        created_at=now,
        updated_at=now,
    )
    db.add(lead)
    db.flush()
    # An unknown or expired assessment id is ignored: it must never block a contact request.
    advisor_linked = bool(data.advisor_assessment_id) and advisor.link_to_lead(db, data.advisor_assessment_id, lead.id)
    audit.record(
        db,
        "lead.created",
        actor_label="website",
        entity_type="lead",
        entity_id=str(lead.id),
        details={
            "service": lead.service,
            "inquiry_type": lead.inquiry_type,
            "source": source,
            "marketing_consent": lead.marketing_consent,
            "locale": lead.locale,
            **({"advisor_assessment_linked": True} if advisor_linked else {}),
        },
        ip_hash=ip_hash,
    )
    db.commit()
    return lead


@dataclass(frozen=True)
class LeadFilters:
    status: LeadStatus | None = None
    service: ServiceKey | None = None
    inquiry_type: InquiryType | None = None
    locale: LeadLocale | None = None
    q: str | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None
    sort: str = "newest"


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _filtered(filters: LeadFilters) -> Select[tuple[Lead]]:
    stmt = select(Lead)
    if filters.status:
        stmt = stmt.where(Lead.status == filters.status.value)
    if filters.service:
        stmt = stmt.where(Lead.service == filters.service.value)
    if filters.inquiry_type:
        stmt = stmt.where(Lead.inquiry_type == filters.inquiry_type.value)
    if filters.locale:
        stmt = stmt.where(Lead.locale == filters.locale.value)
    if filters.q:
        pattern = f"%{_escape_like(filters.q.strip())}%"
        stmt = stmt.where(
            or_(
                Lead.name.ilike(pattern, escape="\\"),
                Lead.company.ilike(pattern, escape="\\"),
                Lead.email.ilike(pattern, escape="\\"),
            )
        )
    if filters.created_from:
        stmt = stmt.where(Lead.created_at >= filters.created_from)
    if filters.created_to:
        stmt = stmt.where(Lead.created_at <= filters.created_to)
    return stmt


def list_leads(db: Session, filters: LeadFilters, page: int, page_size: int) -> tuple[list[Lead], int]:
    base = _filtered(filters)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    order = Lead.created_at.asc() if filters.sort == "oldest" else Lead.created_at.desc()
    items = db.scalars(base.order_by(order, Lead.id).offset((page - 1) * page_size).limit(page_size)).all()
    return list(items), total


def get_lead(db: Session, lead_id: uuid.UUID, *, for_update: bool = False) -> Lead | None:
    stmt = select(Lead).where(Lead.id == lead_id)
    if for_update:
        # Row lock: concurrent updates of the same lead are serialised, so the
        # expected_status check below cannot race.
        return db.scalar(stmt.with_for_update())
    return db.scalar(stmt.options(selectinload(Lead.notes)))


class LeadConflictError(Exception):
    def __init__(self, current_status: str) -> None:
        super().__init__(current_status)
        self.current_status = current_status


def apply_update(db: Session, lead: Lead, changes: LeadUpdate, actor: AdminUser, ip_hash: str | None) -> Lead:
    """Apply status and/or service changes atomically, with optional optimistic concurrency check."""
    if changes.expected_status is not None and lead.status != changes.expected_status.value:
        db.rollback()
        raise LeadConflictError(lead.status)
    now = utcnow()
    if changes.status is not None and lead.status != changes.status.value:
        audit.record(
            db, "lead.status_changed", actor=actor, entity_type="lead", entity_id=str(lead.id),
            details={"from": lead.status, "to": changes.status.value}, ip_hash=ip_hash,
        )
        lead.status = changes.status.value
        lead.status_changed_at = now
    if changes.service is not None and lead.service != changes.service.value:
        audit.record(
            db, "lead.service_changed", actor=actor, entity_type="lead", entity_id=str(lead.id),
            details={"from": lead.service, "to": changes.service.value}, ip_hash=ip_hash,
        )
        lead.service = changes.service.value
    db.commit()
    return lead


def record_view(db: Session, lead: Lead, actor: AdminUser, ip_hash: str | None, throttle_minutes: int = 15) -> None:
    """Audit access to personal data, at most once per administrator and lead per throttle window."""
    since = utcnow() - timedelta(minutes=throttle_minutes)
    recent = db.scalar(
        select(AuditLog.id).where(
            AuditLog.action == "lead.viewed",
            AuditLog.entity_id == str(lead.id),
            AuditLog.actor_id == actor.id,
            AuditLog.created_at >= since,
        ).limit(1)
    )
    if recent is None:
        audit.record(db, "lead.viewed", actor=actor, entity_type="lead", entity_id=str(lead.id), ip_hash=ip_hash)
        db.commit()


def add_note(db: Session, lead: Lead, body: str, actor: AdminUser, ip_hash: str | None) -> LeadNote:
    note = LeadNote(lead_id=lead.id, author_id=actor.id, body=body)
    db.add(note)
    lead.updated_at = utcnow()
    db.flush()
    audit.record(
        db,
        "lead.note_added",
        actor=actor,
        entity_type="lead",
        entity_id=str(lead.id),
        details={"note_id": str(note.id), "length": len(body)},
        ip_hash=ip_hash,
    )
    db.commit()
    db.refresh(note)
    return note


def delete_lead(db: Session, lead: Lead, actor: AdminUser | None, ip_hash: str | None, reason: str) -> None:
    """Hard-delete a lead and its notes (GDPR erasure). The audit entry keeps no personal data."""
    lead_id = str(lead.id)
    db.delete(lead)
    audit.record(
        db,
        "lead.deleted",
        actor=actor,
        actor_label=None if actor else "retention-job",
        entity_type="lead",
        entity_id=lead_id,
        details={"reason": reason},
        ip_hash=ip_hash,
    )
    db.commit()


def lead_audit(db: Session, lead_id: uuid.UUID, limit: int = 100) -> list[AuditLog]:
    stmt = (
        select(AuditLog)
        .where(AuditLog.entity_type == "lead", AuditLog.entity_id == str(lead_id))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def recent_audit(db: Session, limit: int = 50) -> list[AuditLog]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit)
    return list(db.scalars(stmt).all())


@dataclass(frozen=True)
class AuditFilters:
    action: str | None = None
    action_prefix: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    actor: str | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None


def search_audit(db: Session, filters: AuditFilters, page: int, page_size: int) -> tuple[list[AuditLog], int]:
    stmt = select(AuditLog)
    if filters.action:
        stmt = stmt.where(AuditLog.action == filters.action)
    if filters.action_prefix:
        stmt = stmt.where(AuditLog.action.like(f"{_escape_like(filters.action_prefix)}%", escape="\\"))
    if filters.entity_type:
        stmt = stmt.where(AuditLog.entity_type == filters.entity_type)
    if filters.entity_id:
        stmt = stmt.where(AuditLog.entity_id == filters.entity_id)
    if filters.actor:
        stmt = stmt.where(AuditLog.actor_label.ilike(f"%{_escape_like(filters.actor)}%", escape="\\"))
    if filters.created_from:
        stmt = stmt.where(AuditLog.created_at >= filters.created_from)
    if filters.created_to:
        stmt = stmt.where(AuditLog.created_at <= filters.created_to)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(
        stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return list(items), total


def dashboard_stats(db: Session, now: datetime | None = None) -> dict:
    now = now or utcnow()
    by_status = {s.value: 0 for s in LeadStatus}
    for status_value, count in db.execute(select(Lead.status, func.count()).group_by(Lead.status)):
        by_status[status_value] = count
    by_service = {s.value: 0 for s in ServiceKey}
    for service_value, count in db.execute(select(Lead.service, func.count()).group_by(Lead.service)):
        by_service[service_value] = count
    by_inquiry_type = {t.value: 0 for t in InquiryType}
    for inquiry_value, count in db.execute(select(Lead.inquiry_type, func.count()).group_by(Lead.inquiry_type)):
        by_inquiry_type[inquiry_value] = count
    by_locale = {loc.value: 0 for loc in LeadLocale}
    for locale_value, count in db.execute(select(Lead.locale, func.count()).group_by(Lead.locale)):
        by_locale[locale_value] = count

    def _since(days: int) -> int:
        stmt = select(func.count()).select_from(Lead).where(Lead.created_at >= now - timedelta(days=days))
        return db.scalar(stmt) or 0

    pending_ai = db.scalar(
        select(func.count())
        .select_from(AIActionRequest)
        .where(AIActionRequest.status == AIActionStatus.PENDING.value)
    )
    return {
        "total_leads": sum(by_status.values()),
        "new_leads": by_status[LeadStatus.NEW.value],
        "leads_last_7_days": _since(7),
        "leads_last_30_days": _since(30),
        "open_pipeline": sum(by_status[s.value] for s in OPEN_STATUSES),
        "won": by_status[LeadStatus.WON.value],
        "lost": by_status[LeadStatus.LOST.value],
        "by_status": by_status,
        "by_service": by_service,
        "by_inquiry_type": by_inquiry_type,
        "by_locale": by_locale,
        "pending_ai_actions": pending_ai or 0,
        "recent_activity": recent_audit(db, limit=8),
    }


@dataclass(frozen=True)
class RetentionResult:
    leads_deleted: int
    audit_entries_deleted: int


READINESS_SOURCE = "readiness_assessment"
TEAM_SOURCE = "team_configurator"


def _expired_leads(
    now: datetime,
    lead_retention_days: int,
    readiness_retention_days: int | None,
    team_retention_days: int | None = None,
):
    """Leads past the general retention, or tool leads past their (shorter) own retention."""
    condition = Lead.updated_at < now - timedelta(days=lead_retention_days)
    for source, days in ((READINESS_SOURCE, readiness_retention_days), (TEAM_SOURCE, team_retention_days)):
        if days is not None:
            condition = or_(condition, (Lead.source == source) & (Lead.updated_at < now - timedelta(days=days)))
    return condition


def purge_expired(
    db: Session, lead_retention_days: int, audit_retention_days: int, *, dry_run: bool = False,
    now: datetime | None = None, readiness_retention_days: int | None = None, team_retention_days: int | None = None,
) -> RetentionResult:
    """Delete leads not updated within the retention period and audit entries older than theirs."""
    now = now or utcnow()
    audit_cutoff = now - timedelta(days=audit_retention_days)
    due = _expired_leads(now, lead_retention_days, readiness_retention_days, team_retention_days)
    expired = list(db.scalars(select(Lead).where(due)).all())
    old_audit = db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.created_at < audit_cutoff)) or 0
    if dry_run:
        return RetentionResult(len(expired), old_audit)
    for lead in expired:
        delete_lead(db, lead, actor=None, ip_hash=None, reason=f"retention>{lead_retention_days}d")
    db.execute(delete(AuditLog).where(AuditLog.created_at < audit_cutoff))
    db.commit()
    return RetentionResult(len(expired), old_audit)


@dataclass(frozen=True)
class RetentionPreview:
    lead_cutoff: datetime
    audit_cutoff: datetime
    leads_due: int
    audit_entries_due: int


def retention_preview(
    db: Session, lead_retention_days: int, audit_retention_days: int, now: datetime | None = None,
    readiness_retention_days: int | None = None, team_retention_days: int | None = None,
) -> RetentionPreview:
    now = now or utcnow()
    lead_cutoff = now - timedelta(days=lead_retention_days)
    audit_cutoff = now - timedelta(days=audit_retention_days)
    leads_due = (
        db.scalar(
            select(func.count())
            .select_from(Lead)
            .where(_expired_leads(now, lead_retention_days, readiness_retention_days, team_retention_days))
        )
        or 0
    )
    audit_due = db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.created_at < audit_cutoff)) or 0
    return RetentionPreview(lead_cutoff, audit_cutoff, leads_due, audit_due)


def purge_synthetic(db: Session, source: str) -> int:
    """Remove development seed data (leads with the given synthetic source and synthetic AI actions)."""
    leads = list(db.scalars(select(Lead).where(Lead.source == source)).all())
    for lead in leads:
        db.delete(lead)
    db.execute(delete(AIActionRequest).where(AIActionRequest.requested_by.like("%(synthetic)%")))
    audit.record(db, "seed.synthetic_purged", actor_label="cli", details={"leads": len(leads)})
    db.commit()
    return len(leads)
