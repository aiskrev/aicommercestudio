"""Operational deadline tracking for data-subject requests.

Additive. New nullable columns on `data_requests` (plus `received_at`, backfilled from `created_at`): `base_due_at`,
`extended_due_at`, `extension_reason`, `extension_notified_at`, `completed_at`. Existing rows are backfilled: the base
due date is one calendar month after receipt, and closed requests get `completed_at` from `handled_at`. These are
working targets for staff; the legal period and any extension must be confirmed by the lawyer. Nothing is extended
automatically.

Revision ID: 0025
Revises: 0024
Create Date: 2026-11-11
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column("data_requests", sa.Column("received_at", TS, nullable=False, server_default=sa.func.now()))
    op.add_column("data_requests", sa.Column("base_due_at", TS))
    op.add_column("data_requests", sa.Column("extended_due_at", TS))
    op.add_column("data_requests", sa.Column("extension_reason", sa.String(500)))
    op.add_column("data_requests", sa.Column("extension_notified_at", TS))
    op.add_column("data_requests", sa.Column("completed_at", TS))
    op.execute(
        "UPDATE data_requests SET received_at = created_at, base_due_at = created_at + interval '1 month', "
        "completed_at = CASE WHEN status <> 'open' THEN handled_at END"
    )


def downgrade() -> None:
    for column in (
        "completed_at",
        "extension_notified_at",
        "extension_reason",
        "extended_due_at",
        "base_due_at",
        "received_at",
    ):
        op.drop_column("data_requests", column)
