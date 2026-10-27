"""Tenant resolution and scoped data access.

Every portal request names an organisation in its path. `require(permission)` resolves the caller's
membership in that organisation and returns an `OpsContext`; all reads and writes then go through
`scoped()` / `get_scoped()`, which filter by the context's organisation. A caller without a
membership gets 404 — the same answer as for an organisation that does not exist — so tenants cannot
be enumerated. A member without the permission gets 403.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from fastapi import status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.deps import Admin, AdminContext, DbSession
from app.errors import ApiError
from app.models import OpsMembership, OpsOrganization, OpsOrganizationStatus, OpsRole
from app.ops.rbac import ROLE_PERMISSIONS, WRITE_PERMISSIONS, Permission


@dataclass(frozen=True)
class OpsContext:
    admin: AdminContext
    organization: OpsOrganization
    membership: OpsMembership

    @property
    def role(self) -> OpsRole:
        return OpsRole(self.membership.role)

    @property
    def organization_id(self) -> uuid.UUID:
        return self.organization.id

    def can(self, permission: Permission) -> bool:
        return permission in ROLE_PERMISSIONS[self.role]

    def permissions(self) -> list[str]:
        return sorted(p.value for p in ROLE_PERMISSIONS[self.role])


def not_found() -> ApiError:
    return ApiError(status.HTTP_404_NOT_FOUND, "Не е намерено.", "ops_not_found")


def forbidden() -> ApiError:
    return ApiError(status.HTTP_403_FORBIDDEN, "Нямате права за това действие.", "ops_forbidden")


def load_context(db: Session, admin: AdminContext, organization_id: uuid.UUID) -> OpsContext:
    membership = db.scalar(
        select(OpsMembership).where(
            OpsMembership.organization_id == organization_id,
            OpsMembership.user_id == admin.user.id,
        )
    )
    if membership is None:
        raise not_found()
    return OpsContext(admin=admin, organization=membership.organization, membership=membership)


def require(permission: Permission) -> Callable[..., OpsContext]:
    """Dependency factory: the caller must be a member of `organization_id` with `permission`."""

    def dependency(organization_id: uuid.UUID, admin: Admin, db: DbSession) -> OpsContext:
        ctx = load_context(db, admin, organization_id)
        if not ctx.can(permission):
            raise forbidden()
        if permission in WRITE_PERMISSIONS and ctx.organization.status != OpsOrganizationStatus.ACTIVE:
            raise ApiError(status.HTTP_403_FORBIDDEN, "Организацията е спряна.", "ops_suspended")
        return ctx

    return dependency


def scoped[T](ctx: OpsContext, model: type[T]) -> Select[tuple[T]]:
    """SELECT restricted to the context's organisation. The only way routes read tenant data."""
    return select(model).where(model.organization_id == ctx.organization_id)  # type: ignore[attr-defined]


def get_scoped[T](db: Session, ctx: OpsContext, model: type[T], entity_id: uuid.UUID) -> T:
    entity = db.scalar(scoped(ctx, model).where(model.id == entity_id))  # type: ignore[attr-defined]
    if entity is None:
        raise not_found()
    return entity


def audit_details(ctx: OpsContext, **extra: Any) -> dict[str, Any]:
    """Audit details always carry the organisation so the tenant's audit view can filter by it."""
    return {"organization_id": str(ctx.organization_id), **extra}
