"""Cloudflare Turnstile, verified on the server. Off until TURNSTILE_SECRET_KEY is set.

A token proves nothing until siteverify accepts it. If Cloudflare cannot be reached the request is
refused: a sign-up form is not worth opening to bots, and the visitor can simply try again.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import status

from app.config import Settings
from app.errors import ApiError

logger = logging.getLogger(__name__)
SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def require_human(settings: Settings, token: str | None, ip: str | None) -> None:
    if not settings.turnstile_secret_key:
        return
    failed = ApiError(status.HTTP_400_BAD_REQUEST, "Please confirm you're not a robot.", "turnstile_failed")
    if not token:
        raise failed
    try:
        answer = httpx.post(
            SITEVERIFY,
            data={"secret": settings.turnstile_secret_key, "response": token, "remoteip": ip or ""},
            timeout=5,
        ).json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("turnstile_unreachable")
        raise failed from exc
    if not answer.get("success"):
        raise failed
