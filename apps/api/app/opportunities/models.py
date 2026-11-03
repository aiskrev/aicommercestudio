"""Opportunity, proposal and SOW tables (migration 0014).

Every row hangs off a lead with `ON DELETE CASCADE`, so erasure requests and the lead retention
policy remove the opportunity data with the lead: stakeholder names never outlive the enquiry.
Proposal versions are append-only (a database trigger refuses UPDATE). Nothing here stores a price,
a signature or a sent message: commercial terms are free text written by a person, the platform
never sends anything and an approved draft is not a signed agreement.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models import AdminUser, TZDateTime, WorkshopKey, _in_check, utcnow


class ServiceDomain(enum.StrEnum):
    """The ten service domains (apps/web/src/lib/domains.ts, docs/SERVICE_TAXONOMY.md)."""

    AI_STRATEGY = "ai_strategy"
    AI_AGENTS_AUTOMATION = "ai_agents_automation"
    AI_APPLICATIONS = "ai_applications"
    COMMERCE_ENGINEERING = "commerce_engineering"
    CLOUD_PLATFORM = "cloud_platform"
    DEVOPS_SRE = "devops_sre"
    DATA_INTEGRATION = "data_integration"
    AI_GOVERNANCE = "ai_governance"
    MANAGED_OPERATIONS = "managed_operations"
    ADVISORY_ENABLEMENT = "advisory_enablement"


class AssessmentToolKey(enum.StrEnum):
    """Self-service assessments that can be recommended (apps/web/src/lib/tools.ts)."""

    ADVISOR = "advisor"
    READINESS = "readiness"
    TEAM = "team"
    ROI = "roi"
    FINDER = "finder"
    SOLUTION = "solution"
    AGENTS = "agents"
    CLOUD_MATURITY = "cloud_maturity"
    DEVOPS_MATURITY = "devops_maturity"
    OBSERVABILITY = "observability"
    ECOMMERCE_ARCHITECTURE = "ecommerce_architecture"
    DATA_INTEGRATION = "data_integration"
    AI_GOVERNANCE = "ai_governance"
    AI_OPS_READINESS = "ai_ops_readiness"
    FINOPS = "finops"


class DiscoveryStatus(enum.StrEnum):
    NOT_STARTED = "not_started"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NOT_NEEDED = "not_needed"


class QualificationStatus(enum.StrEnum):
    UNASSESSED = "unassessed"
    QUALIFIED = "qualified"
    NOT_QUALIFIED = "not_qualified"
    ON_HOLD = "on_hold"


class ProposalKind(enum.StrEnum):
    PROPOSAL = "proposal"
    SOW = "sow"


class ProposalStatus(enum.StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class VersionOrigin(enum.StrEnum):
    """`generated_draft` = assembled automatically from the opportunity record; always a draft."""

    HUMAN = "human"
    GENERATED_DRAFT = "generated_draft"


class LeadOpportunity(Base):
    """The engineering opportunity behind one lead (1:1)."""

    __tablename__ = "lead_opportunities"
    __table_args__ = (
        CheckConstraint(_in_check("service_domain", ServiceDomain, nullable=True), name="service_domain"),
        CheckConstraint(_in_check("discovery_status", DiscoveryStatus), name="discovery_status"),
        CheckConstraint(_in_check("qualification_status", QualificationStatus), name="qualification_status"),
        CheckConstraint(_in_check("recommended_workshop", WorkshopKey, nullable=True), name="recommended_workshop"),
        CheckConstraint(
            _in_check("recommended_assessment", AssessmentToolKey, nullable=True), name="recommended_assessment"
        ),
        CheckConstraint("revision >= 1", name="revision"),
        Index("ix_lead_opportunities_qualification_status", "qualification_status"),
    )

    lead_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True)
    service_domain: Mapped[str | None] = mapped_column(String(32), nullable=True)
    problem_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    scope_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    discovery_status: Mapped[str] = mapped_column(String(16), nullable=False, default=DiscoveryStatus.NOT_STARTED.value)
    qualification_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=QualificationStatus.UNASSESSED.value
    )
    qualification_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    technical_constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    # [{"name", "role", "provided_in"}] — only people the client named explicitly (see schemas).
    stakeholders: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    next_action: Mapped[str | None] = mapped_column(String(300), nullable=True)
    next_action_due: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_workshop: Mapped[str | None] = mapped_column(String(48), nullable=True)
    recommended_assessment: Mapped[str | None] = mapped_column(String(32), nullable=True)
    recommendation_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )

    updated_by: Mapped[AdminUser | None] = relationship(lazy="joined")


class LeadProposal(Base):
    """A proposal or SOW draft for a lead. Status changes are human decisions, recorded in the audit log."""

    __tablename__ = "lead_proposals"
    __table_args__ = (
        CheckConstraint(_in_check("kind", ProposalKind), name="kind"),
        CheckConstraint(_in_check("status", ProposalStatus), name="status"),
        CheckConstraint("revision >= 1", name="revision"),
        CheckConstraint("current_version >= 1", name="current_version"),
        CheckConstraint(
            "(status = 'approved') = (approved_version IS NOT NULL AND approved_at IS NOT NULL)", name="approval"
        ),
        Index("ix_lead_proposals_lead_id", "lead_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=ProposalStatus.DRAFT.value)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)

    created_by: Mapped[AdminUser | None] = relationship(foreign_keys=[created_by_id], lazy="joined")
    decided_by: Mapped[AdminUser | None] = relationship(foreign_keys=[decided_by_id], lazy="joined")
    versions: Mapped[list[LeadProposalVersion]] = relationship(
        back_populates="proposal",
        cascade="all, delete-orphan",
        order_by="LeadProposalVersion.number",
        passive_deletes=True,
    )


class LeadProposalVersion(Base):
    """One immutable version of a proposal's sections (append-only; see migration 0014)."""

    __tablename__ = "lead_proposal_versions"
    __table_args__ = (
        UniqueConstraint("proposal_id", "number", name="uq_lead_proposal_versions_number"),
        CheckConstraint(_in_check("origin", VersionOrigin), name="origin"),
        CheckConstraint("number >= 1", name="number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("lead_proposals.id", ondelete="CASCADE"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    origin: Mapped[str] = mapped_column(String(16), nullable=False)
    # Validated `ProposalContent` (scope, deliverables, …, commercial placeholders).
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    change_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)

    proposal: Mapped[LeadProposal] = relationship(back_populates="versions")
    author: Mapped[AdminUser | None] = relationship(lazy="joined")
