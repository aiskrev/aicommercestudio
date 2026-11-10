"""Site statistics: one table of anonymous events (docs/ANALYTICS.md).

Additive. The API role may read, add and delete rows (the maintenance job deletes expired ones); it cannot
change a row. No IP address, user agent or user id is stored.

Revision ID: 0022
Revises: 0021
Create Date: 2026-11-10
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("kind", sa.String(8), nullable=False),
        sa.Column("path", sa.String(200), nullable=False),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("visit", sa.String(24), nullable=False),
        sa.Column("device", sa.String(8), nullable=False),
        sa.Column("referrer_host", sa.String(120)),
        sa.Column("label", sa.String(80)),
        sa.Column("target", sa.String(200)),
        sa.CheckConstraint("kind IN ('view', 'click', 'tool')", name="kind"),
        sa.CheckConstraint("device IN ('desktop', 'mobile', 'tablet')", name="device"),
    )
    op.create_index("ix_analytics_events_created", "analytics_events", ["created_at"])
    op.create_index("ix_analytics_events_kind_created", "analytics_events", ["kind", "created_at"])
    op.create_index("ix_analytics_events_visit", "analytics_events", ["visit", "created_at"])
    op.execute(f"REVOKE ALL ON analytics_events FROM {RUNTIME}")
    op.execute(f"GRANT SELECT, INSERT, DELETE ON analytics_events TO {API}")


def downgrade() -> None:
    op.drop_table("analytics_events")
