"""AI operations scaffold: tenancy foundation for the future AI Operations Portal.

* ops_organizations: tenants (slug, name, status, data region, demo flag).
* ops_workspaces: environments / units inside an organisation; (id, organization_id) is unique so
  child rows can reference both.
* ops_memberships: user × organisation × role (owner, admin, operator, reviewer, viewer).
* ops_agents: agent registry metadata (no runs, no telemetry, no credentials). A composite foreign
  key (workspace_id, organization_id) → ops_workspaces makes it impossible to attach an agent to
  another tenant's workspace.

Backward compatible: new tables only; no existing row is changed. Downgrade drops the four tables
(registry metadata entered by staff is lost; nothing else depends on it).

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ops_organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(60), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("status", sa.String(16), server_default="active", nullable=False),
        sa.Column("data_region", sa.String(8), server_default="eu", nullable=False),
        sa.Column("is_demo", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('active', 'suspended')", name="ck_ops_organizations_status"),
        sa.PrimaryKeyConstraint("id", name="pk_ops_organizations"),
        sa.UniqueConstraint("slug", name="uq_ops_organizations_slug"),
    )

    op.create_table(
        "ops_workspaces",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(60), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("environment", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "environment IN ('production', 'staging', 'development')", name="ck_ops_workspaces_environment"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["ops_organizations.id"],
            name="fk_ops_workspaces_organization_id_ops_organizations",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ops_workspaces"),
        sa.UniqueConstraint("organization_id", "slug", name="uq_ops_workspaces_org_slug"),
        sa.UniqueConstraint("id", "organization_id", name="uq_ops_workspaces_id_org"),
    )
    op.create_index("ix_ops_workspaces_organization_id", "ops_workspaces", ["organization_id"])

    op.create_table(
        "ops_memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "role IN ('owner', 'admin', 'operator', 'reviewer', 'viewer')", name="ck_ops_memberships_role"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["ops_organizations.id"],
            name="fk_ops_memberships_organization_id_ops_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["admin_users.id"], name="fk_ops_memberships_user_id_admin_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ops_memberships"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_ops_memberships_org_user"),
    )
    op.create_index("ix_ops_memberships_organization_id", "ops_memberships", ["organization_id"])
    op.create_index("ix_ops_memberships_user_id", "ops_memberships", ["user_id"])

    op.create_table(
        "ops_agents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(60), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("provider", sa.String(40), nullable=True),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("version", sa.String(40), nullable=True),
        sa.Column("purpose", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('planned', 'active', 'paused', 'retired')", name="ck_ops_agents_status"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["ops_organizations.id"],
            name="fk_ops_agents_organization_id_ops_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "organization_id"],
            ["ops_workspaces.id", "ops_workspaces.organization_id"],
            name="fk_ops_agents_workspace_org",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ops_agents"),
        sa.UniqueConstraint("workspace_id", "key", name="uq_ops_agents_workspace_key"),
    )
    op.create_index("ix_ops_agents_organization_id", "ops_agents", ["organization_id"])
    op.create_index("ix_ops_agents_workspace_id", "ops_agents", ["workspace_id"])


def downgrade() -> None:
    op.drop_table("ops_agents")
    op.drop_table("ops_memberships")
    op.drop_table("ops_workspaces")
    op.drop_table("ops_organizations")
