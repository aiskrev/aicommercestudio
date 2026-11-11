"""First drafts of proposals and SOWs, and the review checks run on every version.

The draft assembler is deterministic: it copies what staff recorded on the opportunity (problem,
scope, constraints, recommendation) into the sections and fills everything else with explicit
placeholders. It never invents a price, a staffing level, a date, a guarantee or a signature, and
the commercial section is always the placeholder: only a person writes commercial terms. The output
is stored with origin `generated_draft` and can only be approved after a person has completed it.

`review()` flags wording that a proposal must not contain unless a person deliberately wrote it
(guarantees, signatures, prices outside the commercial section, staffing numbers) and blocks
approval while the commercial section is incomplete.
"""

from __future__ import annotations

import re
from typing import Any

from app.models import Lead
from app.opportunities import configured
from app.opportunities.models import LeadOpportunity, ProposalKind
from app.opportunities.schemas import SECTIONS, Commercial, Finding, ProposalContent
from app.workshops import workshop_title

PLACEHOLDER = {"bg": "[ПОПЪЛВА СЕ ОТ ЧОВЕК]", "en": "[TO BE COMPLETED BY A PERSON]"}
# Any bracketed template hint ("[TO BE COMPLETED BY A PERSON]", "[List the deliverables …]").
_PLACEHOLDER_RE = re.compile(r"\[[^\]\n]{3,}\]")

_GUARANTEE_RE = re.compile(r"\bguarante\w*|\bгаранти\w*", re.IGNORECASE)
_SIGNATURE_RE = re.compile(r"\bsigned\b|\bsignature\w*|\bподпис\w*", re.IGNORECASE)
_PRICE_RE = re.compile(
    r"(?:[€$£]\s?\d)|(?:\d[\d\s.,]*\s?(?:€|eur\b|euro\w*|bgn\b|лв\.?|лева|usd\b|\$|£))", re.IGNORECASE
)
_STAFFING_RE = re.compile(
    r"\b\d+\s*(?:fte\b|engineers?\b|developers?\b|consultants?\b|инженер\w*|разработчи\w*|консултант\w*)",
    re.IGNORECASE,
)

_TEXT = {
    "bg": {
        "scope_missing": "[Опишете обхвата: какво е включено, за кои системи и екипи.]",
        "problem": "Проблем, описан от клиента: {value}",
        "constraints": "Технически ограничения: {value}",
        "workshop": "Първа стъпка: „{value}“ от каталога с работни срещи и оценки.",
        "assessment": "Подготовка: безплатната оценка „{value}“.",
        "deliverables": ["[Избройте конкретните резултати, които клиентът получава.]"],
        "assumptions": [
            "Клиентът осигурява достъп до хората, системите и документите в обхвата навреме.",
            "Изводите се основават на предоставената информация; не обещаваме конкретни резултати.",
        ],
        "exclusions": [
            "Всичко, което не е изрично описано в обхвата.",
            "Внедряване и промени в продукционни системи, освен ако не са изрично договорени.",
        ],
        "dependencies": ["[Избройте зависимостите от клиента и от трети страни.]"],
        "responsibilities": [
            ("client", "Определя отговорник и участници от своя страна."),
            ("provider", "Подготвя и провежда договорените дейности и предава резултатите."),
            ("shared", "Съгласуват обхвата, графика и приемането на резултатите."),
        ],
        "acceptance": ["[Опишете как клиентът приема всеки резултат.]"],
        "milestones": [("[Етап]", "[Описание]", "[Ориентировъчен срок — уточнява се]")],
        "risks": [("[Риск]", "[Как се ограничава]")],
    },
    "en": {
        "scope_missing": "[Describe the scope: what is included, for which systems and teams.]",
        "problem": "Problem as described by the client: {value}",
        "constraints": "Technical constraints: {value}",
        "workshop": 'First step: "{value}" from the workshops and assessments catalogue.',
        "assessment": 'Preparation: the free "{value}" assessment.',
        "deliverables": ["[List the concrete deliverables the client receives.]"],
        "assumptions": [
            "The client provides access to the people, systems and documents in scope in time.",
            "The findings rest on the information provided; no specific outcome is promised.",
        ],
        "exclusions": [
            "Anything not explicitly described in the scope.",
            "Implementation and changes to production systems unless explicitly agreed.",
        ],
        "dependencies": ["[List the dependencies on the client and on third parties.]"],
        "responsibilities": [
            ("client", "Names an owner and the participants on its side."),
            ("provider", "Prepares and runs the agreed activities and hands over the deliverables."),
            ("shared", "Agree the scope, the schedule and the acceptance of the deliverables."),
        ],
        "acceptance": ["[Describe how the client accepts each deliverable.]"],
        "milestones": [("[Milestone]", "[Description]", "[Indicative timing — to be agreed]")],
        "risks": [("[Risk]", "[How it is mitigated]")],
    },
}


def generate(lead: Lead, opportunity: LeadOpportunity | None, kind: ProposalKind) -> ProposalContent:
    """A first draft for a person to complete; nothing commercial and nothing beyond the record."""
    locale = lead.locale if lead.locale in _TEXT else "bg"
    t = _TEXT[locale]
    placeholder = PLACEHOLDER[locale]
    o = opportunity
    # A lead from the project configurator or the quote basket brings its own facts: the package, what the client
    # chose and what needs an assessment (app/opportunities/configured.py). Still nothing commercial.
    configured_sections = configured.sections(lead, locale) or {}
    scope_parts = [(o.scope_summary if o else None) or configured_sections.get("scope") or t["scope_missing"]]
    if o and o.problem_summary:
        scope_parts.append(t["problem"].format(value=o.problem_summary))
    if o and o.technical_constraints:
        scope_parts.append(t["constraints"].format(value=o.technical_constraints))
    assumptions = list(t["assumptions"]) + [
        item for item in configured_sections.get("assumptions", []) if item not in t["assumptions"]
    ]
    if o and o.recommended_workshop:
        assumptions.append(t["workshop"].format(value=workshop_title(o.recommended_workshop, locale)))
    if o and o.recommended_assessment:
        assumptions.append(t["assessment"].format(value=o.recommended_assessment))
    content: dict[str, Any] = {
        "scope": "\n\n".join(scope_parts),
        "deliverables": configured_sections.get("deliverables") or t["deliverables"],
        "assumptions": assumptions,
        "exclusions": (configured_sections.get("exclusions", []) + t["exclusions"])[:40],
        "dependencies": configured_sections.get("dependencies") or t["dependencies"],
        "responsibilities": [{"party": p, "item": i} for p, i in t["responsibilities"]],
        "acceptance_criteria": t["acceptance"],
        "milestones": configured_sections.get("milestones")
        or [
            {"title": a, "description": b, "indicative_timing": c}
            for a, b, c in (t["milestones"] if kind == ProposalKind.SOW else t["milestones"][:1])
        ],
        "risks": [{"risk": a, "mitigation": b} for a, b in t["risks"]],
        "commercial": {field: placeholder for field in Commercial.model_fields},
    }
    return ProposalContent.model_validate(content)


def _texts(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [text for item in value for text in _texts(item)]
    if isinstance(value, dict):
        return [text for item in value.values() for text in _texts(item)]
    return []


def review(content: ProposalContent) -> list[Finding]:
    """Review warnings; `blocking` ones prevent approval."""
    data = content.model_dump()
    findings: list[Finding] = []
    commercial = data["commercial"]
    if any(_PLACEHOLDER_RE.search(v or "") for v in commercial.values()):
        findings.append(Finding(code="commercial_placeholder", section="commercial", blocking=True))
    if not (commercial["pricing_basis"] or "").strip():
        findings.append(Finding(code="commercial_missing", section="commercial", blocking=True))
    for section in SECTIONS:
        texts = _texts(data[section])
        joined = "\n".join(texts)
        if section != "commercial" and not joined.strip():
            findings.append(Finding(code="empty_section", section=section, blocking=False))
        if _GUARANTEE_RE.search(joined):
            findings.append(Finding(code="guarantee_wording", section=section, blocking=False))
        if _SIGNATURE_RE.search(joined):
            findings.append(Finding(code="signature_wording", section=section, blocking=False))
        if section != "commercial" and _PRICE_RE.search(joined):
            findings.append(Finding(code="price_outside_commercial", section=section, blocking=False))
        if _STAFFING_RE.search(joined):
            findings.append(Finding(code="staffing_claim", section=section, blocking=False))
    # Placeholders anywhere else are fine in a draft, but an approved document must be complete.
    for section in SECTIONS:
        if section != "commercial" and _PLACEHOLDER_RE.search("\n".join(_texts(data[section]))):
            findings.append(Finding(code="unfilled_placeholder", section=section, blocking=True))
    return findings


def changed_sections(previous: dict[str, Any] | None, current: dict[str, Any]) -> list[str]:
    if previous is None:
        return list(SECTIONS)
    return [section for section in SECTIONS if previous.get(section) != current.get(section)]
