"""Request and response models of the project configurator.

Every answer is an enumeration or a boolean. The only free text is in the optional quote request (goals, special
requirements, contact fields); the review itself never receives or stores personal data. A request carries no
amount: prices come from the published schedule on the server. `model_version` must equal the server's model, so
a stale browser bundle cannot be evaluated under different rules.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.configurator import model
from app.models import BudgetRange, LeadLocale, Timeline
from app.schemas import _URL_LIKE, StrictModel, _clean_text, _error, _no_secrets


class AnswersIn(StrictModel):
    project_type: model.ProjectType  # type: ignore[valid-type]
    pages: model.Pages  # type: ignore[valid-type]
    products: model.Products  # type: ignore[valid-type]
    languages: model.Languages  # type: ignore[valid-type]
    build: model.Build  # type: ignore[valid-type]
    content_migration: bool = False
    store_migration: bool = False
    features: list[model.Feature] = Field(default_factory=list, max_length=len(model.MODEL["features"]))  # type: ignore[valid-type]
    branding: model.Branding  # type: ignore[valid-type]
    design_level: model.DesignLevel  # type: ignore[valid-type]
    accessibility: bool = False
    interactive_elements: bool = False
    operations: list[model.Operation] = Field(default_factory=list, max_length=len(model.MODEL["operations"]))  # type: ignore[valid-type]
    timeline: Timeline
    budget_range: BudgetRange

    @field_validator("features", "operations")
    @classmethod
    def _unique(cls, value: list) -> list:
        if len(set(value)) != len(value):
            raise _error("duplicate_values", "Една и съща стойност е избрана повече от веднъж.")
        return value

    def to_model(self) -> model.Answers:
        # Lists are stored in the model's own order, so equal answers always produce equal reviews.
        chosen_features = {item.value for item in self.features}
        chosen_operations = {item.value for item in self.operations}
        return model.Answers(
            project_type=self.project_type.value,
            pages=self.pages.value,
            products=self.products.value,
            languages=self.languages.value,
            build=self.build.value,
            content_migration=self.content_migration,
            store_migration=self.store_migration,
            features=tuple(name for name in model.MODEL["features"] if name in chosen_features),
            branding=self.branding.value,
            design_level=self.design_level.value,
            accessibility=self.accessibility,
            interactive_elements=self.interactive_elements,
            operations=tuple(name for name in model.MODEL["operations"] if name in chosen_operations),
            timeline=self.timeline.value,
            budget_range=self.budget_range.value,
        )


def _current_model(value: str) -> str:
    """A stale browser bundle must not be evaluated under different rules."""
    if value != model.MODEL_VERSION:
        raise _error("configurator_model", "Конфигураторът е обновен. Моля, презаредете страницата.")
    return value


class _Versioned(StrictModel):
    model_version: str = Field(max_length=32)
    answers: AnswersIn

    @field_validator("model_version")
    @classmethod
    def _model(cls, value: str) -> str:
        return _current_model(value)


class ReviewRequest(_Versioned):
    """Answers only: nothing personal, no free text, no amounts."""


class BandOut(BaseModel):
    unit: Literal["project", "month"]
    from_: int = Field(serialization_alias="from")
    typical: tuple[int, int]


class ItemOut(BaseModel):
    kind: Literal["package", "service", "care_plan"]
    key: str
    reason: str
    band: BandOut | None


class TotalsOut(BaseModel):
    """Sums of the starting prices of the priced items; `primary_priced` is false when the package itself has none."""

    one_time_from: int
    monthly_from: int
    primary_priced: bool


class HumanReviewOut(BaseModel):
    required: Literal[True] = True
    reasons: list[str]


class ReviewOut(BaseModel):
    model_version: str
    schedule_version: str
    currency: str
    owner_approval: Literal["pending", "approved"]
    tax_treatment: str
    binding: Literal[False] = False
    package: str
    service: str
    delivery: Literal["fixed_scope", "staged"]
    items: list[ItemOut]
    included: list[str]
    unpriced: list[str]
    assumptions: list[str]
    exclusions: list[str]
    totals: TotalsOut
    human_review: HumanReviewOut


class MetaOut(BaseModel):
    model_version: str
    schedule_version: str


class QuoteContactFields(StrictModel):
    """Contact and consent fields of a quote request (also used by the quote basket, app/quotes)."""

    locale: LeadLocale = LeadLocale.BG
    goals: str = Field(default="", max_length=600)
    special_requirements: str = Field(default="", max_length=600)
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=254)
    company: str = Field(min_length=2, max_length=160)
    phone: str = Field(default="", max_length=40, pattern=r"^[0-9+()\s.-]*$")
    privacy_acknowledged: bool
    # Separate, optional and unticked by default.
    marketing_consent: bool = False
    # Honeypot: real users never see or fill this field.
    website: str = Field(default="", max_length=200)
    form_token: str = Field(default="", max_length=200)

    @field_validator("name", "company")
    @classmethod
    def _plain(cls, value: str) -> str:
        value = _clean_text(value)
        if _URL_LIKE.search(value):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return value

    @field_validator("goals", "special_requirements")
    @classmethod
    def _text(cls, value: str) -> str:
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
    def _links(self) -> QuoteContactFields:
        if len(_URL_LIKE.findall(f"{self.goals} {self.special_requirements}")) > 3:
            raise _error("too_many_links", "Текстът съдържа твърде много връзки.")
        return self


class SubmissionCreate(QuoteContactFields):
    """Quote request with the configuration attached. Creates a lead for a person to review."""

    model_version: str = Field(max_length=32)
    answers: AnswersIn
    # Generated once by the browser for this request: a repeated click or retry returns the first lead.
    submission_id: uuid.UUID

    @field_validator("model_version")
    @classmethod
    def _model(cls, value: str) -> str:
        return _current_model(value)


class SubmissionOut(BaseModel):
    status: Literal["received"] = "received"
    reference: str
    message: str
