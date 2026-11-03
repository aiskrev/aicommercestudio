"""Request and response models of the AI Solution Builder enquiry.

The design arrives only as its enumerated share code (no free text, no keys, no URLs); the server
decodes it and checks the composition rules itself (app/solution/model.py). `model_version` must
equal the server's model so a stale browser bundle cannot submit a design under different rules.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models import LeadLocale
from app.schemas import _URL_LIKE, StrictModel, _clean_text, _error, _no_secrets
from app.solution.model import MAX_CODE_LENGTH, MODEL_VERSION


class SolutionEnquiryCreate(StrictModel):
    """Optional enquiry with a solution design attached. Creates a lead; the plan never needs it."""

    model_version: str = Field(max_length=32)
    code: str = Field(min_length=1, max_length=MAX_CODE_LENGTH, pattern=r"^[a-z0-9_.-]+$")
    locale: LeadLocale = LeadLocale.BG
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=254)
    company: str = Field(min_length=2, max_length=160)
    message: str = Field(default="", max_length=1000)
    privacy_acknowledged: bool
    # Separate, optional and unticked by default.
    marketing_consent: bool = False
    # Honeypot: real users never see or fill this field.
    website: str = Field(default="", max_length=200)
    form_token: str = Field(default="", max_length=200)

    @field_validator("model_version")
    @classmethod
    def _model(cls, value: str) -> str:
        if value != MODEL_VERSION:
            raise _error("solution_model", "Дизайнът е направен с по-стара версия. Моля, презаредете страницата.")
        return value

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
    def _links_in_message(self) -> SolutionEnquiryCreate:
        if len(_URL_LIKE.findall(self.message)) > 3:
            raise _error("too_many_links", "Съобщението съдържа твърде много връзки.")
        return self


class SolutionEnquiryOut(BaseModel):
    status: Literal["received"] = "received"
    reference: str
    message: str
