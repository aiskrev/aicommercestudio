"""Advisor Workspace tables: products and versioned plans, entitlements, usage, projects and versions.

Commercial data never reaches the assessment engine, and no plan has an "unlimited" value: a limit
column is always a number. `plan_prices` starts empty and only rows with `approved_at` are ever shown.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import utcnow

TS = DateTime(timezone=True)


class ResultKind(enum.StrEnum):
    TEMPLATE = "template"
    AI_MODEL = "ai_model"


class ReservationStatus(enum.StrEnum):
    RESERVED = "reserved"
    COMMITTED = "committed"
    RELEASED = "released"
    EXPIRED = "expired"


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)


class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = (UniqueConstraint("product_id", "key", name="uq_plans_product_key"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    key: Mapped[str] = mapped_column(String(20), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class PlanVersion(Base):
    """Immutable once it exists: a change is a new version, so a grant keeps what was agreed."""

    __tablename__ = "plan_versions"
    __table_args__ = (UniqueConstraint("plan_id", "version", name="uq_plan_versions_plan_version"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class PlanFeature(Base):
    __tablename__ = "plan_features"
    __table_args__ = (
        CheckConstraint("limit_value IS NULL OR limit_value >= 0", name="limit_not_negative"),
        CheckConstraint("feature NOT LIKE 'limit_%' OR limit_value IS NOT NULL", name="limit_has_a_value"),
    )

    plan_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("plan_versions.id", ondelete="RESTRICT"), primary_key=True
    )
    feature: Mapped[str] = mapped_column(String(40), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    limit_value: Mapped[int | None] = mapped_column(BigInteger)


class PlanPrice(Base):
    """Empty until the owner confirms a price. Rows without `approved_at` are never shown."""

    __tablename__ = "plan_prices"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    plan_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("plan_versions.id", ondelete="RESTRICT"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    billing_interval: Mapped[str] = mapped_column(String(12), nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(TS)


class CustomerWorkspace(Base):
    """One personal workspace per account for now; members and invitations are a later stage."""

    __tablename__ = "customer_workspaces"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class EntitlementGrant(Base):
    __tablename__ = "entitlement_grants"
    __table_args__ = (
        Index(
            "uq_entitlement_grants_active",
            "workspace_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="CASCADE"), nullable=False
    )
    plan_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("plan_versions.id", ondelete="RESTRICT"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(TS)


class UsageCounter(Base):
    """`used + reserved` never passes the limit: the only write is one conditional UPDATE."""

    __tablename__ = "usage_counters"
    __table_args__ = (CheckConstraint("used >= 0 AND reserved >= 0", name="not_negative"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    metric: Mapped[str] = mapped_column(String(40), primary_key=True)
    period_start: Mapped[date] = mapped_column(Date, primary_key=True)
    used: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default=text("0"))
    reserved: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default=text("0"))


class UsageReservation(Base):
    __tablename__ = "usage_reservations"
    __table_args__ = (
        UniqueConstraint("workspace_id", "idempotency_key", name="uq_usage_reservations_key"),
        Index("ix_usage_reservations_open", "status", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="CASCADE"), nullable=False
    )
    idempotency_key: Mapped[str] = mapped_column(String(100), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    outcome: Mapped[str | None] = mapped_column(String(24))
    version_id: Mapped[uuid.UUID | None] = mapped_column()
    expires_at: Mapped[datetime] = mapped_column(TS, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(TS)


class UsageEvent(Base):
    """Append-only record of what was consumed. The API role cannot change or delete rows."""

    __tablename__ = "usage_events"
    __table_args__ = (Index("ix_usage_events_workspace", "workspace_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    reservation_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, nullable=False)
    metric: Mapped[str] = mapped_column(String(40), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    outcome: Mapped[str] = mapped_column(String(24), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class WorkspaceProject(Base):
    __tablename__ = "workspace_projects"
    __table_args__ = (Index("ix_workspace_projects_workspace", "workspace_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow, onupdate=utcnow)


class AssessmentVersion(Base):
    """One saved assessment. Never edited: a follow-up or a variant is a new version."""

    __tablename__ = "assessment_versions"
    __table_args__ = (
        UniqueConstraint("project_id", "number", name="uq_assessment_versions_number"),
        CheckConstraint("result_kind IN ('template', 'ai_model')", name="result_kind"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspace_projects.id", ondelete="CASCADE"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_number: Mapped[int | None] = mapped_column(Integer)
    label: Mapped[str | None] = mapped_column(String(80))
    clarification: Mapped[str | None] = mapped_column(Text)
    inputs: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    insights: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    notices: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    disclaimer: Mapped[str] = mapped_column(Text, nullable=False)
    result_kind: Mapped[str] = mapped_column(String(10), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
