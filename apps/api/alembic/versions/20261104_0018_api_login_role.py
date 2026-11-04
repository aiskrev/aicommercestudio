"""Closes H-1: a login role for the API that owns nothing and cannot bypass row-level security.

* `acs_app_api`: the role the API connects as. NOBYPASSRLS, owns nothing, no DDL. It has no privilege
  on tenant tables at all, so code that reads them outside a tenant binding fails loudly.
* `acs_app_bootstrap`: NOLOGIN. The only way to read portal identities before the tenant is known
  (a sign-in, a session or a one-time link). Its policies cover those three tables and nothing else.

`acs_app_api` starts as NOLOGIN. `python -m app.cli db-api-role` gives it a password from
API_DB_PASSWORD, so no secret is in a migration. Until then the API keeps connecting as the owner.

The audit log stays append-only for the API. The retention job in the staff panel removes entries past
the retention period through `acs_purge_audit_logs`, the one narrow way to delete them.

Revision ID: 0018
Revises: 0017
Create Date: 2026-11-04
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
BOOTSTRAP = "acs_app_bootstrap"
RUNTIME = "acs_app_runtime"
PORTAL_IDENTITY = ("portal_users", "portal_tokens", "portal_sessions")
TENANT = (
    "ops_organizations",
    "ops_memberships",
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
    *PORTAL_IDENTITY,
)
APPEND_ONLY = ("audit_logs",)
NOT_FOR_API = ("alembic_version", *TENANT, *APPEND_ONLY)


def _quoted(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def upgrade() -> None:
    for role in (API, BOOTSTRAP):
        op.execute(
            f"""
            DO $$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN
                CREATE ROLE {role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
              END IF;
            END $$;
            """  # noqa: S608 - fixed identifiers
        )
    op.execute(
        f"""
        GRANT {RUNTIME}, {BOOTSTRAP} TO {API};
        GRANT {BOOTSTRAP} TO CURRENT_USER;
        GRANT USAGE ON SCHEMA public TO {API}, {BOOTSTRAP};
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {API};
        GRANT SELECT, INSERT ON audit_logs TO {API}, {BOOTSTRAP};
        GRANT USAGE, SELECT ON SEQUENCE audit_logs_id_seq TO {BOOTSTRAP};
        GRANT SELECT ON ops_organizations TO {BOOTSTRAP};
        GRANT SELECT, INSERT, UPDATE ON {", ".join(PORTAL_IDENTITY)} TO {BOOTSTRAP};
        CREATE POLICY ops_organizations_bootstrap ON ops_organizations FOR SELECT TO {BOOTSTRAP} USING (true);
        DO $$
        DECLARE item record;
        BEGIN
          FOR item IN
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename NOT IN ({_quoted(NOT_FOR_API)})
          LOOP
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO {API}', item.tablename);
          END LOOP;
        END $$;
        """  # noqa: S608 - fixed identifiers
    )
    for table in PORTAL_IDENTITY:
        op.execute(f"CREATE POLICY {table}_bootstrap ON {table} TO {BOOTSTRAP} USING (true) WITH CHECK (true)")
    op.execute(
        f"""
        CREATE FUNCTION acs_purge_audit_logs(cutoff timestamptz) RETURNS void
          LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
          AS $f$ DELETE FROM audit_logs WHERE created_at < cutoff $f$;
        REVOKE ALL ON FUNCTION acs_purge_audit_logs(timestamptz) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION acs_purge_audit_logs(timestamptz) TO {API};
        """  # noqa: S608 - fixed identifiers
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION acs_purge_audit_logs(timestamptz)")
    for table in PORTAL_IDENTITY:
        op.execute(f"DROP POLICY {table}_bootstrap ON {table}")
    op.execute("DROP POLICY ops_organizations_bootstrap ON ops_organizations")
    # Roles belong to the cluster, not this database, so they stay; only their rights here go.
    for role in (API, BOOTSTRAP):
        op.execute(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role}")
        op.execute(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {role}")
        op.execute(f"REVOKE USAGE ON SCHEMA public FROM {role}")
