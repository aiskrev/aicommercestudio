"""The customer's commercial projects (docs/COMMERCIAL_PROJECTS.md). Off with `COMMERCIAL_PROJECTS_ENABLED`.

Every route needs a customer session. The workspace is the caller's own, or one they are a member of (`X-Workspace`,
checked by `_resolve_workspace`); a project is looked up *inside that workspace only*, so a project of another
workspace answers exactly like one that does not exist. Drafts are invisible. What a member may do depends on their
role in the workspace and is decided here, on the server: the owner and the `billing` member approve and accept, every
member reads and sends requests.

Private pages: every answer is `no-store`; the web pages are `noindex`.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response, status

from app.accounts import limits
from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip_hash
from app.errors import ApiError
from app.projects import service
from app.projects.schemas import ClientAction, ClientRequest, ProjectDetailOut, ProjectSummaryOut
from app.routers.accounts import Account
from app.routers.workspace import Context, _resolve_workspace


def _enabled() -> None:
    settings = get_settings()
    if not (settings.commercial_projects_enabled and settings.customer_accounts_enabled):
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(_enabled), Depends(_no_store)])


def workspace_of(account: Account, db: DbSession, x_workspace: Annotated[uuid.UUID | None, Header()] = None) -> Context:
    return _resolve_workspace(account, db, x_workspace)


Workspace = Annotated[Context, Depends(workspace_of)]


def _raise(exc: service.ProjectError) -> ApiError:
    return ApiError(exc.status, exc.message, exc.code)


def _read_limit(account: Account, settings: AppSettings) -> None:
    limits.hit(
        "project-read:account",
        str(account.account.id),
        settings.project_read_rate_limit,
        settings.project_rate_window_seconds,
    )


def _write_limit(account: Account, settings: AppSettings) -> None:
    limits.hit(
        "project-write:account",
        str(account.account.id),
        settings.project_action_rate_limit,
        settings.project_rate_window_seconds,
    )


@router.get("", response_model=list[ProjectSummaryOut], summary="The projects of the caller's workspace")
def my_projects(account: Account, ctx: Workspace, db: DbSession, settings: AppSettings) -> list[ProjectSummaryOut]:
    _read_limit(account, settings)
    return [service.summary_out(db, project) for project in service.workspace_projects(db, ctx.workspace.id)]


@router.get("/{project_id}", response_model=ProjectDetailOut, summary="One project, with its milestones and history")
def my_project(
    project_id: uuid.UUID, account: Account, ctx: Workspace, db: DbSession, settings: AppSettings
) -> ProjectDetailOut:
    _read_limit(account, settings)
    try:
        project = service.project_of(db, ctx.workspace.id, project_id)
    except service.ProjectError as exc:
        raise _raise(exc) from exc
    return service.client_detail(db, project, account.account.id, ctx.role)


@router.post(
    "/{project_id}/decision",
    response_model=ProjectDetailOut,
    summary="Approve the scope, accept the result or ask for changes",
)
def decide(
    project_id: uuid.UUID,
    payload: ClientAction,
    request: Request,
    account: Account,
    ctx: Workspace,
    db: DbSession,
    settings: AppSettings,
) -> ProjectDetailOut:
    _write_limit(account, settings)
    try:
        # The row lock makes two simultaneous decisions wait; the second finds the first one recorded.
        project = service.project_of(db, ctx.workspace.id, project_id, lock=True)
        project, _recorded = service.client_action(
            db, project, payload, account.account, ctx.role, client_ip_hash(request)
        )
    except service.ProjectError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.client_detail(db, project, account.account.id, ctx.role)


@router.post(
    "/{project_id}/requests",
    status_code=status.HTTP_201_CREATED,
    response_model=ProjectDetailOut,
    summary="Send a change request or a support request about the project",
)
def send_request(
    project_id: uuid.UUID,
    payload: ClientRequest,
    request: Request,
    account: Account,
    ctx: Workspace,
    db: DbSession,
    settings: AppSettings,
) -> ProjectDetailOut:
    _write_limit(account, settings)
    try:
        project = service.project_of(db, ctx.workspace.id, project_id, lock=True)
        service.client_request(db, project, payload, account.account, client_ip_hash(request))
    except service.ProjectError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.client_detail(db, project, account.account.id, ctx.role)
