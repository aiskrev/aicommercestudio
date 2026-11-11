"""Customer-facing quotation: an approved proposal version that staff chose to show to the client.

A quotation is not a new document. It points at one immutable, human-approved version of a proposal
(`lead_proposal_versions`) and adds what showing it to a client needs: a secret link, an optional validity date
that staff set, whether it was opened, and the client's answer. A draft, a version in review and anything a
generator wrote can never be shown: only an approved version can be published, and only by staff.

The system sends nothing. Publishing returns the link once; a person sends it to the client themselves.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models import AdminUser, TZDateTime, utcnow


class QuotationStatus(enum.StrEnum):
    PUBLISHED = "published"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    WITHDRAWN = "withdrawn"


class Quotation(Base):
    __tablename__ = "quotations"
    __table_args__ = (
        CheckConstraint("status IN ('published', 'accepted', 'declined', 'withdrawn')", name="status"),
        CheckConstraint("locale IN ('bg', 'en')", name="locale"),
        CheckConstraint("version_number >= 1", name="version_number"),
        CheckConstraint("revision >= 1", name="revision"),
        # A client's answer always has a time and the name the person typed; nothing else carries them.
        CheckConstraint(
            "(status IN ('accepted', 'declined')) = (decided_at IS NOT NULL AND decision_name IS NOT NULL)",
            name="decision",
        ),
        CheckConstraint("(status = 'withdrawn') = (withdrawn_at IS NOT NULL)", name="withdrawal"),
        # One live link per proposal: publishing again needs the earlier one withdrawn or answered.
        Index("uq_quotations_live", "proposal_id", unique=True, postgresql_where=text("status = 'published'")),
        Index("ix_quotations_lead", "lead_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("lead_proposals.id", ondelete="CASCADE"), nullable=False
    )
    # The approved version this quotation shows; versions are append-only, so this never changes meaning.
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # SHA-256 of the secret in the client's link; the secret itself is shown to staff once and never stored.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default=QuotationStatus.PUBLISHED.value)
    # Only when staff set one; the proposal's own "validity" text is part of the approved version.
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    published_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    published_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    first_viewed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    last_viewed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    decided_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    decision_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    decision_ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    withdrawn_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    withdrawn_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    withdrawal_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    published_by: Mapped[AdminUser | None] = relationship(foreign_keys=[published_by_id], lazy="joined")
    withdrawn_by: Mapped[AdminUser | None] = relationship(foreign_keys=[withdrawn_by_id], lazy="joined")
