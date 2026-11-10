# ruff: noqa: F811
"""Legal evidence and workflows: versions, consent history, order acceptance, withdrawal and data rights."""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app import legal
from app.accounts import limits
from app.accounts.mail import dispatch_pending
from app.accounts.models import CustomerAccount, OutboxMessage
from app.billing.models import BillingCheckout, BillingSubscription
from app.compliance import service
from app.compliance.models import DataRequest, LegalEvent, WithdrawalRequest
from app.config import get_settings
from app.models import AuditLog, Lead, utcnow
from app.workspace.models import CustomerWorkspace
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD
from tests.test_accounts import csrf
from tests.test_billing import (  # noqa: F401  (fixtures)
    ACCEPT,
    API,
    deliver,
    fake,
    offers,
    paid_purchase,
    sign_up,
    subscription,
    user,
    workspace,
)

WEB_COPY = Path(__file__).resolve().parents[2] / "web" / "src" / "lib" / "legal-versions.json"
STATEMENT = "Откажете ли договора? Да, отказвам се от покупката с това изявление."


@pytest.fixture
def staff(admin_user) -> TestClient:
    """A staff session in its own browser, so it does not share cookies with the customer under test."""
    from app.main import app

    with TestClient(app) as browser:
        response = browser.post("/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert response.status_code == 200, response.text
        browser.headers["X-CSRF-Token"] = browser.cookies.get(get_settings().csrf_cookie_name)
        yield browser


def events(db, **filters) -> list[LegalEvent]:
    db.expire_all()
    query = select(LegalEvent)
    for name, value in filters.items():
        query = query.where(getattr(LegalEvent, name) == value)
    return service.in_reading_order(db.scalars(query).all())


def complete_subscription(client, fake, db, *, accept=None) -> str:
    body = {"offer": "pro_monthly", "acceptance": accept or ACCEPT}
    assert client.post(f"{API}/checkout", json=body, headers=csrf(client)).status_code == 200
    subscription(fake, db)
    fake.sessions["cs_1"] |= {"status": "complete", "subscription": "sub_1"}
    deliver(client, "evt_1", "checkout.session.completed", "cs_1")
    return "sub_1"


# ------------------------------------------------------------------------------------------- versions


def test_the_api_registry_is_the_web_registry():
    if not WEB_COPY.exists():  # the API image alone has no web app; scripts/test.ps1 and CI compare the two files
        pytest.skip("web copy not mounted")
    assert json.loads(WEB_COPY.read_text(encoding="utf-8")) == json.loads(
        Path(legal.__file__).with_name("legal_versions.json").read_text(encoding="utf-8")
    )


def test_recorded_versions_default_to_the_published_ones():
    settings = get_settings()
    assert settings.privacy_notice_version == legal.version("privacy")
    assert settings.marketing_consent_version == legal.version("marketing_consent")
    for key in legal.registry():
        assert legal.registry()[key]["review"] in ("reviewed", "pending_lawyer_review")


# ------------------------------------------------------------------------------------------- consent history


def test_an_inquiry_records_the_acknowledgement_and_only_a_given_consent(make_lead, db):
    make_lead(email="plain@example.com", marketing_consent=False)
    make_lead(email="consent@example.com", marketing_consent=True)
    leads = {lead.email: lead for lead in db.scalars(select(Lead))}
    first = events(db, lead_id=leads["plain@example.com"].id)
    second = events(db, lead_id=leads["consent@example.com"].id)
    assert [(e.document, e.action, e.version) for e in first] == [("privacy", "acknowledged", legal.version("privacy"))]
    assert [(e.document, e.action) for e in second] == [("privacy", "acknowledged"), ("marketing_consent", "consented")]
    assert second[1].version == legal.version("marketing_consent")


def test_marketing_consent_is_never_required(make_lead, client):
    from tests.conftest import lead_payload

    response = client.post(
        "/api/public/leads", json=lead_payload(marketing_consent=False, email="optional@example.com")
    )
    assert response.status_code == 201
    missing = lead_payload(email="nopriv@example.com") | {"privacy_acknowledged": False}
    assert client.post("/api/public/leads", json=missing).status_code == 422


def test_staff_withdraw_a_leads_marketing_consent_and_the_history_stays(make_lead, staff, db):
    make_lead(email="gives@example.com", marketing_consent=True)
    lead = db.scalar(select(Lead).where(Lead.email == "gives@example.com"))
    url = f"/api/admin/compliance/leads/{lead.id}/marketing-consent/withdraw"
    assert staff.post(url).status_code == 204
    assert staff.post(url).status_code == 204  # idempotent
    db.expire_all()
    lead = db.get(Lead, lead.id)
    assert lead.marketing_consent is False and lead.marketing_consent_withdrawn_at is not None
    history = [(e.document, e.action) for e in events(db, lead_id=lead.id)]
    assert history == [
        ("privacy", "acknowledged"),
        ("marketing_consent", "consented"),
        ("marketing_consent", "withdrawn"),
    ]
    assert (
        db.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.action == "lead.marketing_consent_withdrawn")
        )
        == 1
    )
    shown = staff.get(f"/api/admin/compliance/leads/{lead.id}/consent-history").json()
    assert [row["action"] for row in shown] == ["acknowledged", "consented", "withdrawn"]


def test_an_account_records_and_withdraws_marketing_consent(client, fake, offers, db):
    sign_up(client, fake, "pref@example.com")
    account = db.scalar(select(CustomerAccount))
    assert client.patch("/api/accounts/me", json={"marketing_consent": True}, headers=csrf(client)).status_code == 200
    assert client.patch("/api/accounts/me", json={"marketing_consent": False}, headers=csrf(client)).status_code == 200
    history = [(e.document, e.action) for e in events(db, account_id=account.id)]
    assert history == [
        ("privacy", "acknowledged"),
        ("marketing_consent", "consented"),
        ("marketing_consent", "withdrawn"),
    ]
    db.expire_all()
    assert db.get(CustomerAccount, account.id).marketing_consent_at is None


# ------------------------------------------------------------------------------------------- order acceptance


def test_checkout_needs_the_acceptance_block(client, user, fake):
    assert client.post(f"{API}/checkout", json={"offer": "pro_monthly"}, headers=csrf(client)).status_code == 422
    for missing in ("terms", "subscription_terms", "order_acceptance", "privacy", "customer_kind"):
        body = {"offer": "pro_monthly", "acceptance": {k: v for k, v in ACCEPT.items() if k != missing}}
        assert client.post(f"{API}/checkout", json=body, headers=csrf(client)).status_code == 422, missing
    assert fake.created == []


def test_a_stale_version_is_refused_and_nothing_is_started(client, user, fake, db):
    stale = ACCEPT | {"subscription_terms": "2026-01-01"}
    response = client.post(f"{API}/checkout", json={"offer": "pro_monthly", "acceptance": stale}, headers=csrf(client))
    assert response.status_code == 409 and response.json()["code"] == "terms_version_changed"
    assert fake.created == [] and db.scalars(select(BillingCheckout)).all() == []


def test_an_accepted_order_is_recorded_with_versions_and_the_checkout(client, user, fake, db):
    assert (
        client.post(
            f"{API}/checkout", json={"offer": "pro_monthly", "acceptance": ACCEPT}, headers=csrf(client)
        ).status_code
        == 200
    )
    checkout = db.scalar(select(BillingCheckout))
    rows = {(e.document, e.action): e for e in events(db, checkout_id=checkout.id)}
    assert set(rows) == {
        ("terms", "accepted"),
        ("subscription_terms", "accepted"),
        ("order_acceptance", "accepted"),
        ("privacy", "acknowledged"),
    }
    assert all(e.version == legal.version(e.document) for e in rows.values())
    assert {e.source for e in rows.values()} == {"checkout_consumer"}


def test_the_early_start_request_is_separate_and_only_for_consumers(client, user, fake, db):
    early = ACCEPT | {"early_start": True, "early_start_version": legal.version("early_start")}
    assert (
        client.post(
            f"{API}/checkout", json={"offer": "pro_monthly", "acceptance": early}, headers=csrf(client)
        ).status_code
        == 200
    )
    checkout = db.scalar(select(BillingCheckout))
    assert ("early_start", "requested") in {(e.document, e.action) for e in events(db, checkout_id=checkout.id)}
    no_version = ACCEPT | {"early_start": True}
    refused = client.post(
        f"{API}/checkout", json={"offer": "support_setup", "acceptance": no_version}, headers=csrf(client)
    )
    assert refused.status_code == 409  # a consumer asking for early start must show the version of that text
    business = ACCEPT | {"customer_kind": "business", "early_start": True}
    db.add(
        __import__("app.billing.models", fromlist=["ScopeConfirmation"]).ScopeConfirmation(
            workspace_id=workspace(db).id, offer_key="support_setup", confirmed_by="staff"
        )
    )
    db.commit()
    assert (
        client.post(
            f"{API}/checkout", json={"offer": "support_setup", "acceptance": business}, headers=csrf(client)
        ).status_code
        == 200
    )
    second = db.scalars(select(BillingCheckout).order_by(BillingCheckout.created_at)).all()[-1]
    assert ("early_start", "requested") not in {(e.document, e.action) for e in events(db, checkout_id=second.id)}


# ------------------------------------------------------------------------------------------- withdrawal


def withdraw(client, ref, *, confirmed=True, statement=STATEMENT):
    return client.post(
        f"{API}/withdrawals",
        json={"ref": ref, "statement": statement, "locale": "bg", "confirmed": confirmed},
        headers=csrf(client),
    )


def test_a_consumer_withdrawal_inside_the_period_is_recorded_and_confirmed(client, user, fake, db):
    ref = complete_subscription(client, fake, db)
    preview = client.post(f"{API}/withdrawals/preview", json={"ref": ref}, headers=csrf(client)).json()
    assert (preview["eligibility"], preview["customer_kind"], preview["existing_reference"]) == (
        "within_period",
        "consumer",
        None,
    )

    assert withdraw(client, ref, confirmed=False).status_code == 422  # the second step is required
    created = withdraw(client, ref)
    assert created.status_code == 201
    body = created.json()
    assert (
        body["reference"].startswith("W-") and body["status"] == "received" and body["eligibility"] == "within_period"
    )
    row = db.scalar(select(WithdrawalRequest))
    assert row.statement == STATEMENT and row.confirmation_queued_at is not None
    assert ("withdrawal_info", "requested") in {(e.document, e.action) for e in events(db, withdrawal_id=row.id)}

    dispatch_pending(fake.box)
    recipient, subject, text = fake.box.messages[-1]
    assert recipient == "buyer@example.com" and body["reference"] in text and STATEMENT in text
    assert "Получихме" in subject


def test_a_repeat_returns_the_open_request_instead_of_a_second_one(client, user, fake, db):
    ref = complete_subscription(client, fake, db)
    first = withdraw(client, ref).json()
    again = withdraw(client, ref)
    assert (
        again.status_code == 200
        and again.json()["reference"] == first["reference"]
        and again.json()["created"] is False
    )
    assert db.scalar(select(func.count()).select_from(WithdrawalRequest)) == 1
    assert (
        db.scalar(select(func.count()).select_from(OutboxMessage).where(OutboxMessage.reference == first["reference"]))
        == 1
    )


def test_an_expired_period_is_still_recorded_and_flagged_not_rejected(client, user, fake, db):
    ref = complete_subscription(client, fake, db)
    checkout = db.scalar(select(BillingCheckout))
    checkout.completed_at = utcnow() - timedelta(days=20)
    db.commit()
    body = withdraw(client, ref).json()
    assert body["eligibility"] == "period_expired" and body["status"] == "received"


def test_a_business_customer_is_flagged_without_inventing_a_right(client, user, fake, db):
    ref = complete_subscription(client, fake, db, accept=ACCEPT | {"customer_kind": "business"})
    assert withdraw(client, ref).json()["eligibility"] == "business_customer"


def test_a_failed_confirmation_e_mail_does_not_lose_the_request(client, user, fake, db):
    ref = complete_subscription(client, fake, db)
    fake.box.fail = ConnectionError("mail is down")
    body = withdraw(client, ref).json()
    result = dispatch_pending(fake.box)
    assert result["sent"] == 0
    row = db.scalar(select(OutboxMessage).where(OutboxMessage.reference == body["reference"]))
    assert row is not None and row.status == "pending" and row.attempts == 1
    fake.box.fail = None
    db.expire_all()
    row.next_attempt_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert dispatch_pending(fake.box)["sent"] == 1


def test_another_workspaces_purchase_cannot_be_named(client, user, fake, db):
    ref = complete_subscription(client, fake, db)
    sign_up(client, fake, "other@example.com")
    assert withdraw(client, ref).status_code == 404
    assert client.post(f"{API}/withdrawals/preview", json={"ref": ref}, headers=csrf(client)).status_code == 404
    assert client.get(f"{API}/withdrawals").json() == []


def test_a_one_time_purchase_can_be_withdrawn_too(client, user, fake, db):
    paid_purchase(client, fake, db)
    contracts = client.get(f"{API}/contracts").json()
    assert [c["ref"] for c in contracts] == ["cs_1"] and contracts[0]["kind"] == "purchase"
    assert withdraw(client, "cs_1").status_code == 201


def test_staff_decide_and_a_refund_needs_the_reference_entered_by_hand(client, user, fake, db, staff):
    ref = complete_subscription(client, fake, db)
    withdraw(client, ref)
    listed = staff.get("/api/admin/compliance/withdrawals", params={"open_only": True}).json()
    assert len(listed) == 1 and listed[0]["status"] == "received"
    url = f"/api/admin/compliance/withdrawals/{listed[0]['id']}/decide"
    assert staff.post(url, json={"status": "refunded"}).status_code == 422  # nothing moves automatically
    assert (
        staff.post(url, json={"status": "refund_review", "note": "checking the proportionate part"}).status_code == 200
    )
    done = staff.post(url, json={"status": "refunded", "refund_reference": "re_123", "refund_amount_minor": 2900})
    assert done.status_code == 200 and done.json()["refund_reference"] == "re_123"
    assert staff.post(url, json={"status": "closed"}).status_code == 409
    assert staff.get("/api/admin/compliance/withdrawals", params={"open_only": True}).json() == []
    mine = client.get(f"{API}/withdrawals").json()
    assert mine[0]["status"] == "refunded"


def test_the_withdrawal_routes_need_a_signed_in_billing_role(client, fake, offers):
    assert client.post(f"{API}/withdrawals", json={"ref": "x", "statement": "x" * 10}).status_code == 401


def test_the_period_is_a_pure_rule():
    now = utcnow()
    assert service.assess("consumer", now - timedelta(days=13, hours=23), now)[0] == "within_period"
    assert service.assess("consumer", now - timedelta(days=15), now)[0] == "period_expired"
    assert service.assess("consumer", None, now)[0] == "unknown_contract_date"
    assert service.assess("business", now, now) == ("business_customer", None)


# ------------------------------------------------------------------------------------------- data rights


def test_the_export_holds_the_persons_data_and_no_secrets(client, fake, offers, db):
    sign_up(client, fake, "export@example.com")
    client.patch("/api/accounts/me", json={"marketing_consent": True, "display_name": "Мария"}, headers=csrf(client))
    response = client.get("/api/accounts/data/export")
    assert response.status_code == 200
    assert "attachment" in response.headers["Content-Disposition"]
    data = response.json()
    assert data["account"]["email"] == "export@example.com" and data["account"]["display_name"] == "Мария"
    assert [e["action"] for e in data["consent_history"]] == ["acknowledged", "consented"]
    text = response.text.lower()
    for secret in ("password_hash", "token_hash", "csrf_hash", "$argon", "$2b$"):
        assert secret not in text
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "account.data_exported")) == 1


def test_the_export_needs_a_session(client, fake, offers):
    assert client.get("/api/accounts/data/export").status_code == 401


def test_a_deletion_request_is_received_not_done_and_is_not_duplicated(client, fake, offers, db):
    sign_up(client, fake, "gone@example.com")
    first = client.post("/api/accounts/data/requests", json={"kind": "deletion"}, headers=csrf(client))
    assert first.status_code == 202 and first.json()["status"] == "open" and first.json()["created"] is True
    again = client.post(
        "/api/accounts/data/requests", json={"kind": "deletion", "message": "please"}, headers=csrf(client)
    )
    assert again.json()["reference"] == first.json()["reference"] and again.json()["created"] is False
    assert db.scalar(select(func.count()).select_from(DataRequest)) == 1
    assert client.get("/api/accounts/data/requests").json()[0]["reference"] == first.json()["reference"]
    assert client.post("/api/accounts/data/requests", json={"kind": "export"}, headers=csrf(client)).status_code == 422


def test_executing_a_deletion_removes_an_account_that_has_no_accounting_data(client, fake, offers, db, staff):
    sign_up(client, fake, "plain@example.com")
    account_id = db.scalar(select(CustomerAccount.id))
    client.post("/api/accounts/data/requests", json={"kind": "deletion"}, headers=csrf(client))
    request = db.scalar(select(DataRequest))
    done = staff.post(f"/api/admin/compliance/data-requests/{request.id}/handle", json={"action": "execute_deletion"})
    assert done.status_code == 200 and done.json()["outcome_note"] == "deleted"
    db.expire_all()
    assert db.get(CustomerAccount, account_id) is None
    assert events(db, account_id=account_id) == []  # the history goes with the account
    assert (
        db.get(DataRequest, request.id).status == "done"
    )  # the request itself stays as the record that it was handled
    assert client.get("/api/accounts/me").status_code == 401


def test_an_account_with_billing_records_is_anonymized_and_the_records_stay(client, user, fake, db, staff):
    complete_subscription(client, fake, db)
    withdraw(client, "sub_1")
    account = db.scalar(select(CustomerAccount))
    client.post("/api/accounts/data/requests", json={"kind": "deletion"}, headers=csrf(client))
    request = db.scalar(select(DataRequest))
    url = f"/api/admin/compliance/data-requests/{request.id}/handle"
    # A live subscription would keep being charged at Stripe: the erasure is refused until it is cancelled there.
    blocked = staff.post(url, json={"action": "execute_deletion"})
    assert blocked.status_code == 409 and blocked.json()["code"] == "subscription_active"
    db.expire_all()
    assert db.get(CustomerAccount, account.id).erased_at is None
    db.scalar(select(BillingSubscription)).status = "canceled"
    db.commit()
    done = staff.post(url, json={"action": "execute_deletion", "stripe_checked": True})
    assert done.status_code == 200 and done.json()["outcome_note"].startswith("anonymized")
    db.expire_all()
    erased = db.get(CustomerAccount, account.id)
    assert erased.email == f"erased-{account.id}@invalid.invalid" and erased.display_name is None
    assert erased.erased_at is not None and erased.email_verified_at is None
    assert db.scalar(select(func.count()).select_from(BillingCheckout)) == 1  # billing records stay
    assert db.scalar(select(func.count()).select_from(BillingSubscription)) == 1
    assert db.scalar(select(func.count()).select_from(CustomerWorkspace)) == 1
    withdrawal = db.scalar(select(WithdrawalRequest))
    assert withdrawal.statement == "[erased]" and withdrawal.reference.startswith("W-")
    login = client.post("/api/accounts/login", json={"email": "buyer@example.com", "password": "anything-Strong-2026"})
    assert login.status_code in (400, 401)


def test_only_a_deletion_request_can_be_executed(client, fake, offers, db, staff):
    sign_up(client, fake, "corr@example.com")
    client.post("/api/accounts/data/requests", json={"kind": "correction", "message": "name"}, headers=csrf(client))
    request = db.scalar(select(DataRequest))
    assert (
        staff.post(
            f"/api/admin/compliance/data-requests/{request.id}/handle", json={"action": "execute_deletion"}
        ).status_code
        == 422
    )
    assert (
        staff.post(
            f"/api/admin/compliance/data-requests/{request.id}/handle", json={"action": "done", "note": "corrected"}
        ).status_code
        == 200
    )
    assert (
        staff.post(f"/api/admin/compliance/data-requests/{request.id}/handle", json={"action": "done"}).status_code
        == 409
    )


def test_staff_routes_need_an_administrator(client):
    for path in (
        "/api/admin/compliance/withdrawals",
        "/api/admin/compliance/data-requests",
        "/api/admin/compliance/versions",
    ):
        assert client.get(path).status_code == 401


def test_accounts_that_never_confirmed_their_e_mail_are_deleted_after_the_period(client, fake, offers, db):
    from app.accounts import service as account_service

    sign_up(client, fake, "kept@example.com")
    stale = CustomerAccount(
        email="stale@example.com",
        password_hash="!",
        privacy_notice_version="x",
        created_at=utcnow() - timedelta(days=get_settings().account_unverified_days + 1),
    )
    fresh = CustomerAccount(email="fresh@example.com", password_hash="!", privacy_notice_version="x")
    db.add_all([stale, fresh])
    db.commit()
    account_service.purge_expired(db)
    db.commit()
    emails = {a.email for a in db.scalars(select(CustomerAccount))}
    assert emails == {"kept@example.com", "fresh@example.com"}
    assert limits is not None


def test_a_stale_environment_value_cannot_override_the_registry(monkeypatch):
    from app.config import Settings

    monkeypatch.setenv("PRIVACY_NOTICE_VERSION", "2026-10-draft")
    monkeypatch.setenv("MARKETING_CONSENT_VERSION", "2026-10-v1")
    fresh = Settings()
    assert fresh.privacy_notice_version == legal.version("privacy")
    assert fresh.marketing_consent_version == legal.version("marketing_consent")
