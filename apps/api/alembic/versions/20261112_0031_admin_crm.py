"""Admin CRM foundation (commercial expansion, Phase 12).

Additive: an optional owner on every lead (`leads.owner_id`, the administrator who is responsible for the enquiry) and
the follow-up tasks of an enquiry (`lead_tasks`). Tasks are removed with their lead (`ON DELETE CASCADE`). The API role
can read, add and update them; it cannot delete them (a task is cancelled, not deleted). The runtime role has no access.

Revision ID: 0031
Revises: 0030
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column("leads", sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")))
    op.create_index("ix_leads_owner_id", "leads", ["owner_id"])

    op.create_table(
        "lead_tasks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("due_on", sa.Date()),
        sa.Column("state", sa.String(10), nullable=False, server_default=sa.text("'open'")),
        sa.Column("assignee_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("done_by_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("done_at", TS),
        sa.Column("revision", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("state IN ('open', 'done', 'cancelled')", name="state"),
        sa.CheckConstraint("revision >= 1", name="revision"),
        sa.CheckConstraint("(state = 'done') = (done_at IS NOT NULL)", name="done"),
    )
    op.create_index("ix_lead_tasks_lead", "lead_tasks", ["lead_id", "created_at"])
    op.create_index("ix_lead_tasks_state_due", "lead_tasks", ["state", "due_on"])
    op.create_index("ix_lead_tasks_assignee", "lead_tasks", ["assignee_id", "state"])
    op.execute(f"REVOKE ALL ON lead_tasks FROM {RUNTIME}")
    op.execute(f"REVOKE ALL ON lead_tasks FROM {API}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON lead_tasks TO {API}")


def downgrade() -> None:
    op.drop_index("ix_lead_tasks_assignee", table_name="lead_tasks")
    op.drop_index("ix_lead_tasks_state_due", table_name="lead_tasks")
    op.drop_index("ix_lead_tasks_lead", table_name="lead_tasks")
    op.drop_table("lead_tasks")
    op.drop_index("ix_leads_owner_id", table_name="leads")
    op.drop_column("leads", "owner_id")
