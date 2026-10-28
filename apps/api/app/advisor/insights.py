"""Advisor V2 insights: deterministic, explainable enrichment of a validated assessment.

Computed on the server from the visitor's enumerated V2 context and the already validated and
sanitised V1 assessment, by fixed rules. The same for the demo engine and for any AI provider
(provider-neutral): the model never writes these fields, so they cannot contain invented numbers,
savings or promises. Every item carries its provenance — the inputs or rules it came from.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.advisor.insight_texts import T
from app.advisor.schemas import (
    AdvisorContext,
    AdvisorRequest,
    AdvisorResponse,
    AutomationAssessment,
    BusinessType,
    ToolKey,
)

INSIGHTS_ENGINE = "advisor-insights/1"
Level = Literal["low", "medium", "high"]
Domain = Literal[
    "ai_strategy",
    "ai_agents_automation",
    "ai_applications",
    "commerce_engineering",
    "cloud_platform",
    "devops_sre",
    "data_integration",
    "ai_governance",
    "managed_operations",
    "advisory_enablement",
]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Basis(_Model):
    """Where an insight comes from: an input the visitor chose, the assessment, or a named rule."""

    source: Literal["input", "assessment", "rule"]
    key: str = Field(max_length=60)
    label: str = Field(max_length=200)


class ClassifiedOpportunity(_Model):
    title: str = Field(max_length=200)
    category: Literal["workflow_automation", "ai_assisted", "integration", "reporting"]
    fit: Level
    explanation: str = Field(max_length=400)
    basis: list[Basis]


class Factor(_Model):
    effect: Literal["supports", "limits"]
    text: str = Field(max_length=300)
    basis: list[Basis]


class Feasibility(_Model):
    level: Level
    explanation: str = Field(max_length=400)
    factors: list[Factor]


class RiskItem(_Model):
    title: str = Field(max_length=200)
    explanation: str = Field(max_length=400)
    basis: list[Basis]


class RiskProfile(_Model):
    level: Level
    items: list[RiskItem]


class DomainLink(_Model):
    domain: Domain
    reason: str = Field(max_length=300)
    basis: list[Basis]


class Checkpoint(_Model):
    step: str = Field(max_length=200)
    reason: str = Field(max_length=300)
    basis: list[Basis]


class Prerequisite(_Model):
    area: Literal["integration", "security"]
    text: str = Field(max_length=300)
    basis: list[Basis]


class Pilot(_Model):
    scope: str = Field(max_length=400)
    duration_weeks: tuple[int, int]
    success_criteria: list[str]
    human_in_the_loop: str = Field(max_length=300)
    basis: list[Basis]


class RoadmapPhase(_Model):
    horizon: Literal[30, 60, 90]
    title: str = Field(max_length=120)
    items: list[str]


class AdvisorInsights(_Model):
    contract_version: Literal["2"] = "2"
    engine: Literal["advisor-insights/1"] = INSIGHTS_ENGINE
    opportunities: list[ClassifiedOpportunity]
    feasibility: Feasibility
    risk: RiskProfile
    domains: list[DomainLink] = Field(max_length=4)
    checkpoints: list[Checkpoint]
    prerequisites: list[Prerequisite]
    pilot: Pilot
    roadmap: list[RoadmapPhase] | None = None
    provenance_note: str = Field(max_length=400)


_CATEGORY = {
    "rules": "workflow_automation",
    "ai_assisted": "ai_assisted",
    "integration": "integration",
    "reporting": "reporting",
}
_DOWN = {"high": "medium", "medium": "low", "low": "low"}
_ECOMMERCE_TOOLS = {ToolKey.SHOPIFY, ToolKey.WOOCOMMERCE, ToolKey.OTHER_ECOMMERCE}
_MONEY_TOOLS = {ToolKey.PAYMENTS, ToolKey.ACCOUNTING, ToolKey.INVOICING, ToolKey.ERP}
_PILOT_WEEKS = {"low": (2, 4), "medium": (4, 8), "high": (6, 12)}


def build_insights(
    request: AdvisorRequest, assessment: AutomationAssessment, locale: str, *, include_roadmap: bool
) -> AdvisorInsights:
    t = T["en" if locale == "en" else "bg"]
    context: AdvisorContext = request.context  # type: ignore[assignment] - V2 requests always have it

    def ctx(field: str) -> Basis:
        value = getattr(context, field)
        value = value if isinstance(value, bool) else str(value)
        return Basis(
            source="input", key=f"context.{field}", label=f"{t['context'][field]}: {t['values'][field][value]}"
        )

    def rule(name: str) -> Basis:
        return Basis(source="rule", key=f"rule.{name}", label=t["rules"][name])

    complexity = assessment.complexity.level
    complexity_basis = Basis(
        source="assessment",
        key="assessment.complexity",
        label=t["assessment"]["complexity"].format(value=t["levels"][complexity]),
    )

    # ------------------------------------------------------------------ opportunities
    opportunities = []
    for opp in assessment.opportunities:
        category = _CATEGORY[opp.approach]
        basis = [
            Basis(
                source="assessment",
                key="assessment.opportunity.approach",
                label=t["assessment"]["approach"].format(value=opp.approach),
            ),
            Basis(
                source="assessment",
                key="assessment.opportunity.priority",
                label=t["assessment"]["priority"].format(value=t["levels"][opp.priority]),
            ),
            rule("fit_from_priority"),
        ]
        fit = opp.priority
        if category == "integration" and context.system_access in ("manual_only", "unknown"):
            fit = _DOWN[fit]
            basis += [ctx("system_access"), rule("fit_lowered")]
        opportunities.append(
            ClassifiedOpportunity(
                title=opp.title, category=category, fit=fit, explanation=t["categories"][category], basis=basis
            )
        )

    # ------------------------------------------------------------------ feasibility
    factors: list[Factor] = []
    access = context.system_access
    factors.append(
        Factor(
            effect="supports" if access == "api" else "limits", text=t["factors"][access], basis=[ctx("system_access")]
        )
    )
    if complexity == "low":
        factors.append(Factor(effect="supports", text=t["factors"]["complexity_low"], basis=[complexity_basis]))
    elif complexity == "high":
        factors.append(Factor(effect="limits", text=t["factors"]["complexity_high"], basis=[complexity_basis]))
    if context.change_capacity == "internal_it":
        factors.append(Factor(effect="supports", text=t["factors"]["internal_it"], basis=[ctx("change_capacity")]))
    elif context.change_capacity == "no_it":
        factors.append(Factor(effect="limits", text=t["factors"]["no_it"], basis=[ctx("change_capacity")]))
    balance = sum(1 if f.effect == "supports" else -1 for f in factors)
    feasibility_level: Literal["low", "medium", "high"] = (
        "high" if balance >= 2 else "medium" if balance >= 0 else "low"
    )
    feasibility = Feasibility(level=feasibility_level, explanation=t["feasibility"][feasibility_level], factors=factors)

    # ------------------------------------------------------------------ risk
    writes = [i for i in assessment.integrations if i.access in ("write", "read_write")]
    sensitive = context.data_sensitivity in ("personal", "financial", "special_category")
    risks: list[RiskItem] = []
    if sensitive:
        title, text = t["risks"]["data"]
        value = t["values"]["data_sensitivity"][context.data_sensitivity]
        risks.append(RiskItem(title=title.format(value=value), explanation=text, basis=[ctx("data_sensitivity")]))
    if context.customer_facing:
        title, text = t["risks"]["customer"]
        risks.append(RiskItem(title=title, explanation=text, basis=[ctx("customer_facing")]))
    if writes:
        title, text = t["risks"]["write"]
        risks.append(
            RiskItem(
                title=title,
                explanation=text,
                basis=[
                    Basis(
                        source="assessment",
                        key="assessment.integration",
                        label=t["assessment"]["integration"].format(system=i.system, access=t["access"][i.access]),
                    )
                    for i in writes[:3]
                ],
            )
        )
    high_risk = context.data_sensitivity == "special_category" or (
        context.customer_facing and (context.data_sensitivity == "financial" or bool(writes))
    )
    risk = RiskProfile(level="high" if high_risk else "medium" if risks else "low", items=risks)

    # ------------------------------------------------------------------ service domains (max 4)
    categories = {o.category for o in opportunities}
    # Candidate domains with their basis, then up to four in a fixed priority: preparation and
    # operating needs come before platform-specific work, so a weak starting point is never hidden.
    candidates: dict[Domain, list[Basis]] = {}
    if categories & {"workflow_automation", "ai_assisted"}:
        candidates["ai_agents_automation"] = [
            Basis(source="assessment", key="assessment.opportunities", label=", ".join(sorted(categories)))
        ]
    if feasibility_level == "low" or access == "unknown":
        candidates["advisory_enablement"] = [ctx("system_access")]
    if assessment.integrations or access in ("exports", "manual_only"):
        candidates["data_integration"] = [ctx("system_access")]
    if sensitive or context.customer_facing:
        candidates["ai_governance"] = [ctx("data_sensitivity"), ctx("customer_facing")]
    if context.change_capacity == "no_it":
        candidates["managed_operations"] = [ctx("change_capacity")]
    if "ai_assisted" in categories:
        candidates["ai_applications"] = [
            Basis(source="assessment", key="assessment.opportunities", label="ai_assisted")
        ]
    if request.business_type is BusinessType.ONLINE_STORE or set(request.tools) & _ECOMMERCE_TOOLS:
        candidates["commerce_engineering"] = [
            Basis(source="input", key="business_type", label=request.business_type.value)
        ]
    domains = [
        DomainLink(domain=domain, reason=t["domains"][domain], basis=basis)
        for domain, basis in list(candidates.items())[:4]
    ]

    # ------------------------------------------------------------------ human approval checkpoints
    checkpoints = [
        Checkpoint(
            step=step.title,
            reason=t["checkpoints"]["workflow"],
            basis=[
                Basis(
                    source="assessment",
                    key="assessment.workflow.requires_human_approval",
                    label=t["assessment"]["step"].format(value=step.title[:120]),
                ),
                rule("write_needs_approval"),
            ],
        )
        for step in assessment.proposed_workflow
        if step.requires_human_approval
    ][:6]
    if context.customer_facing:
        step, reason = t["checkpoints"]["customer"]
        checkpoints.append(
            Checkpoint(step=step, reason=reason, basis=[ctx("customer_facing"), rule("customer_needs_approval")])
        )
    if context.data_sensitivity == "financial" or set(request.tools) & _MONEY_TOOLS:
        step, reason = t["checkpoints"]["money"]
        checkpoints.append(
            Checkpoint(step=step, reason=reason, basis=[ctx("data_sensitivity"), rule("money_needs_approval")])
        )

    # ------------------------------------------------------------------ prerequisites
    p = t["prereq"]
    prerequisites: list[Prerequisite] = []
    for integration in assessment.integrations[:5]:
        prerequisites.append(
            Prerequisite(
                area="integration",
                text=p["integration"].format(system=integration.system, access=t["access"][integration.access]),
                basis=[
                    Basis(
                        source="assessment",
                        key="assessment.integration",
                        label=t["assessment"]["integration"].format(
                            system=integration.system, access=t["access"][integration.access]
                        ),
                    )
                ],
            )
        )
    if access in ("unknown", "manual_only"):
        prerequisites.append(Prerequisite(area="integration", text=p["confirm_access"], basis=[ctx("system_access")]))
    prerequisites.append(Prerequisite(area="security", text=p["service_accounts"], basis=[ctx("system_access")]))
    if sensitive:
        prerequisites.append(Prerequisite(area="security", text=p["personal_data"], basis=[ctx("data_sensitivity")]))
    for integration in writes[:2]:
        prerequisites.append(
            Prerequisite(
                area="security",
                text=p["sandbox"].format(system=integration.system),
                basis=[rule("write_needs_approval")],
            )
        )
    if context.customer_facing:
        prerequisites.append(Prerequisite(area="security", text=p["escalation"], basis=[ctx("customer_facing")]))
    prerequisites.append(Prerequisite(area="security", text=p["logging"], basis=[rule("write_needs_approval")]))

    # ------------------------------------------------------------------ pilot
    top = max(assessment.opportunities, key=lambda o: {"high": 3, "medium": 2, "low": 1}[o.priority])
    pilot = Pilot(
        scope=t["pilot"]["scope"].format(title=top.title),
        duration_weeks=_PILOT_WEEKS[complexity],
        success_criteria=list(t["pilot"]["criteria"]),
        human_in_the_loop=t["pilot"]["human"],
        basis=[complexity_basis, rule("pilot_by_complexity")],
    )

    roadmap = None
    if include_roadmap:
        roadmap = [
            RoadmapPhase(horizon=h, title=title, items=list(items)) for h, (title, items) in t["roadmap"].items()
        ]

    return AdvisorInsights(
        opportunities=opportunities,
        feasibility=feasibility,
        risk=risk,
        domains=domains,
        checkpoints=checkpoints,
        prerequisites=prerequisites,
        pilot=pilot,
        roadmap=roadmap,
        provenance_note=t["provenance"],
    )


class AdvisorResponseV2(AdvisorResponse):
    """V2 response: the unchanged V1 fields plus the contract version and the insights."""

    contract_version: Literal["2"] = "2"
    insights: AdvisorInsights
