"""Engineering opportunity workflow: the workshop an enquiry is about, the opportunity record, proposal
and SOW drafts with append-only versions.

* `leads.workshop_key` — the catalogue workshop or assessment an enquiry was sent about (nullable).
* `lead_opportunities` — one row per lead: domain, problem and scope, discovery and qualification
  status with rationale, constraints, explicitly provided stakeholders, next action, recommendation.
* `lead_proposals` / `lead_proposal_versions` — proposal and SOW drafts. Versions are append-only
  (trigger); approval is a recorded human decision.
* Everything cascades from `leads`, so erasure and the lead retention policy remove it with the lead.
* Least privilege: the Ops runtime role (`acs_app_runtime`, used only inside tenant-scoped Ops
  transactions) loses every privilege on the lead tables, which hold personal data and are not
  tenant data. Admin routes run as the schema owner, as before.

Backward compatible: one nullable column and new tables. Downgrade drops them and restores the
runtime role's earlier grants on the existing lead tables.

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-03
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE = "acs_app_runtime"
JSONB = postgresql.JSONB(astext_type=sa.Text())
TS = sa.DateTime(timezone=True)

WORKSHOPS = (
    "ai_strategy_discovery",
    "ai_readiness_mapping",
    "agent_architecture",
    "landing_zone_assessment",
    "kubernetes_review",
    "devops_gitops_assessment",
    "observability_sre",
    "ecommerce_integration_discovery",
    "rag_data_readiness",
    "responsible_ai_review",
)
DOMAINS = (
    "ai_strategy",
    "ai_agents_automation",
    "ai_applications",
    "commerce_engineering",
    "cloud_platform",
    "devops_sre",
    "data_integration",
    "ai_governance",
    "managed_operations",
    "advisory_enablement",
)
TOOLS = (
    "advisor",
    "readiness",
    "team",
    "roi",
    "finder",
    "solution",
    "agents",
    "cloud_maturity",
    "devops_maturity",
    "observability",
    "ecommerce_architecture",
    "data_integration",
    "ai_governance",
    "ai_ops_readiness",
    "finops",
)
LEAD_TABLES = (
    "leads",
    "lead_notes",
    "lead_opportunities",
    "lead_proposals",
    "lead_proposal_versions",
    "advisor_assessments",
    "team_configurations",
    "assessment_results",
)


def _in(column: str, values: Sequence[str], nullable: bool = False) -> str:
    check = f"{column} IN ({', '.join(repr(v) for v in values)})"
    return f"{column} IS NULL OR {check}" if nullable else check


def _if_role(statement: str) -> str:
    """Run a fixed GRANT/REVOKE only where the runtime role exists (fixed identifiers, no input)."""
    return "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '__ROLE__') THEN __STMT__ END IF; END $$;".replace(
        "__ROLE__", ROLE
    ).replace("__STMT__", statement)


def upgrade() -> None:
    op.add_column("leads", sa.Column("workshop_key", sa.String(48), nullable=True))
    op.create_check_constraint("workshop_key", "leads", _in("workshop_key", WORKSHOPS, nullable=True))

    op.create_table(
        "lead_opportunities",
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("service_domain", sa.String(32), nullable=True),
        sa.Column("problem_summary", sa.Text(), nullable=True),
        sa.Column("scope_summary", sa.Text(), nullable=True),
        sa.Column("discovery_status", sa.String(16), nullable=False),
        sa.Column("qualification_status", sa.String(16), nullable=False),
        sa.Column("qualification_rationale", sa.Text(), nullable=True),
        sa.Column("technical_constraints", sa.Text(), nullable=True),
        sa.Column("stakeholders", JSONB, nullable=False),
        sa.Column("next_action", sa.String(300), nullable=True),
        sa.Column("next_action_due", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recommended_workshop", sa.String(48), nullable=True),
        sa.Column("recommended_assessment", sa.String(32), nullable=True),
        sa.Column("recommendation_rationale", sa.Text(), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        sa.Column("updated_by_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint(_in("service_domain", DOMAINS, nullable=True), name="service_domain"),
        sa.CheckConstraint(
            _in("discovery_status", ("not_started", "scheduled", "in_progress", "completed", "not_needed")),
            name="discovery_status",
        ),
        sa.CheckConstraint(
            _in("qualification_status", ("unassessed", "qualified", "not_qualified", "on_hold")),
            name="qualification_status",
        ),
        sa.CheckConstraint(_in("recommended_workshop", WORKSHOPS, nullable=True), name="recommended_workshop"),
        sa.CheckConstraint(_in("recommended_assessment", TOOLS, nullable=True), name="recommended_assessment"),
        sa.CheckConstraint("revision >= 1", name="revision"),
    )
    op.create_index("ix_lead_opportunities_qualification_status", "lead_opportunities", ["qualification_status"])

    op.create_table(
        "lead_proposals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("lead_id", sa.Uuid(), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decided_by_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("approved_version", sa.Integer(), nullable=True),
        sa.Column("approved_at", TS, nullable=True),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("updated_at", TS, nullable=False),
        sa.CheckConstraint(_in("kind", ("proposal", "sow")), name="kind"),
        sa.CheckConstraint(_in("status", ("draft", "in_review", "approved", "rejected", "withdrawn")), name="status"),
        sa.CheckConstraint("revision >= 1", name="revision"),
        sa.CheckConstraint("current_version >= 1", name="current_version"),
        sa.CheckConstraint(
            "(status = 'approved') = (approved_version IS NOT NULL AND approved_at IS NOT NULL)", name="approval"
        ),
    )
    op.create_index("ix_lead_proposals_lead_id", "lead_proposals", ["lead_id"])

    op.create_table(
        "lead_proposal_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("proposal_id", sa.Uuid(), sa.ForeignKey("lead_proposals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("content", JSONB, nullable=False),
        sa.Column("change_note", sa.String(500), nullable=True),
        sa.Column("author_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", TS, nullable=False),
        sa.UniqueConstraint("proposal_id", "number", name="uq_lead_proposal_versions_number"),
        sa.CheckConstraint(_in("origin", ("human", "generated_draft")), name="origin"),
        sa.CheckConstraint("number >= 1", name="number"),
    )

    # Versions are history: a row is never rewritten. DELETE stays possible for the lead cascade
    # (erasure, retention); the SET NULL of a removed author is the one update that is allowed.
    op.execute(
        """
        CREATE FUNCTION lead_proposal_versions_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF (NEW.proposal_id, NEW.number, NEW.origin, NEW.content, NEW.change_note, NEW.created_at)
             IS DISTINCT FROM (OLD.proposal_id, OLD.number, OLD.origin, OLD.content, OLD.change_note, OLD.created_at)
             OR (NEW.author_id IS NOT NULL AND NEW.author_id IS DISTINCT FROM OLD.author_id) THEN
            RAISE EXCEPTION 'lead_proposal_versions: versions are append-only' USING ERRCODE = 'check_violation';
          END IF;
          RETURN NEW;
        END $$;
        CREATE TRIGGER trg_lead_proposal_versions_append_only BEFORE UPDATE ON lead_proposal_versions
          FOR EACH ROW EXECUTE FUNCTION lead_proposal_versions_append_only();
        """
    )

    # The Ops runtime role never needs personal data from the lead tables.
    op.execute(_if_role(f"REVOKE ALL ON {', '.join(LEAD_TABLES)} FROM {ROLE};"))


def downgrade() -> None:
    # The grants 0013 gave on the tables that existed before this revision.
    earlier = ", ".join(
        t for t in LEAD_TABLES if t not in ("lead_opportunities", "lead_proposals", "lead_proposal_versions")
    )
    op.execute(_if_role(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {earlier} TO {ROLE};"))
    op.drop_table("lead_proposal_versions")
    op.execute("DROP FUNCTION IF EXISTS lead_proposal_versions_append_only()")
    op.drop_table("lead_proposals")
    op.drop_index("ix_lead_opportunities_qualification_status", table_name="lead_opportunities")
    op.drop_table("lead_opportunities")
    op.drop_constraint("workshop_key", "leads", type_="check")
    op.drop_column("leads", "workshop_key")
