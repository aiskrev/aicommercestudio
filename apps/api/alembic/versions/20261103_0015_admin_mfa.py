"""Staff TOTP multi-factor authentication (launch blocker H-2).

* `admin_users.mfa_nonce` / `mfa_enabled` / `mfa_enabled_at` / `mfa_last_step` — the TOTP secret is
  derived from SECRET_KEY and the random nonce and is never stored; the last accepted time step
  refuses replays.
* `admin_sessions.mfa_pending` — `verify` or `enrol` while the password is verified but the second
  factor is not; such a session reaches only the MFA step. NULL for every existing session.
* `admin_mfa_recovery_codes` — one-time recovery codes, stored as keyed hashes only.
* Least privilege: the Ops runtime role gets no privilege on the recovery codes (the default
  privileges from 0013 would otherwise grant them).

Backward compatible: nullable columns, `mfa_enabled` defaults to false, and nothing changes for an
account until it enrols (or ADMIN_MFA_REQUIRED is switched on). Downgrade drops the table and columns.

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-03
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE = "acs_app_runtime"
TS = sa.DateTime(timezone=True)


def _if_role(statement: str) -> str:
    """Run a fixed GRANT/REVOKE only where the runtime role exists (fixed identifiers, no input)."""
    return "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '__ROLE__') THEN __STMT__ END IF; END $$;".replace(
        "__ROLE__", ROLE
    ).replace("__STMT__", statement)


def upgrade() -> None:
    op.add_column("admin_users", sa.Column("mfa_nonce", sa.String(64), nullable=True))
    op.add_column(
        "admin_users", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false"))
    )
    op.add_column("admin_users", sa.Column("mfa_enabled_at", TS, nullable=True))
    op.add_column("admin_users", sa.Column("mfa_last_step", sa.BigInteger(), nullable=True))

    op.add_column("admin_sessions", sa.Column("mfa_pending", sa.String(8), nullable=True))
    op.create_check_constraint(
        "mfa_pending", "admin_sessions", "mfa_pending IS NULL OR mfa_pending IN ('verify', 'enrol')"
    )

    op.create_table(
        "admin_mfa_recovery_codes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("used_at", TS, nullable=True),
        sa.UniqueConstraint("code_hash", name="uq_admin_mfa_recovery_codes_code_hash"),
    )
    op.create_index(op.f("ix_admin_mfa_recovery_codes_user_id"), "admin_mfa_recovery_codes", ["user_id"], unique=False)
    op.execute(_if_role(f"REVOKE ALL ON admin_mfa_recovery_codes FROM {ROLE};"))


def downgrade() -> None:
    op.drop_index(op.f("ix_admin_mfa_recovery_codes_user_id"), table_name="admin_mfa_recovery_codes")
    op.drop_table("admin_mfa_recovery_codes")
    op.drop_constraint("mfa_pending", "admin_sessions", type_="check")
    op.drop_column("admin_sessions", "mfa_pending")
    for column in ("mfa_last_step", "mfa_enabled_at", "mfa_enabled", "mfa_nonce"):
        op.drop_column("admin_users", column)
