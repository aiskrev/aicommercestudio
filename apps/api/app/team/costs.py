"""Transparent, scenario-based cost estimate for a configured AI team.

Every figure comes from a versioned assumptions document (app/team/pricing/<version>.json, or the
file in TEAM_COST_ASSUMPTIONS_FILE). Visitors may override four rates within bounds (OVERRIDE_BOUNDS);
the overrides are recorded with the estimate. Triples in the assumptions are
[conservative, expected, higher] — "conservative" means lower usage and a lean scope.

Lines (EUR, rounded to 10):
  one-time    discovery + agent build + integrations + approval setup + deployment + testing, in days × day rate
  monthly     infrastructure + model/API usage + monitoring & maintenance + human oversight (internal time)
Nothing here is a quote; the estimate configures nothing and deploys nothing.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.team.model import AGENTS, VOLUMES, TeamConfig, agent_configs, selected_agents, team_integrations

PRICING_DIR = Path(__file__).parent / "pricing"
DEFAULT_ASSUMPTIONS = PRICING_DIR / "2026-10.1.json"
SCENARIOS = ("conservative", "expected", "higher")

#: Visitor-editable assumptions and their allowed range (inclusive).
OVERRIDE_BOUNDS: dict[str, tuple[float, float]] = {
    "day_rate": (200, 2500),
    "internal_hourly_rate": (5, 250),
    "price_per_million_input": (0, 100),
    "price_per_million_output": (0, 300),
}

_TRIPLE_PATHS = (
    ("one_time", "discovery_days"),
    ("one_time", "approval_setup_days"),
    ("one_time", "testing_share"),
    ("model_usage", "overhead"),
    ("oversight", "minutes_per_review"),
    ("oversight", "sample_share"),
    ("oversight", "external_action_share"),
)


class AssumptionsError(ValueError):
    """The assumptions document is missing values or has invalid ones."""


def _check_triple(value: Any, where: str) -> None:
    if not (isinstance(value, list) and len(value) == 3 and all(isinstance(v, int | float) and v >= 0 for v in value)):
        raise AssumptionsError(f"{where}: expected three non-negative numbers")


def validate_assumptions(doc: dict[str, Any]) -> dict[str, Any]:
    """Fail fast on a broken document instead of producing wrong numbers."""
    try:
        if not isinstance(doc.get("version"), str) or not doc["version"]:
            raise AssumptionsError("version missing")
        if doc.get("currency") != "EUR":
            raise AssumptionsError("currency must be EUR")
        for path in _TRIPLE_PATHS:
            _check_triple(doc[path[0]][path[1]], ".".join(path))
        for volume in VOLUMES:
            _check_triple(doc["volume_tasks"][volume], f"volume_tasks.{volume}")
        for band in ("low", "medium", "high"):
            _check_triple(doc["one_time"]["agent_build_days"][band], f"agent_build_days.{band}")
            _check_triple(doc["one_time"]["integration_days"][band], f"integration_days.{band}")
        for deployment in ("managed_cloud", "customer_cloud", "on_premise"):
            _check_triple(doc["one_time"]["deployment_days"][deployment], f"deployment_days.{deployment}")
            for key in ("base", "per_agent"):
                _check_triple(
                    doc["infrastructure_monthly"][deployment][key], f"infrastructure_monthly.{deployment}.{key}"
                )
        for operations in ("studio_managed", "shared", "internal"):
            for key in ("studio_base_hours", "studio_hours_per_agent", "internal_hours_per_agent"):
                _check_triple(doc["monitoring_monthly"][operations][key], f"monitoring_monthly.{operations}.{key}")
        for agent in AGENTS:
            pair = doc["model_usage"]["tokens_per_task"][agent]
            if not (isinstance(pair, list) and len(pair) == 2 and all(isinstance(v, int) and v >= 0 for v in pair)):
                raise AssumptionsError(f"tokens_per_task.{agent}")
        for integration, band in doc["integration_complexity"].items():
            if band not in ("low", "medium", "high"):
                raise AssumptionsError(f"integration_complexity.{integration}")
        for key in OVERRIDE_BOUNDS:
            source = doc["rates"] if key in doc["rates"] else doc["model_usage"]
            low, high = OVERRIDE_BOUNDS[key]
            if not (isinstance(source[key], int | float) and low <= source[key] <= high):
                raise AssumptionsError(f"{key} outside {low}–{high}")
    except (KeyError, TypeError) as exc:
        raise AssumptionsError(f"missing value: {exc}") from exc
    return doc


@lru_cache(maxsize=4)
def load_assumptions(path: str | None = None) -> dict[str, Any]:
    file = Path(path) if path else DEFAULT_ASSUMPTIONS
    return validate_assumptions(json.loads(file.read_text(encoding="utf-8")))


def public_assumptions(doc: dict[str, Any]) -> dict[str, Any]:
    """The document as published by /meta, plus which values a visitor may change and their bounds."""
    return {
        **doc,
        "editable": {
            key: {"min": low, "max": high, "default": _rate(doc, key)} for key, (low, high) in OVERRIDE_BOUNDS.items()
        },
    }


def _rate(doc: dict[str, Any], key: str) -> float:
    return doc["rates"][key] if key in doc["rates"] else doc["model_usage"][key]


def _money(value: float) -> int:
    """Round half up to the nearest 10 EUR."""
    return int(math.floor(value / 10 + 0.5) * 10)


def _round(value: float, step: float = 0.5) -> float:
    return math.floor(value / step + 0.5) * step


def _scenario(config: TeamConfig, doc: dict[str, Any], rates: dict[str, float], s: int) -> dict[str, Any]:
    configs = agent_configs(config)
    agents = selected_agents(config)
    integrations = team_integrations(configs)
    one = doc["one_time"]
    hour_rate = rates["day_rate"] / 8

    # ---- one-time effort (days)
    gated = [a for a in agents if configs[a]["checkpoint"] in ("before_external", "every_action")]
    integration_rows = [
        {
            "integration": i,
            "complexity": doc["integration_complexity"].get(i, "medium"),
            "days": one["integration_days"][doc["integration_complexity"].get(i, "medium")][s],
        }
        for i in integrations
    ]
    days = {
        "discovery": one["discovery_days"][s],
        "agents": sum(one["agent_build_days"][AGENTS[a].complexity][s] for a in agents),
        "integrations": sum(row["days"] for row in integration_rows),
        "approvals": one["approval_setup_days"][s] * len(gated),
        "deployment": one["deployment_days"][config.deployment or "managed_cloud"][s],
    }
    days["testing"] = one["testing_share"][s] * (days["agents"] + days["integrations"])
    total_days = sum(days.values())
    one_time = {key: _money(value * rates["day_rate"]) for key, value in days.items()}
    one_time["total"] = sum(one_time.values())

    # ---- usage, model cost and human oversight (per month)
    usage = doc["model_usage"]
    tasks = {a: doc["volume_tasks"][configs[a]["volume"]][s] for a in agents if AGENTS[a].role == "task"}
    task_total = sum(tasks.values())
    oversight = doc["oversight"]
    share = {
        "none": 0.0,
        "sample_review": oversight["sample_share"][s],
        "before_external": oversight["external_action_share"][s],
        "every_action": 1.0,
    }
    reviews = sum(tasks[a] * share[configs[a]["checkpoint"]] for a in tasks)
    approval_requests = sum(tasks[a] * share[configs[a]["checkpoint"]] for a in tasks if a in gated)
    runs = dict(tasks)
    if "workflow_coordinator" in agents:
        runs["workflow_coordinator"] = task_total
    if "approval_supervisor" in agents:
        runs["approval_supervisor"] = approval_requests
    input_tokens = sum(runs[a] * usage["tokens_per_task"][a][0] for a in runs)
    output_tokens = sum(runs[a] * usage["tokens_per_task"][a][1] for a in runs)
    model_cost = (
        (input_tokens * rates["price_per_million_input"] + output_tokens * rates["price_per_million_output"])
        / 1_000_000
        * usage["overhead"][s]
    )
    review_hours = reviews * oversight["minutes_per_review"][s] / 60

    # ---- infrastructure and monitoring
    infra = doc["infrastructure_monthly"][config.deployment or "managed_cloud"]
    infrastructure = infra["base"][s] + infra["per_agent"][s] * len(agents)
    monitoring_model = doc["monitoring_monthly"][config.operations or "shared"]
    studio_hours = monitoring_model["studio_base_hours"][s] + monitoring_model["studio_hours_per_agent"][s] * len(
        agents
    )
    internal_hours = monitoring_model["internal_hours_per_agent"][s] * len(agents)
    monitoring = studio_hours * hour_rate + internal_hours * rates["internal_hourly_rate"]

    monthly = {
        "infrastructure": _money(infrastructure),
        "model_usage": _money(model_cost),
        "monitoring": _money(monitoring),
        "oversight": _money(review_hours * rates["internal_hourly_rate"]),
    }
    monthly["total"] = sum(monthly.values())
    return {
        "one_time": one_time,
        "one_time_days": {key: _round(value) for key, value in {**days, "total": total_days}.items()},
        "integrations": integration_rows,
        "monthly": monthly,
        "usage": {
            "tasks_per_month": int(task_total),
            "input_tokens": int(input_tokens),
            "output_tokens": int(output_tokens),
        },
        "oversight": {"reviews_per_month": int(math.floor(reviews + 0.5)), "hours_per_month": _round(review_hours)},
        "monitoring_hours": {"studio": _round(studio_hours), "internal": _round(internal_hours)},
    }


def estimate(config: TeamConfig, doc: dict[str, Any], overrides: dict[str, float] | None = None) -> dict[str, Any]:
    """Three scenarios plus ranges. `overrides` must already be validated against OVERRIDE_BOUNDS."""
    applied = {k: float(v) for k, v in (overrides or {}).items() if k in OVERRIDE_BOUNDS and v is not None}
    rates = {key: applied.get(key, _rate(doc, key)) for key in OVERRIDE_BOUNDS}
    scenarios = {name: _scenario(config, doc, rates, index) for index, name in enumerate(SCENARIOS)}
    one_time = [scenarios[name]["one_time"]["total"] for name in SCENARIOS]
    monthly = [scenarios[name]["monthly"]["total"] for name in SCENARIOS]
    return {
        "assumptions_version": doc["version"],
        "currency": doc["currency"],
        "rates": rates,
        "overrides": applied,
        "scenarios": scenarios,
        "ranges": {"one_time": [min(one_time), max(one_time)], "monthly": [min(monthly), max(monthly)]},
    }
