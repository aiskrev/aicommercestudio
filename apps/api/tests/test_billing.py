"""Stripe billing against a fake gateway. Signatures use the real Stripe library; no network is used."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import select

from app import legal
from app.billing import service
from app.billing.models import (
    BillingCheckout,
    BillingCustomer,
    BillingEvent,
    BillingIncident,
    BillingOffer,
    BillingPurchase,
    BillingSubscription,
    ScopeConfirmation,
)
from app.config import Settings, get_settings
from app.models import utcnow
from app.workspace.models import CustomerWorkspace, WorkspaceProject
from tests.test_accounts import PASSWORD, Inbox, csrf

API = "/api/billing"
ACCEPT = {
    "terms": legal.version("terms"),
    "subscription_terms": legal.version("subscription_terms"),
    "order_acceptance": legal.version("order_acceptance"),
    "privacy": legal.version("privacy"),
    "customer_kind": "consumer",
}
SECRET = "whsec_test_only"
PRICE = {"active": True, "unit_amount": 2900, "currency": "eur", "recurring": {"interval": "month"}}


class FakeStripe:
    def __init__(self) -> None:
        self.customers: list[str] = []
        self.sessions: dict[str, dict] = {}
        self.subscriptions: dict[str, dict] = {}
        self.invoices: dict[str, dict] = {}
        self.charges: dict[str, dict] = {}
        self.disputes: dict[str, dict] = {}
        self.prices: dict[str, dict] = {"price_pro": PRICE, "price_setup": PRICE | {"recurring": None}}
        self.created: list[dict] = []
        self.expired: list[str] = []
        self.portals: list[str] = []
        self.events: list[dict] = []
        self.fail_next = 0
        self.payment_invoices: dict[str, str] = {}

    def create_customer(self, workspace_id):
        self.customers.append(workspace_id)
        return f"cus_{len(self.customers)}"

    def retrieve_price(self, price_id):
        return self.prices[price_id]

    def create_checkout(self, params, idempotency_key):
        self.created.append(params | {"_key": idempotency_key})
        session_id = f"cs_{len(self.created)}"
        self.sessions[session_id] = {
            "id": session_id,
            "url": f"https://checkout.stripe.test/{session_id}",
            "status": "open",
            "mode": params["mode"],
            "payment_status": "unpaid",
        }
        return self.sessions[session_id]

    def retrieve_checkout(self, session_id):
        return self.sessions[session_id]

    def expire_checkout(self, session_id):
        self.expired.append(session_id)
        self.sessions[session_id]["status"] = "expired"

    def list_subscriptions(self, customer_id):
        return [s for s in self.subscriptions.values() if s["customer"] == customer_id]

    def retrieve_subscription(self, subscription_id):
        if self.fail_next:
            self.fail_next -= 1
            raise ConnectionError("stripe is down")
        return self.subscriptions[subscription_id]

    def retrieve_invoice(self, invoice_id):
        return self.invoices[invoice_id]

    def retrieve_charge(self, charge_id):
        return self.charges[charge_id]

    def retrieve_dispute(self, dispute_id):
        return self.disputes[dispute_id]

    def create_portal(self, customer_id, return_url):
        self.portals.append(customer_id)
        return f"https://billing.stripe.test/{customer_id}"

    def list_events(self, types, since):
        return self.events

    def invoice_for_payment(self, payment_intent):
        return self.payment_invoices.get(payment_intent)


@pytest.fixture
def fake(monkeypatch) -> FakeStripe:
    stripe = FakeStripe()
    box = Inbox()
    settings = get_settings()
    for name, value in {
        "customer_accounts_enabled": True,
        "advisor_workspace_enabled": True,
        "billing_provider": "stripe",
        "stripe_secret_key": "sk_test_only",
        "stripe_webhook_secret": SECRET,
        "email_provider": "smtp",
        "smtp_host": "mail.test",
        "smtp_from": "no-reply@example.com",
        "invoicing_enforce_tax": False,
    }.items():
        monkeypatch.setattr(settings, name, value)
    monkeypatch.setattr("app.accounts.mail.get_sender", lambda *_: box)
    monkeypatch.setattr("app.billing.service.get_gateway", lambda: stripe)
    stripe.box = box
    return stripe


def sign_up(client, fake: FakeStripe, email: str) -> None:
    client.cookies.clear()
    client.post("/api/accounts/register", json={"email": email, "password": PASSWORD, "privacy_acknowledged": True})
    client.post("/api/accounts/verification/confirm", json={"token": fake.box.last_token()})
    assert client.post("/api/accounts/login", json={"email": email, "password": PASSWORD}).status_code == 200
    assert client.get("/api/workspace/me").status_code == 200


@pytest.fixture
def offers(db) -> None:
    db.add_all(
        [
            BillingOffer(
                key="pro_monthly",
                kind="subscription",
                plan_key="pro",
                billing_interval="month",
                stripe_price_id="price_pro",
                currency="eur",
                amount_minor=2900,
                approved_at=utcnow(),
            ),
            BillingOffer(
                key="support_setup",
                kind="one_time",
                stripe_price_id="price_setup",
                currency="eur",
                amount_minor=2900,
                requires_scope=True,
                approved_at=utcnow(),
            ),
        ]
    )
    db.commit()


@pytest.fixture
def user(client, fake, offers) -> None:
    sign_up(client, fake, "buyer@example.com")


def checkout(client, offer="pro_monthly"):
    return client.post(f"{API}/checkout", json={"offer": offer, "acceptance": ACCEPT}, headers=csrf(client))


def plan_of(client) -> str:
    return client.get("/api/workspace/me").json()["plan"]


def workspace(db) -> CustomerWorkspace:
    return db.scalars(select(CustomerWorkspace)).first()


def subscription(fake: FakeStripe, db, status="active", **extra) -> dict:
    row = workspace(db)
    customer = db.get(BillingCustomer, row.id).stripe_customer_id
    data = {
        "id": "sub_1",
        "customer": customer,
        "status": status,
        "metadata": {"workspace_id": str(row.id), "offer_key": "pro_monthly"},
        "items": {"data": [{"current_period_end": int(time.time()) + 86400}]},
    } | extra
    fake.subscriptions["sub_1"] = data
    return data


def signed(payload: bytes, secret: str = SECRET, at: int | None = None) -> dict[str, str]:
    stamp = at or int(time.time())
    digest = hmac.new(secret.encode(), f"{stamp}.".encode() + payload, hashlib.sha256).hexdigest()
    return {"stripe-signature": f"t={stamp},v1={digest}", "content-type": "application/json"}


def deliver(client, event_id: str, kind: str, object_id: str, livemode: bool = False):
    body = json.dumps(
        {
            "id": event_id,
            "object": "event",
            "type": kind,
            "livemode": livemode,
            "data": {"object": {"id": object_id, "object": "x"}},
        }
    ).encode()
    return client.post(f"{API}/stripe/webhook", content=body, headers=signed(body))


def run_events(fake) -> dict:
    return service.process_pending(fake)


# --------------------------------------------------------------------------- gates


def test_everything_is_hidden_while_off(client):
    assert client.post(f"{API}/stripe/webhook", content=b"{}").status_code == 404
    assert client.get(f"{API}/offers").status_code == 404


@pytest.mark.parametrize(
    ("changes", "problem"),
    [
        ({"billing_provider": "stripe"}, "BILLING_PROVIDER=stripe"),
    ],
)
def test_production_refuses_stripe_for_now(changes, problem):
    with pytest.raises(ValueError, match=problem):
        Settings(**(get_settings().model_dump() | {"app_env": "production"} | changes))


def test_a_live_key_is_refused_everywhere():
    base = get_settings().model_dump() | {"billing_provider": "stripe", "stripe_secret_key": "sk_live_abc"}
    with pytest.raises(ValueError, match="test key"):
        Settings(**base)


def test_nothing_is_on_sale_without_approval(client, fake, db):
    sign_up(client, fake, "a@example.com")
    assert client.get(f"{API}/offers").json() == []
    db.add(
        BillingOffer(
            key="draft",
            kind="subscription",
            plan_key="pro",
            billing_interval="year",
            stripe_price_id="price_x",
            currency="eur",
            amount_minor=1,
        )
    )
    db.commit()
    assert client.get(f"{API}/offers").json() == []
    assert checkout(client, "draft").status_code == 404


# --------------------------------------------------------------------------- checkout


def test_the_browser_chooses_an_offer_and_nothing_else(client, user, fake):
    body = {"offer": "pro_monthly", "acceptance": ACCEPT, "price": "price_cheap", "amount": 1}
    assert client.post(f"{API}/checkout", json=body, headers=csrf(client)).status_code == 422
    assert checkout(client).status_code == 200
    params = fake.created[0]
    assert params["line_items"] == [{"price": "price_pro", "quantity": 1}]
    assert "payment_method_types" not in params  # Stripe decides what is really available
    assert params["customer"] == "cus_1" and "customer_email" not in params
    assert params["metadata"]["workspace_id"] == params["subscription_data"]["metadata"]["workspace_id"]


def test_a_price_changed_in_stripe_stops_the_sale(client, user, fake):
    fake.prices["price_pro"] = PRICE | {"unit_amount": 100}
    response = checkout(client)
    assert response.status_code == 409
    assert response.json()["code"] == "offer_unavailable"
    assert fake.created == []


def test_checkout_needs_a_session_and_csrf(client, fake, offers):
    assert client.post(f"{API}/checkout", json={"offer": "pro_monthly"}).status_code == 401
    sign_up(client, fake, "a@example.com")
    assert client.post(f"{API}/checkout", json={"offer": "pro_monthly"}).status_code == 403


def test_returning_from_checkout_grants_nothing(client, user, fake, db):
    checkout(client)
    fake.sessions["cs_1"] |= {"status": "complete", "payment_status": "paid"}
    assert plan_of(client) == "free"
    assert db.scalars(select(BillingSubscription)).all() == []


def test_session_completed_alone_does_not_activate(client, user, fake, db):
    checkout(client)
    subscription(fake, db, status="incomplete")
    fake.sessions["cs_1"] |= {"status": "complete", "subscription": "sub_1"}
    deliver(client, "evt_1", "checkout.session.completed", "cs_1")
    assert plan_of(client) == "free"
    assert db.scalar(select(BillingSubscription)).status == "incomplete"


def test_an_active_subscription_activates_the_plan(client, user, fake, db):
    checkout(client)
    subscription(fake, db)
    deliver(client, "evt_1", "customer.subscription.created", "sub_1")
    assert plan_of(client) == "pro"


def test_no_second_subscription_even_before_the_webhook_arrives(client, user, fake, db):
    checkout(client)
    subscription(fake, db)
    second = checkout(client)
    assert second.status_code == 409
    assert second.json()["code"] == "subscription_exists"


def test_a_second_tab_reuses_the_open_checkout(client, user, fake):
    first, second = checkout(client).json(), checkout(client).json()
    assert first["url"] == second["url"] and second["reused"] is True
    assert len(fake.created) == 1


def test_parallel_clicks_open_one_checkout(client, user, fake):
    headers = csrf(client)

    def call(_):
        return client.post(
            f"{API}/checkout", json={"offer": "pro_monthly", "acceptance": ACCEPT}, headers=headers
        ).status_code

    with ThreadPoolExecutor(max_workers=5) as pool:
        assert set(pool.map(call, range(5))) == {200}
    assert len(fake.created) == 1
    assert len(fake.customers) == 1


def test_individual_support_needs_a_confirmed_scope(client, user, fake, db):
    refused = checkout(client, "support_setup")
    assert refused.status_code == 409
    assert refused.json()["code"] == "scope_not_confirmed"
    db.add(ScopeConfirmation(workspace_id=workspace(db).id, offer_key="support_setup", confirmed_by="staff"))
    db.commit()
    assert checkout(client, "support_setup").status_code == 200


# --------------------------------------------------------------------------- one-time purchase


def paid_purchase(client, fake, db) -> None:
    db.add(ScopeConfirmation(workspace_id=workspace(db).id, offer_key="support_setup", confirmed_by="staff"))
    db.commit()
    checkout(client, "support_setup")
    fake.sessions["cs_1"] |= {"status": "complete", "payment_status": "paid", "payment_intent": "pi_1"}
    deliver(client, "evt_1", "checkout.session.completed", "cs_1")


def test_purchase_keeps_payment_and_onboarding_apart(client, user, fake, db):
    paid_purchase(client, fake, db)
    row = client.get(f"{API}/status").json()["purchases"][0]
    assert (row["payment_status"], row["access_active"], row["onboarding_status"]) == ("paid", True, "pending")


def test_a_delayed_payment_gives_no_access_until_it_succeeds(client, user, fake, db):
    db.add(ScopeConfirmation(workspace_id=workspace(db).id, offer_key="support_setup", confirmed_by="staff"))
    db.commit()
    checkout(client, "support_setup")
    fake.sessions["cs_1"] |= {"status": "complete", "payment_status": "unpaid", "payment_intent": "pi_1"}
    deliver(client, "evt_1", "checkout.session.completed", "cs_1")
    assert client.get(f"{API}/status").json()["purchases"][0]["access_active"] is False
    fake.sessions["cs_1"]["payment_status"] = "paid"
    deliver(client, "evt_2", "checkout.session.async_payment_succeeded", "cs_1")
    assert client.get(f"{API}/status").json()["purchases"][0]["access_active"] is True


def test_a_full_refund_ends_access_and_deletes_no_data(client, user, fake, db):
    project = WorkspaceProject(workspace_id=workspace(db).id, name="Запазен")
    db.add(project)
    db.commit()
    paid_purchase(client, fake, db)
    customer = db.get(BillingCustomer, workspace(db).id).stripe_customer_id
    fake.charges["ch_1"] = {
        "customer": customer,
        "payment_intent": "pi_1",
        "refunded": True,
        "amount_refunded": 2900,
    }
    deliver(client, "evt_2", "charge.refunded", "ch_1")
    row = client.get(f"{API}/status").json()["purchases"][0]
    assert (row["payment_status"], row["access_active"]) == ("refunded", False)
    db.expire_all()
    assert db.get(WorkspaceProject, project.id) is not None
    assert db.get(BillingIncident, "ch_1").status == "full"


def test_a_partial_refund_keeps_access(client, user, fake, db):
    paid_purchase(client, fake, db)
    fake.charges["ch_1"] = {"customer": None, "payment_intent": "pi_1", "refunded": False, "amount_refunded": 100}
    deliver(client, "evt_2", "charge.refunded", "ch_1")
    row = client.get(f"{API}/status").json()["purchases"][0]
    assert (row["payment_status"], row["access_active"]) == ("partially_refunded", True)


def test_a_dispute_changes_access_only_when_lost(client, user, fake, db):
    paid_purchase(client, fake, db)
    fake.disputes["dp_1"] = {"payment_intent": "pi_1", "status": "needs_response", "amount": 2900}
    deliver(client, "evt_2", "charge.dispute.created", "dp_1")
    assert client.get(f"{API}/status").json()["purchases"][0]["access_active"] is True
    fake.disputes["dp_1"]["status"] = "lost"
    deliver(client, "evt_3", "charge.dispute.closed", "dp_1")
    row = client.get(f"{API}/status").json()["purchases"][0]
    assert (row["payment_status"], row["access_active"]) == ("dispute_lost", False)


# --------------------------------------------------------------------------- subscription lifecycle


@pytest.fixture
def subscribed(client, user, fake, db) -> None:
    checkout(client)
    subscription(fake, db)
    deliver(client, "evt_start", "customer.subscription.created", "sub_1")
    assert plan_of(client) == "pro"


def update(client, fake, event: str, **changes) -> None:
    fake.subscriptions["sub_1"] |= changes
    deliver(client, event, "customer.subscription.updated", "sub_1")


def test_additional_authentication_is_reported_and_gives_no_access(client, user, fake, db):
    checkout(client)
    subscription(fake, db, status="incomplete", latest_invoice="in_1")
    fake.invoices["in_1"] = {"status": "open", "parent": {"subscription_details": {"subscription": "sub_1"}}}
    deliver(client, "evt_1", "invoice.payment_action_required", "in_1")
    assert client.get(f"{API}/status").json()["subscriptions"][0]["action_required"] is True
    assert plan_of(client) == "free"


def test_renewal_keeps_access_and_moves_the_period(client, subscribed, fake, db):
    later = int(time.time()) + 86400 * 30
    fake.invoices["in_2"] = {"status": "paid", "parent": {"subscription_details": {"subscription": "sub_1"}}}
    fake.subscriptions["sub_1"]["items"] = {"data": [{"current_period_end": later}]}
    deliver(client, "evt_2", "invoice.paid", "in_2")
    db.expire_all()
    assert int(db.scalar(select(BillingSubscription)).current_period_end.timestamp()) == later
    assert plan_of(client) == "pro"


def test_a_failed_payment_keeps_access_through_the_grace_period_only(client, subscribed, fake, db):
    update(client, fake, "evt_2", status="past_due")
    assert plan_of(client) == "pro"
    row = db.scalar(select(BillingSubscription))
    row.past_due_since = utcnow() - timedelta(days=get_settings().billing_grace_days + 1)
    db.commit()
    update(client, fake, "evt_3", status="past_due")
    assert plan_of(client) == "free"


def test_payment_after_past_due_restores_access(client, subscribed, fake, db):
    update(client, fake, "evt_2", status="past_due")
    update(client, fake, "evt_3", status="active")
    db.expire_all()
    assert db.scalar(select(BillingSubscription)).past_due_since is None
    assert plan_of(client) == "pro"


def test_cancel_at_period_end_keeps_access_until_it_ends(client, subscribed, fake, db):
    update(client, fake, "evt_2", cancel_at_period_end=True)
    assert client.get(f"{API}/status").json()["subscriptions"][0]["cancel_at_period_end"] is True
    assert plan_of(client) == "pro"
    fake.subscriptions["sub_1"]["status"] = "canceled"
    deliver(client, "evt_3", "customer.subscription.deleted", "sub_1")
    assert plan_of(client) == "free"


def test_unpaid_removes_access_and_keeps_projects(client, subscribed, fake, db):
    project = WorkspaceProject(workspace_id=workspace(db).id, name="Запазен")
    db.add(project)
    db.commit()
    update(client, fake, "evt_2", status="unpaid")
    assert plan_of(client) == "free"
    db.expire_all()
    assert db.get(WorkspaceProject, project.id) is not None


def test_a_refund_on_a_subscription_is_recorded_and_access_follows_stripe(client, subscribed, fake, db):
    fake.charges["ch_2"] = {
        "customer": db.get(BillingCustomer, workspace(db).id).stripe_customer_id,
        "payment_intent": "pi_sub",
        "refunded": True,
        "amount_refunded": 2900,
    }
    deliver(client, "evt_2", "charge.refunded", "ch_2")
    assert db.get(BillingIncident, "ch_2").workspace_id == workspace(db).id
    assert plan_of(client) == "pro"


def test_a_manual_grant_is_not_overwritten(client, subscribed, fake, db):
    from app.workspace import entitlements

    entitlements.grant(db, workspace(db).id, "custom", "manual")
    db.commit()
    update(client, fake, "evt_2", status="canceled")
    assert plan_of(client) == "custom"


# --------------------------------------------------------------------------- portal


def test_portal_opens_only_for_the_billing_owner(client, subscribed, fake):
    assert client.post(f"{API}/portal", json={}, headers=csrf(client)).status_code == 200
    assert fake.portals == ["cus_1"]
    sign_up(client, fake, "other@example.com")
    assert client.post(f"{API}/portal", json={}, headers=csrf(client)).status_code == 404
    assert fake.portals == ["cus_1"]


def test_portal_refuses_a_workspace_with_no_customer(client, user):
    assert client.post(f"{API}/portal", json={}, headers=csrf(client)).status_code == 404


# --------------------------------------------------------------------------- webhooks


def test_a_bad_signature_is_refused_and_stored_nowhere(client, user, db):
    body = b'{"id":"evt_x","type":"invoice.paid","data":{"object":{"id":"in_1"}}}'
    assert client.post(f"{API}/stripe/webhook", content=body, headers=signed(body, "whsec_wrong")).status_code == 400
    assert client.post(f"{API}/stripe/webhook", content=body).status_code == 400
    assert db.scalars(select(BillingEvent)).all() == []


def test_an_old_signature_is_refused(client, user):
    body = b'{"id":"evt_x","type":"invoice.paid","data":{"object":{"id":"in_1"}}}'
    stale = signed(body, at=int(time.time()) - 3600)
    assert client.post(f"{API}/stripe/webhook", content=body, headers=stale).status_code == 400


def test_a_live_event_is_refused_in_test_mode(client, user, db):
    assert deliver(client, "evt_live", "invoice.paid", "in_1", livemode=True).status_code == 400
    assert db.scalars(select(BillingEvent)).all() == []


def test_a_repeated_event_is_stored_once(client, subscribed, db, fake):
    calls = []
    original = fake.retrieve_subscription
    fake.retrieve_subscription = lambda i: calls.append(i) or original(i)
    for _ in range(3):
        assert deliver(client, "evt_same", "customer.subscription.updated", "sub_1").status_code == 200
    assert len(calls) == 1
    db.expire_all()
    assert db.get(BillingEvent, "evt_same").status == "processed"


def test_parallel_deliveries_of_one_event_are_stored_once(client, subscribed, db):
    with ThreadPoolExecutor(max_workers=5) as pool:
        codes = list(pool.map(lambda _: deliver(client, "evt_p", "invoice.paid", "in_none").status_code, range(5)))
    assert set(codes) == {200}
    assert len(db.scalars(select(BillingEvent).where(BillingEvent.id == "evt_p")).all()) == 1


def test_events_out_of_order_end_on_the_true_state(client, subscribed, fake):
    fake.subscriptions["sub_1"]["status"] = "canceled"
    deliver(client, "evt_late_cancel", "customer.subscription.deleted", "sub_1")
    deliver(client, "evt_old_update", "customer.subscription.updated", "sub_1")  # written before the cancel
    assert plan_of(client) == "free"


def test_a_failed_processing_retries_and_then_succeeds(client, user, fake, db):
    checkout(client)
    subscription(fake, db)
    fake.fail_next = 1
    assert deliver(client, "evt_1", "customer.subscription.created", "sub_1").status_code == 200
    db.expire_all()
    row = db.get(BillingEvent, "evt_1")
    assert (row.status, row.attempts, row.last_error) == ("received", 1, "ConnectionError")
    assert plan_of(client) == "free"
    row.next_attempt_at = utcnow()
    db.commit()
    assert run_events(fake)["processed"] == 1
    assert plan_of(client) == "pro"


def test_a_subscription_with_a_foreign_owner_is_never_attached(client, user, fake, db):
    checkout(client)
    subscription(
        fake, db, metadata={"workspace_id": "00000000-0000-0000-0000-000000000000", "offer_key": "pro_monthly"}
    )
    deliver(client, "evt_1", "customer.subscription.created", "sub_1")
    assert plan_of(client) == "free"
    assert db.scalars(select(BillingSubscription)).all() == []


def test_unknown_event_types_are_ignored(client, user, db):
    assert deliver(client, "evt_x", "customer.created", "cus_1").status_code == 200
    assert db.scalars(select(BillingEvent)).all() == []


def test_events_keep_no_payload_and_the_tables_hold_no_card_data(db):
    columns = " ".join(
        column.name
        for model in (BillingEvent, BillingCheckout, BillingPurchase, BillingSubscription, BillingCustomer)
        for column in model.__table__.columns
    )
    for word in ("payload", "card", "cvc", "cvv", "pan"):
        assert word not in columns.split()


# --------------------------------------------------------------------------- reconciliation


def test_reconciliation_recovers_a_missed_webhook(client, user, fake, db):
    checkout(client)
    subscription(fake, db)
    fake.events = [
        {"id": "evt_missed", "type": "customer.subscription.created", "data": {"object": {"id": "sub_1"}}},
    ]
    assert plan_of(client) == "free"
    assert service.reconcile(fake)["events_added"] == 1
    assert plan_of(client) == "pro"


def test_reconciliation_corrects_drift(client, subscribed, fake):
    fake.subscriptions["sub_1"]["status"] = "canceled"  # the event never arrived
    assert service.reconcile(fake)["subscriptions"] == 1
    assert plan_of(client) == "free"


def test_reconciliation_ends_an_expired_grace_period(client, subscribed, fake, db):
    update(client, fake, "evt_2", status="past_due")
    row = db.scalar(select(BillingSubscription))
    row.past_due_since = utcnow() - timedelta(days=30)
    db.commit()
    service.reconcile(fake)
    assert plan_of(client) == "free"


def test_reconciliation_reports_duplicates(client, subscribed, fake, db):
    db.add(
        BillingSubscription(
            stripe_subscription_id="sub_2",
            workspace_id=workspace(db).id,
            offer_key="pro_monthly",
            status="active",
        )
    )
    db.commit()
    fake.subscriptions["sub_2"] = fake.subscriptions["sub_1"] | {"id": "sub_2"}
    assert service.reconcile(fake)["duplicates"] == 1
