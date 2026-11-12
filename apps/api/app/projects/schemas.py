"""Request and response models of commercial customer projects.

Everything a person writes is plain text with a length limit. No model accepts an amount: a project holds references
(contract, invoices) and the approved scope, never prices.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, EmailStr, Field, field_validator

from app.opportunities.schemas import ProposalContent
from app.ops.workflows import sanitize
from app.schemas import StrictModel

Status = Literal[
    "draft", "quotation", "awaiting_approval", "approved", "in_progress", "client_review", "completed", "maintenance"
]
Text = Annotated[str, AfterValidator(sanitize)]
Short = Annotated[str, Field(min_length=1, max_length=200), AfterValidator(sanitize)]
Body = Annotated[str, Field(min_length=3, max_length=2000), AfterValidator(sanitize)]
Reference = Annotated[str, Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9 ._/#-]+$")]

CLIENT_ACTIONS = ("approve_scope", "accept_completion", "request_changes", "change_request", "support")
STAFF_ACTIONS = ("quotation", "awaiting_approval", "in_progress", "client_review", "completed", "maintenance")


# --------------------------------------------------------------------------- staff input


class ProjectCreate(StrictModel):
    # The customer is chosen by the verified e-mail address of their account, never by an id someone typed.
    account_email: EmailStr = Field(max_length=254)
    title: Short
    summary: Annotated[str, Field(max_length=2000), AfterValidator(sanitize)] = ""
    # An accepted quotation of this lead: the project then starts from its approved scope.
    quotation_id: uuid.UUID | None = None
    contract_reference: Reference | None = None

    @field_validator("account_email")
    @classmethod
    def _lower(cls, value: str) -> str:
        return value.strip().lower()


class ProjectUpdate(StrictModel):
    expected_revision: int = Field(ge=1)
    title: Short | None = None
    summary: Annotated[str, Field(max_length=2000), AfterValidator(sanitize)] | None = None
    contract_reference: Reference | None = None
    clear_contract_reference: bool = False
    invoice_references: Annotated[list[Reference], Field(max_length=10)] | None = None
    maintenance_plan: Annotated[str, Field(max_length=24, pattern=r"^[a-z_]+$")] | None = None
    maintenance_note: Annotated[str, Field(max_length=300), AfterValidator(sanitize)] | None = None


class MilestoneIn(StrictModel):
    id: uuid.UUID | None = None
    title: Annotated[str, Field(min_length=1, max_length=160), AfterValidator(sanitize)]
    description: Annotated[str, Field(max_length=500), AfterValidator(sanitize)] = ""
    indicative_timing: Annotated[str, Field(max_length=120), AfterValidator(sanitize)] = ""
    status: Literal["planned", "in_progress", "done"] = "planned"


class MilestonesIn(StrictModel):
    expected_revision: int = Field(ge=1)
    milestones: Annotated[list[MilestoneIn], Field(max_length=20)]


class StaffTransition(StrictModel):
    expected_revision: int = Field(ge=1)
    to: Literal["quotation", "awaiting_approval", "in_progress", "client_review", "completed", "maintenance"]
    note: Annotated[str, Field(max_length=2000), AfterValidator(sanitize)] | None = None


class StaffEventIn(StrictModel):
    kind: Literal["update", "delivery"]
    visibility: Literal["client", "internal"] = "client"
    body: Body


class StaffReply(StrictModel):
    body: Body
    state: Literal["answered", "closed"] = "answered"


# --------------------------------------------------------------------------- customer input


class ClientAction(StrictModel):
    # The revision the customer saw: approving a project that changed in the meantime is refused.
    expected_revision: int = Field(ge=1)
    action: Literal["approve_scope", "accept_completion", "request_changes"]
    note: Annotated[str, Field(max_length=2000), AfterValidator(sanitize)] | None = None


class ClientRequest(StrictModel):
    kind: Literal["change_request", "support"]
    body: Body


# --------------------------------------------------------------------------- output


class MilestoneOut(BaseModel):
    id: uuid.UUID
    position: int
    title: str
    description: str | None
    indicative_timing: str | None
    status: str
    completed_at: datetime | None


class EventOut(BaseModel):
    id: uuid.UUID
    kind: str
    visibility: str
    # "client" or "team": the customer never sees a staff member's name or e-mail.
    author: Literal["client", "team", "system"]
    mine: bool = False
    body: str | None
    state: str | None
    parent_id: uuid.UUID | None
    meta: dict | None
    created_at: datetime


class ProjectSummaryOut(BaseModel):
    id: uuid.UUID
    reference: str
    title: str
    status: Status
    updated_at: datetime
    open_requests: int = 0


class ProjectDetailOut(BaseModel):
    id: uuid.UUID
    reference: str
    title: str
    summary: str | None
    status: Status
    revision: int
    quotation_reference: str | None
    quotation_status: str | None
    scope_version: int | None
    scope: ProposalContent | None
    contract_reference: str | None
    invoice_references: list[str]
    maintenance_plan: str | None
    maintenance_note: str | None
    approved_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    milestones: list[MilestoneOut]
    events: list[EventOut]
    # What this viewer may do right now, decided by the server; the page only follows it.
    allowed_actions: list[str]


class StaffProjectOut(ProjectDetailOut):
    lead_id: uuid.UUID | None
    quotation_id: uuid.UUID | None
    customer_email: str | None
    customer_name: str | None
    # Staff transitions possible from the current status.
    staff_transitions: list[str]
