"""Request and response models of the quote basket.

A request names what to put in the basket (enumerated configurator answers, or the key of a published offer) and
never how much it costs: no model here has an amount field on the way in, and unknown fields are refused.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.configurator.schemas import (
    AnswersIn,
    BandOut,
    HumanReviewOut,
    QuoteContactFields,
    ReviewOut,
    _current_model,
)
from app.models import LeadLocale
from app.schemas import StrictModel

MAX_ITEMS = 8


class ConfigurationItemIn(StrictModel):
    """A configured project: the same answers the project configurator reviews."""

    kind: Literal["configuration"]
    model_version: str = Field(max_length=32)
    answers: AnswersIn

    @field_validator("model_version")
    @classmethod
    def _model(cls, value: str) -> str:
        return _current_model(value)


class ExtraItemIn(StrictModel):
    """An optional extra: one published offer, named by its group and key in the price schedule."""

    kind: Literal["extra"]
    group: Literal["service", "workshop", "care_plan", "ai_managed"]
    key: str = Field(min_length=1, max_length=48, pattern=r"^[a-z0-9_]+$")


ItemIn = Annotated[ConfigurationItemIn | ExtraItemIn, Field(discriminator="kind")]


class BasketCreate(StrictModel):
    locale: LeadLocale = LeadLocale.BG
    item: ItemIn | None = None


class ItemWrite(StrictModel):
    # The version the browser last saw: a change made elsewhere in the meantime is not overwritten (409).
    expected_version: int = Field(ge=1)
    item: ItemIn


class BasketSubmit(QuoteContactFields):
    """Send the basket as one quote request. Contact details arrive only here and go to the lead, not the basket."""

    expected_version: int = Field(ge=1)


class ExtraOut(BaseModel):
    group: str
    key: str
    band: BandOut


class BasketItemOut(BaseModel):
    id: str
    kind: Literal["configuration", "extra"]
    # A configuration that no longer passes the current rules: it must be edited before the basket can be sent.
    needs_update: bool = False
    answers: dict[str, Any] | None = None
    review: ReviewOut | None = None
    extra: ExtraOut | None = None


class BasketTotalsOut(BaseModel):
    """Sums of the starting prices of the priced lines. One-time and monthly are never added together."""

    one_time_from: int
    monthly_from: int
    priced_lines: int
    unpriced_lines: int


class UnpricedOut(BaseModel):
    item_id: str
    key: str


class BasketOut(BaseModel):
    status: Literal["open", "submitted"]
    version: int
    expires_at: datetime
    locale: str
    model_version: str
    schedule_version: str
    currency: str
    owner_approval: Literal["pending", "approved"]
    tax_treatment: str
    binding: Literal[False] = False
    max_items: int = MAX_ITEMS
    items: list[BasketItemOut]
    totals: BasketTotalsOut
    unpriced: list[UnpricedOut]
    assumptions: list[str]
    exclusions: list[str]
    human_review: HumanReviewOut
    # Set once the basket was sent.
    reference: str | None = None


class BasketCreated(BaseModel):
    # Shown once: the browser keeps it and sends it in the X-Basket-Token header. Only its hash is stored.
    token: str
    basket: BasketOut


class BasketSubmitted(BaseModel):
    status: Literal["received"] = "received"
    reference: str
    message: str
