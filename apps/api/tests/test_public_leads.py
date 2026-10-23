import time

import pytest
from sqlalchemy import func, select

from app.models import AuditLog, Lead
from app.spam import issue_form_token
from tests.conftest import lead_payload, valid_token


def _count(db) -> int:
    return db.scalar(select(func.count()).select_from(Lead))


def test_valid_submission_creates_lead(client, db):
    response = client.post("/api/public/leads", json=lead_payload())
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "received"
    assert len(body["reference"]) == 8

    lead = db.scalar(select(Lead))
    assert lead.reference == body["reference"]
    assert lead.status == "NEW"
    assert lead.service == "seo"
    assert lead.email == "test.user@example.com"  # normalised
    assert lead.phone == "+359 88 123 4567"
    assert lead.privacy_acknowledged_at is not None
    assert lead.privacy_notice_version
    assert lead.marketing_consent is False and lead.marketing_consent_at is None
    assert lead.ip_hash and "testclient" not in lead.ip_hash  # raw IP is never stored
    assert db.scalar(select(AuditLog.action)) == "lead.created"


def test_marketing_consent_is_recorded_separately(client, db):
    client.post("/api/public/leads", json=lead_payload(marketing_consent=True))
    lead = db.scalar(select(Lead))
    assert lead.marketing_consent is True
    assert lead.marketing_consent_at is not None


def test_optional_phone_can_be_empty(client, db):
    assert client.post("/api/public/leads", json=lead_payload(phone="")).status_code == 201
    assert db.scalar(select(Lead.phone)) is None


def test_missing_fields_are_rejected_with_field_errors(client, db):
    response = client.post("/api/public/leads", json={"form_token": valid_token()})
    assert response.status_code == 422
    fields = {e["field"] for e in response.json()["errors"]}
    assert {"service", "name", "company", "email", "message", "privacy_acknowledged"} <= fields
    assert _count(db) == 0


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"email": "not-an-email"}, "email"),
        ({"privacy_acknowledged": False}, "privacy_acknowledged"),
        ({"service": "crypto"}, "service"),
        ({"phone": "call me maybe"}, "phone"),
        ({"message": "Кратко"}, "message"),
        ({"name": "A"}, "name"),
        ({"name": "Visit https://spam.example"}, "name"),
        ({"company": "<script>alert(1)</script>"}, "company"),
        ({"message": "Съобщение с контролен символ \x07 вътре, достатъчно дълго."}, "message"),
        ({"message": "x" * 5001}, "message"),
        ({"unexpected": "field"}, "unexpected"),
    ],
)
def test_invalid_submissions_are_rejected(client, db, overrides, field):
    response = client.post("/api/public/leads", json=lead_payload(**overrides))
    assert response.status_code == 422, response.text
    errors = response.json()["errors"]
    assert field in {e["field"] for e in errors}
    assert all(e["message"] for e in errors)
    assert _count(db) == 0


def test_validation_messages_are_in_bulgarian(client):
    response = client.post("/api/public/leads", json=lead_payload(email="bad"))
    messages = [e["message"] for e in response.json()["errors"] if e["field"] == "email"]
    assert messages == ["Въведете валиден имейл адрес."]


def test_honeypot_returns_success_but_stores_nothing(client, db):
    response = client.post("/api/public/leads", json=lead_payload(website="http://bot.example"))
    assert response.status_code == 201
    assert _count(db) == 0


@pytest.mark.parametrize(
    "token",
    [
        "",
        "garbage",
        "123.abc.def",
        issue_form_token("another-secret-key-that-is-long-enough-123456"),
    ],
)
def test_invalid_form_tokens_are_rejected(client, db, token):
    response = client.post("/api/public/leads", json=lead_payload(form_token=token))
    assert response.status_code == 400
    assert _count(db) == 0


def test_submission_that_is_too_fast_is_rejected(client, db):
    response = client.post("/api/public/leads", json=lead_payload(form_token=valid_token(age_seconds=0)))
    assert response.status_code == 400
    assert _count(db) == 0


def test_expired_form_token_is_rejected(client, db):
    response = client.post("/api/public/leads", json=lead_payload(form_token=valid_token(age_seconds=8000)))
    assert response.status_code == 400


def test_form_token_endpoint_issues_usable_token(client, db, settings):
    token = client.get("/api/public/form-token").json()["token"]
    issued = int(token.split(".")[0])
    assert abs(issued - time.time()) < 5
    assert client.get("/api/public/form-token").headers["Cache-Control"] == "no-store"


def test_link_spam_is_rejected(client, db):
    message = "Вижте " + " ".join(f"https://spam{i}.example" for i in range(5))
    response = client.post("/api/public/leads", json=lead_payload(message=message))
    assert response.status_code == 400
    assert _count(db) == 0


def test_contact_rate_limit(client, db):
    for _ in range(5):
        assert client.post("/api/public/leads", json=lead_payload()).status_code == 201
    response = client.post("/api/public/leads", json=lead_payload())
    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) > 0
    assert _count(db) == 5


def test_rate_limit_is_per_client_ip(client, db):
    for _ in range(5):
        client.post("/api/public/leads", json=lead_payload(), headers={"X-Forwarded-For": "198.51.100.1"})
    blocked = client.post("/api/public/leads", json=lead_payload(), headers={"X-Forwarded-For": "198.51.100.1"})
    other = client.post("/api/public/leads", json=lead_payload(), headers={"X-Forwarded-For": "198.51.100.2"})
    assert blocked.status_code == 429
    assert other.status_code == 201


def test_global_contact_limit_caps_spoofed_ips(client, db, monkeypatch, settings):
    monkeypatch.setattr(settings, "contact_global_rate_limit", 3)
    codes = [
        client.post(
            "/api/public/leads", json=lead_payload(), headers={"X-Forwarded-For": f"198.51.100.{i}"}
        ).status_code
        for i in range(4)
    ]
    assert codes == [201, 201, 201, 429]


def test_sql_injection_payload_is_stored_as_plain_text(client, db):
    evil = "Robert'); DROP TABLE leads;-- и още текст за дължина"
    response = client.post("/api/public/leads", json=lead_payload(message=evil, company="O'Reilly ООД"))
    assert response.status_code == 201
    lead = db.scalar(select(Lead))
    assert lead.message == evil
    assert lead.company == "O'Reilly ООД"
    assert _count(db) == 1


def test_public_api_does_not_expose_leads(client, make_lead):
    make_lead()
    assert client.get("/api/public/leads").status_code == 405
