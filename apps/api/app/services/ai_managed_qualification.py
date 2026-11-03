"""Deterministic categorisation of AI Managed Services inquiries for the admin (docs/AI_MANAGED_SERVICES_V2.md).

It suggests one of the proposed service levels and an onboarding readiness from the visitor's own
answers. It is a triage aid for the team, never shown to the visitor and never a commitment: the
level is agreed after the technical assessment. Every point carries a reason key; older inquiries
without the qualification answers get readiness "unknown".
"""

from __future__ import annotations

from typing import Any

QUALIFICATION_VERSION = "2026-11.1"
LEVELS = ("essential", "managed", "advanced")
READINESS = ("ready", "needs_preparation", "not_ready", "unknown")

_AGENT_POINTS = {"1": 0, "2_5": 1, "6_20": 2, "over_20": 3, "unknown": 0}
# Inclusive lower bounds on the points.
_BANDS = (("advanced", 6), ("managed", 3), ("essential", 0))


def qualify(details: dict[str, Any]) -> dict[str, Any]:
    """`details` are the validated AI Managed answers (enum values as strings)."""
    points = 0
    reasons: list[str] = []

    def add(value: int, reason: str) -> None:
        nonlocal points
        if value:
            points += value
            reasons.append(reason)

    add(_AGENT_POINTS.get(details.get("agents_count") or "", 0), f"agents_{details.get('agents_count')}")
    if {"workflow_automation", "custom_llm_app"} & set(details.get("system_types") or []):
        add(1, "acting_or_custom_systems")
    add({"personal": 1, "special": 2}.get(details.get("data_sensitivity") or "", 0), "sensitive_data")
    add({"monthly": 1, "weekly": 2}.get(details.get("change_frequency") or "", 0), "frequent_changes")
    add(2 if details.get("response_needs") == "faster" else 0, "faster_response_needed")
    if {"full_managed", "incident_support"} & set(details.get("support_interests") or []):
        add(1, "operations_requested")
    add(1 if details.get("production_status") == "production" else 0, "in_production")
    level = next(name for name, minimum in _BANDS if points >= minimum)

    blockers: list[str] = []
    status = details.get("production_status")
    access = details.get("access_readiness")
    owner = details.get("technical_owner")
    test_env = details.get("test_environment")
    if status == "development":
        blockers.append("not_in_operation")
    if access == "not_possible":
        blockers.append("no_access")
    if blockers:
        readiness = "not_ready"
    elif not (status and access and owner):
        readiness = "unknown"
    else:
        if owner == "no":
            blockers.append("no_technical_owner")
        if access in ("needs_approval", "unknown"):
            blockers.append("access_not_confirmed")
        if level != "essential" and test_env in (None, "no", "unknown"):
            blockers.append("no_test_environment")
        readiness = "needs_preparation" if blockers else "ready"

    desired = details.get("desired_level")
    return {
        "version": QUALIFICATION_VERSION,
        "suggested_level": level,
        "points": points,
        "reasons": reasons,
        "readiness": readiness,
        "blockers": blockers,
        "desired_level": desired,
        "matches_desired": None if desired in (None, "unsure") else desired == level,
    }
