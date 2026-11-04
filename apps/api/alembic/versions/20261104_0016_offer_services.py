"""Six engineering services as lead and catalogue categories.

* leads.service / leads.submitted_service and services.lead_category: new allowed values
  (CHECK constraints recreated)

Backward compatible: no existing row is changed.

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = (
    "maintenance",
    "seo",
    "ai_tools",
    "automation",
    "analytics",
    "integrations",
    "audit",
    "ai_managed",
    "ai_agents",
)
ADDED = (
    "business_websites",
    "store_development",
    "portals_web_apps",
    "payments_subscriptions",
    "security_performance",
    "integration_care",
)


def _quoted(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def _checks(categories: tuple[str, ...]) -> None:
    for column in ("service", "submitted_service"):
        op.drop_constraint(f"ck_leads_{column}", "leads", type_="check")
        op.create_check_constraint(f"ck_leads_{column}", "leads", f"{column} IN ({_quoted((*categories, 'other'))})")
    op.drop_constraint("ck_services_lead_category", "services", type_="check")
    op.create_check_constraint(
        "ck_services_lead_category", "services", f"lead_category IS NULL OR lead_category IN ({_quoted(categories)})"
    )


def upgrade() -> None:
    _checks((*CATEGORIES, *ADDED))


def downgrade() -> None:
    # Leads of a new service cannot satisfy the old constraint; recategorise them as "other" rather
    # than deleting them. The six catalogue entries came from the seed and can be recreated from it.
    for statement in (
        "UPDATE leads SET service = 'other' WHERE service = ANY(:keys)",
        "UPDATE leads SET submitted_service = 'other' WHERE submitted_service = ANY(:keys)",
        "DELETE FROM entity_relations WHERE to_entity_id IN (SELECT id FROM services WHERE lead_category = ANY(:keys))",
        "DELETE FROM family_services WHERE service_id IN (SELECT id FROM services WHERE lead_category = ANY(:keys))",
        "DELETE FROM catalogue_entities WHERE id IN (SELECT id FROM services WHERE lead_category = ANY(:keys))",
    ):
        op.execute(sa.text(statement).bindparams(keys=list(ADDED)))
    _checks(CATEGORIES)
