"""Spam mitigation for public forms: signed timing tokens, honeypot and content heuristics."""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import time

_URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
MAX_LINKS_IN_MESSAGE = 3


def _sign(secret_key: str, payload: str) -> str:
    digest = hmac.new(secret_key.encode(), f"form:{payload}".encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest[:18]).decode().rstrip("=")


def issue_form_token(secret_key: str, now: float | None = None) -> str:
    issued = int(time.time() if now is None else now)
    payload = f"{issued}.{secrets.token_hex(6)}"
    return f"{payload}.{_sign(secret_key, payload)}"


def check_form_token(
    token: str | None,
    secret_key: str,
    min_seconds: int,
    max_age_seconds: int,
    now: float | None = None,
) -> str | None:
    """Return None when the token is acceptable, otherwise a short machine-readable reason."""
    if not token:
        return "missing"
    parts = token.split(".")
    if len(parts) != 3 or not parts[0].isdigit():
        return "malformed"
    payload = f"{parts[0]}.{parts[1]}"
    if not hmac.compare_digest(_sign(secret_key, payload), parts[2]):
        return "bad_signature"
    age = (time.time() if now is None else now) - int(parts[0])
    if age < min_seconds:
        return "too_fast"
    if age > max_age_seconds:
        return "expired"
    return None


def looks_like_link_spam(text: str) -> bool:
    return len(_URL_RE.findall(text)) > MAX_LINKS_IN_MESSAGE
