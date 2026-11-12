"""Admin CRM over the data the admin already holds (docs/ADMIN_CRM.md).

Everything here is for the `admin` role, like leads. It adds an owner on a lead and follow-up tasks, and reads what
exists: the overview counts real records only (no revenue, no forecast, no conversion rate), the timeline joins the
events that were already recorded, and the export carries a whitelist of columns with no personal data.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session

from app import audit
from app.accounts.models import CustomerAccount
from app.crm.models import LeadTask
from app.crm.schemas import (
    CustomerOut,
    OverviewOut,
    OwnerLoad,
    PersonOut,
    ProjectLink,
    QuotationLink,
    StatusCounts,
    TaskIn,
    TaskOut,
    TaskPatch,
    TimelineItem,
)
from app.models import AdminRole, AdminUser, AuditLog, Lead, LeadNote, LeadStatus, utcnow
from app.opportunities.models import LeadOpportunity, LeadProposal
from app.projects.models import CommercialProject, ProjectEvent
from app.quotations.models import Quotation
from app.quotations.service import effective_status
from app.workspace.models import CustomerWorkspace

OPEN_STATUSES = ("NEW", "CONTACTED", "QUALIFIED", "PROPOSAL")
ACTIVE_PROJECT_STATUSES = ("approved", "in_progress", "client_review")
MAX_OPEN_TASKS_PER_LEAD = 50
EXPORT_LIMIT = 5000


class CrmError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message


def _today() -> date:
    return utcnow().date()


# --------------------------------------------------------------------------- owner


def _admin(db: Session, admin_id: uuid.UUID) -> AdminUser:
    """An active administrator: the only kind of person who can own an enquiry or a task (they alone see leads)."""
    user = db.get(AdminUser, admin_id)
    if user is None or not user.is_active or user.role != AdminRole.ADMIN:
        raise CrmError(422, "assignee_invalid", "Choose an active administrator.")
    return user


def person(user: AdminUser | None) -> PersonOut | None:
    return PersonOut(id=user.id, name=user.full_name) if user else None


def set_owner(db: Session, lead: Lead, owner_id: uuid.UUID | None, actor: AdminUser, ip_hash: str | None) -> bool:
    """Sets or clears the owner. Returns False when nothing changed (a repeat)."""
    if owner_id is not None:
        _admin(db, owner_id)
    if lead.owner_id == owner_id:
        return False
    audit.record(
        db,
        "lead.owner_set",
        actor=actor,
        entity_type="lead",
        entity_id=str(lead.id),
        details={"from": str(lead.owner_id) if lead.owner_id else None, "to": str(owner_id) if owner_id else None},
        ip_hash=ip_hash,
    )
    lead.owner_id = owner_id
    lead.updated_at = utcnow()
    db.commit()
    return True


# --------------------------------------------------------------------------- tasks


def task_out(db: Session, task: LeadTask, lead: Lead | None = None) -> TaskOut:
    lead = lead or db.get(Lead, task.lead_id)
    assignee = db.get(AdminUser, task.assignee_id) if task.assignee_id else None
    return TaskOut(
        id=task.id,
        lead_id=task.lead_id,
        lead_reference=lead.reference if lead else "",
        lead_service=lead.service if lead else "",
        title=task.title,
        due_on=task.due_on,
        state=task.state,
        overdue=task.state == "open" and task.due_on is not None and task.due_on < _today(),
        assignee=person(assignee),
        created_at=task.created_at,
        done_at=task.done_at,
        revision=task.revision,
    )


def create_task(db: Session, lead: Lead, payload: TaskIn, actor: AdminUser, ip_hash: str | None) -> LeadTask:
    if payload.due_on is not None and payload.due_on < _today():
        raise CrmError(422, "due_in_past", "The date of a follow-up cannot be in the past.")
    assignee_id = payload.assignee_id or lead.owner_id or actor.id
    _admin(db, assignee_id)
    open_count = db.scalar(
        select(func.count()).select_from(LeadTask).where(LeadTask.lead_id == lead.id, LeadTask.state == "open")
    )
    if (open_count or 0) >= MAX_OPEN_TASKS_PER_LEAD:
        raise CrmError(409, "task_limit", "This enquiry has too many open follow-ups.")
    task = LeadTask(
        lead_id=lead.id,
        title=payload.title,
        due_on=payload.due_on,
        assignee_id=assignee_id,
        created_by_id=actor.id,
    )
    db.add(task)
    lead.updated_at = utcnow()
    db.flush()
    audit.record(
        db,
        "lead.task_created",
        actor=actor,
        entity_type="lead",
        entity_id=str(lead.id),
        details={"task": str(task.id), "due_on": payload.due_on.isoformat() if payload.due_on else None},
        ip_hash=ip_hash,
    )
    db.commit()
    return task


def update_task(db: Session, task: LeadTask, payload: TaskPatch, actor: AdminUser, ip_hash: str | None) -> LeadTask:
    if payload.expected_revision != task.revision:
        raise CrmError(409, "task_stale", "The follow-up was changed by someone else. Reload and try again.")
    if payload.due_on is not None and payload.due_on < _today() and payload.due_on != task.due_on:
        raise CrmError(422, "due_in_past", "The date of a follow-up cannot be in the past.")
    changes: dict[str, Any] = {}
    if payload.title is not None and payload.title != task.title:
        task.title = payload.title
        changes["title"] = True
    if payload.clear_due:
        task.due_on = None
        changes["due_on"] = None
    elif payload.due_on is not None and payload.due_on != task.due_on:
        task.due_on = payload.due_on
        changes["due_on"] = payload.due_on.isoformat()
    if payload.clear_assignee:
        task.assignee_id = None
        changes["assignee"] = None
    elif payload.assignee_id is not None and payload.assignee_id != task.assignee_id:
        _admin(db, payload.assignee_id)
        task.assignee_id = payload.assignee_id
        changes["assignee"] = str(payload.assignee_id)
    if payload.state is not None and payload.state != task.state:
        task.state = payload.state
        task.done_at = utcnow() if payload.state == "done" else None
        task.done_by_id = actor.id if payload.state == "done" else None
        changes["state"] = payload.state
    if not changes:
        return task  # a repeat changes nothing, not even the revision
    task.revision += 1
    task.updated_at = utcnow()
    audit.record(
        db,
        "lead.task_done" if changes.get("state") == "done" else "lead.task_updated",
        actor=actor,
        entity_type="lead",
        entity_id=str(task.lead_id),
        details={"task": str(task.id), **changes},
        ip_hash=ip_hash,
    )
    db.commit()
    return task


def _task_query(assignee: str | None, state: str | None, due: str | None, lead_id: uuid.UUID | None, me: uuid.UUID):
    query: Select = select(LeadTask)
    if lead_id:
        query = query.where(LeadTask.lead_id == lead_id)
    if assignee == "me":
        query = query.where(LeadTask.assignee_id == me)
    elif assignee == "none":
        query = query.where(LeadTask.assignee_id.is_(None))
    elif assignee:
        query = query.where(LeadTask.assignee_id == uuid.UUID(assignee))
    if state:
        query = query.where(LeadTask.state == state)
    today = _today()
    if due == "overdue":
        query = query.where(LeadTask.state == "open", LeadTask.due_on < today)
    elif due == "week":
        query = query.where(
            LeadTask.state == "open", LeadTask.due_on >= today, LeadTask.due_on <= today + timedelta(days=7)
        )
    elif due == "none":
        query = query.where(LeadTask.due_on.is_(None))
    return query


def list_tasks(
    db: Session,
    *,
    assignee: str | None,
    state: str | None,
    due: str | None,
    lead_id: uuid.UUID | None,
    me: uuid.UUID,
    page: int,
    page_size: int,
) -> tuple[list[TaskOut], int]:
    query = _task_query(assignee, state, due, lead_id, me)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    # Open work first, the oldest date first; tasks without a date after the dated ones.
    rows = db.scalars(
        query.order_by(
            (LeadTask.state != "open"),
            LeadTask.due_on.asc().nulls_last(),
            LeadTask.created_at.desc(),
            LeadTask.id,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [task_out(db, row) for row in rows], total


# --------------------------------------------------------------------------- overview


def overview(db: Session, days: int) -> OverviewOut:
    now = utcnow()
    since = now - timedelta(days=days)
    today = _today()
    by_status = {status: 0 for status in (s.value for s in LeadStatus)}
    for status, count in db.execute(select(Lead.status, func.count()).group_by(Lead.status)).all():
        by_status[status] = count
    open_leads = Lead.status.in_(OPEN_STATUSES)
    open_opportunities = db.scalar(
        select(func.count())
        .select_from(LeadOpportunity)
        .join(Lead, Lead.id == LeadOpportunity.lead_id)
        .where(open_leads, LeadOpportunity.qualification_status != "not_qualified")
    )
    quotations = db.scalars(select(Quotation).where(Quotation.status.in_(("published", "accepted")))).all()
    pending = sum(1 for q in quotations if effective_status(q, today) == "published")
    accepted = sum(1 for q in quotations if q.status == "accepted")
    project_counts = dict(
        db.execute(select(CommercialProject.status, func.count()).group_by(CommercialProject.status)).all()
    )
    open_task = and_(LeadTask.state == "open")
    overdue = and_(LeadTask.state == "open", LeadTask.due_on < today)

    owners: list[OwnerLoad] = []
    admins = {a.id: a for a in db.scalars(select(AdminUser).where(AdminUser.role == AdminRole.ADMIN.value)).all()}
    leads_by_owner = dict(
        db.execute(select(Lead.owner_id, func.count()).where(open_leads).group_by(Lead.owner_id)).all()
    )
    tasks_by_owner = dict(
        db.execute(select(LeadTask.assignee_id, func.count()).where(open_task).group_by(LeadTask.assignee_id)).all()
    )
    overdue_by_owner = dict(
        db.execute(select(LeadTask.assignee_id, func.count()).where(overdue).group_by(LeadTask.assignee_id)).all()
    )
    for owner_id in dict.fromkeys([*admins, *leads_by_owner, *tasks_by_owner]):
        if not (leads_by_owner.get(owner_id) or tasks_by_owner.get(owner_id)) and owner_id is not None:
            continue  # an administrator with no work does not clutter the list
        owners.append(
            OwnerLoad(
                owner=person(admins.get(owner_id)) if owner_id else None,
                open_enquiries=leads_by_owner.get(owner_id, 0),
                open_tasks=tasks_by_owner.get(owner_id, 0),
                overdue_tasks=overdue_by_owner.get(owner_id, 0),
            )
        )
    return OverviewOut(
        period_days=days,
        since=since,
        enquiries_total=sum(by_status.values()),
        enquiries_in_period=db.scalar(select(func.count()).select_from(Lead).where(Lead.created_at >= since)) or 0,
        enquiries_by_status=StatusCounts(**by_status),
        unassigned_open_enquiries=db.scalar(
            select(func.count()).select_from(Lead).where(open_leads, Lead.owner_id.is_(None))
        )
        or 0,
        open_opportunities=open_opportunities or 0,
        proposals_approved=db.scalar(
            select(func.count()).select_from(LeadProposal).where(LeadProposal.status == "approved")
        )
        or 0,
        quotations_pending=pending,
        quotations_accepted=accepted,
        projects_active=sum(project_counts.get(status, 0) for status in ACTIVE_PROJECT_STATUSES),
        projects_by_status={status: count for status, count in project_counts.items() if status != "draft"},
        follow_ups_open=db.scalar(select(func.count()).select_from(LeadTask).where(open_task)) or 0,
        follow_ups_overdue=db.scalar(select(func.count()).select_from(LeadTask).where(overdue)) or 0,
        follow_ups_due_this_week=db.scalar(
            select(func.count())
            .select_from(LeadTask)
            .where(open_task, LeadTask.due_on >= today, LeadTask.due_on <= today + timedelta(days=7))
        )
        or 0,
        owners=sorted(owners, key=lambda o: (o.owner is None, -(o.open_enquiries + o.open_tasks))),
    )


# --------------------------------------------------------------------------- timeline and navigation


def timeline(db: Session, lead: Lead) -> list[TimelineItem]:
    """Every recorded event of an enquiry in one list, newest first.

    Staff only; notes and follow-up titles are staff's own text.
    """
    items: list[TimelineItem] = []
    for row in db.scalars(
        select(AuditLog).where(
            AuditLog.entity_type == "lead", AuditLog.entity_id == str(lead.id), AuditLog.action != "lead.viewed"
        )
    ).all():
        items.append(TimelineItem(at=row.created_at, kind="audit", action=row.action, actor=row.actor_label))
    for note in db.scalars(select(LeadNote).where(LeadNote.lead_id == lead.id)).all():
        author = db.get(AdminUser, note.author_id) if note.author_id else None
        items.append(
            TimelineItem(
                at=note.created_at,
                kind="note",
                action="lead.note",
                actor=author.full_name if author else None,
                detail=note.body,
            )
        )
    for proposal in db.scalars(select(LeadProposal).where(LeadProposal.lead_id == lead.id)).all():
        items.append(
            TimelineItem(
                at=proposal.created_at,
                kind="proposal",
                action=f"proposal.{proposal.kind}.created",
                actor=None,
                ref=str(proposal.id),
                detail=proposal.title,
            )
        )
    for quotation in db.scalars(select(Quotation).where(Quotation.lead_id == lead.id)).all():
        ref = str(quotation.id)
        publisher = quotation.published_by.full_name if quotation.published_by else None
        items.append(
            TimelineItem(
                at=quotation.published_at, kind="quotation", action="quotation.published", actor=publisher, ref=ref
            )
        )
        if quotation.first_viewed_at:
            items.append(
                TimelineItem(
                    at=quotation.first_viewed_at, kind="quotation", action="quotation.viewed", actor=None, ref=ref
                )
            )
        if quotation.decided_at:
            items.append(
                TimelineItem(
                    at=quotation.decided_at,
                    kind="quotation",
                    action=f"quotation.{quotation.status}",
                    actor=None,
                    ref=ref,
                )
            )
        if quotation.withdrawn_at:
            items.append(
                TimelineItem(
                    at=quotation.withdrawn_at, kind="quotation", action="quotation.withdrawn", actor=None, ref=ref
                )
            )
    for project in db.scalars(select(CommercialProject).where(CommercialProject.lead_id == lead.id)).all():
        ref = str(project.id)
        items.append(
            TimelineItem(
                at=project.created_at,
                kind="project",
                action="project.created",
                actor=None,
                ref=ref,
                detail=project.title,
            )
        )
        for event in db.scalars(
            select(ProjectEvent).where(ProjectEvent.project_id == project.id, ProjectEvent.kind == "status")
        ).all():
            items.append(
                TimelineItem(
                    at=event.created_at,
                    kind="project",
                    action=f"project.status.{(event.meta or {}).get('to', '')}",
                    actor=None,
                    ref=ref,
                )
            )
    for task in db.scalars(select(LeadTask).where(LeadTask.lead_id == lead.id)).all():
        items.append(
            TimelineItem(
                at=task.created_at, kind="task", action="task.created", actor=None, ref=str(task.id), detail=task.title
            )
        )
        if task.done_at:
            items.append(
                TimelineItem(
                    at=task.done_at, kind="task", action="task.done", actor=None, ref=str(task.id), detail=task.title
                )
            )
    items.sort(key=lambda item: item.at, reverse=True)
    return items[:300]


def customer(db: Session, lead: Lead) -> CustomerOut:
    accounts = list(
        db.scalars(
            select(CustomerAccount).where(
                func.lower(CustomerAccount.email) == lead.email.lower(), CustomerAccount.erased_at.is_(None)
            )
        ).all()
    )
    projects = db.scalars(
        select(CommercialProject).where(CommercialProject.lead_id == lead.id).order_by(CommercialProject.created_at)
    ).all()
    quotations = db.scalars(
        select(Quotation).where(Quotation.lead_id == lead.id).order_by(Quotation.published_at)
    ).all()
    # The account behind a project is the owner of its workspace, whatever address the enquiry came from.
    for project in projects:
        workspace = db.get(CustomerWorkspace, project.workspace_id)
        owner = db.get(CustomerAccount, workspace.owner_account_id) if workspace else None
        if owner is not None and owner.erased_at is None and owner not in accounts:
            accounts.append(owner)
    return CustomerOut(
        has_account=bool(accounts),
        account_verified=any(a.email_verified_at is not None for a in accounts),
        projects=[ProjectLink(id=p.id, reference=p.reference, title=p.title, status=p.status) for p in projects],
        quotations=[
            QuotationLink(id=q.id, status=effective_status(q), version=q.version_number, published_at=q.published_at)
            for q in quotations
        ],
    )


# --------------------------------------------------------------------------- export


EXPORT_COLUMNS = (
    "reference",
    "created",
    "service",
    "inquiry_type",
    "source",
    "locale",
    "status",
    "owner",
    "qualification",
    "proposal",
    "quotation",
    "project",
    "open_followups",
)


def safe_cell(value: object) -> str:
    """A cell that starts with = + - @ (or a tab or a return) runs as a formula in a spreadsheet: it gets a quote."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def export_csv(db: Session, leads: list[Lead]) -> str:
    """A whitelist of columns about the pipeline. No name, e-mail, phone, company or message ever leaves through it."""
    ids = [lead.id for lead in leads]
    owners = {a.id: a.full_name for a in db.scalars(select(AdminUser)).all()}
    qualification = dict(
        db.execute(
            select(LeadOpportunity.lead_id, LeadOpportunity.qualification_status).where(
                LeadOpportunity.lead_id.in_(ids)
            )
        ).all()
    )
    proposals: dict[uuid.UUID, str] = {}
    for lead_id, status in db.execute(
        select(LeadProposal.lead_id, LeadProposal.status)
        .where(LeadProposal.lead_id.in_(ids))
        .order_by(LeadProposal.created_at)
    ).all():
        proposals[lead_id] = status
    quotations: dict[uuid.UUID, str] = {}
    for quotation in db.scalars(
        select(Quotation).where(Quotation.lead_id.in_(ids)).order_by(Quotation.published_at)
    ).all():
        quotations[quotation.lead_id] = effective_status(quotation)
    projects: dict[uuid.UUID, str] = {}
    for lead_id, status in db.execute(
        select(CommercialProject.lead_id, CommercialProject.status)
        .where(CommercialProject.lead_id.in_(ids))
        .order_by(CommercialProject.created_at)
    ).all():
        projects[lead_id] = status
    follow_ups = dict(
        db.execute(
            select(LeadTask.lead_id, func.count())
            .where(LeadTask.lead_id.in_(ids), LeadTask.state == "open")
            .group_by(LeadTask.lead_id)
        ).all()
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(EXPORT_COLUMNS)
    for lead in leads:
        writer.writerow(
            [
                safe_cell(value)
                for value in (
                    lead.reference,
                    lead.created_at.date().isoformat(),
                    lead.service,
                    lead.inquiry_type,
                    lead.source,
                    lead.locale,
                    lead.status,
                    owners.get(lead.owner_id) if lead.owner_id else "",
                    qualification.get(lead.id, ""),
                    proposals.get(lead.id, ""),
                    quotations.get(lead.id, ""),
                    projects.get(lead.id, ""),
                    follow_ups.get(lead.id, 0),
                )
            ]
        )
    return buffer.getvalue()
