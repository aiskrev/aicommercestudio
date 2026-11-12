"""Commercial customer projects (commercial expansion, Phase 09).

Additive: three new tables. `commercial_projects` belongs to a customer workspace and may point at the lead and the
accepted quotation it came from (one project per quotation, one per workspace, lead and title: retries cannot create
duplicates). `project_milestones` is the delivery plan (staff replace it, so the API role may delete its rows).
`project_events` is the delivery history and the conversation (status changes, updates, deliveries, change requests,
support requests, replies): the API role can add and update them (a request's state) but never delete them.
The runtime role has no access to any of them.

Revision ID: 0028
Revises: 0027
Create Date: 2026-11-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)

STATUSES = (
    "draft",
    "quotation",
    "awaiting_approval",
    "approved",
    "in_progress",
    "client_review",
    "completed",
    "maintenance",
)
EVENT_KINDS = ("status", "update", "delivery", "change_request", "support", "response", "approval")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def upgrade() -> None:
    op.create_table(
        "commercial_projects",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id", sa.Uuid(), sa.ForeignKey("customer_workspaces.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="SET NULL")),
        sa.Column("quotation_id", sa.Uuid(), sa.ForeignKey("quotations.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("scope", postgresql.JSONB()),
        sa.Column("scope_version", sa.Integer()),
        sa.Column("contract_reference", sa.String(60)),
        sa.Column("invoice_references", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("maintenance_plan", sa.String(24)),
        sa.Column("maintenance_note", sa.String(300)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("approved_by_account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("approved_at", TS),
        sa.Column("completed_at", TS),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(_in("status", STATUSES), name="status"),
        sa.CheckConstraint("revision >= 1", name="revision"),
    )
    op.create_index(
        "uq_commercial_projects_quotation",
        "commercial_projects",
        ["quotation_id"],
        unique=True,
        postgresql_where=sa.text("quotation_id IS NOT NULL"),
    )
    op.create_index(
        "uq_commercial_projects_lead_title",
        "commercial_projects",
        ["workspace_id", "lead_id", "title"],
        unique=True,
        postgresql_where=sa.text("lead_id IS NOT NULL"),
    )
    op.create_index("ix_commercial_projects_workspace", "commercial_projects", ["workspace_id", "updated_at"])

    op.create_table(
        "project_milestones",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("commercial_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("indicative_timing", sa.String(120)),
        sa.Column("status", sa.String(12), nullable=False, server_default=sa.text("'planned'")),
        sa.Column("completed_at", TS),
        sa.CheckConstraint(_in("status", ("planned", "in_progress", "done")), name="status"),
        sa.CheckConstraint("position >= 0", name="position"),
    )
    op.create_index("ix_project_milestones_project", "project_milestones", ["project_id", "position"])

    op.create_table(
        "project_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("commercial_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("visibility", sa.String(10), nullable=False, server_default=sa.text("'client'")),
        sa.Column("author_kind", sa.String(8), nullable=False),
        sa.Column("author_admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("author_account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("body", sa.Text()),
        sa.Column("state", sa.String(10)),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("project_events.id", ondelete="SET NULL")),
        sa.Column("meta", postgresql.JSONB()),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(_in("kind", EVENT_KINDS), name="kind"),
        sa.CheckConstraint("visibility IN ('client', 'internal')", name="visibility"),
        sa.CheckConstraint("author_kind IN ('staff', 'client', 'system')", name="author_kind"),
        sa.CheckConstraint(
            f"({_in('kind', ('change_request', 'support'))}) = (state IS NOT NULL)", name="request_state"
        ),
        sa.CheckConstraint("state IS NULL OR " + _in("state", ("open", "answered", "closed")), name="state"),
    )
    op.create_index("ix_project_events_project", "project_events", ["project_id", "created_at"])

    for table in ("commercial_projects", "project_milestones", "project_events"):
        op.execute(f"REVOKE ALL ON {table} FROM {RUNTIME}")
        op.execute(f"REVOKE ALL ON {table} FROM {API}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON commercial_projects, project_events TO {API}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON project_milestones TO {API}")


def downgrade() -> None:
    op.drop_index("ix_project_events_project", table_name="project_events")
    op.drop_table("project_events")
    op.drop_index("ix_project_milestones_project", table_name="project_milestones")
    op.drop_table("project_milestones")
    op.drop_index("ix_commercial_projects_workspace", table_name="commercial_projects")
    op.drop_index("uq_commercial_projects_lead_title", table_name="commercial_projects")
    op.drop_index("uq_commercial_projects_quotation", table_name="commercial_projects")
    op.drop_table("commercial_projects")
