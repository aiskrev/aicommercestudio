"""Observability data model (imports, synthetic records, costs, budgets, rules, retention) and the
incident / change workflows (transitions, permissions, concurrency, sanitisation, audit, isolation)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import AuditLog, OpsOrganization, OpsRole
from app.ops import observability as obs
from app.ops.models import OpsIncidentEvent, OpsRun
from tests.test_ops_portal import add_member, base, login
from tests.test_ops_registry_evals import PROMPT, run_dataset, version

NOW = datetime(2026, 11, 3, 12, 0, tzinfo=UTC)


@pytest.fixture
def org_a(db, tenants):
    org = db.get(OpsOrganization, tenants["tenant-a"]["org"])
    add_member(db, org, "operator.a@example.com", OpsRole.OPERATOR)
    add_member(db, org, "reviewer.a@example.com", OpsRole.REVIEWER)
    add_member(db, org, "viewer.a@example.com", OpsRole.VIEWER)
    return {"org": org.id, "agent": tenants["tenant-a"]["agent"], "b": tenants["tenant-b"]}


def record(
    external_id,
    agent,
    *,
    started=None,
    status="succeeded",
    category=None,
    tokens=(1000, 500),
    provider="anthropic",
    model="claude-opus-5-5",
    duration=1200,
):
    return {
        "external_id": external_id,
        "agent_id": str(agent),
        "started_at": (started or datetime.now(UTC)).isoformat(),
        "duration_ms": duration,
        "status": status,
        "error_category": category,
        "provider": provider,
        "model": model,
        "input_tokens": tokens[0],
        "output_tokens": tokens[1],
    }


# ----------------------------------------------------------------------------------- import


def test_manual_import_is_idempotent_and_has_no_content_fields(org_a):
    operator = login("operator.a@example.com")
    org, agent = org_a["org"], org_a["agent"]
    records = [record("r1", agent), record("r2", agent, status="failed", category="timeout")]
    first = operator.post(f"{base(org)}/observability/import", json={"records": records}).json()
    assert (first["received"], first["inserted"], first["duplicates"]) == (2, 2, 0)
    again = operator.post(f"{base(org)}/observability/import", json={"records": records}).json()
    assert (again["inserted"], again["duplicates"]) == (0, 2)
    for bad in (
        {**record("r3", agent), "prompt": "hello"},
        {**record("r4", agent), "output_text": "x"},
        record("r5", agent, status="failed"),
        record("r6", agent, category="timeout"),
    ):
        assert operator.post(f"{base(org)}/observability/import", json={"records": [bad]}).status_code == 422
    # Over the limit: refused by the request-size guard (413) or the 200-record schema limit (422).
    oversized = operator.post(
        f"{base(org)}/observability/import", json={"records": [record(f"x{i}", agent) for i in range(201)]}
    )
    assert oversized.status_code in (413, 422)
    assert (
        login("viewer.a@example.com").post(f"{base(org)}/observability/import", json={"records": records}).status_code
        == 403
    )


def test_import_rejects_another_tenants_agent(org_a):
    operator = login("operator.a@example.com")
    response = operator.post(
        f"{base(org_a['org'])}/observability/import", json={"records": [record("r1", org_a["b"]["agent"])]}
    )
    assert response.status_code == 422 and response.json()["code"] == "ops_import_agent"


def test_synthetic_records_only_for_demo_organisations(db, org_a):
    owner = login("owner.a@example.com")
    org = org_a["org"]
    refused = owner.post(f"{base(org)}/observability/synthetic", json={"days": 2, "runs_per_day": 3})
    assert refused.status_code == 409 and refused.json()["code"] == "ops_not_demo"
    row = db.get(OpsOrganization, org)
    row.is_demo = True
    db.commit()
    made = owner.post(f"{base(org)}/observability/synthetic", json={"days": 2, "runs_per_day": 3}).json()
    assert made["inserted"] == 6
    sources = {r.source for r in db.scalars(select(OpsRun).where(OpsRun.organization_id == org))}
    assert sources == {"synthetic"}
    summary = owner.get(f"{base(org)}/observability/summary").json()
    assert summary["freshness"]["live"] is False and summary["freshness"]["sources"] == {"synthetic": 6}


# -------------------------------------------------------------------------------------- costs


def test_aggregation_and_costs_with_versioned_rate_cards(org_a):
    owner = login("owner.a@example.com")
    org, agent = org_a["org"], org_a["agent"]
    now = datetime.now(UTC)
    cards = [
        {
            "provider": "anthropic",
            "model": "claude-opus-5-5",
            "version": "2026-10",
            "currency": "EUR",
            "input_per_million": "4.000000",
            "output_per_million": "20.000000",
            "effective_from": (now - timedelta(days=30)).isoformat(),
            "source_note": "Entered from the provider price page",
        },
        {
            "provider": "anthropic",
            "model": "claude-opus-5-5",
            "version": "2026-11",
            "currency": "EUR",
            "input_per_million": "3.000000",
            "output_per_million": "15.000000",
            "effective_from": (now - timedelta(days=2)).isoformat(),
            "source_note": "Entered from the provider price page",
        },
    ]
    for card in cards:
        assert owner.post(f"{base(org)}/rate-cards", json=card).status_code == 201
    assert owner.post(f"{base(org)}/rate-cards", json=cards[0]).status_code == 409
    owner.post(
        f"{base(org)}/observability/import",
        json={
            "records": [
                record("old", agent, started=now - timedelta(days=5), tokens=(1_000_000, 100_000)),  # 4 + 2 = 6.0000
                record("new", agent, started=now - timedelta(days=1), tokens=(333, 777)),  # 0.000999 + 0.011655
                record(
                    "fail",
                    agent,
                    started=now - timedelta(days=1),
                    status="failed",
                    category="provider_error",
                    tokens=(0, 0),
                ),
                record("nocard", agent, started=now - timedelta(days=1), model="unknown-model"),
            ]
        },
    )
    summary = owner.get(f"{base(org)}/observability/summary", params={"days": 30}).json()
    totals = summary["totals"]
    assert totals["runs"] == 4 and totals["failed"] == 1 and totals["error_rate_percent"] == 25.0
    assert totals["error_categories"] == {"provider_error": 1}
    assert Decimal(totals["estimated_cost"]["EUR"]) == Decimal("6.0127")  # 6.0000 + 0.0127 (0.012654 rounded) + 0
    assert totals["missing_rate_runs"] == 1
    by_workspace = owner.get(f"{base(org)}/observability/summary", params={"group_by": "workspace"}).json()
    assert [g["label"] for g in by_workspace["groups"]] == ["Production"]


def test_run_cost_rounding_and_missing_rate():
    card = obs.OpsRateCard(
        provider="p",
        model="m",
        currency="USD",
        input_per_million=Decimal("2.5"),
        output_per_million=Decimal("10"),
        effective_from=NOW - timedelta(days=1),
    )
    index = {("p", "m"): [card]}
    run = OpsRun(provider="p", model="m", input_tokens=1, output_tokens=5, started_at=NOW)
    assert obs.run_cost(run, index) == ("USD", Decimal("0.0001"))  # 0.0000525 → half up
    early = OpsRun(provider="p", model="m", input_tokens=1, output_tokens=1, started_at=NOW - timedelta(days=2))
    assert obs.run_cost(early, index) is None


def test_budgets_rules_and_retention(db, org_a):
    owner = login("owner.a@example.com")
    org, agent = org_a["org"], org_a["agent"]
    now = datetime.now(UTC)
    owner.post(
        f"{base(org)}/rate-cards",
        json={
            "provider": "anthropic",
            "model": "claude-opus-5-5",
            "version": "1",
            "currency": "EUR",
            "input_per_million": "10",
            "output_per_million": "10",
            "effective_from": (now - timedelta(days=60)).isoformat(),
            "source_note": "test card",
        },
    )
    owner.post(
        f"{base(org)}/observability/import",
        json={
            "records": [
                record("a", agent, started=now - timedelta(hours=1), tokens=(900_000, 0)),
                record(
                    "b", agent, started=now - timedelta(hours=1), status="failed", category="timeout", tokens=(0, 0)
                ),
            ]
        },
    )
    assert (
        owner.post(
            f"{base(org)}/budgets", json={"name": "Monthly", "amount": "10.00", "currency": "EUR", "warn_percent": 80}
        ).status_code
        == 201
    )
    owner.post(f"{base(org)}/budgets", json={"name": "Dollar budget", "amount": "10.00", "currency": "USD"})
    owner.post(
        f"{base(org)}/threshold-rules",
        json={"name": "Errors", "metric": "error_rate_percent", "threshold": "10", "window_days": 7},
    )
    evaluation = owner.get(f"{base(org)}/observability/evaluation").json()
    states = {b["budget"]["name"]: b["state"] for b in evaluation["budgets"]}
    if now.day == 1 and now.hour < 1:
        pytest.skip("month boundary")
    assert states == {"Dollar budget": "no_cost_data", "Monthly": "warning"}  # 9.00 of 10.00, warn at 80 %
    assert evaluation["rules"][0]["breached"] is True and Decimal(evaluation["rules"][0]["value"]) == Decimal("50.0")
    assert "Nothing is sent" in evaluation["note"]
    # Retention: defaults until configured; purge removes only expired records.
    assert owner.get(f"{base(org)}/retention").json() == {
        "runs_days": 90,
        "eval_results_days": 365,
        "configured": False,
    }
    assert owner.put(f"{base(org)}/retention", json={"runs_days": 3, "eval_results_days": 365}).status_code == 422
    assert owner.put(f"{base(org)}/retention", json={"runs_days": 7, "eval_results_days": 365}).json()["configured"]
    owner.post(
        f"{base(org)}/observability/import", json={"records": [record("old", agent, started=now - timedelta(days=30))]}
    )
    removed = obs.purge_expired(db)
    assert removed["runs"] == 1
    assert {r.external_id for r in db.scalars(select(OpsRun).where(OpsRun.organization_id == org))} == {"a", "b"}


def test_observability_is_tenant_isolated(org_a):
    owner_b = login("owner.b@example.com")
    operator = login("operator.a@example.com")
    operator.post(f"{base(org_a['org'])}/observability/import", json={"records": [record("r1", org_a["agent"])]})
    b = org_a["b"]
    assert owner_b.get(f"{base(b['org'])}/observability/summary").json()["totals"]["runs"] == 0
    assert owner_b.get(f"{base(org_a['org'])}/observability/summary").status_code == 404
    assert owner_b.get(f"{base(b['org'])}/rate-cards").json() == []


# ---------------------------------------------------------------------------------- incidents


def test_incident_flow_permissions_concurrency_and_audit(db, org_a):
    operator, reviewer, viewer = (
        login("operator.a@example.com"),
        login("reviewer.a@example.com"),
        login("viewer.a@example.com"),
    )
    org = org_a["org"]
    created = operator.post(
        f"{base(org)}/incidents",
        json={
            "title": "Wrong answers to customers",
            "severity": "sev2",
            "impact": "customer_facing",
            "agent_id": str(org_a["agent"]),
            "client_summary": "We are reviewing incorrect answers.",
            "note": "Reported by support",
        },
    ).json()
    assert created["status"] == "detected" and created["number"] == 1 and created["lock_version"] == 1
    path = f"{base(org)}/incidents/{created['id']}"
    assert viewer.post(f"{path}/transition", json={"to": "triaged", "expected_version": 1}).status_code == 403
    illegal = operator.post(f"{path}/transition", json={"to": "resolved", "expected_version": 1})
    assert illegal.status_code == 409 and illegal.json()["code"] == "ops_transition"
    v = 1
    for to in ("triaged", "investigating", "mitigated"):
        out = operator.post(f"{path}/transition", json={"to": to, "expected_version": v}).json()
        v = out["lock_version"]
    stale = operator.post(f"{path}/transition", json={"to": "resolved", "expected_version": 1})
    assert stale.status_code == 409 and stale.json()["code"] == "ops_stale"
    no_note = operator.post(f"{path}/transition", json={"to": "resolved", "expected_version": v})
    assert no_note.status_code == 422
    v = operator.post(
        f"{path}/transition", json={"to": "resolved", "expected_version": v, "note": "Rolled back to v1"}
    ).json()["lock_version"]
    # Review is a separate duty.
    assert (
        operator.post(f"{path}/transition", json={"to": "reviewed", "expected_version": v, "note": "x"}).status_code
        == 403
    )
    done = reviewer.post(
        f"{path}/transition", json={"to": "reviewed", "expected_version": v, "note": "Post-incident review held"}
    ).json()
    assert done["status"] == "reviewed" and done["allowed_transitions"] == []
    detail = viewer.get(path).json()
    assert [e["to_status"] for e in detail["events"] if e["kind"] in ("created", "status")] == [
        "detected",
        "triaged",
        "investigating",
        "mitigated",
        "resolved",
        "reviewed",
    ]
    actions = [e.action for e in db.scalars(select(AuditLog).where(AuditLog.action == "ops.incident_transition"))]
    assert len(actions) == 5


@pytest.mark.parametrize("body", ["<script>alert(1)</script>", "password: hunter2hunter2", "bad\x07char"])
def test_notes_are_sanitized(org_a, body):
    operator = login("operator.a@example.com")
    org = org_a["org"]
    incident = operator.post(
        f"{base(org)}/incidents", json={"title": "Cost spike", "severity": "sev3", "impact": "cost"}
    ).json()
    assert operator.post(f"{base(org)}/incidents/{incident['id']}/notes", json={"body": body}).status_code == 422


def test_incident_owner_must_be_a_member_and_records_are_isolated(db, org_a):
    operator = login("operator.a@example.com")
    owner_b = login("owner.b@example.com")
    from app.models import AdminUser

    b_owner = db.scalar(select(AdminUser.id).where(AdminUser.email == "owner.b@example.com"))
    org = org_a["org"]
    bad = operator.post(
        f"{base(org)}/incidents",
        json={"title": "x x x", "severity": "sev4", "impact": "internal", "owner_user_id": str(b_owner)},
    )
    assert bad.status_code == 422
    incident = operator.post(
        f"{base(org)}/incidents", json={"title": "x x x", "severity": "sev4", "impact": "internal"}
    ).json()
    assert owner_b.get(f"{base(org_a['b']['org'])}/incidents/{incident['id']}").status_code == 404
    assert (
        owner_b.post(
            f"{base(org_a['b']['org'])}/incidents/{incident['id']}/transition",
            json={"to": "triaged", "expected_version": 1},
        ).status_code
        == 404
    )
    assert db.scalar(select(OpsIncidentEvent).where(OpsIncidentEvent.organization_id == org_a["b"]["org"])) is None


# ------------------------------------------------------------------------------------ changes


def test_change_flow_requires_evaluation_second_person_and_approved_version(org_a):
    operator, reviewer = login("operator.a@example.com"), login("reviewer.a@example.com")
    owner = login("owner.a@example.com")
    org, agent = org_a["org"], org_a["agent"]
    v = version(operator, org, agent, prompt=PROMPT)
    _, run = run_dataset(operator, org, agent, v["id"])
    change = operator.post(
        f"{base(org)}/changes", json={"agent_version_id": v["id"], "title": "Release support v1", "risk": "medium"}
    ).json()
    path = f"{base(org)}/changes/{change['id']}"

    def move(client, to, version_, **extra):
        return client.post(f"{path}/transition", json={"to": to, "expected_version": version_, **extra})

    n = move(operator, "risk_review", 1, note="Customer-facing; rollback to previous configuration").json()[
        "lock_version"
    ]
    n = move(operator, "evaluation", n).json()["lock_version"]
    missing = move(operator, "human_approval", n)
    assert missing.status_code == 422 and missing.json()["code"] == "ops_evaluation_required"
    n = move(operator, "human_approval", n, evaluation_run_id=run["id"]).json()["lock_version"]
    # The author cannot decide; a reviewer can — but only once the registry approved the version.
    assert move(operator, "approved", n).status_code == 403
    not_approved = move(reviewer, "approved", n)
    assert not_approved.status_code == 409 and not_approved.json()["code"] == "ops_version_not_approved"
    operator.post(f"{base(org)}/versions/{v['id']}/submit")
    reviewer.post(
        f"{base(org)}/versions/{v['id']}/review", json={"decision": "approve", "evaluation_run_id": run["id"]}
    )
    approved = move(reviewer, "approved", n).json()
    assert approved["status"] == "approved" and approved["approved_by"]
    no_note = move(operator, "released", approved["lock_version"])
    assert no_note.status_code == 422
    released = move(
        operator, "released", approved["lock_version"], release_note="Recorded release; deployed by the client team"
    ).json()
    assert released["released_at"]
    reviewed = move(owner, "reviewed", released["lock_version"], note="No regressions reported").json()
    assert reviewed["status"] == "reviewed"
    detail = reviewer.get(path).json()
    assert detail["evidence_simulated"] is True
    assert [e["to_status"] for e in detail["events"]] == [
        "draft",
        "risk_review",
        "evaluation",
        "human_approval",
        "approved",
        "released",
        "reviewed",
    ]


def test_rejected_change_returns_to_draft_and_the_evaluation_must_match(org_a):
    operator, reviewer = login("operator.a@example.com"), login("reviewer.a@example.com")
    org, agent = org_a["org"], org_a["agent"]
    v1 = version(operator, org, agent)
    v2 = version(operator, org, agent, prompt=PROMPT + "\nRule: be brief.")
    _, run_v1 = run_dataset(operator, org, agent, v1["id"])
    change = operator.post(
        f"{base(org)}/changes",
        json={
            "agent_version_id": v2["id"],
            "title": "Brief answers",
            "risk": "low",
            "risk_notes": "Tone only",
            "rollback_version_id": v1["id"],
        },
    ).json()
    path = f"{base(org)}/changes/{change['id']}"
    n = operator.post(f"{path}/transition", json={"to": "risk_review", "expected_version": 1}).json()["lock_version"]
    n = operator.post(f"{path}/transition", json={"to": "evaluation", "expected_version": n}).json()["lock_version"]
    mismatch = operator.post(
        f"{path}/transition", json={"to": "human_approval", "expected_version": n, "evaluation_run_id": run_v1["id"]}
    )
    assert mismatch.status_code == 409 and mismatch.json()["code"] == "ops_evaluation_mismatch"
    _, run_v2 = run_dataset(operator, org, agent, v2["id"])
    n = operator.post(
        f"{path}/transition", json={"to": "human_approval", "expected_version": n, "evaluation_run_id": run_v2["id"]}
    ).json()["lock_version"]
    rejected = reviewer.post(
        f"{path}/transition", json={"to": "rejected", "expected_version": n, "note": "Needs a longer pilot"}
    ).json()
    assert rejected["status"] == "rejected"
    assert (
        operator.post(f"{path}/transition", json={"to": "draft", "expected_version": rejected["lock_version"]}).json()[
            "status"
        ]
        == "draft"
    )
