"""AI Managed Services inquiries, lead language and bilingual (bg/en) API messages."""

from alembic import command
from sqlalchemy import create_engine, select, text

from app.ai.base import LeadTriageInput
from app.ai.mock import MockProvider
from app.models import AuditLog, Lead
from app.notifications import customer_acknowledgement
from tests.conftest import TEST_DATABASE_URL, alembic_config, lead_payload, recreate_database


def ai_details(**overrides) -> dict:
    details = {
        "sector": "ecommerce",
        "system_types": ["customer_support", "knowledge_assistant"],
        "agents_count": "2_5",
        "ai_provider": "Anthropic Claude, OpenAI",
        "hosting": "public_cloud",
        "support_interests": ["monitoring", "cost_optimization"],
        "communication_language": "en",
        "additional_notes": "Answers got worse after the last prompt change; costs are rising.",
    }
    details.update(overrides)
    return details


def ai_lead(**overrides) -> dict:
    return lead_payload(
        service="ai_managed",
        message="We run two AI support agents and need monitoring and regular quality reviews.",
        locale="en",
        ai_managed=ai_details(),
        **overrides,
    )


# --------------------------------------------------------------------------- persistence


def test_ai_managed_inquiry_is_stored_with_details_and_language(client, db):
    response = client.post("/api/public/leads", json=ai_lead(), headers={"Accept-Language": "en"})
    assert response.status_code == 201, response.text
    assert response.json()["message"].startswith("Thank you")

    lead = db.scalar(select(Lead))
    assert lead.service == "ai_managed"
    assert lead.locale == "en"
    assert lead.service_details["kind"] == "ai_managed"
    assert lead.service_details["system_types"] == ["customer_support", "knowledge_assistant"]
    assert lead.service_details["communication_language"] == "en"

    audit = db.scalar(select(AuditLog).where(AuditLog.action == "lead.created"))
    assert audit.details["locale"] == "en"


def test_bulgarian_inquiry_defaults_to_bg(client, db):
    response = client.post("/api/public/leads", json=lead_payload())
    assert response.status_code == 201
    assert response.json()["message"].startswith("Благодарим")
    lead = db.scalar(select(Lead))
    assert lead.locale == "bg"
    assert lead.service_details is None


def test_unsupported_locale_is_rejected(client):
    response = client.post("/api/public/leads", json=lead_payload(locale="de"))
    assert response.status_code == 422
    assert "locale" in {e["field"] for e in response.json()["errors"]}


def test_ai_details_are_only_accepted_for_ai_managed(client, db):
    response = client.post("/api/public/leads", json=lead_payload(service="seo", ai_managed=ai_details()))
    assert response.status_code == 422
    assert db.scalar(select(Lead)) is None


def test_malformed_ai_details_are_rejected(client):
    cases = [
        ai_details(system_types=[]),
        ai_details(support_interests=["unlimited_support"]),
        ai_details(sector="casino"),
        ai_details(communication_language="fr"),
        {**ai_details(), "api_key": "anything"},
    ]
    for details in cases:
        payload = ai_lead()
        payload["ai_managed"] = details
        response = client.post("/api/public/leads", json=payload)
        assert response.status_code == 422, details


def test_secrets_are_rejected_in_free_text(client, db):
    leaked = [
        {"message": "Our key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789 please check the agent."},
        {"ai_managed": ai_details(additional_notes="password: Sup3rSecret!value for the admin panel")},
        {"ai_managed": ai_details(ai_provider="OpenAI sk-proj-abcdefghijklmnopqrstuvwxyz012345")},
    ]
    for override in leaked:
        payload = ai_lead()
        payload.update(override)
        response = client.post("/api/public/leads", json=payload, headers={"Accept-Language": "en"})
        assert response.status_code == 422, override
        messages = " ".join(e["message"] for e in response.json()["errors"])
        assert "password, API key or token" in messages
    assert db.scalar(select(Lead)) is None


# --------------------------------------------------------------------------- localized errors


def test_validation_errors_follow_accept_language(client):
    bad = lead_payload(email="not-an-email", privacy_acknowledged=False)
    en = client.post("/api/public/leads", json=bad, headers={"Accept-Language": "en-GB,en;q=0.9"}).json()
    bg = client.post("/api/public/leads", json=bad).json()
    assert en["detail"] == "Please correct the highlighted fields."
    assert bg["detail"] == "Моля, коригирайте маркираните полета."
    en_privacy = next(e["message"] for e in en["errors"] if e["field"] == "privacy_acknowledged")
    assert en_privacy.isascii()
    bg_privacy = next(e["message"] for e in bg["errors"] if e["field"] == "privacy_acknowledged")
    assert "поверителност" in bg_privacy


def test_unknown_language_falls_back_to_bulgarian(client):
    response = client.get("/api/public/does-not-exist", headers={"Accept-Language": "de-DE"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Ресурсът не е намерен."
    english = client.get("/api/public/does-not-exist", headers={"Accept-Language": "en"})
    assert english.json()["detail"] == "The resource was not found."


def test_nested_ai_field_errors_use_flat_field_names(client):
    payload = ai_lead()
    payload["ai_managed"] = ai_details(system_types=[])
    errors = client.post("/api/public/leads", json=payload, headers={"Accept-Language": "en"}).json()["errors"]
    assert "ai_system_types" in {e["field"] for e in errors}


# --------------------------------------------------------------------------- admin


def test_admin_filters_by_language_and_sees_ai_details(admin_client, make_lead, client):
    make_lead(email="bg@example.com")
    created = client.post("/api/public/leads", json=ai_lead(email="en@example.com"))
    assert created.status_code == 201

    english = admin_client.get("/api/admin/leads", params={"locale": "en"}).json()
    assert [i["email"] for i in english["items"]] == ["en@example.com"]
    assert english["items"][0]["locale"] == "en"
    assert admin_client.get("/api/admin/leads", params={"locale": "bg"}).json()["total"] == 1
    assert admin_client.get("/api/admin/leads", params={"service": "ai_managed"}).json()["total"] == 1
    assert admin_client.get("/api/admin/leads", params={"locale": "xx"}).status_code == 422

    lead_id = english["items"][0]["id"]
    detail = admin_client.get(f"/api/admin/leads/{lead_id}").json()
    assert detail["locale"] == "en"
    assert detail["ai_managed"]["agents_count"] == "2_5"
    assert detail["ai_managed"]["support_interests"] == ["monitoring", "cost_optimization"]

    stats = admin_client.get("/api/admin/dashboard/stats").json()
    assert stats["by_locale"] == {"bg": 1, "en": 1}


def test_ai_details_are_not_exposed_publicly(client):
    response = client.post("/api/public/leads", json=ai_lead())
    body = response.json()
    assert set(body) == {"status", "reference", "message", "inquiry_type"}
    assert client.get("/api/admin/leads").status_code == 401


def test_admin_can_recategorise_lead_to_ai_managed(admin_client, make_lead):
    make_lead()
    lead_id = admin_client.get("/api/admin/leads").json()["items"][0]["id"]
    response = admin_client.patch(f"/api/admin/leads/{lead_id}", json={"service": "ai_managed"})
    assert response.status_code == 200, response.text
    assert response.json()["service"] == "ai_managed"


# --------------------------------------------------------------------------- triage, notifications


def test_mock_triage_recognises_ai_managed_in_both_languages():
    provider = MockProvider()
    for message in (
        "Нашият AI агент дава грешни отговори, а разходите за токени растат.",
        "Our AI agent gives wrong answers since the last prompt change and token costs keep growing.",
    ):
        triage = provider.triage_lead(LeadTriageInput(service="other", message=message))
        assert triage.suggested_service == "ai_managed", message


def test_customer_acknowledgement_templates_exist_for_both_languages():
    subject_bg, body_bg = customer_acknowledgement("bg", "ABC123")
    subject_en, body_en = customer_acknowledgement("en", "ABC123")
    assert "ABC123" in subject_bg and "ABC123" in body_en
    assert "Thank you" in body_en
    assert "Благодарим" in body_bg
    assert customer_acknowledgement("de", "X")[0] == customer_acknowledgement("bg", "X")[0]


# --------------------------------------------------------------------------- migration 0004


def test_migration_0004_backfills_locale_and_downgrades_ai_managed():
    url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/acs_migration_0004"
    recreate_database("acs_migration_0004")
    cfg = alembic_config(url)
    command.upgrade(cfg, "0003")
    engine = create_engine(url)
    insert = (
        "INSERT INTO leads (id, service, submitted_service, name, company, email, message, status, source, "
        "inquiry_type, privacy_acknowledged_at, privacy_notice_version, marketing_consent, created_at, updated_at) "
        "VALUES (gen_random_uuid(), '{service}', '{service}', 'Стар', 'Стара ООД', '{email}', "
        "'Запис отпреди миграцията', 'NEW', 'website_contact_form', 'contact', now(), 'v1', false, now(), now())"
    )
    with engine.begin() as conn:
        conn.execute(text(insert.format(service="seo", email="old@example.com")))
    command.upgrade(cfg, "head")
    with engine.begin() as conn:
        assert conn.execute(text("SELECT locale, service_details FROM leads")).one() == ("bg", None)
        conn.execute(text(insert.format(service="ai_managed", email="new@example.com")))
    command.downgrade(cfg, "0003")
    with engine.connect() as conn:
        services = sorted(s for (s,) in conn.execute(text("SELECT service FROM leads")))
    assert services == ["other", "seo"]
    engine.dispose()
