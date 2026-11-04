"""Client zone: roles per operation, invitations, documents, snapshots and the tax gate."""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.billing.models import BillingCustomer, BillingOffer
from app.config import Settings, get_settings
from app.db import get_sessionmaker
from app.invoicing import service as invoicing
from app.invoicing.models import AccountingDocument, BillingProfile, DocumentKind, TaxScenario
from app.models import utcnow
from app.workspace.models import CustomerWorkspace, WorkspaceInvitation
from tests.test_accounts import csrf
from tests.test_billing import PRICE as _PRICE  # noqa: F401
from tests.test_billing import FakeStripe, checkout, deliver, fake, offers, sign_up  # noqa: F401

API = "/api/zone"
PROFILE = {
    "legal_name": "Примерна Фирма ЕООД",
    "company_id": "000000000",
    "address": "ул. Примерна 1, София",
    "country": "BG",
    "email": "billing@example.com",
}


@pytest.fixture
def demo(monkeypatch, fake):  # noqa: F811
    monkeypatch.setattr(get_settings(), "invoicing_source", "demo")
    return fake


def owner_id(db):
    return db.scalars(select(CustomerWorkspace.id)).first()


def invite(client, email: str, role: str) -> str:
    response = client.post(f"{API}/invitations", json={"email": email, "role": role}, headers=csrf(client))
    assert response.status_code == 201
    return response.json()["token"]


@pytest.fixture
def team(client, fake):  # noqa: F811
    """owner@ with billing@ and member@ joined. Leaves `member@` signed in."""
    sign_up(client, fake, "owner@example.com")
    tokens = {r: invite(client, f"{r}@example.com", r) for r in ("billing", "member")}
    workspace_id = None
    for role, token in tokens.items():
        sign_up(client, fake, f"{role}@example.com")
        assert client.post(f"{API}/invitations/accept", json={"token": token}, headers=csrf(client)).status_code == 204
    with get_sessionmaker()() as session:
        owner = session.execute(
            text(
                "SELECT w.id FROM customer_workspaces w JOIN customer_accounts a ON a.id = w.owner_account_id "
                "WHERE a.email = 'owner@example.com'"
            )
        ).scalar()
        workspace_id = str(owner)
    return workspace_id


def as_workspace(workspace_id: str) -> dict[str, str]:
    return {"x-workspace": workspace_id}


def login(client, email: str) -> None:
    from tests.test_accounts import PASSWORD

    client.cookies.clear()
    assert client.post("/api/accounts/login", json={"email": email, "password": PASSWORD}).status_code == 200


# --------------------------------------------------------------------------- roles


@pytest.mark.parametrize(
    ("role", "billing_allowed", "owner_allowed"),
    [("billing", True, False), ("member", False, False)],
)
def test_each_role_gets_exactly_its_operations(client, team, role, billing_allowed, owner_allowed):
    login(client, f"{role}@example.com")
    scope = as_workspace(team)
    headers = csrf(client) | scope
    ok = client.get(f"{API}/overview", headers=scope)
    assert ok.status_code == 200 and ok.json()["role"] == role
    for path in ("/documents", "/documents/export", "/billing-profile"):
        assert (client.get(f"{API}{path}", headers=scope).status_code == 200) is billing_allowed, path
    assert (client.put(f"{API}/billing-profile", json=PROFILE, headers=headers).status_code == 204) is billing_allowed
    response = client.post(f"{API}/invitations", json={"email": "x@example.com", "role": "member"}, headers=headers)
    assert (response.status_code == 201) is owner_allowed


def test_a_member_cannot_reach_billing_routes(client, team):
    login(client, "member@example.com")
    headers = csrf(client) | as_workspace(team)
    assert client.get("/api/billing/status", headers=headers).status_code == 403
    assert client.post("/api/billing/checkout", json={"offer": "x"}, headers=headers).status_code == 403
    assert client.post("/api/billing/portal", json={}, headers=headers).status_code == 403


def test_an_outsider_cannot_name_another_workspace(client, team, fake):  # noqa: F811
    sign_up(client, fake, "stranger@example.com")
    for path in ("/overview", "/documents", "/members", "/support"):
        assert client.get(f"{API}{path}", headers=as_workspace(team)).status_code == 404, path


def test_a_removed_member_loses_access(client, team, db):
    login(client, "owner@example.com")
    members = client.get(f"{API}/members").json()
    target = next(m for m in members if m["role"] == "member")
    assert client.delete(f"{API}/members/{target['id']}", headers=csrf(client)).status_code == 204
    login(client, "member@example.com")
    assert client.get(f"{API}/overview", headers=as_workspace(team)).status_code == 404


def test_the_owner_cannot_be_removed_or_demoted(client, team):
    login(client, "owner@example.com")
    owner = next(m for m in client.get(f"{API}/members").json() if m["role"] == "owner")
    assert client.delete(f"{API}/members/{owner['id']}", headers=csrf(client)).status_code == 404
    assert (
        client.patch(f"{API}/members/{owner['id']}", json={"role": "member"}, headers=csrf(client)).status_code == 404
    )


def test_only_the_billing_owner_opens_the_portal(client, team, fake, db, offers):  # noqa: F811
    login(client, "owner@example.com")
    checkout(client)
    login(client, "billing@example.com")
    headers = csrf(client) | as_workspace(team)
    assert client.post("/api/billing/portal", json={}, headers=headers).status_code == 404
    assert fake.portals == []


# --------------------------------------------------------------------------- invitations


def test_an_invitation_works_once_and_only_for_its_email(client, fake):  # noqa: F811
    sign_up(client, fake, "owner2@example.com")
    token = invite(client, "right@example.com", "member")
    sign_up(client, fake, "wrong@acme.example")
    assert client.post(f"{API}/invitations/accept", json={"token": token}, headers=csrf(client)).status_code == 400
    sign_up(client, fake, "right@example.com")
    assert client.post(f"{API}/invitations/accept", json={"token": token}, headers=csrf(client)).status_code == 204
    assert client.post(f"{API}/invitations/accept", json={"token": token}, headers=csrf(client)).status_code == 400


def test_an_expired_invitation_is_refused_and_only_a_hash_is_stored(client, fake, db):  # noqa: F811
    sign_up(client, fake, "owner3@example.com")
    token = invite(client, "late@example.com", "member")
    row = db.scalar(select(WorkspaceInvitation))
    assert token not in row.token_hash
    row.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    sign_up(client, fake, "late@example.com")
    assert client.post(f"{API}/invitations/accept", json={"token": token}, headers=csrf(client)).status_code == 400


def test_a_company_domain_joins_nobody(client, fake, db):  # noqa: F811
    sign_up(client, fake, "boss@acme.example")
    sign_up(client, fake, "worker@acme.example")
    assert client.get(f"{API}/memberships").json()[0]["role"] == "owner"
    assert len(client.get(f"{API}/memberships").json()) == 1


# --------------------------------------------------------------------------- support


def test_support_requests_stay_in_their_workspace(client, team, fake):  # noqa: F811
    login(client, "member@example.com")
    body = {"kind": "service", "subject": "Въпрос", "message": "Имаме въпрос за договора за поддръжка."}
    headers = csrf(client) | as_workspace(team)
    assert client.post(f"{API}/support", json=body, headers=headers).status_code == 201
    assert len(client.get(f"{API}/support", headers=as_workspace(team)).json()) == 1
    sign_up(client, fake, "other@example.com")
    assert client.get(f"{API}/support").json() == []


def test_the_overview_reports_no_invented_figures(client, team):
    login(client, "owner@example.com")
    answer = client.get(f"{API}/overview").json()
    assert not {"uptime", "agent_runs", "costs"} & set(answer)


def test_answers_are_not_cached(client, team):
    login(client, "owner@example.com")
    assert client.get(f"{API}/overview").headers["cache-control"] == "no-store"
    assert client.get("/api/accounts/me").headers["cache-control"] == "no-store"


# --------------------------------------------------------------------------- documents


@pytest.fixture
def buyer(client, demo, db, offers):  # noqa: F811
    sign_up(client, demo, "buyer@example.com")
    assert client.put(f"{API}/billing-profile", json=PROFILE, headers=csrf(client)).status_code == 204
    db.add(TaxScenario(key="domestic", config={"note": "test only"}, confirmed_by="test"))
    db.commit()


def paid_invoice(demo, db, invoice_id="in_1", amount=2900) -> None:
    workspace = owner_id(db)
    customer = db.get(BillingCustomer, workspace)
    if customer is None:
        account = db.get(CustomerWorkspace, workspace).owner_account_id
        customer = BillingCustomer(workspace_id=workspace, stripe_customer_id="cus_1", billing_owner_account_id=account)
        db.add(customer)
        db.commit()
    demo.invoices[invoice_id] = {
        "status": "paid",
        "customer": customer.stripe_customer_id,
        "amount_paid": amount,
        "currency": "eur",
        "parent": {},
    }


def test_a_repeated_webhook_issues_one_document(client, buyer, demo, db):
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    deliver(client, "evt_2", "invoice.paid", "in_1")  # Stripe may send a second event for one change
    assert invoicing.issue_pending()["issued"] == 1
    assert invoicing.issue_pending()["issued"] == 0
    rows = client.get(f"{API}/documents").json()
    assert len(rows) == 1
    assert rows[0]["number"].startswith("DEMO-") and rows[0]["demo"] is True


def test_a_later_profile_change_leaves_an_issued_document_alone(client, buyer, demo, db):
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    invoicing.issue_pending()
    changed = PROFILE | {"legal_name": "Друго Име ООД"}
    assert client.put(f"{API}/billing-profile", json=changed, headers=csrf(client)).status_code == 204
    document = client.get(f"{API}/documents").json()[0]
    text_copy = client.get(f"{API}/documents/{document['id']}/download").text
    assert "Примерна Фирма ЕООД" in text_copy and "Друго Име" not in text_copy


def test_an_issued_document_cannot_be_changed_or_deleted(client, buyer, demo, db):
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    invoicing.issue_pending()
    with get_sessionmaker()() as session, pytest.raises(DBAPIError, match="cannot be changed"):
        session.execute(text("UPDATE accounting_documents SET amount_minor = 1"))
    with get_sessionmaker()() as session, pytest.raises(DBAPIError, match="permission denied"):
        session.execute(text("DELETE FROM accounting_documents"))


def test_a_demo_copy_says_so(client, buyer, demo, db):
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    invoicing.issue_pending()
    document = client.get(f"{API}/documents").json()[0]
    assert "NOT A VALID" in client.get(f"{API}/documents/{document['id']}/download").text


def test_an_unavailable_issuer_queues_and_shows_the_status(client, buyer, demo, db):
    class Down:
        name, demo = "down", False

        def issue(self, document):
            raise invoicing.IssuerUnavailable

    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    assert invoicing.issue_pending(Down())["retry"] == 1
    row = client.get(f"{API}/documents").json()[0]
    assert (row["status"], row["reason"], row["number"]) == ("queued", "issuer_unavailable", None)
    db.expire_all()
    stored = db.scalar(select(AccountingDocument))
    stored.next_attempt_at = utcnow()
    db.commit()
    assert invoicing.issue_pending()["issued"] == 1


def test_nothing_is_issued_without_an_issuer(client, buyer, demo, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "invoicing_source", "none")
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    assert invoicing.issue_pending()["blocked"] == 1
    row = client.get(f"{API}/documents").json()[0]
    assert (row["status"], row["reason"]) == ("blocked", "no_issuer_configured")


def test_a_refund_makes_a_credit_note_linked_to_its_invoice(client, buyer, demo, db):
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    invoicing.issue_pending()
    demo.payment_invoices["pi_1"] = "in_1"
    customer = db.get(BillingCustomer, owner_id(db)).stripe_customer_id
    demo.charges["ch_1"] = {
        "customer": customer,
        "payment_intent": "pi_1",
        "refunded": False,
        "amount_refunded": 1000,
        "currency": "eur",
    }
    deliver(client, "evt_2", "charge.refunded", "ch_1")
    demo.charges["ch_1"]["amount_refunded"] = 1500
    deliver(client, "evt_3", "charge.refunded", "ch_1")
    deliver(client, "evt_4", "charge.refunded", "ch_1")  # a repeat adds nothing
    invoicing.issue_pending()
    rows = client.get(f"{API}/documents").json()
    notes = [r for r in rows if r["kind"] == "credit_note"]
    invoice = next(r for r in rows if r["kind"] == "invoice")
    assert sorted(n["amount_minor"] for n in notes) == [500, 1000]
    assert all(n["parent_id"] == invoice["id"] for n in notes)


def test_a_credit_note_without_its_invoice_is_blocked_not_guessed(client, buyer, demo, db):
    paid_invoice(demo, db)
    customer = db.get(BillingCustomer, owner_id(db)).stripe_customer_id
    demo.charges["ch_1"] = {
        "customer": customer,
        "payment_intent": "pi_x",
        "refunded": True,
        "amount_refunded": 1000,
        "currency": "eur",
    }
    deliver(client, "evt_2", "charge.refunded", "ch_1")
    assert invoicing.issue_pending()["blocked"] == 1
    assert client.get(f"{API}/documents").json()[0]["reason"] == "parent_invoice_unknown"


def test_another_workspace_cannot_read_or_download_a_document(client, buyer, demo, db):
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    invoicing.issue_pending()
    document = client.get(f"{API}/documents").json()[0]
    sign_up(client, demo, "other2@example.com")
    assert client.get(f"{API}/documents/{document['id']}/download").status_code == 404
    assert client.get(f"{API}/documents").json() == []


def test_export_has_the_links_between_records(client, buyer, demo, db):
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    invoicing.issue_pending()
    exported = client.get(f"{API}/documents/export")
    assert exported.headers["cache-control"] == "no-store"
    assert "in_1" in exported.text and "DEMO-" in exported.text


def test_retention_is_written_only_when_configured(client, buyer, demo, db, monkeypatch):
    paid_invoice(demo, db)
    deliver(client, "evt_1", "invoice.paid", "in_1")
    invoicing.issue_pending()
    db.expire_all()
    assert db.scalar(select(AccountingDocument)).retain_until is None


# --------------------------------------------------------------------------- tax gate


def enforcing(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "invoicing_enforce_tax", True)


def test_checkout_needs_a_billing_profile(client, fake, offers, monkeypatch):  # noqa: F811
    enforcing(monkeypatch)
    sign_up(client, fake, "a@example.com")
    response = checkout(client)
    assert response.status_code == 409
    assert response.json()["code"] == "billing_profile_required"
    assert fake.created == []


def test_an_unconfirmed_scenario_blocks_that_sale_and_signals_staff(client, fake, offers, db, monkeypatch):  # noqa: F811
    enforcing(monkeypatch)
    sign_up(client, fake, "a@example.com")
    client.put(f"{API}/billing-profile", json=PROFILE | {"country": "DE"}, headers=csrf(client))
    db.add(TaxScenario(key="domestic", config={}, confirmed_by="test"))
    db.commit()
    response = checkout(client)
    assert response.status_code == 409
    assert response.json()["code"] == "tax_not_confirmed"
    assert fake.created == []
    assert (
        db.execute(text("SELECT count(*) FROM audit_logs WHERE action = 'invoicing.tax_scenario_missing'")).scalar()
        == 1
    )


def test_a_confirmed_scenario_allows_the_sale(client, fake, offers, db, monkeypatch):  # noqa: F811
    enforcing(monkeypatch)
    sign_up(client, fake, "a@example.com")
    client.put(f"{API}/billing-profile", json=PROFILE, headers=csrf(client))
    db.add(TaxScenario(key="domestic", config={}, confirmed_by="test"))
    db.commit()
    assert checkout(client).status_code == 200


def test_no_rate_or_number_is_invented():
    source = Path(invoicing.__file__).read_text(encoding="utf-8")
    assert "0.2" not in source and "20%" not in source and "reverse" not in source.lower()
    assert isinstance(DocumentKind.INVOICE.value, str)


def test_production_refuses_demo_documents():
    with pytest.raises(ValueError, match="INVOICING_SOURCE=demo"):
        Settings(**(get_settings().model_dump() | {"app_env": "production", "invoicing_source": "demo"}))


def test_no_offer_or_tax_scenario_is_seeded(db):
    assert db.scalars(select(TaxScenario)).all() == []
    assert db.scalars(select(BillingOffer)).all() == []
    assert db.scalars(select(BillingProfile)).all() == []


# --------------------------------------------------------------------------- Turnstile


def post_register(client):
    return client.post(
        "/api/accounts/register",
        json={"email": "t@example.com", "password": "Correct-Horse-2026", "privacy_acknowledged": True},
    )


def test_turnstile_is_checked_on_the_server(client, fake, monkeypatch):  # noqa: F811
    monkeypatch.setattr(get_settings(), "turnstile_secret_key", "secret")
    assert post_register(client).status_code == 400
    answer = MagicMock()
    answer.json.return_value = {"success": False}
    monkeypatch.setattr(httpx, "post", lambda *a, **k: answer)
    body = {"email": "t@example.com", "password": "Correct-Horse-2026", "privacy_acknowledged": True}
    assert client.post("/api/accounts/register", json=body | {"turnstile_token": "x"}).status_code == 400
    answer.json.return_value = {"success": True}
    assert client.post("/api/accounts/register", json=body | {"turnstile_token": "x"}).status_code == 202


def test_turnstile_refuses_when_cloudflare_cannot_be_reached(client, fake, monkeypatch):  # noqa: F811
    monkeypatch.setattr(get_settings(), "turnstile_secret_key", "secret")

    def down(*_a, **_k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "post", down)
    body = {"email": "t@example.com", "password": "Correct-Horse-2026", "privacy_acknowledged": True}
    assert client.post("/api/accounts/register", json=body | {"turnstile_token": "x"}).status_code == 400


def test_a_forged_forwarded_header_cannot_choose_the_address(client):
    from app.deps import client_ip

    request = MagicMock()
    request.headers = {"x-forwarded-for": "6.6.6.6, 203.0.113.9", "cf-connecting-ip": "6.6.6.6"}
    assert client_ip(request) == "203.0.113.9"  # the entry set by our own proxy
    assert json.dumps(FakeStripe.__name__)
