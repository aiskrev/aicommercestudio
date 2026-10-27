"""AI operations API (scaffold) — organisation-scoped, staff-only.

Every route except the organisation list depends on `require(<permission>)`, which resolves the
caller's membership in the organisation from the path. Reads and writes use `scoped()` /
`get_scoped()`, so a row of another tenant is never returned or modified — it is simply not found.
No telemetry is collected; the overview says so explicitly.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import audit
from app.deps import Admin, DbSession
from app.errors import ApiError
from app.models import AdminUser, AuditLog, OpsAgent, OpsMembership, OpsRole, OpsWorkspace, utcnow
from app.ops.rbac import Permission, can_assign
from app.ops.schemas import (
    AgentCreate,
    AgentOut,
    AgentUpdate,
    MemberCreate,
    MemberOut,
    MemberUpdate,
    MyOrganizationOut,
    OpsAuditOut,
    OrganizationOut,
    OverviewOut,
    WorkspaceCreate,
    WorkspaceOut,
)
from app.ops.tenancy import OpsContext, audit_details, forbidden, get_scoped, require, scoped

router = APIRouter(prefix="/api/ops", tags=["ops"])

ORG = "/organizations/{organization_id}"


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _conflict(detail: str = "Вече съществува запис с този идентификатор.") -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, detail, "ops_conflict")


OrgRead = Annotated[OpsContext, Depends(require(Permission.ORG_READ))]
WorkspacesRead = Annotated[OpsContext, Depends(require(Permission.WORKSPACES_READ))]
WorkspacesWrite = Annotated[OpsContext, Depends(require(Permission.WORKSPACES_WRITE))]
AgentsRead = Annotated[OpsContext, Depends(require(Permission.AGENTS_READ))]
AgentsWrite = Annotated[OpsContext, Depends(require(Permission.AGENTS_WRITE))]
MembersRead = Annotated[OpsContext, Depends(require(Permission.MEMBERS_READ))]
MembersWrite = Annotated[OpsContext, Depends(require(Permission.MEMBERS_WRITE))]
AuditRead = Annotated[OpsContext, Depends(require(Permission.AUDIT_READ))]


# --------------------------------------------------------------------------- organisations


@router.get("/organizations", response_model=list[MyOrganizationOut])
def my_organizations(admin: Admin, db: DbSession, response: Response) -> list[MyOrganizationOut]:
    """Organisations the caller is a member of — never any other."""
    _no_store(response)
    memberships = db.scalars(
        select(OpsMembership).where(OpsMembership.user_id == admin.user.id).order_by(OpsMembership.created_at)
    ).all()
    return [
        MyOrganizationOut(**OrganizationOut.model_validate(m.organization).model_dump(), role=OpsRole(m.role))
        for m in memberships
    ]


@router.get(ORG, response_model=OverviewOut)
def overview(ctx: OrgRead, db: DbSession, response: Response) -> OverviewOut:
    _no_store(response)
    workspaces = db.scalar(select(func.count()).select_from(scoped(ctx, OpsWorkspace).subquery())) or 0
    rows = db.execute(
        select(OpsAgent.status, func.count())
        .where(OpsAgent.organization_id == ctx.organization_id)
        .group_by(OpsAgent.status)
    ).all()
    return OverviewOut(
        organization=OrganizationOut.model_validate(ctx.organization),
        role=ctx.role,
        permissions=ctx.permissions(),
        workspaces=workspaces,
        agents_by_status={status_: count for status_, count in rows},
    )


# --------------------------------------------------------------------------- workspaces


@router.get(f"{ORG}/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(ctx: WorkspacesRead, db: DbSession, response: Response) -> list[WorkspaceOut]:
    _no_store(response)
    rows = db.scalars(scoped(ctx, OpsWorkspace).order_by(OpsWorkspace.created_at)).all()
    return [WorkspaceOut.model_validate(w) for w in rows]


@router.post(f"{ORG}/workspaces", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(body: WorkspaceCreate, ctx: WorkspacesWrite, db: DbSession) -> WorkspaceOut:
    workspace = OpsWorkspace(organization_id=ctx.organization_id, **body.model_dump())
    db.add(workspace)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _conflict() from None
    audit.record(
        db,
        "ops.workspace_created",
        actor=ctx.admin.user,
        entity_type="ops_workspace",
        entity_id=str(workspace.id),
        details=audit_details(ctx, slug=workspace.slug, environment=workspace.environment),
        ip_hash=ctx.admin.ip_hash,
    )
    db.commit()
    return WorkspaceOut.model_validate(workspace)


# --------------------------------------------------------------------------- agents


@router.get(f"{ORG}/agents", response_model=list[AgentOut])
def list_agents(
    ctx: AgentsRead,
    db: DbSession,
    response: Response,
    workspace_id: uuid.UUID | None = None,
    agent_status: Annotated[str | None, Query(alias="status", max_length=16)] = None,
) -> list[AgentOut]:
    _no_store(response)
    stmt = scoped(ctx, OpsAgent).order_by(OpsAgent.name)
    if workspace_id:
        stmt = stmt.where(OpsAgent.workspace_id == workspace_id)
    if agent_status:
        stmt = stmt.where(OpsAgent.status == agent_status)
    return [AgentOut.model_validate(a) for a in db.scalars(stmt).all()]


@router.post(f"{ORG}/agents", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(body: AgentCreate, ctx: AgentsWrite, db: DbSession) -> AgentOut:
    # The workspace must belong to this organisation (also enforced by the composite foreign key).
    get_scoped(db, ctx, OpsWorkspace, body.workspace_id)
    agent = OpsAgent(organization_id=ctx.organization_id, **body.model_dump())
    db.add(agent)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _conflict() from None
    audit.record(
        db,
        "ops.agent_created",
        actor=ctx.admin.user,
        entity_type="ops_agent",
        entity_id=str(agent.id),
        details=audit_details(ctx, key=agent.key, status=agent.status),
        ip_hash=ctx.admin.ip_hash,
    )
    db.commit()
    return AgentOut.model_validate(agent)


@router.patch(f"{ORG}/agents/{{agent_id}}", response_model=AgentOut)
def update_agent(agent_id: uuid.UUID, body: AgentUpdate, ctx: AgentsWrite, db: DbSession) -> AgentOut:
    agent = get_scoped(db, ctx, OpsAgent, agent_id)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is None:
        del changes["name"]
    if "status" in changes and changes["status"] is None:
        del changes["status"]
    before = {field: getattr(agent, field) for field in changes}
    for field, value in changes.items():
        setattr(agent, field, value)
    agent.updated_at = utcnow()
    audit.record(
        db,
        "ops.agent_updated",
        actor=ctx.admin.user,
        entity_type="ops_agent",
        entity_id=str(agent.id),
        details=audit_details(
            ctx, fields=sorted(changes), status_from=before.get("status"), status_to=changes.get("status")
        ),
        ip_hash=ctx.admin.ip_hash,
    )
    db.commit()
    return AgentOut.model_validate(agent)


# --------------------------------------------------------------------------- members


def _member_out(m: OpsMembership) -> MemberOut:
    return MemberOut(
        id=m.id,
        user_id=m.user_id,
        email=m.user.email,
        full_name=m.user.full_name,
        role=OpsRole(m.role),
        created_at=m.created_at,
    )


def _owners(db: Session, ctx: OpsContext) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(OpsMembership)
            .where(OpsMembership.organization_id == ctx.organization_id, OpsMembership.role == OpsRole.OWNER)
        )
        or 0
    )


def _last_owner() -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, "Организацията трябва да има поне един собственик.", "ops_last_owner")


@router.get(f"{ORG}/members", response_model=list[MemberOut])
def list_members(ctx: MembersRead, db: DbSession, response: Response) -> list[MemberOut]:
    _no_store(response)
    return [_member_out(m) for m in db.scalars(scoped(ctx, OpsMembership).order_by(OpsMembership.created_at)).all()]


@router.post(f"{ORG}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(body: MemberCreate, ctx: MembersWrite, db: DbSession) -> MemberOut:
    if not can_assign(ctx.role, body.role):
        raise forbidden()
    user = db.scalar(
        select(AdminUser).where(func.lower(AdminUser.email) == body.email.lower(), AdminUser.is_active.is_(True))
    )
    if user is None:
        # Only existing staff accounts can be added; the scaffold has no client sign-up or invitations.
        raise ApiError(status.HTTP_404_NOT_FOUND, "Няма активен потребител с този имейл.", "ops_user_unknown")
    membership = OpsMembership(organization_id=ctx.organization_id, user_id=user.id, role=body.role)
    db.add(membership)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _conflict("Потребителят вече е член на организацията.") from None
    audit.record(
        db,
        "ops.member_added",
        actor=ctx.admin.user,
        entity_type="ops_membership",
        entity_id=str(membership.id),
        details=audit_details(ctx, user_id=str(user.id), role=body.role.value),
        ip_hash=ctx.admin.ip_hash,
    )
    db.commit()
    db.refresh(membership)
    return _member_out(membership)


@router.patch(f"{ORG}/members/{{membership_id}}", response_model=MemberOut)
def change_role(membership_id: uuid.UUID, body: MemberUpdate, ctx: MembersWrite, db: DbSession) -> MemberOut:
    membership = get_scoped(db, ctx, OpsMembership, membership_id)
    if not (can_assign(ctx.role, membership.role) and can_assign(ctx.role, body.role)):
        raise forbidden()
    if membership.role == OpsRole.OWNER and body.role != OpsRole.OWNER and _owners(db, ctx) <= 1:
        raise _last_owner()
    before = membership.role
    membership.role = body.role
    audit.record(
        db,
        "ops.member_role_changed",
        actor=ctx.admin.user,
        entity_type="ops_membership",
        entity_id=str(membership.id),
        details=audit_details(ctx, user_id=str(membership.user_id), role_from=before, role_to=body.role.value),
        ip_hash=ctx.admin.ip_hash,
    )
    db.commit()
    return _member_out(membership)


@router.delete(f"{ORG}/members/{{membership_id}}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(membership_id: uuid.UUID, ctx: MembersWrite, db: DbSession) -> Response:
    membership = get_scoped(db, ctx, OpsMembership, membership_id)
    if not can_assign(ctx.role, membership.role):
        raise forbidden()
    if membership.role == OpsRole.OWNER and _owners(db, ctx) <= 1:
        raise _last_owner()
    audit.record(
        db,
        "ops.member_removed",
        actor=ctx.admin.user,
        entity_type="ops_membership",
        entity_id=str(membership.id),
        details=audit_details(ctx, user_id=str(membership.user_id), role=membership.role),
        ip_hash=ctx.admin.ip_hash,
    )
    db.delete(membership)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- audit


@router.get(f"{ORG}/audit", response_model=list[OpsAuditOut])
def organization_audit(
    ctx: AuditRead,
    db: DbSession,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[OpsAuditOut]:
    """Audit entries of this organisation only (matched on details.organization_id)."""
    _no_store(response)
    rows = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.action.startswith("ops."), AuditLog.details["organization_id"].astext == str(ctx.organization_id)
        )
        .order_by(AuditLog.id.desc())
        .limit(limit)
    ).all()
    return [OpsAuditOut.model_validate(e) for e in rows]
