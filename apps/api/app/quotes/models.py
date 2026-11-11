"""Quote basket: a draft request for a written quote, kept on the server until it is sent or expires.

A basket holds **inputs only**: enumerated configurator answers and keys of published offers. No amount, no
contact detail and no free text is stored in it; every view recomputes the lines from the published schedule.
The holder of the secret token is the owner: only the SHA-256 of the token is stored, and the token travels in a
request header (never in a URL or a cookie), so a basket cannot be reached by guessing an id or by a cross-site
request. Abandoned baskets expire and are deleted by the maintenance job.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import TZDateTime, utcnow


class BasketStatus(enum.StrEnum):
    OPEN = "open"
    SUBMITTED = "submitted"


class QuoteBasket(Base):
    __tablename__ = "quote_baskets"
    __table_args__ = (
        CheckConstraint("status IN ('open', 'submitted')", name="status"),
        CheckConstraint("locale IN ('bg', 'en')", name="locale"),
        CheckConstraint("version >= 1", name="version"),
        Index("ix_quote_baskets_expires", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # SHA-256 of the secret token the browser holds; the token itself is never stored.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=BasketStatus.OPEN.value)
    # Incremented on every change; a writer names the version it saw, so two tabs cannot overwrite each other.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # [{id, kind: "configuration", model_version, answers} | {id, kind: "extra", group, key}] - inputs only.
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    # Set when the basket was sent as a quote request; a second send returns this lead instead of creating one.
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
