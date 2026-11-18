"""In-memory sliding-window rate limiter.

Sufficient for a single API instance (V1). With more than one API process set RATE_LIMIT_BACKEND=postgres (the
`Limiter` facade below then counts in PostgreSQL); the `hit` contract is the same for both.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after: int


class RateLimiter:
    _MAX_KEYS = 50_000

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_seconds: int, now: float | None = None) -> RateLimitResult:
        current = time.monotonic() if now is None else now
        cutoff = current - window_seconds
        with self._lock:
            bucket = self._hits.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, int(bucket[0] + window_seconds - current) + 1)
                return RateLimitResult(False, retry_after)
            bucket.append(current)
            if len(self._hits) > self._MAX_KEYS:
                self._prune(cutoff)
            return RateLimitResult(True, 0)

    def _prune(self, cutoff: float) -> None:
        for key in [k for k, v in self._hits.items() if not v or v[-1] <= cutoff]:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


class SharedRateLimiter:
    """Fixed-window counters in PostgreSQL, shared by every API process and kept across restarts (audit SEC-05).

    One atomic upsert per hit (app/accounts/limits.py), keys are hashed, so no IP address or e-mail is stored.
    The window is fixed rather than sliding: a client can send up to twice the limit around a window boundary.
    """

    def hit(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        from app.accounts import limits

        allowed, retry_after = limits.consume("rl", key, limit, window_seconds)
        return RateLimitResult(allowed, retry_after)

    def reset(self) -> None:
        from sqlalchemy import text

        from app.db import get_sessionmaker

        with get_sessionmaker()() as db:
            db.execute(text("DELETE FROM rate_limit_buckets"))
            db.commit()


class Limiter:
    """The limiter the routes use: the in-memory one (default), or the shared one with RATE_LIMIT_BACKEND=postgres.

    If the shared store cannot be reached the hit is counted in memory instead, so a database fault never
    removes the limit and never turns into a new way of failing requests.
    """

    def __init__(self) -> None:
        self.memory = RateLimiter()
        self.shared = SharedRateLimiter()

    def hit(self, key: str, limit: int, window_seconds: int, now: float | None = None) -> RateLimitResult:
        if now is None and get_settings().rate_limit_backend == "postgres":
            try:
                return self.shared.hit(key, limit, window_seconds)
            except Exception:  # noqa: BLE001 - any store fault degrades to the per-process limit
                logger.warning("shared_rate_limit_unavailable", exc_info=True)
        return self.memory.hit(key, limit, window_seconds, now)

    def reset(self) -> None:
        self.memory.reset()
        if get_settings().rate_limit_backend == "postgres":
            self.shared.reset()


limiter = Limiter()
