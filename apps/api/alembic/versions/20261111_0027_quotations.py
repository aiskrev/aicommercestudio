"""Customer-facing quotations (commercial expansion, Phase 07).

Additive: one new table, `quotations`. A row points at one approved, immutable proposal version and holds the hash of
the client's secret link, an optional validity date, view marks and the client's answer. The API role may read, add
and change rows; it cannot delete them (they go with their lead). The runtime role has no access.

Revision ID: 0027
Revises: 0026
Create Date: 2026-11-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "quotations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("proposal_id", sa.Uuid(), sa.ForeignKey("lead_proposals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default=sa.text("'published'")),
        sa.Column("valid_until", sa.Date()),
        sa.Column("published_by_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("published_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("first_viewed_at", TS),
        sa.Column("last_viewed_at", TS),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("decided_at", TS),
        sa.Column("decision_name", sa.String(120)),
        sa.Column("decision_note", sa.String(1000)),
        sa.Column("decision_ip_hash", sa.String(64)),
        sa.Column("withdrawn_at", TS),
        sa.Column("withdrawn_by_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("withdrawal_note", sa.String(500)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.CheckConstraint("status IN ('published', 'accepted', 'declined', 'withdrawn')", name="status"),
        sa.CheckConstraint("locale IN ('bg', 'en')", name="locale"),
        sa.CheckConstraint("version_number >= 1", name="version_number"),
        sa.CheckConstraint("revision >= 1", name="revision"),
        sa.CheckConstraint(
            "(status IN ('accepted', 'declined')) = (decided_at IS NOT NULL AND decision_name IS NOT NULL)",
            name="decision",
        ),
        sa.CheckConstraint("(status = 'withdrawn') = (withdrawn_at IS NOT NULL)", name="withdrawal"),
    )
    op.create_index(
        "uq_quotations_live",
        "quotations",
        ["proposal_id"],
        unique=True,
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index("ix_quotations_lead", "quotations", ["lead_id"])
    op.execute(f"REVOKE ALL ON quotations FROM {RUNTIME}")
    op.execute(f"REVOKE ALL ON quotations FROM {API}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON quotations TO {API}")


def downgrade() -> None:
    op.drop_index("ix_quotations_lead", table_name="quotations")
    op.drop_index("uq_quotations_live", table_name="quotations")
    op.drop_table("quotations")
