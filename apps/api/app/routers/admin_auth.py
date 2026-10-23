"""Administrator authentication with server-side sessions in HTTP-only cookies."""

from __future__ import annotations

import hashlib
from datetime import timedelta

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import func, select, update

from app import audit
from app.config import Settings
from app.deps import (
    Admin,
    AppSettings,
    DbSession,
    client_ip,
    client_ip_hash,
    enforce_rate_limit,
    rate_limited,
)
from app.errors import ApiError
from app.models import AdminSession, AdminUser, utcnow
from app.rate_limit import limiter
from app.schemas import AdminSessionInfo, AdminUserOut, LoginIn, LogoutAllOut, SessionOut
from app.security import generate_token, hash_password, hash_token, password_needs_rehash, verify_password

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

INVALID_CREDENTIALS = "Невалиден имейл или парола."


def _set_session_cookies(response: Response, settings: Settings, token: str, csrf: str) -> None:
    max_age = settings.session_ttl_hours * 3600
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=max_age,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )
    # Readable by the admin UI JavaScript; must be echoed in the X-CSRF-Token header.
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf,
        max_age=max_age,
        httponly=False,
        secure=settings.secure_cookies,
        samesite="strict",
        path="/",
    )


def _clear_session_cookies(response: Response, settings: Settings) -> None:
    for name in (settings.session_cookie_name, settings.csrf_cookie_name):
        response.delete_cookie(name, path="/", secure=settings.secure_cookies, samesite="lax")


def _email_fingerprint(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()[:16]


@router.post("/login", response_model=SessionOut)
def login(payload: LoginIn, request: Request, response: Response, db: DbSession, settings: AppSettings) -> SessionOut:
    email = payload.email.lower()
    enforce_rate_limit(f"login-ip:{client_ip(request)}", settings.login_rate_limit, settings.login_rate_window_seconds)
    enforce_rate_limit(f"login-email:{email}", settings.login_rate_limit, settings.login_rate_window_seconds)

    now = utcnow()
    ip_hash = client_ip_hash(request)
    user = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == email))
    # Always verify a hash so timing does not reveal whether the account exists.
    password_ok = verify_password(user.password_hash if user else None, payload.password)
    lockout_seconds = settings.login_lockout_minutes * 60

    if user is not None and user.locked_until is not None and user.locked_until > now:
        # Locked accounts answer exactly like the rate limiter (no account enumeration).
        audit.record(db, "auth.login_blocked", actor_label="anonymous", entity_type="admin_user",
                     entity_id=str(user.id), ip_hash=ip_hash)
        db.commit()
        raise rate_limited(int((user.locked_until - now).total_seconds()) + 1)

    if user is None or not password_ok or not user.is_active:
        details = {"email_sha256": _email_fingerprint(email)}
        audit.record(db, "auth.login_failed", actor_label="anonymous", details=details, ip_hash=ip_hash)
        if user is not None:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.login_lockout_threshold:
                user.locked_until = now + timedelta(seconds=lockout_seconds)
                user.failed_login_count = 0
                audit.record(db, "auth.account_locked", actor_label="system", entity_type="admin_user",
                             entity_id=str(user.id), details={"minutes": settings.login_lockout_minutes},
                             ip_hash=ip_hash)
        else:
            # Unknown e-mails get the same lockout behaviour, tracked in memory.
            result = limiter.hit(f"login-unknown:{email}", settings.login_lockout_threshold, lockout_seconds)
            if not result.allowed:
                db.commit()
                raise rate_limited(result.retry_after)
        db.commit()
        raise ApiError(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS, "invalid_credentials")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    token, csrf = generate_token(), generate_token()
    session = AdminSession(
        user_id=user.id,
        token_hash=hash_token(token),
        csrf_hash=hash_token(csrf),
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
        ip_hash=ip_hash,
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
    )
    db.add(session)
    user.last_login_at = now
    user.failed_login_count = 0
    user.locked_until = None
    audit.record(db, "auth.login", actor=user, entity_type="admin_user", entity_id=str(user.id), ip_hash=ip_hash)
    db.commit()

    _set_session_cookies(response, settings, token, csrf)
    response.headers["Cache-Control"] = "no-store"
    return SessionOut(user=AdminUserOut.model_validate(user), expires_at=session.expires_at)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(ctx: Admin, response: Response, db: DbSession, settings: AppSettings) -> Response:
    ctx.session.revoked_at = utcnow()
    audit.record(db, "auth.logout", actor=ctx.user, entity_type="admin_user", entity_id=str(ctx.user.id),
                 ip_hash=ctx.ip_hash)
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    _clear_session_cookies(response, settings)
    return response


@router.post("/logout-all", response_model=LogoutAllOut)
def logout_all(ctx: Admin, response: Response, db: DbSession, settings: AppSettings) -> LogoutAllOut:
    """Revoke every active session of the current administrator (all devices, including this one)."""
    now = utcnow()
    result = db.execute(
        update(AdminSession)
        .where(AdminSession.user_id == ctx.user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    audit.record(db, "auth.logout_all", actor=ctx.user, entity_type="admin_user", entity_id=str(ctx.user.id),
                 details={"sessions_revoked": result.rowcount}, ip_hash=ctx.ip_hash)
    db.commit()
    _clear_session_cookies(response, settings)
    return LogoutAllOut(sessions_revoked=result.rowcount)


@router.get("/sessions", response_model=list[AdminSessionInfo])
def list_sessions(ctx: Admin, db: DbSession, response: Response) -> list[AdminSessionInfo]:
    response.headers["Cache-Control"] = "no-store"
    now = utcnow()
    sessions = db.scalars(
        select(AdminSession)
        .where(AdminSession.user_id == ctx.user.id, AdminSession.revoked_at.is_(None), AdminSession.expires_at > now)
        .order_by(AdminSession.last_seen_at.desc())
    ).all()
    return [
        AdminSessionInfo(
            id=s.id,
            created_at=s.created_at,
            last_seen_at=s.last_seen_at,
            expires_at=s.expires_at,
            user_agent=s.user_agent,
            current=s.id == ctx.session.id,
        )
        for s in sessions
    ]


@router.get("/me", response_model=SessionOut)
def me(ctx: Admin, response: Response) -> SessionOut:
    response.headers["Cache-Control"] = "no-store"
    return SessionOut(user=AdminUserOut.model_validate(ctx.user), expires_at=ctx.session.expires_at)
