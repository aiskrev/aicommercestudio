"""AI Solution Builder: composition rules (parity with the web model) and the optional enquiry."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.models import AuditLog, Lead
from app.services import leads
from app.solution.model import (
    COMPOSITION_RULES,
    MODEL_VERSION,
    WORKFLOW_KEYS,
    composition_issues,
    decode,
    encode,
    minimum_approval,
    parse_code,
    summary,
)
from tests.conftest import valid_token

VECTORS = json.loads((Path(__file__).parent / "fixtures" / "solution_vectors.json").read_text(encoding="utf-8"))
URL = "/api/public/solution/enquiries"
SUPPORT = "2.faster_response.support_resolution.023.35.personal.before_external.managed_cloud.01"
INTAKE = "2.fewer_errors.document_intake.125.15.regulated.every_action.on_premise.10"
KNOWLEDGE = "2.knowledge_access.knowledge_answers.0.5.internal.sample_review.managed_cloud.00"


def enquiry(**overrides) -> dict:
    return {
        "model_version": MODEL_VERSION,
        "code": SUPPORT,
        "locale": "en",
        "name": "Test User",
        "email": "Test.User@example.com",
        "company": "Example Ltd",
        "message": "We would like to discuss a pilot.",
        "privacy_acknowledged": True,
        "marketing_consent": False,
        "website": "",
        "form_token": valid_token(),
        **overrides,
    }


# --- Rules ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize("vector", VECTORS["vectors"], ids=lambda v: v["code"][:40] or "empty")
def test_golden_vectors(vector):
    expected = vector["expected"]
    raw = parse_code(vector["code"])
    assert (raw is not None) == expected["parsed"]
    if raw:
        assert composition_issues(raw) == expected["issues"]
        assert minimum_approval(raw) == expected["minimum_approval"]
    config, _ = decode(vector["code"])
    assert (config is not None) == expected["valid"]
    if config:
        assert encode(config) == expected["code"]
        assert summary(config) == expected["summary"]


def test_vectors_cover_every_rule_and_the_current_model():
    assert VECTORS["model_version"] == MODEL_VERSION
    seen = {rule for v in VECTORS["vectors"] for rule in (v["expected"]["issues"] or [])}
    assert seen == set(COMPOSITION_RULES)
    assert {v["expected"]["summary"]["workflow"] for v in VECTORS["vectors"] if v["expected"]["valid"]} >= {
        "support_resolution",
        "document_intake",
        "proposal_drafting",
        "catalog_enrichment",
    }


def test_decode_rejects_unsafe_designs_instead_of_repairing_them():
    assert decode(SUPPORT.replace(".before_external.", ".none."))[1] == ["approval_below_minimum"]
    assert decode(INTAKE.replace(".10", ".00"))[1] == ["regulated_needs_residency"]
    assert decode(SUPPORT.replace(".023.", ".0023."))[1] == ["malformed"]
    assert decode(SUPPORT.replace(".managed_cloud.", ".."))[1] == ["incomplete"]
    # Links shared with schema 1 still open.
    assert decode(SUPPORT.replace("2.", "1.", 1))[0] is not None
    assert len(WORKFLOW_KEYS) == 8


def test_summary_shows_where_a_person_approves():
    config, _ = decode(INTAKE)
    assert summary(config)["approval_points"] == [
        "review:gate",
        "output:document_intake",
        "action:erp",
        "action:document_storage",
    ]


# --- Enquiry -------------------------------------------------------------------------------------------


def test_enquiry_creates_a_lead_with_the_design_derived_on_the_server(client, db):
    response = client.post(URL, json=enquiry())
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "received" and body["reference"]

    lead = db.scalar(select(Lead))
    assert lead.source == leads.SOLUTION_SOURCE and lead.service == "ai_agents" and lead.locale == "en"
    assert lead.email == "test.user@example.com" and lead.reference == body["reference"]
    details = lead.service_details
    assert details["kind"] == "solution" and details["code"] == SUPPORT and details["model_version"] == MODEL_VERSION
    assert details["agents"] == ["customer_support", "knowledge_assistant", "approval_supervisor"]
    assert details["complexity"] == {"band": "medium", "points": 8}
    assert details["approval_points"] == ["review:gate", "output:support_resolution"]
    assert lead.message.startswith("Enquiry from the AI solution builder") and "pilot" in lead.message

    created = db.scalar(select(AuditLog).where(AuditLog.action == "lead.created"))
    assert created.details["source"] == leads.SOLUTION_SOURCE and created.details["workflow"] == "support_resolution"
    assert "test.user@example.com" not in json.dumps(created.details)


@pytest.mark.parametrize(
    ("code", "rule"),
    [
        (SUPPORT.replace(".before_external.", ".none."), "approval_below_minimum"),
        (INTAKE.replace(".10", ".00"), "regulated_needs_residency"),
        (KNOWLEDGE.replace(".0.5.", ".06.5."), "orchestration_needs_agents"),
        (KNOWLEDGE.replace(".0.5.", ".3.5."), "workflow_capability"),
        (SUPPORT.replace(".023.", ".0023."), "malformed"),
        (SUPPORT.replace(".managed_cloud.", ".."), "incomplete"),
    ],
)
def test_incompatible_or_unsafe_designs_are_rejected_and_nothing_is_stored(client, db, code, rule):
    response = client.post(URL, json=enquiry(code=code))
    assert response.status_code == 422, response.text
    body = response.json()
    assert body["code"] == "solution_invalid"
    assert rule in [e["type"] for e in body["errors"]]
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"privacy_acknowledged": False},
        {"model_version": "2020-01.1"},
        {"code": "2.<script>"},
        {"code": "x" * 201},
        {"extra": "field"},
        {"message": "token = sk-abcdefghijklmnopqrstuvwxyz123456"},
    ],
    ids=["privacy", "model_version", "markup", "too_long", "unknown_field", "secret"],
)
def test_enquiry_validation(client, db, overrides):
    assert client.post(URL, json=enquiry(**overrides)).status_code == 422
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_enquiry_consent_and_abuse_protection(client, db, settings):
    fake = client.post(URL, json=enquiry(website="http://bot.example"))
    assert fake.status_code == 201 and fake.json()["reference"]
    assert client.post(URL, json=enquiry(form_token=valid_token(age_seconds=0))).status_code == 400
    assert db.scalar(select(func.count()).select_from(Lead)) == 0
    consented = enquiry(email="yes@example.com", marketing_consent=True, locale="bg")
    assert client.post(URL, json=consented).status_code == 201
    lead = db.scalar(select(Lead))
    assert lead.marketing_consent_version == settings.marketing_consent_version and lead.locale == "bg"
    assert lead.message.startswith("Запитване от конструктора")


def test_admin_sees_the_design(client, admin_client, db):
    client.post(URL, json=enquiry(code=INTAKE))
    lead = db.scalar(select(Lead))
    detail = admin_client.get(f"/api/admin/leads/{lead.id}").json()
    solution = detail["solution"]
    assert solution["workflow"] == "document_intake" and solution["complexity"] == "high"
    assert solution["residency"] is True and solution["approval"] == "every_action"
    assert solution["approval_points"][0] == "review:gate"
    assert detail["team"] is None and detail["ai_managed"] is None
