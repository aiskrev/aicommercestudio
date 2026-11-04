"""Accounting documents (docs/INVOICING.md). One row per document, keyed by what caused it.

`source_key` is unique, so a repeated webhook cannot issue twice. `buyer` and `tax` are copied when the
document is created: a later profile change never reaches it. Once issued, a database trigger refuses
any change, and the API role cannot delete these rows.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import utcnow

TS = DateTime(timezone=True)


class DocumentKind(enum.StrEnum):
    PROFORMA = "proforma"
    INVOICE = "invoice"
    CREDIT_NOTE = "credit_note"


class DocumentStatus(enum.StrEnum):
    QUEUED = "queued"
    ISSUED = "issued"
    FAILED = "failed"
    BLOCKED = "blocked"


class BillingProfile(Base):
    """Invoice details, asked for only when needed. Changing them affects future documents only."""

    __tablename__ = "billing_profiles"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    legal_name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_id: Mapped[str | None] = mapped_column(String(40))
    vat_id: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow, onupdate=utcnow)


class TaxScenario(Base):
    """What the accountant confirmed for a sale type. An absent row means selling it is blocked."""

    __tablename__ = "tax_scenarios"

    key: Mapped[str] = mapped_column(String(20), primary_key=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    confirmed_by: Mapped[str] = mapped_column(String(120), nullable=False)
    confirmed_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)


class AccountingDocument(Base):
    __tablename__ = "accounting_documents"
    __table_args__ = (
        CheckConstraint("kind IN ('proforma', 'invoice', 'credit_note')", name="kind"),
        CheckConstraint("status IN ('queued', 'issued', 'failed', 'blocked')", name="status"),
        Index("ix_accounting_documents_workspace", "workspace_id", "created_at"),
        Index("ix_accounting_documents_due", "status", "next_attempt_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    status: Mapped[str] = mapped_column(String(8), nullable=False, default=DocumentStatus.QUEUED.value)
    source_key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounting_documents.id", ondelete="RESTRICT"))
    provider: Mapped[str | None] = mapped_column(String(20))
    provider_document_id: Mapped[str | None] = mapped_column(String(100))
    number: Mapped[str | None] = mapped_column(String(40))
    demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    stripe_payment_ref: Mapped[str | None] = mapped_column(String(100))
    stripe_invoice_id: Mapped[str | None] = mapped_column(String(100))
    stripe_refund_ref: Mapped[str | None] = mapped_column(String(100))
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    buyer: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    tax: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    last_error: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    issued_at: Mapped[datetime | None] = mapped_column(TS)
    # Stays empty until the accountant confirms a retention period. Account deletion doesn't use it.
    retain_until: Mapped[date | None] = mapped_column(Date)
