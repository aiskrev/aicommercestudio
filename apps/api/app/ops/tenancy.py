"""Tenant resolution and scoped data access.

Every portal request names an organisation in its path. `require(permission)` resolves the caller's
membership in that organisation and returns an `OpsContext`; all reads and writes then go through
`scoped()` / `get_scoped()`, which filter by the context's organisation. A caller without a
membership gets 404 — the same answer as for an organisation that does not exist — so tenants cannot
be enumerated. A member without the permission gets 403.

Once the membership is resolved the session is bound to the organisation (app/ops/rls.py): every
further statement of the request runs as the restricted runtime role under row-level security, so a
missed filter cannot reach another tenant. Modules that are switched off (OPS_MODULES) answer 404.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from fastapi import status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.deps import Admin, AdminContext, DbSession
from app.errors import ApiError
from app.models import OpsMembership, OpsOrganization, OpsOrganizationStatus, OpsRole
from app.ops import rls
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


MODULES = ("registry", "evaluations", "observability", "incidents", "changes")


def module_enabled(module: str) -> bool:
    enabled = {m.strip() for m in get_settings().ops_modules.split(",") if m.strip()}
    return module in enabled


def require(permission: Permission, module: str | None = None) -> Callable[..., OpsContext]:
    """Dependency factory: the caller must be a member of `organization_id` with `permission`.

    `module` names an explicitly gated module; when it is switched off the route does not exist (404).
    """

    def dependency(organization_id: uuid.UUID, admin: Admin, db: DbSession) -> OpsContext:
        if module is not None and not module_enabled(module):
            raise not_found()
        rls.bind(db, user_id=admin.user.id)  # the caller's own memberships, and nothing else yet
        ctx = load_context(db, admin, organization_id)
        if not ctx.can(permission):
            raise forbidden()
        if permission in WRITE_PERMISSIONS and ctx.organization.status != OpsOrganizationStatus.ACTIVE:
            raise ApiError(status.HTTP_403_FORBIDDEN, "Организацията е спряна.", "ops_suspended")
        rls.bind(db, organization_id=ctx.organization_id, user_id=admin.user.id)
        return ctx

    return dependency


def ensure_active(ctx: OpsContext) -> None:
    """For routes whose permission depends on the step (transitions): suspended organisations are read-only."""
    if ctx.organization.status != OpsOrganizationStatus.ACTIVE:
        raise ApiError(status.HTTP_403_FORBIDDEN, "Организацията е спряна.", "ops_suspended")


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
