"""Project configurator: rules, the deterministic review and the quote request (app/configurator)."""

from __future__ import annotations

import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app import pricing
from app.config import get_settings
from app.configurator import model
from app.configurator.schemas import AnswersIn
from app.models import AuditLog, BudgetRange, Lead, ServiceKey, Timeline
from app.services import leads
from tests.conftest import valid_token

BASE = "/api/public/configurator"
V = model.MODEL_VERSION


def answers(**overrides) -> dict:
    return {
        "project_type": "business_website",
        "pages": "up_to_5",
        "products": "none",
        "languages": "one",
        "build": "new",
        "content_migration": False,
        "store_migration": False,
        "features": [],
        "branding": "existing",
        "design_level": "standard",
        "accessibility": False,
        "interactive_elements": False,
        "operations": [],
        "timeline": "flexible",
        "budget_range": "undisclosed",
        **overrides,
    }


def store(**overrides) -> dict:
    return answers(project_type="online_store", products="up_to_50", **overrides)


def submission(**overrides) -> dict:
    return {
        "model_version": V,
        "answers": answers(),
        "submission_id": str(uuid.uuid4()),
        "locale": "en",
        "goals": "More qualified enquiries.",
        "special_requirements": "",
        "name": "Test User",
        "email": "Test.User@example.com",
        "company": "Example Ltd",
        "phone": "",
        "privacy_acknowledged": True,
        "marketing_consent": False,
        "website": "",
        "form_token": valid_token(),
        **overrides,
    }


def evaluate(**overrides) -> model.Review:
    return model.review(AnswersIn(**answers(**overrides)).to_model())


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(get_settings(), "project_configurator_enabled", True)


# --- The flag ------------------------------------------------------------------------------------------


def test_everything_answers_404_while_the_flag_is_off(client, db):
    assert get_settings().project_configurator_enabled is False  # off by default
    assert client.get(f"{BASE}/meta").status_code == 404
    assert client.post(f"{BASE}/review", json={"model_version": V, "answers": answers()}).status_code == 404
    assert client.post(f"{BASE}/submissions", json=submission()).status_code == 404
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_meta_names_the_model_and_the_price_schedule(client, enabled):
    response = client.get(f"{BASE}/meta")
    assert response.status_code == 200
    assert response.json() == {"model_version": V, "schedule_version": pricing.schedule().version}
    assert response.headers["cache-control"] == "no-store"


# --- The model file ------------------------------------------------------------------------------------


def test_the_model_file_agrees_with_the_enums_the_leads_table_accepts():
    assert model.MODEL["timeline"] == [item.value for item in Timeline]
    assert model.MODEL["budget_range"] == [item.value for item in BudgetRange]
    services = {item.value for item in ServiceKey}
    for definition in model.MODEL["packages"].values():
        assert definition["service"] in services
        assert definition["delivery"] in ("fixed_scope", "staged")
        assert definition["care_plan"] is None or pricing.band("care_plan", definition["care_plan"])
        if definition["priced"]:
            assert pricing.band("service", definition["service"])
    for target in model.MODEL["priced_features"].values():
        assert pricing.band("service", target), target
    features = set(model.MODEL["features"])
    for group in ("unavailable_features", "included_features"):
        for names in model.MODEL[group].values():
            assert set(names) <= features
    assert set(model.MODEL["unavailable_features"]) == set(model.MODEL["project_types"])
    assert set(model.MODEL["included_features"]) == set(model.MODEL["packages"])
    assert set(model.MODEL["budget_upper_bound"]) < set(model.MODEL["budget_range"])


def test_the_two_packages_without_an_approved_price_stay_unpriced():
    unpriced = sorted(key for key, value in model.MODEL["packages"].items() if not value["priced"])
    assert unpriced == ["landing_page", "store_setup"]  # owner decision D-09
    assert model.MODEL["packages"]["custom_web_app"]["delivery"] == "staged"


# --- Recommendation and review -------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("overrides", "package"),
    [
        ({"project_type": "landing_page", "pages": "one"}, "landing_page"),
        ({}, "business_website"),
        ({"project_type": "online_store", "products": "up_to_50"}, "store_setup"),
        ({"project_type": "online_store", "products": "up_to_500"}, "store_complete"),
        ({"project_type": "online_store", "products": "up_to_50", "store_migration": True}, "store_complete"),
        ({"project_type": "online_store", "products": "up_to_50", "features": ["erp"]}, "store_complete"),
        ({"project_type": "online_store", "products": "up_to_50", "design_level": "bespoke"}, "store_complete"),
        ({"project_type": "custom_application", "features": ["customer_accounts"]}, "custom_web_app"),
    ],
)
def test_recommended_package(overrides, package):
    assert evaluate(**overrides).package == package


def test_a_priced_package_shows_the_published_band_and_nothing_invented():
    result = evaluate()
    band = pricing.band("service", "business_websites")
    assert [(item.kind, item.key) for item in result.items] == [("package", "business_website")]
    assert result.items[0].band == band
    assert (result.one_time_from, result.monthly_from, result.primary_priced) == (band.from_, 0, True)
    assert result.unpriced == ()
    assert result.review_reasons == ("indicative_only",)
    assert result.exclusions == model.EXCLUSION_KEYS


def test_an_unpriced_package_requires_assessment_instead_of_a_manufactured_price():
    result = evaluate(project_type="landing_page", pages="one")
    assert result.items[0].band is None and result.primary_priced is False
    assert result.one_time_from == 0
    assert "package_scope" in result.unpriced and "unpriced_requirements" in result.review_reasons
    setup = evaluate(project_type="online_store", products="up_to_50", features=["payments", "shipping"])
    assert setup.package == "store_setup" and setup.items[0].band is None
    assert setup.included == ("payments", "shipping")  # part of the package, not a separate line


def test_features_are_included_priced_by_an_existing_service_or_assessed():
    result = evaluate(features=["payments", "crm", "erp", "analytics", "seo", "ai_assistant", "booking", "blog"])
    lines = {(item.kind, item.key): item for item in result.items}
    # One line per service, even when several features lead to it (crm and erp → integrations).
    assert set(lines) == {
        ("package", "business_website"),
        ("service", "payments_subscriptions"),
        ("service", "integrations"),
        ("service", "analytics"),
        ("service", "seo"),
        ("service", "ai_tools"),
    }
    assert lines[("service", "seo")].band.recurring and result.monthly_from == pricing.band("service", "seo").from_
    one_time = ("business_websites", "payments_subscriptions", "integrations", "analytics", "ai_tools")
    assert result.one_time_from == sum(pricing.band("service", key).from_ for key in one_time)
    assert {"feature:booking", "feature:blog"} <= set(result.unpriced)
    assert {"integrations", "ai_assistant", "unpriced_requirements"} <= set(result.review_reasons)


def test_operations_use_the_care_plan_bands_and_leave_the_rest_for_assessment():
    result = evaluate(operations=["hosting", "maintenance", "backups", "security", "monitoring", "support"])
    plans = {item.key: item for item in result.items if item.kind == "care_plan"}
    assert set(plans) == {"website", "security"}
    assert (
        result.monthly_from == pricing.band("care_plan", "website").from_ + pricing.band("care_plan", "security").from_
    )
    assert {"operation:backups", "operation:monitoring", "operation:support"} <= set(result.unpriced)
    assert "hosting" in result.exclusions and "operation:hosting" not in result.unpriced  # a third-party cost
    app = evaluate(project_type="custom_application", operations=["maintenance"])
    assert "care_for_application" in app.unpriced and not [item for item in app.items if item.kind == "care_plan"]


def test_scope_and_design_choices_are_listed_as_unpriced_and_ask_for_a_person():
    result = evaluate(
        pages="more_than_15",
        languages="three_plus",
        build="redesign",
        content_migration=True,
        branding="new",
        design_level="bespoke",
        accessibility=True,
        timeline="asap",
        budget_range="under_2500",
        features=["payments", "erp"],
    )
    assert {
        "additional_languages",
        "redesign",
        "content_migration",
        "large_site",
        "new_branding",
        "bespoke_design",
        "accessibility_requirements",
    } <= set(result.unpriced)
    assert {
        "migration",
        "bespoke_design",
        "new_branding",
        "large_scope",
        "asap_timeline",
        "budget_below_starting_price",
    } <= set(result.review_reasons)
    assert set(result.unpriced) <= set(model.UNPRICED_KEYS)
    assert set(result.review_reasons) <= set(model.REVIEW_REASONS)
    assert set(result.assumptions) <= set(model.ASSUMPTION_KEYS)


def test_the_review_is_deterministic_and_independent_of_the_order_of_the_choices():
    first = evaluate(features=["seo", "crm", "blog"], operations=["security", "maintenance"])
    second = evaluate(features=["blog", "crm", "seo"], operations=["maintenance", "security"])
    assert first == second


@pytest.mark.parametrize(
    ("overrides", "rule"),
    [
        ({"project_type": "landing_page", "pages": "up_to_5"}, "landing_single_page"),
        ({"products": "up_to_50"}, "products_need_store"),
        ({"project_type": "online_store", "products": "none"}, "store_needs_products"),
        ({"store_migration": True}, "store_migration_needs_store"),
        ({"features": ["user_dashboard"]}, "dashboard_needs_accounts"),
        ({"features": ["shipping"]}, "feature_not_for_type:shipping"),
        ({"project_type": "landing_page", "pages": "one", "features": ["payments"]}, "feature_not_for_type:payments"),
    ],
)
def test_unsupported_combinations_are_named(overrides, rule):
    assert rule in model.violations(AnswersIn(**answers(**overrides)).to_model())
    with pytest.raises(ValueError, match=rule.split(":")[0]):
        evaluate(**overrides)
    assert rule.split(":")[0] in model.RULES


# --- POST /review --------------------------------------------------------------------------------------


def test_review_returns_the_bands_of_the_published_schedule(client, enabled, db):
    response = client.post(f"{BASE}/review", json={"model_version": V, "answers": answers(features=["seo"])})
    assert response.status_code == 200, response.text
    body = response.json()
    schedule = json.loads(Path(pricing.__file__).with_name("price_schedule.json").read_text(encoding="utf-8"))
    website = schedule["groups"]["service"]["business_websites"]
    assert body["package"] == "business_website" and body["service"] == "business_websites"
    assert body["items"][0]["band"] == {"unit": "project", "from": website["from"], "typical": website["typical"]}
    assert body["totals"] == {
        "one_time_from": website["from"],
        "monthly_from": schedule["groups"]["service"]["seo"]["from"],
        "primary_priced": True,
    }
    assert body["binding"] is False and body["owner_approval"] == "pending" and body["currency"] == "EUR"
    assert body["schedule_version"] == schedule["version"] and body["tax_treatment"] == "not_vat_registered"
    assert body["human_review"]["required"] is True and "indicative_only" in body["human_review"]["reasons"]
    assert response.headers["cache-control"] == "no-store"
    assert db.scalar(select(func.count()).select_from(Lead)) == 0  # a review stores nothing


@pytest.mark.parametrize("field", ["price", "total", "amount", "one_time_from", "band"])
def test_a_request_cannot_carry_an_amount(client, enabled, field):
    tampered = {"model_version": V, "answers": {**answers(), field: 1}}
    assert client.post(f"{BASE}/review", json=tampered).status_code == 422
    top_level = {"model_version": V, "answers": answers(), field: 1}
    assert client.post(f"{BASE}/review", json=top_level).status_code == 422
    assert client.post(f"{BASE}/submissions", json=submission(**{field: 1})).status_code == 422


def test_invalid_missing_and_stale_requests_are_refused(client, enabled):
    def post(body):
        return client.post(f"{BASE}/review", json=body)

    assert post({"model_version": V}).status_code == 422
    incomplete = answers()
    del incomplete["design_level"]
    assert post({"model_version": V, "answers": incomplete}).status_code == 422
    assert post({"model_version": V, "answers": answers(project_type="mobile_app")}).status_code == 422
    assert post({"model_version": V, "answers": answers(features=["seo", "seo"])}).status_code == 422
    assert post({"model_version": V, "answers": answers(features=["'; DROP TABLE leads; --"])}).status_code == 422
    assert post({"model_version": V, "answers": answers(features=["seo"] * 40)}).status_code == 422
    stale = post({"model_version": "2020-01.1", "answers": answers()})
    assert stale.status_code == 422 and "configurator_model" in stale.text


def test_an_unsupported_combination_is_a_422_with_the_rule_names(client, enabled):
    response = client.post(f"{BASE}/review", json={"model_version": V, "answers": answers(features=["shipping"])})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "unsupported_combination"
    assert "feature_not_for_type:shipping" in [error["type"] for error in body["errors"]]


def test_review_is_rate_limited(client, enabled, monkeypatch):
    monkeypatch.setattr(get_settings(), "configurator_review_rate_limit", 2)
    body = {"model_version": V, "answers": answers()}
    assert [client.post(f"{BASE}/review", json=body).status_code for _ in range(3)] == [200, 200, 429]


# --- POST /submissions ---------------------------------------------------------------------------------


def test_a_submission_creates_a_quote_lead_with_the_review_computed_on_the_server(client, enabled, db):
    payload = submission(
        answers=store(
            features=["payments", "erp"], operations=["maintenance"], budget_range="2500_10000", timeline="asap"
        ),
        special_requirements="Existing warehouse system.",
        marketing_consent=True,
    )
    response = client.post(f"{BASE}/submissions", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "received"

    lead = db.scalar(select(Lead))
    assert lead.reference == response.json()["reference"]
    assert (lead.source, lead.inquiry_type, lead.service) == (leads.CONFIGURATOR_SOURCE, "quote", "store_development")
    assert (lead.budget_range, lead.timeline, lead.locale, lead.status) == ("2500_10000", "asap", "en", "NEW")
    assert lead.email == "test.user@example.com" and lead.phone is None
    assert lead.marketing_consent is True and lead.privacy_notice_version
    details = lead.service_details
    assert details["kind"] == "project_configurator" and details["model_version"] == V
    assert details["submission_id"] == payload["submission_id"]
    assert details["answers"]["features"] == ["payments", "erp"]
    review = details["review"]
    assert review["package"] == "store_complete" and review["binding"] is False
    assert review["schedule_version"] == pricing.schedule().version
    assert review["totals"]["one_time_from"] == (
        pricing.band("service", "store_development").from_ + pricing.band("service", "integrations").from_
    )
    assert "Goals: More qualified enquiries." in lead.message and "Existing warehouse system." in lead.message
    assert "not a quote" in lead.message
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "lead.created"))
    assert entry.details["source"] == leads.CONFIGURATOR_SOURCE and entry.details["package"] == "store_complete"
    assert "email" not in json.dumps(entry.details)


def test_the_same_submission_twice_creates_one_lead(client, enabled, db):
    payload = submission()
    first = client.post(f"{BASE}/submissions", json=payload)
    again = client.post(f"{BASE}/submissions", json={**payload, "form_token": valid_token()})
    assert (first.status_code, again.status_code) == (201, 200)
    assert first.json()["reference"] == again.json()["reference"]
    assert db.scalar(select(func.count()).select_from(Lead)) == 1
    other = client.post(f"{BASE}/submissions", json=submission())
    assert other.status_code == 201 and other.json()["reference"] != first.json()["reference"]


def test_simultaneous_duplicates_create_one_lead(client, enabled, db):
    payload = submission()
    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = list(pool.map(lambda _: client.post(f"{BASE}/submissions", json=payload).status_code, range(4)))
    assert sorted(codes) == [200, 200, 200, 201]
    assert db.scalar(select(func.count()).select_from(Lead)) == 1


def test_submission_validation_and_spam_guards(client, enabled, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "contact_rate_limit", 100)  # invalid requests count toward the limit too

    def post(**overrides):
        return client.post(f"{BASE}/submissions", json=submission(**overrides))

    assert post(privacy_acknowledged=False).status_code == 422
    assert post(email="not-an-email").status_code == 422
    assert post(name="A").status_code == 422
    assert post(name="See https://spam.example").status_code == 422
    assert post(goals="x" * 601).status_code == 422
    assert post(submission_id="not-a-uuid").status_code == 422
    assert post(phone="call me maybe").status_code == 422
    assert post(answers=answers(features=["shipping"])).status_code == 422
    assert post(model_version="old").status_code == 422
    assert post(form_token="").status_code == 400
    assert post(goals="password: hunter2hunter2").status_code == 422
    honeypot = post(website="https://bot.example")
    assert honeypot.status_code == 201  # looks like success, stores nothing
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_no_configurator_route_reads_a_language_or_country_for_the_price(client, enabled):
    body = {"model_version": V, "answers": answers()}
    plain = client.post(f"{BASE}/review", json=body).json()
    for headers in (
        {"Accept-Language": "en-GB"},
        {"Accept-Language": "bg-BG"},
        {"CF-IPCountry": "DE"},
        {"X-Forwarded-For": "203.0.113.9"},
    ):
        assert client.post(f"{BASE}/review", json=body, headers=headers).json() == plain


def test_staff_see_the_stored_answers_and_the_review_on_the_lead(admin_client, enabled, db):
    payload = submission(answers=store(features=["payments"]))
    assert admin_client.post(f"{BASE}/submissions", json=payload).status_code == 201
    lead = db.scalar(select(Lead))
    detail = admin_client.get(f"/api/admin/leads/{lead.id}").json()
    stored = detail["configurator"]
    assert stored["model_version"] == V
    assert stored["answers"]["project_type"] == "online_store" and stored["answers"]["features"] == ["payments"]
    assert stored["review"]["package"] == "store_setup" and stored["review"]["binding"] is False
    assert stored["review"]["items"][0]["band"] is None  # no approved price for the starter store
    assert detail["inquiry_type"] == "quote" and detail["solution"] is None
