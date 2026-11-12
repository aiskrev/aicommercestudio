"""Admin CRM routes (docs/ADMIN_CRM.md).

The owner of an enquiry, follow-up tasks, the overview, the timeline, the customer and project links, and a safe
export. They extend the existing leads area: every route needs the `admin` role, like leads (editors and viewers
reach only the catalogue), and every change is audited with ids, never personal data.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app import audit
from app.crm import service
from app.crm.models import LeadTask
from app.crm.schemas import (
    CustomerOut,
    OverviewOut,
    OwnerIn,
    PersonOut,
    TaskIn,
    TaskOut,
    TaskPage,
    TaskPatch,
    TimelineItem,
)
from app.deps import Admin, DbSession, client_ip_hash
from app.errors import ApiError
from app.models import AdminRole, AdminUser, InquiryType, Lead, LeadLocale, LeadStatus, ServiceKey
from app.services import leads

router = APIRouter(prefix="/api/admin", tags=["admin-crm"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _lead(db: DbSession, lead_id: uuid.UUID, *, lock: bool = False) -> Lead:
    lead = leads.get_lead(db, lead_id, for_update=lock)
    if lead is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Lead not found.", "not_found")
    return lead


def _raise(exc: service.CrmError) -> ApiError:
    return ApiError(exc.status, exc.message, exc.code)


class OwnerOut(BaseModel):
    owner: PersonOut | None


@router.get("/crm/admins", response_model=list[PersonOut], summary="Active administrators, for choosing an owner")
def admins(ctx: Admin, db: DbSession, response: Response) -> list[PersonOut]:
    _no_store(response)
    rows = db.query(AdminUser).filter(AdminUser.is_active.is_(True), AdminUser.role == AdminRole.ADMIN.value).all()
    return sorted((PersonOut(id=a.id, name=a.full_name) for a in rows), key=lambda p: p.name.lower())


@router.put("/leads/{lead_id}/owner", response_model=OwnerOut, summary="Set or clear the owner of an enquiry")
def set_owner(lead_id: uuid.UUID, payload: OwnerIn, request: Request, ctx: Admin, db: DbSession) -> OwnerOut:
    lead = _lead(db, lead_id, lock=True)
    try:
        service.set_owner(db, lead, payload.owner_id, ctx.user, client_ip_hash(request))
    except service.CrmError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return OwnerOut(owner=service.person(db.get(AdminUser, lead.owner_id)) if lead.owner_id else None)


@router.get("/leads/{lead_id}/tasks", response_model=list[TaskOut], summary="The follow-up tasks of an enquiry")
def lead_tasks(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> list[TaskOut]:
    _no_store(response)
    lead = _lead(db, lead_id)
    rows = db.query(LeadTask).filter(LeadTask.lead_id == lead.id).order_by(LeadTask.created_at.desc()).all()
    return [service.task_out(db, row, lead) for row in rows]


@router.post(
    "/leads/{lead_id}/tasks",
    status_code=status.HTTP_201_CREATED,
    response_model=TaskOut,
    summary="Add a follow-up task (a short text and an optional date)",
)
def create_task(lead_id: uuid.UUID, payload: TaskIn, request: Request, ctx: Admin, db: DbSession) -> TaskOut:
    lead = _lead(db, lead_id, lock=True)
    try:
        task = service.create_task(db, lead, payload, ctx.user, client_ip_hash(request))
    except service.CrmError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.task_out(db, task, lead)


@router.patch(
    "/tasks/{task_id}",
    response_model=TaskOut,
    responses={409: {"description": "`expected_revision` is stale"}},
    summary="Edit, finish, cancel or reopen a task",
)
def update_task(task_id: uuid.UUID, payload: TaskPatch, request: Request, ctx: Admin, db: DbSession) -> TaskOut:
    task = db.query(LeadTask).filter(LeadTask.id == task_id).with_for_update().one_or_none()
    if task is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Task not found.", "not_found")
    try:
        service.update_task(db, task, payload, ctx.user, client_ip_hash(request))
    except service.CrmError as exc:
        db.rollback()
        raise _raise(exc) from exc
    return service.task_out(db, task)


@router.get("/crm/tasks", response_model=TaskPage, summary="Follow-up tasks across enquiries, open work first")
def tasks(
    ctx: Admin,
    db: DbSession,
    response: Response,
    assignee: Annotated[str | None, Query(pattern=r"^(none|me|[0-9a-fA-F-]{36})$")] = None,
    state: Literal["open", "done", "cancelled"] | None = "open",
    due: Literal["overdue", "week", "none"] | None = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> TaskPage:
    _no_store(response)
    items, total = service.list_tasks(
        db, assignee=assignee, state=state, due=due, lead_id=None, me=ctx.user.id, page=page, page_size=page_size
    )
    return TaskPage(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/crm/overview",
    response_model=OverviewOut,
    summary="Counts of real records: enquiries, pipeline, projects, follow-ups",
)
def overview(
    ctx: Admin, db: DbSession, response: Response, days: Annotated[int, Query(ge=1, le=365)] = 30
) -> OverviewOut:
    _no_store(response)
    return service.overview(db, days)


@router.get(
    "/leads/{lead_id}/timeline",
    response_model=list[TimelineItem],
    summary="Everything recorded about an enquiry, newest first",
)
def timeline(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> list[TimelineItem]:
    _no_store(response)
    return service.timeline(db, _lead(db, lead_id))


@router.get(
    "/leads/{lead_id}/customer",
    response_model=CustomerOut,
    summary="The customer account, projects and quotations behind an enquiry",
)
def customer(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> CustomerOut:
    _no_store(response)
    return service.customer(db, _lead(db, lead_id))


@router.get(
    "/crm/leads.csv",
    response_class=PlainTextResponse,
    summary="Pipeline export (CSV): a whitelist of columns, no personal data, formula-safe, audited",
)
def export(
    request: Request,
    ctx: Admin,
    db: DbSession,
    status_filter: Annotated[LeadStatus | None, Query(alias="status")] = None,
    service_filter: Annotated[ServiceKey | None, Query(alias="service")] = None,
    inquiry_type: InquiryType | None = None,
    locale: LeadLocale | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    owner: Annotated[str | None, Query(pattern=r"^(none|me|[0-9a-fA-F-]{36})$")] = None,
    qualification: Literal["unassessed", "qualified", "not_qualified", "on_hold"] | None = None,
) -> PlainTextResponse:
    filters = leads.LeadFilters(
        status=status_filter,
        service=service_filter,
        inquiry_type=inquiry_type,
        locale=locale,
        created_from=created_from,
        created_to=created_to,
        owner=str(ctx.user.id) if owner == "me" else owner,
        qualification=qualification,
        sort="newest",
    )
    rows, total = leads.list_leads(db, filters, 1, service.EXPORT_LIMIT)
    body = service.export_csv(db, rows)
    audit.record(
        db,
        "crm.export",
        actor=ctx.user,
        entity_type="crm",
        details={
            "rows": len(rows),
            "total": total,
            "truncated": total > len(rows),
            "columns": list(service.EXPORT_COLUMNS),
        },
        ip_hash=client_ip_hash(request),
    )
    db.commit()
    return PlainTextResponse(
        body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="pipeline.csv"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
