"""AI Managed Services v2: optional qualification answers and the admin triage (suggested level, readiness)."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.models import Lead
from app.services.ai_managed_qualification import qualify
from tests.test_ai_managed_and_locale import ai_details, ai_lead


def lead_with(answers: dict, **overrides) -> dict:
    return {**ai_lead(**overrides), "ai_managed": answers}


READY = {
    "production_status": "production",
    "technical_owner": "yes",
    "access_readiness": "read_access",
    "test_environment": "yes",
}


def test_existing_flow_without_qualification_answers_still_works(client, db):
    """Older clients send none of the new fields: the inquiry is stored and triaged as "unknown"."""
    response = client.post("/api/public/leads", json=ai_lead())
    assert response.status_code == 201, response.text
    details = db.scalar(select(Lead)).service_details
    assert details["kind"] == "ai_managed" and details["desired_level"] is None
    assert details["qualification"]["readiness"] == "unknown"
    assert details["qualification"]["suggested_level"] == "essential"


def test_qualification_answers_are_stored_and_triaged(client, db):
    answers = ai_details(
        desired_level="managed",
        agents_count="6_20",
        system_types=["workflow_automation"],
        data_sensitivity="personal",
        change_frequency="weekly",
        response_needs="business_hours",
        **READY,
    )
    response = client.post("/api/public/leads", json=lead_with(answers))
    assert response.status_code == 201, response.text
    q = db.scalar(select(Lead)).service_details["qualification"]
    # agents 6–20 (2) + acting systems (1) + personal data (1) + weekly changes (2) + in production (1) = 7.
    assert q["points"] == 7 and q["suggested_level"] == "advanced"
    assert q["reasons"] == [
        "agents_6_20",
        "acting_or_custom_systems",
        "sensitive_data",
        "frequent_changes",
        "in_production",
    ]
    assert q["readiness"] == "ready" and q["blockers"] == []
    assert q["desired_level"] == "managed" and q["matches_desired"] is False


@pytest.mark.parametrize(
    ("answers", "readiness", "blockers"),
    [
        ({**READY, "production_status": "development"}, "not_ready", ["not_in_operation"]),
        ({**READY, "access_readiness": "not_possible"}, "not_ready", ["no_access"]),
        ({**READY, "technical_owner": "no"}, "needs_preparation", ["no_technical_owner"]),
        ({**READY, "access_readiness": "needs_approval"}, "needs_preparation", ["access_not_confirmed"]),
        ({"production_status": "pilot", "technical_owner": "yes"}, "unknown", []),
        (READY, "ready", []),
    ],
)
def test_readiness_rules(answers, readiness, blockers):
    result = qualify(ai_details(**answers))
    assert result["readiness"] == readiness and result["blockers"] == blockers


def test_a_test_environment_is_required_only_above_the_essential_level():
    no_test_env = {**READY, "test_environment": "no"}
    small = qualify(ai_details(agents_count="1", support_interests=["monitoring"], **no_test_env))
    assert small["suggested_level"] == "essential" and small["readiness"] == "ready"
    larger = qualify(
        ai_details(agents_count="over_20", response_needs="faster", **{**READY, "test_environment": "unknown"})
    )
    assert larger["suggested_level"] == "advanced"
    assert larger["readiness"] == "needs_preparation" and larger["blockers"] == ["no_test_environment"]


def test_level_bands_are_fixed():
    assert qualify(ai_details(agents_count="1", support_interests=["monitoring"]))["suggested_level"] == "essential"
    # 2–5 agents (1) + weekly changes (2) = 3 → managed.
    assert qualify(ai_details(agents_count="2_5", change_frequency="weekly"))["suggested_level"] == "managed"
    assert qualify(ai_details(agents_count="over_20", response_needs="faster", support_interests=["full_managed"]))[
        "suggested_level"
    ] == "advanced"
    assert qualify(ai_details(desired_level="unsure"))["matches_desired"] is None


@pytest.mark.parametrize(
    "field",
    ["desired_level", "production_status", "technical_owner", "access_readiness", "test_environment",
     "data_sensitivity", "change_frequency", "response_needs"],
)
def test_unknown_qualification_values_are_rejected(client, db, field):
    response = client.post("/api/public/leads", json=lead_with(ai_details(**{field: "24_7"})))
    assert response.status_code == 422
    assert db.scalar(select(Lead)) is None


def test_admin_sees_and_filters_by_the_triage(admin_client, client, db):
    big = ai_details(agents_count="over_20", response_needs="faster", support_interests=["full_managed"], **READY)
    small = ai_details(agents_count="1", support_interests=["monitoring"])
    assert client.post("/api/public/leads", json=lead_with(big, email="big@example.com")).status_code == 201
    assert client.post("/api/public/leads", json=lead_with(small, email="small@example.com")).status_code == 201

    advanced = admin_client.get("/api/admin/leads", params={"ams_level": "advanced"}).json()
    assert [item["email"] for item in advanced["items"]] == ["big@example.com"]
    assert advanced["items"][0]["ams_level"] == "advanced" and advanced["items"][0]["ams_readiness"] == "ready"
    unknown = admin_client.get("/api/admin/leads", params={"ams_readiness": "unknown"}).json()
    assert [item["email"] for item in unknown["items"]] == ["small@example.com"]
    assert admin_client.get("/api/admin/leads", params={"ams_level": "platinum"}).status_code == 422

    lead = db.scalar(select(Lead).where(Lead.email == "big@example.com"))
    detail = admin_client.get(f"/api/admin/leads/{lead.id}").json()
    assert detail["ai_managed"]["response_needs"] == "faster"
    assert detail["ai_managed_qualification"]["suggested_level"] == "advanced"
    assert "qualification" not in detail["ai_managed"]


def test_older_inquiries_get_a_triage_computed_on_read(admin_client, client, db):
    client.post("/api/public/leads", json=ai_lead())
    lead = db.scalar(select(Lead))
    lead.service_details = {k: v for k, v in lead.service_details.items() if k != "qualification"}
    db.commit()
    detail = admin_client.get(f"/api/admin/leads/{lead.id}").json()
    assert detail["ai_managed_qualification"]["readiness"] == "unknown"
    assert detail["ams_level"] is None  # the list filter only covers stored triage


def test_triage_is_never_public(client):
    body = client.post("/api/public/leads", json=lead_with(ai_details(**READY))).json()
    assert set(body) == {"status", "reference", "message", "inquiry_type"}
