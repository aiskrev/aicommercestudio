"""Stripe billing in test mode: offers, customers, checkouts, subscriptions, purchases, events.

Additive. No offer is seeded, so nothing is on sale until one is added and approved.

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)
READ_ONLY = ("billing_offers", "billing_scope_confirmations")
READ_WRITE = (
    "billing_customers",
    "billing_checkouts",
    "billing_subscriptions",
    "billing_purchases",
    "billing_incidents",
    "billing_events",
)
TABLES = (*READ_ONLY, *READ_WRITE)


def _workspace(nullable: bool = False) -> sa.Column:
    return sa.Column(
        "workspace_id", sa.Uuid(), sa.ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), nullable=nullable
    )


def _offer() -> sa.Column:
    return sa.Column(
        "offer_key", sa.String(40), sa.ForeignKey("billing_offers.key", ondelete="RESTRICT"), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "billing_offers",
        sa.Column("key", sa.String(40), primary_key=True),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("plan_key", sa.String(20)),
        sa.Column("billing_interval", sa.String(8)),
        sa.Column("stripe_price_id", sa.String(64), nullable=False, unique=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("requires_scope", sa.Boolean(), nullable=False),
        sa.Column("approved_at", TS),
        sa.CheckConstraint("kind IN ('one_time', 'subscription')", name="kind"),
        sa.CheckConstraint(
            "(kind = 'subscription' AND plan_key IS NOT NULL AND billing_interval IN ('month', 'year')) "
            "OR (kind = 'one_time' AND billing_interval IS NULL)",
            name="shape",
        ),
    )
    op.create_table(
        "billing_customers",
        sa.Column(
            "workspace_id", sa.Uuid(), sa.ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), primary_key=True
        ),
        sa.Column("stripe_customer_id", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "billing_owner_account_id",
            sa.Uuid(),
            sa.ForeignKey("customer_accounts.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_table(
        "billing_scope_confirmations",
        sa.Column(
            "workspace_id", sa.Uuid(), sa.ForeignKey("customer_workspaces.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "offer_key", sa.String(40), sa.ForeignKey("billing_offers.key", ondelete="RESTRICT"), primary_key=True
        ),
        sa.Column("confirmed_by", sa.String(120), nullable=False),
        sa.Column("confirmed_at", TS, nullable=False),
    )
    op.create_table(
        "billing_checkouts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _workspace(),
        _offer(),
        sa.Column("stripe_session_id", sa.String(100), unique=True),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_index("ix_billing_checkouts_workspace", "billing_checkouts", ["workspace_id", "status"])
    op.create_table(
        "billing_subscriptions",
        sa.Column("stripe_subscription_id", sa.String(64), primary_key=True),
        _workspace(),
        _offer(),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False),
        sa.Column("current_period_end", TS),
        sa.Column("action_required", sa.Boolean(), nullable=False),
        sa.Column("past_due_since", TS),
        sa.Column("onboarding_status", sa.String(14), nullable=False),
        sa.Column("synced_at", TS, nullable=False),
    )
    op.create_index("ix_billing_subscriptions_workspace", "billing_subscriptions", ["workspace_id"])
    op.create_table(
        "billing_purchases",
        sa.Column("stripe_session_id", sa.String(100), primary_key=True),
        _workspace(),
        _offer(),
        sa.Column("payment_intent_id", sa.String(64), unique=True),
        sa.Column("payment_status", sa.String(20), nullable=False),
        sa.Column("access_active", sa.Boolean(), nullable=False),
        sa.Column("onboarding_status", sa.String(14), nullable=False),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_index("ix_billing_purchases_workspace", "billing_purchases", ["workspace_id"])
    op.create_table(
        "billing_incidents",
        sa.Column("stripe_object_id", sa.String(64), primary_key=True),
        _workspace(nullable=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("payment_intent_id", sa.String(64)),
        sa.Column("updated_at", TS, nullable=False),
    )
    op.create_table(
        "billing_events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("type", sa.String(60), nullable=False),
        sa.Column("object_id", sa.String(100), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default=sa.text("'received'")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("next_attempt_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("last_error", sa.String(60)),
        sa.Column("received_at", TS, nullable=False),
        sa.Column("processed_at", TS),
    )
    op.create_index("ix_billing_events_due", "billing_events", ["status", "next_attempt_at"])
    op.execute(f"REVOKE ALL ON {', '.join(TABLES)} FROM {RUNTIME}")
    op.execute(f"GRANT SELECT ON {', '.join(READ_ONLY)} TO {API}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON {', '.join(READ_WRITE)} TO {API}")


def downgrade() -> None:
    for table in ("billing_events", "billing_incidents", "billing_purchases", "billing_subscriptions"):
        op.drop_table(table)
    for table in ("billing_checkouts", "billing_scope_confirmations", "billing_customers", "billing_offers"):
        op.drop_table(table)
