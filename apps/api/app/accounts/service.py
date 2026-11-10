"""Housekeeping for account data that has served its purpose."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, or_
from sqlalchemy.orm import Session

from app.accounts.models import (
    CustomerAccount,
    CustomerSession,
    CustomerToken,
    OutboxMessage,
    OutboxStatus,
    RateLimitBucket,
)
from app.config import get_settings
from app.models import utcnow
from app.workspace.models import WorkspaceInvitation
from app.workspace.usage import sweep_expired

KEEP_DAYS = 30


def purge_expired(db: Session) -> int:
    """Delete dead sessions and tokens, old delivery records and stale rate-limit windows."""
    now = utcnow()
    cutoff = now - timedelta(days=KEEP_DAYS)
    removed = 0
    for statement in (
        delete(CustomerSession).where(
            or_(CustomerSession.expires_at < now, CustomerSession.revoked_at < now - timedelta(days=1))
        ),
        delete(CustomerToken).where(
            or_(CustomerToken.expires_at < now, CustomerToken.used_at < now - timedelta(days=1))
        ),
        delete(OutboxMessage).where(
            OutboxMessage.status != OutboxStatus.PENDING.value, OutboxMessage.created_at < cutoff
        ),
        delete(RateLimitBucket).where(RateLimitBucket.window_start < now - timedelta(days=1)),
        delete(WorkspaceInvitation).where(WorkspaceInvitation.expires_at < cutoff),
        # An account whose e-mail was never confirmed is not kept (docs: privacy policy, retention).
        delete(CustomerAccount).where(
            CustomerAccount.email_verified_at.is_(None),
            CustomerAccount.erased_at.is_(None),
            CustomerAccount.created_at < now - timedelta(days=get_settings().account_unverified_days),
        ),
    ):
        removed += db.execute(statement).rowcount
    removed += sweep_expired(db)
    return removed
