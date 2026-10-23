from uuid import uuid4

from sqlalchemy import func, select

from app.models import AuditLog, Lead, LeadNote


def _first_id(admin_client) -> str:
    return admin_client.get("/api/admin/leads").json()["items"][0]["id"]


def test_admin_lists_leads_with_pagination(admin_client, make_lead):
    for i in range(3):
        make_lead(name=f"Клиент {i}", email=f"client{i}@example.com")
    page = admin_client.get("/api/admin/leads", params={"page_size": 2}).json()
    assert page["total"] == 3
    assert len(page["items"]) == 2
    assert page["items"][0]["name"] == "Клиент 2"  # newest first
    oldest = admin_client.get("/api/admin/leads", params={"sort": "oldest"}).json()
    assert oldest["items"][0]["name"] == "Клиент 0"


def test_admin_filters_leads(admin_client, make_lead):
    make_lead(service="seo", company="Алфа ООД", email="alpha@example.com")
    make_lead(service="automation", company="Бета ЕООД", email="beta@example.com")

    by_service = admin_client.get("/api/admin/leads", params={"service": "automation"}).json()
    assert [i["company"] for i in by_service["items"]] == ["Бета ЕООД"]

    by_search = admin_client.get("/api/admin/leads", params={"q": "алфа"}).json()
    assert [i["company"] for i in by_search["items"]] == ["Алфа ООД"]

    by_status = admin_client.get("/api/admin/leads", params={"status": "WON"}).json()
    assert by_status["total"] == 0


def test_search_wildcards_are_escaped(admin_client, make_lead):
    make_lead()
    assert admin_client.get("/api/admin/leads", params={"q": "%"}).json()["total"] == 0
    assert admin_client.get("/api/admin/leads", params={"q": "_"}).json()["total"] == 0


def test_invalid_filters_are_rejected(admin_client):
    assert admin_client.get("/api/admin/leads", params={"status": "DELETED"}).status_code == 422
    assert admin_client.get("/api/admin/leads", params={"page_size": 1000}).status_code == 422


def test_admin_views_lead_details(admin_client, make_lead):
    created = make_lead(marketing_consent=True)
    detail = admin_client.get(f"/api/admin/leads/{_first_id(admin_client)}").json()
    assert detail["reference"] == created["reference"]
    assert detail["message"].startswith("Искаме технически SEO одит")
    assert detail["marketing_consent"] is True
    assert detail["notes"] == []


def test_admin_updates_status_and_it_is_audited(admin_client, make_lead, db):
    make_lead()
    lead_id = _first_id(admin_client)
    response = admin_client.patch(f"/api/admin/leads/{lead_id}", json={"status": "QUALIFIED"})
    assert response.status_code == 200
    assert response.json()["status"] == "QUALIFIED"
    assert response.json()["status_changed_at"] is not None

    entry = db.scalar(select(AuditLog).where(AuditLog.action == "lead.status_changed"))
    assert entry.details == {"from": "NEW", "to": "QUALIFIED"}
    assert entry.actor_label == "admin.test@example.com"

    history = admin_client.get(f"/api/admin/leads/{lead_id}/audit").json()
    assert [h["action"] for h in history][:2] == ["lead.status_changed", "lead.created"]


def test_all_statuses_are_accepted(admin_client, make_lead):
    make_lead()
    lead_id = _first_id(admin_client)
    for status in ["CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST", "NEW"]:
        assert admin_client.patch(f"/api/admin/leads/{lead_id}", json={"status": status}).status_code == 200


def test_invalid_status_is_rejected(admin_client, make_lead):
    make_lead()
    response = admin_client.patch(f"/api/admin/leads/{_first_id(admin_client)}", json={"status": "ARCHIVED"})
    assert response.status_code == 422


def test_admin_adds_note(admin_client, make_lead, db):
    make_lead()
    lead_id = _first_id(admin_client)
    response = admin_client.post(f"/api/admin/leads/{lead_id}/notes", json={"body": "Обадих се, чакаме бюджет."})
    assert response.status_code == 201
    assert response.json()["author_name"] == "Тест Администратор"
    detail = admin_client.get(f"/api/admin/leads/{lead_id}").json()
    assert [n["body"] for n in detail["notes"]] == ["Обадих се, чакаме бюджет."]
    assert admin_client.post(f"/api/admin/leads/{lead_id}/notes", json={"body": ""}).status_code == 422


def test_admin_deletes_lead_without_keeping_personal_data(admin_client, make_lead, db):
    make_lead()
    lead_id = _first_id(admin_client)
    admin_client.post(f"/api/admin/leads/{lead_id}/notes", json={"body": "Бележка"})
    assert admin_client.delete(f"/api/admin/leads/{lead_id}").status_code == 204
    assert admin_client.get(f"/api/admin/leads/{lead_id}").status_code == 404
    assert db.scalar(select(func.count()).select_from(Lead)) == 0
    assert db.scalar(select(func.count()).select_from(LeadNote)) == 0
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "lead.deleted"))
    assert entry.details == {"reason": "admin_erasure_request"}


def test_unknown_and_malformed_ids(admin_client):
    assert admin_client.get(f"/api/admin/leads/{uuid4()}").status_code == 404
    assert admin_client.get("/api/admin/leads/not-a-uuid").status_code == 422


def test_dashboard_stats_reflect_database(admin_client, make_lead):
    make_lead(service="seo")
    make_lead(service="seo", email="b@example.com")
    make_lead(service="analytics", email="c@example.com")
    admin_client.patch(f"/api/admin/leads/{_first_id(admin_client)}", json={"status": "WON"})

    stats = admin_client.get("/api/admin/dashboard/stats").json()
    assert stats["total_leads"] == 3
    assert stats["new_leads"] == 2
    assert stats["won"] == 1
    assert stats["open_pipeline"] == 2
    assert stats["leads_last_7_days"] == 3
    assert stats["by_service"]["seo"] == 2
    assert stats["by_service"]["analytics"] == 1
    assert stats["recent_activity"]


def test_empty_dashboard(admin_client):
    stats = admin_client.get("/api/admin/dashboard/stats").json()
    assert stats["total_leads"] == 0
    assert set(stats["by_status"]) == {"NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"}


def test_system_status_reports_mock_ai_and_disabled_email(admin_client):
    status = admin_client.get("/api/admin/system/status").json()
    assert status["ai_provider"] == "mock"
    assert status["email_enabled"] is False
    assert {i["key"] for i in status["integrations"]} >= {"shopify", "woocommerce", "crm"}
    assert "token" not in str(status).lower()


def test_audit_log_endpoint(admin_client, make_lead):
    make_lead()
    page = admin_client.get("/api/admin/audit", params={"page_size": 5}).json()
    assert page["total"] >= 2 and page["page_size"] == 5
    assert {"lead.created", "auth.login"} <= {e["action"] for e in page["items"]}
