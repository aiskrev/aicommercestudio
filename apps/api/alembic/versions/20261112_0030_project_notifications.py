"""Project notifications on the existing outbox (commercial expansion, Phase 11).

Additive: two nullable columns on `outbox_messages`, `project_id` (the commercial project a service message is about)
and `event_ref` (the event that caused it), and a partial unique index so that one account gets one message per kind and
event: a retry, a repeated click or a second worker cannot queue the same message twice. Nothing else changes: the
rows still hold no address, body or token (they are built when the message is sent). Existing rows have both columns
empty.

Revision ID: 0030
Revises: 0029
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "outbox_messages",
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("commercial_projects.id", ondelete="CASCADE")),
    )
    op.add_column("outbox_messages", sa.Column("event_ref", sa.Uuid()))
    op.create_index(
        "uq_outbox_messages_project_event",
        "outbox_messages",
        ["account_id", "kind", "event_ref"],
        unique=True,
        postgresql_where=sa.text("event_ref IS NOT NULL"),
    )
    op.create_index("ix_outbox_project", "outbox_messages", ["project_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_outbox_project", table_name="outbox_messages")
    op.drop_index("uq_outbox_messages_project_event", table_name="outbox_messages")
    op.drop_column("outbox_messages", "event_ref")
    op.drop_column("outbox_messages", "project_id")
