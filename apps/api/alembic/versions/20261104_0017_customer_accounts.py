"""Customer accounts, one-time tokens, e-mail outbox and shared rate limits.

Additive: new tables only, nothing existing changes. No foreign key points at staff, operations or
portal tables, so an account has no path to them. The Ops runtime role gets no privilege here: the
default privileges from 0013 would otherwise grant them.

Revision ID: 0017
Revises: 0016
Create Date: 2026-11-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE = "acs_app_runtime"
TABLES = ("customer_accounts", "customer_sessions", "customer_tokens", "outbox_messages", "rate_limit_buckets")
TS = sa.DateTime(timezone=True)


def _if_role(sql: str) -> str:
    # Fixed identifiers only.
    return f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{ROLE}') THEN {sql} END IF; END $$;"  # noqa: S608


def upgrade() -> None:
    op.create_table(
        "customer_accounts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(120)),
        sa.Column("locale", sa.String(2), nullable=False, server_default=sa.text("'bg'")),
        sa.Column("email_verified_at", TS),
        sa.Column("privacy_notice_version", sa.String(32), nullable=False),
        sa.Column("privacy_acknowledged_at", TS, nullable=False),
        sa.Column("marketing_consent_version", sa.String(32)),
        sa.Column("marketing_consent_at", TS),
        sa.Column("failed_logins", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("locked_until", TS),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
    )
    op.create_table(
        "customer_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("user_agent", sa.String(160)),
        sa.Column("ip_hash", sa.String(64)),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("last_seen_at", TS, nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("revoked_at", TS),
    )
    op.create_index("ix_customer_sessions_account", "customer_sessions", ["account_id"])
    op.create_table(
        "customer_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.String(24), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("used_at", TS),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_index("ix_customer_tokens_account_purpose", "customer_tokens", ["account_id", "purpose"])
    op.create_table(
        "outbox_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("next_attempt_at", TS, nullable=False),
        sa.Column("last_error", sa.String(60)),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("sent_at", TS),
    )
    op.create_index("ix_outbox_due", "outbox_messages", ["status", "next_attempt_at"])
    op.create_table(
        "rate_limit_buckets",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("window_start", TS, nullable=False),
        sa.Column("hits", sa.Integer(), nullable=False),
    )
    for table in TABLES:
        op.execute(_if_role(f"REVOKE ALL ON {table} FROM {ROLE};"))


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_table(table)
