"""One table of anonymous events. No IP address, user agent, cookie or user id is stored."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import utcnow

TS = DateTime(timezone=True)

KINDS = ("view", "click", "tool")


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = (
        CheckConstraint("kind IN ('view', 'click', 'tool')", name="kind"),
        CheckConstraint("device IN ('desktop', 'mobile', 'tablet')", name="device"),
        Index("ix_analytics_events_created", "created_at"),
        Index("ix_analytics_events_kind_created", "kind", "created_at"),
        Index("ix_analytics_events_visit", "visit", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(TS, nullable=False, default=utcnow)
    kind: Mapped[str] = mapped_column(String(8), nullable=False)
    # Public path without query string or fragment, e.g. /bg/uslugi/seo-optimizatsiya.
    path: Mapped[str] = mapped_column(String(200), nullable=False)
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    # Keyed hash that changes every day: it groups the events of one visit and cannot follow a person.
    visit: Mapped[str] = mapped_column(String(24), nullable=False)
    device: Mapped[str] = mapped_column(String(8), nullable=False)
    # Host of the referring site only (views); never a path or query.
    referrer_host: Mapped[str | None] = mapped_column(String(120))
    # Clicks: the visible name of the link or button. Tool events: "<tool>:<event>".
    label: Mapped[str | None] = mapped_column(String(80))
    # Clicks: the target path on this site, or only the host of an outside link.
    target: Mapped[str | None] = mapped_column(String(200))
