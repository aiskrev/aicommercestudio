"""Gaps of the Stripe sandbox matrix (docs/BILLING_SANDBOX_MATRIX.md): kinds of sale, declined payment, ownership.

No network is used and no Stripe key: the fake gateway of `test_billing.py` stands in. The matrix itself is a document
that maps every case to the test that covers it; these tests cover what the existing suite did not.
"""

# ruff: noqa: E501, F811  (long, readable assertions; fixtures imported from test_billing are used as arguments)
from __future__ import annotations

import ast
from pathlib import Path

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.billing.models import BillingOffer, BillingPurchase, OfferCategory
from app.models import utcnow
from tests.test_accounts import csrf
from tests.test_billing import (  # noqa: F401  (the fake gateway and helpers of the billing suite)
    ACCEPT,
    API,
    checkout,
    deliver,
    fake,
    offers,
    plan_of,
    sign_up,
    subscribed,
    subscription,
    user,
    workspace,
)

APP = Path(__file__).resolve().parents[1] / "app"


# --- The four kinds of sale stay apart -------------------------------------------------------------------------------


def test_the_category_follows_the_shape_and_is_shown_to_the_buyer(client, user, db):
    categories = {offer.key: offer.category for offer in db.scalars(select(BillingOffer)).all()}
    assert categories == {"pro_monthly": "saas_subscription", "support_setup": "one_time_service"}
    shown = {item["key"]: item["category"] for item in client.get(f"{API}/offers").json()}
    assert shown == categories
    assert {c.value for c in OfferCategory} == {
        "saas_subscription",
        "managed_service",
        "one_time_service",
        "project_deposit",
    }


def test_a_subscription_that_needs_a_scope_is_a_managed_service(db):
    db.add(
        BillingOffer(
            key="managed",
            kind="subscription",
            plan_key="pro",
            billing_interval="month",
            stripe_price_id="price_m",
            currency="eur",
            amount_minor=9900,
            requires_scope=True,
        )
    )
    db.commit()
    assert db.get(BillingOffer, "managed").category == "managed_service"


def test_a_project_deposit_can_never_be_approved_and_is_never_sold(client, fake, offers, db):
    db.add(
        BillingOffer(
            key="deposit",
            kind="one_time",
            stripe_price_id="price_setup2",
            currency="eur",
            amount_minor=50000,
            category="project_deposit",
        )
    )
    db.commit()
    for statement in (
        "UPDATE billing_offers SET approved_at = now() WHERE key = 'deposit'",
        "INSERT INTO billing_offers (key, kind, stripe_price_id, currency, amount_minor, category, approved_at) VALUES ('d2', 'one_time', 'price_d2', 'eur', 1, 'project_deposit', now())",
        "UPDATE billing_offers SET category = 'gift_card' WHERE key = 'deposit'",
    ):
        with pytest.raises(DBAPIError):
            db.execute(text(statement))
        db.rollback()
    # Not even a direct attempt through the service gets to Stripe: an approved deposit is impossible, and an unapproved one is unavailable.
    sign_up(client, fake, "deposit@example.com")
    refused = checkout(client, "deposit")
    assert refused.status_code == 404 and refused.json()["code"] == "offer_unavailable"
    assert fake.created == [] and fake.customers == []
    listed = [item["key"] for item in client.get(f"{API}/offers").json()]
    assert "deposit" not in listed


def test_the_service_refuses_a_deposit_even_if_the_database_rule_were_gone(client, fake, offers, db, monkeypatch):
    """Belt and braces: the checkout itself refuses the category."""
    fake.prices["price_dep"] = fake.prices["price_setup"]
    name = db.scalar(
        text(
            "SELECT conname FROM pg_constraint WHERE conrelid = 'billing_offers'::regclass"
            " AND conname LIKE '%deposit_never_approved'"
        )
    )
    definition = db.scalar(text("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = :n"), {"n": name})
    db.execute(text(f'ALTER TABLE billing_offers DROP CONSTRAINT "{name}"'))
    db.commit()
    try:
        db.add(
            BillingOffer(
                key="deposit",
                kind="one_time",
                stripe_price_id="price_dep",
                currency="eur",
                amount_minor=2900,
                category="project_deposit",
                approved_at=utcnow(),
            )
        )
        db.commit()
        sign_up(client, fake, "deposit2@example.com")
        refused = checkout(client, "deposit")
        assert refused.status_code == 409 and refused.json()["code"] == "category_not_released"
        assert fake.created == []
    finally:
        db.rollback()
        db.execute(text("DELETE FROM billing_offers WHERE key = 'deposit'"))
        db.execute(text(f'ALTER TABLE billing_offers ADD CONSTRAINT "{name}" {definition}'))
        db.commit()


def test_the_cli_refuses_to_approve_a_deposit(db, monkeypatch, capsys):
    from app import cli

    class Gateway:
        def retrieve_price(self, _price):
            return {"currency": "eur", "unit_amount": 50000, "recurring": None}

    monkeypatch.setattr(cli, "get_gateway", lambda: Gateway())
    refused = cli.main(
        ["billing-offer", "--key", "dep", "--price", "price_dep", "--category", "project_deposit", "--approve"]
    )
    assert refused == 1
    assert "cannot be approved" in capsys.readouterr().out
    assert db.get(BillingOffer, "dep") is None
    plain = cli.main(["billing-offer", "--key", "dep", "--price", "price_dep", "--category", "project_deposit"])
    assert plain == 0
    db.expire_all()
    assert db.get(BillingOffer, "dep").category == "project_deposit" and db.get(BillingOffer, "dep").approved_at is None


# --- Declined payment and ownership ------------------------------------------------------------------------------------


def test_a_declined_first_payment_changes_no_plan_and_leaves_no_purchase(client, user, fake, db):
    checkout(client)
    subscription(fake, db, status="incomplete", latest_invoice="in_1")
    fake.invoices["in_1"] = {"status": "open", "parent": {"subscription_details": {"subscription": "sub_1"}}}
    assert deliver(client, "evt_1", "invoice.payment_failed", "in_1").status_code == 200
    from tests.test_billing import run_events

    run_events(fake)
    assert plan_of(client) == "free"
    fake.subscriptions["sub_1"]["status"] = "incomplete_expired"
    deliver(client, "evt_2", "customer.subscription.updated", "sub_1")
    assert plan_of(client) == "free"
    assert db.scalars(select(BillingPurchase)).all() == []
    status = client.get(f"{API}/status").json()
    assert all(item["status"] != "active" for item in status.get("subscriptions", []))


def test_a_payment_that_failed_asynchronously_gives_no_access(client, user, fake, db):
    checkout(client)
    session = next(iter(fake.sessions.values()))
    fake.sessions[session["id"]] = session | {"status": "complete", "payment_status": "unpaid"}
    assert plan_of(client) == "free"
    assert db.scalars(select(BillingPurchase)).all() == []


def test_another_account_cannot_reach_a_workspace_it_does_not_belong_to(client, subscribed, fake, db):
    ws = workspace(db)
    sign_up(client, fake, "intruder@example.com")
    own = client.get("/api/workspace/me").json()
    assert own["plan"] == "free"
    foreign = {"X-Workspace": str(ws.id)}
    assert client.get(f"{API}/status", headers=foreign).status_code in (403, 404)
    assert client.post(f"{API}/portal", json={}, headers={**csrf(client), **foreign}).status_code in (403, 404)
    assert client.post(
        f"{API}/checkout", json={"offer": "pro_monthly", "acceptance": ACCEPT}, headers={**csrf(client), **foreign}
    ).status_code in (403, 404)
    assert fake.portals == [] and len(fake.created) == 1  # only the first buyer's checkout ever reached the gateway


def test_a_price_that_differs_from_stripe_stops_the_sale_and_the_browser_cannot_name_one(client, user, fake):
    fake.prices["price_pro"] = {**fake.prices["price_pro"], "unit_amount": 1}
    refused = checkout(client)
    assert refused.status_code == 409 and fake.created == []
    sent = client.post(
        f"{API}/checkout",
        json={"offer": "pro_monthly", "acceptance": ACCEPT, "amount": 1, "price": "price_x"},
        headers=csrf(client),
    )
    assert sent.status_code == 422


# --- An indicative quote never becomes a price -------------------------------------------------------------------------


FORBIDDEN = (
    "app.quotations",
    "app.quotes",
    "app.configurator",
    "app.pricing",
    "app.projects",
    "app.opportunities",
    "app.crm",
)


def _imports(path: Path) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
            found.update(f"{node.module}.{alias.name}" for alias in node.names)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found


def test_billing_never_imports_a_quotation_a_basket_a_configurator_or_a_price_schedule():
    for module in (*sorted((APP / "billing").glob("*.py")), APP / "routers" / "billing.py"):
        imports = _imports(module)
        bad = sorted(name for name in imports if name.startswith(FORBIDDEN))
        assert bad == [], f"{module.name} imports {bad}: an indicative quote must never become a price"


def test_the_sale_has_no_route_that_takes_an_amount_a_basket_or_a_quotation():
    from app.main import app

    names = set()
    for route in _walk(app.routes):
        if route[0].startswith("/api/billing"):
            names.add(route[0])
    assert names, "billing routes were not found"
    assert not any(part in path for path in names for part in ("quot", "basket", "configur", "deposit"))


def _walk(routes, prefix=""):
    for route in routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            yield prefix + route.path, route
        elif hasattr(route, "original_router"):
            yield from _walk(route.original_router.routes, prefix + route.include_context.prefix)
