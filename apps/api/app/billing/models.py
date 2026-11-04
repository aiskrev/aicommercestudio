"""Stripe billing tables. No card data exists here, and events keep no payload: state comes from Stripe.

`billing_offers` is the server's price list. A browser names an offer key; the Stripe price, amount,
currency and interval are read here and checked against Stripe. An offer is sold only when `approved_at`
is set, so nothing is on sale by default. Payment state and service onboarding are separate columns.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import utcnow

TS = DateTime(timezone=True)


class OfferKind(enum.StrEnum):
    ONE_TIME = "one_time"
    SUBSCRIPTION = "subscription"


class EventStatus(enum.StrEnum):
    RECEIVED = "received"
    PROCESSED = "processed"
    FAILED = "failed"


class Onboarding(enum.StrEnum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"


class BillingOffer(Base):
    __tablename__ = "billing_offers"
    __table_args__ = (
        CheckConstraint("kind IN ('one_time', 'subscription')", name="kind"),
        CheckConstraint(
            "(kind = 'subscription' AND plan_key IS NOT NULL AND billing_interval IN ('month', 'year')) "
            "OR (kind = 'one_time' AND billing_interval IS NULL)",
            name="shape",
        ),
    )

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    plan_key: Mapped[str | None] = mapped_column(String(20))
    billing_interval: Mapped[str | None] = mapped_column(String(8))
    stripe_price_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # Individual support: no payment until the technical intake is done and the scope is confirmed.
    requires_scope: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approved_at: Mapped[datetime | None] = mapped_column(TS)


class BillingCustomer(Base):
    """One Stripe customer per workspace, found by this link and never by e-mail."""

    __tablename__ = "billing_customers"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), primary_key=True
    )
    stripe_customer_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    billing_owner_account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_accounts.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class ScopeConfirmation(Base):
    """Staff record that the intake is done and the scope agreed, which opens payment for that offer."""

    __tablename__ = "billing_scope_confirmations"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    offer_key: Mapped[str] = mapped_column(ForeignKey("billing_offers.key", ondelete="RESTRICT"), primary_key=True)
    confirmed_by: Mapped[str] = mapped_column(String(120), nullable=False)
    confirmed_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class BillingCheckout(Base):
    __tablename__ = "billing_checkouts"
    __table_args__ = (Index("ix_billing_checkouts_workspace", "workspace_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), nullable=False
    )
    offer_key: Mapped[str] = mapped_column(ForeignKey("billing_offers.key", ondelete="RESTRICT"), nullable=False)
    stripe_session_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class BillingSubscription(Base):
    """The latest state read from Stripe. Events only say when to read it again."""

    __tablename__ = "billing_subscriptions"
    __table_args__ = (Index("ix_billing_subscriptions_workspace", "workspace_id"),)

    stripe_subscription_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), nullable=False
    )
    offer_key: Mapped[str] = mapped_column(ForeignKey("billing_offers.key", ondelete="RESTRICT"), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    current_period_end: Mapped[datetime | None] = mapped_column(TS)
    action_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    past_due_since: Mapped[datetime | None] = mapped_column(TS)
    onboarding_status: Mapped[str] = mapped_column(String(14), nullable=False, default=Onboarding.NOT_REQUIRED.value)
    synced_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class BillingPurchase(Base):
    """A one-time purchase. `payment_status` and `onboarding_status` never change each other."""

    __tablename__ = "billing_purchases"
    __table_args__ = (Index("ix_billing_purchases_workspace", "workspace_id"),)

    stripe_session_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), nullable=False
    )
    offer_key: Mapped[str] = mapped_column(ForeignKey("billing_offers.key", ondelete="RESTRICT"), nullable=False)
    payment_intent_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False)
    access_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    onboarding_status: Mapped[str] = mapped_column(String(14), nullable=False, default=Onboarding.NOT_REQUIRED.value)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class BillingIncident(Base):
    """Refunds and disputes, for staff to review. Neither deletes any customer data."""

    __tablename__ = "billing_incidents"

    stripe_object_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_workspaces.id", ondelete="RESTRICT"))
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    payment_intent_id: Mapped[str | None] = mapped_column(String(64))
    updated_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow, onupdate=utcnow)


class BillingEvent(Base):
    """Delivered events, by Stripe's id: a duplicate delivery is one row. The payload is not kept."""

    __tablename__ = "billing_events"
    __table_args__ = (Index("ix_billing_events_due", "status", "next_attempt_at"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(60), nullable=False)
    object_id: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=EventStatus.RECEIVED.value)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    last_error: Mapped[str | None] = mapped_column(String(60))
    received_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    processed_at: Mapped[datetime | None] = mapped_column(TS)
