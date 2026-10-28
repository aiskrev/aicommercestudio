"""Request and response models of the public assessment API (`/api/public/assessments`)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import LeadLocale
from app.schemas import _URL_LIKE, StrictModel, _clean_text, _error, _no_secrets

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


class ResultReportRequest(ResultTokenRequest):
    """`pdf` downloads the PDF; `json` returns the same document for the accessible HTML view."""

    format: Literal["pdf", "json"] = "pdf"


class ResultConsultationRequest(ResultTokenRequest):
    """Optional: ask for a consultation about a saved result. Creates a lead; nothing is required to see results."""

    locale: LeadLocale = LeadLocale.BG
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=254)
    company: str = Field(min_length=2, max_length=160)
    message: str = Field(default="", max_length=1000)
    privacy_acknowledged: bool
    # Separate, optional and unticked by default.
    marketing_consent: bool = False
    website: str = Field(default="", max_length=200)
    form_token: str = Field(default="", max_length=200)

    @field_validator("name", "company")
    @classmethod
    def _plain(cls, value: str) -> str:
        value = _clean_text(value)
        if _URL_LIKE.search(value):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return value

    @field_validator("message")
    @classmethod
    def _message(cls, value: str) -> str:
        value = _no_secrets(_clean_text(value))
        if len(_URL_LIKE.findall(value)) > 3:
            raise _error("too_many_links", "Съобщението съдържа твърде много връзки.")
        return value

    @field_validator("email")
    @classmethod
    def _email_lower(cls, value: str) -> str:
        return value.lower()

    @field_validator("privacy_acknowledged")
    @classmethod
    def _must_ack(cls, value: bool) -> bool:
        if value is not True:
            raise _error(
                "privacy_required", "Необходимо е да потвърдите, че сте запознати с информацията за поверителност."
            )
        return value


class ConsultationOut(BaseModel):
    reference: str
    message: str


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
    evidence: Literal["practice", "metric", "context"] = "practice"


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


class LevelOut(OutModel):
    key: str
    title: str


class DimensionScoreOut(TitledOut):
    score: int = Field(ge=0, le=100)
    # Maturity indicator of the dimension, using the same bands as the overall score.
    level: LevelOut


class FindingOut(TitledOut):
    kind: Literal["recommendation", "risk", "quick_win", "target_state", "pattern", "context"]
    horizon: Literal[30, 60, 90] | None
    domains: list[str]
    # The inputs or score thresholds that triggered this finding (empty only without answers).
    because: list[str]


class RoadmapStepOut(OutModel):
    horizon: Literal[30, 60, 90]
    items: list[str]


class InputOut(OutModel):
    question: str
    dimension: str
    evidence: Literal["practice", "metric", "context"]
    text: str
    answer: str


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
    recommendations: list[FindingOut]
    roadmap: list[RoadmapStepOut]
    domains: list[str]
    inputs: list[InputOut]
    answered: int
    questions: int
    fingerprint: str
    extras: dict[str, Any]
    disclaimer: str
    saved: SavedOut | None = None
