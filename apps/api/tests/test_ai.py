from uuid import uuid4

import pytest
from sqlalchemy import select

from app.ai.base import LeadTriageInput, redact_personal_data
from app.ai.factory import get_ai_provider
from app.ai.mock import MockProvider
from app.ai.policy import ActionType, RiskLevel, evaluate
from app.config import get_settings
from app.models import AIActionStatus, AuditLog
from app.services import ai_actions


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("Искаме по-добро класиране в Google и технически SEO преглед.", "seo"),
        ("Търсим чатбот асистент за въпроси на клиенти.", "ai_tools"),
        ("Ръчно въвеждаме фактури, искаме автоматизация на процеса.", "automation"),
        ("Нужна ни е интеграция с ERP през API и синхронизация на склада.", "integrations"),
    ],
)
def test_mock_triage_classifies_by_keywords(message, expected):
    result = MockProvider().triage_lead(LeadTriageInput(service="other", message=message))
    assert result.suggested_service == expected
    assert result.provider == "mock"
    assert result.disclaimer


def test_mock_triage_keeps_selected_service_when_it_matches():
    result = MockProvider().triage_lead(
        LeadTriageInput(service="maintenance", message="Shopify магазинът има грешки, а искаме и SEO.")
    )
    assert result.suggested_service == "maintenance"


def test_mock_triage_detects_urgency():
    result = MockProvider().triage_lead(
        LeadTriageInput(service="maintenance", message="Спешно! Магазинът не работи от сутринта.")
    )
    assert result.priority == "high"


def test_personal_data_is_redacted_before_leaving_the_system():
    text = "Пишете на ivan@example.com или звънете на +359 88 123 4567."
    redacted = redact_personal_data(text)
    assert "ivan@example.com" not in redacted
    assert "123 4567" not in redacted
    assert "[имейл]" in redacted and "[телефон]" in redacted


def test_factory_uses_mock_without_api_key(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    get_settings.cache_clear()
    get_ai_provider.cache_clear()
    try:
        assert get_ai_provider().name == "mock"
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
        get_ai_provider.cache_clear()


@pytest.mark.parametrize(
    ("action", "needs_approval"),
    [
        (ActionType.READ_PUBLIC_CONTENT, False),
        (ActionType.GENERATE_DRAFT, False),
        (ActionType.CLASSIFY_LEAD, False),
        (ActionType.SEND_MESSAGE, True),
        (ActionType.MODIFY_PRODUCT, True),
        (ActionType.CHANGE_PRICE, True),
        (ActionType.MODIFY_ORDER, True),
        (ActionType.ACCESS_SENSITIVE_DATA, True),
        (ActionType.DELETE_DATA, True),
    ],
)
def test_policy_requires_approval_for_side_effects(action, needs_approval):
    assert evaluate(action).requires_approval is needs_approval


def test_unknown_actions_fail_closed():
    decision = evaluate("transfer_funds")
    assert decision.requires_approval is True
    assert decision.risk is RiskLevel.CRITICAL


def test_side_effecting_proposal_waits_for_approval(db):
    action = ai_actions.propose_action(db, "change_price", "Намаление на цена", {"sku": "X"}, "agent-1")
    assert action.status == AIActionStatus.PENDING.value
    assert action.risk_level == "critical"
    assert db.scalar(select(AuditLog.action)) == "ai_action.proposed"


def test_low_risk_proposal_is_auto_approved_by_policy(db):
    action = ai_actions.propose_action(db, "generate_draft", "Чернова", {}, "agent-1")
    assert action.status == AIActionStatus.APPROVED.value
    assert action.decision_comment.startswith("policy:")


def test_admin_approves_and_rejects_actions(admin_client, db):
    first = ai_actions.propose_action(db, "send_message", "Имейл до клиент", {"draft": "..."}, "agent-1")
    second = ai_actions.propose_action(db, "modify_order", "Промяна на поръчка", {}, "agent-1")

    pending = admin_client.get("/api/admin/ai/actions", params={"status": "PENDING"}).json()
    assert {a["id"] for a in pending} == {str(first.id), str(second.id)}

    approved = admin_client.post(f"/api/admin/ai/actions/{first.id}/decision", json={"decision": "approve"})
    assert approved.status_code == 200
    assert approved.json()["status"] == "APPROVED"
    assert approved.json()["decided_by_name"] == "Тест Администратор"

    rejected = admin_client.post(
        f"/api/admin/ai/actions/{second.id}/decision", json={"decision": "reject", "comment": "Не"}
    )
    assert rejected.json()["status"] == "REJECTED"

    again = admin_client.post(f"/api/admin/ai/actions/{first.id}/decision", json={"decision": "reject"})
    assert again.status_code == 409
    missing = admin_client.post(f"/api/admin/ai/actions/{uuid4()}/decision", json={"decision": "approve"})
    assert missing.status_code == 404

    actions = {a for (a,) in db.execute(select(AuditLog.action))}
    assert {"ai_action.approved", "ai_action.rejected"} <= actions


def test_admin_lead_triage_endpoint(admin_client, make_lead, db):
    make_lead(service="other", message="Търсим чатбот асистент, който да отговаря на клиентите ни денонощно.")
    lead_id = admin_client.get("/api/admin/leads").json()["items"][0]["id"]
    response = admin_client.post(f"/api/admin/leads/{lead_id}/ai/triage")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "mock"
    assert body["suggested_service"] == "ai_tools"
    assert db.scalar(select(AuditLog).where(AuditLog.action == "ai.lead_triage")) is not None
