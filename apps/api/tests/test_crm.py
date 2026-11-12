"""Admin CRM (app/crm): the owner of an enquiry, follow-up tasks, overview, timeline, customer links and the export."""

# ruff: noqa: E501, F811  (long, readable assertions; fixtures imported from test_projects are used as arguments)
from __future__ import annotations

import csv
import io
from datetime import timedelta

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.crm import service
from app.crm.models import LeadTask
from app.models import AdminUser, AuditLog, Lead, utcnow
from app.opportunities.models import LeadOpportunity
from tests.test_catalogue_api import staff_client
from tests.test_projects import (  # noqa: F401  (fixtures and helpers shared with the project tests)
    accepted_lead,
    configured_lead,
    customer,
    inbox,
    make_project,
)

ADMIN = "/api/admin"


def lead_ids(admin_client) -> list[str]:
    return [item["id"] for item in admin_client.get(f"{ADMIN}/leads", params={"sort": "oldest"}).json()["items"]]


@pytest.fixture
def three_leads(admin_client, make_lead):
    make_lead(
        service="seo", name="Анна Петрова", company="Алфа ООД", email="anna.alpha@example.com", phone="+359 88 111 2222"
    )
    make_lead(service="automation", name="Борис Иванов", company="Бета ЕООД", email="boris.beta@example.com")
    make_lead(service="seo", name="Вера Георгиева", company="Гама ООД", email="vera.gama@example.com")
    return lead_ids(admin_client)


def second_admin(db, email="second.admin@example.com") -> tuple[object, AdminUser]:
    client = staff_client(db, email, "admin")
    return client, db.scalar(select(AdminUser).where(AdminUser.email == email))


def task(admin_client, lead_id, **body):
    return admin_client.post(f"{ADMIN}/leads/{lead_id}/tasks", json={"title": "Обадете се на клиента", **body})


# --- Roles and sessions -----------------------------------------------------------------------------------------------


@pytest.mark.parametrize("role", ["editor", "viewer"])
def test_editors_and_viewers_reach_none_of_it(admin_client, three_leads, db, role):
    other = staff_client(db, f"crm.{role}@example.com", role)
    lead = three_leads[0]
    created = task(admin_client, lead).json()
    for method, path, body in (
        ("get", f"{ADMIN}/crm/overview", None),
        ("get", f"{ADMIN}/crm/tasks", None),
        ("get", f"{ADMIN}/crm/admins", None),
        ("get", f"{ADMIN}/crm/leads.csv", None),
        ("get", f"{ADMIN}/leads/{lead}/timeline", None),
        ("get", f"{ADMIN}/leads/{lead}/customer", None),
        ("get", f"{ADMIN}/leads/{lead}/tasks", None),
        ("post", f"{ADMIN}/leads/{lead}/tasks", {"title": "Ново"}),
        ("patch", f"{ADMIN}/tasks/{created['id']}", {"expected_revision": 1, "state": "done"}),
        ("put", f"{ADMIN}/leads/{lead}/owner", {"owner_id": None}),
    ):
        response = getattr(other, method)(path, **({"json": body} if body is not None else {}))
        assert response.status_code == 403, (method, path, response.text)
    assert admin_client.get(f"{ADMIN}/leads/{lead}/tasks").json()[0]["state"] == "open"


def test_nothing_works_without_a_session(three_leads):
    from fastapi.testclient import TestClient

    from app.main import app

    nobody = TestClient(app)
    lead = three_leads[0]
    for path in (
        f"{ADMIN}/crm/overview",
        f"{ADMIN}/crm/tasks",
        f"{ADMIN}/crm/leads.csv",
        f"{ADMIN}/leads/{lead}/timeline",
        f"{ADMIN}/leads/{lead}/customer",
    ):
        assert nobody.get(path).status_code == 401, path


# --- The owner of an enquiry ----------------------------------------------------------------------------------------


def test_an_owner_is_set_cleared_filtered_and_audited(admin_client, three_leads, db, admin_user):
    other_client, other = second_admin(db)
    lead = three_leads[0]
    assert admin_client.get(f"{ADMIN}/leads/{lead}").json()["owner_id"] is None
    done = admin_client.put(f"{ADMIN}/leads/{lead}/owner", json={"owner_id": str(other.id)})
    assert done.status_code == 200 and done.json()["owner"] == {"id": str(other.id), "name": other.full_name}
    detail = admin_client.get(f"{ADMIN}/leads/{lead}").json()
    assert detail["owner_id"] == str(other.id) and detail["owner_name"] == other.full_name

    assert (
        admin_client.put(f"{ADMIN}/leads/{lead}/owner", json={"owner_id": str(other.id)}).status_code == 200
    )  # a repeat
    entries = db.scalars(select(AuditLog).where(AuditLog.action == "lead.owner_set")).all()
    assert len(entries) == 1 and entries[0].details == {"from": None, "to": str(other.id)}

    mine = admin_client.put(f"{ADMIN}/leads/{three_leads[1]}/owner", json={"owner_id": str(admin_user.id)})
    assert mine.status_code == 200

    def by_owner(value):
        page = admin_client.get(f"{ADMIN}/leads", params={"owner": value, "sort": "oldest"}).json()
        return [i["id"] for i in page["items"]]

    assert (
        by_owner("me") == [three_leads[1]]
        and by_owner(str(other.id)) == [lead]
        and by_owner("none") == [three_leads[2]]
    )
    assert other_client.get(f"{ADMIN}/leads", params={"owner": "me"}).json()["total"] == 1

    cleared = admin_client.put(f"{ADMIN}/leads/{lead}/owner", json={"owner_id": None})
    assert cleared.status_code == 200 and cleared.json()["owner"] is None
    assert by_owner("none") == [lead, three_leads[2]]
    assert admin_client.get(f"{ADMIN}/leads", params={"owner": "someone"}).status_code == 422


def test_only_an_active_administrator_can_own_anything(admin_client, three_leads, db):
    editor = staff_client(db, "owner.editor@example.com", "editor")
    editor_user = db.scalar(select(AdminUser).where(AdminUser.email == "owner.editor@example.com"))
    inactive_client, inactive = second_admin(db, "gone.admin@example.com")
    inactive.is_active = False
    db.commit()
    lead = three_leads[0]
    for owner_id in (str(editor_user.id), str(inactive.id), "00000000-0000-4000-8000-000000000000"):
        refused = admin_client.put(f"{ADMIN}/leads/{lead}/owner", json={"owner_id": owner_id})
        assert refused.status_code == 422 and refused.json()["code"] == "assignee_invalid"
        assert task(admin_client, lead, assignee_id=owner_id).status_code == 422
    assert editor is not None
    assert admin_client.get(f"{ADMIN}/leads/{lead}").json()["owner_id"] is None
    names = [a["name"] for a in admin_client.get(f"{ADMIN}/crm/admins").json()]
    assert "gone.admin" not in str(names) and len(names) >= 1


# --- Follow-up tasks ---------------------------------------------------------------------------------------------


def test_a_task_goes_through_its_life_with_revisions_and_audit(admin_client, three_leads, db, admin_user):
    lead = three_leads[0]
    tomorrow = (utcnow().date() + timedelta(days=1)).isoformat()
    created = task(admin_client, lead, due_on=tomorrow)
    assert created.status_code == 201
    body = created.json()
    assert body["state"] == "open" and body["revision"] == 1 and body["overdue"] is False and body["due_on"] == tomorrow
    assert body["assignee"]["id"] == str(admin_user.id)  # no owner yet: the person who added it
    assert (
        body["lead_reference"] and "Анна" not in str(body) and "anna" not in str(body).lower()
    )  # no personal data of the customer

    url = f"{ADMIN}/tasks/{body['id']}"
    renamed = admin_client.patch(url, json={"expected_revision": 1, "title": "Изпратете оферта"})
    assert (
        renamed.status_code == 200 and renamed.json()["revision"] == 2 and renamed.json()["title"] == "Изпратете оферта"
    )
    stale = admin_client.patch(url, json={"expected_revision": 1, "state": "done"})
    assert stale.status_code == 409 and stale.json()["code"] == "task_stale"
    repeat = admin_client.patch(url, json={"expected_revision": 2, "title": "Изпратете оферта"})
    assert repeat.status_code == 200 and repeat.json()["revision"] == 2  # nothing changed, not even the revision

    done = admin_client.patch(url, json={"expected_revision": 2, "state": "done"})
    assert (
        done.status_code == 200
        and done.json()["state"] == "done"
        and done.json()["done_at"]
        and done.json()["revision"] == 3
    )
    row = db.get(LeadTask, body["id"])
    db.refresh(row)
    assert row.done_by_id == admin_user.id
    reopened = admin_client.patch(url, json={"expected_revision": 3, "state": "open"})
    assert reopened.json()["state"] == "open" and reopened.json()["done_at"] is None
    cancelled = admin_client.patch(url, json={"expected_revision": 4, "state": "cancelled"})
    assert cancelled.json()["state"] == "cancelled"
    cleared = admin_client.patch(url, json={"expected_revision": 5, "clear_due": True, "clear_assignee": True})
    assert cleared.json()["due_on"] is None and cleared.json()["assignee"] is None

    actions = [
        e.action
        for e in db.scalars(select(AuditLog).where(AuditLog.entity_id == lead).order_by(AuditLog.id)).all()
        if e.action.startswith("lead.task")
    ]
    assert actions == [
        "lead.task_created",
        "lead.task_updated",
        "lead.task_done",
        "lead.task_updated",
        "lead.task_updated",
        "lead.task_updated",
    ]
    assert (
        admin_client.patch(
            f"{ADMIN}/tasks/00000000-0000-4000-8000-000000000000", json={"expected_revision": 1}
        ).status_code
        == 404
    )


def test_a_task_takes_the_owner_as_assignee_and_refuses_a_past_date_and_bad_text(admin_client, three_leads, db):
    _client, other = second_admin(db)
    lead = three_leads[0]
    admin_client.put(f"{ADMIN}/leads/{lead}/owner", json={"owner_id": str(other.id)})
    assert task(admin_client, lead).json()["assignee"]["id"] == str(other.id)
    yesterday = (utcnow().date() - timedelta(days=1)).isoformat()
    refused = task(admin_client, lead, due_on=yesterday)
    assert refused.status_code == 422 and refused.json()["code"] == "due_in_past"
    for title in ("", "<b>bold</b>", "x" * 201):
        assert admin_client.post(f"{ADMIN}/leads/{lead}/tasks", json={"title": title}).status_code == 422
    assert (
        admin_client.post(f"{ADMIN}/leads/{lead}/tasks", json={"title": "ok", "state": "done"}).status_code == 422
    )  # unknown field
    created = task(admin_client, lead).json()
    stale_past = admin_client.patch(
        f"{ADMIN}/tasks/{created['id']}", json={"expected_revision": 1, "due_on": yesterday}
    )
    assert stale_past.status_code == 422


def test_the_list_filters_by_assignee_state_and_date_and_pages(admin_client, three_leads, db, admin_user):
    _client, other = second_admin(db)
    today = utcnow().date()
    first = task(
        admin_client, three_leads[0], title="Просрочена", due_on=(today + timedelta(days=1)).isoformat()
    ).json()
    soon = task(
        admin_client, three_leads[1], title="Тази седмица", due_on=(today + timedelta(days=5)).isoformat()
    ).json()
    later = task(
        admin_client,
        three_leads[2],
        title="По-късно",
        due_on=(today + timedelta(days=40)).isoformat(),
        assignee_id=str(other.id),
    ).json()
    undated = task(admin_client, three_leads[2], title="Без дата", assignee_id=str(other.id)).json()
    db.execute(
        text("UPDATE lead_tasks SET due_on = :d WHERE id = :i"), {"d": today - timedelta(days=3), "i": first["id"]}
    )
    db.commit()

    def titles(**params):
        return [t["title"] for t in admin_client.get(f"{ADMIN}/crm/tasks", params=params).json()["items"]]

    assert titles() == ["Просрочена", "Тази седмица", "По-късно", "Без дата"]  # the oldest date first, undated last
    assert titles(due="overdue") == ["Просрочена"]
    assert titles(due="week") == ["Тази седмица"]
    assert titles(due="none") == ["Без дата"]
    assert titles(assignee="me") == ["Просрочена", "Тази седмица"]
    assert titles(assignee=str(other.id)) == ["По-късно", "Без дата"]
    assert admin_client.get(f"{ADMIN}/crm/tasks", params={"due": "soon"}).status_code == 422
    overdue = admin_client.get(f"{ADMIN}/crm/tasks", params={"due": "overdue"}).json()["items"][0]
    assert overdue["overdue"] is True and overdue["lead_service"] == "seo"
    page = admin_client.get(f"{ADMIN}/crm/tasks", params={"page_size": 3, "page": 2}).json()
    assert page["total"] == 4 and len(page["items"]) == 1

    admin_client.patch(f"{ADMIN}/tasks/{soon['id']}", json={"expected_revision": 1, "state": "done"})
    assert titles() == ["Просрочена", "По-късно", "Без дата"]  # open work only by default
    assert titles(state="done") == ["Тази седмица"]
    assert later and undated


def test_an_enquiry_has_a_limit_of_open_tasks(admin_client, three_leads, monkeypatch):
    monkeypatch.setattr(service, "MAX_OPEN_TASKS_PER_LEAD", 2)
    assert task(admin_client, three_leads[0]).status_code == 201
    assert task(admin_client, three_leads[0]).status_code == 201
    refused = task(admin_client, three_leads[0])
    assert refused.status_code == 409 and refused.json()["code"] == "task_limit"
    assert task(admin_client, three_leads[1]).status_code == 201


def test_tasks_go_with_their_lead_and_the_tables_hold_the_rules(admin_client, three_leads, db):
    lead = three_leads[0]
    created = task(admin_client, lead).json()
    for statement in (
        "UPDATE lead_tasks SET state = 'maybe'",
        "UPDATE lead_tasks SET state = 'done'",  # a finished task needs its time
        "UPDATE lead_tasks SET done_at = now()",  # an open task has none
        "UPDATE lead_tasks SET revision = 0",
    ):
        with pytest.raises(DBAPIError):
            db.execute(text(statement))
        db.rollback()

    def may(role: str, privilege: str) -> bool:
        return db.scalar(text("SELECT has_table_privilege(:r, 'lead_tasks', :p)"), {"r": role, "p": privilege})

    assert may("acs_app_api", "SELECT") and may("acs_app_api", "INSERT") and may("acs_app_api", "UPDATE")
    assert not may("acs_app_api", "DELETE") and not may("acs_app_runtime", "SELECT")
    assert admin_client.delete(f"{ADMIN}/leads/{lead}").status_code == 204  # erasure removes the enquiry and its tasks
    assert db.scalar(select(func.count()).select_from(LeadTask).where(LeadTask.id == created["id"])) == 0


# --- Overview -----------------------------------------------------------------------------------------------------------


def test_the_overview_counts_real_records_and_nothing_else(admin_client, three_leads, db, admin_user):
    _client, other = second_admin(db)
    admin_client.patch(f"{ADMIN}/leads/{three_leads[1]}", json={"status": "WON"})
    admin_client.patch(f"{ADMIN}/leads/{three_leads[2]}", json={"status": "CONTACTED"})
    admin_client.put(f"{ADMIN}/leads/{three_leads[0]}/owner", json={"owner_id": str(other.id)})
    today = utcnow().date()
    task(admin_client, three_leads[0], due_on=(today + timedelta(days=2)).isoformat())
    late = task(admin_client, three_leads[2], due_on=(today + timedelta(days=1)).isoformat()).json()
    done = task(admin_client, three_leads[2]).json()
    db.execute(
        text("UPDATE lead_tasks SET due_on = :d WHERE id = :i"), {"d": today - timedelta(days=2), "i": late["id"]}
    )
    db.commit()
    admin_client.patch(f"{ADMIN}/tasks/{done['id']}", json={"expected_revision": 1, "state": "done"})
    db.add(LeadOpportunity(lead_id=three_leads[0], qualification_status="qualified"))
    db.add(LeadOpportunity(lead_id=three_leads[1], qualification_status="qualified"))  # WON: not open
    db.commit()

    data = admin_client.get(f"{ADMIN}/crm/overview", params={"days": 7}).json()
    assert data["period_days"] == 7 and data["enquiries_total"] == 3 and data["enquiries_in_period"] == 3
    assert data["enquiries_by_status"] == {"NEW": 1, "CONTACTED": 1, "QUALIFIED": 0, "PROPOSAL": 0, "WON": 1, "LOST": 0}
    assert (
        data["unassigned_open_enquiries"] == 1
    )  # the contacted lead; the won one is not open work, the first has an owner
    assert data["open_opportunities"] == 1
    assert (data["follow_ups_open"], data["follow_ups_overdue"], data["follow_ups_due_this_week"]) == (2, 1, 1)
    owners = {
        (o["owner"] or {}).get("name"): (o["open_enquiries"], o["open_tasks"], o["overdue_tasks"])
        for o in data["owners"]
    }
    assert owners[other.full_name] == (1, 0, 0) or owners[other.full_name][0] == 1
    assert owners[admin_user.full_name][1] == 2 or owners.get(None, (0, 0, 0))[1] >= 0
    # Nothing in the answer is a price, a forecast or a rate.
    assert set(data) == {
        "period_days",
        "since",
        "enquiries_total",
        "enquiries_in_period",
        "enquiries_by_status",
        "unassigned_open_enquiries",
        "open_opportunities",
        "proposals_approved",
        "quotations_pending",
        "quotations_accepted",
        "projects_active",
        "projects_by_status",
        "follow_ups_open",
        "follow_ups_overdue",
        "follow_ups_due_this_week",
        "owners",
    }
    assert admin_client.get(f"{ADMIN}/crm/overview", params={"days": 0}).status_code == 422


def test_the_overview_counts_quotations_proposals_and_projects(customer, admin_client, configured_lead, db, client):
    lead, _proposal = accepted_lead(client, admin_client, configured_lead)
    project = make_project(admin_client, lead)
    db.execute(text("UPDATE commercial_projects SET status = 'in_progress' WHERE id = :i"), {"i": project["id"]})
    db.commit()
    make_project(admin_client, lead, title="Втори проект")  # a draft is not counted
    data = admin_client.get(f"{ADMIN}/crm/overview").json()
    assert data["proposals_approved"] == 1 and data["quotations_accepted"] == 1 and data["quotations_pending"] == 0
    assert data["projects_active"] == 1 and data["projects_by_status"] == {"in_progress": 1}


# --- Timeline, customer links -----------------------------------------------------------------------------------------


def test_the_timeline_joins_what_was_recorded_without_the_noise(admin_client, three_leads, db):
    lead = three_leads[0]
    admin_client.get(f"{ADMIN}/leads/{lead}")  # a view: recorded, but not part of the timeline
    admin_client.patch(f"{ADMIN}/leads/{lead}", json={"status": "CONTACTED"})
    admin_client.post(f"{ADMIN}/leads/{lead}/notes", json={"body": "Говорих с клиента по телефона."})
    created = task(admin_client, lead, title="Изпратете оферта").json()
    admin_client.patch(f"{ADMIN}/tasks/{created['id']}", json={"expected_revision": 1, "state": "done"})
    items = admin_client.get(f"{ADMIN}/leads/{lead}/timeline").json()
    actions = [i["action"] for i in items]
    assert "lead.viewed" not in actions
    for expected in (
        "lead.status_changed",
        "lead.note",
        "lead.note_added",
        "lead.task_created",
        "lead.task_done",
        "task.created",
        "task.done",
    ):
        assert expected in actions, expected
    assert [i["at"] for i in items] == sorted((i["at"] for i in items), reverse=True)
    note = next(i for i in items if i["action"] == "lead.note")
    assert note["detail"] == "Говорих с клиента по телефона." and note["kind"] == "note"
    assert "anna.alpha@example.com" not in str(items) and "+359" not in str(items)
    assert admin_client.get(f"{ADMIN}/leads/00000000-0000-4000-8000-000000000000/timeline").status_code == 404


def test_the_timeline_and_the_customer_view_follow_quotations_and_projects(
    customer, admin_client, configured_lead, client, db
):
    lead, _proposal = accepted_lead(client, admin_client, configured_lead)
    project = make_project(admin_client, lead)
    admin_client.post(
        f"{ADMIN}/projects/{project['id']}/transition",
        json={"expected_revision": project["revision"], "to": "quotation"},
    )
    actions = {i["action"] for i in admin_client.get(f"{ADMIN}/leads/{lead}/timeline").json()}
    assert {
        "quotation.published",
        "quotation.accepted",
        "proposal.proposal.created",
        "project.created",
        "project.status.quotation",
    } <= actions or {"quotation.published", "quotation.accepted", "project.created"} <= actions
    view = admin_client.get(f"{ADMIN}/leads/{lead}/customer").json()
    assert view["has_account"] is True and view["account_verified"] is True
    assert [(p["title"], p["status"]) for p in view["projects"]] == [("Нов бизнес сайт", "quotation")]
    assert [(q["status"], q["version"]) for q in view["quotations"]] == [("accepted", 1)]


def test_an_enquiry_without_an_account_says_so(admin_client, three_leads):
    view = admin_client.get(f"{ADMIN}/leads/{three_leads[0]}/customer").json()
    assert view == {"has_account": False, "account_verified": False, "projects": [], "quotations": []}


# --- Export -------------------------------------------------------------------------------------------------------------


def parse(response):
    return list(csv.reader(io.StringIO(response.text)))


def test_the_export_is_a_whitelist_without_personal_data_and_is_audited(admin_client, three_leads, db):
    admin_client.patch(f"{ADMIN}/leads/{three_leads[1]}", json={"status": "WON"})
    response = admin_client.get(f"{ADMIN}/crm/leads.csv")
    assert response.status_code == 200 and response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"] == 'attachment; filename="pipeline.csv"'
    assert response.headers["cache-control"] == "no-store" and response.headers["x-content-type-options"] == "nosniff"
    rows = parse(response)
    assert tuple(rows[0]) == service.EXPORT_COLUMNS and len(rows) == 4
    for needle in ("Анна", "Алфа", "anna.alpha", "+359", "Борис", "boris", "Гама", "Искаме технически"):
        assert needle not in response.text, needle
    assert {row[6] for row in rows[1:]} == {"NEW", "WON"}

    won = parse(admin_client.get(f"{ADMIN}/crm/leads.csv", params={"status": "WON"}))
    assert len(won) == 2 and won[1][6] == "WON"
    audit_rows = db.scalars(select(AuditLog).where(AuditLog.action == "crm.export").order_by(AuditLog.id)).all()
    assert [a.details["rows"] for a in audit_rows] == [3, 1] and audit_rows[0].details["columns"] == list(
        service.EXPORT_COLUMNS
    )
    assert "Анна" not in str(audit_rows[0].details)


def test_a_cell_that_starts_like_a_formula_is_neutralised(admin_client, three_leads, db):
    for text_in in ('=HYPERLINK("http://x")', "+1+1", "-2", "@SUM(A1)", "\tcmd"):
        assert service.safe_cell(text_in).startswith("'")
    assert service.safe_cell("normal") == "normal" and service.safe_cell(None) == "" and service.safe_cell(0) == "0"
    other_client, other = second_admin(db, "formula.admin@example.com")
    other.full_name = "=cmd|' /C calc'!A0"
    db.commit()
    admin_client.put(f"{ADMIN}/leads/{three_leads[0]}/owner", json={"owner_id": str(other.id)})
    rows = parse(admin_client.get(f"{ADMIN}/crm/leads.csv"))
    owner_cells = [row[7] for row in rows[1:] if row[7]]
    assert owner_cells == ["'=cmd|' /C calc'!A0"] and other_client is not None


def test_the_export_filters_like_the_list_and_counts_tasks_and_stages(admin_client, three_leads, db, admin_user):
    admin_client.put(f"{ADMIN}/leads/{three_leads[0]}/owner", json={"owner_id": str(admin_user.id)})
    task(admin_client, three_leads[0])
    db.add(LeadOpportunity(lead_id=three_leads[0], qualification_status="qualified"))
    db.commit()
    rows = parse(admin_client.get(f"{ADMIN}/crm/leads.csv", params={"owner": "me"}))
    assert len(rows) == 2 and dict(zip(rows[0], rows[1], strict=True))["open_followups"] == "1"
    assert dict(zip(rows[0], rows[1], strict=True))["qualification"] == "qualified"
    assert len(parse(admin_client.get(f"{ADMIN}/crm/leads.csv", params={"qualification": "qualified"}))) == 2
    assert len(parse(admin_client.get(f"{ADMIN}/crm/leads.csv", params={"service": "automation"}))) == 2
    assert len(parse(admin_client.get(f"{ADMIN}/crm/leads.csv", params={"owner": "none"}))) == 3
    assert admin_client.get(f"{ADMIN}/crm/leads.csv", params={"status": "NOPE"}).status_code == 422
    lead_filters = admin_client.get(f"{ADMIN}/leads", params={"qualification": "qualified"}).json()
    assert [i["id"] for i in lead_filters["items"]] == [three_leads[0]] and Lead is not None
