"""Building blocks shared by the Bulgarian and English demo templates of the advisor."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ProcessPattern:
    key: str
    label: str
    keywords: tuple[str, ...]
    uses_ai: bool
    opportunities: list[dict[str, str]]
    workflow: list[dict[str, Any]]
    approvals: list[dict[str, str]]
    risks: list[dict[str, str]]
    data_protection: list[str] = field(default_factory=list)
    questions: list[str] = field(default_factory=list)


def opp(title: str, description: str, approach: str, priority: str) -> dict[str, str]:
    return {"title": title, "description": description, "approach": approach, "priority": priority}


def step(title: str, description: str, actor: str, approval: bool = False) -> dict[str, Any]:
    return {"title": title, "description": description, "actor": actor, "requires_human_approval": approval}


def approval(decision: str, reason: str) -> dict[str, str]:
    return {"decision": decision, "reason": reason}


def risk(text: str, mitigation: str) -> dict[str, str]:
    return {"risk": text, "mitigation": mitigation}
