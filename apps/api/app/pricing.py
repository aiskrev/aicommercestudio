"""The published price schedule, as the API reads it.

`price_schedule.json` is a byte-for-byte copy of apps/web/src/lib/price-schedule.json, which the web tests
generate from apps/web/src/lib/prices.ts (the only place where an amount is written). scripts/test.ps1 compares
the two files, so a page and the server can never disagree about an amount.

What the schedule is and is not:

* **Indicative.** `binding` is always false: a published band is a guide, only a written quote is a price.
  Nothing in this module produces a checkout amount; Stripe prices live in `billing_offers`.
* **One schedule for everyone.** There is no parameter for language, country, IP address or browser.
* **Not approved yet.** `owner_approval` is "pending" until the owner records the decision
  (docs/OWNER_DECISION_PRICE_SCHEDULE.md); `is_owner_approved()` lets a caller refuse to present an estimate as
  anything more than indicative.
* **Tax.** `tax_treatment` states today's fact ("not_vat_registered": nothing is added). It changes with the
  company's registration, so callers read it instead of assuming it.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

_PATH = Path(__file__).with_name("price_schedule.json")

PriceGroup = Literal["service", "workshop", "care_plan", "ai_managed"]
PriceUnit = Literal["project", "month"]


class PriceBand(BaseModel):
    """Whole euro amounts: the lowest sensible scope and the typical range."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    unit: PriceUnit
    from_: int = Field(alias="from", gt=0)
    typical: tuple[int, int]

    @model_validator(mode="after")
    def _ordered(self) -> PriceBand:
        if not self.from_ <= self.typical[0] <= self.typical[1]:
            raise ValueError("a band must satisfy from <= typical low <= typical high")
        return self

    @property
    def recurring(self) -> bool:
        return self.unit == "month"


class PriceSchedule(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    version: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}\.\d+$")
    currency: Literal["EUR"]
    schedule: Literal["bg", "eu"]
    owner_approval: Literal["pending", "approved"]
    tax_treatment: Literal["not_vat_registered", "vat_exclusive", "vat_inclusive"]
    binding: Literal[False]
    excluded_costs: tuple[str, ...]
    groups: dict[PriceGroup, dict[str, PriceBand]]


@cache
def schedule() -> PriceSchedule:
    return PriceSchedule.model_validate(json.loads(_PATH.read_text(encoding="utf-8")))


def band(group: PriceGroup, key: str) -> PriceBand | None:
    """The published band of one offer, or None when the schedule has no price for it."""
    return schedule().groups.get(group, {}).get(key)


def is_owner_approved() -> bool:
    return schedule().owner_approval == "approved"
