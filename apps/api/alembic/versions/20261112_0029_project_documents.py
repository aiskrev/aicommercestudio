"""Project documents, versions, approvals and feedback (commercial expansion, Phase 10).

Additive: four new tables. Documents belong to a commercial project (so to one customer workspace); each has numbered,
immutable versions that point at a private storage key. An approval request asks the customer to decide on one
published version; the decision is a record that is never changed afterwards. Nothing here is deleted by the API role:
retention removes the stored bytes (`purged_at`) and keeps the records. The runtime role has no access.

Revision ID: 0029
Revises: 0028
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

API = "acs_app_api"
RUNTIME = "acs_app_runtime"
TS = sa.DateTime(timezone=True)

CATEGORIES = ("brief", "design", "deliverable", "contract", "report", "feedback", "other")
VERSION_STATES = ("draft", "published", "withdrawn")
SCAN_STATES = ("not_scanned", "clean", "infected", "failed")
APPROVAL_STATES = ("pending", "approved", "rejected", "withdrawn", "superseded")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def upgrade() -> None:
    op.create_table(
        "project_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("commercial_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("category", sa.String(16), nullable=False),
        sa.Column("origin", sa.String(8), nullable=False),
        sa.Column("created_by_admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("created_by_account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("archived_at", TS),
        sa.Column("retain_until", TS),
        sa.Column("revision", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(_in("category", CATEGORIES), name="category"),
        sa.CheckConstraint("origin IN ('staff', 'client')", name="origin"),
        sa.CheckConstraint("revision >= 1", name="revision"),
    )
    op.create_index("ix_project_documents_project", "project_documents", ["project_id", "created_at"])

    op.create_table(
        "project_document_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(160), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("storage_key", sa.String(120), nullable=False),
        sa.Column("scan_status", sa.String(12), nullable=False, server_default=sa.text("'not_scanned'")),
        sa.Column("note", sa.String(300)),
        sa.Column("state", sa.String(10), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("uploaded_by_kind", sa.String(8), nullable=False),
        sa.Column("uploaded_by_admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("uploaded_by_account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("published_at", TS),
        sa.Column("published_by_admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("scanned_at", TS),
        sa.Column("purged_at", TS),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("document_id", "number", name="uq_project_document_versions_number"),
        sa.UniqueConstraint("storage_key", name="uq_project_document_versions_key"),
        sa.CheckConstraint(_in("state", VERSION_STATES), name="state"),
        sa.CheckConstraint(_in("scan_status", SCAN_STATES), name="scan_status"),
        sa.CheckConstraint("uploaded_by_kind IN ('staff', 'client')", name="uploaded_by_kind"),
        sa.CheckConstraint("number >= 1", name="number"),
        sa.CheckConstraint("size_bytes > 0", name="size"),
        sa.CheckConstraint("char_length(sha256) = 64", name="sha256"),
    )

    op.create_table(
        "document_approvals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("commercial_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "version_id", sa.Uuid(), sa.ForeignKey("project_document_versions.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("requested_by_admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("message", sa.String(500)),
        sa.Column("state", sa.String(12), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("decided_by_account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("decided_at", TS),
        sa.Column("decision_note", sa.Text()),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(_in("state", APPROVAL_STATES), name="state"),
        sa.CheckConstraint("(state IN ('approved', 'rejected')) = (decided_at IS NOT NULL)", name="decided"),
    )
    op.create_index(
        "uq_document_approvals_pending",
        "document_approvals",
        ["version_id"],
        unique=True,
        postgresql_where=sa.text("state = 'pending'"),
    )
    op.create_index("ix_document_approvals_project", "document_approvals", ["project_id", "created_at"])

    op.create_table(
        "document_comments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "version_id", sa.Uuid(), sa.ForeignKey("project_document_versions.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("author_kind", sa.String(8), nullable=False),
        sa.Column("author_admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL")),
        sa.Column("author_account_id", sa.Uuid(), sa.ForeignKey("customer_accounts.id", ondelete="SET NULL")),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("author_kind IN ('staff', 'client')", name="author_kind"),
    )
    op.create_index("ix_document_comments_document", "document_comments", ["document_id", "created_at"])

    for table in ("project_documents", "project_document_versions", "document_approvals", "document_comments"):
        op.execute(f"REVOKE ALL ON {table} FROM {RUNTIME}")
        op.execute(f"REVOKE ALL ON {table} FROM {API}")
    op.execute(
        f"GRANT SELECT, INSERT, UPDATE ON project_documents, project_document_versions, document_approvals TO {API}"
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON document_comments TO {API}")


def downgrade() -> None:
    op.drop_index("ix_document_comments_document", table_name="document_comments")
    op.drop_table("document_comments")
    op.drop_index("ix_document_approvals_project", table_name="document_approvals")
    op.drop_index("uq_document_approvals_pending", table_name="document_approvals")
    op.drop_table("document_approvals")
    op.drop_table("project_document_versions")
    op.drop_index("ix_project_documents_project", table_name="project_documents")
    op.drop_table("project_documents")
