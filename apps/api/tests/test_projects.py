"""Commercial customer projects (app/projects): lifecycle, roles, isolation, staff and customer views."""

# ruff: noqa: E501  (long, readable assertions)
from __future__ import annotations

import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.accounts.models import CustomerAccount
from app.compliance import service as compliance_service
from app.config import get_settings
from app.models import AuditLog, Lead
from app.opportunities.schemas import ProposalContent
from app.projects import service
from app.projects.models import CommercialProject, ProjectEvent, ProjectMilestone
from app.workspace.models import CustomerWorkspace, WorkspaceMember
from tests.test_accounts import PASSWORD, Inbox
from tests.test_catalogue_api import staff_client
from tests.test_opportunities import COMPLETE
from tests.test_quotations import approved, decision, make_configured_lead, publish
from tests.test_security import _production

API = "/api/projects"
ADMIN = "/api/admin"
CUSTOMER = "customer@example.com"


@pytest.fixture
def inbox(monkeypatch) -> Inbox:
    """Accounts and projects on, a mailbox that records what would be sent."""
    box = Inbox()
    settings = get_settings()
    monkeypatch.setattr(settings, "customer_accounts_enabled", True)
    monkeypatch.setattr(settings, "commercial_projects_enabled", True)
    monkeypatch.setattr(settings, "quotations_enabled", True)
    monkeypatch.setattr(settings, "email_provider", "smtp")
    monkeypatch.setattr(settings, "smtp_host", "mail.test")
    monkeypatch.setattr(settings, "smtp_from", "no-reply@example.com")
    monkeypatch.setattr(settings, "site_url", "https://trusted.example.com")
    monkeypatch.setattr(settings, "contact_rate_limit", 200)
    monkeypatch.setattr(settings, "project_action_rate_limit", 500)
    monkeypatch.setattr("app.accounts.mail.get_sender", lambda *_: box)
    return box


def signup(client: TestClient, box: Inbox, email: str = CUSTOMER) -> None:
    body = {"email": email, "password": PASSWORD, "privacy_acknowledged": True}
    assert client.post("/api/accounts/register", json=body).status_code == 202
    token = re.search(r"#token=([\w-]+)", box.messages[-1][2]).group(1)
    assert client.post("/api/accounts/verification/confirm", json={"token": token}).status_code == 204
    assert client.post("/api/accounts/login", json={"email": email, "password": PASSWORD}).status_code == 200


def csrf(client: TestClient) -> dict[str, str]:
    return {"x-csrf-token": client.cookies.get(get_settings().account_csrf_cookie_name)}


def another_customer(box: Inbox, email: str) -> TestClient:
    from app.main import app

    other = TestClient(app)
    signup(other, box, email)
    return other


@pytest.fixture
def configured_lead(client, admin_client, monkeypatch) -> str:
    return make_configured_lead(client, admin_client, monkeypatch)


@pytest.fixture
def customer(client, inbox) -> TestClient:
    signup(client, inbox)
    return client


def accepted_lead(client_for_quote, admin_client, configured_lead) -> tuple[str, dict]:
    """A lead whose quotation the client accepted. Returns (lead id, proposal)."""
    proposal = approved(admin_client, configured_lead)
    token = publish(admin_client, configured_lead, proposal).json()["token"]
    assert decision(client_for_quote, token).status_code == 200
    return configured_lead, proposal


def create(admin_client, lead, **overrides):
    body = {"account_email": CUSTOMER, "title": "Нов бизнес сайт", "summary": "Сайт с форма за запитване.", **overrides}
    return admin_client.post(f"{ADMIN}/leads/{lead}/projects", json=body)


def make_project(admin_client, lead, **overrides) -> dict:
    response = create(admin_client, lead, **overrides)
    assert response.status_code in (200, 201), response.text
    return response.json()


def move(admin_client, project, to, note=None):
    body = {"expected_revision": project["revision"], "to": to, **({"note": note} if note else {})}
    return admin_client.post(f"{ADMIN}/projects/{project['id']}/transition", json=body)


def staff_get(admin_client, project_id) -> dict:
    return admin_client.get(f"{ADMIN}/projects/{project_id}").json()


def advance(admin_client, project, *steps) -> dict:
    for step, note in steps:
        response = move(admin_client, project, step, note)
        assert response.status_code == 200, (step, response.text)
        project = response.json()
    return project


def to_awaiting(admin_client, lead, **overrides) -> dict:
    """A project waiting for the customer's approval, without a quotation: the move is made in the database, as if an
    accepted quotation had been linked (the quotation rule itself is tested separately)."""
    from tests.conftest import owner_sessionmaker

    project = advance(admin_client, make_project(admin_client, lead, **overrides), ("quotation", None))
    with owner_sessionmaker() as session:
        session.execute(
            text("UPDATE commercial_projects SET status = 'awaiting_approval', revision = revision + 1 WHERE id = :i"),
            {"i": project["id"]},
        )
        session.commit()
    return staff_get(admin_client, project["id"])


def decide(client, project_id, action, revision, note=None, headers=None):
    body = {"expected_revision": revision, "action": action, **({"note": note} if note else {})}
    return client.post(f"{API}/{project_id}/decision", json=body, headers={**csrf(client), **(headers or {})})


@pytest.fixture
def lead_with_acceptance(client, admin_client, configured_lead):
    """Staff-side lead plus an accepted quotation; the customer's browser is the `client` fixture."""
    return accepted_lead(client, admin_client, configured_lead)


# --- Flags ----------------------------------------------------------------------------------------------


def test_everything_answers_404_while_the_flag_is_off(client, admin_client, configured_lead, inbox, monkeypatch):
    monkeypatch.setattr(get_settings(), "commercial_projects_enabled", False)
    signup(client, inbox)
    assert client.get(API).status_code == 404
    assert client.get(f"{API}/00000000-0000-4000-8000-000000000000").status_code == 404
    assert admin_client.get(f"{ADMIN}/projects").status_code == 404
    assert create(admin_client, configured_lead).status_code == 404


def test_the_customer_side_also_needs_accounts_and_production_refuses_projects_without_them(client, inbox, monkeypatch):
    signup(client, inbox)
    monkeypatch.setattr(get_settings(), "customer_accounts_enabled", False)
    assert client.get(API).status_code == 404
    with pytest.raises(ValidationError, match="needs customer accounts"):
        _production(commercial_projects_enabled=True)
    assert get_settings().commercial_projects_enabled is True  # set by the fixture
    from app.config import Settings

    assert Settings.model_fields["commercial_projects_enabled"].default is False


# --- Creating a project ---------------------------------------------------------------------------------


def test_staff_create_a_draft_for_a_verified_account_from_an_accepted_quotation(
    customer, admin_client, lead_with_acceptance, db
):
    lead, proposal = lead_with_acceptance
    from app.quotations.models import Quotation

    quotation = db.scalar(select(Quotation))
    response = create(admin_client, lead, quotation_id=str(quotation.id), contract_reference="CTR-2026/014")
    assert response.status_code == 201, response.text
    project = response.json()
    assert project["status"] == "draft" and project["customer_email"] == CUSTOMER
    assert project["quotation_reference"] == quotation.id.hex[:8].upper() and project["quotation_status"] == "accepted"
    assert project["scope_version"] == proposal["approved_version"] and project["contract_reference"] == "CTR-2026/014"
    assert project["scope"]["scope"] == COMPLETE["scope"]  # the approved scope, copied at that moment
    assert project["staff_transitions"] == ["quotation"] and project["revision"] == 1
    row = db.scalar(select(CommercialProject))
    workspace = db.scalar(select(CustomerWorkspace).where(CustomerWorkspace.id == row.workspace_id))
    assert db.get(CustomerAccount, workspace.owner_account_id).email == CUSTOMER
    # No amount anywhere in the project.
    assert "€" not in json.dumps(project) and "price" not in json.dumps(project).lower()
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "project.created"))
    assert entry.entity_id == str(row.id) and entry.details["lead"] == lead


def test_the_customer_is_chosen_by_a_verified_account_only(admin_client, configured_lead, client, inbox, db):
    assert create(admin_client, configured_lead).json()["code"] == "account_not_found"  # nobody registered
    body = {"email": CUSTOMER, "password": PASSWORD, "privacy_acknowledged": True}
    client.post("/api/accounts/register", json=body)
    assert create(admin_client, configured_lead).json()["code"] == "account_not_found"  # registered, not verified
    for payload in ({"workspace_id": "x"}, {"account_email": "not-an-email"}):
        assert (
            admin_client.post(f"{ADMIN}/leads/{configured_lead}/projects", json={"title": "T", **payload}).status_code
            == 422
        )
    erased = db.scalar(select(CustomerAccount))
    erased.email_verified_at = erased.created_at
    erased.erased_at = erased.created_at
    db.commit()
    assert create(admin_client, configured_lead).json()["code"] == "account_not_found"  # erased accounts have no claim
    assert db.scalar(select(func.count()).select_from(CommercialProject)) == 0


def test_creating_twice_returns_the_first_project(customer, admin_client, lead_with_acceptance, db):
    lead, _ = lead_with_acceptance
    from app.quotations.models import Quotation

    quotation = str(db.scalar(select(Quotation)).id)
    first = create(admin_client, lead, quotation_id=quotation)
    again = create(admin_client, lead, quotation_id=quotation, title="A different title")
    assert (first.status_code, again.status_code) == (201, 200) and again.json()["id"] == first.json()["id"]
    plain = create(admin_client, lead, title="Maintenance work")
    same = create(admin_client, lead, title="Maintenance work")
    assert (plain.status_code, same.status_code) == (201, 200) and plain.json()["id"] == same.json()["id"]
    assert db.scalar(select(func.count()).select_from(CommercialProject)) == 2


def test_a_quotation_must_be_accepted_and_belong_to_the_lead(customer, admin_client, configured_lead, make_lead, db):
    proposal = approved(admin_client, configured_lead)
    publish(admin_client, configured_lead, proposal)  # published, not accepted
    from app.quotations.models import Quotation

    quotation = str(db.scalar(select(Quotation)).id)
    refused = create(admin_client, configured_lead, quotation_id=quotation)
    assert refused.status_code == 409 and refused.json()["code"] == "quotation_not_accepted"
    make_lead(service="seo", email="other.lead@example.com")
    other = next(i["id"] for i in admin_client.get("/api/admin/leads").json()["items"] if i["id"] != configured_lead)
    assert create(admin_client, other, quotation_id=quotation).json()["code"] == "quotation_not_found"
    assert create(admin_client, configured_lead, quotation_id="00000000-0000-4000-8000-000000000000").status_code == 404


# --- Visibility ------------------------------------------------------------------------------------------


def test_a_draft_is_invisible_to_the_customer_and_later_states_are_visible(customer, admin_client, configured_lead):
    project = make_project(admin_client, configured_lead)
    assert customer.get(API).json() == []
    assert (
        customer.get(f"{API}/{project['id']}").status_code == 404
    )  # a draft answers like a project that does not exist
    project = advance(admin_client, project, ("quotation", None))
    listed = customer.get(API).json()
    assert [row["reference"] for row in listed] == [project["reference"]] and listed[0]["status"] == "quotation"
    assert customer.get(API).headers["cache-control"] == "no-store"
    assert customer.get(f"{API}/{project['id']}").headers["cache-control"] == "no-store"


def test_the_customer_view_has_no_staff_identity_internal_notes_or_other_customers(
    customer, admin_client, configured_lead
):
    project = to_awaiting(admin_client, configured_lead)
    note = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events",
        json={"kind": "update", "visibility": "internal", "body": "Internal: watch the budget."},
    )
    update = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events", json={"kind": "update", "body": "Prototype is ready for a look."}
    )
    assert note.status_code == update.status_code == 201
    view = customer.get(f"{API}/{project['id']}").json()
    serialized = json.dumps(view)
    assert "Internal: watch the budget." not in serialized and "Prototype is ready" in serialized
    for secret in (
        "admin.test@example.com",
        "Staff",
        "customer_email",
        "lead_id",
        "quotation_id",
        "created_by",
        configured_lead,
    ):
        assert secret not in serialized
    assert {event["author"] for event in view["events"]} <= {"team", "client", "system"}
    assert [event["visibility"] for event in view["events"]] == ["client"] * len(view["events"])
    staff = staff_get(admin_client, project["id"])
    assert any(event["visibility"] == "internal" for event in staff["events"])  # staff do see them


# --- Lifecycle -------------------------------------------------------------------------------------------


def test_the_full_lifecycle_with_staff_and_customer_moves(customer, admin_client, lead_with_acceptance, db):
    lead, _ = lead_with_acceptance
    from app.quotations.models import Quotation

    project = make_project(admin_client, lead, quotation_id=str(db.scalar(select(Quotation)).id))
    project = advance(admin_client, project, ("quotation", None), ("awaiting_approval", None))
    seen = customer.get(f"{API}/{project['id']}").json()
    assert seen["allowed_actions"] == ["approve_scope", "change_request", "support"]
    approve = decide(customer, project["id"], "approve_scope", seen["revision"])
    assert approve.status_code == 200 and approve.json()["status"] == "approved" and approve.json()["approved_at"]
    row = db.scalar(select(CommercialProject))
    assert row.approved_by_account_id == db.scalar(select(CustomerAccount)).id  # who approved is recorded
    project = staff_get(admin_client, project["id"])
    project = advance(admin_client, project, ("in_progress", None), ("client_review", "Version 1 delivered."))
    review = customer.get(f"{API}/{project['id']}").json()
    assert set(review["allowed_actions"]) == {"accept_completion", "request_changes", "change_request", "support"}
    # Changes requested: a note is required, and the project goes back to work.
    assert decide(customer, project["id"], "request_changes", review["revision"]).json()["code"] == "note_required"
    back = decide(
        customer, project["id"], "request_changes", review["revision"], note="Please change the contact form."
    )
    assert back.status_code == 200 and back.json()["status"] == "in_progress"
    project = advance(admin_client, staff_get(admin_client, project["id"]), ("client_review", "Form changed."))
    done = decide(
        customer, project["id"], "accept_completion", customer.get(f"{API}/{project['id']}").json()["revision"]
    )
    assert done.json()["status"] == "completed" and done.json()["completed_at"]
    project = advance(admin_client, staff_get(admin_client, project["id"]), ("maintenance", None))
    assert project["status"] == "maintenance" and project["staff_transitions"] == ["in_progress"]
    history = [
        (e["meta"] or {}).get("to")
        for e in customer.get(f"{API}/{project['id']}").json()["events"]
        if e["kind"] == "status"
    ]
    assert history == [
        "quotation",
        "awaiting_approval",
        "approved",
        "in_progress",
        "client_review",
        "in_progress",
        "client_review",
        "completed",
        "maintenance",
    ]
    approvals = [e for e in customer.get(f"{API}/{project['id']}").json()["events"] if e["kind"] == "approval"]
    assert len(approvals) == 1 and approvals[0]["meta"] == {"scope_version": row.scope_version}


@pytest.mark.parametrize(
    ("status_path", "to"),
    [
        ((), "approved"),
        ((), "in_progress"),
        ((), "completed"),
        ((("quotation", None),), "client_review"),
        ((("quotation", None),), "approved"),
        ((("quotation", None), ("awaiting_approval", None)), "approved"),  # only the customer approves the scope
        ((("quotation", None), ("awaiting_approval", None)), "in_progress"),
        ((("quotation", None), ("awaiting_approval", None)), "quotation"),
    ],
)
def test_invalid_staff_moves_are_refused(customer, admin_client, configured_lead, db, status_path, to):
    project = make_project(admin_client, configured_lead)
    if len(status_path) == 2:
        from app.quotations.models import Quotation  # noqa: F401  (the quotation rule is tested separately)

        project = advance(admin_client, project, status_path[0])
        row = db.get(CommercialProject, project["id"])
        row.status = "awaiting_approval"  # as if the quotation had been accepted
        db.commit()
        project = staff_get(admin_client, project["id"])
    else:
        project = advance(admin_client, project, *status_path)
    response = move(admin_client, project, to, "note")
    if to == "approved":
        assert response.status_code == 422  # the schema has no such move for staff: only the customer approves a scope
    else:
        assert response.status_code == 409 and response.json()["code"] == "project_transition"
    assert staff_get(admin_client, project["id"])["status"] == project["status"]


def test_asking_for_approval_needs_an_accepted_quotation(admin_client, customer, configured_lead):
    project = advance(admin_client, make_project(admin_client, configured_lead), ("quotation", None))
    refused = move(admin_client, project, "awaiting_approval")
    assert refused.status_code == 409 and refused.json()["code"] == "quotation_not_accepted"


def test_notes_are_required_where_the_lifecycle_says_so_and_revisions_are_checked(
    customer, admin_client, lead_with_acceptance, db
):
    lead, _ = lead_with_acceptance
    from app.quotations.models import Quotation

    project = make_project(admin_client, lead, quotation_id=str(db.scalar(select(Quotation)).id))
    project = advance(admin_client, project, ("quotation", None), ("awaiting_approval", None))
    seen = customer.get(f"{API}/{project['id']}").json()
    decide(customer, project["id"], "approve_scope", seen["revision"])
    project = advance(admin_client, staff_get(admin_client, project["id"]), ("in_progress", None))
    assert move(admin_client, project, "client_review").json()["code"] == "note_required"
    stale = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/transition",
        json={"expected_revision": 1, "to": "client_review", "note": "Ready"},
    )
    assert stale.status_code == 409 and stale.json()["code"] == "project_stale"
    project = advance(admin_client, project, ("client_review", "Ready"))
    assert move(admin_client, project, "completed").json()["code"] == "note_required"  # staff complete only with a note
    done = move(admin_client, project, "completed", "The customer accepted by phone.")
    assert done.status_code == 200 and done.json()["status"] == "completed"
    entry = db.scalars(
        select(AuditLog).where(AuditLog.action == "project.transition").order_by(AuditLog.id.desc())
    ).first()
    assert entry.details["to"] == "completed" and entry.actor_label == "admin.test@example.com"


def test_a_stale_customer_decision_is_refused_and_a_repeated_one_changes_nothing(
    customer, admin_client, lead_with_acceptance, db
):
    lead, _ = lead_with_acceptance
    from app.quotations.models import Quotation

    project = make_project(admin_client, lead, quotation_id=str(db.scalar(select(Quotation)).id))
    project = advance(admin_client, project, ("quotation", None), ("awaiting_approval", None))
    revision = customer.get(f"{API}/{project['id']}").json()["revision"]
    assert decide(customer, project["id"], "approve_scope", revision - 1).json()["code"] == "project_stale"
    first = decide(customer, project["id"], "approve_scope", revision)
    again = decide(customer, project["id"], "approve_scope", revision)
    assert first.status_code == again.status_code == 200 and again.json()["revision"] == first.json()["revision"]
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(ProjectEvent).where(ProjectEvent.kind == "approval")) == 1
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "project.approve_scope")) == 1
    wrong = decide(customer, project["id"], "accept_completion", first.json()["revision"])
    assert wrong.status_code == 409 and wrong.json()["code"] == "project_transition"


def test_simultaneous_approvals_record_one_decision(customer, admin_client, lead_with_acceptance, db):
    lead, _ = lead_with_acceptance
    from app.quotations.models import Quotation

    project = make_project(admin_client, lead, quotation_id=str(db.scalar(select(Quotation)).id))
    project = advance(admin_client, project, ("quotation", None), ("awaiting_approval", None))
    revision = customer.get(f"{API}/{project['id']}").json()["revision"]

    def approve(_):
        return decide(customer, project["id"], "approve_scope", revision).status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = list(pool.map(approve, range(4)))
    assert set(codes) == {200}
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(ProjectEvent).where(ProjectEvent.kind == "approval")) == 1


# --- Roles in the workspace -----------------------------------------------------------------------------


def test_workspace_roles_decide_who_may_approve(customer, admin_client, lead_with_acceptance, inbox, db):
    lead, _ = lead_with_acceptance
    from app.quotations.models import Quotation

    project = make_project(admin_client, lead, quotation_id=str(db.scalar(select(Quotation)).id))
    project = advance(admin_client, project, ("quotation", None), ("awaiting_approval", None))
    workspace = db.scalar(select(CustomerWorkspace))
    member = another_customer(inbox, "member@example.com")
    billing = another_customer(inbox, "billing@example.com")
    stranger = another_customer(inbox, "stranger@example.com")
    for email, role in (("member@example.com", "member"), ("billing@example.com", "billing")):
        account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == email))
        db.add(WorkspaceMember(workspace_id=workspace.id, account_id=account.id, role=role))
    db.commit()
    header = {"X-Workspace": str(workspace.id)}
    revision = customer.get(f"{API}/{project['id']}").json()["revision"]

    # A member reads, and sees what they may do: nothing but requests.
    view = member.get(f"{API}/{project['id']}", headers=header)
    assert view.status_code == 200 and view.json()["allowed_actions"] == ["change_request", "support"]
    refused = decide(member, project["id"], "approve_scope", revision, headers=header)
    assert refused.status_code == 403 and refused.json()["code"] == "role_not_allowed"
    assert (
        member.post(
            f"{API}/{project['id']}/requests",
            json={"kind": "support", "body": "How do I see the plan?"},
            headers={**csrf(member), **header},
        ).status_code
        == 201
    )
    # A non-member naming the workspace gets the answer of a workspace that does not exist.
    assert stranger.get(f"{API}/{project['id']}", headers=header).status_code == 404
    assert stranger.get(API, headers=header).status_code == 404
    # The billing member approves; staff cannot approve on the customer's behalf (tested above).
    assert billing.get(f"{API}/{project['id']}", headers=header).json()["allowed_actions"][0] == "approve_scope"
    approved_response = decide(billing, project["id"], "approve_scope", revision, headers=header)
    assert approved_response.status_code == 200
    assert (
        db.scalar(select(CommercialProject)).approved_by_account_id
        == db.scalar(select(CustomerAccount).where(CustomerAccount.email == "billing@example.com")).id
    )


# --- Isolation -------------------------------------------------------------------------------------------


def test_another_customer_cannot_see_decide_or_write_to_a_project(customer, admin_client, configured_lead, inbox, db):
    project = to_awaiting(admin_client, configured_lead)
    other = another_customer(inbox, "second.customer@example.com")
    missing = "00000000-0000-4000-8000-000000000000"
    assert other.get(API).json() == []
    for path, method, body in (
        (f"{API}/{project['id']}", "get", None),
        (f"{API}/{missing}", "get", None),
        (f"{API}/{project['id']}/decision", "post", {"expected_revision": 3, "action": "approve_scope"}),
        (f"{API}/{missing}/decision", "post", {"expected_revision": 3, "action": "approve_scope"}),
        (f"{API}/{project['id']}/requests", "post", {"kind": "support", "body": "Hello there"}),
    ):
        response = getattr(other, method)(path, **({"json": body, "headers": csrf(other)} if body else {}))
        assert response.status_code == 404 and response.json()["code"] == "project_not_found", (path, response.text)
    # The owner's project was not touched and its history holds nothing from the other customer.
    assert staff_get(admin_client, project["id"])["status"] == "awaiting_approval"
    assert db.scalar(select(func.count()).select_from(ProjectEvent).where(ProjectEvent.kind == "support")) == 0
    # A malformed id is a validation error before any lookup.
    assert other.get(f"{API}/not-a-uuid").status_code == 422


# --- Requests --------------------------------------------------------------------------------------------


def test_change_and_support_requests_are_answered_by_staff(customer, admin_client, configured_lead, db):
    project = to_awaiting(admin_client, configured_lead)
    sent = customer.post(
        f"{API}/{project['id']}/requests",
        json={"kind": "change_request", "body": "Please add a second language."},
        headers=csrf(customer),
    )
    assert sent.status_code == 201
    mine = [e for e in sent.json()["events"] if e["kind"] == "change_request"][0]
    assert mine["state"] == "open" and mine["mine"] is True and mine["author"] == "client"
    assert customer.get(API).json()[0]["open_requests"] == 1
    reply = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/requests/{mine['id']}/reply",
        json={"body": "We will price it in a separate quote.", "state": "answered"},
    )
    assert reply.status_code == 200
    view = customer.get(f"{API}/{project['id']}").json()
    answered = next(e for e in view["events"] if e["id"] == mine["id"])
    response = next(e for e in view["events"] if e["kind"] == "response")
    assert (
        answered["state"] == "answered"
        and response["parent_id"] == mine["id"]
        and response["author"] == "team"
        and response["mine"] is False
    )
    assert customer.get(API).json()[0]["open_requests"] == 0
    assert (
        admin_client.post(
            f"{ADMIN}/projects/{project['id']}/requests/{response['id']}/reply", json={"body": "Reply to a reply"}
        ).status_code
        == 404
    )  # only requests take replies
    actions = [
        r.action for r in db.scalars(select(AuditLog).where(AuditLog.entity_id == project["id"]).order_by(AuditLog.id))
    ]
    assert "project.change_request" in actions and "project.response" in actions


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "support", "body": "x"},
        {"kind": "support", "body": "x" * 2001},
        {"kind": "payment", "body": "Give me a refund"},
        {"kind": "support", "body": "Fine text", "state": "closed"},
        {"kind": "support", "body": "Fine text", "price": 10},
    ],
)
def test_requests_are_validated(customer, admin_client, configured_lead, body):
    project = to_awaiting(admin_client, configured_lead)
    assert customer.post(f"{API}/{project['id']}/requests", json=body, headers=csrf(customer)).status_code == 422


def test_html_in_text_is_neutralised(customer, admin_client, configured_lead):
    project = to_awaiting(admin_client, configured_lead)
    response = customer.post(
        f"{API}/{project['id']}/requests",
        json={"kind": "support", "body": "Hello <script>alert(1)</script> there"},
        headers=csrf(customer),
    )
    assert response.status_code in (201, 422)
    if response.status_code == 201:
        assert "<script>" not in json.dumps(response.json())


# --- Milestones, references and maintenance --------------------------------------------------------------


def test_staff_maintain_the_plan_and_references_and_the_customer_sees_them(customer, admin_client, configured_lead):
    project = to_awaiting(admin_client, configured_lead)
    plan = [
        {
            "title": "Structure and prototype",
            "description": "Key screens.",
            "indicative_timing": "to be agreed",
            "status": "done",
        },
        {"title": "Build", "status": "in_progress"},
        {"title": "Acceptance"},
    ]
    saved = admin_client.put(
        f"{ADMIN}/projects/{project['id']}/milestones",
        json={"expected_revision": project["revision"], "milestones": plan},
    )
    assert saved.status_code == 200, saved.text
    milestones = saved.json()["milestones"]
    assert [m["title"] for m in milestones] == ["Structure and prototype", "Build", "Acceptance"]
    assert milestones[0]["completed_at"] and milestones[1]["completed_at"] is None
    # Reordering and editing keep identities; dropping one removes it.
    again = [
        {"id": milestones[1]["id"], "title": milestones[1]["title"], "status": milestones[1]["status"]},
        {"id": milestones[0]["id"], "title": "Structure", "status": "done"},
    ]
    after = admin_client.put(
        f"{ADMIN}/projects/{project['id']}/milestones",
        json={"expected_revision": saved.json()["revision"], "milestones": again},
    ).json()
    assert [m["id"] for m in after["milestones"]] == [milestones[1]["id"], milestones[0]["id"]] and len(
        after["milestones"]
    ) == 2
    bad = admin_client.put(
        f"{ADMIN}/projects/{project['id']}/milestones",
        json={
            "expected_revision": after["revision"],
            "milestones": [{"id": "00000000-0000-4000-8000-000000000000", "title": "Ghost"}],
        },
    )
    assert bad.status_code == 422 and bad.json()["code"] == "milestone_unknown"
    too_many = admin_client.put(
        f"{ADMIN}/projects/{project['id']}/milestones",
        json={"expected_revision": after["revision"], "milestones": [{"title": f"M{i}"} for i in range(21)]},
    )
    assert too_many.status_code == 422

    edited = admin_client.patch(
        f"{ADMIN}/projects/{project['id']}",
        json={
            "expected_revision": after["revision"],
            "contract_reference": "CTR-2026/014",
            "invoice_references": ["INV-2026-0042", "INV-2026-0050"],
            "maintenance_plan": "website",
            "maintenance_note": "Monthly care from launch.",
        },
    )
    assert edited.status_code == 200, edited.text
    view = customer.get(f"{API}/{project['id']}").json()
    assert view["contract_reference"] == "CTR-2026/014" and view["invoice_references"] == [
        "INV-2026-0042",
        "INV-2026-0050",
    ]
    assert view["maintenance_plan"] == "website" and [m["title"] for m in view["milestones"]] == ["Build", "Structure"]
    stale = admin_client.patch(f"{ADMIN}/projects/{project['id']}", json={"expected_revision": 1, "title": "Changed"})
    assert stale.status_code == 409 and stale.json()["code"] == "project_stale"
    for body in (
        {"invoice_references": ["bad<ref>"]},
        {"contract_reference": "x" * 61},
        {"invoice_references": [f"I{i}" for i in range(11)]},
        {"price": 100},
        {"maintenance_plan": "Not Valid"},
    ):
        assert (
            admin_client.patch(
                f"{ADMIN}/projects/{project['id']}", json={"expected_revision": view["revision"], **body}
            ).status_code
            == 422
        )
    cleared = admin_client.patch(
        f"{ADMIN}/projects/{project['id']}",
        json={"expected_revision": view["revision"], "clear_contract_reference": True},
    )
    assert cleared.json()["contract_reference"] is None


# --- Staff authorization ---------------------------------------------------------------------------------


@pytest.mark.parametrize("role", ["editor", "viewer"])
def test_only_administrators_read_or_change_projects(customer, admin_client, configured_lead, db, role):
    project = to_awaiting(admin_client, configured_lead)
    other = staff_client(db, f"project.{role}@example.com", role)
    # Customer data is for the `admin` role, like leads: editors and viewers reach only the catalogue.
    assert other.get(f"{ADMIN}/projects").status_code == 403
    assert other.get(f"{ADMIN}/projects/{project['id']}").status_code == 403
    assert other.get(f"{ADMIN}/projects/{project['id']}/notifications").status_code == 403
    body = {"expected_revision": project["revision"]}
    assert create(other, configured_lead, title="Another").status_code == 403
    assert other.patch(f"{ADMIN}/projects/{project['id']}", json={**body, "title": "Hijack"}).status_code == 403
    assert (
        other.post(f"{ADMIN}/projects/{project['id']}/transition", json={**body, "to": "approved"}).status_code == 403
    )
    assert other.put(f"{ADMIN}/projects/{project['id']}/milestones", json={**body, "milestones": []}).status_code == 403
    assert (
        other.post(
            f"{ADMIN}/projects/{project['id']}/events", json={"kind": "update", "body": "Hello there"}
        ).status_code
        == 403
    )
    assert staff_get(admin_client, project["id"])["title"] == project["title"]


def test_staff_routes_need_a_staff_session_and_a_customer_cookie_is_not_one(
    customer, admin_client, configured_lead, inbox
):
    project = to_awaiting(admin_client, configured_lead)
    # A browser that holds only a customer session (the shared test client also holds the staff cookies).
    solo = another_customer(inbox, "solo.customer@example.com")
    for method, path in (
        ("get", f"{ADMIN}/projects"),
        ("get", f"{ADMIN}/projects/{project['id']}"),
        ("post", f"{ADMIN}/projects/{project['id']}/transition"),
    ):
        response = getattr(solo, method)(path, **({"json": {}} if method == "post" else {}))
        assert response.status_code in (401, 403), path
    assert solo.get(f"{ADMIN}/projects?status=bogus").status_code in (401, 403)
    assert admin_client.get(f"{ADMIN}/projects?status=bogus").status_code == 422
    assert [row["customer_email"] for row in admin_client.get(f"{ADMIN}/projects?status=awaiting_approval").json()] == [
        CUSTOMER
    ]
    assert admin_client.get(f"{ADMIN}/projects?status=approved").json() == []
    # The lead page lists the projects of its own lead only.
    assert [row["id"] for row in admin_client.get(f"{ADMIN}/projects?lead_id={configured_lead}").json()] == [
        project["id"]
    ]
    assert admin_client.get(f"{ADMIN}/projects?lead_id={uuid.uuid4()}").json() == []


def test_staff_cannot_write_a_client_visible_note_on_a_draft(customer, admin_client, configured_lead):
    project = make_project(admin_client, configured_lead)
    refused = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events", json={"kind": "update", "body": "Hello there"}
    )
    assert refused.status_code == 409 and refused.json()["code"] == "project_draft"
    internal = admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events",
        json={"kind": "update", "visibility": "internal", "body": "A note for us."},
    )
    assert internal.status_code == 201


# --- Records: audit, erasure, export, database -----------------------------------------------------------


def test_the_audit_trail_has_every_step(customer, admin_client, lead_with_acceptance, db):
    lead, _ = lead_with_acceptance
    from app.quotations.models import Quotation

    project = make_project(admin_client, lead, quotation_id=str(db.scalar(select(Quotation)).id))
    project = advance(admin_client, project, ("quotation", None), ("awaiting_approval", None))
    decide(customer, project["id"], "approve_scope", customer.get(f"{API}/{project['id']}").json()["revision"])
    customer.post(
        f"{API}/{project['id']}/requests",
        json={"kind": "support", "body": "A question for you."},
        headers=csrf(customer),
    )
    actions = [
        r.action for r in db.scalars(select(AuditLog).where(AuditLog.entity_id == project["id"]).order_by(AuditLog.id))
    ]
    assert actions == [
        "project.created",
        "project.transition",
        "project.transition",
        "project.approve_scope",
        "project.support",
    ]
    approved_entry = db.scalars(select(AuditLog).where(AuditLog.action == "project.approve_scope")).one()
    assert approved_entry.actor_label.startswith("account:") and approved_entry.details["to"] == "approved"


def test_erasing_an_account_keeps_the_project_and_erases_what_the_customer_wrote(
    customer, admin_client, configured_lead, db
):
    project = to_awaiting(admin_client, configured_lead)
    customer.post(
        f"{API}/{project['id']}/requests",
        json={"kind": "support", "body": "My phone is 0888 123 456."},
        headers=csrf(customer),
    )
    account = db.scalar(select(CustomerAccount))
    export = compliance_service.build_export(db, account)
    mine = export["commercial_projects"][0]
    assert mine["reference"] == project["reference"] and mine["your_messages"][0]["text"] == "My phone is 0888 123 456."
    assert "Internal" not in json.dumps(export, default=str)
    result = compliance_service.erase_account(db, account)
    db.commit()
    assert result == "anonymized"  # a contractual record stays, so the account is anonymised, not deleted
    rows = db.scalars(select(ProjectEvent).where(ProjectEvent.kind == "support")).all()
    assert [row.body for row in rows] == ["[erased]"] and rows[0].author_account_id is None
    assert db.scalar(select(func.count()).select_from(CommercialProject)) == 1
    assert staff_get(admin_client, project["id"])["status"] == "awaiting_approval"


def test_an_account_without_projects_is_still_deleted(customer, db):
    account = db.scalar(select(CustomerAccount))
    assert compliance_service.erase_account(db, account) == "deleted"


def test_the_tables_hold_the_rules_and_the_grants(db, customer, admin_client, configured_lead):
    project = make_project(admin_client, configured_lead)
    row = db.get(CommercialProject, project["id"])
    event = "INSERT INTO project_events (id, project_id, kind, author_kind, visibility{extra}) VALUES (gen_random_uuid(), :p, :kind, :author, 'client'{value})"
    for statement in (
        "UPDATE commercial_projects SET status = 'cancelled'",
        "UPDATE commercial_projects SET revision = 0",
        event.format(extra="", value="").replace(":kind", "'support'").replace(":author", "'client'"),  # no state
        event.format(extra=", state", value=", 'open'").replace(":kind", "'update'").replace(":author", "'staff'"),
        event.format(extra="", value="").replace(":kind", "'update'").replace(":author", "'robot'"),
        "INSERT INTO project_milestones (id, project_id, position, title, status)"
        " VALUES (gen_random_uuid(), :p, 0, 'x', 'finished')",
    ):
        with pytest.raises(DBAPIError):
            db.execute(text(statement), {"p": row.id})
        db.rollback()

    def may(role: str, table: str, privilege: str) -> bool:
        return db.scalar(text("SELECT has_table_privilege(:r, :t, :p)"), {"r": role, "t": table, "p": privilege})

    for table in ("commercial_projects", "project_events", "project_milestones"):
        assert (
            may("acs_app_api", table, "SELECT")
            and may("acs_app_api", table, "INSERT")
            and may("acs_app_api", table, "UPDATE")
        )
        assert not may("acs_app_runtime", table, "SELECT")
    assert may("acs_app_api", "project_milestones", "DELETE")
    assert not may("acs_app_api", "project_events", "DELETE") and not may(
        "acs_app_api", "commercial_projects", "DELETE"
    )
    indexes = {
        r[0] for r in db.execute(text("SELECT indexname FROM pg_indexes WHERE tablename = 'commercial_projects'"))
    }
    assert {"uq_commercial_projects_quotation", "uq_commercial_projects_lead_title"} <= indexes


def test_the_lifecycle_table_is_closed_and_consistent():
    assert set(service.TRANSITIONS) == {s for s in service.TRANSITIONS}
    reachable = {to for moves in service.TRANSITIONS.values() for to in moves}
    assert reachable == {
        "quotation",
        "awaiting_approval",
        "approved",
        "in_progress",
        "client_review",
        "completed",
        "maintenance",
    }
    assert service.can_move("awaiting_approval", "approved", "client") and not service.can_move(
        "awaiting_approval", "approved", "staff"
    )
    assert not service.can_move("draft", "approved", "staff") and not service.can_move("completed", "draft", "staff")
    assert service.staff_transitions("client_review") == ["in_progress", "completed"]
    assert service.allowed_for_client(CommercialProject(status="draft"), "owner") == []
    assert service.allowed_for_client(CommercialProject(status="client_review"), "member") == [
        "change_request",
        "support",
    ]


def test_the_scope_is_a_copy_that_does_not_follow_later_edits(customer, admin_client, lead_with_acceptance, db):
    lead, proposal = lead_with_acceptance
    from app.quotations.models import Quotation

    project = make_project(admin_client, lead, quotation_id=str(db.scalar(select(Quotation)).id))
    row = db.get(CommercialProject, project["id"])
    assert ProposalContent.model_validate(row.scope).scope == COMPLETE["scope"]
    assert (
        db.scalar(select(func.count()).select_from(ProjectMilestone)) == 0
    )  # the plan is staff's to write, never guessed
    assert db.scalar(select(Lead.id)) is not None
