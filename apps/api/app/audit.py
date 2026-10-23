"""Audit trail helpers. Entries are added to the caller's transaction."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import AdminUser, AuditLog


def record(
    db: Session,
    action: str,
    *,
    actor: AdminUser | None = None,
    actor_label: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip_hash: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        action=action,
        actor_id=actor.id if actor else None,
        actor_label=actor.email if actor else (actor_label or "system"),
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_hash=ip_hash,
    )
    db.add(entry)
    return entry
