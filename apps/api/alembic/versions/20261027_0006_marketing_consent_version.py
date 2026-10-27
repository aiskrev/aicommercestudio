"""Record which marketing-consent wording a visitor agreed to.

* leads.marketing_consent_version: nullable; set together with marketing_consent_at when the
  visitor opts in (contact form and AI readiness submissions).

Backward compatible: adds one nullable column; no existing row is changed. Downgrade drops the
column (the consent flag and timestamp remain).

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("marketing_consent_version", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "marketing_consent_version")
