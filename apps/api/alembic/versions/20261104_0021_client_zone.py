"""Client zone: members, invitations, support requests, billing profiles and accounting documents.

Additive. No tax scenario is seeded: a sale stays blocked until the accountant confirms one. The trigger
keeps an issued document unchanged, and the API role has no DELETE on documents.

Revision ID: 0021
Revises: 0020
Create Date: 2026-11-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)
TABLES = (
    "workspace_members",
    "workspace_invitations",
    "support_requests",
    "billing_profiles",
    "tax_scenarios",
    "accounting_documents",
)


def _workspace(ondelete: str = "CASCADE", primary: bool = False) -> sa.Column:
    return sa.Column(
        "workspace_id",
        sa.Uuid(),
        sa.ForeignKey("customer_workspaces.id", ondelete=ondelete),
        primary_key=primary,
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "workspace_members",
        _workspace(primary=True),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.CheckConstraint("role IN ('billing', 'member')", name="role"),
    )
    op.create_table(
        "workspace_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _workspace(),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("used_at", TS),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_table(
        "support_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _workspace(),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("subject", sa.String(160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", TS, nullable=False),
    )
    op.create_index("ix_support_requests_workspace", "support_requests", ["workspace_id"])
    op.create_table(
        "billing_profiles",
        _workspace(primary=True),
        sa.Column("legal_name", sa.String(200), nullable=False),
        sa.Column("company_id", sa.String(40)),
        sa.Column("vat_id", sa.String(40)),
        sa.Column("address", sa.String(300), nullable=False),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("updated_at", TS, nullable=False),
    )
    op.create_table(
        "tax_scenarios",
        sa.Column("key", sa.String(20), primary_key=True),
        sa.Column("config", JSONB(), nullable=False),
        sa.Column("confirmed_by", sa.String(120), nullable=False),
        sa.Column("confirmed_at", TS, nullable=False),
    )
    op.create_table(
        "accounting_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _workspace("RESTRICT"),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("status", sa.String(8), nullable=False),
        sa.Column("source_key", sa.String(120), nullable=False, unique=True),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("accounting_documents.id", ondelete="RESTRICT")),
        sa.Column("provider", sa.String(20)),
        sa.Column("provider_document_id", sa.String(100)),
        sa.Column("number", sa.String(40)),
        sa.Column("demo", sa.Boolean(), nullable=False),
        sa.Column("stripe_payment_ref", sa.String(100)),
        sa.Column("stripe_invoice_id", sa.String(100)),
        sa.Column("stripe_refund_ref", sa.String(100)),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.String(200), nullable=False),
        sa.Column("buyer", JSONB(), nullable=False),
        sa.Column("tax", JSONB(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", TS, nullable=False),
        sa.Column("last_error", sa.String(60)),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("issued_at", TS),
        sa.Column("retain_until", sa.Date()),
        sa.CheckConstraint("kind IN ('proforma', 'invoice', 'credit_note')", name="kind"),
        sa.CheckConstraint("status IN ('queued', 'issued', 'failed', 'blocked')", name="status"),
    )
    op.create_index("ix_accounting_documents_workspace", "accounting_documents", ["workspace_id", "created_at"])
    op.create_index("ix_accounting_documents_due", "accounting_documents", ["status", "next_attempt_at"])
    op.execute(
        """
        CREATE FUNCTION acs_keep_issued_document() RETURNS trigger LANGUAGE plpgsql AS $f$
        BEGIN
          IF OLD.status = 'issued' THEN
            RAISE EXCEPTION 'an issued accounting document cannot be changed';
          END IF;
          RETURN NEW;
        END $f$;
        CREATE TRIGGER accounting_documents_issued BEFORE UPDATE ON accounting_documents
          FOR EACH ROW EXECUTE FUNCTION acs_keep_issued_document();
        """
    )
    op.execute(f"REVOKE ALL ON {', '.join(TABLES)} FROM {RUNTIME}")
    op.execute(f"GRANT SELECT ON tax_scenarios TO {API}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON accounting_documents TO {API}")
    op.execute(
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_members, workspace_invitations, support_requests, "
        f"billing_profiles TO {API}"
    )


def downgrade() -> None:
    op.drop_table("accounting_documents")
    op.execute("DROP FUNCTION acs_keep_issued_document()")
    for table in (
        "tax_scenarios",
        "billing_profiles",
        "support_requests",
        "workspace_invitations",
        "workspace_members",
    ):
        op.drop_table(table)
