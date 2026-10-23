"""AI Business Automation Advisor: anonymous assessments with expiry and optional lead link.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "advisor_assessments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("business_type", sa.String(32), nullable=False),
        sa.Column("monthly_volume", sa.String(16), nullable=False),
        sa.Column("team_size", sa.String(16), nullable=False),
        sa.Column("tools", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("process_description", sa.Text(), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("mode", sa.String(8), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("prompt_version", sa.String(32), nullable=False),
        sa.Column("injection_suspected", sa.Boolean(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("mode IN ('demo', 'ai')", name="ck_advisor_assessments_mode"),
        sa.ForeignKeyConstraint(
            ["lead_id"], ["leads.id"], name="fk_advisor_assessments_lead_id_leads", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_advisor_assessments"),
    )
    op.create_index("ix_advisor_assessments_expires_at", "advisor_assessments", ["expires_at"])
    op.create_index("ix_advisor_assessments_lead_id", "advisor_assessments", ["lead_id"])


def downgrade() -> None:
    op.drop_table("advisor_assessments")
