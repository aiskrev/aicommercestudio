"""Customer-facing quotations and proposal drafts from configured enquiries (app/quotations, app/opportunities)."""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app import release_gates
from app.config import Settings, get_settings
from app.models import AuditLog, Lead, utcnow
from app.opportunities import configured, drafts
from app.opportunities.models import LeadProposal
from app.quotations import service
from app.quotations.models import Quotation
from app.security import hash_token
from tests.test_catalogue_api import staff_client
from tests.test_configurator import answers, store
from tests.test_configurator import submission as configurator_submission
from tests.test_opportunities import COMPLETE
from tests.test_quote_basket import configuration, contact, extra

PUBLIC = "/api/public/quotations"


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(get_settings(), "quotations_enabled", True)


@pytest.fixture
def configured_lead(client, admin_client, monkeypatch) -> str:
    """A lead created by the project configurator (a business website with SEO and a blog)."""
    monkeypatch.setattr(get_settings(), "project_configurator_enabled", True)
    body = configurator_submission(answers=answers(features=["seo", "blog"], operations=["maintenance"]), locale="en")
    response = client.post("/api/public/configurator/submissions", json=body)
    assert response.status_code == 201, response.text
    return admin_client.get("/api/admin/leads").json()["items"][0]["id"]


def create_proposal(admin_client, lead, **body) -> dict:
    response = admin_client.post(
        f"/api/admin/leads/{lead}/proposals", json={"kind": "proposal", "title": "Offer", **body}
    )
    assert response.status_code == 201, response.text
    return response.json()


def move(admin_client, lead, proposal, action, **body):
    return admin_client.post(
        f"/api/admin/leads/{lead}/proposals/{proposal['id']}/transition",
        json={"action": action, "expected_revision": proposal["revision"], **body},
    )


def approved(admin_client, lead) -> dict:
    """A proposal a person completed and approved."""
    proposal = create_proposal(admin_client, lead, content=COMPLETE)
    proposal = move(admin_client, lead, proposal, "submit").json()
    proposal = move(admin_client, lead, proposal, "approve", note="Checked", acknowledge_warnings=True).json()
    assert proposal["status"] == "approved"
    return proposal


def url(lead, proposal, suffix="") -> str:
    return f"/api/admin/leads/{lead}/proposals/{proposal['id']}/quotation{suffix}"


def publish(admin_client, lead, proposal, **body):
    return admin_client.post(url(lead, proposal), json={"expected_revision": proposal["revision"], **body})


def decision(client, token, **overrides):
    body = {"token": token, "decision": "accept", "name": "Мария Иванова", "note": "", "confirmed": True, **overrides}
    return client.post(f"{PUBLIC}/decision", json=body)


# --- A first draft from a configured enquiry -----------------------------------------------------------


def test_the_labels_file_has_a_word_for_every_key_the_configurator_can_return():
    words = configured.labels()
    from app.configurator import model

    for locale in ("bg", "en"):
        assert set(words[locale]["packages"]) == set(model.MODEL["packages"])
        assert set(words[locale]["features"]) == set(model.MODEL["features"])
        assert set(words[locale]["operations"]) == set(model.MODEL["operations"])
        assert set(words[locale]["unpriced"]) >= set(model.MODEL["unpriced_keys"])
        assert set(words[locale]["assumptions"]) == set(model.MODEL["assumption_keys"])
        assert set(words[locale]["exclusions"]) == set(model.MODEL["exclusion_keys"])
        assert "€" not in json.dumps(words[locale])  # labels only: the draft never carries an amount


def test_a_draft_from_a_configured_enquiry_uses_the_clients_choices_and_leaves_commercial_terms_to_a_person(
    admin_client, configured_lead
):
    proposal = create_proposal(admin_client, configured_lead, generate=True)
    latest = proposal["latest"]
    content = latest["content"]
    assert latest["origin"] == "generated_draft" and proposal["status"] == "draft"
    assert "Business website" in content["scope"] and "Blog" in content["scope"] and "SEO" in content["scope"]
    assert "Needs an assessment before a quote" in content["scope"]
    assert any("Several pages" in item for item in content["deliverables"])
    assert any("online store" in item for item in content["exclusions"])
    assert any("Access to the domain" in item for item in content["dependencies"])
    assert content["milestones"] and all("[" in m["indicative_timing"] for m in content["milestones"])
    # Nothing commercial: no amount anywhere, and the commercial section is the placeholder for a person.
    assert all(value == drafts.PLACEHOLDER["en"] for value in content["commercial"].values())
    assert "€" not in json.dumps(content)
    # Placeholders remain, so the draft cannot be approved before a person completed it.
    blocking = [finding["code"] for finding in latest["findings"] if finding["blocking"]]
    assert "commercial_placeholder" in blocking
    refused = move(
        admin_client, configured_lead, move(admin_client, configured_lead, proposal, "submit").json(), "approve"
    )
    assert refused.status_code == 422 and refused.json()["code"] == "proposal_incomplete"


def test_the_opportunity_is_prefilled_from_the_configuration_but_not_saved(admin_client, configured_lead, db):
    opportunity = admin_client.get(f"/api/admin/leads/{configured_lead}/opportunity").json()
    assert opportunity["exists"] is False
    assert "Business website" in opportunity["scope_summary"]
    assert {"kind": opportunity["source"]["linked"][0]["kind"]} == {"kind": "project_configurator"}
    assert db.scalar(select(func.count()).select_from(LeadProposal)) == 0
    from app.opportunities.models import LeadOpportunity

    assert db.scalar(select(func.count()).select_from(LeadOpportunity)) == 0  # nothing is created by looking


def test_a_basket_lead_lists_every_project_and_extra(client, admin_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "quote_basket_enabled", True)
    monkeypatch.setattr(get_settings(), "contact_rate_limit", 100)
    created = client.post(
        "/api/public/quote-basket", json={"locale": "en", "item": configuration(features=["seo"])}
    ).json()
    headers = {"X-Basket-Token": created["token"]}
    again = client.post(
        "/api/public/quote-basket/items",
        headers=headers,
        json={
            "expected_version": 2,
            "item": {"kind": "configuration", "model_version": configuration()["model_version"], "answers": store()},
        },
    )
    client.post(
        "/api/public/quote-basket/items",
        headers=headers,
        json={"expected_version": again.json()["version"], "item": extra("care_plan", "website")},
    )
    assert (
        client.post("/api/public/quote-basket/submit", headers=headers, json=contact(expected_version=4)).status_code
        == 201
    )
    lead = admin_client.get("/api/admin/leads").json()["items"][0]["id"]
    scope = create_proposal(admin_client, lead, generate=True)["latest"]["content"]["scope"]
    assert "Business website" in scope and "Starter online store" in scope and "Website Care" in scope
    assert scope.count("Chosen by the client") == 2


def test_a_lead_without_a_configuration_gets_the_same_draft_as_before(admin_client, make_lead):
    make_lead(service="ai_agents")
    lead = admin_client.get("/api/admin/leads").json()["items"][0]["id"]
    from app.models import Lead as LeadModel

    assert configured.is_configured(LeadModel(service_details=None, locale="bg")) is False
    content = create_proposal(admin_client, lead, generate=True)["latest"]["content"]
    assert content["deliverables"] == drafts._TEXT["bg"]["deliverables"]


# --- Publishing: only an approved version, only by staff -----------------------------------------------


def test_everything_answers_404_while_the_flag_is_off(client, admin_client, configured_lead, db):
    proposal = approved(admin_client, configured_lead)
    assert get_settings().quotations_enabled is False
    assert publish(admin_client, configured_lead, proposal).status_code == 404
    assert admin_client.get(url(configured_lead, proposal)).status_code == 404
    assert client.post(f"{PUBLIC}/view", json={"token": "a" * 43}).status_code == 404
    assert decision(client, "a" * 43).status_code == 404
    assert db.scalar(select(func.count()).select_from(Quotation)) == 0


def test_only_an_approved_proposal_can_be_published(admin_client, enabled, configured_lead, db):
    draft = create_proposal(admin_client, configured_lead, generate=True)
    refused = publish(admin_client, configured_lead, draft)
    assert refused.status_code == 409 and refused.json()["code"] == "proposal_not_approved"
    in_review = move(
        admin_client, configured_lead, create_proposal(admin_client, configured_lead, content=COMPLETE), "submit"
    ).json()
    assert publish(admin_client, configured_lead, in_review).json()["code"] == "proposal_not_approved"
    rejected = move(admin_client, configured_lead, in_review, "reject", note="Not yet").json()
    assert publish(admin_client, configured_lead, rejected).status_code == 409
    assert db.scalar(select(func.count()).select_from(Quotation)) == 0


def test_staff_publish_the_approved_version_and_get_the_link_once(admin_client, enabled, configured_lead, db):
    proposal = approved(admin_client, configured_lead)
    valid_until = (utcnow() + timedelta(days=30)).date().isoformat()
    response = publish(admin_client, configured_lead, proposal, valid_until=valid_until)
    assert response.status_code == 201, response.text
    body = response.json()
    token = body["token"]
    assert len(token) >= 40 and body["quotation"]["status"] == "published"
    assert (
        body["quotation"]["version_number"] == proposal["approved_version"]
        and body["quotation"]["valid_until"] == valid_until
    )
    row = db.scalar(select(Quotation))
    assert row.token_hash == hash_token(token) and token not in json.dumps(body["quotation"])
    # The link is shown once: reading the quotation again never returns it.
    again = admin_client.get(url(configured_lead, proposal)).json()
    assert token not in json.dumps(again) and again["status"] == "published"
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "quotation.published"))
    assert entry.details["version"] == proposal["approved_version"] and token not in json.dumps(entry.details)
    # One live link per proposal.
    second = publish(admin_client, configured_lead, proposal)
    assert second.status_code == 409 and second.json()["code"] == "quotation_exists"


def test_publishing_checks_the_revision_and_the_validity_date(admin_client, enabled, configured_lead):
    proposal = approved(admin_client, configured_lead)
    stale = admin_client.post(url(configured_lead, proposal), json={"expected_revision": proposal["revision"] - 1})
    assert stale.status_code == 409 and stale.json()["code"] == "opportunity_stale"
    past = publish(
        admin_client, configured_lead, proposal, valid_until=(utcnow() - timedelta(days=1)).date().isoformat()
    )
    assert past.status_code == 422 and past.json()["code"] == "validity_in_the_past"
    assert publish(admin_client, configured_lead, proposal, price=100).status_code == 422  # no amount, no unknown field


@pytest.mark.parametrize("role", ["editor", "viewer"])
def test_only_an_administrator_can_publish_or_withdraw(admin_client, enabled, configured_lead, db, role):
    proposal = approved(admin_client, configured_lead)
    other = staff_client(db, f"quotation.{role}@example.com", role)
    assert publish(other, configured_lead, proposal).status_code == 403
    assert other.get(url(configured_lead, proposal)).status_code == 403
    publish(admin_client, configured_lead, proposal)
    withdraw = other.post(
        url(configured_lead, proposal, "/withdraw"), json={"expected_revision": 1, "note": "No longer valid"}
    )
    assert withdraw.status_code == 403


def test_nobody_without_a_session_can_use_the_staff_routes(client, enabled, admin_client, configured_lead):
    proposal = approved(admin_client, configured_lead)
    client.cookies.clear()
    assert client.post(url(configured_lead, proposal), json={"expected_revision": 1}).status_code in (401, 403)
    assert client.get(url(configured_lead, proposal)).status_code in (401, 403)


def test_a_proposal_of_another_lead_is_not_reachable(admin_client, enabled, configured_lead, make_lead):
    proposal = approved(admin_client, configured_lead)
    make_lead(service="seo", email="other@example.com")
    leads = admin_client.get("/api/admin/leads").json()["items"]
    other = next(item["id"] for item in leads if item["id"] != configured_lead)
    assert publish(admin_client, other, proposal).status_code == 404


# --- The client's view ---------------------------------------------------------------------------------


def published(admin_client, lead, **body) -> tuple[dict, str]:
    proposal = approved(admin_client, lead)
    response = publish(admin_client, lead, proposal, **body)
    assert response.status_code == 201, response.text
    return proposal, response.json()["token"]


def test_the_link_holder_sees_the_approved_version_and_it_is_marked_as_viewed(
    client, admin_client, enabled, configured_lead, db
):
    proposal, token = published(admin_client, configured_lead)
    response = client.post(f"{PUBLIC}/view", json={"token": token})
    assert response.status_code == 200, response.text
    view = response.json()
    assert response.headers["cache-control"] == "no-store"
    assert (
        view["status"] == "published"
        and view["open"] is True
        and view["title"] == "Offer"
        and view["kind"] == "proposal"
    )
    assert view["content"]["scope"] == COMPLETE["scope"] and view["version"] == proposal["approved_version"]
    assert view["company"] == "Example Ltd" and view["decision"] is None
    # Nothing internal is exposed: no ids, no staff names, no e-mail, no notes.
    serialized = json.dumps(view)
    for secret in (configured_lead, proposal["id"], "test.user@example.com", "admin.test@example.com", "Checked"):
        assert secret not in serialized
    row = db.scalar(select(Quotation))
    assert row.view_count == 1 and row.first_viewed_at is not None
    client.post(f"{PUBLIC}/view", json={"token": token})
    db.expire_all()
    assert db.scalar(select(Quotation)).view_count == 2
    staff = admin_client.get(url(configured_lead, proposal)).json()
    assert staff["view_count"] == 2 and staff["first_viewed_at"] is not None


def test_the_published_version_cannot_change_under_the_client(client, admin_client, enabled, configured_lead):
    proposal, token = published(admin_client, configured_lead)
    # An approved proposal is closed: no new version, no reopening. What the client sees is that approved version.
    changed = admin_client.post(
        f"/api/admin/leads/{configured_lead}/proposals/{proposal['id']}/versions",
        json={
            "expected_revision": proposal["revision"],
            "content": {**COMPLETE, "scope": "Changed later"},
            "change_note": "Edit",
        },
    )
    assert changed.status_code == 409 and changed.json()["code"] == "proposal_closed"
    assert move(admin_client, configured_lead, proposal, "reopen").status_code == 409
    view = client.post(f"{PUBLIC}/view", json={"token": token}).json()
    assert view["content"]["scope"] == COMPLETE["scope"] and view["version"] == proposal["approved_version"]


def test_an_unknown_or_malformed_link_is_a_plain_404_that_cannot_be_probed(
    client, admin_client, enabled, configured_lead
):
    _, token = published(admin_client, configured_lead)
    unknown = client.post(f"{PUBLIC}/view", json={"token": "z" * 43})
    assert unknown.status_code == 404 and unknown.json()["code"] == "quotation_not_found"
    assert (
        client.post(f"{PUBLIC}/view", json={"token": token[:-1] + ("A" if token[-1] != "A" else "B")}).status_code
        == 404
    )
    for bad in ("short", "x" * 30 + "'; DROP TABLE quotations;--", "../../etc/passwd" + "a" * 20, ""):
        assert client.post(f"{PUBLIC}/view", json={"token": bad}).status_code == 422
    assert client.post(f"{PUBLIC}/view", json={}).status_code == 422
    assert client.get(f"{PUBLIC}/view").status_code == 405
    assert client.get(f"{PUBLIC}/{token}").status_code == 404  # there is no route that takes the secret in a URL


def test_viewing_is_rate_limited(client, enabled, monkeypatch):
    monkeypatch.setattr(get_settings(), "quotation_view_rate_limit", 2)
    codes = [client.post(f"{PUBLIC}/view", json={"token": "q" * 43}).status_code for _ in range(3)]
    assert codes == [404, 404, 429]


# --- The client's answer -------------------------------------------------------------------------------


def test_the_client_accepts_once_and_staff_see_who_and_when(client, admin_client, enabled, configured_lead, db):
    proposal, token = published(admin_client, configured_lead)
    response = decision(client, token, note="Please call us on Monday.")
    assert response.status_code == 200, response.text
    view = response.json()
    assert view["status"] == "accepted" and view["open"] is False and view["decision"]["name"] == "Мария Иванова"
    row = db.scalar(select(Quotation))
    assert row.status == "accepted" and row.decision_note == "Please call us on Monday." and row.decided_at is not None
    assert row.decision_ip_hash and "127.0.0.1" not in row.decision_ip_hash and row.revision == 2
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "quotation.accepted"))
    assert entry.actor_label == "client" and entry.entity_id == configured_lead
    assert "Мария" not in json.dumps(entry.details) and "Monday" not in json.dumps(entry.details)
    staff = admin_client.get(url(configured_lead, proposal)).json()
    assert staff["status"] == "accepted" and staff["decision_name"] == "Мария Иванова"
    # The lead is not moved automatically and nothing is sent: a person decides what follows.
    lead = admin_client.get(f"/api/admin/leads/{configured_lead}").json()
    assert lead["status"] == "NEW"


def test_the_same_answer_twice_and_simultaneously_is_recorded_once(client, admin_client, enabled, configured_lead, db):
    _, token = published(admin_client, configured_lead)
    assert decision(client, token).status_code == 200
    assert decision(client, token, name="Someone else").status_code == 200  # a retry: nothing new is recorded
    db.expire_all()
    row = db.scalar(select(Quotation))
    assert row.decision_name == "Мария Иванова" and row.revision == 2
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "quotation.accepted")) == 1

    _, other = published(admin_client, configured_lead)

    def answer(_):
        return decision(client, other, decision="decline", name="Race").status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert set(pool.map(answer, range(4))) == {200}
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "quotation.declined")) == 1


def test_a_different_answer_after_one_was_given_is_refused(client, admin_client, enabled, configured_lead):
    _, token = published(admin_client, configured_lead)
    assert decision(client, token, decision="decline").status_code == 200
    changed = decision(client, token, decision="accept")
    assert changed.status_code == 409 and changed.json()["code"] == "quotation_closed"
    assert client.post(f"{PUBLIC}/view", json={"token": token}).json()["status"] == "declined"


def test_an_answer_needs_a_name_an_explicit_confirmation_and_clean_text(
    client, admin_client, enabled, configured_lead, db
):
    _, token = published(admin_client, configured_lead)
    assert decision(client, token, confirmed=False).status_code == 422
    assert decision(client, token, name="A").status_code == 422
    assert decision(client, token, name="https://spam.example").status_code == 422
    assert decision(client, token, note="x" * 1001).status_code == 422
    assert decision(client, token, note="password: hunter2hunter2").status_code == 422
    assert decision(client, token, decision="maybe").status_code == 422
    assert (
        client.post(f"{PUBLIC}/decision", json={"token": token, "decision": "accept", "name": "Ok Name"}).status_code
        == 422
    )
    assert decision(client, token, price=5).status_code == 422
    assert db.scalar(select(Quotation)).status == "published"  # none of the above recorded anything


def test_a_withdrawn_quotation_shows_no_content_and_cannot_be_answered(
    client, admin_client, enabled, configured_lead, db
):
    proposal, token = published(admin_client, configured_lead)
    quotation = admin_client.get(url(configured_lead, proposal)).json()
    response = admin_client.post(
        url(configured_lead, proposal, "/withdraw"),
        json={"expected_revision": quotation["revision"], "note": "Terms changed"},
    )
    assert response.status_code == 200 and response.json()["status"] == "withdrawn"
    view = client.post(f"{PUBLIC}/view", json={"token": token}).json()
    assert view["status"] == "withdrawn" and view["content"] is None and view["open"] is False
    assert decision(client, token).json()["code"] == "quotation_closed"
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "quotation.withdrawn"))
    assert entry.entity_id == configured_lead
    # A new link can be published afterwards; the old one stays dead.
    again = publish(admin_client, configured_lead, proposal)
    assert again.status_code == 201 and again.json()["token"] != token
    assert client.post(f"{PUBLIC}/view", json={"token": token}).json()["status"] == "withdrawn"


def test_withdrawing_needs_a_note_a_live_quotation_and_the_current_revision(
    admin_client, enabled, configured_lead, client
):
    proposal, token = published(admin_client, configured_lead)
    withdraw = lambda **body: admin_client.post(url(configured_lead, proposal, "/withdraw"), json=body)  # noqa: E731
    assert withdraw(expected_revision=1, note="x").status_code == 422
    assert withdraw(expected_revision=7, note="Terms changed").json()["code"] == "opportunity_stale"
    decision(client, token)
    closed = withdraw(expected_revision=2, note="Terms changed")
    assert closed.status_code == 409 and closed.json()["code"] == "quotation_closed"
    no_quotation = approved(admin_client, configured_lead)
    missing = admin_client.post(
        url(configured_lead, no_quotation, "/withdraw"), json={"expected_revision": 1, "note": "Terms changed"}
    )
    assert missing.status_code == 404


def test_an_expired_quotation_cannot_be_answered_and_a_new_one_is_needed(
    client, admin_client, enabled, configured_lead, db
):
    proposal, token = published(
        admin_client, configured_lead, valid_until=(utcnow() + timedelta(days=2)).date().isoformat()
    )
    row = db.scalar(select(Quotation))
    row.valid_until = (utcnow() - timedelta(days=1)).date()  # as if the date had passed
    db.commit()
    view = client.post(f"{PUBLIC}/view", json={"token": token}).json()
    assert view["status"] == "expired" and view["open"] is False
    assert decision(client, token).json()["code"] == "quotation_closed"
    assert admin_client.get(url(configured_lead, proposal)).json()["status"] == "expired"
    assert service.effective_status(row, today=(utcnow() - timedelta(days=2)).date()) == "published"
    # An expired live link still blocks a second publication until it is withdrawn.
    assert publish(admin_client, configured_lead, proposal).json()["code"] == "quotation_exists"


def test_an_accepted_quotation_cannot_be_published_again(client, admin_client, enabled, configured_lead):
    proposal, token = published(admin_client, configured_lead)
    decision(client, token)
    again = publish(admin_client, configured_lead, proposal)
    assert again.status_code == 409 and again.json()["code"] == "quotation_accepted"


def test_answering_is_rate_limited(client, enabled, monkeypatch):
    monkeypatch.setattr(get_settings(), "quotation_decision_rate_limit", 2)
    codes = [decision(client, "q" * 43).status_code for _ in range(3)]
    assert codes == [404, 404, 429]


# --- Isolation and records -----------------------------------------------------------------------------


def test_one_link_opens_only_its_own_quotation(client, admin_client, enabled, configured_lead, make_lead):
    _, first = published(admin_client, configured_lead)
    make_lead(service="seo", email="second.client@example.com", company="Second Client Ltd")
    second_lead = next(
        item["id"] for item in admin_client.get("/api/admin/leads").json()["items"] if item["id"] != configured_lead
    )
    other = create_proposal(
        admin_client, second_lead, title="Second offer", content={**COMPLETE, "scope": "Only for the second client."}
    )
    other = move(admin_client, second_lead, other, "submit").json()
    other = move(admin_client, second_lead, other, "approve", note="ok", acknowledge_warnings=True).json()
    second = publish(admin_client, second_lead, other).json()["token"]
    one = client.post(f"{PUBLIC}/view", json={"token": first}).json()
    two = client.post(f"{PUBLIC}/view", json={"token": second}).json()
    assert one["company"] == "Example Ltd" and two["company"] == "Second Client Ltd"
    assert "Only for the second client" not in json.dumps(one) and COMPLETE["scope"] not in json.dumps(two)
    assert decision(client, first).status_code == 200
    assert client.post(f"{PUBLIC}/view", json={"token": second}).json()["status"] == "published"  # untouched


def test_the_audit_trail_has_every_step(client, admin_client, enabled, configured_lead, db):
    proposal, token = published(admin_client, configured_lead)
    decision(client, token, decision="decline")
    actions = [
        row.action
        for row in db.scalars(select(AuditLog).where(AuditLog.entity_id == configured_lead).order_by(AuditLog.id))
        if row.action.startswith(("proposal.", "quotation."))
    ]
    assert actions == [
        "proposal.created",
        "proposal.submit",
        "proposal.approve",
        "quotation.published",
        "quotation.declined",
    ]


def test_the_table_cannot_hold_an_answer_without_a_name_or_a_time(db):
    lead = Lead(
        service="seo",
        submitted_service="seo",
        inquiry_type="contact",
        locale="en",
        name="A B",
        company="C",
        email="a@example.com",
        message="m",
        status="NEW",
        source="test",
        privacy_acknowledged_at=utcnow(),
        privacy_notice_version="1",
    )
    db.add(lead)
    db.flush()
    proposal = LeadProposal(
        lead_id=lead.id,
        kind="proposal",
        title="T",
        status="approved",
        current_version=1,
        approved_version=1,
        approved_at=utcnow(),
    )
    db.add(proposal)
    db.flush()
    row = Quotation(
        lead_id=lead.id, proposal_id=proposal.id, version_number=1, token_hash="h" * 64, locale="en", status="accepted"
    )
    db.add(row)
    with pytest.raises(DBAPIError):
        db.flush()
    db.rollback()


def test_migration_0027_grants(db):
    def may(role: str, privilege: str) -> bool:
        return db.scalar(
            text("SELECT has_table_privilege(:role, 'quotations', :privilege)"), {"role": role, "privilege": privilege}
        )

    for privilege in ("SELECT", "INSERT", "UPDATE"):
        assert may("acs_app_api", privilege) and not may("acs_app_runtime", privilege)
    assert not may("acs_app_api", "DELETE")  # a quotation goes with its lead, never on its own
    indexes = {row[0] for row in db.execute(text("SELECT indexname FROM pg_indexes WHERE tablename = 'quotations'"))}
    assert {"uq_quotations_live", "ix_quotations_lead"} <= indexes


def test_the_release_blocker_keeps_quotations_out_of_production_until_the_wording_is_approved(monkeypatch):
    from pydantic import ValidationError

    from tests.test_security import _production

    assert release_gates.QUOTATION_ACCEPTANCE_WORDING_APPROVED is False
    with pytest.raises(ValidationError) as error:
        _production(quotations_enabled=True)
    assert "BLOCKER-COM-ACCEPT-01" in str(error.value)
    monkeypatch.setattr(release_gates, "QUOTATION_ACCEPTANCE_WORDING_APPROVED", True)
    assert isinstance(_production(quotations_enabled=True), Settings)
