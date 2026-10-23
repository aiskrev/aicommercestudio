"""Password hashing (Argon2id), opaque session tokens and privacy-preserving hashes."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_hasher = PasswordHasher()
# Used to keep login timing constant when the e-mail does not exist.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))

MIN_PASSWORD_LENGTH = 12


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def validate_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long")
    if password.lower() == password or password.upper() == password or not any(c.isdigit() for c in password):
        raise ValueError("Password must mix upper/lower case letters and digits")


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def tokens_match(token: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), expected_hash)


def hash_ip(ip: str | None, secret_key: str) -> str | None:
    """Keyed hash of an IP address: lets us correlate abuse without storing the raw IP."""
    if not ip:
        return None
    return hmac.new(secret_key.encode(), f"ip:{ip}".encode(), hashlib.sha256).hexdigest()[:32]
