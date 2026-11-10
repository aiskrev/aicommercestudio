"""Legal workflows, second step: duplicate protection and the self-service marketing withdrawal.

Additive; nothing is dropped, rewritten or deleted.
* `leads.marketing_token_hash`: SHA-256 of the opaque token in the self-service withdrawal link (never the token
  itself, never the lead id); unique, nullable, filled only when staff prepare a link.
* A partial unique index on `legal_events (checkout_id, document, action, version)`: a retried or reused checkout
  cannot record the same acceptance twice.
* A partial unique index on `outbox_messages (kind, reference)`: one confirmation message per reference.

Revision ID: 0024
Revises: 0023
Create Date: 2026-11-10
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("marketing_token_hash", sa.String(64)))
    op.create_index("uq_leads_marketing_token_hash", "leads", ["marketing_token_hash"], unique=True)
    op.create_index(
        "uq_legal_events_checkout_once",
        "legal_events",
        ["checkout_id", "document", "action", "version"],
        unique=True,
        postgresql_where=sa.text("checkout_id IS NOT NULL"),
    )
    op.create_index(
        "uq_outbox_messages_kind_reference",
        "outbox_messages",
        ["kind", "reference"],
        unique=True,
        postgresql_where=sa.text("reference IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_outbox_messages_kind_reference", table_name="outbox_messages")
    op.drop_index("uq_legal_events_checkout_once", table_name="legal_events")
    op.drop_index("uq_leads_marketing_token_hash", table_name="leads")
    op.drop_column("leads", "marketing_token_hash")
