"""Quota reservation for costly work (docs/ADVISOR_WORKSPACE.md has the policy table).

`reserve` runs in its own committed transaction before any provider call, so a crash cannot lose it.
It takes every unit with one conditional UPDATE, which is what keeps parallel requests inside a limit.
`finish` runs in the caller's transaction together with saving the result, so a result and its charge
appear together or not at all. An idempotency key makes a repeated request return the stored result.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db import get_sessionmaker
from app.models import utcnow
from app.workspace.models import ReservationStatus, UsageCounter, UsageEvent, UsageReservation

# Spending across all workspaces is one more counter, kept under this reserved id.
GLOBAL_SCOPE = uuid.UUID(int=0)

# outcome → does the customer's unit count / does the money spent count.
POLICY: dict[str, tuple[bool, bool]] = {
    "success": (True, True),
    "not_called": (False, False),  # the provider was not reached, or refused before working
    "timeout": (False, True),  # we cannot know whether it was billed, so spending assumes it was
    "invalid_output": (False, True),  # the provider worked, but the failure is not the customer's
    "declined": (False, True),
    "save_failed": (False, True),
    "expired": (False, True),  # the worker died: same as a timeout
}
PROVIDER_ERRORS = {
    "unavailable": "not_called",
    "rate_limited": "not_called",
    "timeout": "timeout",
    "invalid_output": "invalid_output",
    "declined": "declined",
}


class QuotaExceeded(Exception):
    def __init__(self, metric: str, limit: int) -> None:
        super().__init__(metric)
        self.metric = metric
        self.limit = limit


class IdempotencyConflict(Exception):
    """The key was used for a different request."""


class InProgress(Exception):
    """The same request is still running."""


class ReservationLost(Exception):
    """The reservation expired before the result arrived."""


@dataclass(frozen=True)
class Item:
    metric: str
    amount: int
    limit: int
    kind: str = "unit"  # "unit" follows the customer's side of POLICY, "cost" the spending side
    scope: uuid.UUID | None = None


@dataclass(frozen=True)
class Reserved:
    id: uuid.UUID
    replay_version_id: uuid.UUID | None = None


def period_start(now: datetime | None = None) -> date:
    return (now or utcnow()).date().replace(day=1)


def _lock_order(scope: str, metric: str) -> tuple[str, str]:
    """Counters are always locked in this order, by reserve and settle alike, so they cannot deadlock."""
    return (scope, metric)


def _take(db: Session, workspace_id: uuid.UUID, item: Item, period: date) -> bool:
    scope = item.scope or workspace_id
    db.execute(
        insert(UsageCounter)
        .values(workspace_id=scope, metric=item.metric, period_start=period)
        .on_conflict_do_nothing()
    )
    taken = db.execute(
        text(
            "UPDATE usage_counters SET reserved = reserved + :amount "
            "WHERE workspace_id = :scope AND metric = :metric AND period_start = :period "
            "AND used + reserved + :amount <= :limit"
        ),
        {"amount": item.amount, "scope": scope, "metric": item.metric, "period": period, "limit": item.limit},
    )
    return taken.rowcount == 1


def _settle(db: Session, row: UsageReservation, outcome: str, status: ReservationStatus) -> None:
    keep_unit, keep_cost = POLICY[outcome]
    for item in sorted(row.items, key=lambda i: _lock_order(i["scope"], i["metric"])):
        kept = item["amount"] if (keep_cost if item["kind"] == "cost" else keep_unit) else 0
        db.execute(
            text(
                "UPDATE usage_counters SET reserved = reserved - :amount, used = used + :kept "
                "WHERE workspace_id = :scope AND metric = :metric AND period_start = :period"
            ),
            {
                "amount": item["amount"],
                "kept": kept,
                "scope": uuid.UUID(item["scope"]),
                "metric": item["metric"],
                "period": row.period_start,
            },
        )
        if kept:
            db.add(
                UsageEvent(
                    workspace_id=row.workspace_id,
                    reservation_id=row.id,
                    attempt=row.attempts,
                    metric=item["metric"],
                    amount=kept,
                    outcome=outcome,
                )
            )
    row.status = status.value
    row.outcome = outcome
    row.finished_at = utcnow()


def sweep_expired(db: Session, workspace_id: uuid.UUID | None = None) -> int:
    """Close reservations whose worker never came back. Safe to run from several processes."""
    query = (
        select(UsageReservation)
        .where(UsageReservation.status == ReservationStatus.RESERVED.value, UsageReservation.expires_at <= utcnow())
        .with_for_update(skip_locked=True)
    )
    if workspace_id is not None:
        query = query.where(UsageReservation.workspace_id == workspace_id)
    rows = db.scalars(query).all()
    for row in rows:
        _settle(db, row, "expired", ReservationStatus.EXPIRED)
    return len(rows)


def reserve(workspace_id: uuid.UUID, key: str, request_hash: str, items: list[Item], ttl_seconds: int) -> Reserved:
    now = utcnow()
    period = period_start(now)
    stored = [
        {"metric": i.metric, "amount": i.amount, "kind": i.kind, "scope": str(i.scope or workspace_id)} for i in items
    ]
    with get_sessionmaker()() as db:
        sweep_expired(db, workspace_id)
        new_id = db.execute(
            insert(UsageReservation)
            .values(
                id=uuid.uuid4(),
                workspace_id=workspace_id,
                idempotency_key=key,
                request_hash=request_hash,
                status=ReservationStatus.RESERVED.value,
                period_start=period,
                items=stored,
                expires_at=now + timedelta(seconds=ttl_seconds),
            )
            .on_conflict_do_nothing(constraint="uq_usage_reservations_key")
            .returning(UsageReservation.id)
        ).scalar()
        reservation_id = new_id
        if new_id is None:
            row = db.scalar(
                select(UsageReservation)
                .where(UsageReservation.workspace_id == workspace_id, UsageReservation.idempotency_key == key)
                .with_for_update()
            )
            if row.request_hash != request_hash:
                raise IdempotencyConflict
            if row.status == ReservationStatus.COMMITTED.value:
                return Reserved(id=row.id, replay_version_id=row.version_id)
            if row.status == ReservationStatus.RESERVED.value:
                raise InProgress
            row.status = ReservationStatus.RESERVED.value  # a released attempt may run again, charged once
            row.attempts += 1
            row.period_start = period
            row.items = stored
            row.outcome = None
            row.finished_at = None
            row.expires_at = now + timedelta(seconds=ttl_seconds)
            reservation_id = row.id
        for item in sorted(items, key=lambda i: _lock_order(str(i.scope or workspace_id), i.metric)):
            if not _take(db, workspace_id, item, period):
                db.rollback()
                raise QuotaExceeded(item.metric, item.limit)
        db.commit()
    return Reserved(id=reservation_id)


def finish(db: Session, reservation_id: uuid.UUID, outcome: str, version_id: uuid.UUID | None = None) -> None:
    """Settle in the caller's transaction, which also saves the result."""
    row = db.scalar(select(UsageReservation).where(UsageReservation.id == reservation_id).with_for_update())
    if row is None or row.status != ReservationStatus.RESERVED.value:
        raise ReservationLost
    committed = outcome == "success"
    _settle(db, row, outcome, ReservationStatus.COMMITTED if committed else ReservationStatus.RELEASED)
    row.version_id = version_id


def fail(reservation_id: uuid.UUID, outcome: str) -> None:
    with get_sessionmaker()() as db:
        try:
            finish(db, reservation_id, outcome)
        except ReservationLost:
            return
        db.commit()


def report(db: Session, workspace_id: uuid.UUID) -> dict[str, dict[str, int]]:
    rows = db.scalars(
        select(UsageCounter).where(
            UsageCounter.workspace_id == workspace_id, UsageCounter.period_start == period_start()
        )
    ).all()
    return {row.metric: {"used": row.used, "reserved": row.reserved} for row in rows}
