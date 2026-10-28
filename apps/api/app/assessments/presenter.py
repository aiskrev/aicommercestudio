"""Localized views of definitions and results for the public API.

The public definition carries what a form needs (question types, options, ranges and texts) and
never the points or weights: they are not secret, but clients have no use for them, and results are
always computed on the server.
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
    BooleanQuestion,
    Condition,
    DimensionAtLeast,
    DimensionBelow,
    MultiChoiceQuestion,
    NumberQuestion,
    OverallAtLeast,
    OverallBelow,
    ScaleQuestion,
    SingleChoiceQuestion,
)
from app.assessments.rules import holds
from app.assessments.scoring import ScoreResult

# Plain-language reasons for a finding, one per condition that held. Values are the visitor's own
# answers and the computed scores, so every finding can be traced to an input or a threshold.
EXPLAIN: dict[str, dict[str, str]] = {
    "bg": {
        "dimension_below": "{dimension}: {score}/100 — под прага {value}",
        "dimension_at_least": "{dimension}: {score}/100 — поне {value}",
        "overall_below": "Общ резултат {score}/100 — под прага {value}",
        "overall_at_least": "Общ резултат {score}/100 — поне {value}",
        "band_in": "Общо ниво: {band}",
        "answer_in": "„{question}“: {answers}",
        "answer_missing": "Без отговор на „{question}“",
        "yes": "да",
        "no": "не",
    },
    "en": {
        "dimension_below": "{dimension}: {score}/100, below the {value} threshold",
        "dimension_at_least": "{dimension}: {score}/100, at least {value}",
        "overall_below": "Overall score {score}/100, below the {value} threshold",
        "overall_at_least": "Overall score {score}/100, at least {value}",
        "band_in": "Overall level: {band}",
        "answer_in": "“{question}”: {answers}",
        "answer_missing": "No answer to “{question}”",
        "yes": "yes",
        "no": "no",
    },
}
HORIZONS: tuple[int, ...] = (30, 60, 90)


def public_summary(definition: AssessmentDefinition, locale: str) -> dict[str, Any]:
    texts = definition.texts[locale]
    return {
        "key": definition.key,
        "version": definition.version,
        "status": definition.status,
        "title": texts.title,
        "intro": texts.intro,
        "questions": len(definition.questions),
        "dimensions": len(definition.dimensions),
    }


def public_definition(definition: AssessmentDefinition, locale: str) -> dict[str, Any]:
    texts = definition.texts[locale]
    questions = []
    for q in definition.questions:
        q_texts = texts.questions[q.key]
        item: dict[str, Any] = {
            "key": q.key,
            "type": q.type,
            "dimension": q.dimension,
            "required": q.required,
            "text": q_texts.text,
            "help": q_texts.help,
            "unit": q_texts.unit,
            "evidence": q.evidence,
        }
        if isinstance(q, SingleChoiceQuestion | MultiChoiceQuestion):
            item["options"] = [{"key": o.key, "label": q_texts.options[o.key]} for o in q.options]
        if isinstance(q, MultiChoiceQuestion):
            item["max_selections"] = q.max_selections
        if isinstance(q, ScaleQuestion | NumberQuestion):
            item["min"] = q.min
            item["max"] = q.max
        if isinstance(q, NumberQuestion):
            item["integer"] = q.integer
        questions.append(item)
    return {
        "key": definition.key,
        "version": definition.version,
        "status": definition.status,
        "locale": locale,
        "schema_version": "1",
        "title": texts.title,
        "intro": texts.intro,
        "disclaimer": texts.disclaimer,
        "dimensions": [
            {"key": d.key, "title": texts.dimensions[d.key].title, "description": texts.dimensions[d.key].description}
            for d in definition.dimensions
        ],
        "questions": questions,
    }


def answer_label(definition: AssessmentDefinition, key: str, value: Any, locale: str) -> str:
    """The visitor's answer as text: option labels, yes/no, or the number with its unit."""
    question = definition.question(key)
    q_texts = definition.texts[locale].questions[key]
    if isinstance(question, SingleChoiceQuestion):
        return q_texts.options[value]
    if isinstance(question, MultiChoiceQuestion):
        return ", ".join(q_texts.options[v] for v in value) if value else "—"
    if isinstance(question, BooleanQuestion):
        return EXPLAIN[locale]["yes" if value else "no"]
    number = f"{value:g}" if isinstance(value, float) else str(value)
    return f"{number} {q_texts.unit}".strip() if q_texts.unit else number


def explain(
    definition: AssessmentDefinition, condition: Condition, *, answers: dict[str, Any], result: ScoreResult, locale: str
) -> list[str]:
    """Reasons for a condition that holds: every part of an `all`, the parts of an `any` that held."""
    texts = definition.texts[locale]
    t = EXPLAIN[locale]
    context = {"answers": answers, "dimensions": result.dimensions, "overall": result.overall, "band": result.band}
    if isinstance(condition, AllOf | AnyOf):
        parts = [c for c in condition.conditions if holds(c, **context)]
        return [r for part in parts for r in explain(definition, part, answers=answers, result=result, locale=locale)]
    if isinstance(condition, DimensionBelow | DimensionAtLeast):
        return [
            t[condition.kind].format(
                dimension=texts.dimensions[condition.dimension].title,
                score=result.dimensions[condition.dimension],
                value=condition.value,
            )
        ]
    if isinstance(condition, OverallBelow | OverallAtLeast):
        return [t[condition.kind].format(score=result.overall, value=condition.value)]
    if isinstance(condition, BandIn):
        return [t["band_in"].format(band=texts.bands[result.band].title)]
    if isinstance(condition, AnswerMissing):
        return [t["answer_missing"].format(question=texts.questions[condition.question].text)]
    if isinstance(condition, AnswerIn):
        value = answers[condition.question]
        chosen = [v for v in (value if isinstance(value, tuple | list) else (value,)) if v in condition.options]
        options = texts.questions[condition.question].options
        return [
            t["answer_in"].format(
                question=texts.questions[condition.question].text, answers=", ".join(options[v] for v in chosen)
            )
        ]
    return []  # pragma: no cover


def _because(
    definition: AssessmentDefinition, key: str, answers: dict[str, Any] | None, result: ScoreResult, locale: str
) -> list[str]:
    """The first rule (in evaluation order) that recommends `key` and holds explains it."""
    if answers is None:
        return []
    context = {"answers": answers, "dimensions": result.dimensions, "overall": result.overall, "band": result.band}
    for rule in definition.rules_for(key):
        if holds(rule.when, **context):
            return explain(definition, rule.when, answers=answers, result=result, locale=locale)
    return []


def _level(definition: AssessmentDefinition, score: int, locale: str) -> dict[str, str]:
    band = [b for b in definition.bands if b.min <= score][-1].key
    return {"key": band, "title": definition.texts[locale].bands[band].title}


def present_result(
    definition: AssessmentDefinition, result: ScoreResult, locale: str, answers: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Localized result. With the answers, each finding also says which input or threshold triggered it."""
    texts = definition.texts[locale]
    band = texts.bands[result.band]
    findings = []
    for key in result.recommendations:
        rule = definition.rules_for(key)[0]
        findings.append(
            {
                "key": key,
                "title": texts.recommendations[key].title,
                "description": texts.recommendations[key].description,
                "kind": rule.kind,
                "horizon": rule.horizon,
                "domains": list(rule.domains),
                "because": _because(definition, key, answers, result, locale),
            }
        )
    domains: list[str] = []
    for finding in findings:
        domains += [d for d in finding["domains"] if d not in domains]
    inputs = []
    if answers is not None:
        for q in definition.questions:
            if q.key in answers:
                inputs.append(
                    {
                        "question": q.key,
                        "dimension": q.dimension,
                        "evidence": q.evidence,
                        "text": texts.questions[q.key].text,
                        "answer": answer_label(definition, q.key, answers[q.key], locale),
                    }
                )
    return {
        "assessment": definition.key,
        "definition_version": result.definition_version,
        "algorithm": result.algorithm,
        "locale": locale,
        "title": texts.title,
        "overall": result.overall,
        "band": {"key": result.band, "title": band.title, "description": band.description},
        "dimensions": [
            {
                "key": key,
                "title": texts.dimensions[key].title,
                "description": texts.dimensions[key].description,
                "score": value,
                "level": _level(definition, value, locale),
            }
            for key, value in result.dimensions.items()
        ],
        "recommendations": findings,
        "roadmap": [
            {"horizon": h, "items": [f["key"] for f in findings if f["horizon"] == h]}
            for h in HORIZONS
            if any(f["horizon"] == h for f in findings)
        ],
        "domains": domains,
        "inputs": inputs,
        "answered": result.answered,
        "questions": result.questions,
        "fingerprint": result.fingerprint,
        "extras": result.extras,
        "disclaimer": texts.disclaimer,
    }
