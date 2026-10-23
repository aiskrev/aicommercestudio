"""AI provider contract.

Providers only *suggest*. They never perform side effects directly: anything that
would send messages, change products/prices/orders or touch sensitive data must go
through `app.ai.policy` and an auditable approval record (`AIActionRequest`).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal, Protocol

from app.models import ServiceKey

if TYPE_CHECKING:
    from app.advisor.prompt import AdvisorPromptInput

Priority = Literal["low", "medium", "high"]

DISCLAIMER = (
    "Автоматично генерирано предложение. Проверете го преди да предприемете действие — "
    "системата не изпраща съобщения и не променя данни сама."
)

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


def redact_personal_data(text: str) -> str:
    """Data minimisation before text leaves our infrastructure."""
    return _PHONE_RE.sub("[телефон]", _EMAIL_RE.sub("[имейл]", text))


@dataclass(frozen=True)
class LeadTriageInput:
    service: str
    message: str


@dataclass(frozen=True)
class LeadTriage:
    provider: str
    model: str
    suggested_service: str
    priority: Priority
    summary: str
    suggested_next_step: str
    signals: list[str] = field(default_factory=list)
    disclaimer: str = DISCLAIMER


ProviderErrorKind = Literal["unavailable", "timeout", "rate_limited", "invalid_output", "declined"]


class AIProviderError(RuntimeError):
    def __init__(self, message: str, kind: ProviderErrorKind = "unavailable") -> None:
        super().__init__(message)
        self.kind = kind


@dataclass(frozen=True)
class AssessmentDraft:
    """Raw provider output for the automation advisor; validated by the advisor service."""

    provider: str
    model: str
    data: dict[str, Any]


class AIProvider(Protocol):
    name: str

    def triage_lead(self, data: LeadTriageInput) -> LeadTriage: ...

    def assess_automation(self, data: AdvisorPromptInput) -> AssessmentDraft: ...


VALID_SERVICES = [s.value for s in ServiceKey]
