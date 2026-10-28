"""Staff and roles (administrators only). Accounts are still created with the CLI; this changes roles."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Response, status

from app.catalogue import api_schemas as schemas
from app.deps import Admin, DbSession
from app.errors import ApiError
from app.models import AdminUser
from app.services import staff

router = APIRouter(prefix="/api/admin/staff", tags=["admin-staff"])


def _out(user: AdminUser, current: AdminUser) -> schemas.StaffOut:
    return schemas.StaffOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        is_self=user.id == current.id,
    )


@router.get("", response_model=list[schemas.StaffOut])
def list_staff(ctx: Admin, db: DbSession, response: Response) -> list[schemas.StaffOut]:
    response.headers["Cache-Control"] = "no-store"
    return [_out(user, ctx.user) for user in staff.list_staff(db)]


@router.patch("/{user_id}", response_model=schemas.StaffOut)
def change_role(
    user_id: uuid.UUID, payload: schemas.RoleUpdate, ctx: Admin, db: DbSession, response: Response
) -> schemas.StaffOut:
    """Change a staff member's role; their sessions are revoked. Audited as `admin.role_changed`."""
    response.headers["Cache-Control"] = "no-store"
    user = db.get(AdminUser, user_id)
    if user is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "staff_not_found")
    try:
        staff.change_role(db, user, payload.role, actor=ctx.user, ip_hash=ctx.ip_hash)
    except staff.StaffError as exc:
        raise ApiError(status.HTTP_409_CONFLICT, "Not possible.", exc.code) from exc
    db.commit()
    return _out(user, ctx.user)
