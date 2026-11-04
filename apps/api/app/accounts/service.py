"""Housekeeping for account data that has served its purpose."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete, or_
from sqlalchemy.orm import Session

from app.accounts.models import CustomerSession, CustomerToken, OutboxMessage, OutboxStatus, RateLimitBucket
from app.models import utcnow

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
    ):
        removed += db.execute(statement).rowcount
    return removed
