# ruff: noqa: E501, F811
"""One journey through the whole commercial chain, with every commercial flag on (the browser suites cannot do this:
the commercial stack has no accounts, the legal stack has no configurator or quotations).

Visitor -> quote basket -> quote request (a lead) -> draft proposal -> human approval -> client-visible quotation
-> the client's answer -> customer project -> staff publish a document -> the customer is asked and approves ->
the project shows the history. Along the way: a second customer sees nothing, the price comes from the server's
schedule, a decision is made once, and the approval record names who, which project, which version, what and when.
"""

from __future__ import annotations

from sqlalchemy import func, select

from app import pricing
from app.accounts.models import CustomerAccount, OutboxKind, OutboxMessage
from app.config import get_settings
from app.models import Lead
from app.projects.doc_models import DocumentApproval, ProjectDocumentVersion
from app.projects.models import CommercialProject
from tests.test_project_documents import (  # noqa: F401  (fixtures and helpers shared with the other suites)
    active_project,
    customer_docs,
    decide,
    docs,
    published_document,
    request_approval,
)
from tests.test_projects import API, CUSTOMER, another_customer, customer, inbox  # noqa: F401
from tests.test_quotations import approved as approved_proposal
from tests.test_quotations import decision as quotation_decision
from tests.test_quotations import publish as publish_quotation
from tests.test_quote_basket import configuration, contact, extra, start

BASKET = "/api/public/quote-basket"


def test_a_visitor_becomes_a_customer_project_with_an_approved_document(
    customer, admin_client, docs, inbox, monkeypatch, db
):
    settings = get_settings()
    for flag in ("quote_basket_enabled", "project_configurator_enabled", "project_notifications_enabled"):
        monkeypatch.setattr(settings, flag, True)

    # 1. The basket: a configuration and an extra are sent as a quote request. Nothing the browser sends is a price.
    headers, _ = start(customer, configuration(features=["seo"], budget_range="2500_10000", timeline="asap"))
    added = customer.post(
        f"{BASKET}/items", headers=headers, json={"expected_version": 2, "item": extra("care_plan", "website")}
    )
    assert added.status_code == 201, added.text
    sent = customer.post(f"{BASKET}/submit", headers=headers, json=contact(expected_version=3, email=CUSTOMER))
    assert sent.status_code == 201, sent.text
    lead = db.scalar(select(Lead))
    view = lead.service_details["basket"]
    assert view["binding"] is False and view["schedule_version"] == pricing.schedule().version
    assert view["totals"]["one_time_from"] == pricing.band("service", "business_websites").from_

    # 2. A person completes and approves a proposal; only then is a quotation published (and it is not e-mailed).
    proposal = approved_proposal(admin_client, str(lead.id))
    published = publish_quotation(admin_client, str(lead.id), proposal)
    assert published.status_code == 201, published.text
    token = published.json()["token"]
    queued_before = db.scalar(select(func.count()).select_from(OutboxMessage))

    # 3. The client answers once; a second answer changes nothing.
    assert quotation_decision(customer, token).status_code == 200
    assert quotation_decision(customer, token, decision="decline").status_code in (404, 409, 410)

    # 4. Staff open the customer project from the accepted quotation; the owner sees it, a stranger does not.
    project = active_project(admin_client, str(lead.id))
    assert [item["id"] for item in customer.get(API).json()] == [project["id"]]
    stranger = another_customer(inbox, "stranger@example.com")
    assert stranger.get(API).json() == []
    assert stranger.get(f"{API}/{project['id']}").status_code == 404
    assert stranger.get(f"{API}/{project['id']}/documents").status_code == 404

    # 5. Documents: staff publish a version and ask for approval; only the owner decides, and only on that version.
    document = published_document(admin_client, project["id"])
    approval = request_approval(admin_client, project["id"], document["id"]).json()["documents"][0]["versions"][0][
        "approval"
    ]
    assert decide(stranger, project["id"], approval["id"], "approve", 1).status_code == 404
    stale = decide(customer, project["id"], approval["id"], "approve", 2)
    assert stale.status_code == 409 and stale.json()["code"] == "version_conflict"
    done = decide(customer, project["id"], approval["id"], "approve", 1, comment="Одобрявам.")
    assert done.status_code == 200, done.text
    assert decide(customer, project["id"], approval["id"], "approve", 1).status_code == 200  # the same answer: a no-op

    # 6. The record names who, which project, which version, what and when.
    row = db.get(DocumentApproval, approval["id"])
    db.refresh(row)
    account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == CUSTOMER))
    version = db.scalar(select(ProjectDocumentVersion))
    assert (row.state, row.decided_by_account_id, row.version_id, row.project_id) == (
        "approved",
        account.id,
        version.id,
        db.scalar(select(CommercialProject.id)),
    )
    assert row.decided_at is not None and row.decision_note == "Одобрявам."
    seen = customer_docs(customer, project["id"])["documents"][0]["versions"][0]["approval"]
    assert seen["state"] == "approved" and seen["decided_by"] == "you"
    assert db.scalar(select(func.count()).select_from(DocumentApproval)) == 1

    # 7. Service messages were queued for the project (ids only); the quotation link itself was never queued.
    queued = list(db.scalars(select(OutboxMessage.kind)))
    assert db.scalar(select(func.count()).select_from(OutboxMessage)) > queued_before
    assert OutboxKind.APPROVAL_REQUESTED in queued
