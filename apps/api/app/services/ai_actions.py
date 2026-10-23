"""Auditable approval workflow for side-effecting AI agent actions."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.ai.policy import evaluate
from app.models import AdminUser, AIActionRequest, AIActionStatus, utcnow


class ActionStateError(ValueError):
    pass


def propose_action(
    db: Session,
    action_type: str,
    summary: str,
    payload: dict[str, Any],
    requested_by: str,
) -> AIActionRequest:
    """Record a proposed action. Low-risk actions are auto-approved by policy; all others wait
    for a human decision. Nothing is executed here."""
    decision = evaluate(action_type)
    request = AIActionRequest(
        action_type=str(action_type),
        risk_level=decision.risk.value,
        status=AIActionStatus.PENDING.value if decision.requires_approval else AIActionStatus.APPROVED.value,
        summary=summary[:300],
        payload=payload,
        requested_by=requested_by,
        decided_at=None if decision.requires_approval else utcnow(),
        decision_comment=None if decision.requires_approval else f"policy: {decision.reason}",
    )
    db.add(request)
    db.flush()
    audit.record(
        db,
        "ai_action.proposed",
        actor_label=requested_by,
        entity_type="ai_action",
        entity_id=str(request.id),
        details={"action_type": request.action_type, "risk": request.risk_level, "status": request.status},
    )
    db.commit()
    return request


def list_actions(db: Session, status: AIActionStatus | None = None, limit: int = 100) -> list[AIActionRequest]:
    stmt = select(AIActionRequest).order_by(AIActionRequest.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(AIActionRequest.status == status.value)
    return list(db.scalars(stmt).all())


def decide(
    db: Session,
    action_id: uuid.UUID,
    approve: bool,
    actor: AdminUser,
    comment: str | None,
    ip_hash: str | None,
) -> AIActionRequest:
    request = db.get(AIActionRequest, action_id)
    if request is None:
        raise LookupError("not found")
    if request.status != AIActionStatus.PENDING.value:
        raise ActionStateError("Действието вече е обработено.")
    request.status = AIActionStatus.APPROVED.value if approve else AIActionStatus.REJECTED.value
    request.decided_by_id = actor.id
    request.decided_at = utcnow()
    request.decision_comment = comment
    audit.record(
        db,
        "ai_action.approved" if approve else "ai_action.rejected",
        actor=actor,
        entity_type="ai_action",
        entity_id=str(request.id),
        details={"action_type": request.action_type, "risk": request.risk_level},
        ip_hash=ip_hash,
    )
    db.commit()
    db.refresh(request)
    return request
