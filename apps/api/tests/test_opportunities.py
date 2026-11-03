"""Engineering opportunity workflow: opportunity record, proposal/SOW drafts, versions, human approval."""

from __future__ import annotations

import json
from datetime import timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.models import AuditLog, Lead, WorkshopKey, utcnow
from app.opportunities import drafts
from app.opportunities.models import LeadOpportunity, LeadProposal, LeadProposalVersion
from app.opportunities.schemas import ProposalContent
from app.services import leads
from app.workshops import workshop_titles
from tests.test_catalogue_api import staff_client

COMPLETE = {
    "scope": "Two-day agent architecture workshop for the order-handling process.",
    "deliverables": ["Agent and tool diagram", "Permission matrix"],
    "assumptions": ["The process owner takes part in both sessions."],
    "exclusions": ["Development of the agents."],
    "dependencies": ["Read access to the order API documentation."],
    "responsibilities": [{"party": "client", "item": "Names the participants."}],
    "acceptance_criteria": ["The client confirms the written summary."],
    "milestones": [{"title": "Session 1", "description": "Process and roles", "indicative_timing": "to be agreed"}],
    "risks": [{"risk": "Key people unavailable", "mitigation": "Agree dates early"}],
    "commercial": {
        "pricing_basis": "Written by a person after the call.",
        "payment_terms": "Per contract.",
        "validity": "30 days",
        "notes": "",
    },
}


def _lead_id(admin_client) -> str:
    return admin_client.get("/api/admin/leads").json()["items"][0]["id"]


@pytest.fixture
def lead(admin_client, make_lead) -> str:
    make_lead(service="ai_agents", workshop="agent_architecture")
    return _lead_id(admin_client)


def _opportunity(**overrides) -> dict:
    body = {
        "expected_revision": 0,
        "service_domain": "ai_agents_automation",
        "problem_summary": "Orders are copied by hand between the shop and the ERP.",
        "scope_summary": "Order intake and status updates.",
        "discovery_status": "scheduled",
        "qualification_status": "qualified",
        "qualification_rationale": "Clear process owner and a documented API.",
        "technical_constraints": "On-premise ERP, read-only API.",
        "stakeholders": [{"name": "Мария Иванова", "role": "Operations lead", "provided_in": "call"}],
        "stakeholders_confirmed": True,
        "next_action": "Send the workshop agenda draft for review",
        "next_action_due": "2026-11-20",
        "recommended_workshop": "agent_architecture",
        "recommendation_rationale": "The use case is chosen; the architecture is not.",
    }
    body.update(overrides)
    return body


# --------------------------------------------------------------------------- catalogue keys


def test_workshop_keys_match_the_shared_catalogue_file():
    assert sorted(workshop_titles()) == sorted(k.value for k in WorkshopKey)
    assert all(set(titles) == {"bg", "en"} for titles in workshop_titles().values())


def test_public_enquiry_records_the_workshop_and_rejects_unknown_keys(client, admin_client, make_lead):
    from tests.conftest import lead_payload

    make_lead(workshop="kubernetes_review")
    detail = admin_client.get(f"/api/admin/leads/{_lead_id(admin_client)}").json()
    assert detail["workshop_key"] == "kubernetes_review"
    bad = client.post("/api/public/leads", json=lead_payload(workshop="free_pizza", email="other@example.com"))
    assert bad.status_code == 422


# --------------------------------------------------------------------------- opportunity record


def test_opportunity_defaults_show_source_and_prefill_the_workshop(admin_client, lead):
    out = admin_client.get(f"/api/admin/leads/{lead}/opportunity").json()
    assert out["exists"] is False and out["revision"] == 0
    assert out["source"]["workshop_key"] == "agent_architecture"
    assert out["source"]["source"] == "website_contact_form"
    assert out["recommended_workshop"] == "agent_architecture"
    assert out["qualification_status"] == "unassessed"


def test_opportunity_save_update_and_stale_revision(admin_client, lead, db):
    created = admin_client.put(f"/api/admin/leads/{lead}/opportunity", json=_opportunity())
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["exists"] and body["revision"] == 1
    assert body["stakeholders"][0]["provided_in"] == "call"
    assert body["updated_by"]

    stale = admin_client.put(f"/api/admin/leads/{lead}/opportunity", json=_opportunity(expected_revision=0))
    assert stale.status_code == 409 and stale.json()["code"] == "opportunity_stale"

    updated = admin_client.put(
        f"/api/admin/leads/{lead}/opportunity", json=_opportunity(expected_revision=1, discovery_status="completed")
    ).json()
    assert updated["revision"] == 2 and updated["discovery_status"] == "completed"

    entries = db.scalars(
        select(AuditLog).where(AuditLog.action == "opportunity.saved").order_by(AuditLog.created_at)
    ).all()
    assert len(entries) == 2
    assert entries[1].details["fields"] == ["discovery_status"]
    # Field names only: neither the stakeholder's name nor the free text reach the audit log.
    logged = json.dumps([e.details for e in entries], ensure_ascii=False)
    assert "Мария" not in logged and "ERP" not in logged


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"qualification_rationale": None}, "rationale_required"),
        ({"qualification_status": "not_qualified", "qualification_rationale": " "}, "rationale_required"),
        ({"stakeholders_confirmed": False}, "stakeholders_unconfirmed"),
        ({"recommendation_rationale": None}, "recommendation_rationale"),
        ({"stakeholders": [{"name": "X", "role": "Y", "provided_in": "guessed"}]}, None),
        ({"service_domain": "space_travel"}, None),
        ({"recommended_assessment": "horoscope"}, None),
        ({"problem_summary": "<script>alert(1)</script>"}, None),
        ({"notes": "token sk-ant-abcdefghijklmnopqrstuvwxyz"}, None),
        ({"stakeholders": [{"name": "A", "role": "B", "provided_in": "call"}] * 13}, None),
        ({"unknown": 1}, None),
    ],
)
def test_opportunity_validation(admin_client, lead, overrides, code):
    response = admin_client.put(f"/api/admin/leads/{lead}/opportunity", json=_opportunity(**overrides))
    assert response.status_code == 422, response.text
    if code:
        assert code in response.text


def test_opportunity_never_touches_consents_or_lead_status(admin_client, lead, db):
    admin_client.put(f"/api/admin/leads/{lead}/opportunity", json=_opportunity())
    row = db.get(Lead, __import__("uuid").UUID(lead))
    assert row.marketing_consent is False and row.status == "NEW"


def test_linked_records_include_saved_assessments(admin_client, lead, db):
    db.execute(
        text(
            "INSERT INTO assessment_results (id, created_at, expires_at, token_hash, assessment_key,"
            " definition_version, algorithm, locale, fingerprint, answers, result, lead_id)"
            " VALUES (gen_random_uuid(), now(), now() + interval '1 day', repeat('a', 64), 'cloud_maturity',"
            " '1.0.0', 'weighted-mean/1', 'en', 'abc', '{}', '{}', :lead)"
        ),
        {"lead": lead},
    )
    db.commit()
    linked = admin_client.get(f"/api/admin/leads/{lead}/opportunity").json()["source"]["linked"]
    assert [(x["kind"], x["detail"]) for x in linked] == [("assessment_result", "cloud_maturity")]


# --------------------------------------------------------------------------- access


@pytest.mark.parametrize("role", ["editor", "viewer"])
def test_only_admins_reach_the_workflow(db, admin_client, lead, role):
    other = staff_client(db, f"opp.{role}@example.com", role)
    assert other.get(f"/api/admin/leads/{lead}/opportunity").status_code == 403
    assert other.put(f"/api/admin/leads/{lead}/opportunity", json=_opportunity()).status_code == 403
    assert other.get(f"/api/admin/leads/{lead}/proposals").status_code == 403
    assert other.post(f"/api/admin/leads/{lead}/proposals", json={"kind": "sow", "title": "X"}).status_code == 403


def test_anonymous_and_csrf_are_refused(client, admin_client, lead):
    from fastapi.testclient import TestClient

    from app.main import app

    assert TestClient(app).get(f"/api/admin/leads/{lead}/opportunity").status_code == 401
    token = admin_client.headers.pop("X-CSRF-Token")
    assert admin_client.put(f"/api/admin/leads/{lead}/opportunity", json=_opportunity()).status_code == 403
    admin_client.headers["X-CSRF-Token"] = token


def test_unknown_lead_and_cross_lead_proposal_are_404(admin_client, make_lead, lead):
    missing = "00000000-0000-0000-0000-000000000000"
    assert admin_client.get(f"/api/admin/leads/{missing}/opportunity").status_code == 404
    proposal = admin_client.post(f"/api/admin/leads/{lead}/proposals", json={"kind": "proposal", "title": "A"}).json()
    make_lead(email="second@example.com")
    second = _lead_id(admin_client)
    assert second != lead
    assert admin_client.get(f"/api/admin/leads/{second}/proposals/{proposal['id']}").status_code == 404


# --------------------------------------------------------------------------- drafts


def test_generated_draft_uses_the_record_and_leaves_commercial_terms_to_a_person(admin_client, lead):
    admin_client.put(f"/api/admin/leads/{lead}/opportunity", json=_opportunity())
    response = admin_client.post(
        f"/api/admin/leads/{lead}/proposals", json={"kind": "sow", "title": "SOW draft", "generate": True}
    )
    assert response.status_code == 201, response.text
    p = response.json()
    latest = p["latest"]
    assert p["status"] == "draft" and latest["origin"] == "generated_draft" and latest["number"] == 1
    content = latest["content"]
    assert "Order intake" in content["scope"] and "read-only API" in content["scope"]
    assert any("Работна среща за архитектура на AI агенти" in a for a in content["assumptions"])  # BG lead
    assert set(content["commercial"].values()) == {drafts.PLACEHOLDER["bg"]}
    # No prices, staffing, guarantees or signatures are generated.
    blob = json.dumps(content, ensure_ascii=False)
    for pattern in (drafts._PRICE_RE, drafts._STAFFING_RE, drafts._GUARANTEE_RE, drafts._SIGNATURE_RE):
        assert not pattern.search(blob), pattern.pattern
    codes = {(f["code"], f["blocking"]) for f in latest["findings"]}
    assert ("commercial_placeholder", True) in codes and ("unfilled_placeholder", True) in codes


def test_generated_draft_follows_the_lead_language(admin_client, make_lead):
    make_lead(locale="en", email="english@example.com")
    lead = _lead_id(admin_client)
    p = admin_client.post(
        f"/api/admin/leads/{lead}/proposals", json={"kind": "proposal", "title": "P", "generate": True}
    ).json()
    assert set(p["latest"]["content"]["commercial"].values()) == {drafts.PLACEHOLDER["en"]}
    assert p["latest"]["content"]["scope"].startswith("[Describe the scope")


def test_review_flags_wording_a_person_must_check():
    content = ProposalContent.model_validate(
        {
            **COMPLETE,
            "scope": "We guarantee a 40% faster process with 3 engineers for €12 000.",
            "assumptions": ["The signed agreement is attached."],
        }
    )
    codes = {(f["code"], f["section"]) for f in (x.model_dump() for x in drafts.review(content))}
    assert {("guarantee_wording", "scope"), ("price_outside_commercial", "scope"), ("staffing_claim", "scope")} <= codes
    assert ("signature_wording", "assumptions") in codes
    assert not any(f.blocking for f in drafts.review(content))
    assert drafts.review(ProposalContent.model_validate(COMPLETE)) == []


def test_content_is_bounded_and_plain_text(admin_client, lead):
    for content in (
        {**COMPLETE, "scope": "<b>bold</b>"},
        {**COMPLETE, "deliverables": ["x"] * 41},
        {**COMPLETE, "responsibilities": [{"party": "everyone", "item": "x"}]},
        {**COMPLETE, "commercial": {"pricing_basis": "x", "price": 100}},
        {**COMPLETE, "extra": "x"},
    ):
        response = admin_client.post(
            f"/api/admin/leads/{lead}/proposals", json={"kind": "sow", "title": "T", "content": content}
        )
        assert response.status_code == 422, content
    both = admin_client.post(
        f"/api/admin/leads/{lead}/proposals", json={"kind": "sow", "title": "T", "generate": True, "content": COMPLETE}
    )
    assert both.status_code == 422


# --------------------------------------------------------------------------- versions and approval


def _create(admin_client, lead, **body):
    response = admin_client.post(f"/api/admin/leads/{lead}/proposals", json={"kind": "proposal", "title": "P", **body})
    assert response.status_code == 201, response.text
    return response.json()


def _move(admin_client, lead, p, action, **body):
    return admin_client.post(
        f"/api/admin/leads/{lead}/proposals/{p['id']}/transition",
        json={"action": action, "expected_revision": p["revision"], **body},
    )


def _version(admin_client, lead, p, content, note="Completed by a person"):
    return admin_client.post(
        f"/api/admin/leads/{lead}/proposals/{p['id']}/versions",
        json={"expected_revision": p["revision"], "content": content, "change_note": note},
    )


def test_full_flow_draft_to_approval_with_history(admin_client, lead, db):
    p = _create(admin_client, lead, generate=True)
    # An incomplete draft cannot be approved.
    p = _move(admin_client, lead, p, "submit").json()
    assert p["status"] == "in_review"
    refused = _move(admin_client, lead, p, "approve")
    assert refused.status_code == 422 and refused.json()["code"] == "proposal_incomplete"
    # Versions cannot be added while in review; reopen first.
    assert _version(admin_client, lead, p, COMPLETE).status_code == 409
    p = _move(admin_client, lead, p, "reopen").json()
    p = _version(admin_client, lead, p, COMPLETE).json()
    assert p["current_version"] == 2 and p["latest"]["origin"] == "human" and p["latest"]["findings"] == []
    assert p["versions"][1]["changed_sections"]  # what the person changed
    p = _move(admin_client, lead, p, "submit").json()
    p = _move(admin_client, lead, p, "approve", note="Checked commercial terms").json()
    assert p["status"] == "approved" and p["approved_version"] == 2 and p["decided_by"]
    # Approved is closed: no new version, no further transition.
    assert _version(admin_client, lead, p, COMPLETE).status_code == 409
    assert _move(admin_client, lead, p, "withdraw", note="x").status_code == 409
    # Both versions stay readable, unchanged.
    first = admin_client.get(f"/api/admin/leads/{lead}/proposals/{p['id']}/versions/1").json()
    assert first["origin"] == "generated_draft"
    assert admin_client.get(f"/api/admin/leads/{lead}/proposals/{p['id']}/versions/9").status_code == 404
    actions = [
        a
        for (a,) in db.execute(
            select(AuditLog.action).where(AuditLog.action.like("proposal.%")).order_by(AuditLog.created_at)
        )
    ]
    assert actions == [
        "proposal.created",
        "proposal.submit",
        "proposal.reopen",
        "proposal.version_added",
        "proposal.submit",
        "proposal.approve",
    ]


def test_warnings_must_be_acknowledged_and_reject_needs_a_note(admin_client, lead):
    p = _create(admin_client, lead, content={**COMPLETE, "scope": "We guarantee delivery."})
    p = _move(admin_client, lead, p, "submit").json()
    unack = _move(admin_client, lead, p, "approve")
    assert unack.status_code == 422 and unack.json()["code"] == "warnings_unacknowledged"
    assert _move(admin_client, lead, p, "reject").status_code == 422
    p = _move(admin_client, lead, p, "reject", note="Remove the guarantee").json()
    assert p["status"] == "rejected" and p["decision_note"] == "Remove the guarantee"
    p = _version(admin_client, lead, p, COMPLETE).json()
    assert p["status"] == "draft"
    p = _move(admin_client, lead, p, "submit").json()
    p = _move(admin_client, lead, {**p}, "approve", acknowledge_warnings=True).json()
    assert p["status"] == "approved"


def test_stale_revision_and_disallowed_transitions(admin_client, lead):
    p = _create(admin_client, lead, content=COMPLETE)
    assert _move(admin_client, lead, {**p, "revision": 99}, "submit").status_code == 409
    assert _move(admin_client, lead, p, "approve").status_code == 409  # draft cannot be approved directly
    assert _move(admin_client, lead, p, "sign").status_code == 422  # no such action exists
    w = _move(admin_client, lead, p, "withdraw", note="Client paused").json()
    assert w["status"] == "withdrawn"
    assert _move(admin_client, lead, w, "submit").status_code == 409


def test_versions_are_append_only_in_the_database(admin_client, lead, db):
    _create(admin_client, lead, content=COMPLETE)
    with pytest.raises(DBAPIError, match="append-only"):
        db.execute(text("UPDATE lead_proposal_versions SET content = '{}'::jsonb"))
    db.rollback()


def test_erasure_and_retention_remove_opportunity_data(admin_client, lead, db):
    admin_client.put(f"/api/admin/leads/{lead}/opportunity", json=_opportunity())
    _create(admin_client, lead, generate=True)
    row = db.get(Lead, __import__("uuid").UUID(lead))
    row.updated_at = utcnow() - timedelta(days=800)
    db.commit()
    assert leads.purge_expired(db, lead_retention_days=730, audit_retention_days=1095).leads_deleted == 1
    for model in (LeadOpportunity, LeadProposal, LeadProposalVersion):
        assert db.scalar(select(func.count()).select_from(model)) == 0


def test_runtime_role_cannot_read_lead_tables(db):
    db.execute(text("SET LOCAL ROLE acs_app_runtime"))
    for table in ("leads", "lead_opportunities", "lead_proposals", "lead_proposal_versions", "lead_notes"):
        with pytest.raises(DBAPIError, match="permission denied"):
            db.execute(text(f"SELECT 1 FROM {table}"))  # noqa: S608 - fixed table names
        db.rollback()
        db.execute(text("SET LOCAL ROLE acs_app_runtime"))
    db.rollback()
