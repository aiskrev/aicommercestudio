"""Commercial customer projects: delivery of a quoted piece of work, shown to the customer through their workspace.

This is the commercial counterpart of the advisor's `workspace_projects` (assessment drafts) and has nothing to do with
the AI Operations portal. A project belongs to exactly one customer workspace, which staff choose by the verified
e-mail address of the customer's account; a customer never names a workspace or a project they do not own.

`status` follows the lifecycle in `app/projects/service.py`. Events are the delivery history and the conversation:
status changes, updates, deliveries, change requests, support requests and the replies to them.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import TZDateTime, utcnow


class ProjectStatus(enum.StrEnum):
    DRAFT = "draft"
    QUOTATION = "quotation"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    CLIENT_REVIEW = "client_review"
    COMPLETED = "completed"
    MAINTENANCE = "maintenance"


STATUSES = tuple(item.value for item in ProjectStatus)
MILESTONE_STATUSES = ("planned", "in_progress", "done")
EVENT_KINDS = ("status", "update", "delivery", "change_request", "support", "response", "approval")
#: Kinds a customer writes and staff answer; they carry a state.
REQUEST_KINDS = ("change_request", "support")
REQUEST_STATES = ("open", "answered", "closed")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


class CommercialProject(Base):
    __tablename__ = "commercial_projects"
    __table_args__ = (
        CheckConstraint(_in("status", STATUSES), name="status"),
        CheckConstraint("revision >= 1", name="revision"),
        # A quotation becomes at most one project, so a retry or a second click cannot create a second one.
        Index(
            "uq_commercial_projects_quotation",
            "quotation_id",
            unique=True,
            postgresql_where=text("quotation_id IS NOT NULL"),
        ),
        Index(
            "uq_commercial_projects_lead_title",
            "workspace_id",
            "lead_id",
            "title",
            unique=True,
            postgresql_where=text("lead_id IS NOT NULL"),
        ),
        Index("ix_commercial_projects_workspace", "workspace_id", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("customer_workspaces.id", ondelete="CASCADE"), nullable=False
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=ProjectStatus.DRAFT.value)
    # A copy of the approved proposal version the project was created from (never edited afterwards), and its number.
    scope: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    scope_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Written by staff; references only, never documents or amounts.
    contract_reference: Mapped[str | None] = mapped_column(String(60), nullable=True)
    invoice_references: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    maintenance_plan: Mapped[str | None] = mapped_column(String(24), nullable=True)
    maintenance_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("customer_accounts.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)

    @property
    def reference(self) -> str:
        return self.id.hex[:8].upper()


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"
    __table_args__ = (
        CheckConstraint(_in("status", MILESTONE_STATUSES), name="status"),
        CheckConstraint("position >= 0", name="position"),
        Index("ix_project_milestones_project", "project_id", "position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("commercial_projects.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Free text such as "to be agreed": an indicative timing is never a commitment and is not a date the system checks.
    indicative_timing: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="planned")
    completed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)


class ProjectEvent(Base):
    __tablename__ = "project_events"
    __table_args__ = (
        CheckConstraint(_in("kind", EVENT_KINDS), name="kind"),
        CheckConstraint("visibility IN ('client', 'internal')", name="visibility"),
        CheckConstraint("author_kind IN ('staff', 'client', 'system')", name="author_kind"),
        # Only customer requests carry a state, and every one of them has one.
        CheckConstraint(
            f"({_in('kind', REQUEST_KINDS)}) = (state IS NOT NULL)",
            name="request_state",
        ),
        CheckConstraint("state IS NULL OR " + _in("state", REQUEST_STATES), name="state"),
        Index("ix_project_events_project", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("commercial_projects.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    visibility: Mapped[str] = mapped_column(String(10), nullable=False, default="client")
    author_kind: Mapped[str] = mapped_column(String(8), nullable=False)
    author_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    author_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("customer_accounts.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str | None] = mapped_column(String(10), nullable=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("project_events.id", ondelete="SET NULL"), nullable=True
    )
    # {"from": ..., "to": ...} for a status change, {"milestone": id} for a milestone update: keys only, no text.
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
