"""Quote basket: ownership by token, add/edit/remove, concurrent changes, expiry and sending (app/quotes)."""

from __future__ import annotations

import inspect
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app import pricing, release_gates
from app.config import Settings, get_settings
from app.configurator import model
from app.models import AuditLog, Lead, utcnow
from app.quotes import service
from app.quotes.models import QuoteBasket
from app.quotes.schemas import MAX_ITEMS
from app.security import hash_token
from app.services import leads
from tests.conftest import valid_token
from tests.test_configurator import answers, store

BASE = "/api/public/quote-basket"
V = model.MODEL_VERSION


def configuration(**overrides) -> dict:
    return {"kind": "configuration", "model_version": V, "answers": answers(**overrides)}


def extra(group: str = "service", key: str = "seo") -> dict:
    return {"kind": "extra", "group": group, "key": key}


def contact(**overrides) -> dict:
    return {
        "expected_version": 2,
        "locale": "en",
        "goals": "One request for the site and its care.",
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


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(get_settings(), "quote_basket_enabled", True)


def start(client, item: dict | None = None, locale: str = "en") -> tuple[dict, dict]:
    body = {"locale": locale} | ({"item": item} if item else {})
    response = client.post(BASE, json=body)
    assert response.status_code == 201, response.text
    created = response.json()
    return {"X-Basket-Token": created["token"]}, created["basket"]


def rows(db) -> int:
    return db.scalar(select(func.count()).select_from(QuoteBasket))


# --- The flag and the token ----------------------------------------------------------------------------


def test_everything_answers_404_while_the_flag_is_off(client, db):
    assert get_settings().quote_basket_enabled is False  # off by default
    token = {"X-Basket-Token": "a" * 43}
    assert client.post(BASE, json={"locale": "bg"}).status_code == 404
    assert client.get(BASE, headers=token).status_code == 404
    assert client.post(f"{BASE}/items", headers=token, json={"expected_version": 1, "item": extra()}).status_code == 404
    assert client.post(f"{BASE}/submit", headers=token, json=contact()).status_code == 404
    assert client.delete(BASE, headers=token).status_code == 404
    assert rows(db) == 0


def test_a_basket_belongs_to_the_holder_of_the_token_and_only_the_hash_is_stored(client, enabled, db):
    headers, basket = start(client)
    token = headers["X-Basket-Token"]
    assert basket["status"] == "open" and basket["version"] == 1 and basket["items"] == []
    assert basket["binding"] is False and basket["owner_approval"] == "pending" and basket["currency"] == "EUR"
    row = db.scalar(select(QuoteBasket))
    assert row.token_hash == hash_token(token) and token not in json.dumps(row.items)
    assert client.get(BASE, headers=headers).json()["version"] == 1
    assert client.get(BASE, headers=headers).headers["cache-control"] == "no-store"

    # Without the token, with someone else's, or with a malformed one there is no basket.
    assert client.get(BASE).status_code == 422
    assert client.get(BASE, headers={"X-Basket-Token": "b" * 43}).status_code == 404
    assert client.get(BASE, headers={"X-Basket-Token": "short"}).status_code == 422
    assert client.get(BASE, headers={"X-Basket-Token": "x" * 30 + "'; DROP TABLE"}).status_code == 422
    # The id of a basket opens nothing: there is no route that takes it.
    assert client.get(f"{BASE}/{row.id}").status_code in (404, 405)
    other_headers, _ = start(client)
    assert client.get(BASE, headers=other_headers).json()["items"] == []
    assert rows(db) == 2


# --- Add, edit, remove ---------------------------------------------------------------------------------


def test_add_edit_and_remove_recompute_the_lines_from_the_schedule(client, enabled, db):
    headers, basket = start(client, configuration(features=["seo"]))
    assert basket["version"] == 2
    item = basket["items"][0]
    website = pricing.band("service", "business_websites")
    seo = pricing.band("service", "seo")
    assert item["kind"] == "configuration" and item["review"]["package"] == "business_website"
    assert basket["totals"] == {
        "one_time_from": website.from_,
        "monthly_from": seo.from_,
        "priced_lines": 2,
        "unpriced_lines": 0,
    }

    # An optional extra: one published offer, priced by the server.
    added = client.post(
        f"{BASE}/items", headers=headers, json={"expected_version": 2, "item": extra("care_plan", "website")}
    )
    assert added.status_code == 201, added.text
    basket = added.json()
    care = pricing.band("care_plan", "website")
    assert basket["version"] == 3 and [entry["kind"] for entry in basket["items"]] == ["configuration", "extra"]
    assert basket["items"][1]["extra"]["band"] == {"unit": "month", "from": care.from_, "typical": list(care.typical)}
    assert basket["totals"]["monthly_from"] == seo.from_ + care.from_  # recurring is summed apart from one-time
    assert basket["totals"]["one_time_from"] == website.from_

    # Edit the configuration: it becomes a store whose package has no approved price.
    edited = client.put(
        f"{BASE}/items/{item['id']}",
        headers=headers,
        json={"expected_version": 3, "item": {"kind": "configuration", "model_version": V, "answers": store()}},
    )
    assert edited.status_code == 200, edited.text
    basket = edited.json()
    assert basket["items"][0]["id"] == item["id"] and basket["items"][0]["review"]["package"] == "store_setup"
    assert basket["items"][0]["review"]["items"][0]["band"] is None  # requires assessment, never a made-up price
    assert {"item_id": item["id"], "key": "package_scope"} in basket["unpriced"]
    assert basket["totals"]["one_time_from"] == 0 and basket["totals"]["unpriced_lines"] >= 1
    assert "unpriced_requirements" in basket["human_review"]["reasons"]
    assert basket["human_review"]["required"] is True

    removed = client.delete(f"{BASE}/items/{item['id']}", headers=headers, params={"expected_version": 4})
    assert removed.status_code == 200
    basket = removed.json()
    assert [entry["kind"] for entry in basket["items"]] == ["extra"] and basket["version"] == 5
    assert basket["totals"] == {
        "one_time_from": 0,
        "monthly_from": care.from_,
        "priced_lines": 1,
        "unpriced_lines": 0,
    }
    # What is stored is inputs only: no amount anywhere in the row.
    stored = json.dumps(db.scalar(select(QuoteBasket)).items)
    assert str(care.from_) not in stored and "band" not in stored and "typical" not in stored


def test_invalid_identifiers_and_unknown_offers_are_refused(client, enabled):
    headers, basket = start(client, extra())
    item_id = basket["items"][0]["id"]

    def add(item, version=2):
        return client.post(f"{BASE}/items", headers=headers, json={"expected_version": version, "item": item})

    assert add(extra("service", "no_such_service")).json()["code"] == "unknown_offer"
    assert add(extra("service", "landing_page")).status_code == 422  # a package without a price is not an offer
    assert add(extra("gift_cards", "seo")).status_code == 422
    assert add(extra("service", "../../etc/passwd")).status_code == 422
    assert add(extra("service", "seo")).json()["code"] == "duplicate_item"
    assert add({"kind": "physical_product", "sku": "X"}).status_code == 422
    unsupported = add(configuration(features=["shipping"]))
    assert unsupported.status_code == 422 and unsupported.json()["code"] == "unsupported_combination"
    assert "feature_not_for_type:shipping" in [error["type"] for error in unsupported.json()["errors"]]
    assert add({"kind": "configuration", "model_version": "2020-01.1", "answers": answers()}).status_code == 422

    missing = "00000000-0000-4000-8000-000000000000"
    body = {"expected_version": 2, "item": extra("service", "analytics")}
    assert client.put(f"{BASE}/items/{missing}", headers=headers, json=body).json()["code"] == "item_not_found"
    assert client.put(f"{BASE}/items/not-a-uuid", headers=headers, json=body).status_code == 422
    assert client.delete(f"{BASE}/items/{missing}", headers=headers, params={"expected_version": 2}).status_code == 404
    assert client.delete(f"{BASE}/items/{item_id}", headers=headers).status_code == 422  # version is required
    assert client.get(BASE, headers=headers).json()["version"] == 2  # nothing above changed the basket


@pytest.mark.parametrize("field", ["price", "amount", "total", "from", "band"])
def test_no_request_can_carry_an_amount(client, enabled, field):
    headers, _ = start(client)
    tampered_extra = {"expected_version": 1, "item": {**extra(), field: 1}}
    assert client.post(f"{BASE}/items", headers=headers, json=tampered_extra).status_code == 422
    tampered_answers = {"expected_version": 1, "item": configuration() | {"answers": {**answers(), field: 1}}}
    assert client.post(f"{BASE}/items", headers=headers, json=tampered_answers).status_code == 422
    top_level = {"expected_version": 1, "item": extra(), field: 1}
    assert client.post(f"{BASE}/items", headers=headers, json=top_level).status_code == 422
    assert client.post(BASE, json={"locale": "en", field: 1}).status_code == 422
    assert client.post(f"{BASE}/submit", headers=headers, json=contact(**{field: 1})).status_code == 422
    assert client.get(BASE, headers=headers).json()["items"] == []


def test_a_basket_has_a_size_limit(client, enabled):
    headers, _ = start(client)
    offers = [("service", key) for key in list(pricing.schedule().groups["service"])[: MAX_ITEMS + 1]]
    codes = []
    for version, (group, key) in enumerate(offers, start=1):
        response = client.post(
            f"{BASE}/items", headers=headers, json={"expected_version": version, "item": extra(group, key)}
        )
        codes.append(response.status_code)
    assert codes == [201] * MAX_ITEMS + [422]
    assert response.json()["code"] == "basket_full"


# --- Concurrent changes --------------------------------------------------------------------------------


def test_a_stale_version_is_refused_instead_of_overwriting(client, enabled):
    headers, _ = start(client, extra())
    first_tab = client.post(
        f"{BASE}/items", headers=headers, json={"expected_version": 2, "item": extra("service", "analytics")}
    )
    assert first_tab.status_code == 201
    second_tab = client.post(
        f"{BASE}/items", headers=headers, json={"expected_version": 2, "item": extra("service", "audit")}
    )
    assert second_tab.status_code == 409 and second_tab.json()["code"] == "basket_changed"
    current = client.get(BASE, headers=headers).json()
    assert current["version"] == 3 and [entry["extra"]["key"] for entry in current["items"]] == ["seo", "analytics"]


def test_simultaneous_changes_with_the_same_version_apply_once(client, enabled):
    headers, _ = start(client)
    keys = ["seo", "analytics", "audit", "automation"]

    def add(key):
        body = {"expected_version": 1, "item": extra("service", key)}
        return client.post(f"{BASE}/items", headers=headers, json=body).status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = sorted(pool.map(add, keys))
    assert codes == [201, 409, 409, 409]
    current = client.get(BASE, headers=headers).json()
    assert current["version"] == 2 and len(current["items"]) == 1


# --- Expiry --------------------------------------------------------------------------------------------


def test_an_abandoned_basket_expires_and_the_maintenance_job_deletes_it(client, enabled, db):
    settings = get_settings()
    headers, basket = start(client, extra())
    row = db.scalar(select(QuoteBasket))
    lifetime = row.expires_at - utcnow()
    assert timedelta(days=settings.quote_basket_days - 1) < lifetime <= timedelta(days=settings.quote_basket_days)

    row.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    # Expired looks exactly like unknown, for reading and for every change.
    assert client.get(BASE, headers=headers).json()["code"] == "basket_not_found"
    body = {"expected_version": basket["version"], "item": extra("service", "audit")}
    assert client.post(f"{BASE}/items", headers=headers, json=body).status_code == 404
    assert client.post(f"{BASE}/submit", headers=headers, json=contact()).status_code == 404

    keeper_headers, _ = start(client, extra())
    assert service.purge_expired(db, dry_run=True) == 1 and rows(db) == 2
    assert service.purge_expired(db) == 1
    db.commit()
    assert rows(db) == 1 and client.get(BASE, headers=keeper_headers).status_code == 200


def test_every_change_extends_the_expiry(client, enabled, db):
    headers, _ = start(client)
    row = db.scalar(select(QuoteBasket))
    row.expires_at = utcnow() + timedelta(hours=1)
    db.commit()
    client.post(f"{BASE}/items", headers=headers, json={"expected_version": 1, "item": extra()})
    db.expire_all()
    assert db.scalar(select(QuoteBasket)).expires_at - utcnow() > timedelta(days=1)


def test_discarding_deletes_the_basket(client, enabled, db):
    headers, _ = start(client, extra())
    assert client.delete(BASE, headers=headers).status_code == 204
    assert rows(db) == 0 and client.get(BASE, headers=headers).status_code == 404


# --- Sending -------------------------------------------------------------------------------------------


def test_sending_creates_one_quote_lead_with_the_view_computed_on_the_server(client, enabled, db):
    headers, _ = start(client, configuration(features=["seo"], budget_range="2500_10000", timeline="asap"))
    client.post(f"{BASE}/items", headers=headers, json={"expected_version": 2, "item": extra("care_plan", "website")})
    response = client.post(f"{BASE}/submit", headers=headers, json=contact(expected_version=3, marketing_consent=True))
    assert response.status_code == 201, response.text
    reference = response.json()["reference"]

    lead = db.scalar(select(Lead))
    assert lead.reference == reference
    assert (lead.source, lead.inquiry_type, lead.service) == (leads.QUOTE_BASKET_SOURCE, "quote", "business_websites")
    assert (lead.budget_range, lead.timeline, lead.locale) == ("2500_10000", "asap", "en")
    assert lead.email == "test.user@example.com" and lead.marketing_consent is True
    assert "2 items" in lead.message and "not a quote" in lead.message and "Goals:" in lead.message
    stored = lead.service_details
    assert stored["kind"] == "quote_basket" and stored["model_version"] == V
    view = stored["basket"]
    assert view["binding"] is False and view["schedule_version"] == pricing.schedule().version
    assert [entry["kind"] for entry in view["items"]] == ["configuration", "extra"]
    assert view["totals"]["one_time_from"] == pricing.band("service", "business_websites").from_
    assert view["totals"]["monthly_from"] == (
        pricing.band("service", "seo").from_ + pricing.band("care_plan", "website").from_
    )
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "lead.created"))
    assert entry.details["source"] == leads.QUOTE_BASKET_SOURCE and entry.details["items"] == 2
    assert "email" not in json.dumps(entry.details)

    # The basket itself never received the contact details, and it is closed for changes.
    row = db.scalar(select(QuoteBasket))
    assert row.status == "submitted" and row.lead_id == lead.id
    assert "example" not in json.dumps(row.items).lower()
    assert row.expires_at - utcnow() <= timedelta(days=service.SUBMITTED_DAYS)
    after = client.get(BASE, headers=headers).json()
    assert after["status"] == "submitted" and after["reference"] == reference
    change = {"expected_version": after["version"], "item": extra("service", "audit")}
    assert client.post(f"{BASE}/items", headers=headers, json=change).json()["code"] == "basket_submitted"


def test_sending_twice_and_simultaneously_creates_one_lead(client, enabled, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "contact_rate_limit", 100)
    headers, _ = start(client, extra())
    first = client.post(f"{BASE}/submit", headers=headers, json=contact())
    again = client.post(f"{BASE}/submit", headers=headers, json=contact())
    assert (first.status_code, again.status_code) == (201, 200)
    assert first.json()["reference"] == again.json()["reference"]
    assert db.scalar(select(func.count()).select_from(Lead)) == 1

    other_headers, _ = start(client, extra("service", "audit"))
    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = sorted(
            pool.map(
                lambda _: client.post(f"{BASE}/submit", headers=other_headers, json=contact()).status_code, range(4)
            )
        )
    assert codes == [200, 200, 200, 201]
    assert db.scalar(select(func.count()).select_from(Lead)) == 2


def test_sending_is_refused_when_empty_stale_or_invalid(client, enabled, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "contact_rate_limit", 100)  # refused requests count toward the limit too
    headers, _ = start(client)

    def send(**overrides):
        return client.post(f"{BASE}/submit", headers=headers, json=contact(**overrides))

    assert send(expected_version=1).json()["code"] == "basket_empty"
    client.post(f"{BASE}/items", headers=headers, json={"expected_version": 1, "item": extra()})
    assert send(expected_version=1).json()["code"] == "basket_changed"
    assert send(privacy_acknowledged=False).status_code == 422
    assert send(email="not-an-email").status_code == 422
    assert send(goals="x" * 601).status_code == 422
    assert send(name="See https://spam.example").status_code == 422
    assert send(form_token="").status_code == 400
    honeypot = send(website="https://bot.example")
    assert honeypot.status_code == 201  # looks like success, stores nothing
    assert db.scalar(select(func.count()).select_from(Lead)) == 0
    assert db.scalar(select(QuoteBasket)).status == "open"


def test_an_item_that_no_longer_passes_the_rules_blocks_sending_until_it_is_edited(client, enabled, db):
    headers, basket = start(client, configuration())
    row = db.scalar(select(QuoteBasket))
    broken = {**row.items[0], "answers": {**row.items[0]["answers"], "features": ["shipping"]}}
    row.items = [broken]  # as if the rules had changed after the item was added
    db.commit()
    current = client.get(BASE, headers=headers).json()
    assert current["items"][0]["needs_update"] is True and current["items"][0]["review"] is None
    assert current["totals"]["one_time_from"] == 0
    assert client.post(f"{BASE}/submit", headers=headers, json=contact()).json()["code"] == "basket_needs_update"
    fixed = client.put(
        f"{BASE}/items/{basket['items'][0]['id']}",
        headers=headers,
        json={"expected_version": 2, "item": configuration()},
    )
    assert fixed.status_code == 200 and fixed.json()["items"][0]["needs_update"] is False


def test_staff_see_the_basket_on_the_lead(admin_client, enabled, db):
    headers, _ = start(admin_client, configuration())
    assert admin_client.post(f"{BASE}/submit", headers=headers, json=contact()).status_code == 201
    lead = db.scalar(select(Lead))
    detail = admin_client.get(f"/api/admin/leads/{lead.id}").json()
    assert detail["quote_basket"]["basket"]["items"][0]["review"]["package"] == "business_website"
    assert detail["quote_basket"]["basket"]["binding"] is False and detail["configurator"] is None


# --- Limits and release gate ---------------------------------------------------------------------------


def test_creating_baskets_is_rate_limited(client, enabled, monkeypatch):
    monkeypatch.setattr(get_settings(), "quote_basket_create_rate_limit", 2)
    assert [client.post(BASE, json={"locale": "bg"}).status_code for _ in range(3)] == [201, 201, 429]


def test_nothing_in_the_basket_depends_on_language_or_country(client, enabled):
    headers, _ = start(client, configuration(features=["seo"]), locale="bg")
    plain = client.get(BASE, headers=headers).json()
    for extra_headers in ({"Accept-Language": "en-GB"}, {"CF-IPCountry": "DE"}):
        assert client.get(BASE, headers=headers | extra_headers).json()["totals"] == plain["totals"]
    english_headers, english = start(client, configuration(features=["seo"]), locale="en")
    assert english["totals"] == plain["totals"]
    for function in (service.view, service.add_item, service.submit):
        assert not set(inspect.signature(function).parameters) & {"country", "ip", "market", "language"}


def test_the_new_features_cannot_start_in_production_while_the_storage_blocker_is_open(monkeypatch):
    from tests.test_security import _production

    assert release_gates.COMMERCIAL_STORAGE_DISCLOSED is False  # flip only with the approved cookie policy
    for flag in ("project_configurator_enabled", "quote_basket_enabled"):
        with pytest.raises(ValidationError) as error:
            _production(**{flag: True})
        assert "BLOCKER-COM-STORAGE-01" in str(error.value)
    assert release_gates.open_blockers(customer_accounts_enabled=False) == []
    monkeypatch.setattr(release_gates, "COMMERCIAL_STORAGE_DISCLOSED", True)
    blockers = release_gates.open_blockers(
        customer_accounts_enabled=False, project_configurator_enabled=True, quote_basket_enabled=True
    )
    assert blockers == []
    assert isinstance(_production(project_configurator_enabled=True, quote_basket_enabled=True), Settings)


def test_migration_0026_grants_the_api_role_the_table_and_the_runtime_role_nothing(db):
    from sqlalchemy import text

    def may(role: str, privilege: str) -> bool:
        return db.scalar(
            text("SELECT has_table_privilege(:role, 'quote_baskets', :privilege)"),
            {"role": role, "privilege": privilege},
        )

    for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE"):  # DELETE: the maintenance job removes expired drafts
        assert may("acs_app_api", privilege), privilege
        assert not may("acs_app_runtime", privilege), privilege
    constraints = {row[0] for row in db.execute(text("SELECT conname FROM pg_constraint"))}
    assert {"ck_quote_baskets_status", "ck_quote_baskets_locale", "ck_quote_baskets_version"} <= constraints
    indexes = {row[0] for row in db.execute(text("SELECT indexname FROM pg_indexes WHERE tablename = 'quote_baskets'"))}
    assert "ix_quote_baskets_expires" in indexes
