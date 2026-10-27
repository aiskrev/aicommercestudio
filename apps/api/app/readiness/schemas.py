"""Versioned request/response models for the AI Readiness Assessment endpoints.

`schema_version` versions the request shape; `model_version` must equal the server's scoring model
(app/readiness/scoring.py) so a stale browser bundle cannot submit answers to a different model.
Answers are levels only (integers 0–4) — no free text reaches the scoring or the PDF.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models import LeadLocale
from app.readiness.scoring import MAX_ANSWER, MODEL_VERSION, QUESTION_ORDER
from app.schemas import _URL_LIKE, StrictModel, _clean_text, _error, _no_secrets

SCHEMA_VERSION = "1"


class ReadinessAnswersIn(StrictModel):
    """Common part: the answers (exactly the 12 known questions, each 0–4) and the model they target."""

    schema_version: Literal["1"]
    model_version: str = Field(max_length=32)
    locale: LeadLocale = LeadLocale.BG
    answers: dict[str, int]
    # The browser's own result; compared with the server's (mismatches are logged, the server wins).
    client_overall: int | None = Field(default=None, ge=0, le=100)
    form_token: str = Field(default="", max_length=200)

    @field_validator("model_version")
    @classmethod
    def _model(cls, value: str) -> str:
        if value != MODEL_VERSION:
            raise _error("readiness_model", "Оценката е направена с по-стара версия. Моля, презаредете страницата.")
        return value

    @field_validator("answers", mode="before")
    @classmethod
    def _answers(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            raise _error("readiness_answers", "Липсват отговори на оценката.")
        unknown = set(value) - set(QUESTION_ORDER)
        missing = [q for q in QUESTION_ORDER if q not in value]
        if unknown or missing:
            raise _error("readiness_answers", "Отговорите на оценката са непълни или невалидни.")
        for item in value.values():
            if not isinstance(item, int) or isinstance(item, bool) or not 0 <= item <= MAX_ANSWER:
                raise _error("readiness_answers", "Отговорите на оценката са непълни или невалидни.")
        return value


class ReadinessReportRequest(ReadinessAnswersIn):
    """Anonymous PDF report. `company` is printed on the cover only and never stored or logged."""

    company: str | None = Field(default=None, max_length=120)

    @field_validator("company", mode="before")
    @classmethod
    def _company(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        if not isinstance(value, str):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        cleaned = _clean_text(value)
        if _URL_LIKE.search(cleaned):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return cleaned


class ReadinessSubmissionCreate(ReadinessAnswersIn):
    """Optional hand-off to the team: results plus contact details. Creates a lead."""

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=254)
    company: str = Field(min_length=2, max_length=160)
    role: str = Field(min_length=2, max_length=80)
    message: str = Field(default="", max_length=1000)
    consultation_requested: bool = False
    privacy_acknowledged: bool
    # Separate from requesting a report or a consultation; never pre-selected by the client.
    marketing_consent: bool = False
    # Honeypot: real users never see or fill this field.
    website: str = Field(default="", max_length=200)

    @field_validator("name", "company", "role")
    @classmethod
    def _plain(cls, value: str) -> str:
        value = _clean_text(value)
        if _URL_LIKE.search(value):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return value

    @field_validator("message")
    @classmethod
    def _message(cls, value: str) -> str:
        return _no_secrets(_clean_text(value))

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

    @model_validator(mode="after")
    def _links_in_message(self) -> ReadinessSubmissionCreate:
        if len(_URL_LIKE.findall(self.message)) > 3:
            raise _error("too_many_links", "Описанието съдържа твърде много връзки. Опишете процеса с думи.")
        return self


class ReadinessMeta(BaseModel):
    """What the browser needs to describe the save/report options honestly."""

    schema_version: str = SCHEMA_VERSION
    model_version: str = MODEL_VERSION
    privacy_notice_version: str
    marketing_consent_version: str
    retention_days: int
    # No code path e-mails visitors; the UI must not promise an e-mailed report.
    email_delivery: Literal[False] = False


class ReadinessSubmitted(BaseModel):
    status: Literal["received"] = "received"
    reference: str
    message: str
    overall: int
    band: str
