"""AI agent development as a lead service.

* leads.service / leads.submitted_service: new allowed value `ai_agents` (CHECK constraints recreated)

Backward compatible: no existing row is changed.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-27
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_SERVICES = (
    "'maintenance', 'seo', 'ai_tools', 'automation', 'analytics', 'integrations', 'audit', 'ai_managed', 'other'"
)
NEW_SERVICES = (
    "'maintenance', 'seo', 'ai_tools', 'automation', 'analytics', 'integrations', 'audit', 'ai_managed', "
    "'ai_agents', 'other'"
)


def _service_checks(values: str) -> None:
    for column in ("service", "submitted_service"):
        op.drop_constraint(f"ck_leads_{column}", "leads", type_="check")
        op.create_check_constraint(f"ck_leads_{column}", "leads", f"{column} IN ({values})")


def upgrade() -> None:
    _service_checks(NEW_SERVICES)


def downgrade() -> None:
    # Leads of the new service cannot satisfy the old constraint; recategorise them as "other"
    # rather than deleting them.
    op.execute("UPDATE leads SET service = 'other' WHERE service = 'ai_agents'")
    op.execute("UPDATE leads SET submitted_service = 'other' WHERE submitted_service = 'ai_agents'")
    _service_checks(OLD_SERVICES)
