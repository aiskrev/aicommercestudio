"""Administrator authentication with server-side sessions in HTTP-only cookies."""

from __future__ import annotations

import hashlib
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import func, select

from app import audit
from app.config import Settings
from app.deps import Admin, AppSettings, DbSession, client_ip, client_ip_hash, enforce_rate_limit
from app.models import AdminSession, AdminUser, utcnow
from app.schemas import AdminUserOut, LoginIn, SessionOut
from app.security import generate_token, hash_password, hash_token, password_needs_rehash, verify_password

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])


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


@router.post("/login", response_model=SessionOut)
def login(payload: LoginIn, request: Request, response: Response, db: DbSession, settings: AppSettings) -> SessionOut:
    email = payload.email.lower()
    enforce_rate_limit(f"login-ip:{client_ip(request)}", settings.login_rate_limit, settings.login_rate_window_seconds)
    enforce_rate_limit(f"login-email:{email}", settings.login_rate_limit, settings.login_rate_window_seconds)

    user = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == email))
    password_ok = verify_password(user.password_hash if user else None, payload.password)
    ip_hash = client_ip_hash(request)
    if user is None or not password_ok or not user.is_active:
        audit.record(
            db,
            "auth.login_failed",
            actor_label="anonymous",
            details={"email_sha256": hashlib.sha256(email.encode()).hexdigest()[:16]},
            ip_hash=ip_hash,
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалиден имейл или парола.")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    now = utcnow()
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


@router.get("/me", response_model=SessionOut)
def me(ctx: Admin, response: Response) -> SessionOut:
    response.headers["Cache-Control"] = "no-store"
    return SessionOut(user=AdminUserOut.model_validate(ctx.user), expires_at=ctx.session.expires_at)
