"""Configuration/prompt registry and the evaluation suite: lifecycle, authorization, four-eyes approval,
version integrity and diffs, secrets refused, deterministic simulated runs, regression detection,
manual labels, approval boundaries, cross-tenant isolation and audit."""

from __future__ import annotations

import json

import pytest
from sqlalchemy import select

from app.models import AuditLog, OpsAgent, OpsOrganization, OpsRole, OpsWorkspace
from app.ops.evaluation import SIMULATED_BANNER, simulated_output
from app.ops.models import OpsAgentVersion
from tests.test_ops_portal import add_member, base, login

PROMPT = (
    "You are a support assistant.\n"
    "Rule: escalate refunds to a person.\n"
    "Rule: never disclose personal data.\n"
    "Rule: cite the source."
)


@pytest.fixture
def team(db, tenants):
    """Org A with an operator and a reviewer, plus a staging workspace and agent (non-sensitive drafts)."""
    org = db.get(OpsOrganization, tenants["tenant-a"]["org"])
    add_member(db, org, "operator.a@example.com", OpsRole.OPERATOR)
    add_member(db, org, "reviewer.a@example.com", OpsRole.REVIEWER)
    add_member(db, org, "viewer.a@example.com", OpsRole.VIEWER)
    ws = OpsWorkspace(organization_id=org.id, slug="staging", name="Staging", environment="staging")
    db.add(ws)
    db.flush()
    agent = OpsAgent(organization_id=org.id, workspace_id=ws.id, key="faq", name="FAQ", status="planned")
    db.add(agent)
    db.commit()
    return {
        "org": org.id,
        "prod_agent": tenants["tenant-a"]["agent"],
        "staging_agent": agent.id,
        "b": tenants["tenant-b"],
    }


def version(client, org, agent, prompt=PROMPT, **extra):
    body = {
        "content": {"prompt_template": prompt, "provider": "anthropic", "model": "claude-opus-5-5", **extra},
        "change_reason": "Initial configuration",
    }
    response = client.post(f"{base(org)}/agents/{agent}/versions", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def run_dataset(client, org, agent, version_id):
    dataset = client.post(f"{base(org)}/agents/{agent}/datasets/templates/support_basics").json()
    assert client.post(f"{base(org)}/datasets/{dataset['id']}/lock").status_code == 200
    run = client.post(f"{base(org)}/datasets/{dataset['id']}/runs", json={"agent_version_id": version_id})
    assert run.status_code == 201, run.text
    return dataset, run.json()


# ------------------------------------------------------------------------------------ registry


def test_lifecycle_draft_review_approved_retired(team):
    operator, reviewer = login("operator.a@example.com"), login("reviewer.a@example.com")
    org, agent = team["org"], team["staging_agent"]
    v1 = version(operator, org, agent)
    assert v1["status"] == "draft" and v1["number"] == 1 and v1["integrity_ok"] and not v1["sensitive"]
    assert operator.patch(f"{base(org)}/versions/{v1['id']}", json={"change_reason": "Refined"}).status_code == 200
    assert operator.post(f"{base(org)}/versions/{v1['id']}/submit").json()["status"] == "in_review"
    # Content cannot change once submitted.
    assert operator.patch(f"{base(org)}/versions/{v1['id']}", json={"change_reason": "x" * 5}).status_code == 409
    sent_back = reviewer.post(
        f"{base(org)}/versions/{v1['id']}/review", json={"decision": "request_changes", "note": "Add a tone rule"}
    )
    assert sent_back.json()["status"] == "draft"
    operator.post(f"{base(org)}/versions/{v1['id']}/submit")
    approved = reviewer.post(f"{base(org)}/versions/{v1['id']}/review", json={"decision": "approve"}).json()
    assert approved["status"] == "approved" and approved["reviewed_at"]
    # Approving the next version retires the previous one.
    v2 = version(operator, org, agent, prompt=PROMPT + "\nRule: keep a friendly tone.")
    operator.post(f"{base(org)}/versions/{v2['id']}/submit")
    reviewer.post(f"{base(org)}/versions/{v2['id']}/review", json={"decision": "approve"})
    statuses = {v["number"]: v["status"] for v in operator.get(f"{base(org)}/agents/{agent}/versions").json()}
    assert statuses == {1: "retired", 2: "approved"}
    assert reviewer.post(f"{base(org)}/versions/{v2['id']}/retire").json()["status"] == "retired"


def test_authorization_by_role(team):
    org, agent = team["org"], team["staging_agent"]
    viewer, reviewer, operator = (
        login("viewer.a@example.com"),
        login("reviewer.a@example.com"),
        login("operator.a@example.com"),
    )
    assert (
        viewer.post(
            f"{base(org)}/agents/{agent}/versions", json={"content": {"prompt_template": "x"}, "change_reason": "test"}
        ).status_code
        == 403
    )
    assert (
        reviewer.post(
            f"{base(org)}/agents/{agent}/versions", json={"content": {"prompt_template": "x"}, "change_reason": "test"}
        ).status_code
        == 403
    )
    v = version(operator, org, agent)
    operator.post(f"{base(org)}/versions/{v['id']}/submit")
    assert operator.post(f"{base(org)}/versions/{v['id']}/review", json={"decision": "approve"}).status_code == 403
    assert viewer.get(f"{base(org)}/versions/{v['id']}").status_code == 200


def test_sensitive_versions_need_a_second_person_and_production_needs_an_evaluation(team):
    owner, reviewer = login("owner.a@example.com"), login("reviewer.a@example.com")
    org, agent = team["org"], team["prod_agent"]
    v = version(owner, org, agent)
    assert v["sensitive"] and v["environment"] == "production"
    owner.post(f"{base(org)}/versions/{v['id']}/submit")
    # The author (an owner) cannot approve their own sensitive change.
    assert owner.post(f"{base(org)}/versions/{v['id']}/review", json={"decision": "approve"}).status_code == 403
    missing = reviewer.post(f"{base(org)}/versions/{v['id']}/review", json={"decision": "approve"})
    assert missing.status_code == 409 and missing.json()["code"] == "ops_evaluation_required"
    _, run = run_dataset(owner, org, agent, v["id"])
    approved = reviewer.post(
        f"{base(org)}/versions/{v['id']}/review", json={"decision": "approve", "evaluation_run_id": run["id"]}
    ).json()
    assert approved["status"] == "approved" and approved["evidence_simulated"] is True


def test_write_tools_and_model_changes_are_sensitive(team):
    operator = login("operator.a@example.com")
    org, agent = team["org"], team["staging_agent"]
    tool = {"name": "crm.update", "kind": "action", "integration": "crm", "access": "write", "requires_approval": True}
    assert version(operator, org, agent, tools=[tool])["sensitive"] is True
    base_v = version(operator, org, agent)
    changed = operator.post(
        f"{base(org)}/agents/{agent}/versions",
        json={
            "content": {"prompt_template": PROMPT, "provider": "anthropic", "model": "claude-sonnet-5-5"},
            "change_reason": "Cheaper model",
            "based_on_id": base_v["id"],
        },
    ).json()
    assert changed["sensitive"] is True


@pytest.mark.parametrize(
    "content",
    [
        {"prompt_template": "Use api_key=sk-ant-api03-abcdefghijklmnopqrstuvwxyz"},
        {"prompt_template": "x", "parameters": {"api_key": "123"}},
        {"prompt_template": "x", "parameters": {"temperature": 5}},
        {"prompt_template": "x", "tools": [{"name": "hook", "kind": "action", "access": "write"}]},
        {
            "prompt_template": "x",
            "tools": [
                {"name": "fetch", "kind": "function", "access": "read", "description": "Calls https://evil.example/run"}
            ],
        },
        {"prompt_template": "x", "tools": [{"name": "run", "kind": "function", "access": "read", "code": "import os"}]},
        {"prompt_template": "x", "model": "gpt'; DROP TABLE"},
    ],
    ids=["secret", "unknown-parameter", "range", "write-without-approval", "url", "code-field", "label"],
)
def test_registry_refuses_secrets_code_and_unknown_fields(team, content):
    operator = login("operator.a@example.com")
    response = operator.post(
        f"{base(team['org'])}/agents/{team['staging_agent']}/versions",
        json={"content": content, "change_reason": "test"},
    )
    assert response.status_code == 422


def test_diff_rollback_and_integrity(db, team):
    operator, reviewer = login("operator.a@example.com"), login("reviewer.a@example.com")
    org, agent = team["org"], team["staging_agent"]
    v1 = version(operator, org, agent)
    operator.post(f"{base(org)}/versions/{v1['id']}/submit")
    reviewer.post(f"{base(org)}/versions/{v1['id']}/review", json={"decision": "approve"})
    v2 = version(
        operator,
        org,
        agent,
        prompt=PROMPT.replace("Rule: cite the source.", "Rule: answer briefly."),
        parameters={"temperature": 0.2},
    )
    diff = operator.get(f"{base(org)}/versions/{v1['id']}/diff/{v2['id']}").json()
    assert {c["field"] for c in diff["changes"]} == {"parameters"}
    assert "-Rule: cite the source." in diff["prompt_diff"] and "+Rule: answer briefly." in diff["prompt_diff"]
    rollback = operator.post(
        f"{base(org)}/agents/{agent}/versions", json={"rollback_of_id": v1["id"], "change_reason": "Restore v1"}
    ).json()
    assert rollback["prompt_template"] == PROMPT and rollback["content_hash"] == v1["content_hash"]
    assert rollback["rollback_of_id"] == v1["id"] and rollback["number"] == 3
    # A tampered row (as the owner, bypassing the API) is reported, not hidden.
    row = db.get(OpsAgentVersion, rollback["id"])
    row.content_hash = "0" * 64
    db.commit()
    assert operator.get(f"{base(org)}/versions/{rollback['id']}").json()["integrity_ok"] is False


def test_audit_never_contains_prompt_content(db, team):
    operator = login("operator.a@example.com")
    version(operator, team["org"], team["staging_agent"], prompt="Rule: the secret phrase is pineapple.")
    entries = db.scalars(select(AuditLog).where(AuditLog.action.startswith("ops.version"))).all()
    assert entries and all("pineapple" not in json.dumps(e.details) for e in entries)


def test_registry_is_tenant_isolated(team):
    client_b = login("owner.b@example.com")
    operator_a = login("operator.a@example.com")
    v = version(operator_a, team["org"], team["staging_agent"])
    b = team["b"]
    assert client_b.get(f"{base(b['org'])}/versions/{v['id']}").status_code == 404
    assert client_b.get(f"{base(team['org'])}/versions/{v['id']}").status_code == 404
    assert (
        client_b.post(
            f"{base(b['org'])}/agents/{team['staging_agent']}/versions",
            json={"content": {"prompt_template": "x"}, "change_reason": "test"},
        ).status_code
        == 404
    )
    other = version(client_b, b["org"], b["agent"])
    assert operator_a.get(f"{base(team['org'])}/versions/{v['id']}/diff/{other['id']}").status_code == 404


# --------------------------------------------------------------------------------- evaluations


def test_simulated_runner_is_deterministic_and_labelled():
    one = simulated_output("Hello", PROMPT)
    assert one == simulated_output("Hello", PROMPT)
    assert one.startswith(SIMULATED_BANNER) and "Rule: cite the source." in one and "You are" not in one


def test_runs_are_simulated_versioned_and_detect_regressions(team):
    operator = login("operator.a@example.com")
    org, agent = team["org"], team["staging_agent"]
    good = version(operator, org, agent)
    dataset, run_good = run_dataset(operator, org, agent, good["id"])
    assert run_good["simulated"] is True and run_good["runner"] == "deterministic_simulated"
    assert "no model was called" in run_good["note"]
    assert run_good["passed"] == run_good["total"] == 4
    assert all(r["output_text"].startswith(SIMULATED_BANNER) for r in run_good["results"])
    # A version that drops the escalation rule regresses exactly that case.
    weaker = version(operator, org, agent, prompt=PROMPT.replace("Rule: escalate refunds to a person.\n", ""))
    run_weak = operator.post(
        f"{base(org)}/datasets/{dataset['id']}/runs", json={"agent_version_id": weaker["id"]}
    ).json()
    comparison = operator.get(f"{base(org)}/eval-runs/{run_good['id']}/compare/{run_weak['id']}").json()
    assert comparison["regressions"] == ["refund-escalation"] and comparison["has_regressions"]
    assert comparison["simulated"] is True and comparison["base_pass_rate"] == 100.0
    # Same inputs, same results.
    again = operator.post(f"{base(org)}/datasets/{dataset['id']}/runs", json={"agent_version_id": good["id"]}).json()
    assert [r["passed"] for r in again["results"]] == [r["passed"] for r in run_good["results"]]


def test_datasets_are_versioned_and_locked(team):
    operator = login("operator.a@example.com")
    org, agent = team["org"], team["staging_agent"]
    first = operator.post(f"{base(org)}/agents/{agent}/datasets/templates/support_basics").json()
    second = operator.post(f"{base(org)}/agents/{agent}/datasets/templates/support_basics").json()
    assert (first["version"], second["version"]) == (1, 2) and first["key"] == second["key"]
    v = version(operator, org, agent)
    unlocked = operator.post(f"{base(org)}/datasets/{first['id']}/runs", json={"agent_version_id": v["id"]})
    assert unlocked.status_code == 409 and unlocked.json()["code"] == "ops_dataset_not_locked"
    operator.post(f"{base(org)}/datasets/{first['id']}/lock")
    case = {
        "key": "late",
        "input_text": "x",
        "expected_behavior": "y y y",
        "assertions": [{"type": "contains", "value": "x"}],
    }
    assert operator.post(f"{base(org)}/datasets/{first['id']}/cases", json=case).status_code == 409


@pytest.mark.parametrize(
    "case",
    [
        {
            "key": "Bad Key",
            "input_text": "x",
            "expected_behavior": "yyy",
            "assertions": [{"type": "contains", "value": "x"}],
        },
        {
            "key": "k",
            "input_text": "token = abcdef123456",
            "expected_behavior": "yyy",
            "assertions": [{"type": "contains", "value": "x"}],
        },
        {"key": "k", "input_text": "x", "expected_behavior": "yyy", "assertions": []},
        {
            "key": "k",
            "input_text": "x",
            "expected_behavior": "yyy",
            "assertions": [{"type": "regex", "value": "(a+)+"}],
        },
        {
            "key": "k",
            "input_text": "x",
            "expected_behavior": "yyy",
            "assertions": [{"type": "max_chars", "value": "lots"}],
        },
        {"key": "k", "input_text": "x", "expected_behavior": "yyy", "assertions": [{"type": "eval", "value": "1"}]},
    ],
    ids=["key", "secret", "no-assertions", "regex", "max-chars", "unknown-type"],
)
def test_case_schema_validation(team, case):
    operator = login("operator.a@example.com")
    response = operator.post(
        f"{base(team['org'])}/agents/{team['staging_agent']}/datasets",
        json={"key": "custom", "name": "Custom", "cases": [case]},
    )
    assert response.status_code == 422


def test_manual_labels_need_the_label_permission_and_never_approve(team):
    operator, reviewer = login("operator.a@example.com"), login("reviewer.a@example.com")
    org, agent = team["org"], team["staging_agent"]
    v = version(operator, org, agent)
    _, run = run_dataset(operator, org, agent, v["id"])
    result = run["results"][0]["id"]
    assert operator.put(f"{base(org)}/eval-results/{result}/label", json={"label": "pass"}).status_code == 403
    labelled = reviewer.put(f"{base(org)}/eval-results/{result}/label", json={"label": "needs_review"}).json()
    assert labelled["manual_label"] == "needs_review"
    # Running and labelling never change the version's status: only a reviewer's decision does.
    assert operator.get(f"{base(org)}/versions/{v['id']}").json()["status"] == "draft"


def test_evaluations_are_tenant_isolated(team):
    operator = login("operator.a@example.com")
    org, agent = team["org"], team["staging_agent"]
    v = version(operator, org, agent)
    dataset, run = run_dataset(operator, org, agent, v["id"])
    client_b = login("owner.b@example.com")
    b = team["b"]
    for path in (f"datasets/{dataset['id']}", f"eval-runs/{run['id']}", f"agents/{agent}/datasets"):
        assert client_b.get(f"{base(b['org'])}/{path}").status_code == 404
    assert client_b.get(f"{base(b['org'])}/eval-runs").json() == []
    other = version(client_b, b["org"], b["agent"])
    mixed = operator.post(f"{base(org)}/datasets/{dataset['id']}/runs", json={"agent_version_id": other["id"]})
    assert mixed.status_code == 404
