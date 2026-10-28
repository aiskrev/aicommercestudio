"""Rule-based recommendations: a closed set of typed conditions, evaluated by plain Python.

There is no expression language and nothing is evaluated dynamically; adding a new kind of
condition means adding a model in definition.py and a branch here, both reviewed and tested.
"""

from __future__ import annotations

from typing import Any

from app.assessments.definition import (
    AllOf,
    AnswerIn,
    AnswerMissing,
    AnyOf,
    AssessmentDefinition,
    BandIn,
    Condition,
    DimensionAtLeast,
    DimensionBelow,
    OverallAtLeast,
    OverallBelow,
)


def holds(
    condition: Condition, *, answers: dict[str, Any], dimensions: dict[str, int], overall: int, band: str
) -> bool:
    context = {"answers": answers, "dimensions": dimensions, "overall": overall, "band": band}
    if isinstance(condition, AllOf):
        return all(holds(c, **context) for c in condition.conditions)
    if isinstance(condition, AnyOf):
        return any(holds(c, **context) for c in condition.conditions)
    if isinstance(condition, DimensionBelow):
        return dimensions[condition.dimension] < condition.value
    if isinstance(condition, DimensionAtLeast):
        return dimensions[condition.dimension] >= condition.value
    if isinstance(condition, OverallBelow):
        return overall < condition.value
    if isinstance(condition, OverallAtLeast):
        return overall >= condition.value
    if isinstance(condition, BandIn):
        return band in condition.bands
    if isinstance(condition, AnswerMissing):
        return condition.question not in answers
    if isinstance(condition, AnswerIn):
        value = answers.get(condition.question)
        if isinstance(value, tuple):
            return any(option in condition.options for option in value)
        return value in condition.options
    raise TypeError(f"unsupported condition: {type(condition).__name__}")  # pragma: no cover


def evaluate_rules(
    definition: AssessmentDefinition, *, answers: dict[str, Any], dimensions: dict[str, int], overall: int, band: str
) -> list[str]:
    """Recommendation keys of the rules that hold, by (priority, rule key), without duplicates."""
    recommendations: list[str] = []
    for rule in sorted(definition.rules, key=lambda r: (r.priority, r.key)):
        if rule.recommendation in recommendations:
            continue
        if holds(rule.when, answers=answers, dimensions=dimensions, overall=overall, band=band):
            recommendations.append(rule.recommendation)
        if len(recommendations) == definition.scoring.max_recommendations:
            break
    return recommendations
