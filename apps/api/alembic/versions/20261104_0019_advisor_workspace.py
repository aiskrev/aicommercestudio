"""Advisor Workspace: products, versioned plans, entitlements, usage, projects and versions.

Additive. Plans are seeded with internal, unconfirmed limits and no price: `plan_prices` stays empty
until the owner approves a price. Every limit is a number; there is no "unlimited" value.

Revision ID: 0019
Revises: 0018
Create Date: 2026-11-04
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)
READ_ONLY = ("products", "plans", "plan_versions", "plan_features", "plan_prices")
APPEND_ONLY = ("usage_events",)
READ_WRITE = (
    "customer_workspaces",
    "entitlement_grants",
    "usage_counters",
    "usage_reservations",
    "workspace_projects",
    "assessment_versions",
)
TABLES = (*READ_ONLY, *APPEND_ONLY, *READ_WRITE)
NS = uuid.UUID("6f1b6f0e-6e4b-4d0a-9a37-3f7a4d1c2b10")

COMMON = ("projects", "history")
PAID = (*COMMON, "follow_ups", "compare", "export_markdown", "ai_assessments", "ai_results")
PLANS = {
    "free": (
        COMMON,
        {
            "limit_projects": 1,
            "limit_versions_per_project": 5,
            "limit_template_runs_month": 10,
            "limit_ai_runs_month": 0,
            "limit_ai_cost_micros_month": 0,
            "limit_input_chars": 2000,
            "limit_requests_per_minute": 20,
        },
    ),
    "pro": (
        PAID,
        {
            "limit_projects": 10,
            "limit_versions_per_project": 30,
            "limit_template_runs_month": 100,
            "limit_ai_runs_month": 30,
            "limit_ai_cost_micros_month": 15_000_000,
            "limit_input_chars": 2000,
            "limit_requests_per_minute": 40,
        },
    ),
    "business": (
        (*PAID, "export_json"),
        {
            "limit_projects": 50,
            "limit_versions_per_project": 100,
            "limit_template_runs_month": 500,
            "limit_ai_runs_month": 150,
            "limit_ai_cost_micros_month": 75_000_000,
            "limit_input_chars": 2000,
            "limit_requests_per_minute": 60,
        },
    ),
    "custom": (
        (*PAID, "export_json"),
        {
            "limit_projects": 50,
            "limit_versions_per_project": 100,
            "limit_template_runs_month": 500,
            "limit_ai_runs_month": 150,
            "limit_ai_cost_micros_month": 75_000_000,
            "limit_input_chars": 2000,
            "limit_requests_per_minute": 60,
        },
    ),
}


def _id(name: str) -> uuid.UUID:
    return uuid.uuid5(NS, name)


def _seed() -> None:
    product = _id("product")
    meta = sa.MetaData()
    tables = {
        name: sa.Table(name, meta, autoload_with=op.get_bind())
        for name in ("products", "plans", "plan_versions", "plan_features")
    }
    op.bulk_insert(tables["products"], [{"id": product, "key": "advisor_workspace", "name": "Advisor Workspace"}])
    for position, (key, (features, limits)) in enumerate(PLANS.items(), start=1):
        plan, version = _id(f"plan:{key}"), _id(f"plan:{key}:1")
        op.bulk_insert(tables["plans"], [{"id": plan, "product_id": product, "key": key, "position": position}])
        op.bulk_insert(
            tables["plan_versions"], [{"id": version, "plan_id": plan, "version": 1, "created_at": datetime.now(UTC)}]
        )
        rows = [{"plan_version_id": version, "feature": f, "enabled": True, "limit_value": None} for f in features]
        rows += [
            {"plan_version_id": version, "feature": f, "enabled": True, "limit_value": v} for f, v in limits.items()
        ]
        op.bulk_insert(tables["plan_features"], rows)


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("key", sa.String(40), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
    )
    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("key", sa.String(20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("product_id", "key", name="uq_plans_product_key"),
    )
    op.create_table(
        "plan_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("plan_id", sa.Uuid(), sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.UniqueConstraint("plan_id", "version", name="uq_plan_versions_plan_version"),
    )
    op.create_table(
        "plan_features",
        sa.Column(
            "plan_version_id", sa.Uuid(), sa.ForeignKey("plan_versions.id", ondelete="RESTRICT"), primary_key=True
        ),
        sa.Column("feature", sa.String(40), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("limit_value", sa.BigInteger()),
        sa.CheckConstraint("limit_value IS NULL OR limit_value >= 0", name="limit_not_negative"),
        sa.CheckConstraint("feature NOT LIKE 'limit_%' OR limit_value IS NOT NULL", name="limit_has_a_value"),
    )
    op.create_table(
        "plan_prices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("plan_version_id", sa.Uuid(), sa.ForeignKey("plan_versions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("billing_interval", sa.String(12), nullable=False),
        sa.Column("approved_at", TS),
    )
    op.create_table(
        "customer_workspaces",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "owner_account_id",
            sa.Uuid(),
            sa.ForeignKey("customer_accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "entitlement_grants",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id", sa.Uuid(), sa.ForeignKey("customer_workspaces.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("plan_version_id", sa.Uuid(), sa.ForeignKey("plan_versions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("started_at", TS, nullable=False),
        sa.Column("ended_at", TS),
    )
    op.create_index(
        "uq_entitlement_grants_active",
        "entitlement_grants",
        ["workspace_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )
    op.create_table(
        "usage_counters",
        sa.Column("workspace_id", sa.Uuid(), primary_key=True),
        sa.Column("metric", sa.String(40), primary_key=True),
        sa.Column("period_start", sa.Date(), primary_key=True),
        sa.Column("used", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("reserved", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.CheckConstraint("used >= 0 AND reserved >= 0", name="not_negative"),
    )
    op.create_table(
        "usage_reservations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id", sa.Uuid(), sa.ForeignKey("customer_workspaces.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("idempotency_key", sa.String(100), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("items", JSONB(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("outcome", sa.String(24)),
        sa.Column("version_id", sa.Uuid()),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", TS),
        sa.UniqueConstraint("workspace_id", "idempotency_key", name="uq_usage_reservations_key"),
    )
    op.create_index("ix_usage_reservations_open", "usage_reservations", ["status", "expires_at"])
    op.create_table(
        "usage_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("reservation_id", sa.Uuid(), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False),
        sa.Column("metric", sa.String(40), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("outcome", sa.String(24), nullable=False),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_index("ix_usage_events_workspace", "usage_events", ["workspace_id", "created_at"])
    op.create_table(
        "workspace_projects",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id", sa.Uuid(), sa.ForeignKey("customer_workspaces.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
    )
    op.create_index("ix_workspace_projects_workspace", "workspace_projects", ["workspace_id"])
    op.create_table(
        "assessment_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("workspace_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("parent_number", sa.Integer()),
        sa.Column("label", sa.String(80)),
        sa.Column("clarification", sa.Text()),
        sa.Column("inputs", JSONB(), nullable=False),
        sa.Column("result", JSONB(), nullable=False),
        sa.Column("insights", JSONB()),
        sa.Column("notices", JSONB(), nullable=False),
        sa.Column("disclaimer", sa.Text(), nullable=False),
        sa.Column("result_kind", sa.String(10), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.UniqueConstraint("project_id", "number", name="uq_assessment_versions_number"),
        sa.CheckConstraint("result_kind IN ('template', 'ai_model')", name="result_kind"),
    )
    _seed()
    op.execute(f"REVOKE ALL ON {', '.join(TABLES)} FROM {RUNTIME}")
    op.execute(f"GRANT SELECT ON {', '.join(READ_ONLY)} TO {API}")
    op.execute(f"GRANT SELECT, INSERT ON {', '.join(APPEND_ONLY)} TO {API}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {', '.join(READ_WRITE)} TO {API}")


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_table(table)
