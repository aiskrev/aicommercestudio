"""Follow-up tasks of an enquiry (docs/ADMIN_CRM.md).

The admin CRM is the existing admin (leads, opportunities, proposals, quotations, projects) with three additions: an
owner on every lead, follow-up tasks, and read-only views (overview, timeline, export) over data that already exists.
A task hangs off a lead with `ON DELETE CASCADE`, so an erasure request or the lead retention policy removes it with the
lead. A task is a short plain-text title and a date: no personal data of the customer.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import TZDateTime, utcnow

TASK_STATES = ("open", "done", "cancelled")


class LeadTask(Base):
    __tablename__ = "lead_tasks"
    __table_args__ = (
        CheckConstraint("state IN ('open', 'done', 'cancelled')", name="state"),
        CheckConstraint("revision >= 1", name="revision"),
        # Only a finished task carries a completion time.
        CheckConstraint("(state = 'done') = (done_at IS NOT NULL)", name="done"),
        Index("ix_lead_tasks_lead", "lead_id", "created_at"),
        Index("ix_lead_tasks_state_due", "state", "due_on"),
        Index("ix_lead_tasks_assignee", "assignee_id", "state"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    state: Mapped[str] = mapped_column(String(10), nullable=False, default="open", server_default=text("'open'"))
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    done_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    done_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow, onupdate=utcnow)
