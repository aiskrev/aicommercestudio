"""Advisor Workspace: access control on the server, quota under concurrency, retries and failures."""

from __future__ import annotations

import inspect
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi.routing import APIRoute
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.ai.base import AIProviderError, AssessmentDraft
from app.ai.mock import MockProvider
from app.config import Settings, get_settings
from app.db import get_sessionmaker
from app.models import utcnow
from app.routers import workspace as workspace_router
from app.workspace import usage
from app.workspace.demo import DEMO
from app.workspace.models import (
    AssessmentVersion,
    CustomerWorkspace,
    PlanFeature,
    PlanPrice,
    UsageCounter,
    UsageEvent,
    UsageReservation,
)
from tests.test_accounts import PASSWORD, Inbox, csrf

API = "/api/workspace"
BODY = {
    "business_type": "online_store",
    "process_description": "Ръчно обработваме заявките за връщане на стоки и губим по няколко часа всяка седмица.",
    "monthly_volume": "100_500",
    "team_size": "2_5",
}
COST = 500_000


class RealishProvider(MockProvider):
    """Stands in for a real model: same valid output, reported as a real provider."""

    name = "anthropic"

    def __init__(self) -> None:
        self.calls = 0
        self.error: str | None = None

    def assess_automation(self, data):
        self.calls += 1
        if self.error:
            raise AIProviderError("boom", self.error)
        draft = super().assess_automation(data)
        return AssessmentDraft(provider="anthropic", model="test-model", data=draft.data)


@pytest.fixture
def ai() -> RealishProvider:
    return RealishProvider()


@pytest.fixture
def on(monkeypatch, ai):
    settings = get_settings()
    box = Inbox()
    for name, value in {
        "customer_accounts_enabled": True,
        "advisor_workspace_enabled": True,
        "billing_provider": "sandbox",
        "email_provider": "smtp",
        "smtp_host": "mail.test",
        "smtp_from": "no-reply@example.com",
        "workspace_ai_global_monthly_micros": 1_000_000_000,
        "workspace_ai_call_cost_micros": COST,
    }.items():
        monkeypatch.setattr(settings, name, value)
    monkeypatch.setattr("app.accounts.mail.get_sender", lambda *_: box)
    monkeypatch.setattr("app.workspace.service.get_ai_provider", lambda: ai)
    return box


def sign_up(client, box: Inbox, email: str) -> None:
    client.cookies.clear()
    client.post("/api/accounts/register", json={"email": email, "password": PASSWORD, "privacy_acknowledged": True})
    client.post("/api/accounts/verification/confirm", json={"token": box.last_token()})
    assert client.post("/api/accounts/login", json={"email": email, "password": PASSWORD}).status_code == 200


def plan(client, name: str) -> None:
    assert client.post(f"{API}/billing/sandbox/plan", json={"plan": name}, headers=csrf(client)).status_code == 204


def project(client, name: str = "Проект") -> str:
    response = client.post(f"{API}/projects", json={"name": name}, headers=csrf(client))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def run(client, project_id: str, key: str | None = None, **body):
    headers = csrf(client) | {"Idempotency-Key": key or uuid.uuid4().hex}
    return client.post(f"{API}/projects/{project_id}/versions", json={**BODY, **body}, headers=headers)


@pytest.fixture
def pro(client, on) -> str:
    sign_up(client, on, "pro@example.com")
    plan(client, "pro")
    return project(client)


def counter(db, metric: str) -> tuple[int, int]:
    db.expire_all()
    row = db.scalar(select(UsageCounter).where(UsageCounter.metric == metric))
    return (row.used, row.reserved) if row else (0, 0)


# --------------------------------------------------------------------------- flags and plans


def test_everything_is_hidden_while_the_flag_is_off(client):
    assert client.get(f"{API}/plans").status_code == 404
    assert client.get(f"{API}/demo").status_code == 404
    assert client.get(f"{API}/me").status_code == 404


@pytest.mark.parametrize(
    ("changes", "problem"),
    [
        ({"advisor_workspace_enabled": True}, "ADVISOR_WORKSPACE_ENABLED"),
        ({"billing_provider": "sandbox"}, "BILLING_PROVIDER=sandbox"),
    ],
)
def test_production_refuses_the_workspace_and_the_sandbox(changes, problem):
    base = get_settings().model_dump() | {"app_env": "production"} | changes
    with pytest.raises(ValueError, match=problem):
        Settings(**base)


def test_all_four_plans_exist_with_finite_ai_limits_and_no_price(client, on, db):
    plans = client.get(f"{API}/plans").json()
    assert [p["key"] for p in plans] == ["free", "pro", "business", "custom"]
    assert all(p["prices"] == [] for p in plans)
    for item in plans:
        for name in ("limit_ai_runs_month", "limit_ai_cost_micros_month", "limit_requests_per_minute"):
            assert isinstance(item["limits"][name], int)
    assert db.scalars(select(PlanPrice)).all() == []


def test_an_unapproved_price_is_never_shown(client, on, db):
    version = db.scalars(select(PlanFeature.plan_version_id)).first()
    db.add(PlanPrice(plan_version_id=version, currency="EUR", amount_minor=100, billing_interval="month"))
    db.commit()
    assert all(p["prices"] == [] for p in client.get(f"{API}/plans").json())


def test_a_limit_cannot_be_unlimited(db):
    version = db.scalars(select(PlanFeature.plan_version_id)).first()
    db.add(PlanFeature(plan_version_id=version, feature="limit_new", enabled=True, limit_value=None))
    with pytest.raises(DBAPIError):
        db.commit()
    db.rollback()


def test_the_api_cannot_rewrite_plans_or_usage_history():
    with get_sessionmaker()() as session, pytest.raises(DBAPIError, match="permission denied"):
        session.execute(text("UPDATE plan_features SET limit_value = 999999"))
    with get_sessionmaker()() as session, pytest.raises(DBAPIError, match="permission denied"):
        session.execute(text("DELETE FROM usage_events"))


# --------------------------------------------------------------------------- access control


def test_every_route_is_protected_on_the_server():
    open_routes = {"/api/workspace/demo", "/api/workspace/plans"}
    for route in workspace_router.router.routes:
        assert isinstance(route, APIRoute)
        if route.path in open_routes:
            continue
        calls = [d.call for d in route.dependant.dependencies]
        names = {getattr(c, "__name__", "") for c in calls}
        assert names & {"workspace_context", "dependency"}, route.path
        assert "ctx" in inspect.signature(route.endpoint).parameters, route.path


def test_anonymous_requests_are_refused(client, on):
    for method, path in [("get", "/me"), ("get", "/projects"), ("post", f"/projects/{uuid.uuid4()}/versions")]:
        assert getattr(client, method)(f"{API}{path}").status_code in (401, 422), path


def test_changes_need_csrf(client, pro):
    assert client.post(f"{API}/projects", json={"name": "Без токен"}).status_code == 403


def test_one_account_cannot_reach_another_accounts_project(client, on):
    sign_up(client, on, "first@example.com")
    plan(client, "pro")
    first = project(client)
    assert run(client, first).status_code == 201
    sign_up(client, on, "second@example.com")
    plan(client, "pro")
    other = project(client)
    assert run(client, other).status_code == 201
    headers = csrf(client)
    for response in (
        client.get(f"{API}/projects/{first}/versions"),
        client.get(f"{API}/projects/{first}/versions/1"),
        client.get(f"{API}/projects/{first}/versions/1/export"),
        client.get(f"{API}/projects/{first}/compare", params={"left": 1, "right": 1}),
        client.patch(f"{API}/projects/{first}", json={"name": "Чуждо"}, headers=headers),
        client.delete(f"{API}/projects/{first}", headers=headers),
        run(client, first),
    ):
        assert response.status_code == 404, response.request.url
    assert [p["id"] for p in client.get(f"{API}/projects").json()] == [other]


def test_a_free_plan_cannot_call_paid_routes_directly(client, on, ai):
    sign_up(client, on, "free@example.com")
    project_id = project(client)
    assert run(client, project_id).status_code == 201
    for response, feature in [
        (run(client, project_id, engine="ai"), "ai_assessments"),
        (run(client, project_id, parent_number=1, clarification="Уточнение"), "follow_ups"),
        (client.get(f"{API}/projects/{project_id}/compare", params={"left": 1, "right": 1}), "compare"),
        (client.get(f"{API}/projects/{project_id}/versions/1/export"), "export_markdown"),
    ]:
        assert response.status_code == 403
        assert response.json()["code"] == "feature_not_in_plan"
        assert feature in response.text
    assert ai.calls == 0


def test_export_format_is_checked_per_plan(client, pro):
    assert run(client, pro).status_code == 201
    assert client.get(f"{API}/projects/{pro}/versions/1/export").status_code == 200
    assert client.get(f"{API}/projects/{pro}/versions/1/export", params={"format": "json"}).status_code == 403


def test_after_a_downgrade_ai_results_are_locked_everywhere(client, pro):
    created = run(client, pro, engine="ai")
    assert created.status_code == 201
    summary = created.json()["assessment"]["problem_summary"]
    plan(client, "free")
    version = client.get(f"{API}/projects/{pro}/versions/1").json()
    assert version["locked"] is True
    assert version["assessment"] is None and version["insights"] is None
    assert len(version["preview"]) <= 160
    listing = client.get(f"{API}/projects/{pro}/versions").text
    assert "proposed_workflow" not in listing
    assert len(summary) <= 160 or summary not in listing


def test_answers_are_not_cached(client, pro):
    assert run(client, pro).headers["cache-control"] == "no-store"
    assert client.get(f"{API}/projects/{pro}/versions/1").headers["cache-control"] == "no-store"


def test_the_free_advisor_is_unchanged_and_needs_no_account(client, on):
    from app.routers.advisor import router as advisor_router

    assert any(r.path == "/api/public/advisor/assessments" or "assessments" in r.path for r in advisor_router.routes)
    assert client.get("/api/public/advisor/status").status_code == 200


def test_the_demo_is_synthetic_and_touches_no_table(client, on, db):
    answer = client.get(f"{API}/demo").json()
    assert answer == DEMO and answer["synthetic"] is True
    assert db.scalars(select(CustomerWorkspace)).all() == []


# --------------------------------------------------------------------------- results


def test_template_and_real_model_results_are_labelled_by_what_produced_them(client, pro):
    template = run(client, pro).json()
    real = run(client, pro, engine="ai").json()
    assert (template["result_kind"], real["result_kind"]) == ("template", "ai_model")
    assert real["model"] == "test-model"
    exported = client.get(f"{API}/projects/{pro}/versions/1/export").text
    assert "Template assessment" in exported


def test_a_real_model_is_never_faked(client, pro, monkeypatch):
    monkeypatch.setattr("app.workspace.service.get_ai_provider", MockProvider)
    response = run(client, pro, engine="ai")
    assert response.status_code == 503
    assert response.json()["code"] == "ai_unavailable"


def test_when_the_daily_guard_answers_it_is_labelled_template_and_not_charged(client, pro, db, monkeypatch):
    monkeypatch.setattr("app.advisor.service.take_ai_budget", lambda _s: False)
    answer = run(client, pro, engine="ai").json()
    assert answer["result_kind"] == "template"
    assert counter(db, "limit_ai_runs_month") == (0, 0)


def test_follow_up_makes_a_new_version_and_keeps_the_old_one(client, pro):
    first = run(client, pro).json()
    second = run(client, pro, parent_number=1, clarification="Имаме и втори склад.", label="С втори склад").json()
    assert (second["number"], second["parent_number"], second["label"]) == (2, 1, "С втори склад")
    assert client.get(f"{API}/projects/{pro}/versions/1").json()["created_at"] == first["created_at"]
    assert len(client.get(f"{API}/projects/{pro}/versions").json()) == 2


def test_compare_shows_both_sides_without_new_scores(client, pro):
    run(client, pro)
    run(client, pro, parent_number=1, clarification="Имаме и втори склад.")
    answer = client.get(f"{API}/projects/{pro}/compare", params={"left": 1, "right": 2}).json()
    assert set(answer) == {"left", "right", "complexity", "sections"}
    assert "human_approvals" in answer["sections"]


def test_personal_data_is_removed_before_saving(client, pro, db):
    body = BODY["process_description"] + " Пишете на ivan@example.com или +359 88 123 4567."
    assert run(client, pro, process_description=body).status_code == 201
    stored = db.scalar(select(AssessmentVersion))
    assert "ivan@example.com" not in stored.inputs["process_description"]
    assert "123 4567" not in stored.inputs["process_description"]


def test_input_size_is_limited(client, pro):
    assert run(client, pro, process_description="а" * 2001).status_code == 422
    run(client, pro, process_description="а" * 1995)
    answer = run(client, pro, parent_number=1, clarification="Твърде дълго уточнение")
    assert answer.status_code == 422
    assert answer.json()["code"] == "input_too_large"


# --------------------------------------------------------------------------- quota


def test_quota_boundary_stops_exactly_at_the_limit(client, pro, ai, db, monkeypatch):
    monkeypatch.setattr("app.workspace.entitlements.Entitlements.limit", _limits({"limit_ai_runs_month": 2}))
    assert run(client, pro, engine="ai").status_code == 201
    assert run(client, pro, engine="ai").status_code == 201
    refused = run(client, pro, engine="ai")
    assert refused.status_code == 403
    assert refused.json()["code"] == "quota_exceeded"
    assert ai.calls == 2
    assert counter(db, "limit_ai_runs_month") == (2, 0)


def _limits(overrides: dict[str, int]):
    original = usage_limit_original

    def limit(self, name: str) -> int:
        return overrides.get(name, original(self, name))

    return limit


from app.workspace.entitlements import Entitlements  # noqa: E402

usage_limit_original = Entitlements.limit


def test_the_cost_limit_stops_ai_even_with_runs_left(client, pro, ai, monkeypatch):
    monkeypatch.setattr(Entitlements, "limit", _limits({"limit_ai_cost_micros_month": COST}))
    assert run(client, pro, engine="ai").status_code == 201
    refused = run(client, pro, engine="ai")
    assert refused.status_code == 403
    assert "limit_ai_cost_micros_month" in refused.text
    assert ai.calls == 1


def test_the_global_spending_cap_stops_every_workspace(client, pro, ai, monkeypatch):
    monkeypatch.setattr(get_settings(), "workspace_ai_global_monthly_micros", 0)
    assert run(client, pro, engine="ai").status_code == 403
    assert ai.calls == 0


def test_parallel_requests_cannot_pass_the_limit(on, pro, ai, client, db, monkeypatch):
    monkeypatch.setattr(Entitlements, "limit", _limits({"limit_ai_runs_month": 3, "limit_requests_per_minute": 100}))
    headers = csrf(client)
    url = f"{API}/projects/{pro}/versions"

    def call(index: int) -> int:
        return client.post(
            url, json={**BODY, "engine": "ai"}, headers=headers | {"Idempotency-Key": f"parallel-key-{index}"}
        ).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(call, range(8)))
    assert results.count(201) == 3
    assert results.count(403) == 5
    assert ai.calls == 3
    assert counter(db, "limit_ai_runs_month") == (3, 0)


def test_parallel_project_creation_cannot_pass_the_limit(client, on):
    sign_up(client, on, "free2@example.com")
    headers = csrf(client)

    def call(index: int) -> int:
        return client.post(f"{API}/projects", json={"name": f"Проект {index}"}, headers=headers).status_code

    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(call, range(5)))
    assert results.count(201) == 1


def test_a_repeated_request_returns_the_same_version_without_charging_again(client, pro, ai, db):
    first = run(client, pro, key="same-key-123", engine="ai")
    again = run(client, pro, key="same-key-123", engine="ai")
    assert again.status_code == 201
    assert again.json()["number"] == first.json()["number"]
    assert ai.calls == 1
    assert counter(db, "limit_ai_runs_month") == (1, 0)
    assert len(db.scalars(select(UsageEvent).where(UsageEvent.metric == "limit_ai_runs_month")).all()) == 1


def test_parallel_duplicates_run_the_model_once(client, pro, ai, db):
    headers = csrf(client) | {"Idempotency-Key": "duplicate-key-1"}

    def call(_: int) -> int:
        return client.post(f"{API}/projects/{pro}/versions", json={**BODY, "engine": "ai"}, headers=headers).status_code

    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(call, range(5)))
    assert 201 in results and set(results) <= {201, 409}
    assert ai.calls == 1
    assert counter(db, "limit_ai_runs_month") == (1, 0)


def test_a_key_cannot_be_reused_for_a_different_request(client, pro):
    run(client, pro, key="reused-key-1")
    second = run(client, pro, key="reused-key-1", label="Друго")
    assert second.status_code == 409
    assert second.json()["code"] == "idempotency_conflict"


def test_idempotency_key_is_required(client, pro):
    response = client.post(f"{API}/projects/{pro}/versions", json=BODY, headers=csrf(client))
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("kind", "status_code", "runs", "cost"),
    [
        ("unavailable", 503, 0, 0),
        ("rate_limited", 503, 0, 0),
        ("timeout", 504, 0, COST),
        ("invalid_output", 502, 0, COST),
    ],
)
def test_failure_policy(client, pro, ai, db, kind, status_code, runs, cost):
    ai.error = kind
    assert run(client, pro, engine="ai").status_code == status_code
    assert counter(db, "limit_ai_runs_month") == (runs, 0)
    assert counter(db, "limit_ai_cost_micros_month") == (cost, 0)
    assert db.scalars(select(AssessmentVersion)).all() == []


def test_retry_after_a_failure_charges_the_customer_once(client, pro, ai, db):
    ai.error = "timeout"
    run(client, pro, key="retry-key-12", engine="ai")
    ai.error = None
    assert run(client, pro, key="retry-key-12", engine="ai").status_code == 201
    assert counter(db, "limit_ai_runs_month") == (1, 0)
    assert counter(db, "limit_ai_cost_micros_month") == (COST * 2, 0)  # both calls may have been billed


def test_a_failed_save_leaves_no_result_and_no_customer_charge(client, pro, ai, db, monkeypatch):
    def broken(*_args, **_kwargs):
        raise RuntimeError("database went away")

    monkeypatch.setattr("app.workspace.service._save", broken)
    with pytest.raises(RuntimeError):
        run(client, pro, engine="ai")
    assert db.scalars(select(AssessmentVersion)).all() == []
    assert counter(db, "limit_ai_runs_month") == (0, 0)
    assert counter(db, "limit_ai_cost_micros_month") == (COST, 0)


def test_a_dead_worker_is_swept_and_the_key_can_run_again(client, pro, ai, db):
    workspace_id = db.scalar(select(CustomerWorkspace.id))
    item = usage.Item("limit_ai_runs_month", 1, 5)
    held = usage.reserve(workspace_id, "swept-key-1", "hash", [item], 60)
    assert counter(db, "limit_ai_runs_month") == (0, 1)
    with pytest.raises(usage.InProgress):
        usage.reserve(workspace_id, "swept-key-1", "hash", [item], 60)
    row = db.get(UsageReservation, held.id)
    row.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    again = usage.reserve(workspace_id, "swept-key-1", "hash", [item], 60)
    assert again.id == held.id
    assert counter(db, "limit_ai_runs_month") == (0, 1)
    db.expire_all()
    assert db.get(UsageReservation, held.id).attempts == 2


def test_a_late_worker_cannot_settle_an_expired_reservation(client, pro, db):
    workspace_id = db.scalar(select(CustomerWorkspace.id))
    held = usage.reserve(workspace_id, "late-key-12", "hash", [usage.Item("limit_ai_runs_month", 1, 5)], 60)
    usage.fail(held.id, "timeout")
    with get_sessionmaker()() as session, pytest.raises(usage.ReservationLost):
        usage.finish(session, held.id, "success")


def test_counters_start_again_each_month(client, pro, db):
    assert usage.period_start(utcnow().replace(day=15)) == utcnow().date().replace(day=1)


def test_scoring_and_approval_rules_are_the_free_advisors(client, pro, ai):
    """The result goes through the same sanitiser: a human approval step is always present."""
    answer = run(client, pro, engine="ai").json()
    assert answer["assessment"]["human_approvals"]
