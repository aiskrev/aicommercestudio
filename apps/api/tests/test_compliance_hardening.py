# ruff: noqa: F811
"""Rate limits, duplicate and concurrency protection, the deletion gate, retention, self-service withdrawal and the
draft-text guard of the legal workflows."""

from __future__ import annotations

import hashlib
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app import legal
from app.accounts.models import CustomerAccount, OutboxMessage, RateLimitBucket
from app.billing.models import BillingCheckout, BillingCustomer, BillingSubscription
from app.compliance import service
from app.compliance.models import DataRequest, LegalEvent, WithdrawalRequest
from app.config import Settings, get_settings
from app.models import AuditLog, Lead, utcnow
from tests.test_accounts import csrf
from tests.test_billing import (  # noqa: F401  (fixtures)
    ACCEPT,
    API,
    checkout,
    deliver,
    fake,
    offers,
    sign_up,
    subscription,
    user,
    workspace,
)
from tests.test_compliance import STATEMENT, complete_subscription, events, staff, withdraw  # noqa: F401  (staff: fixture)
from tests.test_security import _production


def second_browser():
    from app.main import app

    return TestClient(app)


def post_request(client, kind="correction", **extra):
    return client.post("/api/accounts/data/requests", json={"kind": kind, **extra}, headers=csrf(client))


# ------------------------------------------------------------------------------------------ rate limits


def test_export_is_limited_per_account_with_a_localized_answer_and_does_not_touch_another_account(
    client, fake, offers, monkeypatch
):
    monkeypatch.setattr(get_settings(), "legal_action_rate_limit", 3)
    sign_up(client, fake, "first@example.com")
    for _ in range(3):
        assert client.get("/api/accounts/data/export").status_code == 200
    blocked = client.get("/api/accounts/data/export", headers={"Accept-Language": "bg"})
    assert blocked.status_code == 429 and blocked.json()["code"] == "rate_limited"
    assert int(blocked.headers["Retry-After"]) >= 1
    assert "Твърде много" in blocked.json()["detail"]
    assert "Too many" in client.get("/api/accounts/data/export", headers={"Accept-Language": "en"}).json()["detail"]
    with second_browser() as other:
        sign_up(other, fake, "second@example.com")
        assert other.get("/api/accounts/data/export").status_code == 200  # a different account has its own bucket


def test_data_requests_are_limited_and_a_repeat_still_returns_the_one_open_request(
    client, fake, offers, db, monkeypatch
):
    monkeypatch.setattr(get_settings(), "legal_action_rate_limit", 3)
    sign_up(client, fake, "limited@example.com")
    first = post_request(client)
    assert first.status_code == 202 and first.json()["created"] is True
    for _ in range(2):
        again = post_request(client)
        assert again.json()["reference"] == first.json()["reference"] and again.json()["created"] is False
    assert post_request(client).status_code == 429
    assert db.scalar(select(func.count()).select_from(DataRequest)) == 1  # a repeat never opened a second request


def test_a_limit_starts_over_after_its_window(client, fake, offers, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "legal_action_rate_limit", 1)
    sign_up(client, fake, "window@example.com")
    assert post_request(client).status_code == 202
    assert post_request(client).status_code == 429
    db.execute(RateLimitBucket.__table__.update().values(window_start=utcnow() - timedelta(days=1)))
    db.commit()
    assert post_request(client).status_code == 202


def test_a_repeat_returns_the_open_request_even_when_the_withdrawal_limit_is_used_up(
    client, user, fake, db, monkeypatch
):
    ref = complete_subscription(client, fake, db)
    first = withdraw(client, ref)
    assert first.status_code == 201
    monkeypatch.setattr(get_settings(), "legal_action_rate_limit", 0)  # nothing new may be created now
    for _ in range(3):
        again = withdraw(client, ref)
        assert again.status_code == 200 and again.json()["reference"] == first.json()["reference"]
    assert db.scalar(select(func.count()).select_from(WithdrawalRequest)) == 1


@pytest.mark.parametrize("language,words", [("bg", "Твърде много"), ("en", "Too many")])
def test_a_new_withdrawal_over_its_own_limit_gets_a_retry_time_and_nothing_is_recorded(
    client, user, fake, db, monkeypatch, language, words
):
    ref = complete_subscription(client, fake, db)
    monkeypatch.setattr(get_settings(), "legal_action_rate_limit", 0)
    refused = client.post(
        f"{API}/withdrawals",
        json={"ref": ref, "statement": STATEMENT, "locale": language, "confirmed": True},
        headers={**csrf(client), "Accept-Language": language},
    )
    assert refused.status_code == 429 and refused.json()["code"] == "rate_limited"
    assert int(refused.headers["Retry-After"]) >= 1 and words in refused.json()["detail"]
    assert db.scalar(select(func.count()).select_from(WithdrawalRequest)) == 0


def test_the_shared_workspace_limit_never_blocks_the_withdrawal_function(client, user, fake, db):
    from app.accounts import limits as shared

    ref = complete_subscription(client, fake, db)
    space = str(workspace(db).id)
    for _ in range(100):  # fill the plan's shared per-workspace bucket, as a burst of page loads would
        shared.hit("workspace", space, 10_000, 60)
    assert client.get(f"{API}/offers").status_code == 429  # ordinary routes are throttled
    assert client.get(f"{API}/contracts").status_code == 200  # the withdrawal function is not
    assert client.get(f"{API}/withdrawals").status_code == 200
    assert client.post(f"{API}/withdrawals/preview", json={"ref": ref}, headers=csrf(client)).status_code == 200
    assert withdraw(client, ref).status_code == 201


def test_the_dedicated_withdrawal_limits_are_per_workspace_and_per_account(client, fake, offers, db):
    from app.accounts import limits as shared

    with second_browser() as other:
        sign_up(client, fake, "first.wd@example.com")
        first_space = str(workspace_of_email(db, "first.wd@example.com").id)
        sign_up(other, fake, "second.wd@example.com")
        for _ in range(10):  # fill the FIRST workspace's own withdrawal bucket
            shared.hit("withdrawal:workspace", first_space, 10_000, 3600)
        # The first workspace has nothing to withdraw from here; the point is the second one is unaffected.
        assert other.get(f"{API}/contracts").status_code == 200
        assert other.get(f"{API}/withdrawals").status_code == 200
        refused = client.post(
            f"{API}/withdrawals",
            json={"ref": "sub_none", "statement": STATEMENT, "locale": "bg", "confirmed": True},
            headers=csrf(client),
        )
        assert refused.status_code == 429  # its own bucket is used up
        allowed = other.post(
            f"{API}/withdrawals",
            json={"ref": "sub_none", "statement": STATEMENT, "locale": "bg", "confirmed": True},
            headers=csrf(other),
        )
        assert allowed.status_code == 404  # not throttled: it reaches the contract lookup (no such contract)


def workspace_of_email(db, email):
    from app.workspace.models import CustomerWorkspace

    account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == email))
    return db.scalar(select(CustomerWorkspace).where(CustomerWorkspace.owner_account_id == account.id))


def test_the_acknowledgement_is_sent_at_once_and_not_left_for_a_scheduled_run(client, user, fake, db):
    ref = complete_subscription(client, fake, db)
    reference = withdraw(client, ref).json()["reference"]
    sent = [text for _recipient, _subject, text in fake.box.messages if reference in text]
    assert len(sent) == 1  # no manual dispatch was needed; the date and time of submission are in the message
    assert "Подадено на:" in sent[0] and STATEMENT in sent[0]


def test_the_contract_and_preview_reads_are_limited_too(client, user, fake, db, monkeypatch):
    ref = complete_subscription(client, fake, db)
    monkeypatch.setattr(get_settings(), "legal_read_rate_limit", 2)
    for _ in range(2):
        assert client.post(f"{API}/withdrawals/preview", json={"ref": ref}, headers=csrf(client)).status_code == 200
    assert client.post(f"{API}/withdrawals/preview", json={"ref": ref}, headers=csrf(client)).status_code == 429


def test_staff_actions_are_limited_per_staff_member(client, user, fake, db, staff, monkeypatch):
    ref = complete_subscription(client, fake, db)
    withdraw(client, ref)
    row = db.scalar(select(WithdrawalRequest))
    monkeypatch.setattr(get_settings(), "staff_action_rate_limit", 2)
    url = f"/api/admin/compliance/withdrawals/{row.id}/decide"
    assert staff.post(url, json={"status": "refund_review"}).status_code == 200
    assert staff.post(url, json={"status": "refund_review", "note": "again"}).status_code == 200
    assert staff.post(url, json={"status": "refund_review", "note": "third"}).status_code == 429
    audited = db.scalar(
        select(func.count()).select_from(AuditLog).where(AuditLog.action == "billing.withdrawal_decided")
    )
    assert audited == 2  # the refused call left no outcome behind


# --------------------------------------------------------------------------- duplicates and concurrency


def test_parallel_withdrawals_for_one_contract_open_one_request_and_send_one_message(
    client, user, fake, db, monkeypatch
):
    ref = complete_subscription(client, fake, db)
    monkeypatch.setattr(get_settings(), "legal_action_rate_limit", 100)
    headers = csrf(client)

    def call(_):
        return client.post(
            f"{API}/withdrawals",
            json={"ref": ref, "statement": STATEMENT, "locale": "bg", "confirmed": True},
            headers=headers,
        ).status_code

    with ThreadPoolExecutor(max_workers=6) as pool:
        codes = list(pool.map(call, range(6)))
    assert sorted(codes).count(201) == 1 and set(codes) <= {200, 201}
    assert db.scalar(select(func.count()).select_from(WithdrawalRequest)) == 1
    reference = db.scalar(select(WithdrawalRequest.reference))
    assert db.scalar(select(func.count()).select_from(OutboxMessage).where(OutboxMessage.reference == reference)) == 1
    withdrawal_events = db.scalar(
        select(func.count()).select_from(LegalEvent).where(LegalEvent.withdrawal_id.is_not(None))
    )
    assert withdrawal_events == 1


def test_parallel_data_requests_of_one_kind_open_one_request(client, fake, offers, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "legal_action_rate_limit", 100)
    sign_up(client, fake, "parallel@example.com")
    headers = csrf(client)

    def call(_):
        return client.post("/api/accounts/data/requests", json={"kind": "restriction"}, headers=headers).json()

    with ThreadPoolExecutor(max_workers=6) as pool:
        answers = list(pool.map(call, range(6)))
    assert len({a["reference"] for a in answers}) == 1
    assert sum(1 for a in answers if a["created"]) == 1
    assert db.scalar(select(func.count()).select_from(DataRequest)) == 1


def test_a_request_of_another_kind_is_a_separate_request(client, fake, offers, db):
    sign_up(client, fake, "kinds@example.com")
    assert (
        post_request(client, "correction").json()["reference"] != post_request(client, "objection").json()["reference"]
    )


def test_a_reused_checkout_does_not_record_the_acceptance_twice(client, user, fake, db):
    assert checkout(client).status_code == 200
    before = db.scalar(select(func.count()).select_from(LegalEvent).where(LegalEvent.checkout_id.is_not(None)))
    reused = checkout(client)
    assert reused.json()["reused"] is True
    after = db.scalar(select(func.count()).select_from(LegalEvent).where(LegalEvent.checkout_id.is_not(None)))
    assert before == after == 4


def test_the_database_refuses_a_duplicate_acceptance_and_a_duplicate_confirmation(client, user, db):
    checkout(client)
    existing = db.scalar(select(LegalEvent).where(LegalEvent.checkout_id.is_not(None)))
    db.add(
        LegalEvent(
            checkout_id=existing.checkout_id,
            document=existing.document,
            action=existing.action,
            version=existing.version,
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    account_id = db.scalar(select(CustomerAccount.id))
    for _ in range(2):
        db.add(OutboxMessage(account_id=account_id, kind="withdrawal_received", locale="bg", reference="W-DUP"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_parallel_withdrawal_of_marketing_consent_writes_one_event(client, make_lead, staff, db):
    make_lead(email="race@example.com", marketing_consent=True)
    lead = db.scalar(select(Lead))
    token = (
        staff.post(f"/api/admin/compliance/leads/{lead.id}/marketing-withdrawal-link").json()["url"].split("token=")[1]
    )
    by_staff = f"/api/admin/compliance/leads/{lead.id}/marketing-consent/withdraw"

    def by_staff_call(_):
        return staff.post(by_staff).status_code

    def by_person(_):
        return client.post("/api/public/marketing/withdraw", json={"token": token, "locale": "en"}).status_code

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [
            pool.submit(by_staff_call, 0),
            pool.submit(by_person, 0),
            pool.submit(by_person, 1),
            pool.submit(by_staff_call, 1),
        ]
        codes = [f.result() for f in futures]
    assert set(codes) <= {200, 204}
    withdrawn = [e for e in events(db, lead_id=lead.id) if e.action == "withdrawn"]
    assert len(withdrawn) == 1


def test_two_staff_members_cannot_execute_the_same_deletion_twice(client, fake, offers, db, staff):
    sign_up(client, fake, "twice@example.com")
    post_request(client, "deletion")
    request = db.scalar(select(DataRequest))
    url = f"/api/admin/compliance/data-requests/{request.id}/handle"

    def call(_):
        return staff.post(url, json={"action": "execute_deletion"}).status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = list(pool.map(call, range(4)))
    assert codes.count(200) == 1 and set(codes) <= {200, 409}


# ------------------------------------------------------------------------------------------ deletion gate


def ask_deletion(client, db):
    post_request(client, "deletion")
    return db.scalars(select(DataRequest).order_by(DataRequest.created_at.desc())).first()


def execute(staff, request, **extra):
    return staff.post(
        f"/api/admin/compliance/data-requests/{request.id}/handle", json={"action": "execute_deletion", **extra}
    )


@pytest.mark.parametrize(
    "state", ["active", "trialing", "past_due", "unpaid", "paused", "incomplete", "brand_new_state"]
)
def test_every_chargeable_or_unknown_subscription_state_blocks_deletion_and_anonymisation(
    state, client, user, fake, db, staff
):
    complete_subscription(client, fake, db)
    db.scalar(select(BillingSubscription)).status = state
    db.commit()
    request = ask_deletion(client, db)
    blocked = execute(staff, request, stripe_checked=True)
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "subscription_active"
    db.expire_all()
    assert db.scalar(select(CustomerAccount)).erased_at is None  # not anonymised either
    assert db.get(DataRequest, request.id).status == "open"
    expected = f"subscription_{state}" if state != "brand_new_state" else "subscription_state_unknown"
    assert expected in service.deletion_blockers(db, get_settings(), db.scalar(select(CustomerAccount)))


@pytest.mark.parametrize("state", ["canceled", "incomplete_expired"])
def test_a_final_subscription_state_allows_anonymisation_after_staff_checked_stripe(
    state, client, user, fake, db, staff
):
    complete_subscription(client, fake, db)
    db.scalar(select(BillingSubscription)).status = state
    db.commit()
    request = ask_deletion(client, db)
    needs = execute(staff, request)
    assert needs.status_code == 409 and needs.json()["code"] == "stripe_check_required"  # a Stripe customer exists
    done = execute(staff, request, stripe_checked=True)
    assert done.status_code == 200 and done.json()["outcome_note"].startswith("anonymized")
    audit = db.scalar(select(AuditLog).where(AuditLog.action == "account.data_request_handled"))
    assert audit.details["stripe_checked"] is True


def test_a_subscription_that_ends_at_the_period_end_still_blocks(client, user, fake, db):
    complete_subscription(client, fake, db)
    row = db.scalar(select(BillingSubscription))
    row.cancel_at_period_end = True
    db.commit()
    reasons = service.deletion_blockers(db, get_settings(), db.scalar(select(CustomerAccount)))
    assert {"subscription_active", "subscription_cancels_at_period_end"} <= set(reasons)


def test_an_open_checkout_blocks_until_it_is_old_and_an_old_one_does_not(client, user, fake, db):
    assert checkout(client).status_code == 200
    account = db.scalar(select(CustomerAccount))
    assert "checkout_open" in service.deletion_blockers(db, get_settings(), account)
    db.scalar(select(BillingCheckout)).created_at = utcnow() - timedelta(
        hours=get_settings().billing_open_checkout_block_hours + 1
    )
    db.commit()
    assert "checkout_open" not in service.deletion_blockers(db, get_settings(), account)


def test_a_completed_subscription_checkout_without_a_subscription_row_blocks(client, user, fake, db):
    complete_subscription(client, fake, db)
    db.delete(db.scalar(select(BillingSubscription)))  # the webhook has not been processed (or its state is stale)
    db.commit()
    assert "subscription_state_pending" in service.deletion_blockers(
        db, get_settings(), db.scalar(select(CustomerAccount))
    )


def test_the_gate_is_local_so_an_unreachable_stripe_cannot_make_it_unsafe(client, user, fake, db, monkeypatch):
    complete_subscription(client, fake, db)

    def unavailable(*_, **__):
        raise AssertionError("the deletion gate must not call Stripe")

    monkeypatch.setattr("app.billing.service.get_gateway", unavailable)
    assert service.deletion_blockers(db, get_settings(), db.scalar(select(CustomerAccount)))  # fail closed, no call


def test_a_plain_account_without_billing_is_deleted_without_a_stripe_attestation(client, fake, offers, db, staff):
    sign_up(client, fake, "plain2@example.com")
    request = ask_deletion(client, db)
    done = execute(staff, request)
    assert done.status_code == 200 and done.json()["outcome_note"] == "deleted"


def test_a_late_subscription_event_for_an_erased_account_is_flagged_for_a_person(client, user, fake, db, staff):
    complete_subscription(client, fake, db)
    db.scalar(select(BillingSubscription)).status = "canceled"
    db.commit()
    request = ask_deletion(client, db)
    assert execute(staff, request, stripe_checked=True).status_code == 200
    subscription(fake, db, status="active")  # Stripe reports it active after all
    assert db.scalar(select(BillingCustomer)) is not None
    deliver(client, "evt_late", "customer.subscription.updated", "sub_1")
    from app.billing import service as billing_service

    billing_service.process_pending(fake)
    db.expire_all()
    flagged = db.scalar(select(AuditLog).where(AuditLog.action == "billing.subscription_on_erased_account"))
    assert flagged is not None and flagged.entity_id == "sub_1"


# ------------------------------------------------------------------------------------------ retention


def test_retention_defaults_to_keeping_everything_and_rejects_nonsense():
    settings = Settings(secret_key="x" * 40)
    assert settings.withdrawal_retention_years is None and settings.data_request_retention_years is None
    assert settings.legal_cleanup_enabled is False
    for bad in (0, -1, 31):
        with pytest.raises(ValidationError):
            Settings(secret_key="x" * 40, withdrawal_retention_years=bad)


def test_an_empty_retention_variable_means_not_approved_not_a_crash(monkeypatch):
    monkeypatch.setenv("WITHDRAWAL_RETENTION_YEARS", "")
    monkeypatch.setenv("DATA_REQUEST_RETENTION_YEARS", "")
    settings = Settings()
    assert settings.withdrawal_retention_years is None and settings.data_request_retention_years is None


def test_production_with_accounts_or_billing_needs_approved_retention_and_approved_texts():
    for overrides in ({"customer_accounts_enabled": True}, {"billing_provider": "sandbox"}):
        with pytest.raises(ValidationError) as error:
            _production(**overrides)
        assert "WITHDRAWAL_RETENTION_YEARS" in str(error.value) and "pending lawyer review" in str(error.value)
    assert _production().withdrawal_retention_years is None  # nothing enabled, nothing to approve: starts as before


def closed_withdrawal(db, ref, *, age_years, refund=False, status="closed"):
    request = WithdrawalRequest(
        reference=f"W-TEST-{ref}",
        workspace_id=workspace(db).id,
        subject_kind="subscription",
        subject_ref=f"sub_{ref}",
        offer_key="pro_monthly",
        statement="x" * 12,
        locale="bg",
        customer_kind="consumer",
        eligibility="within_period",
        status="refunded" if refund else status,
        decided_at=utcnow() - timedelta(days=365 * age_years + 5),
        refund_reference="re_1" if refund else None,
        refund_amount_minor=100 if refund else None,
    )
    db.add(request)
    db.flush()
    db.add(LegalEvent(withdrawal_id=request.id, document="withdrawal_info", version="v", action="requested"))
    db.add(
        OutboxMessage(
            account_id=db.scalar(select(CustomerAccount.id)),
            kind="withdrawal_received",
            locale="bg",
            reference=request.reference,
        )
    )
    db.commit()
    return request


def test_nothing_is_deleted_while_cleanup_is_off_or_no_period_is_approved(client, user, db, monkeypatch):
    closed_withdrawal(db, "A", age_years=9)
    settings = get_settings()
    assert service.purge_legal_records(db, settings) == {
        "withdrawals": 0,
        "data_requests": 0,
        "events": 0,
        "kept_for_accounting": 0,
    }
    monkeypatch.setattr(settings, "legal_cleanup_enabled", True)  # switched on, but no period approved: still keeps
    assert service.purge_legal_records(db, settings)["withdrawals"] == 0
    assert db.scalar(select(func.count()).select_from(WithdrawalRequest)) == 1


def test_approved_cleanup_removes_only_old_closed_requests_with_their_events_and_messages(
    client, user, db, monkeypatch
):
    settings = get_settings()
    monkeypatch.setattr(settings, "legal_cleanup_enabled", True)
    monkeypatch.setattr(settings, "withdrawal_retention_years", 2)
    monkeypatch.setattr(settings, "data_request_retention_years", 2)
    closed_withdrawal(db, "OLD", age_years=3)
    closed_withdrawal(db, "NEW", age_years=1)
    still_open = closed_withdrawal(db, "OPEN", age_years=5, status="received")
    still_open.decided_at = None
    old_request = DataRequest(
        reference="D-OLD", kind="correction", status="done", handled_at=utcnow() - timedelta(days=900)
    )
    open_request = DataRequest(reference="D-OPEN", kind="correction", status="open")
    db.add_all([old_request, open_request])
    db.commit()
    account_events = db.scalar(select(func.count()).select_from(LegalEvent).where(LegalEvent.account_id.is_not(None)))

    result = service.purge_legal_records(db, settings)
    db.commit()
    assert result["withdrawals"] == 1 and result["data_requests"] == 1 and result["events"] == 1
    assert {r.reference for r in db.scalars(select(WithdrawalRequest))} == {"W-TEST-NEW", "W-TEST-OPEN"}
    assert {r.reference for r in db.scalars(select(DataRequest))} == {"D-OPEN"}
    assert (
        db.scalar(select(func.count()).select_from(OutboxMessage).where(OutboxMessage.reference == "W-TEST-OLD")) == 0
    )
    assert (
        db.scalar(select(func.count()).select_from(LegalEvent).where(LegalEvent.account_id.is_not(None)))
        == account_events
    )


def test_a_refunded_withdrawal_is_accounting_evidence_and_waits_for_the_accounting_period(
    client, user, db, monkeypatch
):
    settings = get_settings()
    monkeypatch.setattr(settings, "legal_cleanup_enabled", True)
    monkeypatch.setattr(settings, "withdrawal_retention_years", 1)
    closed_withdrawal(db, "REF", age_years=4, refund=True)
    assert service.purge_legal_records(db, settings)["kept_for_accounting"] == 1  # no accounting period approved
    monkeypatch.setattr(settings, "accounting_retention_years", 10)
    assert service.purge_legal_records(db, settings)["kept_for_accounting"] == 1  # 4 years < 10
    monkeypatch.setattr(settings, "accounting_retention_years", 2)
    assert service.purge_legal_records(db, settings)["withdrawals"] == 1
    db.commit()
    assert db.scalar(select(func.count()).select_from(WithdrawalRequest)) == 0


# ------------------------------------------------------------------------------------------ legal registry


def test_every_text_is_a_draft_until_a_lawyer_approves_it():
    assert set(legal.pending_review()) == set(legal.registry())
    for key in legal.registry():
        assert legal.status(key) == "draft" and legal.languages(key) == ["bg", "en"] and not legal.is_approved(key)


def test_a_draft_cannot_back_a_live_acceptance(monkeypatch):
    accepted = service.Acceptance(
        terms=legal.version("terms"),
        subscription_terms=legal.version("subscription_terms"),
        order_acceptance=legal.version("order_acceptance"),
        privacy=legal.version("privacy"),
        customer_kind="consumer",
    )
    service.check_acceptance(accepted)  # test environment: the drafts are accepted for development
    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "billing_provider", "stripe")
    with pytest.raises(service.ComplianceError) as error:
        service.check_acceptance(accepted)
    assert error.value.code == "legal_text_not_approved"
    monkeypatch.setattr(legal, "is_approved", lambda key: True)
    service.check_acceptance(accepted)  # approved texts pass


def test_old_acceptance_records_stay_readable_after_a_new_version(client, user, db, staff):
    checkout(client)
    db.query(LegalEvent).filter(LegalEvent.checkout_id.is_not(None)).update({"version": "2026-01-01"})
    db.commit()
    export = client.get("/api/accounts/data/export")
    assert export.status_code == 200
    assert {e.version for e in events(db, document="terms")} == {"2026-01-01"}
    assert legal.version("terms") != "2026-01-01"  # the current id moved on; the old record is untouched


# ------------------------------------------------------------------------------ self-service withdrawal


def consenting_lead(make_lead, db, email="optin@example.com"):
    make_lead(email=email, marketing_consent=True)
    return db.scalar(select(Lead).where(Lead.email == email))


def link_for(staff, lead, locale="bg"):
    response = staff.post(f"/api/admin/compliance/leads/{lead.id}/marketing-withdrawal-link", params={"locale": locale})
    assert response.status_code == 200, response.text
    return response.json()["url"]


def test_the_link_carries_an_opaque_token_and_nothing_personal(make_lead, staff, db):
    lead = consenting_lead(make_lead, db)
    url = link_for(staff, lead)
    token = url.split("#token=")[1]
    assert url.startswith(get_settings().site_url.rstrip("/") + "/bg/otkaz-ot-marketing#token=")
    assert len(token) == 64 and str(lead.id) not in url and "optin" not in url and "example.com" not in url
    assert link_for(staff, lead) == url  # stable: the same link every time
    assert link_for(staff, lead, "en").startswith(get_settings().site_url.rstrip("/") + "/en/marketing-opt-out#token=")
    db.expire_all()
    stored = db.get(Lead, lead.id).marketing_token_hash
    assert stored == hashlib.sha256(token.encode()).hexdigest() and stored != token  # only the hash is stored


def test_a_lead_without_consent_gets_no_link(make_lead, staff, db):
    make_lead(email="never@example.com", marketing_consent=False)
    lead = db.scalar(select(Lead))
    assert staff.post(f"/api/admin/compliance/leads/{lead.id}/marketing-withdrawal-link").status_code == 409


def test_the_person_withdraws_with_the_link_and_the_evidence_stays(make_lead, staff, client, db):
    lead = consenting_lead(make_lead, db)
    token = link_for(staff, lead).split("#token=")[1]
    first = client.post("/api/public/marketing/withdraw", json={"token": token, "locale": "en"})
    assert first.status_code == 200 and first.json() == {"status": "withdrawn"}
    db.expire_all()
    lead = db.get(Lead, lead.id)
    assert lead.marketing_consent is False and lead.marketing_consent_withdrawn_at is not None
    assert lead.marketing_consent_at is not None and lead.marketing_consent_version  # the consent evidence is kept
    assert lead.status is not None and lead.email == "optin@example.com"  # the inquiry itself is untouched
    history = [(e.document, e.action, e.source) for e in events(db, lead_id=lead.id)]
    assert history == [
        ("privacy", "acknowledged", history[0][2]),
        ("marketing_consent", "consented", history[1][2]),
        ("marketing_consent", "withdrawn", "self_service"),
    ]
    withdrawn = [e for e in events(db, lead_id=lead.id) if e.action == "withdrawn"][0]
    assert withdrawn.version == lead.marketing_consent_version and withdrawn.locale == "en"
    again = client.post("/api/public/marketing/withdraw", json={"token": token, "locale": "bg"})
    assert again.status_code == 200 and again.json() == {"status": "already_withdrawn"}
    assert len([e for e in events(db, lead_id=lead.id) if e.action == "withdrawn"]) == 1
    audit = db.scalar(select(AuditLog).where(AuditLog.action == "lead.marketing_consent_withdrawn_by_person"))
    assert audit is not None and "optin" not in str(audit.details)


def test_a_withdrawn_lead_is_no_longer_eligible_for_marketing(make_lead, staff, client, db):
    lead = consenting_lead(make_lead, db)
    token = link_for(staff, lead).split("#token=")[1]
    client.post("/api/public/marketing/withdraw", json={"token": token})
    eligible = db.scalars(select(Lead).where(Lead.marketing_consent.is_(True))).all()
    assert lead.id not in {row.id for row in eligible}


@pytest.mark.parametrize("language,expected", [("bg", "невалиден"), ("en", "invalid")])
def test_an_invalid_or_tampered_or_unknown_link_is_one_generic_refusal(
    make_lead, staff, client, db, language, expected
):
    lead = consenting_lead(make_lead, db)
    token = link_for(staff, lead).split("#token=")[1]
    tampered = token[:-1] + ("0" if token[-1] != "0" else "1")
    unknown = service._marketing_token(uuid.uuid4())  # well-formed, never minted
    for bad in (tampered, unknown, "f" * 64):
        response = client.post(
            "/api/public/marketing/withdraw", json={"token": bad}, headers={"Accept-Language": language}
        )
        assert response.status_code == 404 and response.json()["code"] == "token_invalid"
        assert expected in response.json()["detail"].lower()
    assert client.post("/api/public/marketing/withdraw", json={"token": "short"}).status_code == 422
    db.expire_all()
    assert db.get(Lead, lead.id).marketing_consent is True  # nothing changed


def test_a_token_that_was_never_minted_does_not_work_even_for_a_real_lead(make_lead, client, db):
    lead = consenting_lead(make_lead, db)
    guess = service._marketing_token(lead.id)  # a perfectly valid token, but staff never prepared a link
    assert client.post("/api/public/marketing/withdraw", json={"token": guess}).status_code == 404


def test_the_public_withdrawal_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "marketing_withdraw_rate_limit", 2)
    for _ in range(2):
        assert client.post("/api/public/marketing/withdraw", json={"token": "a" * 64}).status_code == 404
    assert client.post("/api/public/marketing/withdraw", json={"token": "a" * 64}).status_code == 429


def test_the_endpoint_needs_no_account_and_no_account_flag(make_lead, staff, client, db, monkeypatch):
    monkeypatch.setattr(get_settings(), "customer_accounts_enabled", False)
    lead = consenting_lead(make_lead, db)
    token = link_for(staff, lead).split("#token=")[1]
    assert client.post("/api/public/marketing/withdraw", json={"token": token}).status_code == 200


# ------------------------------------------------------------------------------ browser-test seed


def test_the_browser_test_seed_builds_the_scenarios_and_refuses_production(db, monkeypatch):
    from app.compliance import e2e_seed

    created = e2e_seed.seed(db, "Seed-Password-2026")
    assert len(created) == len(e2e_seed.SCENARIOS) and e2e_seed.seed(db, "Seed-Password-2026") == []  # idempotent
    settings = get_settings()

    def workspace_of(name):
        account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == e2e_seed.email_of(name)))
        return account, db.scalar(select(workspace_model).where(workspace_model.owner_account_id == account.id))

    from app.workspace.models import CustomerWorkspace as workspace_model

    expected = {
        "consumer": "within_period",
        "business": "business_customer",
        "expired": "period_expired",
        "unknown": "unknown_contract_date",
    }
    for name, eligibility in expected.items():
        _, space = workspace_of(name)
        assert service.preview_withdrawal(db, space.id, f"sub_e2e_{name}")["eligibility"] == eligibility
    assert (
        service.preview_withdrawal(db, workspace_of("consumer")[1].id, "sub_e2e_consumer")["early_start_requested"]
        is True
    )
    for name in ("pastdue", "ending", "opencheckout"):
        assert service.deletion_blockers(db, settings, workspace_of(name)[0]), name
    for name in ("plain", "canceled"):
        assert service.deletion_blockers(db, settings, workspace_of(name)[0]) == [], name
    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(RuntimeError):
        e2e_seed.seed(db, "Seed-Password-2026")


# ------------------------------------------------------------------------------------------ request deadlines


def test_a_request_gets_a_received_time_and_a_working_due_date_one_calendar_month_later(client, fake, offers, db):
    sign_up(client, fake, "due@example.com")
    post_request(client, "correction")
    row = db.scalar(select(DataRequest))
    assert row.received_at is not None and row.base_due_at == service.add_months(row.received_at, 1)
    assert row.extended_due_at is None and row.completed_at is None


def test_calendar_months_clamp_to_the_last_day():
    from datetime import UTC, datetime

    assert service.add_months(datetime(2026, 1, 31, tzinfo=UTC), 1).day == 28
    assert service.add_months(datetime(2026, 11, 30, tzinfo=UTC), 2) == datetime(2027, 1, 30, tzinfo=UTC)


def test_staff_see_on_track_due_soon_overdue_and_closed(client, fake, offers, db, staff):
    sign_up(client, fake, "states@example.com")
    post_request(client, "correction")
    row = db.scalar(select(DataRequest))
    settings = get_settings()
    now = row.received_at
    assert service.deadline_state(row, settings, now)["state"] == "on_track"
    assert service.deadline_state(row, settings, row.base_due_at - timedelta(days=3))["state"] == "due_soon"
    assert service.deadline_state(row, settings, row.base_due_at + timedelta(minutes=1))["state"] == "overdue"
    listed = staff.get("/api/admin/compliance/data-requests").json()[0]
    assert listed["deadline"]["state"] == "on_track" and listed["deadline"]["effective_due_at"]
    staff.post(f"/api/admin/compliance/data-requests/{row.id}/handle", json={"action": "done", "note": "corrected"})
    db.expire_all()
    closed = db.get(DataRequest, row.id)
    assert closed.completed_at is not None and service.deadline_state(closed, settings)["state"] == "closed"


def test_nothing_extends_by_itself_and_an_extension_is_a_recorded_staff_decision(client, fake, offers, db, staff):
    sign_up(client, fake, "extend@example.com")
    post_request(client, "objection")
    row = db.scalar(select(DataRequest))
    overdue = service.deadline_state(row, get_settings(), row.base_due_at + timedelta(days=5))
    assert overdue["state"] == "overdue" and overdue["extended_due_at"] is None  # overdue stays overdue
    url = f"/api/admin/compliance/data-requests/{row.id}"
    assert (
        staff.post(f"{url}/extend", json={"months": 3, "reason": "complex request with many systems"}).status_code
        == 422
    )
    assert staff.post(f"{url}/extend", json={"months": 2, "reason": "short"}).status_code == 422
    extended = staff.post(f"{url}/extend", json={"months": 2, "reason": "complex request with many systems"})
    assert extended.status_code == 200 and extended.json()["deadline"]["extension_notified_at"] is None
    db.expire_all()
    row = db.get(DataRequest, row.id)
    assert row.extended_due_at == service.add_months(row.base_due_at, 2)
    assert (
        staff.post(f"{url}/extend", json={"months": 1, "reason": "complex request with many systems"}).status_code
        == 409
    )
    assert staff.post(f"{url}/extension-notified").json()["deadline"]["extension_notified_at"]
    assert staff.post(f"{url}/extension-notified").status_code == 200  # idempotent
    actions = [a for a in db.scalars(select(AuditLog.action).where(AuditLog.entity_id == str(row.id)))]
    assert actions.count("data_request.extended") == 1 and actions.count("data_request.extension_notified") == 1


def test_a_closed_request_cannot_be_extended_and_notifying_needs_an_extension(client, fake, offers, db, staff):
    sign_up(client, fake, "closed@example.com")
    post_request(client, "restriction")
    row = db.scalar(select(DataRequest))
    url = f"/api/admin/compliance/data-requests/{row.id}"
    assert staff.post(f"{url}/extension-notified").status_code == 409
    staff.post(f"{url}/handle", json={"action": "reject", "note": "not applicable"})
    assert (
        staff.post(f"{url}/extend", json={"months": 1, "reason": "complex request with many systems"}).status_code
        == 409
    )


def test_the_deadline_routes_need_an_administrator(client):
    assert client.post(f"/api/admin/compliance/data-requests/{uuid.uuid4()}/extend", json={}).status_code in (401, 403)


# ------------------------------------------------------------------------------------------ release gates


def test_accounts_cannot_start_in_production_while_the_header_blocker_is_open():
    from app import release_gates

    assert release_gates.ACCOUNT_HEADER_LAYOUT_FIXED is False  # flip only together with the header fix
    with pytest.raises(ValidationError) as error:
        _production(customer_accounts_enabled=True)
    assert "BLOCKER-ACC-HEADER-01" in str(error.value)
    assert release_gates.open_blockers(customer_accounts_enabled=False) == []


def test_accounts_or_billing_need_the_owner_attestation_that_mail_delivery_was_verified():
    for overrides in ({"customer_accounts_enabled": True}, {"billing_provider": "sandbox"}):
        with pytest.raises(ValidationError) as error:
            _production(**overrides)
        assert "EMAIL_DELIVERY_VERIFIED" in str(error.value)
    with pytest.raises(ValidationError) as error:  # the attestation alone does not open the gate
        _production(customer_accounts_enabled=True, email_delivery_verified=True)
    assert "EMAIL_DELIVERY_VERIFIED" not in str(error.value) and "BLOCKER-ACC-HEADER-01" in str(error.value)
