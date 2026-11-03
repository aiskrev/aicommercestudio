"""Client portal identities, invitations, recovery and sessions (docs/CLIENT_PORTAL.md).

Client users are separate from staff (`admin_users`): their own table, sessions, cookies and
permissions, and they are bound to exactly one organisation. Authentication is password + TOTP; a
session is usable only after the second factor. The organisation of every portal request comes from
the authenticated session, never from the URL.

Lookups that run before the organisation is known (token, e-mail, session hash) run as the schema
owner; everything after that is bound to the session's organisation under row-level security.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings
from app.errors import ApiError
from app.models import OpsOrganization, OpsOrganizationStatus, utcnow
from app.ops.models import PortalSession, PortalToken, PortalTokenPurpose, PortalUser, PortalUserStatus
from app.portal import totp
from app.security import generate_token, hash_password, hash_token, validate_password_strength

MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15


def invalid_token() -> ApiError:
    return ApiError(status.HTTP_400_BAD_REQUEST, "The link is invalid or has expired.", "portal_token_invalid")


def unauthorized(code: str = "portal_unauthorized") -> ApiError:
    return ApiError(status.HTTP_401_UNAUTHORIZED, "Sign in to the client portal.", code)


def record(db: Session, action: str, user: PortalUser | None, organization_id: uuid.UUID, **details) -> None:
    audit.record(
        db,
        action,
        actor_label=f"portal:{user.id}" if user else "portal",
        entity_type="portal_user",
        entity_id=str(user.id) if user else None,
        details={"organization_id": str(organization_id), **details},
    )


# ------------------------------------------------------------------------------ invitations


def issue_token(
    db: Session, user: PortalUser, purpose: PortalTokenPurpose, hours: int, created_by: uuid.UUID | None
) -> str:
    # One open token per purpose: issuing a new one invalidates the previous link.
    db.execute(
        update(PortalToken)
        .where(PortalToken.user_id == user.id, PortalToken.purpose == purpose, PortalToken.used_at.is_(None))
        .values(used_at=utcnow())
    )
    token = generate_token()
    db.add(
        PortalToken(
            organization_id=user.organization_id,
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(token),
            expires_at=utcnow() + timedelta(hours=hours),
            created_by=created_by,
        )
    )
    return token


def _usable_token(db: Session, raw: str, purpose: PortalTokenPurpose) -> tuple[PortalToken, PortalUser]:
    if not raw or len(raw) > 200:
        raise invalid_token()
    token = db.scalar(
        select(PortalToken).where(PortalToken.token_hash == hash_token(raw), PortalToken.purpose == purpose)
    )
    if token is None or token.used_at is not None or token.expires_at <= utcnow():
        raise invalid_token()
    user = db.get(PortalUser, token.user_id)
    org = db.get(OpsOrganization, token.organization_id)
    if (
        user is None
        or user.status == PortalUserStatus.DISABLED
        or org is None
        or org.status != OpsOrganizationStatus.ACTIVE
    ):
        raise invalid_token()
    return token, user


def start_enrolment(
    db: Session, settings: Settings, raw: str, purpose: PortalTokenPurpose, password: str
) -> dict[str, str]:
    """Set the password and a fresh TOTP secret; the token stays open until the first code is confirmed."""
    token, user = _usable_token(db, raw, purpose)
    try:
        validate_password_strength(password)
    except ValueError as exc:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc), "portal_weak_password") from None
    user.password_hash = hash_password(password)
    user.mfa_nonce, user.mfa_enabled, user.mfa_last_step = totp.new_nonce(), False, None
    if purpose is PortalTokenPurpose.RECOVERY:
        revoke_sessions(db, user)
    db.commit()
    secret = totp.secret_for(settings.secret_key, user.id, user.mfa_nonce)
    return {"otpauth_uri": totp.provisioning_uri(secret, user.email), "secret": totp.secret_b32(secret)}


def confirm_enrolment(
    db: Session, settings: Settings, raw: str, purpose: PortalTokenPurpose, code: str, now: float | None = None
) -> None:
    token, user = _usable_token(db, raw, purpose)
    if not user.mfa_nonce or not user.password_hash:
        raise invalid_token()
    step = totp.verify(totp.secret_for(settings.secret_key, user.id, user.mfa_nonce), code, user.mfa_last_step, now)
    if step is None:
        raise ApiError(status.HTTP_400_BAD_REQUEST, "The code is not valid.", "portal_code_invalid")
    current = utcnow()
    user.mfa_enabled, user.mfa_last_step = True, step
    user.status = PortalUserStatus.ACTIVE
    user.activated_at = user.activated_at or current
    user.failed_login_count, user.locked_until = 0, None
    token.used_at = current
    record(db, "ops.portal_enrolled", user, user.organization_id, purpose=purpose.value)
    db.commit()


# --------------------------------------------------------------------------------- sessions


def revoke_sessions(db: Session, user: PortalUser) -> None:
    db.execute(
        update(PortalSession)
        .where(PortalSession.user_id == user.id, PortalSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )


def create_session(db: Session, settings: Settings, user: PortalUser) -> tuple[str, str]:
    token, csrf = generate_token(), generate_token()
    db.add(
        PortalSession(
            organization_id=user.organization_id,
            user_id=user.id,
            token_hash=hash_token(token),
            csrf_hash=hash_token(csrf),
            mfa_verified=False,
            expires_at=utcnow() + timedelta(hours=settings.portal_session_hours),
        )
    )
    return token, csrf


def locked(user: PortalUser, now: datetime) -> bool:
    return user.locked_until is not None and user.locked_until > now


def register_failure(user: PortalUser, now: datetime) -> None:
    user.failed_login_count += 1
    if user.failed_login_count >= MAX_FAILED_LOGINS:
        user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
        user.failed_login_count = 0
