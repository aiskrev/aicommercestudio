"""Request and response models of the admin CRM (docs/ADMIN_CRM.md). Nothing here carries an amount or a conversion."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field

from app.ops.workflows import sanitize
from app.schemas import StrictModel

Title = Annotated[str, Field(min_length=1, max_length=200), AfterValidator(sanitize)]


class OwnerIn(StrictModel):
    # None clears the owner. The owner must be an active administrator.
    owner_id: uuid.UUID | None


class TaskIn(StrictModel):
    title: Title
    due_on: date | None = None
    assignee_id: uuid.UUID | None = None


class TaskPatch(StrictModel):
    expected_revision: int = Field(ge=1)
    title: Title | None = None
    due_on: date | None = None
    clear_due: bool = False
    assignee_id: uuid.UUID | None = None
    clear_assignee: bool = False
    state: Literal["open", "done", "cancelled"] | None = None


class PersonOut(BaseModel):
    id: uuid.UUID
    name: str


class TaskOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    # What identifies the enquiry without personal data: its reference and the service.
    lead_reference: str
    lead_service: str
    title: str
    due_on: date | None
    state: Literal["open", "done", "cancelled"]
    overdue: bool
    assignee: PersonOut | None
    created_at: datetime
    done_at: datetime | None
    revision: int


class TaskPage(BaseModel):
    items: list[TaskOut]
    total: int
    page: int
    page_size: int


class StatusCounts(BaseModel):
    NEW: int = 0
    CONTACTED: int = 0
    QUALIFIED: int = 0
    PROPOSAL: int = 0
    WON: int = 0
    LOST: int = 0


class OwnerLoad(BaseModel):
    owner: PersonOut | None
    open_enquiries: int
    open_tasks: int
    overdue_tasks: int


class OverviewOut(BaseModel):
    """Counts of real records only. There is no revenue, no forecast and no conversion rate on purpose."""

    period_days: int
    since: datetime
    enquiries_total: int
    enquiries_in_period: int
    enquiries_by_status: StatusCounts
    unassigned_open_enquiries: int
    open_opportunities: int
    proposals_approved: int
    quotations_pending: int
    quotations_accepted: int
    projects_active: int
    projects_by_status: dict[str, int]
    follow_ups_open: int
    follow_ups_overdue: int
    follow_ups_due_this_week: int
    owners: list[OwnerLoad]


class TimelineItem(BaseModel):
    at: datetime
    kind: Literal["audit", "note", "proposal", "quotation", "project", "task"]
    # A stable key (`lead.status_changed`, `quotation.published`, `task.done`, ...) the page translates.
    action: str
    actor: str | None
    detail: str | None = None
    ref: str | None = None


class ProjectLink(BaseModel):
    id: uuid.UUID
    reference: str
    title: str
    status: str


class QuotationLink(BaseModel):
    id: uuid.UUID
    status: str
    version: int
    published_at: datetime


class CustomerOut(BaseModel):
    """What staff may navigate to from an enquiry: the customer account behind its e-mail, projects and quotations."""

    has_account: bool
    account_verified: bool
    projects: list[ProjectLink]
    quotations: list[QuotationLink]
