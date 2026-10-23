"""AI Managed Services and lead language.

* leads.service / leads.submitted_service: new allowed value `ai_managed` (CHECK constraints recreated)
* leads.locale: website language of the inquiry (`bg` | `en`); existing rows get `bg` via the server default
* leads.service_details: optional validated JSONB for service-specific inquiry data (AI Managed Services)
* index on leads.locale for admin filtering

Backward compatible: no existing row is changed except receiving locale = 'bg'.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_SERVICES = "'maintenance', 'seo', 'ai_tools', 'automation', 'analytics', 'integrations', 'audit', 'other'"
NEW_SERVICES = (
    "'maintenance', 'seo', 'ai_tools', 'automation', 'analytics', 'integrations', 'audit', 'ai_managed', 'other'"
)


def _service_checks(values: str) -> None:
    for column in ("service", "submitted_service"):
        op.drop_constraint(f"ck_leads_{column}", "leads", type_="check")
        op.create_check_constraint(f"ck_leads_{column}", "leads", f"{column} IN ({values})")


def upgrade() -> None:
    _service_checks(NEW_SERVICES)
    op.add_column("leads", sa.Column("locale", sa.String(2), nullable=False, server_default=sa.text("'bg'")))
    op.create_check_constraint("ck_leads_locale", "leads", "locale IN ('bg', 'en')")
    op.create_index("ix_leads_locale", "leads", ["locale"])
    op.add_column("leads", sa.Column("service_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    # Leads of the new service cannot satisfy the old constraint; recategorise them as "other"
    # (their details are dropped with the column) rather than deleting them.
    op.execute("UPDATE leads SET service = 'other' WHERE service = 'ai_managed'")
    op.execute("UPDATE leads SET submitted_service = 'other' WHERE submitted_service = 'ai_managed'")
    op.drop_column("leads", "service_details")
    op.drop_index("ix_leads_locale", table_name="leads")
    op.drop_constraint("ck_leads_locale", "leads", type_="check")
    op.drop_column("leads", "locale")
    _service_checks(OLD_SERVICES)
