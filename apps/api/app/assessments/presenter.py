"""Localized views of definitions and results for the public API.

The public definition carries what a form needs (question types, options, ranges and texts) and
never the points or weights: they are not secret, but clients have no use for them, and results are
always computed on the server.
"""

from __future__ import annotations

from typing import Any

from app.assessments.definition import (
    AssessmentDefinition,
    MultiChoiceQuestion,
    NumberQuestion,
    ScaleQuestion,
    SingleChoiceQuestion,
)
from app.assessments.scoring import ScoreResult


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


def present_result(definition: AssessmentDefinition, result: ScoreResult, locale: str) -> dict[str, Any]:
    texts = definition.texts[locale]
    band = texts.bands[result.band]
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
            }
            for key, value in result.dimensions.items()
        ],
        "recommendations": [
            {
                "key": key,
                "title": texts.recommendations[key].title,
                "description": texts.recommendations[key].description,
            }
            for key in result.recommendations
        ],
        "answered": result.answered,
        "questions": result.questions,
        "fingerprint": result.fingerprint,
        "extras": result.extras,
        "disclaimer": texts.disclaimer,
    }
