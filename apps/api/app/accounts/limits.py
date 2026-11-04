"""Shared rate limits for account routes, stored in PostgreSQL.

The in-memory limiter (app/rate_limit.py) loses its counters on restart and is per process, which is
not enough for sign-in and recovery. One atomic upsert per hit keeps a fixed window that every API
process shares. Keys are SHA-256 hashes, so the table holds no e-mail or IP address. Each hit runs in
its own transaction, so a request that later fails still counts.
"""

from __future__ import annotations

import hashlib
import math
from datetime import timedelta

from fastapi import status
from sqlalchemy import text

from app.config import get_settings
from app.db import get_sessionmaker
from app.errors import ApiError
from app.models import utcnow

_UPSERT = text(
    """
    INSERT INTO rate_limit_buckets (key, window_start, hits) VALUES (:key, :now, 1)
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN rate_limit_buckets.window_start <= :cutoff THEN 1 ELSE rate_limit_buckets.hits + 1 END,
      window_start = CASE WHEN rate_limit_buckets.window_start <= :cutoff THEN :now
                     ELSE rate_limit_buckets.window_start END
    RETURNING hits, window_start
    """
)


def bucket_key(scope: str, value: str | None) -> str:
    material = f"{get_settings().secret_key}:{scope}:{value or 'none'}"
    return hashlib.sha256(material.encode()).hexdigest()


def hit(scope: str, value: str | None, limit: int, window_seconds: int) -> None:
    now = utcnow()
    with get_sessionmaker()() as db:
        row = db.execute(
            _UPSERT,
            {"key": bucket_key(scope, value), "now": now, "cutoff": now - timedelta(seconds=window_seconds)},
        ).one()
        db.commit()
    if row.hits > limit:
        retry_after = max(1, math.ceil(window_seconds - (now - row.window_start).total_seconds()))
        raise ApiError(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many attempts. Please try again later.",
            "rate_limited",
            headers={"Retry-After": str(retry_after)},
        )
