"""Evidence tables: what was shown and accepted (legal_events), withdrawal requests and data-subject requests.

No IP address, user agent or free text beyond what the person wrote in their own statement is stored here.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import utcnow

TS = DateTime(timezone=True)

EVENT_ACTIONS = ("acknowledged", "accepted", "consented", "withdrawn", "requested")
WITHDRAWAL_STATUSES = ("received", "refund_review", "refunded", "closed")
DATA_REQUEST_KINDS = ("export", "deletion", "correction", "restriction", "objection")
DATA_REQUEST_STATUSES = ("open", "done", "rejected")


class LegalEvent(Base):
    """One acknowledgement, acceptance or consent change, with the version of the text that was shown.

    History is kept: a withdrawal adds a row, it never edits the consent row. Exactly one subject is set.
    """

    __tablename__ = "legal_events"
    __table_args__ = (
        CheckConstraint("action IN ('acknowledged', 'accepted', 'consented', 'withdrawn', 'requested')", name="action"),
        CheckConstraint(
            "(lead_id IS NOT NULL)::int + (account_id IS NOT NULL)::int + (checkout_id IS NOT NULL)::int "
            "+ (withdrawal_id IS NOT NULL)::int = 1",
            name="one_subject",
        ),
        Index("ix_legal_events_lead", "lead_id"),
        Index("ix_legal_events_account", "account_id"),
        Index("ix_legal_events_checkout", "checkout_id"),
        Index(
            "uq_legal_events_checkout_once",
            "checkout_id",
            "document",
            "action",
            "version",
            unique=True,
            postgresql_where=text("checkout_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_accounts.id", ondelete="CASCADE"))
    checkout_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("billing_checkouts.id", ondelete="RESTRICT"))
    withdrawal_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("withdrawal_requests.id", ondelete="RESTRICT"))
    document: Mapped[str] = mapped_column(String(24), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    locale: Mapped[str | None] = mapped_column(String(2))
    action: Mapped[str] = mapped_column(String(14), nullable=False)
    # A short fixed label of the context ("contact_form", "registration", "checkout", "staff"); never free text.
    source: Mapped[str | None] = mapped_column(String(24))


class WithdrawalRequest(Base):
    """A consumer's statement that they withdraw from a contract (Directive 2011/83/EU; docs/LEGAL_COMPLIANCE...).

    The statement is always recorded; whether it is eligible and what is refunded is decided by staff, and no
    money moves automatically. `eligibility` is the system's first reading, not a decision.
    """

    __tablename__ = "withdrawal_requests"
    __table_args__ = (
        CheckConstraint("status IN ('received', 'refund_review', 'refunded', 'closed')", name="status"),
        CheckConstraint("customer_kind IN ('consumer', 'business')", name="customer_kind"),
        CheckConstraint(
            "eligibility IN ('within_period', 'period_expired', 'business_customer', 'unknown_contract_date')",
            name="eligibility",
        ),
        Index("ix_withdrawal_requests_workspace", "workspace_id", "status"),
        Index(
            "uq_withdrawal_requests_open",
            "workspace_id",
            "subject_ref",
            unique=True,
            postgresql_where=text("status IN ('received', 'refund_review')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(24), nullable=False, unique=True)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer_workspaces.id", ondelete="RESTRICT"), nullable=False
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_accounts.id", ondelete="SET NULL"))
    subject_kind: Mapped[str] = mapped_column(String(12), nullable=False)  # subscription | purchase
    subject_ref: Mapped[str] = mapped_column(String(100), nullable=False)  # Stripe subscription id or session id
    offer_key: Mapped[str] = mapped_column(String(40), nullable=False)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    customer_kind: Mapped[str] = mapped_column(String(10), nullable=False)
    early_start_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    contract_concluded_at: Mapped[datetime | None] = mapped_column(TS)
    period_ends_at: Mapped[datetime | None] = mapped_column(TS)
    eligibility: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(14), nullable=False, default="received")
    outcome_note: Mapped[str | None] = mapped_column(String(500))
    # Entered by staff after they refunded in Stripe; the system never refunds on its own.
    refund_reference: Mapped[str | None] = mapped_column(String(100))
    refund_amount_minor: Mapped[int | None] = mapped_column(BigInteger)
    confirmation_queued_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(TS)
    decided_by: Mapped[str | None] = mapped_column(String(120))


class DataRequest(Base):
    """A data-subject request made in the account area. Deletion is carried out by an administrator."""

    __tablename__ = "data_requests"
    __table_args__ = (
        CheckConstraint("kind IN ('export', 'deletion', 'correction', 'restriction', 'objection')", name="kind"),
        CheckConstraint("status IN ('open', 'done', 'rejected')", name="status"),
        Index("ix_data_requests_status", "status", "created_at"),
        Index(
            "uq_data_requests_open",
            "account_id",
            "kind",
            unique=True,
            postgresql_where=text("status = 'open' AND account_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    reference: Mapped[str] = mapped_column(String(24), nullable=False, unique=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_accounts.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    message: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    handled_at: Mapped[datetime | None] = mapped_column(TS)
    handled_by: Mapped[str | None] = mapped_column(String(120))
    outcome_note: Mapped[str | None] = mapped_column(String(500))
    # Operational deadline tracking (docs/LEGAL_RETENTION.md). The dates are working targets for staff, not a legal
    # decision: the response period and any extension must be confirmed by the lawyer. Nothing extends on its own.
    received_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow, server_default=func.now())
    base_due_at: Mapped[datetime | None] = mapped_column(TS)
    extended_due_at: Mapped[datetime | None] = mapped_column(TS)
    extension_reason: Mapped[str | None] = mapped_column(String(500))
    extension_notified_at: Mapped[datetime | None] = mapped_column(TS)
    completed_at: Mapped[datetime | None] = mapped_column(TS)
