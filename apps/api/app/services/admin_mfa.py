"""Staff TOTP second factor: enrolment, verification, one-time recovery codes and reset.

The TOTP implementation is the client portal's (app/portal/totp.py: RFC 6238, ±1 step of drift, a
used step is refused). The secret is derived from SECRET_KEY and the per-user random `mfa_nonce`
with the context `admin-totp`, so it is never stored and differs from any portal secret. Recovery
codes are random, shown once, and stored only as an HMAC keyed with SECRET_KEY; each works once.

Every function adds to the caller's transaction; the caller commits.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AdminMfaRecoveryCode, AdminSession, AdminUser, utcnow
from app.portal import totp

TOTP_CONTEXT = "admin-totp"
ISSUER = "A.I. Commerce Studio Admin"
RECOVERY_CODE_COUNT = 10
# Unambiguous lower-case letters and digits (no 0/o, 1/l/i); 12 characters ≈ 59 bits.
_RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
_RECOVERY_LENGTH = 12


def secret(settings: Settings, user: AdminUser) -> bytes:
    return totp.secret_for(settings.secret_key, user.id, user.mfa_nonce or "", TOTP_CONTEXT)


def lock_user(db: Session, user_id: uuid.UUID) -> AdminUser:
    """Re-read the account with a row lock: concurrent code checks for one account run one at a time,
    so the same code (or recovery code) cannot be accepted twice."""
    return db.execute(
        select(AdminUser).where(AdminUser.id == user_id).with_for_update().execution_options(populate_existing=True)
    ).scalar_one()


def start_setup(settings: Settings, user: AdminUser) -> dict[str, str]:
    """A fresh, not yet active key. Replaces any unconfirmed one; refused by the caller once enabled."""
    user.mfa_nonce, user.mfa_enabled, user.mfa_last_step, user.mfa_enabled_at = totp.new_nonce(), False, None, None
    key = secret(settings, user)
    return {"secret": totp.secret_b32(key), "otpauth_uri": totp.provisioning_uri(key, user.email, ISSUER)}


def check_totp(settings: Settings, user: AdminUser, code: str, now: float | None = None) -> bool:
    """Accept an authenticator code once: the matched step becomes `mfa_last_step`."""
    if not user.mfa_nonce:
        return False
    step = totp.verify(secret(settings, user), code.replace(" ", ""), user.mfa_last_step, now)
    if step is None:
        return False
    user.mfa_last_step = step
    return True


def confirm_setup(
    db: Session, settings: Settings, user: AdminUser, code: str, now: float | None = None
) -> list[str] | None:
    """Activate the key with a first code; returns the new recovery codes, or None for a wrong code."""
    if user.mfa_enabled or not check_totp(settings, user, code, now):
        return None
    user.mfa_enabled, user.mfa_enabled_at = True, utcnow()
    return replace_recovery_codes(db, settings, user)


def _normalise_recovery(code: str) -> str:
    return "".join(ch for ch in code.lower() if ch.isalnum())


def _recovery_hash(settings: Settings, user_id: uuid.UUID, code: str) -> str:
    message = f"admin-recovery:{user_id}:{_normalise_recovery(code)}".encode()
    return hmac.new(settings.secret_key.encode(), message, hashlib.sha256).hexdigest()


def replace_recovery_codes(db: Session, settings: Settings, user: AdminUser) -> list[str]:
    """Issue a new set; every earlier code (used or not) stops working."""
    db.execute(delete(AdminMfaRecoveryCode).where(AdminMfaRecoveryCode.user_id == user.id))
    codes = []
    for _ in range(RECOVERY_CODE_COUNT):
        raw = "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(_RECOVERY_LENGTH))
        codes.append(f"{raw[:4]}-{raw[4:8]}-{raw[8:]}")
    db.add_all(
        AdminMfaRecoveryCode(user_id=user.id, code_hash=_recovery_hash(settings, user.id, code)) for code in codes
    )
    db.flush()
    return codes


def looks_like_recovery_code(code: str) -> bool:
    return len(_normalise_recovery(code)) == _RECOVERY_LENGTH


def use_recovery_code(db: Session, settings: Settings, user: AdminUser, code: str) -> bool:
    """Spend one unused recovery code (single use: the row is marked, never reusable)."""
    used = db.execute(
        update(AdminMfaRecoveryCode)
        .where(
            AdminMfaRecoveryCode.user_id == user.id,
            AdminMfaRecoveryCode.code_hash == _recovery_hash(settings, user.id, code),
            AdminMfaRecoveryCode.used_at.is_(None),
        )
        .values(used_at=utcnow())
    ).rowcount
    return used == 1


def recovery_codes_remaining(db: Session, user: AdminUser) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(AdminMfaRecoveryCode)
            .where(AdminMfaRecoveryCode.user_id == user.id, AdminMfaRecoveryCode.used_at.is_(None))
        )
        or 0
    )


def revoke_sessions(db: Session, user: AdminUser, keep: uuid.UUID | None = None) -> int:
    query = update(AdminSession).where(AdminSession.user_id == user.id, AdminSession.revoked_at.is_(None))
    if keep is not None:
        query = query.where(AdminSession.id != keep)
    return db.execute(query.values(revoked_at=utcnow())).rowcount


def clear(db: Session, user: AdminUser) -> None:
    """Remove the second factor entirely (switch-off and the `reset-mfa` CLI)."""
    user.mfa_nonce, user.mfa_enabled, user.mfa_last_step, user.mfa_enabled_at = None, False, None, None
    db.execute(delete(AdminMfaRecoveryCode).where(AdminMfaRecoveryCode.user_id == user.id))
