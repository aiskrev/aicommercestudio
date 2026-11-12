"""Interactive demonstrations of AI business automation, on simulated data (docs/AI_DEMONSTRATIONS.md).

Every demonstration is a *simulation*: the visitor picks from a short list of invented situations and the server walks them
through the same six steps a real automation would take:

    trigger -> input validation -> AI / rules -> output validation -> human approval -> proposed business action

Rules that make a demonstration honest and safe:

* **Deterministic.** The same input gives the same output. No AI provider is called, so a demonstration is free,
  reproducible, cannot fail with a provider and cannot leak anything to one. The "AI / rules" step is a plain, documented
  rule set labelled as a simulation. (An AI provider could later add wording behind the same output schema; it would never
  change a decision, and the schema below would validate its output.)
* **Simulated data only.** Choices come from fixed lists. The one free-text field is a short *note* that is treated as data,
  never as an instruction: it is not echoed, not stored and does not change any decision. Text that looks like an instruction,
  a secret, a link or a personal detail is only *flagged* in the validation step.
* **Nothing is executed.** `executed` is always false. The last step is a *proposal*; whether it needs a person is decided by
  the real approval policy of the platform (`app.ai.policy`), not by the demonstration.
* **Codes, not sentences.** The answer carries machine-readable codes; the page translates them (Bulgarian and English).
"""

# ruff: noqa: E501  (the explanation above and the scenario tables are read as prose and data)
from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from app.ai.policy import ActionType, evaluate

STEPS = ("trigger", "validation", "logic", "output_check", "approval", "proposal")
NOTE_MAX = 280

# Text that tries to steer a system, or that should not be in a free-text field at all. Matching only *flags* the note.
_INSTRUCTION = re.compile(
    r"(ignore|disregard|forget|override|bypass)\b.{0,40}\b(instruction|rule|prompt|polic|previous|above)"
    r"|system\s*prompt|you\s+are\s+now|act\s+as\b|jailbreak|developer\s+mode"
    r"|игнорирай|забрави|пренебрегни|системн\w*\s+промпт|заобиколи",
    re.IGNORECASE,
)
_SECRET = re.compile(r"api[\s_-]?key|secret|password|token|парол|ключ\s+за\s+достъп|sk-[A-Za-z0-9]{8,}", re.IGNORECASE)
_LINK = re.compile(r"https?://|www\.", re.IGNORECASE)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


class DemoInputError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Field_:
    key: str
    options: tuple[str, ...]


@dataclass
class Plan:
    """What a scenario decides; the engine turns it into the six steps."""

    action: ActionType
    proposal: str
    # Input is not good enough to go on: validation blocks and the later steps are skipped.
    blocked: str | None = None
    validation_flags: list[str] = field(default_factory=list)
    logic: list[str] = field(default_factory=list)
    output_checks: list[str] = field(default_factory=list)
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Scenario:
    key: str
    fields: tuple[Field_, ...]
    plan: Callable[[dict[str, str]], Plan]
    # The service page the demonstration leads to, and whether the configurator fits it.
    service: str
    configurator: bool = False


# --------------------------------------------------------------------------- the eight scenarios


def _product_description(v: dict[str, str]) -> Plan:
    if v["source"] == "missing_facts":
        return Plan(ActionType.MODIFY_PRODUCT, "ask_for_facts", blocked="missing_product_facts")
    sections = {
        "apparel": ["material", "fit", "care"],
        "electronics": ["specifications", "compatibility", "warranty_source"],
        "home": ["dimensions", "material", "care"],
        "beauty": ["ingredients_source", "usage", "skin_note"],
    }[v["category"]]
    logic = ["draft_headline", "draft_benefits", *[f"section_{s}" for s in sections], f"tone_{v['tone']}"]
    checks = ["no_unverified_claims", "facts_from_source_only", "no_price_or_promise"]
    if v["source"] == "partial":
        checks.append("gaps_marked_for_review")
    return Plan(
        ActionType.MODIFY_PRODUCT,
        "update_product_draft",
        logic=logic,
        output_checks=checks,
        params={"sections": len(sections)},
    )


def _lead_qualification(v: dict[str, str]) -> Plan:
    points = (
        {"none": 0, "low": 1, "mid": 2, "high": 3}[v["budget"]]
        + {"unknown": 0, "later": 1, "quarter": 2, "urgent": 3}[v["timeline"]]
        + {"vague": 0, "clear": 2}[v["need"]]
    )
    band = "hot" if points >= 6 else "warm" if points >= 3 else "cold"
    logic = [f"budget_{v['budget']}", f"timeline_{v['timeline']}", f"need_{v['need']}", f"band_{band}"]
    next_step = {"hot": "owner_reply_today", "warm": "owner_reply_this_week", "cold": "nurture_later"}[band]
    return Plan(
        ActionType.SEND_MESSAGE,
        next_step,
        logic=logic,
        output_checks=["band_is_a_suggestion", "no_promise_to_customer", "reasons_listed"],
        params={"points": points, "band": band},
    )


def _support_routing(v: dict[str, str]) -> Plan:
    queue = {
        "shipping": "logistics",
        "returns": "returns_desk",
        "payment": "payments_specialist",
        "product_question": "product_team",
        "account": "account_support",
    }[v["topic"]]
    human_first = v["topic"] in ("payment", "account") or v["sentiment"] == "upset" or v["urgency"] == "high"
    logic = [f"queue_{queue}", f"urgency_{v['urgency']}", f"sentiment_{v['sentiment']}"]
    if v["personal_data"] == "yes":
        logic.append("personal_data_masked")
    action = ActionType.ACCESS_SENSITIVE_DATA if v["personal_data"] == "yes" else ActionType.GENERATE_DRAFT
    return Plan(
        action,
        "route_ticket",
        logic=logic,
        output_checks=["queue_exists", "no_reply_sent_to_customer", *(["human_reads_first"] if human_first else [])],
        params={"queue": queue, "human_first": human_first},
    )


def _order_workflow(v: dict[str, str]) -> Plan:
    if v["payment"] == "failed":
        step, action = "hold_and_ask_customer", ActionType.MODIFY_ORDER
    elif v["address"] == "unclear":
        step, action = "ask_customer_for_address", ActionType.SEND_MESSAGE
    elif v["stock"] == "none":
        step, action = "backorder_options", ActionType.MODIFY_ORDER
    elif v["stock"] == "partial":
        step, action = "split_shipment_proposal", ActionType.MODIFY_ORDER
    elif v["payment"] == "pending":
        step, action = "wait_for_payment", ActionType.GENERATE_DRAFT
    else:
        step, action = "ready_to_ship", ActionType.MODIFY_ORDER
    logic = [f"payment_{v['payment']}", f"address_{v['address']}", f"stock_{v['stock']}", f"value_{v['value']}"]
    if v["value"] == "large" and step == "ready_to_ship":
        logic.append("large_order_second_look")
    return Plan(
        action, step, logic=logic, output_checks=["order_not_changed", "customer_not_contacted", "reason_recorded"]
    )


def _inventory_warning(v: dict[str, str]) -> Plan:
    level = "critical" if v["stock"] == "empty" else "warning" if v["stock"] == "low" else "ok"
    if level == "ok":
        return Plan(
            ActionType.GENERATE_DRAFT,
            "no_action",
            logic=["stock_ok", f"trend_{v['trend']}"],
            output_checks=["no_alert_needed"],
            params={"level": level},
        )
    reorder = (
        "increase"
        if v["trend"] == "rising" or v["lead_time"] == "long"
        else "keep"
        if v["trend"] == "stable"
        else "reduce"
    )
    return Plan(
        ActionType.SEND_MESSAGE,
        "draft_purchase_request",
        logic=[f"level_{level}", f"trend_{v['trend']}", f"lead_time_{v['lead_time']}", f"reorder_{reorder}"],
        output_checks=["no_order_placed_with_supplier", "quantity_is_a_direction_not_a_number"],
        params={"level": level, "reorder": reorder},
    )


def _crm_automation(v: dict[str, str]) -> Plan:
    consent = v["consent"] == "yes"
    task = {
        "form_submitted": "first_reply_task",
        "quote_opened": "follow_up_call_task",
        "no_reply_7d": "gentle_reminder_task",
    }[v["event"]]
    logic = [f"event_{v['event']}", f"segment_{v['segment']}", f"consent_{v['consent']}", task]
    if not consent and v["event"] == "no_reply_7d":
        logic.append("no_marketing_message_without_consent")
        return Plan(
            ActionType.GENERATE_DRAFT,
            "internal_task_only",
            logic=logic,
            output_checks=["no_message_to_customer", "consent_respected"],
        )
    return Plan(
        ActionType.SEND_MESSAGE,
        task,
        logic=logic,
        output_checks=[
            "message_is_a_draft",
            "consent_respected",
            "unsubscribe_not_needed_for_service_message" if not consent else "unsubscribe_included",
        ],
    )


def _quotation_drafting(v: dict[str, str]) -> Plan:
    if v["scope"] == "vague":
        return Plan(ActionType.GENERATE_DRAFT, "ask_scoping_questions", blocked="scope_too_vague")
    sections = ["scope", "deliverables", "assumptions", "exclusions", "milestones"]
    logic = [
        f"service_{v['service']}",
        f"scope_{v['scope']}",
        *[f"section_{s}" for s in sections],
        "price_left_to_a_person",
    ]
    checks = ["no_price_in_the_draft", "no_guarantee", "version_kept_for_review"]
    if v["scope"] == "partial":
        checks.append("assumptions_listed")
    return Plan(
        ActionType.SEND_MESSAGE,
        "create_proposal_draft",
        logic=logic,
        output_checks=checks,
        params={"sections": len(sections)},
    )


def _human_approval(v: dict[str, str]) -> Plan:
    action = {
        "message": ActionType.SEND_MESSAGE,
        "price_change": ActionType.CHANGE_PRICE,
        "refund": ActionType.MODIFY_ORDER,
        "data_change": ActionType.ACCESS_SENSITIVE_DATA,
    }[v["action"]]
    logic = [f"action_{v['action']}", f"amount_{v['amount']}", f"reversible_{v['reversible']}"]
    if v["reversible"] == "no" or v["amount"] == "large":
        logic.append("senior_reviewer")
    return Plan(
        action,
        "wait_for_approval",
        logic=logic,
        output_checks=["nothing_runs_before_approval", "decision_is_logged"],
        params={"senior": v["reversible"] == "no" or v["amount"] == "large"},
    )


SCENARIOS: dict[str, Scenario] = {
    s.key: s
    for s in (
        Scenario(
            "product_description",
            (
                Field_("category", ("apparel", "electronics", "home", "beauty")),
                Field_("tone", ("neutral", "premium", "friendly")),
                Field_("source", ("complete", "partial", "missing_facts")),
            ),
            _product_description,
            "store_development",
            True,
        ),
        Scenario(
            "lead_qualification",
            (
                Field_("budget", ("none", "low", "mid", "high")),
                Field_("timeline", ("unknown", "later", "quarter", "urgent")),
                Field_("need", ("vague", "clear")),
            ),
            _lead_qualification,
            "ai_agents",
        ),
        Scenario(
            "support_routing",
            (
                Field_("topic", ("shipping", "returns", "payment", "product_question", "account")),
                Field_("urgency", ("low", "normal", "high")),
                Field_("sentiment", ("calm", "upset")),
                Field_("personal_data", ("no", "yes")),
            ),
            _support_routing,
            "automation",
        ),
        Scenario(
            "order_workflow",
            (
                Field_("value", ("small", "medium", "large")),
                Field_("payment", ("paid", "pending", "failed")),
                Field_("address", ("valid", "unclear")),
                Field_("stock", ("available", "partial", "none")),
            ),
            _order_workflow,
            "store_development",
            True,
        ),
        Scenario(
            "inventory_warning",
            (
                Field_("stock", ("ok", "low", "empty")),
                Field_("trend", ("rising", "stable", "falling")),
                Field_("lead_time", ("short", "long")),
            ),
            _inventory_warning,
            "integrations",
        ),
        Scenario(
            "crm_automation",
            (
                Field_("event", ("form_submitted", "quote_opened", "no_reply_7d")),
                Field_("segment", ("new", "existing")),
                Field_("consent", ("yes", "no")),
            ),
            _crm_automation,
            "automation",
        ),
        Scenario(
            "quotation_drafting",
            (Field_("service", ("website", "store", "integration")), Field_("scope", ("clear", "partial", "vague"))),
            _quotation_drafting,
            "business_websites",
            True,
        ),
        Scenario(
            "human_approval",
            (
                Field_("action", ("message", "price_change", "refund", "data_change")),
                Field_("amount", ("none", "small", "large")),
                Field_("reversible", ("yes", "no")),
            ),
            _human_approval,
            "ai_managed",
        ),
    )
}


# --------------------------------------------------------------------------- validation of a run


def validate_inputs(scenario: Scenario, inputs: dict[str, str]) -> dict[str, str]:
    """Exactly the fields of the scenario, each one of its listed options. Anything else is refused, never guessed."""
    expected = {f.key: f for f in scenario.fields}
    if set(inputs) != set(expected):
        raise DemoInputError("fields_mismatch")
    clean: dict[str, str] = {}
    for key, value in inputs.items():
        if not isinstance(value, str) or value not in expected[key].options:
            raise DemoInputError("option_not_allowed")
        clean[key] = value
    return clean


def inspect_note(note: str | None) -> list[str]:
    """What is wrong with a free-text note. It is only ever flagged: the note never changes a decision and is not echoed."""
    if not note:
        return []
    flags: list[str] = []
    if _INSTRUCTION.search(note):
        flags.append("instruction_like_text")
    if _SECRET.search(note):
        flags.append("secret_like_text")
    if _LINK.search(note):
        flags.append("link_in_text")
    if _EMAIL.search(note) or _PHONE.search(note):
        flags.append("personal_detail_in_text")
    return flags


# --------------------------------------------------------------------------- running a scenario


def run(scenario: Scenario, inputs: dict[str, str], note: str | None = None) -> dict[str, Any]:
    plan = scenario.plan(inputs)
    note_flags = inspect_note(note)
    decision = evaluate(plan.action)
    blocked = plan.blocked is not None

    def step(key: str, status: str, code: str, items: list[str] | None = None) -> dict[str, Any]:
        return {"key": key, "status": status, "code": code, "items": items or []}

    validation_flags = [*plan.validation_flags, *note_flags]
    if blocked:
        validation = step("validation", "blocked", plan.blocked or "blocked", validation_flags)
    elif validation_flags:
        validation = step("validation", "flagged", "checked_with_flags", validation_flags)
    else:
        validation = step("validation", "ok", "checked", [])

    def skipped(key: str) -> dict[str, Any]:
        return step(key, "skipped", "not_reached")

    steps = [
        step("trigger", "ok", f"trigger_{scenario.key}"),
        validation,
        skipped("logic") if blocked else step("logic", "ok", "rules_applied_as_simulation", plan.logic),
        skipped("output_check") if blocked else step("output_check", "ok", "output_checked", plan.output_checks),
        skipped("approval")
        if blocked
        else step(
            "approval",
            "required" if decision.requires_approval else "not_required",
            f"approval_{decision.risk.value}",
            [decision.action.value],
        ),
        step("proposal", "blocked" if blocked else "proposed", f"proposal_{plan.proposal}"),
    ]
    return {
        "scenario": scenario.key,
        "simulated": True,
        "executed": False,
        "steps": steps,
        "risk": None if blocked else decision.risk.value,
        "requires_approval": False if blocked else decision.requires_approval,
        "params": plan.params,
        "service": scenario.service,
        "configurator": scenario.configurator,
        "limitations": ["simulated_data", "rule_based", "nothing_executed", "not_advice"],
    }


# --------------------------------------------------------------------------- the codes a page has to translate


def all_codes() -> list[str]:
    """Every code any run can return (steps, their items and the limitations), sorted.

    The web page translates each of them; `app/demos/codes.json` is this list, a test keeps it current and a web test
    checks that every code has a Bulgarian and an English text.
    """
    import itertools

    found: set[str] = set()
    for scenario in SCENARIOS.values():
        names = [f.key for f in scenario.fields]
        for combination in itertools.product(*[f.options for f in scenario.fields]):
            result = run(scenario, dict(zip(names, combination, strict=True)))
            for step in result["steps"]:
                found.add(step["code"])
                found.update(step["items"])
            found.update(result["limitations"])
    # The flags a note can raise are not part of any combination.
    found.update(
        ["checked_with_flags", "instruction_like_text", "secret_like_text", "link_in_text", "personal_detail_in_text"]
    )
    return sorted(found)


def manifest() -> dict[str, dict[str, Any]]:
    """The scenarios as data: their fields and options, the service each leads to, and whether packages fit.

    `app/demos/scenarios.json` is this, a test keeps it current, and the web copy (`lib/demo-scenarios.json`) is the one
    source of the page's choices, so the page and the API cannot disagree.
    """
    return {
        s.key: {
            "fields": [{"key": f.key, "options": list(f.options)} for f in s.fields],
            "service": s.service,
            "packages": s.configurator,
        }
        for s in SCENARIOS.values()
    }
