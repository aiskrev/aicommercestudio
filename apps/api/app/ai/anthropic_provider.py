"""Anthropic Claude provider (optional). Enabled with AI_PROVIDER=anthropic + ANTHROPIC_API_KEY.

Only the selected service and a redacted copy of the inquiry text are sent — never
names, e-mail addresses, phone numbers or company names. Before enabling this in
production, sign a data processing agreement with the provider and update the
privacy notice accordingly.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.ai.base import (
    VALID_SERVICES,
    AIProviderError,
    LeadTriage,
    LeadTriageInput,
    redact_personal_data,
)

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You triage inbound B2B inquiries for an e-commerce engineering and AI studio in Bulgaria. "
    "Classify the inquiry into exactly one service key, estimate priority, and write a short "
    "summary and a concrete next step for the sales team. Write `summary`, `suggested_next_step` "
    "and `signals` in Bulgarian. Never invent facts that are not present in the inquiry. "
    "Service keys: maintenance (Shopify/WooCommerce support), seo, ai_tools (custom AI tools), "
    "automation (business process automation), analytics (analytics and conversion), "
    "integrations (APIs, cloud, security), audit (technical audit), other."
)

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "suggested_service": {"type": "string", "enum": VALID_SERVICES},
        "priority": {"type": "string", "enum": ["low", "medium", "high"]},
        "summary": {"type": "string"},
        "suggested_next_step": {"type": "string"},
        "signals": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["suggested_service", "priority", "summary", "suggested_next_step", "signals"],
    "additionalProperties": False,
}


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, timeout_seconds: float = 30.0) -> None:
        import anthropic  # imported lazily so the mock path has no SDK dependency at runtime

        self._anthropic = anthropic
        self._client = anthropic.Anthropic(api_key=api_key, timeout=timeout_seconds, max_retries=2)
        self.model = model

    def triage_lead(self, data: LeadTriageInput) -> LeadTriage:
        anthropic = self._anthropic
        user_content = (
            f"Selected service on the form: {data.service}\n\n"
            f"Inquiry (personal data redacted):\n{redact_personal_data(data.message)}"
        )
        try:
            # Server-side refusal fallback is enabled (`fallbacks="default"`): if the primary
            # model declines, the API re-runs the request on a fallback model in the same call.
            response = self._client.beta.messages.create(
                model=self.model,
                max_tokens=2000,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                system=_SYSTEM_PROMPT,
                output_config={"effort": "low", "format": {"type": "json_schema", "schema": _SCHEMA}},
                messages=[{"role": "user", "content": user_content}],
            )
        except anthropic.RateLimitError as exc:
            raise AIProviderError("AI provider rate limit reached") from exc
        except anthropic.APIStatusError as exc:
            logger.warning("anthropic_api_error", extra={"status_code": exc.status_code})
            raise AIProviderError(f"AI provider error ({exc.status_code})") from exc
        except anthropic.APIConnectionError as exc:
            raise AIProviderError("AI provider unreachable") from exc

        if response.stop_reason == "refusal":
            raise AIProviderError("AI provider declined the request")
        text = next((b.text for b in response.content if b.type == "text"), None)
        if not text:
            raise AIProviderError("AI provider returned no text")
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AIProviderError("AI provider returned invalid JSON") from exc

        return LeadTriage(
            provider=self.name,
            model=response.model,
            suggested_service=parsed["suggested_service"],
            priority=parsed["priority"],
            summary=parsed["summary"][:600],
            suggested_next_step=parsed["suggested_next_step"][:600],
            signals=[str(s)[:200] for s in parsed.get("signals", [])][:10],
        )
