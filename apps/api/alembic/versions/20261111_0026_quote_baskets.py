"""Quote baskets: server-side drafts of a request for a written quote (commercial expansion, Phase 06).

Additive: one new table, `quote_baskets`. It holds inputs only (enumerated configurator answers and keys of published
offers), the SHA-256 of the holder's secret token, a version counter for concurrent edits and an expiry. No amount and
no contact detail is stored. The API role may read, add, change and delete rows (the maintenance job deletes expired
ones); the runtime role has no access.

Revision ID: 0026
Revises: 0025
Create Date: 2026-11-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "quote_baskets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default=sa.text("'open'")),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("items", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("submitted_at", TS),
        sa.CheckConstraint("status IN ('open', 'submitted')", name="status"),
        sa.CheckConstraint("locale IN ('bg', 'en')", name="locale"),
        sa.CheckConstraint("version >= 1", name="version"),
    )
    op.create_index("ix_quote_baskets_expires", "quote_baskets", ["expires_at"])
    op.execute(f"REVOKE ALL ON quote_baskets FROM {RUNTIME}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON quote_baskets TO {API}")


def downgrade() -> None:
    op.drop_index("ix_quote_baskets_expires", table_name="quote_baskets")
    op.drop_table("quote_baskets")
