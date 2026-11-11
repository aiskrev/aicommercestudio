"""Project configurator: rules and the deterministic review.

The browser sends enumerated answers only; this module is the only place that decides which package they lead to,
what is priced, what needs an assessment and why a person must review the result. Amounts are read from the
published schedule (app/pricing.py) and are never accepted from a request.

`model.json` is a byte-for-byte copy of apps/web/src/lib/configurator-model.json (scripts/test.ps1 compares the
two): the option lists, the packages and the feature tables. The web uses it to draw the form and to label every
key this module can return; the evaluation itself exists only here.

What a review is: an indicative guide for a conversation. It is not a quote, not an offer and not a commitment,
and it always says that a person must review it.
"""

from __future__ import annotations

import enum
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app import pricing

MODEL: dict[str, Any] = json.loads(Path(__file__).with_name("model.json").read_text(encoding="utf-8"))
MODEL_VERSION: str = MODEL["version"]


def _enum(name: str, key: str) -> type[enum.StrEnum]:
    return enum.StrEnum(name, {value.upper(): value for value in MODEL[key]})  # type: ignore[return-value]


ProjectType = _enum("ProjectType", "project_types")
Pages = _enum("Pages", "pages")
Products = _enum("Products", "products")
Languages = _enum("Languages", "languages")
Build = _enum("Build", "build")
Feature = _enum("Feature", "features")
Branding = _enum("Branding", "branding")
DesignLevel = _enum("DesignLevel", "design_level")
Operation = _enum("Operation", "operations")

#: Requirements that never have a published price: they are listed as "requires assessment". The lists live in the
#: shared model file, so the web has a label for every key this module can return.
UNPRICED_KEYS: tuple[str, ...] = (*MODEL["unpriced_keys"], *(f"feature:{name}" for name in MODEL["features"]))
ASSUMPTION_KEYS: tuple[str, ...] = tuple(MODEL["assumption_keys"])
EXCLUSION_KEYS: tuple[str, ...] = tuple(MODEL["exclusion_keys"])
REVIEW_REASONS: tuple[str, ...] = tuple(MODEL["review_reasons"])
RULES: tuple[str, ...] = tuple(MODEL["rules"])


@dataclass(frozen=True)
class Answers:
    """Validated, enumerated answers (app/configurator/schemas.py builds this from a request)."""

    project_type: str
    pages: str
    products: str
    languages: str
    build: str
    content_migration: bool
    store_migration: bool
    features: tuple[str, ...]
    branding: str
    design_level: str
    accessibility: bool
    interactive_elements: bool
    operations: tuple[str, ...]
    timeline: str
    budget_range: str


@dataclass(frozen=True)
class Item:
    """One line of the review: the package, a separately priced service or a care plan."""

    kind: str  # "package" | "service" | "care_plan"
    key: str
    reason: str  # the package key, "feature:<name>" or "operation:<name>"
    band: pricing.PriceBand | None


@dataclass(frozen=True)
class Review:
    package: str
    service: str
    delivery: str
    items: tuple[Item, ...]
    included: tuple[str, ...]
    unpriced: tuple[str, ...]
    assumptions: tuple[str, ...]
    exclusions: tuple[str, ...]
    review_reasons: tuple[str, ...]
    one_time_from: int
    monthly_from: int
    primary_priced: bool
    violations: tuple[str, ...] = field(default=())


def violations(answers: Answers) -> list[str]:
    """Unsupported combinations, as stable rule names (`feature_not_for_type:<feature>` names the feature)."""
    found: list[str] = []
    kind = answers.project_type
    features = set(answers.features)
    if kind == "landing_page" and answers.pages != "one":
        found.append("landing_single_page")
    if answers.products != "none" and kind not in ("online_store", "custom_application"):
        found.append("products_need_store")
    if kind == "online_store" and answers.products == "none":
        found.append("store_needs_products")
    if answers.store_migration and kind != "online_store":
        found.append("store_migration_needs_store")
    if "user_dashboard" in features and "customer_accounts" not in features:
        found.append("dashboard_needs_accounts")
    found.extend(f"feature_not_for_type:{name}" for name in MODEL["unavailable_features"][kind] if name in features)
    return found


def recommend(answers: Answers) -> str:
    """The package the answers lead to. Custom engineering is never downgraded to a fixed scope."""
    kind = answers.project_type
    if kind == "landing_page":
        return "landing_page"
    if kind == "business_website":
        return "business_website"
    if kind == "custom_application":
        return "custom_web_app"
    simple = (
        answers.products == "up_to_50"
        and not answers.store_migration
        and not answers.content_migration
        and answers.design_level == "standard"
        and answers.languages != "three_plus"
        and not set(answers.features) & set(MODEL["store_complete_triggers"])
    )
    return "store_setup" if simple else "store_complete"


def review(answers: Answers) -> Review:
    """The deterministic review. Raises ValueError with the rule names for an unsupported combination."""
    broken = violations(answers)
    if broken:
        raise ValueError(",".join(broken))

    package = recommend(answers)
    definition = MODEL["packages"][package]
    service = definition["service"]
    features = set(answers.features)
    included = [name for name in MODEL["included_features"][package] if name in features]

    items: list[Item] = [
        Item("package", package, package, pricing.band("service", service) if definition["priced"] else None)
    ]
    unpriced: list[str] = [] if definition["priced"] else ["package_scope"]

    # Features: included in the package, priced by an existing service (once per service), or assessed.
    priced_services: dict[str, str] = {}
    for name in MODEL["features"]:
        if name not in features or name in included:
            continue
        target = MODEL["priced_features"].get(name)
        if target and target != service:
            priced_services.setdefault(target, f"feature:{name}")
        else:
            unpriced.append(f"feature:{name}")
    for target, reason in priced_services.items():
        items.append(Item("service", target, reason, pricing.band("service", target)))

    # Scope and design that change the price but have no published amount.
    if answers.languages != "one":
        unpriced.append("additional_languages")
    if answers.build == "redesign":
        unpriced.append("redesign")
    if answers.content_migration:
        unpriced.append("content_migration")
    if answers.pages == "more_than_15":
        unpriced.append("large_site")
    if answers.products == "more_than_500":
        unpriced.append("large_catalogue")
    if answers.branding == "new":
        unpriced.append("new_branding")
    if answers.design_level == "bespoke":
        unpriced.append("bespoke_design")
    if answers.accessibility:
        unpriced.append("accessibility_requirements")
    if answers.interactive_elements and package != "business_website":  # that package includes one such element
        unpriced.append("interactive_elements")

    # Operations: care plans have published monthly bands; hosting is a third-party cost; the rest is assessed.
    operations = set(answers.operations)
    if "maintenance" in operations:
        plan = definition["care_plan"]
        if plan:
            items.append(Item("care_plan", plan, "operation:maintenance", pricing.band("care_plan", plan)))
        else:
            unpriced.append("care_for_application")
    if "security" in operations:
        items.append(Item("care_plan", "security", "operation:security", pricing.band("care_plan", "security")))
    unpriced.extend(f"operation:{name}" for name in ("backups", "monitoring", "support") if name in operations)

    assumptions = ["written_scope_before_start", "content_from_client", "one_site_or_system"]
    if features & {"payments", "shipping"} or answers.project_type == "online_store":
        assumptions.append("client_contracts_with_providers")
    if answers.project_type == "online_store" or "invoicing" in features:
        assumptions.append("accountant_confirms_tax_settings")

    one_time = sum(item.band.from_ for item in items if item.band and not item.band.recurring)
    monthly = sum(item.band.from_ for item in items if item.band and item.band.recurring)

    reasons = ["indicative_only"]
    if package == "custom_web_app":
        reasons.append("custom_application")
    if answers.store_migration or answers.content_migration:
        reasons.append("migration")
    if features & {"crm", "erp", "invoicing"}:
        reasons.append("integrations")
    if "ai_assistant" in features:
        reasons.append("ai_assistant")
    if answers.design_level == "bespoke":
        reasons.append("bespoke_design")
    if answers.branding == "new":
        reasons.append("new_branding")
    if answers.pages == "more_than_15" or answers.products == "more_than_500" or answers.languages == "three_plus":
        reasons.append("large_scope")
    if answers.timeline == "asap":
        reasons.append("asap_timeline")
    ceiling = MODEL["budget_upper_bound"].get(answers.budget_range)
    if ceiling is not None and one_time > ceiling:
        reasons.append("budget_below_starting_price")
    if unpriced:
        reasons.append("unpriced_requirements")

    return Review(
        package=package,
        service=service,
        delivery=definition["delivery"],
        items=tuple(items),
        included=tuple(included),
        unpriced=tuple(unpriced),
        assumptions=tuple(assumptions),
        exclusions=EXCLUSION_KEYS,
        review_reasons=tuple(reasons),
        one_time_from=one_time,
        monthly_from=monthly,
        primary_priced=bool(definition["priced"]),
    )
