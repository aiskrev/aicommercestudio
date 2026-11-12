"""Billing offer categories (commercial expansion, Phase 13).

Additive: `billing_offers.category` keeps the four kinds of sale apart: a SaaS subscription, a recurring managed
service, an approved one-time service and a project deposit. Existing offers get the category their shape implies. A
**project deposit can never be approved**: a CHECK constraint refuses it, because that sale needs a business and legal
design first (decision D-08) and no approved offer of that category may exist until that design is recorded and this
constraint is replaced on purpose.

Revision ID: 0032
Revises: 0031
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = ("saas_subscription", "managed_service", "one_time_service", "project_deposit")


def upgrade() -> None:
    op.add_column("billing_offers", sa.Column("category", sa.String(20)))
    op.execute(
        "UPDATE billing_offers SET category = CASE "
        "WHEN kind = 'subscription' AND requires_scope THEN 'managed_service' "
        "WHEN kind = 'subscription' THEN 'saas_subscription' "
        "ELSE 'one_time_service' END"
    )
    op.alter_column("billing_offers", "category", nullable=False)
    values = ", ".join(repr(value) for value in CATEGORIES)
    op.create_check_constraint("category", "billing_offers", f"category IN ({values})")
    op.create_check_constraint(
        "deposit_never_approved", "billing_offers", "NOT (category = 'project_deposit' AND approved_at IS NOT NULL)"
    )


def downgrade() -> None:
    op.drop_constraint("deposit_never_approved", "billing_offers", type_="check")
    op.drop_constraint("category", "billing_offers", type_="check")
    op.drop_column("billing_offers", "category")
