from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.deps import DbSession

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def readiness(db: DbSession) -> JSONResponse:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "error"})
    return JSONResponse(content={"status": "ok", "database": "ok"})
