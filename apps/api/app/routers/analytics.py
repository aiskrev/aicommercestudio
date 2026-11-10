"""Anonymous page-view and click collection for the public site (docs/ANALYTICS.md)."""

from __future__ import annotations

from urllib.parse import urlparse

from fastapi import APIRouter, Request

from app.analytics import service
from app.analytics.schemas import CollectIn, CollectOut
from app.deps import AppSettings, DbSession, client_ip, client_ip_hash, enforce_rate_limit

router = APIRouter(prefix="/api/public/analytics", tags=["analytics"])


@router.post("", response_model=CollectOut)
def collect(payload: CollectIn, request: Request, db: DbSession, settings: AppSettings) -> CollectOut:
    """Stores a few anonymous events. Answers `enabled: false` while statistics are switched off, so the
    browser can stop sending. A visitor who sends Do Not Track or Global Privacy Control, a robot and a signed-in
    staff member are answered the same way as everyone else but nothing is stored."""
    if not settings.analytics_enabled:
        return CollectOut(enabled=False)

    user_agent = request.headers.get("user-agent", "")
    if (
        request.headers.get("dnt") == "1"
        or request.headers.get("sec-gpc") == "1"
        or service.is_bot(user_agent)
        or request.cookies.get(settings.session_cookie_name)
    ):
        return CollectOut(enabled=True)

    enforce_rate_limit(
        f"analytics:{client_ip_hash(request)}", settings.analytics_rate_limit, settings.analytics_rate_window_seconds
    )
    stored = service.record(
        db,
        secret_key=settings.secret_key,
        own_host=urlparse(settings.site_url).hostname,
        visitor=service.Visitor(ip=client_ip(request), user_agent=user_agent),
        events=payload.events,
    )
    if stored:
        db.commit()
    return CollectOut(enabled=True)
