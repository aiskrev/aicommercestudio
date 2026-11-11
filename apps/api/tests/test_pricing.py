"""The published price schedule as the API reads it (app/pricing.py)."""

from __future__ import annotations

import inspect
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app import pricing
from app.models import ServiceKey, WorkshopKey

RAW = json.loads(Path(pricing.__file__).with_name("price_schedule.json").read_text(encoding="utf-8"))


def test_the_schedule_loads_and_states_what_it_is():
    schedule = pricing.schedule()
    assert schedule.currency == "EUR"
    assert schedule.binding is False  # a published band is never a checkout amount
    assert schedule.schedule == "bg"  # the one schedule shown in every language
    assert schedule.tax_treatment == "not_vat_registered"
    assert set(schedule.excluded_costs) == {"hosting", "licences", "ai_model_usage"}
    assert schedule.version == RAW["version"]


def test_the_owner_has_not_approved_the_schedule_yet():
    # Flips only when the owner records the decision (docs/OWNER_DECISION_PRICE_SCHEDULE.md) and the web constant,
    # the copied file and this test change together.
    assert pricing.schedule().owner_approval == "pending"
    assert pricing.is_owner_approved() is False


def test_every_service_and_workshop_the_api_accepts_has_a_band():
    services = {key.value for key in ServiceKey} - {ServiceKey.OTHER.value}
    assert set(pricing.schedule().groups["service"]) == services
    assert set(pricing.schedule().groups["workshop"]) == {key.value for key in WorkshopKey}
    assert set(pricing.schedule().groups["ai_managed"]) == {"essential", "managed", "advanced"}
    assert set(pricing.schedule().groups["care_plan"]) == {"website", "commerce", "automation", "cloud", "security"}


def test_bands_are_whole_ordered_amounts_with_a_unit():
    for group, items in pricing.schedule().groups.items():
        for key, item in items.items():
            assert 0 < item.from_ <= item.typical[0] <= item.typical[1], (group, key)
            assert item.unit in ("project", "month")
            assert item.recurring is (item.unit == "month")
    monthly = {key for key, item in pricing.schedule().groups["service"].items() if item.recurring}
    assert monthly == {"maintenance", "seo", "ai_managed", "integration_care"}
    assert all(not item.recurring for item in pricing.schedule().groups["workshop"].values())
    assert all(item.recurring for item in pricing.schedule().groups["care_plan"].values())


def test_band_lookup_returns_none_for_what_has_no_published_price():
    website = pricing.band("service", "business_websites")
    assert website is not None and website.from_ == RAW["groups"]["service"]["business_websites"]["from"]
    assert pricing.band("service", "other") is None
    assert pricing.band("service", "landing_page") is None  # packages without an approved price have no band
    assert pricing.band("workshop", "no_such_workshop") is None


def test_a_malformed_schedule_is_refused():
    broken = json.loads(json.dumps(RAW))
    broken["groups"]["service"]["seo"]["from"] = 10_000  # above its typical range
    with pytest.raises(ValidationError):
        pricing.PriceSchedule.model_validate(broken)
    binding = {**RAW, "binding": True}
    with pytest.raises(ValidationError):
        pricing.PriceSchedule.model_validate(binding)
    other_currency = {**RAW, "currency": "BGN"}
    with pytest.raises(ValidationError):
        pricing.PriceSchedule.model_validate(other_currency)


def test_no_lookup_takes_a_language_country_or_address():
    for function in (pricing.schedule, pricing.band, pricing.is_owner_approved):
        names = set(inspect.signature(function).parameters)
        assert not names & {"locale", "language", "lang", "country", "ip", "market", "request"}, function.__name__
