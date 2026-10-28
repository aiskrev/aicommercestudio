"""Typed, validated assessment definitions.

A definition is data, never code: versioned JSON files in `app/assessments/definitions/<key>/`
parsed into these frozen Pydantic models (unknown fields rejected). Rules are a closed set of
typed conditions — nothing is evaluated dynamically, and nothing executable comes from the
database. `AssessmentDefinition` validates every cross-reference when it is loaded, so a broken
definition fails at start-up and in CI, never in a visitor's request.
"""

from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

LOCALES: tuple[str, ...] = ("bg", "en")
KEY = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,47}$")]
VERSION_PATTERN = r"^\d+\.\d+\.\d+$"
_CYRILLIC = re.compile(r"[Ѐ-ӿ]")


class Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


# --------------------------------------------------------------------------- questions


class Option(Frozen):
    key: KEY
    # Points for this option; the question's fraction is points / the highest option's points.
    points: int = Field(ge=0, le=100)


class _QuestionBase(Frozen):
    key: KEY
    dimension: KEY
    # Relative weight inside its dimension.
    weight: int = Field(default=1, ge=1, le=10)
    required: bool = True


class SingleChoiceQuestion(_QuestionBase):
    type: Literal["single_choice"]
    options: tuple[Option, ...] = Field(min_length=2, max_length=12)


class MultiChoiceQuestion(_QuestionBase):
    """Several options; the fraction is min(Σ points of the chosen options, cap) / cap."""

    type: Literal["multi_choice"]
    options: tuple[Option, ...] = Field(min_length=2, max_length=12)
    cap: int = Field(ge=1, le=100)
    max_selections: int = Field(ge=1, le=12)


class ScaleQuestion(_QuestionBase):
    """An integer between `min` and `max`; the fraction is (value - min) / (max - min)."""

    type: Literal["scale"]
    min: int = Field(ge=0, le=10)
    max: int = Field(ge=1, le=10)


class BooleanQuestion(_QuestionBase):
    type: Literal["boolean"]
    points_true: int = Field(ge=0, le=100)
    points_false: int = Field(ge=0, le=100)


class NumberBand(Frozen):
    at_least: float
    points: int = Field(ge=0, le=100)


class NumberQuestion(_QuestionBase):
    """A number in [min, max]; points come from the highest band whose `at_least` it reaches."""

    type: Literal["number"]
    min: float
    max: float
    integer: bool = True
    bands: tuple[NumberBand, ...] = Field(min_length=2, max_length=10)


Question = Annotated[
    SingleChoiceQuestion | MultiChoiceQuestion | ScaleQuestion | BooleanQuestion | NumberQuestion,
    Field(discriminator="type"),
]


# --------------------------------------------------------------------------- rule conditions


class DimensionBelow(Frozen):
    kind: Literal["dimension_below"]
    dimension: KEY
    value: int = Field(ge=0, le=100)


class DimensionAtLeast(Frozen):
    kind: Literal["dimension_at_least"]
    dimension: KEY
    value: int = Field(ge=0, le=100)


class OverallBelow(Frozen):
    kind: Literal["overall_below"]
    value: int = Field(ge=0, le=100)


class OverallAtLeast(Frozen):
    kind: Literal["overall_at_least"]
    value: int = Field(ge=0, le=100)


class BandIn(Frozen):
    kind: Literal["band_in"]
    bands: tuple[KEY, ...] = Field(min_length=1)


class AnswerIn(Frozen):
    """A single-choice answer is one of the options, or a multi-choice answer contains one of them."""

    kind: Literal["answer_in"]
    question: KEY
    options: tuple[KEY, ...] = Field(min_length=1)


class AnswerMissing(Frozen):
    """An optional question was left unanswered."""

    kind: Literal["answer_missing"]
    question: KEY


class AllOf(Frozen):
    kind: Literal["all"]
    conditions: tuple[Condition, ...] = Field(min_length=1, max_length=8)


class AnyOf(Frozen):
    kind: Literal["any"]
    conditions: tuple[Condition, ...] = Field(min_length=1, max_length=8)


Condition = Annotated[
    DimensionBelow
    | DimensionAtLeast
    | OverallBelow
    | OverallAtLeast
    | BandIn
    | AnswerIn
    | AnswerMissing
    | AllOf
    | AnyOf,
    Field(discriminator="kind"),
]
AllOf.model_rebuild()
AnyOf.model_rebuild()

MAX_CONDITION_DEPTH = 3


class Rule(Frozen):
    """When `when` holds, recommend `recommendation`. Lower `priority` comes first."""

    key: KEY
    priority: int = Field(ge=1, le=100)
    when: Condition
    recommendation: KEY


# --------------------------------------------------------------------------- structure


class Dimension(Frozen):
    key: KEY
    weight: int = Field(ge=1, le=100)


class Band(Frozen):
    key: KEY
    # Inclusive lower bound of the rounded overall score.
    min: int = Field(ge=0, le=100)


class Scoring(Frozen):
    # Versioned algorithm implemented in app/assessments/scoring.py. A change in how scores are
    # computed is a new algorithm id, never an edit of an existing one.
    algorithm: Literal["weighted-mean/1"]
    max_recommendations: int = Field(default=4, ge=1, le=10)


# --------------------------------------------------------------------------- texts


class OptionTexts(Frozen):
    label: str = Field(min_length=1, max_length=160)


class QuestionTexts(Frozen):
    text: str = Field(min_length=3, max_length=300)
    help: str | None = Field(default=None, max_length=400)
    options: dict[str, str] = Field(default_factory=dict)
    # Number and scale questions: a short unit or end labels ("per month", "none … fully").
    unit: str | None = Field(default=None, max_length=40)


class TitledTexts(Frozen):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=3, max_length=600)


class LocaleTexts(Frozen):
    title: str = Field(min_length=3, max_length=120)
    intro: str = Field(min_length=10, max_length=600)
    disclaimer: str = Field(min_length=10, max_length=600)
    dimensions: dict[str, TitledTexts]
    questions: dict[str, QuestionTexts]
    bands: dict[str, TitledTexts]
    recommendations: dict[str, TitledTexts]


# --------------------------------------------------------------------------- definition


class AssessmentDefinition(Frozen):
    key: KEY
    version: str = Field(pattern=VERSION_PATTERN)
    # `live`: served publicly. `preview`: served only when ASSESSMENTS_PREVIEW_ENABLED is on (tests,
    # staging), so an unfinished assessment never reaches the public site.
    status: Literal["live", "preview"]
    scoring: Scoring
    dimensions: tuple[Dimension, ...] = Field(min_length=1, max_length=12)
    questions: tuple[Question, ...] = Field(min_length=1, max_length=60)
    bands: tuple[Band, ...] = Field(min_length=2, max_length=8)
    rules: tuple[Rule, ...] = Field(default=(), max_length=60)
    # Assessment-specific code registered in app/assessments/extensions.py (by name, never by path).
    extension: KEY | None = None
    texts: dict[str, LocaleTexts]

    # ----------------------------------------------------------------- lookups

    def question(self, key: str) -> Question:
        return self._questions[key]

    @property
    def _questions(self) -> dict[str, Question]:
        return {q.key: q for q in self.questions}

    @property
    def dimension_keys(self) -> tuple[str, ...]:
        return tuple(d.key for d in self.dimensions)

    @property
    def recommendation_keys(self) -> set[str]:
        return {r.recommendation for r in self.rules}

    # ----------------------------------------------------------------- validation

    @model_validator(mode="after")
    def _check(self) -> AssessmentDefinition:
        problems: list[str] = []
        problems += _unique("dimension", [d.key for d in self.dimensions])
        problems += _unique("question", [q.key for q in self.questions])
        problems += _unique("band", [b.key for b in self.bands])
        problems += _unique("rule", [r.key for r in self.rules])
        dimensions = set(self.dimension_keys)
        questions = self._questions

        for q in self.questions:
            if q.dimension not in dimensions:
                problems.append(f"question {q.key}: unknown dimension {q.dimension}")
            problems += _check_question(q)
        for d in dimensions:
            if not any(q.dimension == d for q in self.questions):
                problems.append(f"dimension {d} has no question")
            if not any(q.dimension == d and q.required for q in self.questions):
                problems.append(f"dimension {d} needs at least one required question")

        minimums = [b.min for b in self.bands]
        if minimums[0] != 0 or minimums != sorted(minimums) or len(set(minimums)) != len(minimums):
            problems.append("bands must start at 0 and have strictly increasing minimums")

        bands = {b.key for b in self.bands}
        for rule in self.rules:
            problems += [f"rule {rule.key}: {p}" for p in _check_condition(rule.when, dimensions, questions, bands, 1)]

        for locale in LOCALES:
            texts = self.texts.get(locale)
            if texts is None:
                problems.append(f"texts missing for locale {locale}")
                continue
            problems += [f"{locale}: {p}" for p in _check_texts(self, texts)]
            if locale == "en" and _CYRILLIC.search(texts.model_dump_json()):
                problems.append("en: texts contain Cyrillic characters")
        if set(self.texts) - set(LOCALES):
            problems.append("texts for an unsupported locale")

        if problems:
            raise ValueError("; ".join(problems))
        return self


def _unique(kind: str, keys: list[str]) -> list[str]:
    return [f"duplicate {kind} key {k}" for k in sorted({k for k in keys if keys.count(k) > 1})]


def _check_question(q: Question) -> list[str]:
    problems: list[str] = []
    if isinstance(q, SingleChoiceQuestion | MultiChoiceQuestion):
        problems += _unique(f"option in {q.key}", [o.key for o in q.options])
        if max(o.points for o in q.options) == 0:
            problems.append(f"question {q.key}: no option scores any points")
    if isinstance(q, MultiChoiceQuestion) and q.max_selections > len(q.options):
        problems.append(f"question {q.key}: max_selections exceeds the options")
    if isinstance(q, ScaleQuestion) and q.max <= q.min:
        problems.append(f"question {q.key}: max must exceed min")
    if isinstance(q, BooleanQuestion) and max(q.points_true, q.points_false) == 0:
        problems.append(f"question {q.key}: neither answer scores any points")
    if isinstance(q, NumberQuestion):
        starts = [b.at_least for b in q.bands]
        if q.max <= q.min:
            problems.append(f"question {q.key}: max must exceed min")
        if starts[0] != q.min or starts != sorted(starts) or len(set(starts)) != len(starts):
            problems.append(f"question {q.key}: bands must start at min and increase strictly")
        if max(b.points for b in q.bands) == 0:
            problems.append(f"question {q.key}: no band scores any points")
    return problems


def _check_condition(
    condition: Condition, dimensions: set[str], questions: dict[str, Question], bands: set[str], depth: int
) -> list[str]:
    if depth > MAX_CONDITION_DEPTH:
        return ["conditions nested too deeply"]
    if isinstance(condition, AllOf | AnyOf):
        return [p for c in condition.conditions for p in _check_condition(c, dimensions, questions, bands, depth + 1)]
    if isinstance(condition, DimensionBelow | DimensionAtLeast) and condition.dimension not in dimensions:
        return [f"unknown dimension {condition.dimension}"]
    if isinstance(condition, BandIn) and not set(condition.bands) <= bands:
        return [f"unknown band in {sorted(condition.bands)}"]
    if isinstance(condition, AnswerIn | AnswerMissing):
        question = questions.get(condition.question)
        if question is None:
            return [f"unknown question {condition.question}"]
        if isinstance(condition, AnswerMissing) and question.required:
            return [f"answer_missing on required question {condition.question}"]
        if isinstance(condition, AnswerIn):
            if not isinstance(question, SingleChoiceQuestion | MultiChoiceQuestion):
                return [f"answer_in needs a choice question: {condition.question}"]
            known = {o.key for o in question.options}
            if not set(condition.options) <= known:
                return [f"unknown option for {condition.question}"]
    return []


def _check_texts(definition: AssessmentDefinition, texts: LocaleTexts) -> list[str]:
    problems: list[str] = []
    if set(texts.dimensions) != set(definition.dimension_keys):
        problems.append("dimension texts do not match the dimensions")
    if set(texts.bands) != {b.key for b in definition.bands}:
        problems.append("band texts do not match the bands")
    if set(texts.recommendations) != definition.recommendation_keys:
        problems.append("recommendation texts do not match the rules")
    if set(texts.questions) != {q.key for q in definition.questions}:
        problems.append("question texts do not match the questions")
    for q in definition.questions:
        q_texts = texts.questions.get(q.key)
        if q_texts is None:
            continue
        if isinstance(q, SingleChoiceQuestion | MultiChoiceQuestion):
            if set(q_texts.options) != {o.key for o in q.options}:
                problems.append(f"option texts of {q.key} do not match its options")
        elif q_texts.options:
            problems.append(f"question {q.key} has option texts but no options")
    return problems
