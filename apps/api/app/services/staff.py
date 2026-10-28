"""Staff roles (admin | editor | viewer): listing and changing them, shared by the API and the CLI.

A role change takes effect immediately: the person's open sessions are revoked, so the next request
re-authenticates with the new rights. Nobody can change their own role, and the last active
administrator cannot be demoted (the catalogue and leads would become unmanageable).
"""

from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app import audit
from app.models import AdminRole, AdminSession, AdminUser, utcnow


class StaffError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def list_staff(db: Session) -> list[AdminUser]:
    return list(db.scalars(select(AdminUser).order_by(func.lower(AdminUser.email))))


def change_role(
    db: Session, user: AdminUser, role: str, *, actor: AdminUser | None = None, ip_hash: str | None = None
) -> bool:
    """Set `user.role`; returns False when it was already that role. The caller commits."""
    if actor is not None and actor.id == user.id:
        raise StaffError("own_role")
    if user.role == role:
        return False
    if user.role == AdminRole.ADMIN and user.is_active:
        admins = db.scalar(
            select(func.count())
            .select_from(AdminUser)
            .where(AdminUser.role == AdminRole.ADMIN.value, AdminUser.is_active.is_(True))
        )
        if (admins or 0) <= 1:
            raise StaffError("last_admin")
    previous, user.role = user.role, role
    db.execute(
        update(AdminSession)
        .where(AdminSession.user_id == user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    audit.record(
        db,
        "admin.role_changed",
        actor=actor,
        actor_label=None if actor else "cli",
        entity_type="admin_user",
        entity_id=str(user.id),
        details={"from": previous, "to": role},
        ip_hash=ip_hash,
    )
    return True
