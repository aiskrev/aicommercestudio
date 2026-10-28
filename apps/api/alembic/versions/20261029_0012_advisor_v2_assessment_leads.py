"""Advisor V2 contract version and insights; optional consultation link for saved assessments.

* advisor_assessments.contract_version: "1" for every existing row (server default) and for V1
  requests; "2" when the visitor used the V2 contract.
* advisor_assessments.insights: the deterministic V2 insights (JSONB), NULL for V1 rows.
* assessment_results.lead_id / linked_at: set when the visitor explicitly asks for a consultation
  about a saved result. ON DELETE CASCADE: a linked result follows the lead's retention and erasure.

Backward compatible: nullable columns or columns with a server default; no existing row changes
meaning. Downgrade drops the new columns (V2 insights and consultation links are lost; V1 data stays).

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-29
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "advisor_assessments", sa.Column("contract_version", sa.String(4), server_default="1", nullable=False)
    )
    op.add_column(
        "advisor_assessments", sa.Column("insights", postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )
    op.add_column("assessment_results", sa.Column("lead_id", sa.Uuid(), nullable=True))
    op.add_column("assessment_results", sa.Column("linked_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_assessment_results_lead_id_leads", "assessment_results", "leads", ["lead_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_assessment_results_lead_id", "assessment_results", ["lead_id"])


def downgrade() -> None:
    op.drop_index("ix_assessment_results_lead_id", table_name="assessment_results")
    op.drop_constraint("fk_assessment_results_lead_id_leads", "assessment_results", type_="foreignkey")
    op.drop_column("assessment_results", "linked_at")
    op.drop_column("assessment_results", "lead_id")
    op.drop_column("advisor_assessments", "insights")
    op.drop_column("advisor_assessments", "contract_version")
