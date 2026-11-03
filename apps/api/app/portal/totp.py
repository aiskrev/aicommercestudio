"""RFC 6238 time-based one-time passwords (SHA-1, 30 s, 6 digits) — the portal's enforced second factor.

The shared secret is derived, not stored: HMAC-SHA256(SECRET_KEY, "portal-totp:" + user id + nonce).
Only the random nonce is in the database, so a copy of the database is not enough to generate codes;
re-enrolment (recovery) replaces the nonce and invalidates the old secret.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
import uuid
from urllib.parse import quote

STEP_SECONDS = 30
DIGITS = 6
WINDOW = 1  # accept one step of clock drift either side


def new_nonce() -> str:
    return secrets.token_hex(32)


def secret_for(secret_key: str, user_id: uuid.UUID, nonce: str) -> bytes:
    return hmac.new(secret_key.encode(), f"portal-totp:{user_id}:{nonce}".encode(), hashlib.sha256).digest()[:20]


def secret_b32(secret: bytes) -> str:
    return base64.b32encode(secret).decode().rstrip("=")


def code_at(secret: bytes, step: int) -> str:
    digest = hmac.new(secret, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**DIGITS).zfill(DIGITS)


def current_step(now: float | None = None) -> int:
    return int((now if now is not None else time.time()) // STEP_SECONDS)


def verify(secret: bytes, code: str, last_step: int | None, now: float | None = None) -> int | None:
    """The matched time step, or None. A step at or before `last_step` is refused (no replay)."""
    if not (len(code) == DIGITS and code.isdigit()):
        return None
    step = current_step(now)
    for candidate in range(step - WINDOW, step + WINDOW + 1):
        if last_step is not None and candidate <= last_step:
            continue
        if hmac.compare_digest(code_at(secret, candidate), code):
            return candidate
    return None


def provisioning_uri(secret: bytes, email: str, issuer: str = "A.I. Commerce Studio") -> str:
    label = quote(f"{issuer}:{email}")
    return f"otpauth://totp/{label}?secret={secret_b32(secret)}&issuer={quote(issuer)}&digits={DIGITS}&period={STEP_SECONDS}"
