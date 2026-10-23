"""ORM models. The Alembic migration in alembic/versions mirrors these exactly
(verified by tests/test_migrations.py via `alembic check`)."""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
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
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True
    )
    linked_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)

    @property
    def reference(self) -> str:
        return self.id.hex[:8].upper()
