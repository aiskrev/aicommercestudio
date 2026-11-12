"""E-mail about a customer's own project (app/projects/notify.py): who gets what, once, and nothing sensitive."""

# ruff: noqa: E501, F811  (long, readable assertions; fixtures imported from test_projects are used as arguments)
from __future__ import annotations

import smtplib
from datetime import timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select, text

from app.accounts import mail
from app.accounts.models import CustomerAccount, OutboxKind, OutboxMessage, OutboxStatus
from app.config import Settings, get_settings
from app.models import utcnow
from app.workspace.models import CustomerWorkspace, WorkspaceMember
from tests.test_project_documents import (  # noqa: F401  (helpers shared with the document tests)
    ADMIN,
    active_project,
    docs,
    pdf,
    publish,
    request_approval,
    staff_upload,
)
from tests.test_projects import (  # noqa: F401
    API,
    CUSTOMER,
    another_customer,
    configured_lead,
    csrf,
    customer,
    inbox,
    make_project,
    move,
)
from tests.test_security import _production


@pytest.fixture
def notes(docs, monkeypatch):
    """Documents on as well (for the document events), notifications on, and the `inbox` mailbox as the provider."""
    monkeypatch.setattr(get_settings(), "project_notifications_enabled", True)
    monkeypatch.setattr(get_settings(), "project_upload_require_scan", False)
    return docs


def outbox(db, kind: str | None = None) -> list[OutboxMessage]:
    query = (
        select(OutboxMessage)
        .where(OutboxMessage.project_id.is_not(None))
        .order_by(OutboxMessage.created_at, OutboxMessage.id)
    )
    if kind:
        query = query.where(OutboxMessage.kind == kind)
    db.expire_all()
    return list(db.scalars(query).all())


def send(inbox) -> dict[str, int]:
    return mail.dispatch_pending(sender=inbox, limit=100)


def project_mail(inbox, since: int):
    return inbox.messages[since:]


# --- Flag ----------------------------------------------------------------------------------------------------------


def test_nothing_is_queued_while_the_flag_is_off(customer, admin_client, configured_lead, docs, db):
    assert Settings.model_fields["project_notifications_enabled"].default is False
    project = active_project(admin_client, configured_lead)
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events",
        json={"kind": "update", "visibility": "client", "body": "Ново обновление"},
    )
    assert outbox(db) == []


def test_production_needs_projects_accounts_and_so_verified_delivery(monkeypatch):
    with pytest.raises(ValidationError, match="PROJECT_NOTIFICATIONS_ENABLED needs COMMERCIAL_PROJECTS_ENABLED"):
        _production(project_notifications_enabled=True)


# --- Which events send what, to whom ---------------------------------------------------------------------------------


def test_each_event_queues_one_message_for_the_right_kind(customer, admin_client, configured_lead, notes, db, inbox):
    project = make_project(admin_client, configured_lead)
    assert outbox(db) == []  # a draft is invisible: nothing is queued about it
    project = move(admin_client, project, "quotation").json()
    assert [r.kind for r in outbox(db)] == ["project_available"]
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events",
        json={"kind": "update", "visibility": "client", "body": "Започнахме подготовката"},
    )
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events",
        json={"kind": "delivery", "visibility": "client", "body": "Първи макети"},
    )
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events",
        json={"kind": "update", "visibility": "internal", "body": "Вътрешна бележка"},
    )
    assert [r.kind for r in outbox(db)] == [
        "project_available",
        "project_update",
        "project_update",
    ]  # the internal note sends nothing

    request = customer.post(
        f"{API}/{project['id']}/requests",
        json={"kind": "support", "body": "Кога ще има макети?"},
        headers=csrf(customer),
    )
    request_id = next(e["id"] for e in request.json()["events"] if e["kind"] == "support")
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/requests/{request_id}/reply", json={"body": "Утре.", "state": "answered"}
    )
    assert outbox(db)[-1].kind == "support_reply"

    document = staff_upload(admin_client, project["id"]).json()["documents"][0]
    assert [r.kind for r in outbox(db)].count("document_published") == 0  # a draft file sends nothing
    publish(admin_client, project["id"], document["id"])
    assert outbox(db)[-1].kind == "document_published"
    request_approval(admin_client, project["id"], document["id"], message="Моля, одобрете")
    assert outbox(db)[-1].kind == "approval_requested"


def test_the_messages_go_to_the_right_people_by_role(customer, admin_client, configured_lead, notes, db, inbox):
    draft = make_project(admin_client, configured_lead)  # creates the customer's workspace
    workspace = db.scalar(select(CustomerWorkspace))
    another_customer(inbox, "member.notes@example.com")
    another_customer(inbox, "billing.notes@example.com")
    for email, role in (("member.notes@example.com", "member"), ("billing.notes@example.com", "billing")):
        account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == email))
        db.add(WorkspaceMember(workspace_id=workspace.id, account_id=account.id, role=role))
    db.commit()
    project = move(admin_client, draft, "quotation").json()
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events", json={"kind": "update", "visibility": "client", "body": "Ново"}
    )
    updates = {db.get(CustomerAccount, r.account_id).email for r in outbox(db, "project_update")}
    assert updates == {CUSTOMER, "member.notes@example.com", "billing.notes@example.com"}
    document = staff_upload(admin_client, project["id"]).json()["documents"][0]
    publish(admin_client, project["id"], document["id"])
    request_approval(admin_client, project["id"], document["id"])
    deciders = {db.get(CustomerAccount, r.account_id).email for r in outbox(db, "approval_requested")}
    assert deciders == {CUSTOMER, "billing.notes@example.com"}  # a plain member is not asked to decide


def test_an_unverified_erased_or_unknown_recipient_gets_nothing(
    customer, admin_client, configured_lead, notes, db, inbox
):
    draft = make_project(admin_client, configured_lead)
    workspace = db.scalar(select(CustomerWorkspace))
    another_customer(inbox, "unverified.notes@example.com")
    another_customer(inbox, "erased.notes@example.com")
    unverified = db.scalar(select(CustomerAccount).where(CustomerAccount.email == "unverified.notes@example.com"))
    erased = db.scalar(select(CustomerAccount).where(CustomerAccount.email == "erased.notes@example.com"))
    unverified.email_verified_at = None
    erased.erased_at = utcnow()
    for account in (unverified, erased):
        db.add(WorkspaceMember(workspace_id=workspace.id, account_id=account.id, role="member"))
    db.commit()
    move(admin_client, draft, "quotation")
    assert {db.get(CustomerAccount, r.account_id).email for r in outbox(db)} == {CUSTOMER}


# --- Once per event ----------------------------------------------------------------------------------------------


def test_a_repeated_action_or_a_second_worker_cannot_queue_a_message_twice(
    customer, admin_client, configured_lead, notes, db
):
    import uuid

    from app.projects import notify
    from app.projects.models import CommercialProject

    project = active_project(admin_client, configured_lead)
    row = db.get(CommercialProject, project["id"])
    event = uuid.uuid4()
    assert notify.queue(db, row, OutboxKind.PROJECT_UPDATE, event) == 1
    db.commit()
    assert notify.queue(db, row, OutboxKind.PROJECT_UPDATE, event) == 0
    db.commit()
    assert db.scalar(select(func.count()).select_from(OutboxMessage).where(OutboxMessage.event_ref == event)) == 1
    assert notify.queue(db, row, OutboxKind.SUPPORT_REPLY, event) == 1  # the same event may cause another kind
    db.commit()

    milestones = {"expected_revision": project["revision"], "milestones": [{"title": "Дизайн", "status": "planned"}]}
    first = admin_client.put(f"{ADMIN}/projects/{project['id']}/milestones", json=milestones)
    assert first.status_code == 200
    before = len(outbox(db, "project_update"))
    same = admin_client.put(
        f"{ADMIN}/projects/{project['id']}/milestones",
        json={
            **milestones,
            "expected_revision": first.json()["revision"],
            "milestones": [{"id": first.json()["milestones"][0]["id"], "title": "Дизайн", "status": "planned"}],
        },
    )
    assert same.status_code == 200 and len(outbox(db, "project_update")) == before  # identical plan: no message
    changed = admin_client.put(
        f"{ADMIN}/projects/{project['id']}/milestones",
        json={
            "expected_revision": same.json()["revision"],
            "milestones": [{"id": first.json()["milestones"][0]["id"], "title": "Дизайн", "status": "done"}],
        },
    )
    assert changed.status_code == 200 and len(outbox(db, "project_update")) == before + 1

    document = staff_upload(admin_client, project["id"]).json()["documents"][0]
    publish(admin_client, project["id"], document["id"])
    publish(admin_client, project["id"], document["id"])  # a repeat
    request_approval(admin_client, project["id"], document["id"])
    request_approval(admin_client, project["id"], document["id"])  # a repeat returns the open request
    kinds = [r.kind for r in outbox(db)]
    assert kinds.count("document_published") == 1 and kinds.count("approval_requested") == 1


# --- Sending: wording, locale, redaction, failures -----------------------------------------------------------------


def test_the_message_carries_a_reference_a_title_and_a_link_and_nothing_else(
    customer, admin_client, configured_lead, notes, db, inbox, monkeypatch
):
    monkeypatch.setattr(get_settings(), "site_url", "https://trusted.example.com")
    project = active_project(admin_client, configured_lead, title="Нов бизнес сайт")
    document = staff_upload(
        admin_client, project["id"], pdf("t"), filename="тайно-име.pdf", title="Таен документ"
    ).json()["documents"][0]
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events",
        json={"kind": "update", "visibility": "internal", "body": "ВЪТРЕШНО-ТАЙНО"},
    )
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events",
        json={"kind": "update", "visibility": "client", "body": "ЗАБЕЛЕЖКА-ЗА-КЛИЕНТА"},
    )
    publish(admin_client, project["id"], document["id"])
    start = len(inbox.messages)
    assert send(inbox)["sent"] == 3
    sent = project_mail(inbox, start)
    assert {recipient for recipient, _s, _b in sent} == {CUSTOMER}
    for _recipient, subject, body in sent:
        assert project["reference"] in subject + body and "Нов бизнес сайт" in body
        assert f"https://trusted.example.com/bg/konto/izrabotka?p={project['id']}" in body
        # Neither a note, a file name, a document title, a token nor an amount is in the message.
        for secret in ("ВЪТРЕШНО-ТАЙНО", "ЗАБЕЛЕЖКА-ЗА-КЛИЕНТА", "тайно-име", "Таен документ", "token", "#"):
            assert secret not in body and secret not in subject, secret
    assert {row.status for row in outbox(db)} == {OutboxStatus.SENT.value}
    assert all(row.sent_at is not None and row.attempts == 1 for row in outbox(db))


def test_the_message_follows_the_language_of_the_account(customer, admin_client, configured_lead, notes, db, inbox):
    account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == CUSTOMER))
    account.locale = "en"
    db.commit()
    active_project(admin_client, configured_lead)
    start = len(inbox.messages)
    send(inbox)
    _to, subject, body = inbox.messages[start]
    assert subject.startswith("Project ") and "Sign in to your account" in body and "/en/account/delivery?p=" in body
    assert "Здравейте" not in body


def test_a_provider_outage_is_retried_with_backoff_and_then_given_up(
    customer, admin_client, configured_lead, notes, db, inbox
):
    active_project(admin_client, configured_lead)
    inbox.fail = smtplib.SMTPServerDisconnected("provider down")
    result = send(inbox)
    assert result["retry"] == 1 and result["sent"] == 0
    row = outbox(db)[0]
    assert (
        row.status == "pending"
        and row.attempts == 1
        and row.last_error == "SMTPServerDisconnected"
        and row.next_attempt_at > utcnow()
    )
    assert send(inbox)["sent"] == 0  # not due yet: nothing is tried again at once
    for _ in range(mail.MAX_ATTEMPTS):
        db.execute(
            text("UPDATE outbox_messages SET next_attempt_at = now() - interval '1 minute' WHERE status = 'pending'")
        )
        db.commit()
        send(inbox)
    row = outbox(db)[0]
    assert row.status == "failed" and row.attempts == mail.MAX_ATTEMPTS
    inbox.fail = None
    assert send(inbox)["sent"] == 0  # a failed row is not sent later by accident


def test_a_recipient_the_provider_refuses_fails_at_once(customer, admin_client, configured_lead, notes, db, inbox):
    active_project(admin_client, configured_lead)
    inbox.fail = smtplib.SMTPRecipientsRefused({CUSTOMER: (550, b"no such user")})
    result = send(inbox)
    assert result["failed"] == 1 and result["retry"] == 0
    row = outbox(db)[0]
    assert row.status == "failed" and row.attempts == 1 and row.last_error == "SMTPRecipientsRefused"


def test_a_message_whose_project_is_gone_or_whose_account_was_erased_is_failed_not_crashed(
    customer, admin_client, configured_lead, notes, db, inbox
):
    project = active_project(admin_client, configured_lead)
    db.execute(text("UPDATE commercial_projects SET status = 'draft' WHERE id = :p"), {"p": project["id"]})
    db.commit()
    assert send(inbox)["failed"] == 1
    assert outbox(db)[0].last_error == "source_missing"
    db.execute(text("UPDATE commercial_projects SET status = 'quotation' WHERE id = :p"), {"p": project["id"]})
    db.commit()  # release the row lock before the API touches the project
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/events", json={"kind": "update", "visibility": "client", "body": "Ново"}
    )
    account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == CUSTOMER))
    account.erased_at = utcnow()
    db.commit()
    result = send(inbox)
    assert result["failed"] == 1 and outbox(db, "project_update")[0].last_error == "recipient_invalid"


def test_without_a_provider_nothing_pretends_to_work(
    customer, admin_client, configured_lead, notes, db, inbox, monkeypatch
):
    def refuse(*_args):
        raise mail.EmailNotConfigured

    monkeypatch.setattr(mail, "get_sender", refuse)
    active_project(admin_client, configured_lead)
    result = mail.dispatch_pending(limit=100)
    assert (
        result["blocked"] == 1
        and outbox(db)[0].status == "blocked"
        and outbox(db)[0].last_error == "provider_not_configured"
    )


def test_logs_never_hold_an_address_or_a_message_text(
    customer, admin_client, configured_lead, notes, db, inbox, caplog
):
    active_project(admin_client, configured_lead)
    inbox.fail = smtplib.SMTPServerDisconnected("down")
    with caplog.at_level("DEBUG"):
        send(inbox)
    text_of_logs = " ".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert CUSTOMER not in text_of_logs and "Нов бизнес сайт" not in text_of_logs


def test_marketing_consent_has_nothing_to_do_with_these_messages(
    customer, admin_client, configured_lead, notes, db, inbox
):
    account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == CUSTOMER))
    assert account.marketing_consent_at is None  # never given, and still the service messages are queued and sent
    active_project(admin_client, configured_lead)
    start = len(inbox.messages)
    assert send(inbox)["sent"] == 1
    body = inbox.messages[start][2].lower()
    assert "unsubscribe" not in body and "отписване" not in body and "промоц" not in body and "промо" not in body


# --- Staff view of the delivery --------------------------------------------------------------------------------------


def test_staff_see_the_delivery_state_but_never_an_address_or_text(
    customer, admin_client, configured_lead, notes, db, inbox
):
    project = active_project(admin_client, configured_lead)
    inbox.fail = smtplib.SMTPServerDisconnected("down")
    send(inbox)
    rows = admin_client.get(f"{ADMIN}/projects/{project['id']}/notifications")
    assert rows.status_code == 200
    body = rows.json()
    assert [(r["kind"], r["status"], r["attempts"], r["last_error"]) for r in body] == [
        ("project_available", "pending", 1, "SMTPServerDisconnected")
    ]
    assert CUSTOMER not in rows.text and "subject" not in rows.text and "body" not in rows.text
    from fastapi.testclient import TestClient

    from app.main import app

    assert TestClient(app).get(f"{ADMIN}/projects/{project['id']}/notifications").status_code == 401
    assert (customer.get(f"{ADMIN}/projects/00000000-0000-4000-8000-000000000000/notifications").status_code) in (
        404,
        401,
        403,
    )


def test_the_expiry_rules_of_the_account_links_are_untouched(customer, inbox, db):
    """The verification and reset links of the existing outbox still carry a token in the fragment, which project mail never does."""
    assert "#token=" in inbox.messages[0][2]
    assert OutboxKind.VERIFY_EMAIL.value == "verify_email" and timedelta(hours=1) < timedelta(
        hours=get_settings().account_verify_token_hours + 1
    )
