"""FastAPI dependencies: client identification, admin authentication and CSRF."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import AdminSession, AdminUser, utcnow
from app.rate_limit import limiter
from app.security import hash_ip, hash_token, tokens_match

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
CSRF_HEADER = "x-csrf-token"

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def client_ip(request: Request) -> str | None:
    """Client address. With TRUST_PROXY_HEADERS the right-most X-Forwarded-For entry is used:
    it is the one appended/set by the nearest trusted proxy (Next.js server or Caddy)."""
    if get_settings().trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else None


def client_ip_hash(request: Request) -> str | None:
    return hash_ip(client_ip(request), get_settings().secret_key)


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    result = limiter.hit(key, limit, window_seconds)
    if not result.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Твърде много заявки. Моля, опитайте отново по-късно.",
            headers={"Retry-After": str(result.retry_after)},
        )


@dataclass
class AdminContext:
    user: AdminUser
    session: AdminSession
    ip_hash: str | None


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Необходим е вход в системата.")


def require_admin(request: Request, db: DbSession) -> AdminContext:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    if not token or len(token) > 200:
        raise _unauthorized()
    session = db.scalar(select(AdminSession).where(AdminSession.token_hash == hash_token(token)))
    now = utcnow()
    if (
        session is None
        or session.revoked_at is not None
        or session.expires_at <= now
        or not session.user.is_active
    ):
        raise _unauthorized()

    if request.method not in SAFE_METHODS:
        header = request.headers.get(CSRF_HEADER)
        if not header or not tokens_match(header, session.csrf_hash):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Невалиден CSRF токен.")

    if now - session.last_seen_at > timedelta(minutes=1):
        session.last_seen_at = now
        db.commit()
    return AdminContext(user=session.user, session=session, ip_hash=client_ip_hash(request))


Admin = Annotated[AdminContext, Depends(require_admin)]
