"""Request and response models of the public assessment API (`/api/public/assessments`)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.models import LeadLocale
from app.schemas import StrictModel, _error

MAX_ANSWERS = 60
MAX_SELECTIONS = 12


class AssessmentScoreRequest(StrictModel):
    """Answers only: option keys, booleans and numbers. Weights, points or scores are rejected."""

    schema_version: Literal["1"]
    definition_version: str = Field(max_length=16, pattern=r"^\d+\.\d+\.\d+$")
    locale: LeadLocale = LeadLocale.BG
    answers: dict[str, Any]
    # Opt-in: store the result and return a secret link token (no personal data is stored).
    save: bool = False

    @field_validator("answers")
    @classmethod
    def _answers(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > MAX_ANSWERS:
            raise _error("assessment_answers", "Твърде много отговори.")
        for key, item in value.items():
            if len(key) > 48:
                raise _error("assessment_answers", "Невалиден ключ на въпрос.")
            if isinstance(item, list):
                if len(item) > MAX_SELECTIONS or not all(isinstance(v, str) and len(v) <= 48 for v in item):
                    raise _error("assessment_answers", "Невалиден отговор.")
            elif isinstance(item, str):
                if len(item) > 48:
                    raise _error("assessment_answers", "Невалиден отговор.")
            elif item is not None and not isinstance(item, bool | int | float):
                raise _error("assessment_answers", "Невалиден отговор.")
        return value


class ResultTokenRequest(StrictModel):
    token: str = Field(min_length=20, max_length=100)


class OutModel(BaseModel):
    model_config = {"extra": "forbid"}


class AssessmentSummaryOut(OutModel):
    key: str
    version: str
    status: Literal["live", "preview"]
    title: str
    intro: str
    questions: int
    dimensions: int


class AssessmentListOut(OutModel):
    locale: str
    items: list[AssessmentSummaryOut]


class OptionOut(OutModel):
    key: str
    label: str


class QuestionOut(OutModel):
    key: str
    type: Literal["single_choice", "multi_choice", "scale", "boolean", "number"]
    dimension: str
    required: bool
    text: str
    help: str | None
    unit: str | None
    options: list[OptionOut] | None = None
    max_selections: int | None = None
    min: float | None = None
    max: float | None = None
    integer: bool | None = None


class TitledOut(OutModel):
    key: str
    title: str
    description: str


class AssessmentDefinitionOut(OutModel):
    key: str
    version: str
    status: Literal["live", "preview"]
    locale: str
    schema_version: Literal["1"]
    title: str
    intro: str
    disclaimer: str
    dimensions: list[TitledOut]
    questions: list[QuestionOut]


class DimensionScoreOut(TitledOut):
    score: int = Field(ge=0, le=100)


class SavedOut(OutModel):
    reference: str
    token: str | None = Field(
        default=None, description="Returned once, when the result is saved. Store it: it cannot be recovered."
    )
    expires_at: datetime


class AssessmentResultOut(OutModel):
    assessment: str
    definition_version: str
    algorithm: str
    locale: str
    title: str
    overall: int = Field(ge=0, le=100)
    band: TitledOut
    dimensions: list[DimensionScoreOut]
    recommendations: list[TitledOut]
    answered: int
    questions: int
    fingerprint: str
    extras: dict[str, Any]
    disclaimer: str
    saved: SavedOut | None = None
