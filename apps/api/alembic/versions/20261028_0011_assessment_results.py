"""Assessment engine: opt-in saved results.

* assessment_results: assessment key, definition version and scoring algorithm, locale, the
  normalised answers and the server-computed result (JSONB, no free text, no personal data), a
  non-personal fingerprint, SHA-256 hash of the secret link token and the expiry.

Backward compatible: a new table only; no existing row is changed. Downgrade drops the table (saved
result links stop working; nothing else depends on it).

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-28
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assessment_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("assessment_key", sa.String(48), nullable=False),
        sa.Column("definition_version", sa.String(16), nullable=False),
        sa.Column("algorithm", sa.String(32), nullable=False),
        sa.Column("locale", sa.String(2), server_default="bg", nullable=False),
        sa.Column("fingerprint", sa.String(16), nullable=False),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint("locale IN ('bg', 'en')", name="ck_assessment_results_locale"),
        sa.PrimaryKeyConstraint("id", name="pk_assessment_results"),
        sa.UniqueConstraint("token_hash", name="uq_assessment_results_token_hash"),
    )
    op.create_index("ix_assessment_results_expires_at", "assessment_results", ["expires_at"])
    op.create_index("ix_assessment_results_assessment_key", "assessment_results", ["assessment_key"])


def downgrade() -> None:
    op.drop_table("assessment_results")
