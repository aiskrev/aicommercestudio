"""Request and response models of customer-facing quotations."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, field_validator

from app.opportunities.schemas import ProposalContent
from app.ops.workflows import sanitize
from app.schemas import _URL_LIKE, StrictModel, _clean_text, _error, _no_secrets

# The secret of a client's link (`secrets.token_urlsafe(32)`): sent in a request body, never in a URL.
Token = Annotated[str, Field(min_length=20, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")]

PublicStatus = Literal["published", "accepted", "declined", "withdrawn", "expired"]


class QuotationPublish(StrictModel):
    # The proposal revision staff are looking at: publishing a proposal someone just changed is refused.
    expected_revision: int = Field(ge=1)
    # Optional, and only what staff decide: no validity is invented.
    valid_until: date | None = None


class QuotationWithdraw(StrictModel):
    expected_revision: int = Field(ge=1)
    note: Annotated[str, Field(min_length=3, max_length=500), AfterValidator(sanitize)]


class QuotationStaffOut(BaseModel):
    id: uuid.UUID
    proposal_id: uuid.UUID
    version_number: int
    status: PublicStatus
    locale: str
    valid_until: date | None
    published_by: str | None
    published_at: datetime
    first_viewed_at: datetime | None
    last_viewed_at: datetime | None
    view_count: int
    decided_at: datetime | None
    decision_name: str | None
    decision_note: str | None
    withdrawn_at: datetime | None
    withdrawal_note: str | None
    revision: int


class QuotationPublished(BaseModel):
    # Shown once. Staff send the link to the client themselves; the system sends nothing.
    token: str
    quotation: QuotationStaffOut


class QuotationView(StrictModel):
    token: Token


class QuotationDecision(StrictModel):
    token: Token
    decision: Literal["accept", "decline"]
    # The person answering types their name; it is stored with the answer.
    name: str = Field(min_length=2, max_length=120)
    note: str = Field(default="", max_length=1000)
    # The explicit confirmation of the statement shown next to the button.
    confirmed: bool

    @field_validator("name")
    @classmethod
    def _plain(cls, value: str) -> str:
        value = _clean_text(value)
        if _URL_LIKE.search(value):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return value

    @field_validator("note")
    @classmethod
    def _note(cls, value: str) -> str:
        return _no_secrets(_clean_text(value))

    @field_validator("confirmed")
    @classmethod
    def _must_confirm(cls, value: bool) -> bool:
        if value is not True:
            raise _error("confirmation_required", "Необходимо е изрично потвърждение.")
        return value


class DecisionOut(BaseModel):
    decided_at: datetime
    name: str


class QuotationPublicOut(BaseModel):
    """What the holder of the link sees. `content` is the approved version, or null once withdrawn."""

    reference: str
    status: PublicStatus
    kind: Literal["proposal", "sow"]
    title: str
    company: str
    locale: str
    published_at: datetime
    valid_until: date | None
    version: int
    content: ProposalContent | None
    decision: DecisionOut | None
    # Whether the client can still answer (published and not past its validity date).
    open: bool
