"""Proposal draft sections for a lead that came from the project configurator or the quote basket.

The lead stores the enumerated answers and the review the server computed (app/configurator, app/quotes). This
module turns them into the sections of a first draft, in the words the visitor saw: `labels.json` is a
byte-for-byte copy of apps/web/src/lib/configurator-labels.json, generated from the site content
(scripts/test.ps1 compares the two).

Rules, the same as for every generated draft (app/opportunities/drafts.py): nothing commercial and no amount.
The indicative bands of the review are deliberately **not** copied into the draft: staff see them on the lead, and
only a person writes the commercial section. Anything without a published price is listed as needing an
assessment, so the person completing the draft cannot overlook it.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

from app.models import Lead

_PATH = Path(__file__).resolve().parent.parent / "configurator" / "labels.json"

_TEXT = {
    "bg": {
        "package": "{name} ({delivery}). {objective}",
        "chosen": "Избрано от клиента: {facts}.",
        "features": "Функции: {values}.",
        "operations": "След пускането: {values}.",
        "unpriced": "Изисква оценка преди оферта: {values}.",
        "extras": "Допълнителни услуги в заявката: {values}.",
        "goals_note": "Целите и специалните изисквания на клиента са в текста на запитването.",
        "milestone_timing": "[Ориентировъчен срок — уточнява се]",
        "yes": "да",
    },
    "en": {
        "package": "{name} ({delivery}). {objective}",
        "chosen": "Chosen by the client: {facts}.",
        "features": "Features: {values}.",
        "operations": "After launch: {values}.",
        "unpriced": "Needs an assessment before a quote: {values}.",
        "extras": "Extra services in the request: {values}.",
        "goals_note": "The client's goals and special requirements are in the text of the enquiry.",
        "milestone_timing": "[Indicative timing — to be agreed]",
        "yes": "yes",
    },
}

_FACTS = ("project_type", "pages", "products", "languages", "build", "branding", "design_level")
_FLAGS = ("content_migration", "store_migration", "accessibility", "interactive_elements")


@cache
def labels() -> dict[str, Any]:
    return json.loads(_PATH.read_text(encoding="utf-8"))


def _configurations(lead: Lead) -> tuple[list[tuple[dict[str, Any], dict[str, Any]]], list[dict[str, Any]]]:
    """(answers, review) pairs and extras stored with the lead; empty for every other kind of lead."""
    details = lead.service_details or {}
    kind = details.get("kind")
    if kind == "project_configurator" and details.get("answers") and details.get("review"):
        return [(details["answers"], details["review"])], []
    if kind == "quote_basket":
        items = (details.get("basket") or {}).get("items") or []
        configured = [(item["answers"], item["review"]) for item in items if item.get("answers") and item.get("review")]
        return configured, [item["extra"] for item in items if item.get("extra")]
    return [], []


def is_configured(lead: Lead) -> bool:
    configured, extras = _configurations(lead)
    return bool(configured or extras)


def _unique(values: list[str]) -> list[str]:
    seen: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.append(value)
    return seen


def sections(lead: Lead, locale: str) -> dict[str, Any] | None:
    """Scope, deliverables, assumptions, exclusions, dependencies and milestones from the stored configuration.

    Returns None when the lead has no configuration. Everything is a label of a key the client chose or of the
    package those choices led to; nothing is inferred beyond that.
    """
    configured, extras = _configurations(lead)
    if not configured and not extras:
        return None
    words = labels()[locale if locale in ("bg", "en") else "bg"]
    t = _TEXT[locale if locale in _TEXT else "bg"]
    several = len(configured) > 1

    scope: list[str] = []
    deliverables: list[str] = []
    exclusions: list[str] = []
    dependencies: list[str] = []
    assumptions: list[str] = []
    stages: list[str] = []
    for answers, review in configured:
        package = words["packages"].get(review.get("package"))
        if package is None:
            continue
        prefix = f"{package['name']}: " if several else ""
        scope.append(
            t["package"].format(
                name=package["name"],
                delivery=words["delivery"].get(review.get("delivery"), review.get("delivery")),
                objective=package["objective"],
            )
        )
        facts = [words["questions"][field].get(str(answers.get(field))) for field in _FACTS]
        facts += [words["flags"][flag] for flag in _FLAGS if answers.get(flag)]
        scope.append(t["chosen"].format(facts="; ".join(fact for fact in facts if fact)))
        chosen = [words["features"].get(name, name) for name in answers.get("features") or []]
        if chosen:
            scope.append(t["features"].format(values=", ".join(chosen)))
        operations = [words["operations"].get(name, name) for name in answers.get("operations") or []]
        if operations:
            scope.append(t["operations"].format(values=", ".join(operations)))
        unpriced = [
            words["features"].get(key[8:], key) if key.startswith("feature:") else words["unpriced"].get(key, key)
            for key in review.get("unpriced") or []
        ]
        if unpriced:
            scope.append(t["unpriced"].format(values=", ".join(unpriced)))
        deliverables += [f"{prefix}{item}" for item in package["includes"]]
        exclusions += [f"{prefix}{item}" for item in package["excludes"]]
        dependencies += [f"{prefix}{item}" for item in package["prerequisites"]]
        assumptions += [words["assumptions"].get(key, key) for key in review.get("assumptions") or []]
        exclusions += [words["exclusions"].get(key, key) for key in review.get("exclusions") or []]
        stages += [f"{prefix}{stage}" for stage in package["stages"]]
    if extras:
        names = [words["offers"].get(extra["group"], {}).get(extra["key"], extra["key"]) for extra in extras]
        scope.append(t["extras"].format(values=", ".join(names)))
    scope.append(t["goals_note"])

    return {
        "scope": "\n\n".join(scope)[:4000],
        "deliverables": _unique(deliverables)[:40],
        "assumptions": _unique(assumptions)[:40],
        "exclusions": _unique(exclusions)[:40],
        "dependencies": _unique(dependencies)[:40],
        "milestones": [
            {"title": stage[:200], "description": "", "indicative_timing": t["milestone_timing"]}
            for stage in _unique(stages)[:20]
        ],
    }


def summary(lead: Lead, locale: str) -> str | None:
    """One paragraph for the opportunity's scope field: the package(s) and what the client chose. Facts only."""
    built = sections(lead, locale)
    return built["scope"] if built else None
