from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.deps import DbSession

router = APIRouter(prefix="/api/health", tags=["health"])

# The self-check runs every 15 minutes; a result older than this means the timer itself stopped.
HOST_CHECK_MAX_AGE_SECONDS = 45 * 60


def host_status(path: str, now: float | None = None) -> str:
    """The host self-check as one word, without details (they are in the server's journal)."""
    try:
        result = json.loads(Path(path).read_text(encoding="utf-8"))
        checked_at, ok = float(result["checked_at"]), result["ok"]
    except (OSError, ValueError, KeyError, TypeError):
        return "unknown"
    if (now if now is not None else time.time()) - checked_at > HOST_CHECK_MAX_AGE_SECONDS:
        return "stale"
    return "ok" if ok is True else "degraded"


@router.get("")
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def readiness(db: DbSession) -> JSONResponse:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "error"})
    content = {"status": "ok", "database": "ok"}
    # Reported, not enforced: the container health check uses this route, and a full disk or a late
    # backup must alert the owner, not restart or roll back the API.
    if path := get_settings().host_selfcheck_file:
        content["host"] = host_status(path)
    return JSONResponse(content=content)
