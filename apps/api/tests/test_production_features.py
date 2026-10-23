"""Production-hardening features: quote requests, error envelope, persistent lockout, idle sessions,
logout-all, re-categorisation, optimistic concurrency, access auditing, audit search, retention API,
and the complete visitor → admin → audit lifecycle verified directly in PostgreSQL."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text

from app.cli import SYNTHETIC_SOURCE, ensure_admin, seed_synthetic_data
from app.models import AdminSession, AdminUser, AuditLog, Lead, utcnow
from app.services import leads as lead_service
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, lead_payload


def quote_payload(**overrides) -> dict:
    payload = lead_payload(service="ai_tools", message="Искаме оферта за AI асистент за клиентски въпроси.")
    payload.update({"platform": "shopify", "budget_range": "2500_10000", "timeline": "within_3_months",
                    "website_url": "example-shop.bg"})
    payload.update(overrides)
    return payload


def _actions(db, entity_id: str | None = None) -> list[str]:
    stmt = select(AuditLog.action).order_by(AuditLog.id)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    return [a for (a,) in db.execute(stmt)]


def _first_lead_id(admin_client) -> str:
    return admin_client.get("/api/admin/leads").json()["items"][0]["id"]


# --------------------------------------------------------------------------- quote requests


def test_quote_request_is_persisted_with_structured_fields(client, db):
    response = client.post("/api/public/quote-requests", json=quote_payload())
    assert response.status_code == 201, response.text
    assert response.json()["inquiry_type"] == "quote"
    lead = db.scalar(select(Lead))
    assert lead.inquiry_type == "quote"
    assert (lead.platform, lead.budget_range, lead.timeline) == ("shopify", "2500_10000", "within_3_months")
    assert lead.website_url == "https://example-shop.bg"  # normalised
    assert lead.service == lead.submitted_service == "ai_tools"
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "lead.created"))
    assert entry.details["inquiry_type"] == "quote"


def test_contact_inquiry_defaults(client, db):
    assert client.post("/api/public/leads", json=lead_payload()).json()["inquiry_type"] == "contact"
    lead = db.scalar(select(Lead))
    assert lead.inquiry_type == "contact" and lead.platform is None and lead.website_url is None


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"platform": "magento"}, "platform"),
        ({"budget_range": "1 million"}, "budget_range"),
        ({"timeline": "yesterday"}, "timeline"),
        ({"website_url": "not a url"}, "website_url"),
        ({"website_url": "javascript:alert(1)"}, "website_url"),
        ({"website_url": "https://" + "a" * 300 + ".bg"}, "website_url"),
    ],
)
def test_invalid_quote_requests_are_rejected(client, db, overrides, field):
    response = client.post("/api/public/quote-requests", json=quote_payload(**overrides))
    assert response.status_code == 422, response.text
    assert field in {e["field"] for e in response.json()["errors"]}
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_quote_fields_are_required(client):
    payload = quote_payload()
    for field in ("platform", "budget_range", "timeline"):
        payload.pop(field)
    fields = {e["field"] for e in client.post("/api/public/quote-requests", json=payload).json()["errors"]}
    assert {"platform", "budget_range", "timeline"} <= fields


def test_contact_endpoint_rejects_quote_only_fields(client):
    response = client.post("/api/public/leads", json=lead_payload(platform="shopify"))
    assert response.status_code == 422


def test_quote_and_contact_share_the_rate_limit(client):
    for i in range(5):
        endpoint = "/api/public/quote-requests" if i % 2 else "/api/public/leads"
        body = quote_payload() if i % 2 else lead_payload()
        assert client.post(endpoint, json=body).status_code == 201
    assert client.post("/api/public/quote-requests", json=quote_payload()).status_code == 429


def test_quote_honeypot_stores_nothing(client, db):
    assert client.post("/api/public/quote-requests", json=quote_payload(website="spam")).status_code == 201
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


# --------------------------------------------------------------------------- error envelope


def test_error_envelope_has_code_and_request_id(client, admin_user):
    response = client.get("/api/admin/leads", headers={"X-Request-ID": "abcdef1234567890"})
    body = response.json()
    assert response.status_code == 401
    assert body["code"] == "unauthorized"
    assert body["request_id"] == "abcdef1234567890" == response.headers["X-Request-ID"]
    assert body["detail"]


@pytest.mark.parametrize(
    ("method", "path", "kwargs", "status_code", "code"),
    [
        ("post", "/api/public/leads", {"json": {}}, 422, "validation_error"),
        ("post", "/api/public/leads", {"json": lead_payload(form_token="x")}, 400, "form_token_invalid"),
        ("post", "/api/public/leads", {"json": lead_payload(), "headers": {"Origin": "https://evil.example"}},
         403, "origin_rejected"),
        ("post", "/api/public/leads", {"content": b"{" + b" " * 70000 + b"}",
                                       "headers": {"Content-Type": "application/json"}}, 413, "payload_too_large"),
        ("get", "/api/public/nope", {}, 404, "not_found"),
    ],
)
def test_error_codes(client, method, path, kwargs, status_code, code):
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == status_code
    assert response.json()["code"] == code


def test_admin_error_codes(admin_client):
    from uuid import uuid4

    assert admin_client.get(f"/api/admin/leads/{uuid4()}").json()["code"] == "lead_not_found"
    csrf = admin_client.headers.pop("X-CSRF-Token")
    assert admin_client.post("/api/admin/auth/logout-all").json()["code"] == "csrf_failed"
    admin_client.headers["X-CSRF-Token"] = csrf


# --------------------------------------------------------------------------- lockout & sessions


def _login(client, email=ADMIN_EMAIL, password=ADMIN_PASSWORD):
    return client.post("/api/admin/auth/login", json={"email": email, "password": password})


def test_account_locks_after_consecutive_failures_and_persists(client, admin_user, db):
    for _ in range(5):
        assert _login(client, password="wrong-password-1").status_code == 401
    locked = _login(client)  # correct password, but the account is locked
    assert locked.status_code == 429
    assert locked.json()["code"] == "rate_limited"
    assert int(locked.headers["Retry-After"]) > 0

    user = db.scalar(select(AdminUser).where(AdminUser.email == ADMIN_EMAIL))
    db.refresh(user)
    assert user.locked_until is not None and user.locked_until > utcnow()
    assert "auth.account_locked" in _actions(db)

    # Persistence: the in-memory limiter is irrelevant; expire the lock in the database.
    from app.rate_limit import limiter

    limiter.reset()
    user.locked_until = utcnow() - timedelta(seconds=1)
    db.commit()
    assert _login(client).status_code == 200
    db.refresh(user)
    assert user.failed_login_count == 0 and user.locked_until is None


def test_unknown_accounts_get_identical_lockout_behaviour(client, admin_user):
    codes = [_login(client, email="ghost@example.com", password="x").status_code for _ in range(6)]
    assert codes == [401, 401, 401, 401, 401, 429]  # same as for a real account (5 failures, then locked)


def test_successful_login_resets_failure_counter(client, admin_user, db):
    for _ in range(3):
        _login(client, password="wrong-password-1")
    assert _login(client).status_code == 200
    assert db.scalar(select(AdminUser.failed_login_count).where(AdminUser.email == ADMIN_EMAIL)) == 0


def test_idle_session_is_revoked(admin_client, db):
    session = db.scalar(select(AdminSession))
    session.last_seen_at = utcnow() - timedelta(hours=2)
    db.commit()
    response = admin_client.get("/api/admin/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "session_expired"
    db.refresh(session)
    assert session.revoked_at is not None
    assert "auth.session_idle_timeout" in _actions(db)


def test_logout_all_revokes_every_session(client, admin_user, db):
    from app.main import app

    with TestClient(app) as other:
        assert _login(other).status_code == 200
        assert _login(client).status_code == 200
        client.headers["X-CSRF-Token"] = client.cookies.get("acs_csrf")
        sessions = client.get("/api/admin/auth/sessions").json()
        assert len(sessions) == 2 and sum(s["current"] for s in sessions) == 1

        response = client.post("/api/admin/auth/logout-all")
        assert response.status_code == 200
        assert response.json()["sessions_revoked"] == 2
        assert other.get("/api/admin/auth/me").status_code == 401
    assert "auth.logout_all" in _actions(db)


# --------------------------------------------------------------------------- lead management


def test_service_recategorisation_keeps_original_and_is_audited(admin_client, make_lead, db):
    make_lead(service="seo")
    lead_id = _first_lead_id(admin_client)
    response = admin_client.patch(f"/api/admin/leads/{lead_id}", json={"service": "analytics"})
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "analytics" and body["submitted_service"] == "seo"
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "lead.service_changed"))
    assert entry.details == {"from": "seo", "to": "analytics"}


def test_update_requires_a_change(admin_client, make_lead):
    make_lead()
    response = admin_client.patch(f"/api/admin/leads/{_first_lead_id(admin_client)}", json={})
    assert response.status_code == 422


def test_optimistic_concurrency_rejects_stale_updates(admin_client, make_lead, db):
    make_lead()
    lead_id = _first_lead_id(admin_client)
    assert admin_client.patch(f"/api/admin/leads/{lead_id}", json={"status": "CONTACTED"}).status_code == 200

    stale = admin_client.patch(
        f"/api/admin/leads/{lead_id}", json={"status": "LOST", "expected_status": "NEW"}
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "status_conflict"
    assert db.scalar(select(Lead.status)) == "CONTACTED"

    fresh = admin_client.patch(
        f"/api/admin/leads/{lead_id}", json={"status": "QUALIFIED", "expected_status": "CONTACTED"}
    )
    assert fresh.status_code == 200 and fresh.json()["status"] == "QUALIFIED"


def test_viewing_personal_data_is_audited_and_throttled(admin_client, make_lead, db):
    make_lead()
    lead_id = _first_lead_id(admin_client)
    for _ in range(3):
        admin_client.get(f"/api/admin/leads/{lead_id}")
    assert _actions(db, lead_id).count("lead.viewed") == 1


def test_filter_leads_by_inquiry_type(admin_client, client):
    client.post("/api/public/leads", json=lead_payload())
    client.post("/api/public/quote-requests", json=quote_payload())
    quotes = admin_client.get("/api/admin/leads", params={"inquiry_type": "quote"}).json()
    assert quotes["total"] == 1 and quotes["items"][0]["inquiry_type"] == "quote"
    stats = admin_client.get("/api/admin/dashboard/stats").json()
    assert stats["by_inquiry_type"] == {"contact": 1, "quote": 1}


# --------------------------------------------------------------------------- audit search


def test_audit_search_filters_and_paginates(admin_client, make_lead):
    make_lead()
    make_lead(email="second@example.com")
    lead_id = _first_lead_id(admin_client)
    admin_client.patch(f"/api/admin/leads/{lead_id}", json={"status": "WON"})

    by_action = admin_client.get("/api/admin/audit", params={"action": "lead.status_changed"}).json()
    assert by_action["total"] == 1 and by_action["items"][0]["entity_id"] == lead_id

    by_prefix = admin_client.get("/api/admin/audit", params={"action_prefix": "lead."}).json()
    assert {e["action"] for e in by_prefix["items"]} <= {"lead.created", "lead.status_changed", "lead.viewed"}

    by_entity = admin_client.get("/api/admin/audit", params={"entity_id": lead_id}).json()
    assert all(e["entity_id"] == lead_id for e in by_entity["items"])

    by_actor = admin_client.get("/api/admin/audit", params={"actor": "website"}).json()
    assert by_actor["total"] == 2

    paged = admin_client.get("/api/admin/audit", params={"page_size": 1, "page": 2}).json()
    assert len(paged["items"]) == 1 and paged["page"] == 2

    assert admin_client.get("/api/admin/audit", params={"page_size": 500}).status_code == 422


def test_audit_search_wildcards_are_literal(admin_client, make_lead):
    make_lead()
    assert admin_client.get("/api/admin/audit", params={"action_prefix": "%"}).json()["total"] == 0


# --------------------------------------------------------------------------- retention API


def test_retention_preview_and_confirmed_run(admin_client, make_lead, db):
    make_lead(email="old@example.com")
    make_lead(email="fresh@example.com")
    old = db.scalar(select(Lead).where(Lead.email == "old@example.com"))
    old.updated_at = utcnow() - timedelta(days=800)
    db.commit()

    preview = admin_client.get("/api/admin/retention").json()
    assert preview["leads_due"] == 1 and preview["lead_retention_days"] == 730
    assert db.scalar(select(func.count()).select_from(Lead)) == 2  # preview changes nothing

    assert admin_client.post("/api/admin/retention/run", json={"confirm": False}).status_code == 422
    assert admin_client.post("/api/admin/retention/run", json={}).status_code == 422

    run = admin_client.post("/api/admin/retention/run", json={"confirm": True})
    assert run.status_code == 200 and run.json()["leads_deleted"] == 1
    assert [e for (e,) in db.execute(select(Lead.email))] == ["fresh@example.com"]
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "retention.run"))
    assert entry.actor_label == ADMIN_EMAIL and entry.details["leads_deleted"] == 1


# --------------------------------------------------------------------------- seed data


def test_purge_synthetic_removes_only_seed_data(client, db):
    admin, _ = ensure_admin(db, "seed@example.com", "Seed-Password-2026", "Seed")
    seed_synthetic_data(db, admin)
    client.post("/api/public/leads", json=lead_payload())
    removed = lead_service.purge_synthetic(db, SYNTHETIC_SOURCE)
    assert removed == 7
    remaining = db.scalars(select(Lead)).all()
    assert len(remaining) == 1 and remaining[0].source == "website_contact_form"


def test_synthetic_seed_contains_quote_examples(db):
    admin, _ = ensure_admin(db, "seed2@example.com", "Seed-Password-2026", "Seed")
    seed_synthetic_data(db, admin)
    types = {t for (t,) in db.execute(select(Lead.inquiry_type))}
    assert types == {"contact", "quote"}


# --------------------------------------------------------------------------- end-to-end lifecycle


def test_full_lifecycle_visitor_to_audited_status_change(client, admin_user, db):
    """Visitor submits → API validates → PostgreSQL persists → admin logs in → views → changes
    status → audit events exist. Verified with raw SQL against PostgreSQL, not only via the API."""
    # 1. visitor: an invalid submission is rejected, a valid one is accepted
    assert client.post("/api/public/leads", json=lead_payload(email="bad")).status_code == 422
    created = client.post("/api/public/leads", json=lead_payload(company="Lifecycle ООД"))
    assert created.status_code == 201
    reference = created.json()["reference"]

    # 2. persisted in PostgreSQL
    row = db.execute(
        text(
            "SELECT id, status, company, inquiry_type FROM leads "
            "WHERE upper(substr(replace(id::text, '-', ''), 1, 8)) = :ref"
        ),
        {"ref": reference},
    ).one()
    assert (row.status, row.company, row.inquiry_type) == ("NEW", "Lifecycle ООД", "contact")
    lead_id = str(row.id)

    # 3. admin access is denied before login
    assert client.get(f"/api/admin/leads/{lead_id}").status_code == 401

    # 4. admin logs in, finds and views the lead
    assert _login(client).status_code == 200
    client.headers["X-CSRF-Token"] = client.cookies.get("acs_csrf")
    found = client.get("/api/admin/leads", params={"q": "Lifecycle"}).json()
    assert [i["reference"] for i in found["items"]] == [reference]
    assert client.get(f"/api/admin/leads/{lead_id}").json()["company"] == "Lifecycle ООД"

    # 5. admin changes the status (with concurrency guard)
    response = client.patch(f"/api/admin/leads/{lead_id}", json={"status": "QUALIFIED", "expected_status": "NEW"})
    assert response.status_code == 200

    # 6. audit trail in PostgreSQL
    events = db.execute(
        text("SELECT action, actor_label, details FROM audit_logs WHERE entity_id = :id ORDER BY id"),
        {"id": lead_id},
    ).all()
    assert [e.action for e in events] == ["lead.created", "lead.viewed", "lead.status_changed"]
    status_event = events[-1]
    assert status_event.actor_label == ADMIN_EMAIL
    assert status_event.details == {"from": "NEW", "to": "QUALIFIED"}
    assert db.execute(text("SELECT status FROM leads WHERE id = :id"), {"id": lead_id}).scalar() == "QUALIFIED"
