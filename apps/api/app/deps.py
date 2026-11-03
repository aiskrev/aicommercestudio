"""FastAPI dependencies: client identification, admin authentication and CSRF."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings, get_settings
from app.db import get_db
from app.errors import ApiError
from app.models import AdminMfaPending, AdminRole, AdminSession, AdminUser, utcnow
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
        raise rate_limited(result.retry_after)


def rate_limited(retry_after: int) -> ApiError:
    return ApiError(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "Твърде много заявки. Моля, опитайте отново по-късно.",
        "rate_limited",
        headers={"Retry-After": str(retry_after)},
    )


@dataclass
class AdminContext:
    user: AdminUser
    session: AdminSession
    ip_hash: str | None


def _unauthorized(detail: str = "Необходим е вход в системата.", code: str = "unauthorized") -> ApiError:
    return ApiError(status.HTTP_401_UNAUTHORIZED, detail, code)


FULL = None  # a session that has passed every factor
VERIFY = AdminMfaPending.VERIFY.value
ENROL = AdminMfaPending.ENROL.value


def _load_session(request: Request, db: Session, stages: frozenset[str | None]) -> AdminContext:
    """A valid staff session at one of `stages` (full, or pending `verify` / `enrol`), with CSRF on
    state-changing requests. A pending session is refused everywhere except the MFA step."""
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

    if now - session.last_seen_at > timedelta(minutes=settings.session_idle_minutes):
        session.revoked_at = now
        audit.record(
            db, "auth.session_idle_timeout", actor=session.user, entity_type="admin_user",
            entity_id=str(session.user_id), ip_hash=client_ip_hash(request),
        )
        db.commit()
        raise _unauthorized("Сесията изтече поради неактивност. Моля, влезте отново.", "session_expired")

    stage = session.mfa_pending
    if stage is FULL and settings.admin_mfa_required and not session.user.mfa_enabled and ENROL not in stages:
        # A session from before ADMIN_MFA_REQUIRED was switched on reaches only enrolment and logout.
        raise _unauthorized("Настройте двуфакторно удостоверяване, за да продължите.", "mfa_enrolment_required")
    if stage not in stages:
        if stage == VERIFY:
            raise _unauthorized("Въведете кода от приложението за удостоверяване.", "mfa_required")
        if stage == ENROL:
            raise _unauthorized("Настройте двуфакторно удостоверяване, за да продължите.", "mfa_enrolment_required")
        raise ApiError(status.HTTP_409_CONFLICT, "Няма незавършен вход с втори фактор.", "mfa_not_pending")

    if request.method not in SAFE_METHODS:
        header = request.headers.get(CSRF_HEADER)
        if not header or not tokens_match(header, session.csrf_hash):
            raise ApiError(status.HTTP_403_FORBIDDEN, "Невалиден CSRF токен. Презаредете страницата.", "csrf_failed")

    if now - session.last_seen_at > timedelta(minutes=1):
        session.last_seen_at = now
        db.commit()
    return AdminContext(user=session.user, session=session, ip_hash=client_ip_hash(request))


def require_session(request: Request, db: DbSession) -> AdminContext:
    """A full staff session (any role): password and, where enrolled or required, the second factor."""
    return _load_session(request, db, frozenset({FULL}))


def require_mfa_verify_session(request: Request, db: DbSession) -> AdminContext:
    """Only a session waiting for a code (the sign-in MFA step)."""
    return _load_session(request, db, frozenset({VERIFY}))


def require_mfa_setup_session(request: Request, db: DbSession) -> AdminContext:
    """A full session (enrolment from the account page) or one that must enrol before it is usable."""
    return _load_session(request, db, frozenset({FULL, ENROL}))


def require_any_session(request: Request, db: DbSession) -> AdminContext:
    """Any stage; used only by logout, which ends the session it is called with."""
    return _load_session(request, db, frozenset({FULL, VERIFY, ENROL}))


Staff = Annotated[AdminContext, Depends(require_session)]
MfaVerifySession = Annotated[AdminContext, Depends(require_mfa_verify_session)]
MfaSetupSession = Annotated[AdminContext, Depends(require_mfa_setup_session)]
AnySession = Annotated[AdminContext, Depends(require_any_session)]


def _forbidden_role() -> ApiError:
    return ApiError(status.HTTP_403_FORBIDDEN, "Ролята ви не позволява това действие.", "forbidden_role")


def require_admin(ctx: Staff) -> AdminContext:
    """Leads, retention, AI approvals, ops and audit: only the `admin` role (every pre-0010 account)."""
    if ctx.user.role != AdminRole.ADMIN:
        raise _forbidden_role()
    return ctx


Admin = Annotated[AdminContext, Depends(require_admin)]


def require_role(*roles: AdminRole):
    """Dependency for endpoints open to several staff roles (the service catalogue)."""
    allowed = {role.value for role in roles}

    def dependency(ctx: Staff) -> AdminContext:
        if ctx.user.role not in allowed:
            raise _forbidden_role()
        return ctx

    return dependency


CatalogueReader = Annotated[AdminContext, Depends(require_role(AdminRole.ADMIN, AdminRole.EDITOR, AdminRole.VIEWER))]
CatalogueEditor = Annotated[AdminContext, Depends(require_role(AdminRole.ADMIN, AdminRole.EDITOR))]
CataloguePublisher = Annotated[AdminContext, Depends(require_role(AdminRole.ADMIN))]
