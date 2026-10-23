"""Quote requests, service re-categorisation, persistent login lockout, audit indexes.

* leads: inquiry_type, submitted_service (backfilled from service), platform, budget_range,
  timeline, website_url + CHECK constraints and indexes on service / inquiry_type
* admin_users: failed_login_count, locked_until
* audit_logs: indexes on action and actor_id

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-24
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SERVICES = "'maintenance', 'seo', 'ai_tools', 'automation', 'analytics', 'integrations', 'audit', 'other'"
INQUIRY_TYPES = "'contact', 'quote'"
PLATFORMS = "'shopify', 'woocommerce', 'custom', 'other', 'none'"
BUDGETS = "'undisclosed', 'under_2500', '2500_10000', '10000_25000', 'over_25000'"
TIMELINES = "'asap', 'within_1_month', 'within_3_months', 'flexible'"


def upgrade() -> None:
    op.add_column(
        "leads", sa.Column("inquiry_type", sa.String(16), nullable=False, server_default=sa.text("'contact'"))
    )
    op.add_column("leads", sa.Column("submitted_service", sa.String(32), nullable=True))
    op.execute("UPDATE leads SET submitted_service = service WHERE submitted_service IS NULL")
    op.alter_column("leads", "submitted_service", nullable=False)
    op.add_column("leads", sa.Column("platform", sa.String(32), nullable=True))
    op.add_column("leads", sa.Column("budget_range", sa.String(32), nullable=True))
    op.add_column("leads", sa.Column("timeline", sa.String(32), nullable=True))
    op.add_column("leads", sa.Column("website_url", sa.String(300), nullable=True))

    op.create_check_constraint("ck_leads_submitted_service", "leads", f"submitted_service IN ({SERVICES})")
    op.create_check_constraint("ck_leads_inquiry_type", "leads", f"inquiry_type IN ({INQUIRY_TYPES})")
    op.create_check_constraint("ck_leads_platform", "leads", f"platform IS NULL OR platform IN ({PLATFORMS})")
    op.create_check_constraint(
        "ck_leads_budget_range", "leads", f"budget_range IS NULL OR budget_range IN ({BUDGETS})"
    )
    op.create_check_constraint("ck_leads_timeline", "leads", f"timeline IS NULL OR timeline IN ({TIMELINES})")
    op.create_index("ix_leads_service", "leads", ["service"])
    op.create_index("ix_leads_inquiry_type", "leads", ["inquiry_type"])

    op.add_column(
        "admin_users",
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("admin_users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_actor_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_column("admin_users", "locked_until")
    op.drop_column("admin_users", "failed_login_count")
    op.drop_index("ix_leads_inquiry_type", table_name="leads")
    op.drop_index("ix_leads_service", table_name="leads")
    for name in ("timeline", "budget_range", "platform", "inquiry_type", "submitted_service"):
        op.drop_constraint(f"ck_leads_{name}", "leads", type_="check")
    for column in ("website_url", "timeline", "budget_range", "platform", "submitted_service", "inquiry_type"):
        op.drop_column("leads", column)
