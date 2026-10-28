"""AI team configurator: model parity, cost model, endpoints, persistence, consent and admin access."""

from __future__ import annotations

import copy
import json
import logging
from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.models import AuditLog, Lead, TeamConfiguration, utcnow
from app.services import leads
from app.team import costs, service
from app.team.model import AGENT_KEYS, INTEGRATIONS, MODEL_VERSION, TeamConfig, summary
from app.team.report import build_team_report
from tests.conftest import valid_token

VECTORS = json.loads((Path(__file__).parent / "fixtures" / "team_vectors.json").read_text(encoding="utf-8"))
BASE = "/api/public/team"
DOC = costs.load_assumptions()


def team_config(**overrides) -> dict:
    config = {
        "context": {
            "industry": "ecommerce",
            "size": "s11_50",
            "lead_department": "support",
            "challenge": "slow_response",
            "volume": "v100_1k",
        },
        "departments": ["support"],
        "chosen": ["customer_support"],
        "agents": {},
        "deployment": "managed_cloud",
        "operations": "shared",
    }
    config.update(overrides)
    return config


def request_body(**overrides) -> dict:
    body = {"schema_version": "1", "model_version": MODEL_VERSION, "locale": "bg", "config": team_config()}
    body.update(overrides)
    return body


def save_body(**overrides) -> dict:
    """A consented save request with a fresh form token."""
    return request_body(**{"form_token": valid_token(), "storage_consent": True, **overrides})


def model(config: dict) -> TeamConfig:
    return TeamConfig(
        config["context"],
        config["departments"],
        config["chosen"],
        config.get("agents", {}),
        config.get("deployment"),
        config.get("operations"),
    )


def submission(**overrides) -> dict:
    body = request_body(
        name="Тест Потребител",
        email="Test.User@Example.com",
        company="Тестова Фирма ЕООД",
        role="Оперативен директор",
        message="",
        privacy_acknowledged=True,
        marketing_consent=False,
        website="",
        form_token=valid_token(),
    )
    body.update(overrides)
    return body


# --- Model parity ----------------------------------------------------------------------------------


def test_golden_vectors_match_the_server_model():
    """The same file is checked by the web tests (scripts/test.ps1 verifies both copies match)."""
    assert VECTORS["model_version"] == MODEL_VERSION
    assert len(VECTORS["vectors"]) >= 60
    for vector in VECTORS["vectors"]:
        assert summary(model(vector["config"])) == vector["expected"]


def test_texts_snapshot_covers_both_locales_and_every_key():
    texts = json.loads((Path(__file__).parents[1] / "app" / "team" / "texts.json").read_text(encoding="utf-8"))
    assert set(texts) == {"bg", "en"}

    def shape(node):
        return {k: shape(v) for k, v in node.items()} if isinstance(node, dict) else type(node).__name__

    assert shape(texts["bg"]) == shape(texts["en"])
    for locale in ("bg", "en"):
        assert set(texts[locale]["agents"]) == set(AGENT_KEYS)
        assert set(texts[locale]["integrations"]) == set(INTEGRATIONS)
        assert texts[locale]["costs"]["disclaimer"]


# --- Cost model ------------------------------------------------------------------------------------


def test_assumptions_are_versioned_and_validated():
    assert DOC["version"] == "2026-10.1" and DOC["currency"] == "EUR"
    broken = copy.deepcopy(DOC)
    broken["one_time"]["discovery_days"] = [3, -1, 8]
    with pytest.raises(costs.AssumptionsError):
        costs.validate_assumptions(broken)
    broken = copy.deepcopy(DOC)
    del broken["model_usage"]["tokens_per_task"]["scheduling"]
    with pytest.raises(costs.AssumptionsError):
        costs.validate_assumptions(broken)
    broken = copy.deepcopy(DOC)
    broken["currency"] = "USD"
    with pytest.raises(costs.AssumptionsError):
        costs.validate_assumptions(broken)
    broken = copy.deepcopy(DOC)
    broken["rates"]["day_rate"] = 5000
    with pytest.raises(costs.AssumptionsError, match="day_rate"):
        costs.validate_assumptions(broken)


def test_hand_checked_estimate_for_a_single_agent():
    """sales_research (low), CRM (medium), sample review, managed cloud, internal operations, 100–1k tasks."""
    config = model(team_config(chosen=["sales_research"], departments=["sales"], operations="internal"))
    result = costs.estimate(config, DOC)
    expected = result["scenarios"]["expected"]
    # days: discovery 5 + agent 6 + CRM 4 + approvals 0 + deployment 2 + testing 0.2 × 10 = 19 → × 600 EUR
    assert expected["one_time_days"]["total"] == 19
    assert expected["one_time"] == {
        "discovery": 3000,
        "agents": 3600,
        "integrations": 2400,
        "approvals": 0,
        "deployment": 1200,
        "testing": 1200,
        "total": 11400,
    }
    # model: 500 tasks × (10 000 in × 3 + 1 500 out × 15) / 1M × 1.25 = 32.8 → 30
    # infrastructure: 200 + 35 = 235 → 240; monitoring: 5 internal hours × 30 = 150;
    # oversight: 25 reviews × 2 min = 0.83 h × 30 = 25 → 30
    assert expected["monthly"] == {
        "infrastructure": 240,
        "model_usage": 30,
        "monitoring": 150,
        "oversight": 30,
        "total": 450,
    }
    assert expected["usage"] == {"tasks_per_month": 500, "input_tokens": 5_000_000, "output_tokens": 750_000}
    assert expected["oversight"] == {"reviews_per_month": 25, "hours_per_month": 1.0}
    assert result["ranges"]["one_time"][0] < 11400 < result["ranges"]["one_time"][1]
    assert result["assumptions_version"] == DOC["version"] and result["currency"] == "EUR"


def test_scenarios_never_decrease_from_conservative_to_higher():
    for vector in VECTORS["vectors"]:
        result = costs.estimate(model(vector["config"]), DOC)
        low, mid, high = (result["scenarios"][name] for name in costs.SCENARIOS)
        for group in ("one_time", "monthly"):
            for key in low[group]:
                assert low[group][key] <= mid[group][key] <= high[group][key], (group, key)
        assert result["ranges"]["one_time"] == [low["one_time"]["total"], high["one_time"]["total"]]
        assert result["ranges"]["monthly"] == [low["monthly"]["total"], high["monthly"]["total"]]
        assert all(v % 10 == 0 for v in mid["monthly"].values())


def test_overrides_change_only_their_lines_and_are_recorded():
    config = model(team_config(chosen=["sales_research"], departments=["sales"], operations="internal"))
    base = costs.estimate(config, DOC)["scenarios"]["expected"]
    custom = costs.estimate(
        config, DOC, {"day_rate": 1000, "price_per_million_input": 0, "price_per_million_output": 0}
    )
    expected = custom["scenarios"]["expected"]
    assert expected["one_time"]["total"] == 19_000
    assert expected["monthly"]["model_usage"] == 0
    assert expected["monthly"]["infrastructure"] == base["monthly"]["infrastructure"]
    assert custom["overrides"] == {"day_rate": 1000.0, "price_per_million_input": 0.0, "price_per_million_output": 0.0}
    assert custom["rates"]["internal_hourly_rate"] == DOC["rates"]["internal_hourly_rate"]


def test_cost_drivers_at_the_boundaries():
    def expected(**kwargs):
        return costs.estimate(model(team_config(**kwargs)), DOC)["scenarios"]["expected"]

    small = expected(chosen=["sales_research"], context={**team_config()["context"], "volume": "v_lt100"})
    busy = expected(
        chosen=["document_processing"],
        agents={"document_processing": {"volume": "v_gt10k", "checkpoint": "every_action", "integrations": []}},
    )
    assert small["monthly"]["oversight"] < busy["monthly"]["oversight"]
    # Every action reviewed: 20 000 tasks × 2 minutes = 666.7 h.
    assert busy["oversight"]["reviews_per_month"] == 20_000
    assert busy["oversight"]["hours_per_month"] == 666.5
    managed = expected(deployment="managed_cloud")
    on_premise = expected(deployment="on_premise")
    assert on_premise["one_time"]["deployment"] > managed["one_time"]["deployment"]
    assert on_premise["monthly"]["infrastructure"] < managed["monthly"]["infrastructure"]  # hardware not included
    # The coordinator runs once per task; the supervisor once per approval request.
    plain = expected(chosen=["lead_qualification", "scheduling"])
    coordinated = expected(chosen=["lead_qualification", "scheduling", "workflow_coordinator", "approval_supervisor"])
    assert coordinated["usage"]["input_tokens"] > plain["usage"]["input_tokens"]
    assert coordinated["one_time"]["agents"] > plain["one_time"]["agents"]


# --- Endpoints: meta and estimate ----------------------------------------------------------------------


def test_meta_publishes_versions_assumptions_and_no_email_delivery(client, settings):
    response = client.get(f"{BASE}/meta")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["model_version"] == MODEL_VERSION and body["schema_version"] == "1"
    assert body["assumptions"]["version"] == DOC["version"]
    assert body["assumptions"]["editable"]["day_rate"] == {"min": 200, "max": 2500, "default": 600}
    assert body["email_delivery"] is False
    assert body["retention_days"] == settings.team_configuration_retention_days


def test_estimate_returns_the_plan_and_stores_nothing(client, db):
    response = client.post(f"{BASE}/estimate", json=request_body(overrides={"day_rate": 700}))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["summary"]["selected"] == ["customer_support", "knowledge_assistant"]
    assert body["summary"] == summary(model(team_config()))
    assert "untrusted_input" in body["security"] and "personal_data" in body["security"]
    assert {
        "kind": "read",
        "agent": "customer_support",
        "via": None,
        "integration": "knowledge_base",
        "approval": None,
    } in body["data_flows"]
    assert {
        "kind": "act",
        "agent": "customer_support",
        "via": None,
        "integration": "helpdesk",
        "approval": "before_external",
    } in body["data_flows"]
    assert body["estimate"]["overrides"] == {"day_rate": 700.0}
    assert set(body["estimate"]["scenarios"]) == {"conservative", "expected", "higher"}
    assert db.scalar(select(func.count()).select_from(TeamConfiguration)) == 0
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


@pytest.mark.parametrize(
    ("overrides", "needle"),
    [
        ({"model_version": "2025-01.1"}, "team_model"),
        ({"schema_version": "2"}, "schema_version"),
        ({"config": team_config(chosen=["unknown_agent"])}, "chosen"),
        ({"config": team_config(chosen=["customer_support", "customer_support"])}, "team_duplicates"),
        ({"config": team_config(chosen=["workflow_coordinator"])}, "team_selection"),
        ({"config": team_config(chosen=["workflow_coordinator", "scheduling"])}, "team_selection"),
        ({"config": team_config(departments=[])}, "departments"),
        ({"config": team_config(deployment="mars")}, "deployment"),
        ({"config": {**team_config(), "custom_name": "Secret dept"}}, "custom_name"),
        ({"config": team_config(agents={"customer_support": {"volume": "v_huge", "checkpoint": "none"}})}, "volume"),
        (
            {
                "config": team_config(
                    agents={
                        "customer_support": {"volume": "v100_1k", "checkpoint": "none", "integrations": ["crm", "crm"]}
                    }
                )
            },
            "team_duplicates",
        ),
        ({"overrides": {"day_rate": 199}}, "day_rate"),
        ({"overrides": {"day_rate": 2501}}, "day_rate"),
        ({"overrides": {"discount": 50}}, "discount"),
        ({"extra": True}, "extra"),
    ],
)
def test_estimate_rejects_invalid_payloads(client, overrides, needle):
    response = client.post(f"{BASE}/estimate", json=request_body(**overrides))
    assert response.status_code == 422, response.text
    assert needle in json.dumps(response.json())


def test_validation_messages_follow_the_language(client):
    response = client.post(
        f"{BASE}/estimate",
        json=request_body(config=team_config(chosen=["workflow_coordinator"])),
        headers={"Accept-Language": "en"},
    )
    assert "at least one task agent" in json.dumps(response.json())


def test_server_ignores_a_checkpoint_below_the_rule_minimum(client):
    config = team_config(
        agents={"customer_support": {"volume": "v100_1k", "checkpoint": "none", "integrations": ["erp"]}}
    )
    body = client.post(f"{BASE}/estimate", json=request_body(config=config)).json()
    assert body["summary"]["configs"]["customer_support"] == {
        "volume": "v100_1k",
        "checkpoint": "before_external",
        "integrations": ["helpdesk", "knowledge_base"],
    }


def test_estimate_is_rate_limited(client, settings):
    for _ in range(settings.team_estimate_rate_limit):
        assert client.post(f"{BASE}/estimate", json=request_body()).status_code == 200
    assert client.post(f"{BASE}/estimate", json=request_body()).status_code == 429


# --- PDF -------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(("locale", "filename"), [("bg", "ai-ekip-plan.pdf"), ("en", "ai-team-plan.pdf")])
def test_report_returns_a_pdf_and_stores_nothing(client, db, locale, filename):
    response = client.post(
        f"{BASE}/report",
        json=request_body(
            locale=locale,
            company="Фирма & Син",
            form_token=valid_token(),
            config=team_config(chosen=list(AGENT_KEYS), departments=["support", "finance"]),
        ),
    )
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert filename in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-") and len(response.content) > 10_000
    assert db.scalar(select(func.count()).select_from(TeamConfiguration)) == 0


def test_report_requires_a_form_token_and_rejects_html(client):
    assert client.post(f"{BASE}/report", json=request_body(form_token="")).status_code == 400
    response = client.post(f"{BASE}/report", json=request_body(form_token=valid_token(), company="<b>x</b>"))
    assert response.status_code == 422


@pytest.mark.parametrize("operations", ["studio_managed", "shared", "internal"])
@pytest.mark.parametrize("deployment", ["managed_cloud", "customer_cloud", "on_premise"])
def test_build_team_report_for_every_environment(deployment, operations):
    config = model(
        team_config(
            chosen=["customer_support", "workflow_coordinator", "lead_qualification", "approval_supervisor"],
            deployment=deployment,
            operations=operations,
        )
    )
    plan = service.build_plan(config, DOC, {"day_rate": 750})
    for locale in ("bg", "en"):
        assert build_team_report(config, plan, locale).startswith(b"%PDF-")


# --- Saved configurations ----------------------------------------------------------------------------------


def test_save_and_lookup_a_configuration_with_a_hashed_token(client, db, settings):
    config = team_config(agents={"scheduling": {"volume": "v_lt100", "checkpoint": "every_action", "integrations": []}})
    response = client.post(
        f"{BASE}/configurations",
        json=request_body(config=config, form_token=valid_token(), overrides={"day_rate": 650}, storage_consent=True),
    )
    assert response.status_code == 201, response.text
    saved = response.json()
    token = saved["token"]
    assert len(token) >= 40 and saved["reference"]

    row = db.scalar(select(TeamConfiguration))
    assert row.token_hash == service.hash_token(token) and token not in json.dumps(row.config)
    assert row.lead_id is None
    assert row.model_version == MODEL_VERSION and row.assumptions_version == DOC["version"]
    assert row.overrides == {"day_rate": 650.0}
    # Data minimisation: settings for agents outside the team are dropped.
    assert set(row.config["agents"]) <= set(summary(model(config))["selected"])
    assert "scheduling" not in row.config["agents"]
    days = (row.expires_at - row.created_at).days
    assert days == settings.team_configuration_retention_days

    lookup = client.post(f"{BASE}/configurations/lookup", json={"token": token})
    assert lookup.status_code == 200
    assert lookup.json()["config"]["chosen"] == ["customer_support"]
    assert lookup.json()["overrides"] == {"day_rate": 650.0}
    assert lookup.headers["cache-control"] == "no-store"


def test_lookup_rejects_unknown_expired_and_lead_linked_configurations(client, db):
    assert client.post(f"{BASE}/configurations/lookup", json={"token": "x" * 43}).status_code == 404
    assert client.post(f"{BASE}/configurations/lookup", json={"token": "short"}).status_code == 422
    token = client.post(f"{BASE}/configurations", json=save_body()).json()["token"]
    row = db.scalar(select(TeamConfiguration))
    row.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    assert client.post(f"{BASE}/configurations/lookup", json={"token": token}).status_code == 404


def test_save_requires_a_form_token_and_is_rate_limited(client, settings):
    assert client.post(f"{BASE}/configurations", json=save_body(form_token="")).status_code == 400
    for _ in range(settings.team_save_rate_limit - 1):
        assert client.post(f"{BASE}/configurations", json=save_body()).status_code == 201
    assert client.post(f"{BASE}/configurations", json=save_body()).status_code == 429


def test_tokens_never_reach_the_logs(client, caplog):
    caplog.set_level(logging.INFO)
    token = client.post(f"{BASE}/configurations", json=save_body()).json()["token"]
    client.post(f"{BASE}/configurations/lookup", json={"token": token})
    dumped = json.dumps([r.__dict__ for r in caplog.records], default=str)
    assert token not in dumped


def test_expired_unlinked_configurations_are_purged(client, db):
    client.post(f"{BASE}/configurations", json=save_body())
    client.post(f"{BASE}/submissions", json=submission())
    for row in db.scalars(select(TeamConfiguration)):
        row.expires_at = utcnow() - timedelta(days=1)
    db.commit()
    assert service.count_expired(db) == 1
    assert service.purge_expired(db, dry_run=True).deleted == 0
    assert service.purge_expired(db).deleted == 1
    # The one attached to a consultation lead follows the lead.
    remaining = db.scalars(select(TeamConfiguration)).all()
    assert len(remaining) == 1 and remaining[0].lead_id is not None


# --- Consultation (lead capture) ------------------------------------------------------------------------


def test_submission_creates_a_lead_with_a_linked_configuration(client, db, settings):
    response = client.post(f"{BASE}/submissions", json=submission(overrides={"day_rate": 800}))
    assert response.status_code == 201, response.text
    body = response.json()
    assert "имейл" not in body["message"].lower()

    lead = db.scalar(select(Lead))
    assert lead.source == leads.TEAM_SOURCE and lead.service == "ai_agents"
    assert lead.email == "test.user@example.com" and lead.reference == body["reference"]
    details = lead.service_details
    assert details["kind"] == "team" and details["agents"] == ["customer_support", "knowledge_assistant"]
    assert details["assumptions_version"] == DOC["version"] and details["currency"] == "EUR"
    assert details["expected"]["one_time"] > 0
    row = db.scalar(select(TeamConfiguration))
    assert row.lead_id == lead.id and row.token_hash is None and row.overrides == {"day_rate": 800.0}

    created = db.scalar(select(AuditLog).where(AuditLog.action == "lead.created"))
    assert created.details["source"] == leads.TEAM_SOURCE
    assert "test.user@example.com" not in json.dumps(created.details)

    # Deleting the lead deletes its configuration.
    leads.delete_lead(db, lead, actor=None, ip_hash=None, reason="test")
    db.commit()
    assert db.scalar(select(func.count()).select_from(TeamConfiguration)) == 0


def test_consent_is_explicit_separate_and_versioned(client, db, settings):
    assert client.post(f"{BASE}/submissions", json=submission(privacy_acknowledged=False)).status_code == 422
    assert client.post(f"{BASE}/submissions", json=submission(email="no@example.com")).status_code == 201
    assert (
        client.post(f"{BASE}/submissions", json=submission(email="yes@example.com", marketing_consent=True)).status_code
        == 201
    )
    without = db.scalar(select(Lead).where(Lead.email == "no@example.com"))
    with_consent = db.scalar(select(Lead).where(Lead.email == "yes@example.com"))
    assert without.marketing_consent is False and without.marketing_consent_version is None
    assert without.privacy_notice_version == settings.privacy_notice_version
    assert with_consent.marketing_consent_version == settings.marketing_consent_version


def test_submission_abuse_protection(client, db):
    fake = client.post(f"{BASE}/submissions", json=submission(website="http://bot.example"))
    assert fake.status_code == 201 and fake.json()["reference"]
    assert client.post(f"{BASE}/submissions", json=submission(form_token=valid_token(age_seconds=0))).status_code == 400
    links = " ".join(f"https://spam{i}.example.com" for i in range(5))
    assert client.post(f"{BASE}/submissions", json=submission(message=links)).status_code in (400, 422)
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_submission_logs_carry_no_personal_data(client, caplog):
    caplog.set_level(logging.INFO)
    payload = submission(name="Мария Тайнова", email="maria.secret@example.com", message="Поверителен проект Орион")
    assert client.post(f"{BASE}/submissions", json=payload).status_code == 201
    dumped = json.dumps(
        [r.__dict__ for r in caplog.records if r.name.startswith("app.")], default=str, ensure_ascii=False
    )
    for secret in ("Мария Тайнова", "maria.secret@example.com", "Поверителен проект Орион", "Тестова Фирма"):
        assert secret not in dumped


# --- Admin ---------------------------------------------------------------------------------------------


def _lead_id(db) -> str:
    return str(db.scalar(select(Lead.id)))


def test_admin_team_report_requires_login(client, db):
    client.post(f"{BASE}/submissions", json=submission())
    assert client.get(f"/api/admin/leads/{_lead_id(db)}/team-report").status_code == 401


def test_admin_sees_the_configuration_and_downloads_the_plan(admin_client, db):
    assert admin_client.post(f"{BASE}/submissions", json=submission()).status_code == 201
    lead_id = _lead_id(db)
    detail = admin_client.get(f"/api/admin/leads/{lead_id}").json()
    team = detail["team"]
    assert team["agents"] == ["customer_support", "knowledge_assistant"]
    assert team["complexity"] == "medium" and team["currency"] == "EUR"
    assert team["one_time_range"][0] <= team["expected_one_time"] <= team["one_time_range"][1]

    pdf = admin_client.get(f"/api/admin/leads/{lead_id}/team-report")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    assert "ai-team-" in pdf.headers["content-disposition"]
    db.expire_all()
    assert db.scalar(select(AuditLog).where(AuditLog.action == "lead.team_report_downloaded")) is not None


def test_admin_team_report_is_404_for_other_leads(admin_client, make_lead, db):
    make_lead()
    lead_id = _lead_id(db)
    assert admin_client.get(f"/api/admin/leads/{lead_id}").json()["team"] is None
    assert admin_client.get(f"/api/admin/leads/{lead_id}/team-report").status_code == 404


def test_admin_retention_includes_team_configurations(admin_client, db):
    admin_client.post(f"{BASE}/configurations", json=save_body())
    row = db.scalar(select(TeamConfiguration))
    row.expires_at = utcnow() - timedelta(days=1)
    db.commit()
    preview = admin_client.get("/api/admin/retention").json()
    assert preview["team_configurations_due"] == 1
    run = admin_client.post("/api/admin/retention/run", json={"confirm": True}).json()
    assert run["team_configurations_deleted"] == 1


def test_team_leads_have_their_own_retention(client, db, make_lead):
    client.post(f"{BASE}/submissions", json=submission())
    make_lead(email="contact@example.com")
    for lead in db.scalars(select(Lead)):
        lead.updated_at = utcnow() - timedelta(days=400)
    db.commit()
    result = leads.purge_expired(db, 730, 1095, team_retention_days=365)
    assert result.leads_deleted == 1
    assert [lead.email for lead in db.scalars(select(Lead))] == ["contact@example.com"]


def test_assumptions_for_an_unknown_version_fall_back_to_the_current_document(settings):
    assert service.assumptions_for_version(settings, "1999-01.1")["version"] == DOC["version"]
    assert service.assumptions_for_version(settings, "../../etc/passwd")["version"] == DOC["version"]


def test_a_configuration_is_stored_only_with_explicit_consent(client, db):
    from app.models import TeamConfiguration

    for consent in (None, False, "yes"):
        body = request_body(form_token=valid_token())
        if consent is not None:
            body["storage_consent"] = consent
        assert client.post(f"{BASE}/configurations", json=body).status_code == 422
    assert db.scalar(select(func.count()).select_from(TeamConfiguration)) == 0
    saved = client.post(f"{BASE}/configurations", json=save_body())
    assert saved.status_code == 201
    assert db.scalar(select(func.count()).select_from(TeamConfiguration)) == 1
