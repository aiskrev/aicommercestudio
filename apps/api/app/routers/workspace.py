"""Advisor Workspace (off unless ADVISOR_WORKSPACE_ENABLED=true; docs/ADVISOR_WORKSPACE.md).

Every right is checked here, on the server. Each route depends on `WorkspaceCtx` or `gated(feature)`;
a test walks the routes and fails if one does not. Answers carry `no-store`: paid results are not cached.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import Field
from sqlalchemy import func, select

from app import audit
from app.accounts import limits
from app.advisor import service as advisor
from app.config import get_settings
from app.deps import AppSettings, DbSession
from app.errors import ApiError
from app.routers.accounts import Account
from app.routers.advisor import _ERRORS as ADVISOR_ERRORS
from app.schemas import StrictModel
from app.workspace import entitlements, service, usage
from app.workspace.demo import DEMO
from app.workspace.entitlements import Entitlements
from app.workspace.models import AssessmentVersion, CustomerWorkspace, WorkspaceMember, WorkspaceProject
from app.workspace.service import RunIn, WorkspaceError


def _enabled() -> None:
    settings = get_settings()
    if not (settings.advisor_workspace_enabled and settings.customer_accounts_enabled):
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/api/workspace", tags=["workspace"], dependencies=[Depends(_enabled), Depends(_no_store)])


@dataclass
class Context:
    workspace: CustomerWorkspace
    rights: Entitlements
    role: str = "owner"


def _error(exc: WorkspaceError) -> ApiError:
    return ApiError(exc.status, exc.detail, exc.code, errors=exc.extra or None)


def _resolve_workspace(account, db, x_workspace: uuid.UUID | None) -> Context:
    """The caller's own workspace, or one named in X-Workspace if they are a member of it."""
    workspace = entitlements.workspace_for(db, account.account.id)
    db.commit()
    role = "owner"
    if x_workspace is not None and x_workspace != workspace.id:
        member = db.get(WorkspaceMember, (x_workspace, account.account.id))
        if member is None:  # the same answer as a workspace that doesn't exist
            raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
        workspace, role = db.get(CustomerWorkspace, x_workspace), member.role
    return Context(workspace=workspace, rights=entitlements.resolve(db, workspace.id), role=role)


def workspace_context(
    account: Account,
    db: DbSession,
    x_workspace: Annotated[uuid.UUID | None, Header()] = None,
) -> Context:
    """The workspace, counted against the plan's shared per-workspace request limit."""
    ctx = _resolve_workspace(account, db, x_workspace)
    allowed = max(ctx.rights.limit("limit_requests_per_minute"), get_settings().workspace_rate_limit_floor)
    limits.hit("workspace", str(ctx.workspace.id), allowed, 60)
    return ctx


def workspace_context_without_shared_limit(
    account: Account,
    db: DbSession,
    x_workspace: Annotated[uuid.UUID | None, Header()] = None,
) -> Context:
    """The workspace WITHOUT the shared per-workspace limit. Only for the statutory withdrawal function: a burst of
    ordinary page loads must never hide or block it. Those routes apply their own dedicated limits instead."""
    return _resolve_workspace(account, db, x_workspace)


WorkspaceCtx = Annotated[Context, Depends(workspace_context)]
WithdrawalWorkspaceCtx = Annotated[Context, Depends(workspace_context_without_shared_limit)]


def gated(feature: str):
    """The caller's plan must include `feature`. This is the access control; the UI only follows it."""

    def dependency(ctx: WorkspaceCtx) -> Context:
        if not ctx.rights.has(feature):
            raise _error(service.not_in_plan(feature))
        return ctx

    return dependency


Projects = Annotated[Context, Depends(gated("projects"))]
History = Annotated[Context, Depends(gated("history"))]
Compare = Annotated[Context, Depends(gated("compare"))]


class ProjectIn(StrictModel):
    name: str = Field(min_length=2, max_length=120)


class SandboxPlanIn(StrictModel):
    plan: Literal["free", "pro", "business", "custom"]


def _project(db, ctx: Context, project_id: uuid.UUID) -> WorkspaceProject:
    try:
        return service.project_of(db, ctx.workspace.id, project_id)
    except WorkspaceError as exc:
        raise _error(exc) from exc


def _version(db, project: WorkspaceProject, number: int) -> AssessmentVersion:
    try:
        return service.version_of(db, project.id, number)
    except WorkspaceError as exc:
        raise _error(exc) from exc


def _readable(version: AssessmentVersion, rights: Entitlements) -> AssessmentVersion:
    if service.locked(version, rights):
        raise _error(service.not_in_plan("ai_results"))
    return version


@router.get("/demo")
def demo() -> dict[str, Any]:
    return DEMO


@router.get("/plans")
def plans(db: DbSession) -> list[dict[str, Any]]:
    return entitlements.public_plans(db)


@router.get("/me")
def me(ctx: WorkspaceCtx, db: DbSession) -> dict[str, Any]:
    return {
        "plan": ctx.rights.plan,
        "plan_version": ctx.rights.version,
        "features": sorted(ctx.rights.features),
        "limits": ctx.rights.limits,
        "usage": usage.report(db, ctx.workspace.id),
    }


@router.get("/projects")
def list_projects(ctx: Projects, db: DbSession) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(WorkspaceProject)
        .where(WorkspaceProject.workspace_id == ctx.workspace.id)
        .order_by(WorkspaceProject.updated_at.desc())
    ).all()
    return [{"id": str(r.id), "name": r.name, "updated_at": r.updated_at.isoformat()} for r in rows]


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectIn, ctx: Projects, db: DbSession) -> dict[str, str]:
    # The lock makes the count and the insert one step, so parallel requests cannot pass the limit.
    db.scalar(select(CustomerWorkspace).where(CustomerWorkspace.id == ctx.workspace.id).with_for_update())
    count = db.scalar(
        select(func.count()).select_from(WorkspaceProject).where(WorkspaceProject.workspace_id == ctx.workspace.id)
    )
    if count >= ctx.rights.limit("limit_projects"):
        raise ApiError(status.HTTP_403_FORBIDDEN, "Your plan has no room for more projects.", "quota_exceeded")
    project = WorkspaceProject(workspace_id=ctx.workspace.id, name=payload.name)
    db.add(project)
    db.commit()
    return {"id": str(project.id), "name": project.name}


@router.patch("/projects/{project_id}")
def rename_project(project_id: uuid.UUID, payload: ProjectIn, ctx: Projects, db: DbSession) -> dict[str, str]:
    project = _project(db, ctx, project_id)
    project.name = payload.name
    db.commit()
    return {"id": str(project.id), "name": project.name}


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: uuid.UUID, ctx: Projects, db: DbSession) -> None:
    db.delete(_project(db, ctx, project_id))
    db.commit()


@router.get("/projects/{project_id}/versions")
def list_versions(project_id: uuid.UUID, ctx: History, db: DbSession) -> list[dict[str, Any]]:
    project = _project(db, ctx, project_id)
    rows = db.scalars(
        select(AssessmentVersion).where(AssessmentVersion.project_id == project.id).order_by(AssessmentVersion.number)
    ).all()
    return [service.present(row, ctx.rights) | {"assessment": None, "insights": None} for row in rows]


@router.post("/projects/{project_id}/versions", status_code=status.HTTP_201_CREATED)
def run_assessment(
    project_id: uuid.UUID,
    payload: RunIn,
    ctx: Projects,
    db: DbSession,
    settings: AppSettings,
    idempotency_key: Annotated[str, Header(min_length=8, max_length=100)],
) -> dict[str, Any]:
    try:
        version = service.run(db, settings, ctx.workspace.id, project_id, payload, idempotency_key, ctx.rights)
    except WorkspaceError as exc:
        raise _error(exc) from exc
    except advisor.AdvisorError as exc:
        code_status, code, detail = ADVISOR_ERRORS.get(exc.kind, ADVISOR_ERRORS["unavailable"])
        raise ApiError(code_status, detail, code) from exc
    return service.present(version, ctx.rights)


@router.get("/projects/{project_id}/versions/{number}")
def read_version(project_id: uuid.UUID, number: int, ctx: History, db: DbSession) -> dict[str, Any]:
    return service.present(_version(db, _project(db, ctx, project_id), number), ctx.rights)


@router.get("/projects/{project_id}/compare")
def compare(project_id: uuid.UUID, left: int, right: int, ctx: Compare, db: DbSession) -> dict[str, Any]:
    project = _project(db, ctx, project_id)
    return service.compare(
        _readable(_version(db, project, left), ctx.rights), _readable(_version(db, project, right), ctx.rights)
    )


@router.get("/projects/{project_id}/versions/{number}/export")
def export(
    project_id: uuid.UUID,
    number: int,
    ctx: WorkspaceCtx,
    db: DbSession,
    format: Literal["markdown", "json"] = "markdown",
) -> Response:
    feature = "export_markdown" if format == "markdown" else "export_json"
    if not ctx.rights.has(feature):
        raise _error(service.not_in_plan(feature))
    project = _project(db, ctx, project_id)
    version = _readable(_version(db, project, number), ctx.rights)
    headers = {"Cache-Control": "no-store"}
    if format == "json":
        return JSONResponse(service.present(version, ctx.rights), headers=headers)
    return Response(service.to_markdown(project, version), media_type="text/markdown; charset=utf-8", headers=headers)


@router.post("/billing/sandbox/plan", status_code=status.HTTP_204_NO_CONTENT)
def sandbox_plan(
    payload: SandboxPlanIn, ctx: WorkspaceCtx, request: Request, db: DbSession, settings: AppSettings
) -> None:
    """Test adapter: changes the plan with no payment. Production refuses to start with it on."""
    if settings.billing_provider != "sandbox":
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    if ctx.role != "owner":
        raise ApiError(status.HTTP_403_FORBIDDEN, "Your role doesn't allow this.", "role_not_allowed")
    entitlements.grant(db, ctx.workspace.id, payload.plan, "sandbox")
    audit.record(
        db,
        "workspace.sandbox_plan",
        entity_type="customer_workspace",
        entity_id=str(ctx.workspace.id),
        details={"plan": payload.plan},
    )
    db.commit()
