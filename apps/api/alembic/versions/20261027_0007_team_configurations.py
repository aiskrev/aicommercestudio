"""AI team configurator: saved configurations with expiry and optional lead link.

* team_configurations: enumerated configuration (JSONB), versions of the request schema, the team
  model and the cost assumptions, visitor rate overrides, SHA-256 hash of the secret link token,
  expiry, optional lead (ON DELETE CASCADE).

Backward compatible: a new table only; no existing row is changed. Downgrade drops the table (saved
links stop working; leads keep their summary in leads.service_details).

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "team_configurations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=True),
        sa.Column("schema_version", sa.String(8), nullable=False),
        sa.Column("model_version", sa.String(32), nullable=False),
        sa.Column("assumptions_version", sa.String(32), nullable=False),
        sa.Column("locale", sa.String(2), server_default="bg", nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("overrides", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint("locale IN ('bg', 'en')", name="ck_team_configurations_locale"),
        sa.ForeignKeyConstraint(
            ["lead_id"], ["leads.id"], name="fk_team_configurations_lead_id_leads", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_team_configurations"),
        sa.UniqueConstraint("token_hash", name="uq_team_configurations_token_hash"),
    )
    op.create_index("ix_team_configurations_expires_at", "team_configurations", ["expires_at"])
    op.create_index("ix_team_configurations_lead_id", "team_configurations", ["lead_id"])


def downgrade() -> None:
    op.drop_table("team_configurations")
