"""AI operations platform: tenant hardening (RLS, runtime role), registry, evaluations, observability,
incidents and changes, and the (disabled by default) client portal identities.

Security:
* `acs_app_runtime` — a NOLOGIN, NOBYPASSRLS, non-owner role. Tenant-scoped API transactions switch to
  it with `SET LOCAL ROLE` (app/ops/rls.py), so row-level security applies to them. The schema owner
  (migrations, CLI maintenance) keeps bypassing RLS because RLS is not FORCEd.
* Row-level security with one policy per tenant table: `organization_id = ops_current_org()`, where
  the organisation comes from the transaction-local setting `app.ops_org`. Memberships and
  organisations are additionally visible to their own user (`app.ops_user`), for the organisation list.
* `ops_agents (id, organization_id)` becomes unique, so every child row references its agent with a
  composite foreign key that cannot cross tenants.
* Registry versions are immutable once they leave `draft`, and incident/change timelines are
  append-only (triggers); the runtime role cannot UPDATE/DELETE timelines or audit entries.

Backward compatible: new tables, one new unique constraint, grants and policies. Downgrade drops the
new tables, policies, functions and grants (the cluster-wide role itself is kept: other databases on
the same server may use it).

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-03
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE = "acs_app_runtime"
JSONB = postgresql.JSONB(astext_type=sa.Text())
TS = sa.DateTime(timezone=True)

TENANT_TABLES = [
    "ops_workspaces",
    "ops_agents",
    "ops_agent_versions",
    "ops_eval_datasets",
    "ops_eval_cases",
    "ops_eval_runs",
    "ops_eval_results",
    "ops_rate_cards",
    "ops_runs",
    "ops_budgets",
    "ops_threshold_rules",
    "ops_retention_policies",
    "ops_incidents",
    "ops_incident_events",
    "ops_changes",
    "ops_change_events",
    "portal_users",
    "portal_tokens",
    "portal_sessions",
]
NEW_TABLES = TENANT_TABLES[2:]


def _org() -> sa.Column:
    return sa.Column(
        "organization_id",
        sa.Uuid(),
        sa.ForeignKey("ops_organizations.id", ondelete="CASCADE", name=None),
        nullable=False,
        index=True,
    )


def _user(name: str) -> sa.Column:
    return sa.Column(name, sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)


def _tfk(column: str, table: str, name: str, ondelete: str = "CASCADE") -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        [column, "organization_id"], [f"{table}.id", f"{table}.organization_id"], name=name, ondelete=ondelete
    )


def _in(column: str, values: list[str], nullable: bool = False) -> str:
    check = f"{column} IN ({', '.join(repr(v) for v in values)})"
    return f"{column} IS NULL OR {check}" if nullable else check


def _event_table(name: str, parent: str, parent_table: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column(parent, sa.Uuid(), nullable=False, index=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("from_status", sa.String(16)),
        sa.Column("to_status", sa.String(16)),
        sa.Column("body", sa.Text()),
        _user("actor_user_id"),
        sa.Column("actor_label", sa.String(254), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        _tfk(parent, parent_table, f"fk_{name}_{parent[:-3]}_org"),
        sa.CheckConstraint(_in("kind", ["created", "status", "note", "evidence", "assignment"]), name="kind"),
        sa.CheckConstraint("body IS NULL OR char_length(body) <= 4000", name="body_length"),
    )


def upgrade() -> None:
    op.create_unique_constraint("uq_ops_agents_id_org", "ops_agents", ["id", "organization_id"])

    # ------------------------------------------------------------------ registry
    op.create_table(
        "ops_agent_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("agent_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("prompt_template", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(40)),
        sa.Column("model", sa.String(80)),
        sa.Column("parameters", JSONB, nullable=False),
        sa.Column("tools", JSONB, nullable=False),
        sa.Column("environment", sa.String(16), nullable=False),
        _user("owner_user_id"),
        sa.Column("change_reason", sa.String(500), nullable=False),
        sa.Column("based_on_id", sa.Uuid()),
        sa.Column("rollback_of_id", sa.Uuid()),
        sa.Column("sensitive", sa.Boolean(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("submitted_at", TS),
        _user("reviewed_by"),
        sa.Column("reviewed_at", TS),
        sa.Column("review_note", sa.String(500)),
        sa.Column("evaluation_run_id", sa.Uuid()),
        sa.Column("retired_at", TS),
        _tfk("agent_id", "ops_agents", "fk_ops_agent_versions_agent_org"),
        sa.UniqueConstraint("agent_id", "number", name="uq_ops_agent_versions_agent_number"),
        sa.UniqueConstraint("id", "organization_id", name="uq_ops_agent_versions_id_org"),
        sa.CheckConstraint(_in("status", ["draft", "in_review", "approved", "retired"]), name="status"),
        sa.CheckConstraint("char_length(prompt_template) <= 20000", name="prompt_length"),
        sa.CheckConstraint("number >= 1", name="number"),
    )
    op.create_foreign_key(
        "fk_ops_agent_versions_based_on",
        "ops_agent_versions",
        "ops_agent_versions",
        ["based_on_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_ops_agent_versions_rollback",
        "ops_agent_versions",
        "ops_agent_versions",
        ["rollback_of_id", "organization_id"],
        ["id", "organization_id"],
    )

    # ---------------------------------------------------------------- evaluations
    op.create_table(
        "ops_eval_datasets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("agent_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("key", sa.String(60), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("status", sa.String(16), nullable=False),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("locked_at", TS),
        _tfk("agent_id", "ops_agents", "fk_ops_eval_datasets_agent_org"),
        sa.UniqueConstraint("agent_id", "key", "version", name="uq_ops_eval_datasets_agent_key_version"),
        sa.UniqueConstraint("id", "organization_id", name="uq_ops_eval_datasets_id_org"),
        sa.CheckConstraint(_in("status", ["draft", "locked"]), name="status"),
    )
    op.create_table(
        "ops_eval_cases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("dataset_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("key", sa.String(60), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("input_text", sa.Text(), nullable=False),
        sa.Column("expected_behavior", sa.String(1000), nullable=False),
        sa.Column("assertions", JSONB, nullable=False),
        sa.Column("synthetic", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        _tfk("dataset_id", "ops_eval_datasets", "fk_ops_eval_cases_dataset_org"),
        sa.UniqueConstraint("dataset_id", "key", name="uq_ops_eval_cases_dataset_key"),
        sa.UniqueConstraint("id", "organization_id", name="uq_ops_eval_cases_id_org"),
        sa.CheckConstraint("char_length(input_text) <= 4000", name="input_length"),
    )
    op.create_table(
        "ops_eval_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("dataset_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("agent_version_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("runner", sa.String(40), nullable=False),
        sa.Column("simulated", sa.Boolean(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("passed", sa.Integer(), nullable=False),
        sa.Column("failed", sa.Integer(), nullable=False),
        _user("created_by"),
        sa.Column("started_at", TS, nullable=False),
        sa.Column("finished_at", TS, nullable=False),
        _tfk("dataset_id", "ops_eval_datasets", "fk_ops_eval_runs_dataset_org"),
        _tfk("agent_version_id", "ops_agent_versions", "fk_ops_eval_runs_version_org"),
        sa.UniqueConstraint("id", "organization_id", name="uq_ops_eval_runs_id_org"),
        sa.CheckConstraint("passed >= 0 AND failed >= 0 AND total = passed + failed", name="counts"),
    )
    op.create_foreign_key(
        "fk_ops_agent_versions_eval_run",
        "ops_agent_versions",
        "ops_eval_runs",
        ["evaluation_run_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_table(
        "ops_eval_results",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("run_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("output_text", sa.Text(), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("assertion_results", JSONB, nullable=False),
        sa.Column("manual_label", sa.String(16)),
        _user("labeled_by"),
        sa.Column("labeled_at", TS),
        _tfk("run_id", "ops_eval_runs", "fk_ops_eval_results_run_org"),
        _tfk("case_id", "ops_eval_cases", "fk_ops_eval_results_case_org"),
        sa.UniqueConstraint("run_id", "case_id", name="uq_ops_eval_results_run_case"),
        sa.CheckConstraint(_in("manual_label", ["pass", "fail", "needs_review"], nullable=True), name="manual_label"),
    )

    # -------------------------------------------------------------- observability
    op.create_table(
        "ops_rate_cards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("version", sa.String(40), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("input_per_million", sa.Numeric(14, 6), nullable=False),
        sa.Column("output_per_million", sa.Numeric(14, 6), nullable=False),
        sa.Column("effective_from", TS, nullable=False),
        sa.Column("source_note", sa.String(300), nullable=False),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        sa.UniqueConstraint("organization_id", "provider", "model", "version", name="uq_ops_rate_cards_version"),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency"),
        sa.CheckConstraint("input_per_million >= 0 AND output_per_million >= 0", name="prices"),
    )
    op.create_table(
        "ops_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("agent_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("agent_version_id", sa.Uuid()),
        sa.Column("external_id", sa.String(80), nullable=False),
        sa.Column("started_at", TS, nullable=False, index=True),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("error_category", sa.String(20)),
        sa.Column("provider", sa.String(40)),
        sa.Column("model", sa.String(80)),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("batch_id", sa.Uuid()),
        sa.Column("created_at", TS, nullable=False),
        _tfk("agent_id", "ops_agents", "fk_ops_runs_agent_org"),
        _tfk("agent_version_id", "ops_agent_versions", "fk_ops_runs_version_org"),
        sa.UniqueConstraint("organization_id", "external_id", name="uq_ops_runs_org_external_id"),
        sa.CheckConstraint(_in("status", ["succeeded", "failed", "timeout", "cancelled"]), name="status"),
        sa.CheckConstraint(
            _in(
                "error_category",
                ["provider_error", "rate_limit", "timeout", "tool_error", "validation", "policy_block", "other"],
                nullable=True,
            ),
            name="error_category",
        ),
        sa.CheckConstraint(_in("source", ["synthetic", "manual_import"]), name="source"),
        sa.CheckConstraint("duration_ms >= 0 AND input_tokens >= 0 AND output_tokens >= 0", name="counters"),
        sa.CheckConstraint("status = 'succeeded' OR error_category IS NOT NULL", name="error_needs_category"),
    )
    op.create_table(
        "ops_budgets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("agent_id", sa.Uuid()),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("warn_percent", sa.Integer(), nullable=False),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        _tfk("agent_id", "ops_agents", "fk_ops_budgets_agent_org"),
        sa.CheckConstraint("amount > 0", name="amount"),
        sa.CheckConstraint("warn_percent BETWEEN 1 AND 100", name="warn_percent"),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency"),
    )
    op.create_table(
        "ops_threshold_rules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("agent_id", sa.Uuid()),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("metric", sa.String(24), nullable=False),
        sa.Column("threshold", sa.Numeric(14, 4), nullable=False),
        sa.Column("window_days", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        _tfk("agent_id", "ops_agents", "fk_ops_threshold_rules_agent_org"),
        sa.CheckConstraint(
            _in("metric", ["error_rate_percent", "avg_duration_ms", "tokens", "estimated_cost"]), name="metric"
        ),
        sa.CheckConstraint("window_days BETWEEN 1 AND 90", name="window_days"),
        sa.CheckConstraint("threshold >= 0", name="threshold"),
    )
    op.create_table(
        "ops_retention_policies",
        sa.Column(
            "organization_id", sa.Uuid(), sa.ForeignKey("ops_organizations.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("runs_days", sa.Integer(), nullable=False),
        sa.Column("eval_results_days", sa.Integer(), nullable=False),
        _user("updated_by"),
        sa.Column("updated_at", TS, nullable=False),
        sa.CheckConstraint("runs_days BETWEEN 7 AND 730", name="runs_days"),
        sa.CheckConstraint("eval_results_days BETWEEN 30 AND 1095", name="eval_results_days"),
    )

    # ------------------------------------------------------- incidents and changes
    op.create_table(
        "ops_incidents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Uuid()),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("severity", sa.String(8), nullable=False),
        sa.Column("impact", sa.String(20), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("client_summary", sa.String(1000)),
        _user("owner_user_id"),
        sa.Column("rollback_version_id", sa.Uuid()),
        sa.Column("detected_at", TS, nullable=False),
        sa.Column("triaged_at", TS),
        sa.Column("investigating_at", TS),
        sa.Column("mitigated_at", TS),
        sa.Column("resolved_at", TS),
        sa.Column("reviewed_at", TS),
        sa.Column("lock_version", sa.Integer(), nullable=False),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        _tfk("agent_id", "ops_agents", "fk_ops_incidents_agent_org", ondelete="SET NULL (agent_id)"),
        _tfk("rollback_version_id", "ops_agent_versions", "fk_ops_incidents_rollback", ondelete="NO ACTION"),
        sa.UniqueConstraint("organization_id", "number", name="uq_ops_incidents_org_number"),
        sa.UniqueConstraint("id", "organization_id", name="uq_ops_incidents_id_org"),
        sa.CheckConstraint(_in("severity", ["sev1", "sev2", "sev3", "sev4"]), name="severity"),
        sa.CheckConstraint(
            _in("impact", ["customer_facing", "internal", "cost", "security", "data_quality"]), name="impact"
        ),
        sa.CheckConstraint(
            _in("status", ["detected", "triaged", "investigating", "mitigated", "resolved", "reviewed"]), name="status"
        ),
    )
    _event_table("ops_incident_events", "incident_id", "ops_incidents")
    op.create_table(
        "ops_changes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("agent_version_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("risk", sa.String(8), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("risk_notes", sa.String(2000)),
        sa.Column("release_note", sa.String(1000)),
        sa.Column("evaluation_run_id", sa.Uuid()),
        sa.Column("rollback_version_id", sa.Uuid()),
        _user("owner_user_id"),
        _user("approved_by"),
        sa.Column("approved_at", TS),
        sa.Column("released_at", TS),
        sa.Column("reviewed_at", TS),
        sa.Column("lock_version", sa.Integer(), nullable=False),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        _tfk("agent_id", "ops_agents", "fk_ops_changes_agent_org"),
        _tfk("agent_version_id", "ops_agent_versions", "fk_ops_changes_version_org", ondelete="NO ACTION"),
        _tfk("evaluation_run_id", "ops_eval_runs", "fk_ops_changes_eval_org", ondelete="NO ACTION"),
        _tfk("rollback_version_id", "ops_agent_versions", "fk_ops_changes_rollback", ondelete="NO ACTION"),
        sa.UniqueConstraint("organization_id", "number", name="uq_ops_changes_org_number"),
        sa.UniqueConstraint("id", "organization_id", name="uq_ops_changes_id_org"),
        sa.CheckConstraint(
            _in(
                "status",
                [
                    "draft",
                    "risk_review",
                    "evaluation",
                    "human_approval",
                    "approved",
                    "rejected",
                    "released",
                    "reviewed",
                ],
            ),
            name="status",
        ),
        sa.CheckConstraint(_in("risk", ["low", "medium", "high"]), name="risk"),
    )
    _event_table("ops_change_events", "change_id", "ops_changes")

    # ------------------------------------------------------------- client portal
    op.create_table(
        "portal_users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("mfa_nonce", sa.String(64)),
        sa.Column("mfa_enabled", sa.Boolean(), nullable=False),
        sa.Column("mfa_last_step", sa.BigInteger()),
        sa.Column("failed_login_count", sa.Integer(), nullable=False),
        sa.Column("locked_until", TS),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("activated_at", TS),
        sa.Column("last_login_at", TS),
        sa.UniqueConstraint("id", "organization_id", name="uq_portal_users_id_org"),
        sa.CheckConstraint(_in("status", ["invited", "active", "disabled"]), name="status"),
    )
    op.create_table(
        "portal_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("user_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("purpose", sa.String(12), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("used_at", TS),
        _user("created_by"),
        sa.Column("created_at", TS, nullable=False),
        _tfk("user_id", "portal_users", "fk_portal_tokens_user_org"),
        sa.CheckConstraint(_in("purpose", ["invitation", "recovery"]), name="purpose"),
    )
    op.create_table(
        "portal_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _org(),
        sa.Column("user_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("mfa_verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("last_seen_at", TS, nullable=False),
        sa.Column("revoked_at", TS),
        _tfk("user_id", "portal_users", "fk_portal_sessions_user_org"),
    )

    # ------------------------------------------------- immutability triggers
    op.execute(
        """
        CREATE FUNCTION ops_versions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF OLD.status <> 'draft' AND (
               NEW.prompt_template, NEW.provider, NEW.model, NEW.parameters, NEW.tools, NEW.content_hash,
               NEW.change_reason, NEW.agent_id, NEW.number, NEW.organization_id
             ) IS DISTINCT FROM (
               OLD.prompt_template, OLD.provider, OLD.model, OLD.parameters, OLD.tools, OLD.content_hash,
               OLD.change_reason, OLD.agent_id, OLD.number, OLD.organization_id
             ) THEN
            RAISE EXCEPTION 'ops_agent_versions: a % version is immutable', OLD.status USING ERRCODE = 'check_violation';
          END IF;
          RETURN NEW;
        END $$;
        CREATE TRIGGER trg_ops_agent_versions_immutable BEFORE UPDATE ON ops_agent_versions
          FOR EACH ROW EXECUTE FUNCTION ops_versions_immutable();

        CREATE FUNCTION ops_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION '%: timeline entries are append-only', TG_TABLE_NAME USING ERRCODE = 'check_violation';
        END $$;
        CREATE TRIGGER trg_ops_incident_events_append_only BEFORE UPDATE ON ops_incident_events
          FOR EACH ROW EXECUTE FUNCTION ops_events_append_only();
        CREATE TRIGGER trg_ops_change_events_append_only BEFORE UPDATE ON ops_change_events
          FOR EACH ROW EXECUTE FUNCTION ops_events_append_only();
        """
    )

    # ------------------------------------------------------- runtime role + RLS
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '__ROLE__') THEN
            CREATE ROLE __ROLE__ NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
          END IF;
        END $$;
        GRANT __ROLE__ TO CURRENT_USER;
        GRANT USAGE ON SCHEMA public TO __ROLE__;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO __ROLE__;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO __ROLE__;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO __ROLE__;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO __ROLE__;
        REVOKE UPDATE, DELETE ON audit_logs, ops_incident_events, ops_change_events FROM __ROLE__;
        REVOKE ALL ON alembic_version FROM __ROLE__;

        CREATE FUNCTION ops_current_org() RETURNS uuid LANGUAGE sql STABLE AS
          $f$ SELECT nullif(current_setting('app.ops_org', true), '')::uuid $f$;
        CREATE FUNCTION ops_current_user() RETURNS uuid LANGUAGE sql STABLE AS
          $f$ SELECT nullif(current_setting('app.ops_user', true), '')::uuid $f$;

        ALTER TABLE ops_organizations ENABLE ROW LEVEL SECURITY;
        CREATE POLICY ops_org_visible ON ops_organizations FOR SELECT USING (
          id = ops_current_org()
          OR EXISTS (SELECT 1 FROM ops_memberships m WHERE m.organization_id = ops_organizations.id
                     AND m.user_id = ops_current_user())
        );
        ALTER TABLE ops_memberships ENABLE ROW LEVEL SECURITY;
        CREATE POLICY ops_membership_tenant ON ops_memberships
          USING (organization_id = ops_current_org() OR user_id = ops_current_user())
          WITH CHECK (organization_id = ops_current_org());
        """.replace("__ROLE__", ROLE)
    )
    for table in TENANT_TABLES:
        op.execute(
            f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY; "
            f"CREATE POLICY {table}_tenant ON {table} USING (organization_id = ops_current_org()) "
            f"WITH CHECK (organization_id = ops_current_org());"  # noqa: S608 - fixed table names
        )


def downgrade() -> None:
    for table in [*TENANT_TABLES, "ops_memberships"]:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant ON {table}")
    op.execute("DROP POLICY IF EXISTS ops_membership_tenant ON ops_memberships")
    op.execute("DROP POLICY IF EXISTS ops_org_visible ON ops_organizations")
    for table in ["ops_organizations", "ops_memberships", "ops_workspaces", "ops_agents"]:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.drop_constraint("fk_ops_agent_versions_eval_run", "ops_agent_versions", type_="foreignkey")
    for table in reversed(NEW_TABLES):
        op.drop_table(table)
    op.execute("DROP FUNCTION IF EXISTS ops_versions_immutable(); DROP FUNCTION IF EXISTS ops_events_append_only();")
    op.execute("DROP FUNCTION IF EXISTS ops_current_org(); DROP FUNCTION IF EXISTS ops_current_user();")
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {ROLE}; "
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {ROLE}; "
        f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {ROLE}; "
        f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {ROLE}; "
        f"REVOKE USAGE ON SCHEMA public FROM {ROLE};"
    )
    op.drop_constraint("uq_ops_agents_id_org", "ops_agents", type_="unique")
