"""Server-side answer validation against a definition.

Answers are the only thing a client sends: option keys, booleans and numbers — never weights,
points, scores or free text. Anything else is rejected with a per-question error code.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from app.assessments.definition import (
    AssessmentDefinition,
    BooleanQuestion,
    MultiChoiceQuestion,
    NumberQuestion,
    ScaleQuestion,
    SingleChoiceQuestion,
)

# Normalised answer values: an option key, a sorted tuple of option keys, a bool or a number.
AnswerValue = str | tuple[str, ...] | bool | int | float
Answers = dict[str, AnswerValue]


@dataclass(frozen=True)
class AnswerError:
    question: str
    code: (
        str  # missing_required | unknown_question | invalid_type | invalid_option | out_of_range | too_many_selections
    )


ERROR_MESSAGES: dict[str, dict[str, str]] = {
    "bg": {
        "missing_required": "Отговорете на този въпрос.",
        "unknown_question": "Неизвестен въпрос.",
        "invalid_type": "Отговорът е в невалиден формат.",
        "invalid_option": "Изберете един от предложените отговори.",
        "out_of_range": "Стойността е извън допустимия диапазон.",
        "too_many_selections": "Избрани са твърде много отговори.",
        "duplicate_selection": "Един отговор е избран повече от веднъж.",
        "inconsistent": "Отговорът противоречи на друг отговор.",
    },
    "en": {
        "missing_required": "Answer this question.",
        "unknown_question": "Unknown question.",
        "invalid_type": "The answer has an invalid format.",
        "invalid_option": "Choose one of the offered answers.",
        "out_of_range": "The value is outside the allowed range.",
        "too_many_selections": "Too many answers are selected.",
        "duplicate_selection": "An answer is selected more than once.",
        "inconsistent": "This answer contradicts another answer.",
    },
}


def _is_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value)


def validate_answers(definition: AssessmentDefinition, raw: dict[str, Any]) -> tuple[Answers, list[AnswerError]]:
    """Return the normalised answers and the errors. Unanswered optional questions are omitted."""
    errors: list[AnswerError] = []
    answers: Answers = {}
    known = {q.key for q in definition.questions}
    errors += [AnswerError(key, "unknown_question") for key in sorted(set(raw) - known)]

    for q in definition.questions:
        value = raw.get(q.key)
        if value is None:
            if q.required:
                errors.append(AnswerError(q.key, "missing_required"))
            continue
        normalised, code = _normalise(q, value)
        if code:
            errors.append(AnswerError(q.key, code))
        else:
            answers[q.key] = normalised  # type: ignore[assignment]
    return answers, errors


def _normalise(q: Any, value: Any) -> tuple[AnswerValue | None, str | None]:
    if isinstance(q, SingleChoiceQuestion):
        if not isinstance(value, str):
            return None, "invalid_type"
        return (value, None) if value in {o.key for o in q.options} else (None, "invalid_option")
    if isinstance(q, MultiChoiceQuestion):
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            return None, "invalid_type"
        if len(set(value)) != len(value):
            return None, "duplicate_selection"
        if not set(value) <= {o.key for o in q.options}:
            return None, "invalid_option"
        if len(value) > q.max_selections:
            return None, "too_many_selections"
        order = [o.key for o in q.options]
        return tuple(sorted(value, key=order.index)), None
    if isinstance(q, BooleanQuestion):
        return (value, None) if isinstance(value, bool) else (None, "invalid_type")
    if isinstance(q, ScaleQuestion):
        if not isinstance(value, int) or isinstance(value, bool):
            return None, "invalid_type"
        return (value, None) if q.min <= value <= q.max else (None, "out_of_range")
    if isinstance(q, NumberQuestion):
        if not _is_number(value):
            return None, "invalid_type"
        if q.integer and not float(value).is_integer():
            return None, "invalid_type"
        if not q.min <= value <= q.max:
            return None, "out_of_range"
        return (int(value) if q.integer else float(value)), None
    return None, "invalid_type"  # pragma: no cover - the union is closed
