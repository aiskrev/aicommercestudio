"""Initial schema: admin users & sessions, leads, notes, audit log, AI action approvals.

Revision ID: 0001
Revises:
Create Date: 2026-10-23
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEAD_STATUSES = "'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'"
SERVICES = "'maintenance', 'seo', 'ai_tools', 'automation', 'analytics', 'integrations', 'audit', 'other'"
AI_STATUSES = "'PENDING', 'APPROVED', 'REJECTED', 'EXECUTED'"


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_admin_users"),
        sa.UniqueConstraint("email", name="uq_admin_users_email"),
    )

    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["admin_users.id"], name="fk_admin_sessions_user_id_admin_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_admin_sessions"),
        sa.UniqueConstraint("token_hash", name="uq_admin_sessions_token_hash"),
    )
    op.create_index("ix_admin_sessions_user_id", "admin_sessions", ["user_id"])
    op.create_index("ix_admin_sessions_expires_at", "admin_sessions", ["expires_at"])

    op.create_table(
        "leads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("service", sa.String(32), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("company", sa.String(160), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("privacy_acknowledged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("privacy_notice_version", sa.String(32), nullable=False),
        sa.Column("marketing_consent", sa.Boolean(), nullable=False),
        sa.Column("marketing_consent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(f"status IN ({LEAD_STATUSES})", name="ck_leads_status"),
        sa.CheckConstraint(f"service IN ({SERVICES})", name="ck_leads_service"),
        sa.PrimaryKeyConstraint("id", name="pk_leads"),
    )
    op.create_index("ix_leads_created_at", "leads", ["created_at"])
    op.create_index("ix_leads_status", "leads", ["status"])
    op.create_index("ix_leads_updated_at", "leads", ["updated_at"])

    op.create_table(
        "lead_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], name="fk_lead_notes_lead_id_leads", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["author_id"], ["admin_users.id"], name="fk_lead_notes_author_id_admin_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_lead_notes"),
    )
    op.create_index("ix_lead_notes_lead_id", "lead_notes", ["lead_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_label", sa.String(254), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=True),
        sa.Column("entity_id", sa.String(64), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["admin_users.id"], name="fk_audit_logs_actor_id_admin_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
    )
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])

    op.create_table(
        "ai_action_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("action_type", sa.String(64), nullable=False),
        sa.Column("risk_level", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("requested_by", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_by_id", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_comment", sa.Text(), nullable=True),
        sa.CheckConstraint(f"status IN ({AI_STATUSES})", name="ck_ai_action_requests_status"),
        sa.ForeignKeyConstraint(
            ["decided_by_id"], ["admin_users.id"], name="fk_ai_action_requests_decided_by_id_admin_users",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_ai_action_requests"),
    )
    op.create_index("ix_ai_action_requests_status", "ai_action_requests", ["status"])


def downgrade() -> None:
    op.drop_table("ai_action_requests")
    op.drop_table("audit_logs")
    op.drop_table("lead_notes")
    op.drop_table("leads")
    op.drop_table("admin_sessions")
    op.drop_table("admin_users")
