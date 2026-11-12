"""Commercial projects for staff (docs/COMMERCIAL_PROJECTS.md). Off with `COMMERCIAL_PROJECTS_ENABLED`.

Like leads and quotations, every route needs the `admin` role: editors and viewers reach only the catalogue.
A project is created from a lead, for the workspace of a *verified customer account chosen by its e-mail
address*: staff never type a workspace id, and the server checks that the account exists, is verified and was
not erased.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, Response, status
from pydantic import BaseModel

from app.config import get_settings
from app.deps import Admin, DbSession, client_ip_hash
from app.errors import ApiError
from app.projects import service
from app.projects.models import STATUSES
from app.projects.schemas import (
    MilestonesIn,
    ProjectCreate,
    ProjectSummaryOut,
    ProjectUpdate,
    StaffEventIn,
    StaffProjectOut,
    StaffReply,
    StaffTransition,
)
from app.routers.admin_opportunities import _lead


def _enabled() -> None:
    if not get_settings().commercial_projects_enabled:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/api/admin", tags=["admin-projects"], dependencies=[Depends(_enabled), Depends(_no_store)])
CONFLICT = {409: {"description": "`expected_revision` is stale, or the move is not allowed"}}


def _raise(exc: service.ProjectError) -> ApiError:
    return ApiError(exc.status, exc.message, exc.code)


def _project(db: DbSession, project_id: uuid.UUID, *, lock: bool = False):
    project = service.get(db, project_id, lock=lock)
    if project is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Project not found.", "project_not_found")
    return project


class _Summary(ProjectSummaryOut):
    customer_email: str | None = None


@router.get("/projects", response_model=list[_Summary], summary="Every project, newest activity first")
def list_projects(
    ctx: Admin,
    db: DbSession,
    status_filter: str | None = Query(default=None, alias="status"),
    lead_id: uuid.UUID | None = Query(default=None),
) -> list[_Summary]:
    if status_filter is not None and status_filter not in STATUSES:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown status.", "invalid_status")
    rows = []
    for project in service.list_all(db, status_filter, lead_id):
        owner = service._owner(db, project)
        rows.append(
            _Summary(**service.summary_out(db, project).model_dump(), customer_email=owner.email if owner else None)
        )
    return rows


@router.get("/projects/{project_id}", response_model=StaffProjectOut, summary="One project, with internal notes")
def get_project(project_id: uuid.UUID, request: Request, ctx: Admin, db: DbSession) -> StaffProjectOut:
    project = _project(db, project_id)
    service.record_view(db, project, ctx.user, client_ip_hash(request))
    return service.staff_detail(db, project)


@router.post(
    "/leads/{lead_id}/projects",
    status_code=status.HTTP_201_CREATED,
    response_model=StaffProjectOut,
    responses=CONFLICT,
    summary="Create a draft project for a verified customer account (the same request again returns the first project)",
)
def create_project(
    lead_id: uuid.UUID, payload: ProjectCreate, request: Request, response: Response, ctx: Admin, db: DbSession
) -> StaffProjectOut:
    lead = _lead(db, lead_id, for_update=True)
    try:
        project, created = service.create(db, lead, payload, ctx.user, client_ip_hash(request))
    except service.ProjectError as exc:
        db.rollback()
        raise _raise(exc) from exc
    if not created:
        response.status_code = status.HTTP_200_OK
    return service.staff_detail(db, project)


@router.patch(
    "/projects/{project_id}",
    response_model=StaffProjectOut,
    responses=CONFLICT,
    summary="Edit the references and text of a project",
)
def update_project(
    project_id: uuid.UUID, payload: ProjectUpdate, request: Request, ctx: Admin, db: DbSession
) -> StaffProjectOut:
    project = _project(db, project_id, lock=True)
    try:
        service.update_details(db, project, payload, ctx.user, client_ip_hash(request))
    except service.ProjectError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.staff_detail(db, project)


@router.put(
    "/projects/{project_id}/milestones",
    response_model=StaffProjectOut,
    responses=CONFLICT,
    summary="Replace the delivery plan",
)
def set_milestones(
    project_id: uuid.UUID, payload: MilestonesIn, request: Request, ctx: Admin, db: DbSession
) -> StaffProjectOut:
    project = _project(db, project_id, lock=True)
    try:
        service.set_milestones(db, project, payload, ctx.user, client_ip_hash(request))
    except service.ProjectError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.staff_detail(db, project)


@router.post(
    "/projects/{project_id}/transition",
    response_model=StaffProjectOut,
    responses=CONFLICT,
    summary="Move a project along its lifecycle",
)
def transition(
    project_id: uuid.UUID, payload: StaffTransition, request: Request, ctx: Admin, db: DbSession
) -> StaffProjectOut:
    project = _project(db, project_id, lock=True)
    try:
        service.staff_transition(db, project, payload, ctx.user, client_ip_hash(request))
    except service.ProjectError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.staff_detail(db, project)


@router.post(
    "/projects/{project_id}/events",
    status_code=status.HTTP_201_CREATED,
    response_model=StaffProjectOut,
    summary="Post an update or a delivery",
)
def add_event(
    project_id: uuid.UUID, payload: StaffEventIn, request: Request, ctx: Admin, db: DbSession
) -> StaffProjectOut:
    project = _project(db, project_id, lock=True)
    try:
        service.staff_event(db, project, payload, ctx.user, client_ip_hash(request))
    except service.ProjectError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.staff_detail(db, project)


@router.post(
    "/projects/{project_id}/requests/{request_id}/reply",
    response_model=StaffProjectOut,
    summary="Answer a change or support request",
)
def reply(
    project_id: uuid.UUID, request_id: uuid.UUID, payload: StaffReply, request: Request, ctx: Admin, db: DbSession
) -> StaffProjectOut:
    project = _project(db, project_id, lock=True)
    try:
        service.staff_reply(db, project, request_id, payload, ctx.user, client_ip_hash(request))
    except service.ProjectError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.staff_detail(db, project)


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    locale: str
    status: str
    attempts: int
    last_error: str | None
    created_at: datetime
    sent_at: datetime | None


@router.get(
    "/projects/{project_id}/notifications",
    response_model=list[NotificationOut],
    summary="Delivery of the e-mail about a project (kind, state and attempts; never an address or text)",
)
def notifications(project_id: uuid.UUID, ctx: Admin, db: DbSession) -> list[NotificationOut]:
    from app.projects import notify

    return [NotificationOut(**row) for row in notify.delivery(db, _project(db, project_id))]
