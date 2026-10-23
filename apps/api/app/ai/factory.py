"""Selects the configured AI provider. Falls back to the mock provider when no key is configured."""

from __future__ import annotations

import logging
from functools import lru_cache

from app.ai.base import AIProvider
from app.ai.mock import MockProvider
from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_ai_provider() -> AIProvider:
    settings = get_settings()
    if settings.ai_provider == "anthropic":
        if not settings.anthropic_api_key:
            logger.warning("ai_provider_fallback", extra={"reason": "ANTHROPIC_API_KEY not set"})
            return MockProvider()
        from app.ai.anthropic_provider import AnthropicProvider

        return AnthropicProvider(
            api_key=settings.anthropic_api_key,
            model=settings.anthropic_model,
            timeout_seconds=settings.anthropic_timeout_seconds,
        )
    return MockProvider()
