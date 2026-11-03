"""Administrator authentication with server-side sessions in HTTP-only cookies.

Sign-in is password → (for accounts with TOTP, or every account under ADMIN_MFA_REQUIRED) a short-lived
pending session → code or enrolment → a new, full session. A pending session reaches only the MFA step
and logout (app/deps.py). The MFA step shares the password step's rate limits and persistent lockout.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import func, select, update

from app import audit
from app.config import Settings
from app.deps import (
    AdminContext,
    AnySession,
    AppSettings,
    DbSession,
    MfaSetupSession,
    MfaVerifySession,
    Staff,
    client_ip,
    client_ip_hash,
    enforce_rate_limit,
    rate_limited,
)
from app.errors import ApiError
from app.models import AdminMfaPending, AdminSession, AdminUser, utcnow
from app.rate_limit import limiter
from app.schemas import (
    AdminSessionInfo,
    AdminUserOut,
    LoginIn,
    LogoutAllOut,
    MfaCodeIn,
    MfaConfirmOut,
    MfaDisableIn,
    MfaRecoveryCodesOut,
    MfaSetupOut,
    MfaStatusOut,
    SessionOut,
)
from app.security import generate_token, hash_password, hash_token, password_needs_rehash, verify_password
from app.services import admin_mfa

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

INVALID_CREDENTIALS = "Невалиден имейл или парола."
# A pending session (password accepted, second factor not yet) lives this long.
MFA_PENDING_MINUTES = 15


def _set_session_cookies(response: Response, settings: Settings, token: str, csrf: str, max_age: int) -> None:
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


def _enforce_login_limits(request: Request, settings: Settings, email: str) -> None:
    """The same buckets for the password and the MFA step: a code guess costs as much as a password guess."""
    enforce_rate_limit(f"login-ip:{client_ip(request)}", settings.login_rate_limit, settings.login_rate_window_seconds)
    enforce_rate_limit(f"login-email:{email.lower()}", settings.login_rate_limit, settings.login_rate_window_seconds)


def _register_failure(db: DbSession, settings: Settings, user: AdminUser, ip_hash: str | None) -> bool:
    """Count a failed password or code on the persistent counter; True when this failure locked the account."""
    user.failed_login_count += 1
    if user.failed_login_count < settings.login_lockout_threshold:
        return False
    user.locked_until = utcnow() + timedelta(minutes=settings.login_lockout_minutes)
    user.failed_login_count = 0
    audit.record(
        db,
        "auth.account_locked",
        actor_label="system",
        entity_type="admin_user",
        entity_id=str(user.id),
        details={"minutes": settings.login_lockout_minutes},
        ip_hash=ip_hash,
    )
    return True


def _new_session(
    db: DbSession, settings: Settings, request: Request, response: Response, user: AdminUser, pending: str | None
) -> AdminSession:
    now = utcnow()
    lifetime = timedelta(minutes=MFA_PENDING_MINUTES) if pending else timedelta(hours=settings.session_ttl_hours)
    token, csrf = generate_token(), generate_token()
    session = AdminSession(
        user_id=user.id,
        token_hash=hash_token(token),
        csrf_hash=hash_token(csrf),
        created_at=now,
        last_seen_at=now,
        expires_at=now + lifetime,
        ip_hash=client_ip_hash(request),
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        mfa_pending=pending,
    )
    db.add(session)
    _set_session_cookies(response, settings, token, csrf, int(lifetime.total_seconds()))
    response.headers["Cache-Control"] = "no-store"
    return session


def _complete_login(
    db: DbSession, settings: Settings, request: Request, response: Response, user: AdminUser, **details: str
) -> SessionOut:
    """Issue the full session and commit. After an MFA step the caller has revoked the pending session,
    so the cookie holds a new token (no session fixation across the privilege change)."""
    session = _new_session(db, settings, request, response, user, None)
    user.last_login_at = utcnow()
    user.failed_login_count = 0
    user.locked_until = None
    audit.record(
        db,
        "auth.login",
        actor=user,
        entity_type="admin_user",
        entity_id=str(user.id),
        details=details or None,
        ip_hash=session.ip_hash,
    )
    db.commit()
    return SessionOut(user=AdminUserOut.model_validate(user), expires_at=session.expires_at)


@router.post("/login", response_model=SessionOut)
def login(payload: LoginIn, request: Request, response: Response, db: DbSession, settings: AppSettings) -> SessionOut:
    email = payload.email.lower()
    _enforce_login_limits(request, settings, email)

    now = utcnow()
    ip_hash = client_ip_hash(request)
    user = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == email))
    # Always verify a hash so timing does not reveal whether the account exists.
    password_ok = verify_password(user.password_hash if user else None, payload.password)
    lockout_seconds = settings.login_lockout_minutes * 60

    if user is not None and user.locked_until is not None and user.locked_until > now:
        # Locked accounts answer exactly like the rate limiter (no account enumeration).
        audit.record(
            db,
            "auth.login_blocked",
            actor_label="anonymous",
            entity_type="admin_user",
            entity_id=str(user.id),
            ip_hash=ip_hash,
        )
        db.commit()
        raise rate_limited(int((user.locked_until - now).total_seconds()) + 1)

    if user is None or not password_ok or not user.is_active:
        details = {"email_sha256": _email_fingerprint(email)}
        audit.record(db, "auth.login_failed", actor_label="anonymous", details=details, ip_hash=ip_hash)
        if user is not None:
            _register_failure(db, settings, user, ip_hash)
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

    if user.mfa_enabled or settings.admin_mfa_required:
        # The failure counter is not reset here: only a completed sign-in resets it, so wrong codes
        # cannot be retried indefinitely by re-entering the correct password in between.
        pending = AdminMfaPending.VERIFY.value if user.mfa_enabled else AdminMfaPending.ENROL.value
        session = _new_session(db, settings, request, response, user, pending)
        audit.record(
            db,
            "auth.mfa_challenge",
            actor=user,
            entity_type="admin_user",
            entity_id=str(user.id),
            details={"step": pending},
            ip_hash=ip_hash,
        )
        db.commit()
        return SessionOut(user=AdminUserOut.model_validate(user), expires_at=session.expires_at, mfa=pending)

    return _complete_login(db, settings, request, response, user)


def _code_invalid() -> ApiError:
    return ApiError(status.HTTP_400_BAD_REQUEST, "Кодът не е валиден.", "mfa_code_invalid")


def _already_enabled() -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, "Двуфакторното удостоверяване вече е включено.", "mfa_already_enabled")


@router.post("/mfa/verify", response_model=SessionOut)
def mfa_verify(
    payload: MfaCodeIn,
    ctx: MfaVerifySession,
    request: Request,
    response: Response,
    db: DbSession,
    settings: AppSettings,
) -> SessionOut:
    """Second step of sign-in: an authenticator code or a one-time recovery code."""
    _enforce_login_limits(request, settings, ctx.user.email)
    now = utcnow()
    user = admin_mfa.lock_user(db, ctx.user.id)
    if user.locked_until is not None and user.locked_until > now:
        ctx.session.revoked_at = now
        audit.record(
            db,
            "auth.login_blocked",
            actor_label="anonymous",
            entity_type="admin_user",
            entity_id=str(user.id),
            ip_hash=ctx.ip_hash,
        )
        db.commit()
        raise rate_limited(int((user.locked_until - now).total_seconds()) + 1)

    method = None
    if admin_mfa.check_totp(settings, user, payload.code):
        method = "totp"
    elif admin_mfa.looks_like_recovery_code(payload.code) and admin_mfa.use_recovery_code(
        db, settings, user, payload.code
    ):
        method = "recovery_code"
    if method is None:
        audit.record(
            db,
            "auth.mfa_failed",
            actor_label="anonymous",
            entity_type="admin_user",
            entity_id=str(user.id),
            ip_hash=ctx.ip_hash,
        )
        if _register_failure(db, settings, user, ctx.ip_hash):
            ctx.session.revoked_at = now
            db.commit()
            raise rate_limited(settings.login_lockout_minutes * 60)
        db.commit()
        raise _code_invalid()

    if method == "recovery_code":
        audit.record(
            db,
            "auth.mfa_recovery_code_used",
            actor=user,
            entity_type="admin_user",
            entity_id=str(user.id),
            details={"remaining": admin_mfa.recovery_codes_remaining(db, user)},
            ip_hash=ctx.ip_hash,
        )
    ctx.session.revoked_at = now
    return _complete_login(db, settings, request, response, user, mfa=method)


@router.get("/mfa", response_model=MfaStatusOut)
def mfa_status(ctx: Staff, db: DbSession, settings: AppSettings, response: Response) -> MfaStatusOut:
    response.headers["Cache-Control"] = "no-store"
    return MfaStatusOut(
        enabled=ctx.user.mfa_enabled,
        enabled_at=ctx.user.mfa_enabled_at,
        recovery_codes_remaining=admin_mfa.recovery_codes_remaining(db, ctx.user) if ctx.user.mfa_enabled else 0,
        required=settings.admin_mfa_required,
    )


@router.post("/mfa/setup", response_model=MfaSetupOut)
def mfa_setup(ctx: MfaSetupSession, response: Response, db: DbSession, settings: AppSettings) -> MfaSetupOut:
    """A new key for the authenticator app (from the account page, or a sign-in that must enrol).
    It becomes active only when a code from it is confirmed; the key itself is never stored."""
    user = admin_mfa.lock_user(db, ctx.user.id)
    if user.mfa_enabled:
        raise _already_enabled()
    setup = admin_mfa.start_setup(settings, user)
    audit.record(
        db, "auth.mfa_setup_started", actor=user, entity_type="admin_user", entity_id=str(user.id), ip_hash=ctx.ip_hash
    )
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return MfaSetupOut(**setup)


@router.post("/mfa/confirm", response_model=MfaConfirmOut)
def mfa_confirm(
    payload: MfaCodeIn,
    ctx: MfaSetupSession,
    request: Request,
    response: Response,
    db: DbSession,
    settings: AppSettings,
) -> MfaConfirmOut:
    """Activate the key with a first code. Every other session of the account is ended; a pending
    sign-in becomes a full session. The recovery codes are returned once."""
    _enforce_login_limits(request, settings, ctx.user.email)
    user = admin_mfa.lock_user(db, ctx.user.id)
    if user.mfa_enabled:
        raise _already_enabled()
    if not user.mfa_nonce:
        raise ApiError(status.HTTP_409_CONFLICT, "Първо започнете настройката.", "mfa_setup_missing")
    codes = admin_mfa.confirm_setup(db, settings, user, payload.code)
    if codes is None:
        audit.record(
            db,
            "auth.mfa_setup_failed",
            actor=user,
            entity_type="admin_user",
            entity_id=str(user.id),
            ip_hash=ctx.ip_hash,
        )
        db.commit()
        raise _code_invalid()
    at_sign_in = ctx.session.mfa_pending is not None
    revoked = admin_mfa.revoke_sessions(db, user, keep=None if at_sign_in else ctx.session.id)
    audit.record(
        db,
        "auth.mfa_enabled",
        actor=user,
        entity_type="admin_user",
        entity_id=str(user.id),
        details={"sessions_revoked": revoked, "at_sign_in": at_sign_in},
        ip_hash=ctx.ip_hash,
    )
    response.headers["Cache-Control"] = "no-store"
    if at_sign_in:
        session = _complete_login(db, settings, request, response, user, mfa="enrolled")
        return MfaConfirmOut(recovery_codes=codes, session=session)
    db.commit()
    return MfaConfirmOut(recovery_codes=codes)


def _require_current_code(db: DbSession, settings: Settings, ctx: AdminContext, code: str) -> AdminUser:
    """An account change that needs a fresh authenticator code (not a recovery code), under the lockout."""
    user = admin_mfa.lock_user(db, ctx.user.id)
    if not user.mfa_enabled:
        raise ApiError(status.HTTP_409_CONFLICT, "Двуфакторното удостоверяване не е включено.", "mfa_not_enabled")
    if not admin_mfa.check_totp(settings, user, code):
        audit.record(
            db, "auth.mfa_failed", actor=user, entity_type="admin_user", entity_id=str(user.id), ip_hash=ctx.ip_hash
        )
        if _register_failure(db, settings, user, ctx.ip_hash):
            admin_mfa.revoke_sessions(db, user)
        db.commit()
        raise _code_invalid()
    return user


@router.post("/mfa/recovery-codes", response_model=MfaRecoveryCodesOut)
def mfa_recovery_codes(
    payload: MfaCodeIn, ctx: Staff, request: Request, response: Response, db: DbSession, settings: AppSettings
) -> MfaRecoveryCodesOut:
    """Replace the recovery codes (the earlier ones stop working). Needs a current authenticator code."""
    _enforce_login_limits(request, settings, ctx.user.email)
    user = _require_current_code(db, settings, ctx, payload.code)
    codes = admin_mfa.replace_recovery_codes(db, settings, user)
    audit.record(
        db,
        "auth.mfa_recovery_codes_replaced",
        actor=user,
        entity_type="admin_user",
        entity_id=str(user.id),
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return MfaRecoveryCodesOut(recovery_codes=codes)


@router.post("/mfa/disable", status_code=status.HTTP_204_NO_CONTENT)
def mfa_disable(payload: MfaDisableIn, ctx: Staff, request: Request, db: DbSession, settings: AppSettings) -> Response:
    """Switch the second factor off (password and a current code); other sessions end.
    Refused while ADMIN_MFA_REQUIRED is on."""
    if settings.admin_mfa_required:
        raise ApiError(status.HTTP_409_CONFLICT, "Двуфакторното удостоверяване е задължително.", "mfa_policy_required")
    _enforce_login_limits(request, settings, ctx.user.email)
    if not verify_password(ctx.user.password_hash, payload.password):
        audit.record(
            db,
            "auth.mfa_disable_failed",
            actor=ctx.user,
            entity_type="admin_user",
            entity_id=str(ctx.user.id),
            ip_hash=ctx.ip_hash,
        )
        if _register_failure(db, settings, ctx.user, ctx.ip_hash):
            admin_mfa.revoke_sessions(db, ctx.user)
        db.commit()
        raise ApiError(status.HTTP_400_BAD_REQUEST, INVALID_CREDENTIALS, "invalid_credentials")
    user = _require_current_code(db, settings, ctx, payload.code)
    admin_mfa.clear(db, user)
    revoked = admin_mfa.revoke_sessions(db, user, keep=ctx.session.id)
    audit.record(
        db,
        "auth.mfa_disabled",
        actor=user,
        entity_type="admin_user",
        entity_id=str(user.id),
        details={"sessions_revoked": revoked},
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(ctx: AnySession, response: Response, db: DbSession, settings: AppSettings) -> Response:
    """End the current session, including a pending one (cancelling the MFA step)."""
    ctx.session.revoked_at = utcnow()
    audit.record(
        db, "auth.logout", actor=ctx.user, entity_type="admin_user", entity_id=str(ctx.user.id), ip_hash=ctx.ip_hash
    )
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT
    _clear_session_cookies(response, settings)
    return response


@router.post("/logout-all", response_model=LogoutAllOut)
def logout_all(ctx: Staff, response: Response, db: DbSession, settings: AppSettings) -> LogoutAllOut:
    """Revoke every active session of the current administrator (all devices, including this one)."""
    now = utcnow()
    result = db.execute(
        update(AdminSession)
        .where(AdminSession.user_id == ctx.user.id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    audit.record(
        db,
        "auth.logout_all",
        actor=ctx.user,
        entity_type="admin_user",
        entity_id=str(ctx.user.id),
        details={"sessions_revoked": result.rowcount},
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    _clear_session_cookies(response, settings)
    return LogoutAllOut(sessions_revoked=result.rowcount)


@router.get("/sessions", response_model=list[AdminSessionInfo])
def list_sessions(ctx: Staff, db: DbSession, response: Response) -> list[AdminSessionInfo]:
    response.headers["Cache-Control"] = "no-store"
    now = utcnow()
    sessions = db.scalars(
        select(AdminSession)
        .where(
            AdminSession.user_id == ctx.user.id,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now,
            AdminSession.mfa_pending.is_(None),
        )
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
def me(ctx: Staff, response: Response) -> SessionOut:
    response.headers["Cache-Control"] = "no-store"
    return SessionOut(user=AdminUserOut.model_validate(ctx.user), expires_at=ctx.session.expires_at)
