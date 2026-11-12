"""Project documents, their versions, approval requests and feedback (docs/PROJECT_DOCUMENTS.md).

A document belongs to one commercial project and so to one customer workspace; every access goes through the project
and its workspace, so a document id alone opens nothing. A document has numbered, immutable versions: a new file is a
new version, never an overwrite. The bytes live in private storage (`app/projects/storage.py`) under a random key; the
database holds only the key, the size and the SHA-256, never a path or a URL.

An approval request asks the customer to approve or reject one *published* version. The decision records who (the
customer's account), which project, which version, what and when, and it cannot be changed afterwards.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import TZDateTime, utcnow

CATEGORIES = ("brief", "design", "deliverable", "contract", "report", "feedback", "other")
#: What a customer may upload (a brief, material, a marked-up file); the rest is the team's.
CLIENT_CATEGORIES = ("brief", "feedback", "other")
ORIGINS = ("staff", "client")
VERSION_STATES = ("draft", "published", "withdrawn")
SCAN_STATES = ("not_scanned", "clean", "infected", "failed")
APPROVAL_STATES = ("pending", "approved", "rejected", "withdrawn", "superseded")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


class ProjectDocument(Base):
    __tablename__ = "project_documents"
    __table_args__ = (
        CheckConstraint(_in("category", CATEGORIES), name="category"),
        CheckConstraint(_in("origin", ORIGINS), name="origin"),
        CheckConstraint("revision >= 1", name="revision"),
        Index("ix_project_documents_project", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("commercial_projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(16), nullable=False)
    origin: Mapped[str] = mapped_column(String(8), nullable=False)
    created_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("customer_accounts.id", ondelete="SET NULL"), nullable=True
    )
    archived_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    #: After this date the bytes may be deleted by `project-documents-purge`; the records stay.
    retain_until: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow, onupdate=utcnow)


class ProjectDocumentVersion(Base):
    __tablename__ = "project_document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "number", name="uq_project_document_versions_number"),
        UniqueConstraint("storage_key", name="uq_project_document_versions_key"),
        CheckConstraint(_in("state", VERSION_STATES), name="state"),
        CheckConstraint(_in("scan_status", SCAN_STATES), name="scan_status"),
        CheckConstraint(_in("uploaded_by_kind", ORIGINS), name="uploaded_by_kind"),
        CheckConstraint("number >= 1", name="number"),
        CheckConstraint("size_bytes > 0", name="size"),
        CheckConstraint("char_length(sha256) = 64", name="sha256"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    filename: Mapped[str] = mapped_column(String(160), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    #: Random, made by the server; never derived from anything a person typed.
    storage_key: Mapped[str] = mapped_column(String(120), nullable=False)
    scan_status: Mapped[str] = mapped_column(String(12), nullable=False, default="not_scanned")
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    state: Mapped[str] = mapped_column(String(10), nullable=False, default="draft")
    uploaded_by_kind: Mapped[str] = mapped_column(String(8), nullable=False)
    uploaded_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_by_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("customer_accounts.id", ondelete="SET NULL"), nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    published_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    scanned_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    purged_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class DocumentApproval(Base):
    __tablename__ = "document_approvals"
    __table_args__ = (
        CheckConstraint(_in("state", APPROVAL_STATES), name="state"),
        # Only a decided request carries a decision time.
        CheckConstraint("(state IN ('approved', 'rejected')) = (decided_at IS NOT NULL)", name="decided"),
        # A version has at most one open request: asking twice returns the first one.
        Index(
            "uq_document_approvals_pending",
            "version_id",
            unique=True,
            postgresql_where=text("state = 'pending'"),
        ),
        Index("ix_document_approvals_project", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("commercial_projects.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=False
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("project_document_versions.id", ondelete="CASCADE"), nullable=False
    )
    requested_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    state: Mapped[str] = mapped_column(String(12), nullable=False, default="pending")
    decided_by_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("customer_accounts.id", ondelete="SET NULL"), nullable=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class DocumentComment(Base):
    __tablename__ = "document_comments"
    __table_args__ = (
        CheckConstraint("author_kind IN ('staff', 'client')", name="author_kind"),
        Index("ix_document_comments_document", "document_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("project_documents.id", ondelete="CASCADE"), nullable=False
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("project_document_versions.id", ondelete="CASCADE"), nullable=False
    )
    author_kind: Mapped[str] = mapped_column(String(8), nullable=False)
    author_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    author_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("customer_accounts.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
