"""Site statistics for administrators (the dashboard under /admin/analytics)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.analytics import service
from app.analytics.schemas import Summary, VisitsOut
from app.deps import Admin, AppSettings, DbSession

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


@router.get("/summary", response_model=Summary)
def analytics_summary(
    ctx: Admin,
    db: DbSession,
    settings: AppSettings,
    response: Response,
    days: Annotated[int, Query(ge=1, le=180)] = 30,
) -> Summary:
    """Views, visits, clicks, top pages, referrers and devices for the last `days` days (Sofia time)."""
    _no_store(response)
    return service.summary(
        db, days=days, enabled=settings.analytics_enabled, retention_days=settings.analytics_retention_days
    )


@router.get("/visits", response_model=VisitsOut)
def analytics_visits(
    ctx: Admin,
    db: DbSession,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> VisitsOut:
    """The latest visits of today as anonymous paths: which pages one visitor opened and what they clicked.
    The visit id is a short part of a hash that changes every day; it identifies nobody."""
    _no_store(response)
    return service.recent_visits(db, limit=limit)
