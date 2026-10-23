"""In-memory sliding-window rate limiter.

Sufficient for a single API instance (V1). For horizontal scaling replace the
storage with Redis — the `RateLimiter.hit` contract stays the same.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass


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


limiter = RateLimiter()
