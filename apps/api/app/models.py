"""ORM models. The Alembic migration in alembic/versions mirrors these exactly
(verified by tests/test_migrations.py via `alembic check`)."""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class LeadStatus(enum.StrEnum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    PROPOSAL = "PROPOSAL"
    WON = "WON"
    LOST = "LOST"


class ServiceKey(enum.StrEnum):
    MAINTENANCE = "maintenance"
    SEO = "seo"
    AI_TOOLS = "ai_tools"
    AUTOMATION = "automation"
    ANALYTICS = "analytics"
    INTEGRATIONS = "integrations"
    AUDIT = "audit"
    AI_MANAGED = "ai_managed"
    AI_AGENTS = "ai_agents"
    OTHER = "other"


class LeadLocale(enum.StrEnum):
    """Language of the website the inquiry was sent from (and preferred communication language)."""

    BG = "bg"
    EN = "en"


class InquiryType(enum.StrEnum):
    CONTACT = "contact"
    QUOTE = "quote"


class Platform(enum.StrEnum):
    SHOPIFY = "shopify"
    WOOCOMMERCE = "woocommerce"
    CUSTOM = "custom"
    OTHER = "other"
    NONE = "none"


class BudgetRange(enum.StrEnum):
    UNDISCLOSED = "undisclosed"
    UNDER_2500 = "under_2500"
    FROM_2500_TO_10000 = "2500_10000"
    FROM_10000_TO_25000 = "10000_25000"
    OVER_25000 = "over_25000"


class Timeline(enum.StrEnum):
    ASAP = "asap"
    WITHIN_1_MONTH = "within_1_month"
    WITHIN_3_MONTHS = "within_3_months"
    FLEXIBLE = "flexible"


class AdminRole(enum.StrEnum):
    """Staff role. `admin` keeps every existing right; `editor` and `viewer` reach only the catalogue."""

    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class AIActionStatus(enum.StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"


def _in_check(column: str, values: type[enum.StrEnum], nullable: bool = False) -> str:
    joined = ", ".join(f"'{v.value}'" for v in values)
    check = f"{column} IN ({joined})"
    return f"{column} IS NULL OR {check}" if nullable else check


TZDateTime = DateTime(timezone=True)


class AdminUser(Base):
    __tablename__ = "admin_users"
    __table_args__ = (CheckConstraint(_in_check("role", AdminRole), name="role"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    # Persistent brute-force protection (survives API restarts, unlike the in-memory limiter).
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    locked_until: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    role: Mapped[str] = mapped_column(
        String(12), nullable=False, default=AdminRole.ADMIN.value, server_default=AdminRole.ADMIN.value
    )


class AdminSession(Base):
    __tablename__ = "admin_sessions"
    __table_args__ = (Index("ix_admin_sessions_expires_at", "expires_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Only SHA-256 hashes are stored; raw tokens live solely in the browser cookie.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    csrf_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped[AdminUser] = relationship(lazy="joined")


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint(_in_check("status", LeadStatus), name="status"),
        CheckConstraint(_in_check("service", ServiceKey), name="service"),
        CheckConstraint(_in_check("submitted_service", ServiceKey), name="submitted_service"),
        CheckConstraint(_in_check("inquiry_type", InquiryType), name="inquiry_type"),
        CheckConstraint(_in_check("platform", Platform, nullable=True), name="platform"),
        CheckConstraint(_in_check("budget_range", BudgetRange, nullable=True), name="budget_range"),
        CheckConstraint(_in_check("timeline", Timeline, nullable=True), name="timeline"),
        CheckConstraint(_in_check("locale", LeadLocale), name="locale"),
        Index("ix_leads_locale", "locale"),
        Index("ix_leads_created_at", "created_at"),
        Index("ix_leads_status", "status"),
        Index("ix_leads_updated_at", "updated_at"),
        Index("ix_leads_service", "service"),
        Index("ix_leads_inquiry_type", "inquiry_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # `service` is the current categorisation (admins may re-categorise);
    # `submitted_service` keeps what the visitor originally selected.
    service: Mapped[str] = mapped_column(String(32), nullable=False)
    submitted_service: Mapped[str] = mapped_column(String(32), nullable=False)
    inquiry_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default=InquiryType.CONTACT.value, server_default=text("'contact'")
    )
    platform: Mapped[str | None] = mapped_column(String(32), nullable=True)
    budget_range: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timeline: Mapped[str | None] = mapped_column(String(32), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    locale: Mapped[str] = mapped_column(
        String(2), nullable=False, default=LeadLocale.BG.value, server_default=text("'bg'")
    )
    # Validated service-specific details, e.g. {"kind": "ai_managed", ...} (see schemas.AiManagedDetails).
    service_details: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    company: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=LeadStatus.NEW.value)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="website_contact_form")
    privacy_acknowledged_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    privacy_notice_version: Mapped[str] = mapped_column(String(32), nullable=False)
    marketing_consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    marketing_consent_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    # Version of the marketing-consent wording the visitor agreed to (set only with consent).
    marketing_consent_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow, onupdate=utcnow)
    status_changed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)

    notes: Mapped[list[LeadNote]] = relationship(
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="LeadNote.created_at.desc()",
        passive_deletes=True,
    )

    @property
    def reference(self) -> str:
        return self.id.hex[:8].upper()


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)

    lead: Mapped[Lead] = relationship(back_populates="notes")
    author: Mapped[AdminUser | None] = relationship(lazy="joined")


class AuditLog(Base):
    """Append-only activity log. Never store raw personal data in `details`."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_actor_id", "actor_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    actor_label: Mapped[str] = mapped_column(String(254), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)


class AIActionRequest(Base):
    """A side-effecting action proposed by an AI agent, gated by the approval policy."""

    __tablename__ = "ai_action_requests"
    __table_args__ = (
        CheckConstraint(_in_check("status", AIActionStatus), name="status"),
        Index("ix_ai_action_requests_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=AIActionStatus.PENDING.value)
    summary: Mapped[str] = mapped_column(String(300), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    decision_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    decided_by: Mapped[AdminUser | None] = relationship(lazy="joined")


class AdvisorMode(enum.StrEnum):
    DEMO = "demo"
    AI = "ai"


class AdvisorAssessment(Base):
    """An anonymous automation assessment. No personal data is collected: the description is stored
    with e-mail addresses, phone numbers and links removed. Unlinked rows expire after
    ADVISOR_RETENTION_DAYS; a row linked to a lead is deleted together with that lead."""

    __tablename__ = "advisor_assessments"
    __table_args__ = (
        CheckConstraint(_in_check("mode", AdvisorMode), name="mode"),
        Index("ix_advisor_assessments_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    business_type: Mapped[str] = mapped_column(String(32), nullable=False)
    monthly_volume: Mapped[str] = mapped_column(String(16), nullable=False)
    team_size: Mapped[str] = mapped_column(String(16), nullable=False)
    tools: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    process_description: Mapped[str] = mapped_column(Text, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    mode: Mapped[str] = mapped_column(String(8), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    injection_suspected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # "1" for V1 requests and every row created before migration 0012; "2" with V2 insights.
    contract_version: Mapped[str] = mapped_column(String(4), nullable=False, default="1", server_default="1")
    insights: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True
    )
    linked_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)

    @property
    def reference(self) -> str:
        return self.id.hex[:8].upper()


class TeamConfiguration(Base):
    """A saved AI team configuration: enumerated values only (no free text, no personal data).

    Retrieved with a secret link token; only its SHA-256 hash is stored. Unlinked rows expire after
    TEAM_CONFIGURATION_RETENTION_DAYS; a row linked to a consultation lead is deleted with that lead.
    """

    __tablename__ = "team_configurations"
    __table_args__ = (
        CheckConstraint(_in_check("locale", LeadLocale), name="locale"),
        Index("ix_team_configurations_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    schema_version: Mapped[str] = mapped_column(String(8), nullable=False)
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    assumptions_version: Mapped[str] = mapped_column(String(32), nullable=False)
    locale: Mapped[str] = mapped_column(String(2), nullable=False, server_default="bg")
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    overrides: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True
    )

    @property
    def reference(self) -> str:
        return self.id.hex[:8].upper()


class AssessmentResultRecord(Base):
    """An opt-in saved assessment result (app/assessments). Holds the normalised answers (option
    keys, booleans and numbers — no free text, no personal data), the server-computed result and the
    definition version and algorithm it was scored with. Retrieved and deleted with a secret token;
    only its SHA-256 hash is stored. Rows expire after ASSESSMENT_RETENTION_DAYS and are removed by
    `python -m app.cli maintenance`.
    """

    __tablename__ = "assessment_results"
    __table_args__ = (
        CheckConstraint(_in_check("locale", LeadLocale), name="locale"),
        Index("ix_assessment_results_expires_at", "expires_at"),
        Index("ix_assessment_results_assessment_key", "assessment_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    assessment_key: Mapped[str] = mapped_column(String(48), nullable=False)
    definition_version: Mapped[str] = mapped_column(String(16), nullable=False)
    algorithm: Mapped[str] = mapped_column(String(32), nullable=False)
    locale: Mapped[str] = mapped_column(String(2), nullable=False, server_default="bg")
    fingerprint: Mapped[str] = mapped_column(String(16), nullable=False)
    answers: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    # Set only when the visitor explicitly asks for a consultation about this result (migration 0012).
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True
    )
    linked_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)

    @property
    def reference(self) -> str:
        return self.id.hex[:8].upper()


# --------------------------------------------------------------------------- AI operations (scaffold)
# Tenancy foundation for the future AI Operations Portal (docs/AI_OPERATIONS_PORTAL.md). It holds
# registry metadata only — no telemetry, no client credentials. Every tenant-owned row carries
# organization_id; access goes through app/ops/tenancy.py, which scopes each query by membership.


class OpsRole(enum.StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    OPERATOR = "operator"
    REVIEWER = "reviewer"
    VIEWER = "viewer"


class OpsOrganizationStatus(enum.StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class OpsEnvironment(enum.StrEnum):
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"


class OpsAgentStatus(enum.StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    PAUSED = "paused"
    RETIRED = "retired"


class OpsOrganization(Base):
    """A client organisation (tenant). `is_demo` marks sample data created by `ops-seed-demo`."""

    __tablename__ = "ops_organizations"
    __table_args__ = (CheckConstraint(_in_check("status", OpsOrganizationStatus), name="status"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="active")
    data_region: Mapped[str] = mapped_column(String(8), nullable=False, server_default="eu")
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsWorkspace(Base):
    """An environment or business unit inside an organisation."""

    __tablename__ = "ops_workspaces"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_ops_workspaces_org_slug"),
        # Target of the composite foreign key that keeps an agent inside its workspace's tenant.
        UniqueConstraint("id", "organization_id", name="uq_ops_workspaces_id_org"),
        CheckConstraint(_in_check("environment", OpsEnvironment), name="environment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("ops_organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    environment: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsMembership(Base):
    """Grants a user a role in one organisation. No membership — no access (not even to know it exists)."""

    __tablename__ = "ops_memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_ops_memberships_org_user"),
        CheckConstraint(_in_check("role", OpsRole), name="role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("ops_organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)

    user: Mapped[AdminUser] = relationship(lazy="joined")
    organization: Mapped[OpsOrganization] = relationship(lazy="joined")


class OpsAgent(Base):
    """Agent registry entry: deployment/version metadata entered by staff. No runs or telemetry yet."""

    __tablename__ = "ops_agents"
    __table_args__ = (
        # The workspace must belong to the same organisation (enforced by the database).
        ForeignKeyConstraint(
            ["workspace_id", "organization_id"],
            ["ops_workspaces.id", "ops_workspaces.organization_id"],
            ondelete="CASCADE",
            name="fk_ops_agents_workspace_org",
        ),
        UniqueConstraint("workspace_id", "key", name="uq_ops_agents_workspace_key"),
        CheckConstraint(_in_check("status", OpsAgentStatus), name="status"),
        Index("ix_ops_agents_workspace_id", "workspace_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("ops_organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    key: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(40), nullable=True)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    purpose: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow, onupdate=utcnow)


# --------------------------------------------------------------------------- service catalogue (V1)
# Bounded first slice of docs/DATABASE_SCHEMA_V2.md: domains, families, services, their translations,
# publishing status, ordering and relations. Content items, engagements, tools, slug history and
# releases follow in later migrations. Until the catalogue becomes the source (phase S5) the rows are
# a verified mirror of the web content, written only by `python -m app.cli catalogue-seed`.
# Leads keep `service` as a ServiceKey string: there is deliberately no foreign key between leads and
# the catalogue, so archiving catalogue rows can never touch a lead.


class CatalogueEntityType(enum.StrEnum):
    DOMAIN = "domain"
    FAMILY = "family"
    SERVICE = "service"


class PublishStatus(enum.StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class DeliveryStatus(enum.StrEnum):
    AVAILABLE = "available"
    CUSTOM = "custom"
    PLANNED = "planned"


class DomainBand(enum.StrEnum):
    AI = "ai"
    ENGINEERING = "engineering"
    OPERATIONS = "operations"


class OfferingType(enum.StrEnum):
    """Services carry a lead category; assessments and workshops are fixed-scope offerings that may
    carry a duration band. Managed offerings follow later (SCHEMA_V2 §3.4)."""

    SERVICE = "service"
    ASSESSMENT = "assessment"
    WORKSHOP = "workshop"


class ContentItemType(enum.StrEnum):
    CAPABILITY = "capability"
    DELIVERABLE = "deliverable"


class RouteNamespace(enum.StrEnum):
    """Domains and services share `/uslugi/<slug>` ↔ `/services/<slug>`."""

    SERVICES = "services"


class RelationKind(enum.StrEnum):
    RELATED = "related"
    CROSS_SELL = "cross_sell"
    DELIVERED_THROUGH = "delivered_through"


# (kind, from_type, to_type) combinations a relation may have.
RELATION_TYPES: tuple[tuple[RelationKind, CatalogueEntityType, CatalogueEntityType], ...] = (
    (RelationKind.RELATED, CatalogueEntityType.SERVICE, CatalogueEntityType.SERVICE),
    (RelationKind.CROSS_SELL, CatalogueEntityType.DOMAIN, CatalogueEntityType.DOMAIN),
    (RelationKind.DELIVERED_THROUGH, CatalogueEntityType.FAMILY, CatalogueEntityType.DOMAIN),
)

CATALOGUE_KEY_PATTERN = r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$"
SLUG_PATTERN = r"^[a-z0-9]+(-[a-z0-9]+)*$"
# Every ServiceKey except "other" is a lead category a catalogue service can map to.
LEAD_CATEGORIES: tuple[ServiceKey, ...] = tuple(k for k in ServiceKey if k is not ServiceKey.OTHER)

RELATION_TYPES_CHECK = " OR ".join(
    f"(kind = '{kind.value}' AND from_type = '{src.value}' AND to_type = '{dst.value}')"
    for kind, src, dst in RELATION_TYPES
)
LEAD_CATEGORY_CHECK = "lead_category IS NULL OR lead_category IN ({})".format(
    ", ".join(f"'{k.value}'" for k in LEAD_CATEGORIES)
)


def _subtype_fk(table: str) -> ForeignKeyConstraint:
    """A subtype row shares the id of its catalogue_entities row and must carry the same type."""
    return ForeignKeyConstraint(
        ["id", "entity_type"],
        ["catalogue_entities.id", "catalogue_entities.entity_type"],
        ondelete="CASCADE",
        name=f"fk_{table}_entity",
    )


class CatalogueEntity(Base):
    """Supertype of every catalogue object: stable key, publishing status, revision, authorship."""

    __tablename__ = "catalogue_entities"
    __table_args__ = (
        UniqueConstraint("entity_type", "key", name="uq_catalogue_entities_type_key"),
        # Target of the typed composite foreign keys (subtypes, relations).
        UniqueConstraint("id", "entity_type", name="uq_catalogue_entities_id_type"),
        CheckConstraint(_in_check("entity_type", CatalogueEntityType), name="entity_type"),
        CheckConstraint(_in_check("status", PublishStatus), name="status"),
        CheckConstraint(f"key ~ '{CATALOGUE_KEY_PATTERN}'", name="key_format"),
        CheckConstraint("revision >= 1", name="revision_positive"),
        CheckConstraint("(status = 'archived') = (archived_at IS NOT NULL)", name="archived_at"),
        # A published domain or service is served from its publication snapshot (families are part
        # of their domain's snapshot).
        CheckConstraint(
            "entity_type = 'family' OR status <> 'published' "
            "OR (published_snapshot IS NOT NULL AND published_revision IS NOT NULL)",
            name="published_snapshot",
        ),
        Index("ix_catalogue_entities_type_status", "entity_type", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(16), nullable=False)
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, server_default=PublishStatus.DRAFT.value)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    first_published_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    # Publication: the read model the public API serves. Edits change the working rows and the
    # revision; they reach the public API only when the entity is published again.
    published_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    published_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    # none_as_null: Python None must be SQL NULL (not JSON null), or the snapshot CHECK could be bypassed.
    published_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB(none_as_null=True), nullable=True)


class CatalogueDomain(Base):
    __tablename__ = "service_domains"
    __table_args__ = (
        _subtype_fk("service_domains"),
        UniqueConstraint("code", name="uq_service_domains_code"),
        UniqueConstraint(
            "band", "position", name="uq_service_domains_band_position", deferrable=True, initially="DEFERRED"
        ),
        CheckConstraint("entity_type = 'domain'", name="entity_type"),
        CheckConstraint("code ~ '^[A-Z]$'", name="code_format"),
        CheckConstraint(_in_check("band", DomainBand), name="band"),
        CheckConstraint("position >= 0", name="position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    entity_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default=CatalogueEntityType.DOMAIN.value, server_default="domain"
    )
    code: Mapped[str] = mapped_column(String(1), nullable=False)
    band: Mapped[str] = mapped_column(String(16), nullable=False)
    icon: Mapped[str] = mapped_column(String(32), nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # Nullable only to break the insert cycle with services.primary_domain_id; required once published.
    contact_service_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("services.id", ondelete="RESTRICT", use_alter=True), nullable=True
    )


class CatalogueFamily(Base):
    __tablename__ = "service_families"
    __table_args__ = (
        _subtype_fk("service_families"),
        UniqueConstraint(
            "domain_id", "position", name="uq_service_families_domain_position", deferrable=True, initially="DEFERRED"
        ),
        CheckConstraint("entity_type = 'family'", name="entity_type"),
        CheckConstraint(_in_check("delivery_status", DeliveryStatus), name="delivery_status"),
        CheckConstraint("position >= 0", name="position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    entity_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default=CatalogueEntityType.FAMILY.value, server_default="family"
    )
    domain_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("service_domains.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    delivery_status: Mapped[str] = mapped_column(String(12), nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class CatalogueService(Base):
    """A service in the catalogue (named so to avoid confusion with the app.services package)."""

    __tablename__ = "services"
    __table_args__ = (
        _subtype_fk("services"),
        UniqueConstraint("lead_category", name="uq_services_lead_category"),
        CheckConstraint("entity_type = 'service'", name="entity_type"),
        CheckConstraint(_in_check("offering_type", OfferingType), name="offering_type"),
        CheckConstraint(_in_check("delivery_status", DeliveryStatus), name="delivery_status"),
        CheckConstraint(LEAD_CATEGORY_CHECK, name="lead_category"),
        CheckConstraint(
            "offering_type <> 'service' OR (primary_domain_id IS NOT NULL AND lead_category IS NOT NULL)",
            name="service_requirements",
        ),
        CheckConstraint(
            "(duration_min_days IS NULL AND duration_max_days IS NULL) OR "
            "(offering_type IN ('assessment', 'workshop') AND duration_min_days > 0 "
            "AND duration_max_days >= duration_min_days)",
            name="duration",
        ),
        CheckConstraint("position >= 0", name="position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    entity_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default=CatalogueEntityType.SERVICE.value, server_default="service"
    )
    offering_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=OfferingType.SERVICE.value, server_default="service"
    )
    primary_domain_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("service_domains.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    delivery_status: Mapped[str] = mapped_column(String(12), nullable=False)
    # The lead category (ServiceKey) this service maps to. Not a foreign key: leads stay independent.
    lead_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(32), nullable=True)
    custom_page: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    is_entry_offer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # Assessments and workshops only: an indicative duration band in working days (no prices).
    duration_min_days: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    duration_max_days: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)


class FamilyService(Base):
    """An existing service that implements a family (N:M)."""

    __tablename__ = "family_services"
    __table_args__ = (
        UniqueConstraint(
            "family_id", "position", name="uq_family_services_family_position", deferrable=True, initially="DEFERRED"
        ),
        CheckConstraint("position >= 0", name="position"),
    )

    family_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("service_families.id", ondelete="CASCADE"), primary_key=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("services.id", ondelete="RESTRICT"), primary_key=True, index=True
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class EntityTranslation(Base):
    """Localized texts, slug and SEO of one entity in one locale. No text fallback between locales."""

    __tablename__ = "entity_translations"
    __table_args__ = (
        CheckConstraint(_in_check("locale", LeadLocale), name="locale"),
        CheckConstraint(_in_check("route_namespace", RouteNamespace, nullable=True), name="route_namespace"),
        CheckConstraint("(route_namespace IS NULL) = (slug IS NULL)", name="slug_namespace"),
        CheckConstraint(f"slug IS NULL OR slug ~ '{SLUG_PATTERN}'", name="slug_format"),
        CheckConstraint("body IS NULL OR char_length(body) <= 2000", name="body_length"),
        # Domains and services share one URL namespace per locale.
        Index(
            "uq_entity_translations_route",
            "locale",
            "route_namespace",
            "slug",
            unique=True,
            postgresql_where=text("slug IS NOT NULL"),
        ),
        Index(
            "uq_entity_translations_primary_keyword",
            "locale",
            text("lower(primary_keyword)"),
            unique=True,
            postgresql_where=text("primary_keyword IS NOT NULL"),
        ),
    )

    entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("catalogue_entities.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str] = mapped_column(String(2), primary_key=True)
    route_namespace: Mapped[str | None] = mapped_column(String(16), nullable=True)
    slug: Mapped[str | None] = mapped_column(String(80), nullable=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    summary: Mapped[str | None] = mapped_column(String(300), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    cta_label: Mapped[str | None] = mapped_column(String(80), nullable=True)
    prerequisite: Mapped[str | None] = mapped_column(String(400), nullable=True)
    seo_title: Mapped[str | None] = mapped_column(String(70), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(175), nullable=True)
    primary_keyword: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class EntityRelation(Base):
    """Typed, ordered edge between two entities. The composite foreign keys make the stored types
    provably those of the referenced rows, so the allowed-combination CHECK is sound."""

    __tablename__ = "entity_relations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["from_entity_id", "from_type"],
            ["catalogue_entities.id", "catalogue_entities.entity_type"],
            ondelete="CASCADE",
            name="fk_entity_relations_from",
        ),
        ForeignKeyConstraint(
            ["to_entity_id", "to_type"],
            ["catalogue_entities.id", "catalogue_entities.entity_type"],
            ondelete="RESTRICT",
            name="fk_entity_relations_to",
        ),
        UniqueConstraint(
            "from_entity_id",
            "kind",
            "position",
            name="uq_entity_relations_from_kind_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(_in_check("kind", RelationKind), name="kind"),
        CheckConstraint(RELATION_TYPES_CHECK, name="kind_types"),
        CheckConstraint("from_entity_id <> to_entity_id", name="not_self"),
        CheckConstraint("position >= 0", name="position"),
        Index("ix_entity_relations_to", "to_entity_id", "kind"),
    )

    from_entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    from_type: Mapped[str] = mapped_column(String(16), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), primary_key=True)
    to_entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    to_type: Mapped[str] = mapped_column(String(16), nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class ContentItem(Base):
    """An ordered list entry of a domain or service (capability, deliverable). Texts per locale in
    content_item_translations; the same item exists in every locale, so BG and EN lists stay aligned."""

    __tablename__ = "content_items"
    __table_args__ = (
        UniqueConstraint(
            "entity_id",
            "item_type",
            "position",
            name="uq_content_items_entity_type_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(_in_check("item_type", ContentItemType), name="item_type"),
        CheckConstraint("position >= 0", name="position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("catalogue_entities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_type: Mapped[str] = mapped_column(String(20), nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class ContentItemTranslation(Base):
    __tablename__ = "content_item_translations"
    __table_args__ = (
        CheckConstraint(_in_check("locale", LeadLocale), name="locale"),
        CheckConstraint("title IS NOT NULL OR body IS NOT NULL", name="not_empty"),
        CheckConstraint("body IS NULL OR char_length(body) <= 1000", name="body_length"),
    )

    item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("content_items.id", ondelete="CASCADE"), primary_key=True
    )
    locale: Mapped[str] = mapped_column(String(2), primary_key=True)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
