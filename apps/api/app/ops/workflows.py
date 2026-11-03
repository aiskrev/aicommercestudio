"""Incident management and controlled change approval for managed AI systems (docs/AI_OPERATIONS_RUNBOOK.md).

A record-management module: it never touches a client system, sends no notification and promises
no response time. People move records through fixed state machines:

    incident: detected → triaged → investigating → mitigated → resolved → reviewed
              (mitigated → investigating re-opens; resolved needs a note; reviewed needs incidents.review)
    change:   draft → risk_review → evaluation → human_approval → approved | rejected
              approved → released (a recorded release — nothing is deployed) → reviewed
              rejected → draft

Every transition names the expected `lock_version`; the row is locked (SELECT … FOR UPDATE) and a
stale version gets 409, so two people cannot both move the same record. Each decision is appended
to an immutable timeline (`ops_*_events`: a trigger refuses UPDATE and the runtime role has no
DELETE) and to the audit log with the reviewer's identity. Notes and evidence are plain text: control
characters, HTML/links and anything that looks like a credential are refused.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any

from fastapi import status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import audit
from app.errors import ApiError
from app.models import OpsAgent, OpsMembership, utcnow
from app.ops.models import (
    ChangeStatus,
    EventKind,
    Impact,
    IncidentStatus,
    OpsAgentVersion,
    OpsChange,
    OpsChangeEvent,
    OpsEvalRun,
    OpsIncident,
    OpsIncidentEvent,
    RiskLevel,
    Severity,
    VersionStatus,
)
from app.ops.rbac import Permission
from app.ops.tenancy import OpsContext, audit_details, ensure_active, forbidden, get_scoped, scoped
from app.schemas import StrictModel, _clean_text, _no_secrets

_MARKUP = re.compile(r"<[^>]*>|javascript:", re.IGNORECASE)


def sanitize(value: str) -> str:
    """Plain text only: no control characters, no markup, nothing that looks like a secret."""
    value = _no_secrets(_clean_text(value))
    if _MARKUP.search(value):
        raise PydanticCustomError("ops_markup", "Notes are plain text: HTML is not allowed.")
    return value


def _opt(value: str | None) -> str | None:
    return None if value is None else (sanitize(value) or None)


# ------------------------------------------------------------------------------------ schemas


class IncidentCreate(StrictModel):
    title: str = Field(min_length=3, max_length=200)
    severity: Severity
    impact: Impact
    agent_id: uuid.UUID | None = None
    owner_user_id: uuid.UUID | None = None
    client_summary: str | None = Field(default=None, max_length=1000)
    detected_at: datetime | None = None
    note: str | None = Field(default=None, max_length=4000)

    _t = field_validator("title")(classmethod(lambda cls, v: sanitize(v)))
    _o = field_validator("client_summary", "note")(classmethod(lambda cls, v: _opt(v)))


class IncidentUpdate(StrictModel):
    expected_version: int = Field(ge=1)
    severity: Severity | None = None
    owner_user_id: uuid.UUID | None = None
    client_summary: str | None = Field(default=None, max_length=1000)
    rollback_version_id: uuid.UUID | None = None

    _o = field_validator("client_summary")(classmethod(lambda cls, v: _opt(v)))


class Transition(StrictModel):
    to: str = Field(min_length=3, max_length=16)
    expected_version: int = Field(ge=1)
    note: str | None = Field(default=None, max_length=4000)
    evaluation_run_id: uuid.UUID | None = None
    release_note: str | None = Field(default=None, max_length=1000)

    _o = field_validator("note", "release_note")(classmethod(lambda cls, v: _opt(v)))


class NoteIn(StrictModel):
    body: str = Field(min_length=1, max_length=4000)
    kind: EventKind = EventKind.NOTE

    _b = field_validator("body")(classmethod(lambda cls, v: sanitize(v)))

    @field_validator("kind")
    @classmethod
    def _kind(cls, value: EventKind) -> EventKind:
        if value not in (EventKind.NOTE, EventKind.EVIDENCE):
            raise PydanticCustomError("ops_note_kind", "Use note or evidence.")
        return value


class ChangeCreate(StrictModel):
    agent_version_id: uuid.UUID
    title: str = Field(min_length=3, max_length=200)
    risk: RiskLevel
    risk_notes: str | None = Field(default=None, max_length=2000)
    rollback_version_id: uuid.UUID | None = None
    owner_user_id: uuid.UUID | None = None

    _t = field_validator("title")(classmethod(lambda cls, v: sanitize(v)))
    _o = field_validator("risk_notes")(classmethod(lambda cls, v: _opt(v)))


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    from_status: str | None
    to_status: str | None
    body: str | None
    actor_user_id: uuid.UUID | None
    actor_label: str
    created_at: datetime


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    agent_id: uuid.UUID | None
    title: str
    severity: str
    impact: str
    status: str
    client_summary: str | None
    owner_user_id: uuid.UUID | None
    rollback_version_id: uuid.UUID | None
    detected_at: datetime
    triaged_at: datetime | None
    investigating_at: datetime | None
    mitigated_at: datetime | None
    resolved_at: datetime | None
    reviewed_at: datetime | None
    lock_version: int
    created_at: datetime
    updated_at: datetime
    allowed_transitions: list[str] = []


class IncidentDetail(IncidentOut):
    events: list[EventOut]


class ChangeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    agent_id: uuid.UUID
    agent_version_id: uuid.UUID
    title: str
    risk: str
    status: str
    risk_notes: str | None
    release_note: str | None
    evaluation_run_id: uuid.UUID | None
    rollback_version_id: uuid.UUID | None
    owner_user_id: uuid.UUID | None
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    released_at: datetime | None
    reviewed_at: datetime | None
    lock_version: int
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    allowed_transitions: list[str] = []


class ChangeDetail(ChangeOut):
    events: list[EventOut]
    evidence_simulated: bool | None = None


# -------------------------------------------------------------------------------- state machines

INCIDENT_FLOW: dict[str, dict[str, Permission]] = {
    IncidentStatus.DETECTED: {IncidentStatus.TRIAGED: Permission.INCIDENTS_WRITE},
    IncidentStatus.TRIAGED: {IncidentStatus.INVESTIGATING: Permission.INCIDENTS_WRITE},
    IncidentStatus.INVESTIGATING: {IncidentStatus.MITIGATED: Permission.INCIDENTS_WRITE},
    IncidentStatus.MITIGATED: {
        IncidentStatus.RESOLVED: Permission.INCIDENTS_WRITE,
        IncidentStatus.INVESTIGATING: Permission.INCIDENTS_WRITE,
    },
    IncidentStatus.RESOLVED: {IncidentStatus.REVIEWED: Permission.INCIDENTS_REVIEW},
    IncidentStatus.REVIEWED: {},
}
_INCIDENT_TIMESTAMP = {
    IncidentStatus.TRIAGED: "triaged_at",
    IncidentStatus.INVESTIGATING: "investigating_at",
    IncidentStatus.MITIGATED: "mitigated_at",
    IncidentStatus.RESOLVED: "resolved_at",
    IncidentStatus.REVIEWED: "reviewed_at",
}
_NOTE_REQUIRED = {IncidentStatus.RESOLVED, IncidentStatus.REVIEWED, ChangeStatus.REJECTED, ChangeStatus.REVIEWED}

CHANGE_FLOW: dict[str, dict[str, Permission]] = {
    ChangeStatus.DRAFT: {ChangeStatus.RISK_REVIEW: Permission.CHANGES_WRITE},
    ChangeStatus.RISK_REVIEW: {ChangeStatus.EVALUATION: Permission.CHANGES_WRITE},
    ChangeStatus.EVALUATION: {ChangeStatus.HUMAN_APPROVAL: Permission.CHANGES_WRITE},
    ChangeStatus.HUMAN_APPROVAL: {
        ChangeStatus.APPROVED: Permission.CHANGES_APPROVE,
        ChangeStatus.REJECTED: Permission.CHANGES_APPROVE,
    },
    ChangeStatus.APPROVED: {ChangeStatus.RELEASED: Permission.CHANGES_WRITE},
    ChangeStatus.REJECTED: {ChangeStatus.DRAFT: Permission.CHANGES_WRITE},
    ChangeStatus.RELEASED: {ChangeStatus.REVIEWED: Permission.CHANGES_APPROVE},
    ChangeStatus.REVIEWED: {},
}


def allowed(flow: dict[str, dict[str, Permission]], ctx: OpsContext, current: str) -> list[str]:
    return [to for to, permission in flow.get(current, {}).items() if ctx.can(permission)]


def _err(code: str, detail: str, status_code: int = status.HTTP_409_CONFLICT) -> ApiError:
    return ApiError(status_code, detail, code)


def _stale() -> ApiError:
    return _err("ops_stale", "Записът беше променен междувременно. Презаредете и опитайте отново.")


def _member(db: Session, ctx: OpsContext, user_id: uuid.UUID | None) -> uuid.UUID | None:
    if user_id is None:
        return None
    exists = db.scalar(scoped(ctx, OpsMembership).where(OpsMembership.user_id == user_id))
    if exists is None:
        raise _err(
            "ops_owner_unknown",
            "The owner must be a member of this organisation.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )
    return user_id


def _audit(db: Session, ctx: OpsContext, action: str, entity_type: str, entity: Any, **extra: Any) -> None:
    audit.record(
        db,
        action,
        actor=ctx.admin.user,
        entity_type=entity_type,
        entity_id=str(entity.id),
        details=audit_details(ctx, number=entity.number, status=entity.status, **extra),
        ip_hash=ctx.admin.ip_hash,
    )


def _next_number(db: Session, model: type, ctx: OpsContext) -> int:
    return (db.scalar(select(func.max(model.number)).where(model.organization_id == ctx.organization_id)) or 0) + 1


def _locked(db: Session, ctx: OpsContext, model: type, entity_id: uuid.UUID, expected: int) -> Any:
    entity = db.scalar(scoped(ctx, model).where(model.id == entity_id).with_for_update())
    if entity is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Не е намерено.", "ops_not_found")
    if entity.lock_version != expected:
        db.rollback()
        raise _stale()
    return entity


# ----------------------------------------------------------------------------------- incidents


def _incident_event(
    db: Session,
    ctx: OpsContext,
    incident: OpsIncident,
    kind: EventKind,
    *,
    body: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
) -> None:
    db.add(
        OpsIncidentEvent(
            organization_id=ctx.organization_id,
            incident_id=incident.id,
            kind=kind,
            body=body,
            from_status=from_status,
            to_status=to_status,
            actor_user_id=ctx.admin.user.id,
            actor_label=ctx.admin.user.email,
        )
    )


def create_incident(db: Session, ctx: OpsContext, body: IncidentCreate) -> OpsIncident:
    if body.agent_id:
        get_scoped(db, ctx, OpsAgent, body.agent_id)
    owner = _member(db, ctx, body.owner_user_id) or ctx.admin.user.id
    for _attempt in range(3):
        incident = OpsIncident(
            organization_id=ctx.organization_id,
            number=_next_number(db, OpsIncident, ctx),
            agent_id=body.agent_id,
            title=body.title,
            severity=body.severity,
            impact=body.impact,
            status=IncidentStatus.DETECTED,
            client_summary=body.client_summary,
            owner_user_id=owner,
            detected_at=body.detected_at or utcnow(),
            created_by=ctx.admin.user.id,
            lock_version=1,
        )
        db.add(incident)
        try:
            db.flush()
            break
        except IntegrityError:
            db.rollback()
    else:
        raise _stale()
    _incident_event(db, ctx, incident, EventKind.CREATED, body=body.note, to_status=IncidentStatus.DETECTED)
    _audit(
        db,
        ctx,
        "ops.incident_created",
        "ops_incident",
        incident,
        severity=body.severity.value,
        impact=body.impact.value,
    )
    db.commit()
    return incident


def transition_incident(db: Session, ctx: OpsContext, incident_id: uuid.UUID, body: Transition) -> OpsIncident:
    ensure_active(ctx)
    incident = _locked(db, ctx, OpsIncident, incident_id, body.expected_version)
    current = incident.status
    permission = INCIDENT_FLOW.get(current, {}).get(body.to)
    if permission is None:
        db.rollback()
        raise _err("ops_transition", f"Not allowed: {current} → {body.to}.")
    if not ctx.can(permission):
        db.rollback()
        raise forbidden()
    if body.to in _NOTE_REQUIRED and not body.note:
        db.rollback()
        raise _err("ops_note_required", "This step needs a note.", status.HTTP_422_UNPROCESSABLE_CONTENT)
    now = utcnow()
    incident.status = body.to
    setattr(incident, _INCIDENT_TIMESTAMP[body.to], now)
    incident.lock_version += 1
    incident.updated_at = now
    _incident_event(db, ctx, incident, EventKind.STATUS, body=body.note, from_status=current, to_status=body.to)
    _audit(db, ctx, "ops.incident_transition", "ops_incident", incident, from_status=current, to_status=body.to)
    db.commit()
    return incident


def update_incident(db: Session, ctx: OpsContext, incident_id: uuid.UUID, body: IncidentUpdate) -> OpsIncident:
    incident = _locked(db, ctx, OpsIncident, incident_id, body.expected_version)
    changes = body.model_dump(exclude_unset=True, exclude={"expected_version"})
    if "owner_user_id" in changes:
        changes["owner_user_id"] = _member(db, ctx, changes["owner_user_id"])
    if changes.get("rollback_version_id"):
        get_scoped(db, ctx, OpsAgentVersion, changes["rollback_version_id"])
    for field, value in changes.items():
        setattr(incident, field, value)
    incident.lock_version += 1
    incident.updated_at = utcnow()
    if "owner_user_id" in changes:
        _incident_event(db, ctx, incident, EventKind.ASSIGNMENT, body=f"owner {changes['owner_user_id']}")
    _audit(db, ctx, "ops.incident_updated", "ops_incident", incident, fields=sorted(changes))
    db.commit()
    return incident


def add_incident_note(db: Session, ctx: OpsContext, incident: OpsIncident, body: NoteIn) -> None:
    _incident_event(db, ctx, incident, body.kind, body=body.body)
    _audit(db, ctx, "ops.incident_note", "ops_incident", incident, kind=body.kind.value)
    db.commit()


def incident_events(db: Session, ctx: OpsContext, incident: OpsIncident) -> list[EventOut]:
    rows = db.scalars(
        scoped(ctx, OpsIncidentEvent)
        .where(OpsIncidentEvent.incident_id == incident.id)
        .order_by(OpsIncidentEvent.created_at)
    )
    return [EventOut.model_validate(e) for e in rows]


def incident_out(ctx: OpsContext, incident: OpsIncident) -> IncidentOut:
    out = IncidentOut.model_validate(incident)
    out.allowed_transitions = allowed(INCIDENT_FLOW, ctx, incident.status)
    return out


# ------------------------------------------------------------------------------------- changes


def _change_event(
    db: Session,
    ctx: OpsContext,
    change: OpsChange,
    kind: EventKind,
    *,
    body: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
) -> None:
    db.add(
        OpsChangeEvent(
            organization_id=ctx.organization_id,
            change_id=change.id,
            kind=kind,
            body=body,
            from_status=from_status,
            to_status=to_status,
            actor_user_id=ctx.admin.user.id,
            actor_label=ctx.admin.user.email,
        )
    )


def create_change(db: Session, ctx: OpsContext, body: ChangeCreate) -> OpsChange:
    version = get_scoped(db, ctx, OpsAgentVersion, body.agent_version_id)
    if body.rollback_version_id:
        rollback = get_scoped(db, ctx, OpsAgentVersion, body.rollback_version_id)
        if rollback.agent_id != version.agent_id:
            raise _err("ops_rollback_agent", "The rollback version must belong to the same agent.")
    owner = _member(db, ctx, body.owner_user_id) or ctx.admin.user.id
    for _attempt in range(3):
        change = OpsChange(
            organization_id=ctx.organization_id,
            number=_next_number(db, OpsChange, ctx),
            agent_id=version.agent_id,
            agent_version_id=version.id,
            title=body.title,
            risk=body.risk,
            status=ChangeStatus.DRAFT,
            risk_notes=body.risk_notes,
            rollback_version_id=body.rollback_version_id,
            owner_user_id=owner,
            created_by=ctx.admin.user.id,
            lock_version=1,
        )
        db.add(change)
        try:
            db.flush()
            break
        except IntegrityError:
            db.rollback()
    else:
        raise _stale()
    _change_event(db, ctx, change, EventKind.CREATED, to_status=ChangeStatus.DRAFT)
    _audit(db, ctx, "ops.change_created", "ops_change", change, risk=body.risk.value, agent_version=str(version.id))
    db.commit()
    return change


def transition_change(db: Session, ctx: OpsContext, change_id: uuid.UUID, body: Transition) -> OpsChange:
    ensure_active(ctx)
    change = _locked(db, ctx, OpsChange, change_id, body.expected_version)
    current = change.status

    def refuse(error: ApiError) -> ApiError:
        db.rollback()
        return error

    permission = CHANGE_FLOW.get(current, {}).get(body.to)
    if permission is None:
        raise refuse(_err("ops_transition", f"Not allowed: {current} → {body.to}."))
    if not ctx.can(permission):
        raise refuse(forbidden())
    if body.to in _NOTE_REQUIRED and not body.note:
        raise refuse(_err("ops_note_required", "This step needs a note.", status.HTTP_422_UNPROCESSABLE_CONTENT))
    now = utcnow()
    if body.to == ChangeStatus.EVALUATION and not change.risk_notes and not body.note:
        raise refuse(
            _err(
                "ops_risk_notes",
                "Record the risk review before the evaluation step.",
                status.HTTP_422_UNPROCESSABLE_CONTENT,
            )
        )
    if body.to == ChangeStatus.HUMAN_APPROVAL:
        if body.evaluation_run_id is None:
            raise refuse(
                _err(
                    "ops_evaluation_required",
                    "Link the evaluation run of this version.",
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                )
            )
        run = get_scoped(db, ctx, OpsEvalRun, body.evaluation_run_id)
        if run.agent_version_id != change.agent_version_id:
            raise refuse(_err("ops_evaluation_mismatch", "The evaluation run must be of the change's version."))
        change.evaluation_run_id = run.id
    if body.to in (ChangeStatus.APPROVED, ChangeStatus.REJECTED):
        if change.created_by == ctx.admin.user.id:
            # The author never decides their own change; neither does any automated process.
            raise refuse(forbidden())
        if body.to == ChangeStatus.APPROVED:
            version = get_scoped(db, ctx, OpsAgentVersion, change.agent_version_id)
            if version.status != VersionStatus.APPROVED:
                raise refuse(
                    _err("ops_version_not_approved", "The agent version must be approved in the registry first.")
                )
            change.approved_by, change.approved_at = ctx.admin.user.id, now
    if body.to == ChangeStatus.RELEASED:
        if not body.release_note:
            raise refuse(
                _err(
                    "ops_release_note",
                    "A recorded release needs a release note.",
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                )
            )
        change.release_note, change.released_at = body.release_note, now
    if body.to == ChangeStatus.REVIEWED:
        change.reviewed_at = now
    if body.to == ChangeStatus.RISK_REVIEW and body.note:
        change.risk_notes = change.risk_notes or body.note
    change.status = body.to
    change.lock_version += 1
    change.updated_at = now
    _change_event(db, ctx, change, EventKind.STATUS, body=body.note, from_status=current, to_status=body.to)
    _audit(
        db,
        ctx,
        "ops.change_transition",
        "ops_change",
        change,
        from_status=current,
        to_status=body.to,
        reviewer=ctx.admin.user.email if body.to in (ChangeStatus.APPROVED, ChangeStatus.REJECTED) else None,
    )
    db.commit()
    return change


def add_change_note(db: Session, ctx: OpsContext, change: OpsChange, body: NoteIn) -> None:
    _change_event(db, ctx, change, body.kind, body=body.body)
    _audit(db, ctx, "ops.change_note", "ops_change", change, kind=body.kind.value)
    db.commit()


def change_events(db: Session, ctx: OpsContext, change: OpsChange) -> list[EventOut]:
    rows = db.scalars(
        scoped(ctx, OpsChangeEvent).where(OpsChangeEvent.change_id == change.id).order_by(OpsChangeEvent.created_at)
    )
    return [EventOut.model_validate(e) for e in rows]


def change_out(ctx: OpsContext, change: OpsChange) -> ChangeOut:
    out = ChangeOut.model_validate(change)
    out.allowed_transitions = allowed(CHANGE_FLOW, ctx, change.status)
    return out
