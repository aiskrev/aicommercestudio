"""Versioned, deterministic scoring — pure functions, exact arithmetic.

`weighted-mean/1`:

  question fraction  single choice: points / highest option points
                     multi choice:  min(Σ points chosen, cap) / cap
                     scale:         (value - min) / (max - min)
                     boolean:       points / max(points_true, points_false)
                     number:        points of the highest band reached / highest band points
  dimension ratio    Σ (question weight × fraction) / Σ question weight, over answered questions
  dimension score    round-half-up(ratio × 100)
  overall            round-half-up(100 × Σ (dimension weight × ratio) / Σ dimension weight)
  band               the band with the highest minimum ≤ overall

All arithmetic uses `fractions.Fraction`, so the result never depends on floating-point order of
operations, and is rounded once per reported number (half up, as in the web tools). A new formula
is a new algorithm id; existing ids never change, so stored results stay reproducible.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Callable
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any

from app.assessments.answers import Answers
from app.assessments.definition import (
    AssessmentDefinition,
    BooleanQuestion,
    MultiChoiceQuestion,
    NumberQuestion,
    Question,
    ScaleQuestion,
    SingleChoiceQuestion,
)
from app.assessments.rules import evaluate_rules


@dataclass(frozen=True)
class ScoreResult:
    assessment: str
    definition_version: str
    algorithm: str
    overall: int
    band: str
    dimensions: dict[str, int]
    recommendations: list[str]
    answered: int
    questions: int
    fingerprint: str
    # Assessment-specific derived values from an extension (JSON-safe, no free text).
    extras: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> dict[str, Any]:
        """JSON-safe form that is stored with an opt-in saved result."""
        return {
            "assessment": self.assessment,
            "definition_version": self.definition_version,
            "algorithm": self.algorithm,
            "overall": self.overall,
            "band": self.band,
            "dimensions": dict(self.dimensions),
            "recommendations": list(self.recommendations),
            "answered": self.answered,
            "questions": self.questions,
            "fingerprint": self.fingerprint,
            "extras": dict(self.extras),
        }


def round_half_up(value: Fraction) -> int:
    return math.floor(value + Fraction(1, 2))


def question_fraction(question: Question, value: Any) -> Fraction:
    if isinstance(question, SingleChoiceQuestion):
        best = max(o.points for o in question.options)
        return Fraction(next(o.points for o in question.options if o.key == value), best)
    if isinstance(question, MultiChoiceQuestion):
        chosen = sum(o.points for o in question.options if o.key in value)
        return Fraction(min(chosen, question.cap), question.cap)
    if isinstance(question, ScaleQuestion):
        return Fraction(value - question.min, question.max - question.min)
    if isinstance(question, BooleanQuestion):
        best = max(question.points_true, question.points_false)
        return Fraction(question.points_true if value else question.points_false, best)
    if isinstance(question, NumberQuestion):
        best = max(b.points for b in question.bands)
        reached = [b for b in question.bands if Fraction(str(value)) >= Fraction(str(b.at_least))]
        return Fraction(reached[-1].points, best)
    raise TypeError(f"unsupported question type: {type(question).__name__}")  # pragma: no cover


def dimension_ratios(definition: AssessmentDefinition, answers: Answers) -> dict[str, Fraction]:
    ratios: dict[str, Fraction] = {}
    for dimension in definition.dimension_keys:
        # Only practices are scored; metrics and context answers never move a score.
        answered = [q for q in definition.questions if q.dimension == dimension and q.scored and q.key in answers]
        if not answered:
            # Unreachable for validated answers (each dimension has a required question).
            raise ValueError(f"dimension {dimension} has no answered question")
        total = sum(q.weight for q in answered)
        ratios[dimension] = (
            sum((q.weight * question_fraction(q, answers[q.key]) for q in answered), Fraction(0)) / total
        )
    return ratios


def fingerprint(definition: AssessmentDefinition, answers: Answers) -> str:
    """Stable, non-personal identifier of an answer set under one definition version."""
    canonical = json.dumps(
        {
            "assessment": definition.key,
            "version": definition.version,
            "algorithm": definition.scoring.algorithm,
            "answers": {k: list(v) if isinstance(v, tuple) else v for k, v in sorted(answers.items())},
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return hashlib.sha256(canonical.encode("ascii")).hexdigest()[:16]


def _weighted_mean_v1(definition: AssessmentDefinition, answers: Answers) -> ScoreResult:
    ratios = dimension_ratios(definition, answers)
    weights = {d.key: d.weight for d in definition.dimensions}
    exact_overall = 100 * sum((weights[d] * r for d, r in ratios.items()), Fraction(0)) / sum(weights.values())
    overall = round_half_up(exact_overall)
    dimensions = {d: round_half_up(r * 100) for d, r in ratios.items()}
    band = [b for b in definition.bands if b.min <= overall][-1].key
    recommendations = evaluate_rules(definition, answers=answers, dimensions=dimensions, overall=overall, band=band)
    return ScoreResult(
        assessment=definition.key,
        definition_version=definition.version,
        algorithm=definition.scoring.algorithm,
        overall=overall,
        band=band,
        dimensions=dimensions,
        recommendations=recommendations,
        answered=len(answers),
        questions=len(definition.questions),
        fingerprint=fingerprint(definition, answers),
    )


ALGORITHMS: dict[str, Callable[[AssessmentDefinition, Answers], ScoreResult]] = {
    "weighted-mean/1": _weighted_mean_v1,
}


def score(definition: AssessmentDefinition, answers: Answers) -> ScoreResult:
    """Score validated answers with the definition's algorithm (no extension applied here)."""
    return ALGORITHMS[definition.scoring.algorithm](definition, answers)
