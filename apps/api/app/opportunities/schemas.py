"""Request and response schemas of the opportunity workflow (plain text only, size-bounded)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, model_validator
from pydantic_core import PydanticCustomError

from app.models import WorkshopKey
from app.opportunities.models import (
    AssessmentToolKey,
    DiscoveryStatus,
    ProposalKind,
    QualificationStatus,
    ServiceDomain,
)
from app.ops.workflows import sanitize

Name = Annotated[str, Field(min_length=1, max_length=120), AfterValidator(sanitize)]
Title = Annotated[str, Field(min_length=1, max_length=200), AfterValidator(sanitize)]
Item = Annotated[str, Field(min_length=1, max_length=500), AfterValidator(sanitize)]
LongText = Annotated[str, Field(max_length=4000), AfterValidator(sanitize)]


# --------------------------------------------------------------------------- opportunity


class Stakeholder(BaseModel):
    """A person the client named explicitly. `provided_in` records where they did so; nothing is inferred."""

    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    name: Name
    role: Name
    provided_in: Literal["enquiry", "call", "email", "meeting"]


class OpportunityUpdate(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    # 0 creates the record; otherwise the revision the editor started from (409 when stale).
    expected_revision: int = Field(ge=0)
    service_domain: ServiceDomain | None = None
    problem_summary: LongText | None = None
    scope_summary: LongText | None = None
    discovery_status: DiscoveryStatus = DiscoveryStatus.NOT_STARTED
    qualification_status: QualificationStatus = QualificationStatus.UNASSESSED
    qualification_rationale: LongText | None = None
    technical_constraints: LongText | None = None
    stakeholders: list[Stakeholder] = Field(default_factory=list, max_length=12)
    # The client named these people themselves; staff confirm it on every save that lists anyone.
    stakeholders_confirmed: bool = False
    next_action: Annotated[str, Field(max_length=300), AfterValidator(sanitize)] | None = None
    next_action_due: date | None = None
    notes: LongText | None = None
    recommended_workshop: WorkshopKey | None = None
    recommended_assessment: AssessmentToolKey | None = None
    recommendation_rationale: LongText | None = None

    @model_validator(mode="after")
    def _rules(self) -> OpportunityUpdate:
        decided = self.qualification_status in (QualificationStatus.QUALIFIED, QualificationStatus.NOT_QUALIFIED)
        if decided and not (self.qualification_rationale or "").strip():
            raise PydanticCustomError("rationale_required", "A qualification decision needs its rationale.")
        if self.stakeholders and not self.stakeholders_confirmed:
            raise PydanticCustomError(
                "stakeholders_unconfirmed", "List only people the client named explicitly, and confirm it."
            )
        recommended = self.recommended_workshop is not None or self.recommended_assessment is not None
        if recommended and not (self.recommendation_rationale or "").strip():
            raise PydanticCustomError("recommendation_rationale", "A recommendation needs its rationale.")
        return self


class LinkedRecord(BaseModel):
    kind: Literal[
        "advisor_assessment",
        "assessment_result",
        "team_configuration",
        "readiness",
        "solution",
        "ai_managed",
        "project_configurator",
        "quote_basket",
    ]
    reference: str
    detail: str | None = None
    created_at: datetime | None = None


class OpportunitySource(BaseModel):
    """Where the lead came from and which records are linked to it (read-only)."""

    source: str
    inquiry_type: str
    submitted_service: str
    workshop_key: str | None
    linked: list[LinkedRecord]


class OpportunityOut(BaseModel):
    exists: bool
    lead_id: uuid.UUID
    source: OpportunitySource
    service_domain: str | None = None
    problem_summary: str | None = None
    scope_summary: str | None = None
    discovery_status: str = DiscoveryStatus.NOT_STARTED.value
    qualification_status: str = QualificationStatus.UNASSESSED.value
    qualification_rationale: str | None = None
    technical_constraints: str | None = None
    stakeholders: list[Stakeholder] = Field(default_factory=list)
    next_action: str | None = None
    next_action_due: date | None = None
    notes: str | None = None
    recommended_workshop: str | None = None
    recommended_assessment: str | None = None
    recommendation_rationale: str | None = None
    revision: int = 0
    updated_at: datetime | None = None
    updated_by: str | None = None


# --------------------------------------------------------------------------- proposals


class Responsibility(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    party: Literal["client", "provider", "shared"]
    item: Item


class Milestone(BaseModel):
    """Indicative only: a timing is a written estimate, never a commitment."""

    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    title: Title
    description: Annotated[str, Field(max_length=1000), AfterValidator(sanitize)] = ""
    indicative_timing: Annotated[str, Field(max_length=120), AfterValidator(sanitize)] = ""


class Risk(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    risk: Item
    mitigation: Annotated[str, Field(max_length=500), AfterValidator(sanitize)] = ""


class Commercial(BaseModel):
    """Commercial terms are written by a person. Generated drafts fill every field with the placeholder."""

    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    pricing_basis: Annotated[str, Field(max_length=1000), AfterValidator(sanitize)] = ""
    payment_terms: Annotated[str, Field(max_length=1000), AfterValidator(sanitize)] = ""
    validity: Annotated[str, Field(max_length=300), AfterValidator(sanitize)] = ""
    notes: Annotated[str, Field(max_length=1000), AfterValidator(sanitize)] = ""


ItemList = Annotated[list[Item], Field(max_length=40)]


class ProposalContent(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    scope: LongText = ""
    deliverables: ItemList = Field(default_factory=list)
    assumptions: ItemList = Field(default_factory=list)
    exclusions: ItemList = Field(default_factory=list)
    dependencies: ItemList = Field(default_factory=list)
    responsibilities: Annotated[list[Responsibility], Field(max_length=40)] = Field(default_factory=list)
    acceptance_criteria: ItemList = Field(default_factory=list)
    milestones: Annotated[list[Milestone], Field(max_length=20)] = Field(default_factory=list)
    risks: Annotated[list[Risk], Field(max_length=30)] = Field(default_factory=list)
    commercial: Commercial = Field(default_factory=Commercial)


SECTIONS = tuple(ProposalContent.model_fields)


class ProposalCreate(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    kind: ProposalKind
    title: Title
    # `generate` assembles a first draft from the opportunity record; otherwise `content` (or empty).
    generate: bool = False
    content: ProposalContent | None = None

    @model_validator(mode="after")
    def _one_source(self) -> ProposalCreate:
        if self.generate and self.content is not None:
            raise PydanticCustomError("draft_source", "Either generate a draft or send content, not both.")
        return self


class VersionCreate(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    expected_revision: int = Field(ge=1)
    content: ProposalContent
    change_note: Annotated[str, Field(min_length=3, max_length=500), AfterValidator(sanitize)]


class ProposalTransition(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    action: Literal["submit", "approve", "reject", "withdraw", "reopen"]
    expected_revision: int = Field(ge=1)
    note: Annotated[str, Field(max_length=2000), AfterValidator(sanitize)] | None = None
    # Approving with open review warnings requires saying so explicitly.
    acknowledge_warnings: bool = False


class Finding(BaseModel):
    """A review warning on a version. `blocking` findings prevent approval."""

    code: Literal[
        "commercial_placeholder",
        "commercial_missing",
        "unfilled_placeholder",
        "guarantee_wording",
        "signature_wording",
        "price_outside_commercial",
        "staffing_claim",
        "empty_section",
    ]
    section: str
    blocking: bool


class VersionMeta(BaseModel):
    number: int
    origin: str
    change_note: str | None
    author: str | None
    created_at: datetime
    changed_sections: list[str]


class VersionOut(VersionMeta):
    content: ProposalContent
    findings: list[Finding]


class ProposalOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    kind: str
    title: str
    status: str
    current_version: int
    revision: int
    created_by: str | None
    decided_by: str | None
    decision_note: str | None
    approved_version: int | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    versions: list[VersionMeta]
    latest: VersionOut
