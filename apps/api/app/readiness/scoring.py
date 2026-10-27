"""Readiness scoring — a line-by-line port of apps/web/src/lib/readiness.ts.

Both implementations are checked against the same golden vectors
(tests/fixtures/readiness_vectors.json ↔ apps/web/src/lib/readiness.vectors.json; scripts/test.ps1
verifies the two files are identical). Change MODEL_VERSION in both places when the model changes.

  dimension score = (sum of its two 0–4 answers / 8) × 100, rounded
  overall         = Σ exact dimension ratio × 100 × normalised weight, clamped to 0–100, rounded once
  band            = from the rounded overall: 0–24 / 25–49 / 50–74 / 75–100
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

MODEL_VERSION = "2026-10.2"

DIMENSIONS: tuple[str, ...] = ("strategy", "data", "process", "technology", "people", "governance")

WEIGHTS: dict[str, float] = {
    "strategy": 15,
    "data": 20,
    "process": 15,
    "technology": 15,
    "people": 15,
    "governance": 20,
}

QUESTIONS: dict[str, tuple[str, str]] = {
    "strategy": ("strategy_goals", "strategy_use_cases"),
    "data": ("data_access", "data_quality"),
    "process": ("process_definition", "process_repeatability"),
    "technology": ("tech_integration", "tech_environment"),
    "people": ("people_ownership", "people_change"),
    "governance": ("gov_data_protection", "gov_oversight"),
}

QUESTION_ORDER: tuple[str, ...] = tuple(q for d in DIMENSIONS for q in QUESTIONS[d])
MAX_ANSWER = 4

BAND_THRESHOLDS: tuple[tuple[str, int], ...] = (
    ("scaling", 75),
    ("pilot_ready", 50),
    ("foundation", 25),
    ("exploration", 0),
)

ACTION_SERVICE: dict[str, str] = {
    "governance_first": "audit",
    "data_quality_first": "integrations",
    "integration_path": "integrations",
    "ownership_first": "audit",
    "strategy_definition": "audit",
    "data_foundation": "integrations",
    "process_mapping": "automation",
    "tech_foundation": "integrations",
    "people_enablement": "audit",
    "governance_framework": "audit",
    "discovery_workshop": "audit",
    "foundation_plan": "audit",
    "scoped_pilot": "ai_agents",
    "scale_operations": "ai_managed",
}

_BLOCKER_ACTION: dict[str, tuple[str, str]] = {
    "governance": ("governance_first", "governance"),
    "data_quality": ("data_quality_first", "data"),
    "integration": ("integration_path", "technology"),
    "organisation": ("ownership_first", "people"),
}

_GAP_ACTION: dict[str, str] = {
    "strategy": "strategy_definition",
    "data": "data_foundation",
    "process": "process_mapping",
    "technology": "tech_foundation",
    "people": "people_enablement",
    "governance": "governance_framework",
}

_BAND_ACTION: dict[str, str] = {
    "exploration": "discovery_workshop",
    "foundation": "foundation_plan",
    "pilot_ready": "scoped_pilot",
    "scaling": "scale_operations",
}

_USE_CASE_RULES: tuple[tuple[str, dict[str, int]], ...] = (
    ("inquiry_triage", {"process": 50, "technology": 50}),
    ("document_extraction", {"data": 25, "process": 50}),
    ("knowledge_assistant", {"data": 50, "governance": 50}),
    ("reply_drafting", {"process": 50, "governance": 50}),
    ("reporting_summary", {"data": 50}),
)


@dataclass(frozen=True)
class ReadinessResult:
    overall: int
    band: str
    dimensions: dict[str, int]
    blockers: list[str]
    strengths: list[str]
    gaps: list[str]
    actions: list[str]
    use_cases: list[str]
    roadmap: dict[str, list[str]] = field(default_factory=dict)

    def summary(self) -> dict[str, object]:
        """JSON-safe form stored with a submission (no free text)."""
        return {
            "overall": self.overall,
            "band": self.band,
            "dimensions": self.dimensions,
            "blockers": self.blockers,
            "strengths": self.strengths,
            "gaps": self.gaps,
            "actions": self.actions,
            "use_cases": self.use_cases,
            "roadmap": self.roadmap,
        }


def _js_round(value: float) -> int:
    """Math.round semantics (half rounds up) — Python's round() is banker's rounding."""
    return int(math.floor(value + 0.5))


def normalised_weights(weights: dict[str, float] | None = None) -> dict[str, float]:
    source = weights or WEIGHTS
    total = sum(max(0.0, source[d]) for d in DIMENSIONS)
    if total <= 0:
        raise ValueError("Dimension weights must have a positive sum")
    return {d: max(0.0, source[d]) / total for d in DIMENSIONS}


def missing_answers(answers: dict[str, object]) -> list[str]:
    return [q for q in QUESTION_ORDER if not _is_answer(answers.get(q))]


def _is_answer(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= MAX_ANSWER


def band_for(score: float) -> str:
    rounded = _js_round(min(100.0, max(0.0, score)))
    return next(band for band, minimum in BAND_THRESHOLDS if rounded >= minimum)


def find_blockers(answers: dict[str, int]) -> list[str]:
    blockers: list[str] = []
    if answers["gov_data_protection"] <= 1 or answers["gov_oversight"] == 0:
        blockers.append("governance")
    if answers["data_quality"] <= 1:
        blockers.append("data_quality")
    if answers["tech_integration"] <= 1:
        blockers.append("integration")
    if answers["people_ownership"] <= 1 or answers["people_change"] == 0:
        blockers.append("organisation")
    return blockers


def rank_actions(band: str, blockers: list[str], gaps: list[str], by_score: list[str]) -> list[str]:
    covered: set[str] = set()
    urgent: list[str] = []
    for blocker in blockers:
        action, dimension = _BLOCKER_ACTION[blocker]
        urgent.append(action)
        covered.add(dimension)
    urgent += [_GAP_ACTION[g] for g in gaps if g not in covered]
    urgent += [_GAP_ACTION[d] for d in by_score if d not in covered]
    band_action = _BAND_ACTION[band]
    top: list[str] = []
    for action in urgent:
        if action != band_action and action not in top:
            top.append(action)
        if len(top) == 2:
            break
    return [*top, band_action]


def suitable_use_cases(scores: dict[str, int]) -> list[str]:
    eligible = [name for name, requires in _USE_CASE_RULES if all(scores[d] >= m for d, m in requires.items())]
    return eligible[:3] if eligible else ["process_discovery"]


def build_roadmap(band: str, blockers: list[str]) -> dict[str, list[str]]:
    items = [_BLOCKER_ACTION[b][0] for b in blockers]
    return {"d30": [*items[:2], f"{band}_d30"], "d60": [*items[2:], f"{band}_d60"], "d90": [f"{band}_d90"]}


def score(answers: dict[str, int]) -> ReadinessResult:
    """Score a complete answer set. Raises ValueError listing missing answers otherwise."""
    missing = missing_answers(answers)
    if missing:
        raise ValueError(f"incomplete: {','.join(missing)}")
    weights = normalised_weights()
    ratios = {d: sum(answers[q] for q in QUESTIONS[d]) / (len(QUESTIONS[d]) * MAX_ANSWER) for d in DIMENSIONS}
    dimensions = {d: _js_round(ratios[d] * 100) for d in DIMENSIONS}
    overall = _js_round(min(100.0, max(0.0, sum(ratios[d] * 100 * weights[d] for d in DIMENSIONS))))
    band = band_for(overall)
    blockers = find_blockers(answers)
    by_score = sorted(DIMENSIONS, key=lambda d: (dimensions[d], DIMENSIONS.index(d)))
    gaps = [d for d in by_score if dimensions[d] < 50]
    strong = [d for d in reversed(by_score) if dimensions[d] >= 75]
    best = by_score[-1]
    strengths = strong or ([best] if dimensions[best] >= 50 else [])
    return ReadinessResult(
        overall=overall,
        band=band,
        dimensions=dimensions,
        blockers=blockers,
        strengths=strengths,
        gaps=gaps,
        actions=rank_actions(band, blockers, gaps, by_score),
        use_cases=suitable_use_cases(dimensions),
        roadmap=build_roadmap(band, blockers),
    )
