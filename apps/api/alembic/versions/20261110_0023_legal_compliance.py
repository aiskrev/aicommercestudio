"""Legal evidence and workflows: consent history, withdrawal requests, data requests.

Additive; nothing is dropped or rewritten. New tables: legal_events (versioned acknowledgement, acceptance and consent
history), withdrawal_requests, data_requests. New nullable columns: leads.marketing_consent_withdrawn_at,
customer_accounts.erased_at, outbox_messages.reference, billing_checkouts.completed_at. The API role can read and add
history and decide requests; it cannot change or delete a legal event (rows are removed only by the database together
with the lead or account they belong to). No IP address or user agent is stored.

Revision ID: 0023
Revises: 0022
Create Date: 2026-11-10
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column("leads", sa.Column("marketing_consent_withdrawn_at", TS))
    op.add_column("customer_accounts", sa.Column("erased_at", TS))
    op.add_column("outbox_messages", sa.Column("reference", sa.String(24)))
    op.add_column("billing_checkouts", sa.Column("completed_at", TS))

    op.create_table(
        "withdrawal_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("reference", sa.String(24), nullable=False, unique=True),
        sa.Column(
            "workspace_id", sa.Uuid(), sa.ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("subject_kind", sa.String(12), nullable=False),
        sa.Column("subject_ref", sa.String(100), nullable=False),
        sa.Column("offer_key", sa.String(40), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("customer_kind", sa.String(10), nullable=False),
        sa.Column("early_start_requested", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("contract_concluded_at", TS),
        sa.Column("period_ends_at", TS),
        sa.Column("eligibility", sa.String(24), nullable=False),
        sa.Column("status", sa.String(14), nullable=False, server_default=sa.text("'received'")),
        sa.Column("outcome_note", sa.String(500)),
        sa.Column("refund_reference", sa.String(100)),
        sa.Column("refund_amount_minor", sa.BigInteger()),
        sa.Column("confirmation_queued_at", TS),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("decided_at", TS),
        sa.Column("decided_by", sa.String(120)),
        sa.CheckConstraint("status IN ('received', 'refund_review', 'refunded', 'closed')", name="status"),
        sa.CheckConstraint("customer_kind IN ('consumer', 'business')", name="customer_kind"),
        sa.CheckConstraint(
            "eligibility IN ('within_period', 'period_expired', 'business_customer', 'unknown_contract_date')",
            name="eligibility",
        ),
    )
    op.create_index("ix_withdrawal_requests_workspace", "withdrawal_requests", ["workspace_id", "status"])
    op.create_index(
        "uq_withdrawal_requests_open",
        "withdrawal_requests",
        ["workspace_id", "subject_ref"],
        unique=True,
        postgresql_where=sa.text("status IN ('received', 'refund_review')"),
    )

    op.create_table(
        "legal_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE")),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="CASCADE")),
        sa.Column("checkout_id", sa.Uuid(), sa.ForeignKey("billing_checkouts.id", ondelete="RESTRICT")),
        sa.Column("withdrawal_id", sa.Uuid(), sa.ForeignKey("withdrawal_requests.id", ondelete="RESTRICT")),
        sa.Column("document", sa.String(24), nullable=False),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column("locale", sa.String(2)),
        sa.Column("action", sa.String(14), nullable=False),
        sa.Column("source", sa.String(24)),
        sa.CheckConstraint(
            "action IN ('acknowledged', 'accepted', 'consented', 'withdrawn', 'requested')", name="action"
        ),
        sa.CheckConstraint(
            "(lead_id IS NOT NULL)::int + (account_id IS NOT NULL)::int + (checkout_id IS NOT NULL)::int "
            "+ (withdrawal_id IS NOT NULL)::int = 1",
            name="one_subject",
        ),
    )
    op.create_index("ix_legal_events_lead", "legal_events", ["lead_id"])
    op.create_index("ix_legal_events_account", "legal_events", ["account_id"])
    op.create_index("ix_legal_events_checkout", "legal_events", ["checkout_id"])

    op.create_table(
        "data_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("reference", sa.String(24), nullable=False, unique=True),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("message", sa.String(1000)),
        sa.Column("status", sa.String(10), nullable=False, server_default=sa.text("'open'")),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("handled_at", TS),
        sa.Column("handled_by", sa.String(120)),
        sa.Column("outcome_note", sa.String(500)),
        sa.CheckConstraint("kind IN ('export', 'deletion', 'correction', 'restriction', 'objection')", name="kind"),
        sa.CheckConstraint("status IN ('open', 'done', 'rejected')", name="status"),
    )
    op.create_index("ix_data_requests_status", "data_requests", ["status", "created_at"])
    op.create_index(
        "uq_data_requests_open",
        "data_requests",
        ["account_id", "kind"],
        unique=True,
        postgresql_where=sa.text("status = 'open' AND account_id IS NOT NULL"),
    )

    for table in ("legal_events", "withdrawal_requests", "data_requests"):
        op.execute(f"REVOKE ALL ON {table} FROM {RUNTIME}")
    op.execute(f"GRANT SELECT, INSERT ON legal_events TO {API}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON withdrawal_requests, data_requests TO {API}")


def downgrade() -> None:
    op.drop_table("data_requests")
    op.drop_table("legal_events")
    op.drop_table("withdrawal_requests")
    op.drop_column("billing_checkouts", "completed_at")
    op.drop_column("outbox_messages", "reference")
    op.drop_column("customer_accounts", "erased_at")
    op.drop_column("leads", "marketing_consent_withdrawn_at")
