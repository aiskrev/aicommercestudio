"""Cloud & Platform and DevOps Delivery assessments, explainable findings, reports and consultations."""

from __future__ import annotations

import re
from datetime import timedelta
from typing import Any

import pytest
from sqlalchemy import func, select

from app.assessments import service
from app.assessments.definition import AssessmentDefinition
from app.assessments.presenter import present_result
from app.assessments.registry import build_registry, registry
from app.assessments.report import build_document
from app.models import AssessmentResultRecord, AuditLog, Lead, utcnow
from app.reports.document import (
    MAX_CHARACTERS,
    Paragraph,
    ReportDocument,
    ReportTooLarge,
    Section,
    check_limits,
    clean,
)
from app.reports.pdf import render_pdf
from tests.conftest import valid_token

CYRILLIC = re.compile(r"[Ѐ-ӿ]")
BASE = "/api/public/assessments"


def cloud() -> AssessmentDefinition:
    return registry().current("cloud_platform")


def devops() -> AssessmentDefinition:
    return registry().current("devops_delivery")


def answers_at(definition: AssessmentDefinition, index: int, **extra: Any) -> dict[str, Any]:
    """Every scored single-choice question answered with option `index` (0 = weakest, 3 = strongest)."""
    values: dict[str, Any] = {
        q.key: q.options[index].key for q in definition.questions if q.scored and q.type == "single_choice"
    }
    values.update(extra)
    return values


def score(client, key: str, answers: dict[str, Any], **body: Any):
    definition = registry().current(key)
    payload = {"schema_version": "1", "definition_version": definition.version, "locale": "en", "answers": answers}
    payload.update(body)
    return client.post(f"{BASE}/{key}/score", json=payload)


def saved_token(client, key="cloud_platform", answers=None, locale="en") -> str:
    answers = answers or answers_at(cloud(), 1, cloud_context=["aws"])
    response = score(client, key, answers, save=True, locale=locale)
    assert response.status_code == 200, response.text
    return response.json()["saved"]["token"]


# --------------------------------------------------------------------------- definitions and scoring


def test_cloud_covers_the_ten_requested_domains_and_vendor_contexts():
    definition = cloud()
    assert definition.dimension_keys == (
        "landing_zones",
        "identity",
        "network",
        "iac",
        "platform_ops",
        "cicd",
        "observability",
        "resilience",
        "security_policy",
        "finops",
    )
    context = definition.question("cloud_context")
    assert context.evidence == "context" and not context.scored
    assert [o.key for o in context.options] == ["aws", "azure", "gcp", "hybrid", "private_cloud", "on_premises"]


@pytest.mark.parametrize(("index", "overall", "band"), [(0, 0, "initial"), (3, 100, "optimised")])
def test_cloud_boundaries(index, overall, band):
    _, result = service.assess(cloud(), answers_at(cloud(), index, cloud_context=["gcp"]))
    assert (result.overall, result.band) == (overall, band)
    assert set(result.dimensions.values()) == {overall}


def test_context_answers_never_move_the_score():
    base = answers_at(cloud(), 2, cloud_context=["aws"])
    scores = {
        tuple(ctx): service.assess(cloud(), dict(base, cloud_context=ctx))[1].overall
        for ctx in (["aws"], ["azure", "gcp"], ["on_premises"], ["aws", "azure", "gcp", "hybrid", "private_cloud"])
    }
    assert len(set(scores.values())) == 1


def test_band_thresholds_are_inclusive():
    definition = cloud()
    # Half the dimensions at 1/3, half at 2/3 → overall exactly 50 → "defined".
    weak = {
        "lz_structure",
        "lz_guardrails",
        "id_sso",
        "id_least_privilege",
        "net_segmentation",
        "net_connectivity",
        "iac_coverage",
        "iac_workflow",
        "platform_ops",
        "platform_patching",
    }
    mixed = {q.key: q.options[1 if q.key in weak else 2].key for q in definition.questions if q.scored}
    _, result = service.assess(definition, dict(mixed, cloud_context=["aws"]))
    assert result.overall == 50 and result.band == "defined"


def test_every_cloud_finding_explains_its_trigger_and_the_roadmap_is_ordered():
    definition = cloud()
    answers, result = service.assess(definition, answers_at(definition, 0, cloud_context=["aws", "azure", "hybrid"]))
    view = present_result(definition, result, "en", answers)
    kinds = {f["kind"] for f in view["recommendations"]}
    assert {"risk", "quick_win", "recommendation", "context"} <= kinds
    for finding in view["recommendations"]:
        assert finding["because"], finding["key"]
    shared = next(f for f in view["recommendations"] if f["key"] == "risk_shared_account")
    assert shared["because"] == [
        "“How are cloud accounts, subscriptions or projects organised?”: "
        "One shared account or subscription for everything"
    ]
    landing = next(f for f in view["recommendations"] if f["key"] == "rec_landing_zone")
    assert landing["because"] == ["Landing zones and organisation: 0/100, below the 50 threshold"]
    multi = next(f for f in view["recommendations"] if f["key"] == "ctx_multi_cloud")
    assert "not equivalent" in multi["title"]
    assert [step["horizon"] for step in view["roadmap"]] == [30, 60]
    assert all(view["dimensions"][i]["level"]["key"] == "initial" for i in range(10))
    assert "cloud_platform" in view["domains"]


def test_strong_answers_get_target_states_not_remediation():
    definition = cloud()
    answers, result = service.assess(definition, answers_at(definition, 3, cloud_context=["gcp"]))
    view = present_result(definition, result, "bg", answers)
    kinds = {f["kind"] for f in view["recommendations"]}
    assert kinds == {"target_state", "context"}
    assert [step["horizon"] for step in view["roadmap"]] == [90]
    assert all(CYRILLIC.search(" ".join(f["because"])) for f in view["recommendations"] if f["kind"] == "target_state")


def test_kinds_do_not_count_toward_the_recommendation_cap():
    definition = cloud()
    _, result = service.assess(definition, answers_at(definition, 0, cloud_context=["aws"]))
    plain = [k for k in result.recommendations if definition.rules_for(k)[0].kind == "recommendation"]
    assert len(plain) == definition.scoring.max_recommendations == 10
    assert len(result.recommendations) > 10


def test_devops_separates_self_reported_practices_from_metrics():
    definition = devops()
    assert definition.version == "1.1.0" and len(definition.dimensions) == 11
    metrics = [q.key for q in definition.questions if q.evidence == "metric"]
    assert metrics == [
        "dora_deploy_frequency",
        "dora_lead_time_hours",
        "dora_change_failure_rate",
        "dora_restore_hours",
        "dora_source",
    ]
    practices = answers_at(definition, 2)
    _, without = service.assess(definition, practices)
    _, with_metrics = service.assess(
        definition, dict(practices, dora_deploy_frequency=120, dora_change_failure_rate=2.5, dora_source="tooling")
    )
    assert without.overall == with_metrics.overall  # metrics are never scored
    assert without.extras == {"metrics_provided": 0, "metrics_evidence": "none"}
    assert with_metrics.extras == {"metrics_provided": 2, "metrics_evidence": "measured"}
    _, estimated = service.assess(definition, dict(practices, dora_lead_time_hours=48, dora_source="estimate"))
    assert estimated.extras["metrics_evidence"] == "estimate"
    assert "ctx_metrics_estimated" in estimated.recommendations
    _, unspecified = service.assess(definition, dict(practices, dora_restore_hours=4))
    assert unspecified.extras["metrics_evidence"] == "unspecified"


def test_devops_answer_validation(client):
    practices = answers_at(devops(), 1)
    source_only = score(client, "devops_delivery", dict(practices, dora_source="tooling"))
    assert source_only.status_code == 422 and source_only.json()["errors"][0]["type"] == "inconsistent"
    for bad in (
        {"dora_change_failure_rate": 140},
        {"dora_deploy_frequency": -1},
        {"dora_deploy_frequency": 2.5},
        {"vc_review": "sometimes_maybe"},
        {"cd_deploy": None},
    ):
        response = score(client, "devops_delivery", dict(practices, **bad))
        assert response.status_code == 422, bad
    missing = dict(practices)
    missing.pop("gitops_drift")
    assert {e["type"] for e in score(client, "devops_delivery", missing).json()["errors"]} == {"missing_required"}


def test_devops_recommendations_patterns_and_backlog():
    definition = devops()
    answers, result = service.assess(definition, answers_at(definition, 0))
    view = present_result(definition, result, "en", answers)
    keys = [f["key"] for f in view["recommendations"]]
    assert keys[:2] == ["risk_no_review", "risk_secrets_in_code"]  # backlog ordered by priority
    assert {"pattern_trunk_ci", "pattern_gitops_pull", "pattern_progressive"} <= set(keys)
    assert "qw_measure_delivery" in keys  # no metrics → measure them, never assume them
    measure = next(f for f in view["recommendations"] if f["key"] == "qw_measure_delivery")
    assert measure["because"] == ["No answer to “Production deployments in the last 30 days”"]
    assert [step["horizon"] for step in view["roadmap"]] == [30, 60, 90]


def test_devops_1_0_0_results_still_rescore():
    old = registry().get("devops_delivery", "1.0.0")
    assert old is not None and old.status == "preview"


def test_definitions_reject_points_on_unscored_questions_and_unknown_domains():
    data = cloud().model_dump(mode="json", exclude_none=True)
    data["questions"][0]["options"][0]["points"] = 3
    with pytest.raises(ValueError, match="unscored question cannot have points"):
        AssessmentDefinition.model_validate(data)
    data = cloud().model_dump(mode="json", exclude_none=True)
    data["rules"][0]["domains"] = ["crypto_mining"]
    with pytest.raises(ValueError, match="unknown service domain"):
        AssessmentDefinition.model_validate(data)


def observability() -> AssessmentDefinition:
    return registry().current("observability_reliability")


OBS_WEAK = {
    "telemetry": [],
    "log_retention_days": 0,
    "alert_routing": "none",
    "actionable_alerts": 0,
    "incident_process": "none",
    "postmortems": False,
    "slos": "none",
}
OBS_STRONG = {
    "telemetry": ["logs", "metrics", "traces", "error_tracking"],
    "log_retention_days": 90,
    "alert_routing": "on_call_rotation",
    "actionable_alerts": 4,
    "incident_process": "practiced",
    "postmortems": True,
    "slos": "all_critical",
    "status_communication": True,
}


def test_observability_1_1_0_is_live_with_the_same_questions_as_1_0_0():
    current, previous = observability(), registry().get("observability_reliability", "1.0.0")
    assert (current.version, current.status, previous.status) == ("1.1.0", "live", "preview")
    assert [q.key for q in current.questions] == [q.key for q in previous.questions]
    assert current.extension == "observability_signals"


def test_observability_boundaries_and_explained_findings():
    definition = observability()
    answers, weak = service.assess(definition, OBS_WEAK)
    assert (weak.overall, weak.band) == (0, "reactive")
    assert weak.extras == {"missing_signals": ["logs", "metrics", "traces"]}
    view = present_result(definition, weak, "en", answers)
    kinds = {f["key"]: f["kind"] for f in view["recommendations"]}
    assert kinds["risk_no_alerts"] == kinds["risk_no_incident_process"] == kinds["risk_blind_spots"] == "risk"
    assert kinds["on_call_routing"] == "quick_win"
    assert all(f["because"] for f in view["recommendations"])
    alerts = next(f for f in view["recommendations"] if f["key"] == "risk_no_alerts")
    assert alerts["because"] == ["“How do alerts reach the team?”: We have no alerts"]

    answers, strong = service.assess(definition, OBS_STRONG)
    assert (strong.overall, strong.band) == (100, "reliable")
    view = present_result(definition, strong, "bg", answers)
    assert {f["kind"] for f in view["recommendations"]} == {"target_state"}
    assert [step["horizon"] for step in view["roadmap"]] == [90]


def test_observability_keeps_its_cross_question_check(client):
    response = score(
        client, "observability_reliability", dict(OBS_STRONG, telemetry=[], alert_routing="on_call_rotation")
    )
    assert response.status_code == 422 and response.json()["errors"][0]["type"] == "inconsistent"


# --------------------------------------------------------------------------- API


@pytest.mark.parametrize("locale", ["bg", "en"])
def test_api_scores_cloud_with_findings_roadmap_and_inputs(client, db, locale):
    response = score(client, "cloud_platform", answers_at(cloud(), 1, cloud_context=["azure"]), locale=locale)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["recommendations"] and all(f["because"] for f in body["recommendations"])
    assert {i["evidence"] for i in body["inputs"]} == {"practice", "context"}
    assert body["dimensions"][0]["level"]["title"]
    if locale == "en":
        assert not CYRILLIC.search(response.text)
    else:
        assert CYRILLIC.search(body["recommendations"][0]["because"][0])
    assert db.scalar(select(func.count()).select_from(AssessmentResultRecord)) == 0


def test_public_definition_exposes_evidence_but_no_points(client):
    body = client.get(f"{BASE}/devops_delivery", params={"locale": "en"}).json()
    assert body["version"] == "1.1.0"
    evidence = {q["key"]: q["evidence"] for q in body["questions"]}
    assert evidence["dora_deploy_frequency"] == "metric" and evidence["vc_review"] == "practice"
    assert '"points"' not in str(body) and "weight" not in str(body)


# --------------------------------------------------------------------------- reports


@pytest.mark.parametrize("locale", ["bg", "en"])
def test_report_pdf_for_a_saved_result(client, locale):
    token = saved_token(client, locale=locale)
    response = client.post(f"{BASE}/results/report", params={"locale": locale}, json={"token": token})
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    disposition = response.headers["content-disposition"]
    assert disposition in ('attachment; filename="doklad-ocenka.pdf"', 'attachment; filename="assessment-report.pdf"')
    assert token not in disposition
    pdf = response.content
    assert pdf.startswith(b"%PDF-") and 10_000 < len(pdf) < 2_000_000
    # Cyrillic needs the embedded DejaVu TrueType font; the base-14 fonts cannot render it.
    assert b"+DejaVuSans" in pdf and b"/FontFile2" in pdf


@pytest.mark.parametrize("locale", ["bg", "en"])
def test_report_json_matches_the_structure_for_the_html_view(client, locale):
    token = saved_token(client)
    response = client.post(f"{BASE}/results/report", params={"locale": locale}, json={"token": token, "format": "json"})
    assert response.status_code == 200
    document = response.json()
    assert document["brand"] == "A.I. Commerce Studio" and document["locale"] == locale
    headings = [s["heading"] for s in document["sections"]]
    expected = {
        "bg": ["За тази оценка", "Вашите отговори и допускания", "Резултати", "Ограничения"],
        "en": ["About this assessment", "Your answers and assumptions", "Results", "Limitations"],
    }[locale]
    assert all(h in headings for h in expected)
    assert headings[-1] == expected[-1]
    labels = [m["label"] for m in document["meta"]]
    assert labels[1] in ("Версия на методиката", "Methodology version")
    assert "1.0.0 (weighted-mean/1)" in [m["value"] for m in document["meta"]]
    text = str(document)
    assert "verified" in text or "проверен" in text  # never claims independent verification


def test_report_is_only_for_the_result_the_token_opens(client, db):
    weak = saved_token(client, answers=answers_at(cloud(), 0, cloud_context=["aws"]))
    strong = saved_token(client, answers=answers_at(cloud(), 3, cloud_context=["gcp"]))
    first = client.post(f"{BASE}/results/report", json={"token": weak, "format": "json"}).json()
    second = client.post(f"{BASE}/results/report", json={"token": strong, "format": "json"}).json()
    rows = {r.reference for r in db.scalars(select(AssessmentResultRecord))}
    assert len(rows) == 2
    ref = lambda doc: next(m["value"] for m in doc["meta"] if m["label"] in ("Reference", "Референция"))  # noqa: E731
    assert {ref(first), ref(second)} == rows and ref(first) != ref(second)
    assert ": 0/100 —" in str(first) and ": 100/100 —" in str(second)
    for token in ("x" * 43, weak[:-1] + ("A" if weak[-1] != "A" else "B")):
        missing = client.post(f"{BASE}/results/report", json={"token": token})
        assert missing.status_code == 404 and missing.json()["code"] == "assessment_result_not_found"


def test_expired_or_deleted_results_have_no_report(client, db):
    token = saved_token(client)
    row = db.scalar(select(AssessmentResultRecord))
    row.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    assert client.post(f"{BASE}/results/report", json={"token": token}).status_code == 404
    other = saved_token(client)
    client.post(f"{BASE}/results/delete", json={"token": other})
    assert client.post(f"{BASE}/results/report", json={"token": other}).status_code == 404


def test_report_rejects_unknown_fields_and_bad_formats(client):
    token = saved_token(client)
    assert client.post(f"{BASE}/results/report", json={"token": token, "format": "html"}).status_code == 422
    assert client.post(f"{BASE}/results/report", json={"token": token, "path": "/etc/passwd"}).status_code == 422


def test_report_generation_failures_are_reported_without_losing_the_result(client, monkeypatch):
    from app.readiness.report import ReportUnavailable

    token = saved_token(client)

    def broken(_document):
        raise ReportUnavailable("fonts missing")

    monkeypatch.setattr("app.routers.assessments.render_pdf", broken)
    response = client.post(f"{BASE}/results/report", params={"locale": "en"}, json={"token": token})
    assert response.status_code == 503 and response.json()["code"] == "report_unavailable"

    def too_big(_document):
        raise ReportTooLarge("pdf too large")

    monkeypatch.setattr("app.routers.assessments.render_pdf", too_big)
    assert client.post(f"{BASE}/results/report", json={"token": token}).json()["code"] == "report_too_large"
    assert client.post(f"{BASE}/results/lookup", json={"token": token}).status_code == 200


def test_report_rate_limit(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "assessment_report_rate_limit", 2)
    token = saved_token(client)
    for _ in range(2):
        assert client.post(f"{BASE}/results/report", json={"token": token, "format": "json"}).status_code == 200
    assert client.post(f"{BASE}/results/report", json={"token": token}).status_code == 429


def test_report_logs_never_contain_the_token(client, caplog):
    token = saved_token(client)
    caplog.set_level("INFO")
    client.post(f"{BASE}/results/report", json={"token": token})
    logged = " ".join(f"{r.getMessage()} {r.__dict__}" for r in caplog.records)
    assert token not in logged and "assessment_report_generated" in logged


# --------------------------------------------------------------------------- document model and renderer


def test_clean_removes_control_and_bidi_characters_and_caps_length():
    assert clean("a\x00b‮c⁦d\n\n e") == "a b c d e"
    assert len(clean("x" * 5000)) == 1500 and clean("x" * 5000).endswith("…")


def test_malicious_and_long_text_renders_as_text():
    hostile = "<script>alert(1)</script> <b>bold</b> &amp; <para>x</para> ]]> ' \" " + "Дълъг текст " * 200
    document = ReportDocument(
        locale="bg",
        brand="A.I. Commerce Studio",
        title=clean(hostile, 160),
        subtitle="Тест",
        meta=(("Референция", "ABCD1234"),),
        sections=tuple(Section(clean(hostile, 120), (Paragraph(clean(hostile)),)) for _ in range(10)),
        footer="Край",
    )
    pdf = render_pdf(document)
    assert pdf.startswith(b"%PDF-")
    assert b"<script>" not in pdf
    as_json = document.to_dict()
    assert as_json["sections"][0]["blocks"][0]["text"].startswith("<script>")  # plain text; the web escapes it


def test_generation_limits():
    huge = Paragraph("x" * 1500)
    too_much_text = ReportDocument("en", "B", "T", "S", (), tuple(Section("H", (huge,) * 10) for _ in range(6)), "F")
    assert MAX_CHARACTERS < 60 * 1500
    with pytest.raises(ReportTooLarge):
        check_limits(too_much_text)
    with pytest.raises(ReportTooLarge):
        check_limits(ReportDocument("en", "B", "T", "S", (), tuple(Section("H", ()) for _ in range(21)), "F"))


def test_every_shipped_assessment_builds_a_report_in_both_locales():
    reg = build_registry()
    now = utcnow()
    for key in reg.versions:
        definition = reg.current(key)
        answers: dict[str, Any] = {}
        for q in definition.questions:
            if not q.required:
                continue
            if q.type == "single_choice":
                answers[q.key] = q.options[0].key
            elif q.type == "multi_choice":
                answers[q.key] = [q.options[0].key]
            elif q.type == "boolean":
                answers[q.key] = False
            else:
                answers[q.key] = q.min
        answers, result = service.assess(definition, answers)
        for locale in ("bg", "en"):
            view = present_result(definition, result, locale, answers)
            document = build_document(view, locale=locale, created_at=now, expires_at=now, reference="ABCD1234")
            assert render_pdf(document).startswith(b"%PDF-"), (key, locale)


# --------------------------------------------------------------------------- optional consultation


def consultation(token: str, **overrides: Any) -> dict[str, Any]:
    body = {
        "token": token,
        "locale": "en",
        "name": "Ivana Petrova",
        "email": "Ivana@Example.com",
        "company": "Example Ltd",
        "message": "We would like to discuss the landing zone.",
        "privacy_acknowledged": True,
        "marketing_consent": False,
        "website": "",
        "form_token": valid_token(),
    }
    body.update(overrides)
    return body


def test_results_and_reports_need_no_contact_details(client):
    token = saved_token(client)
    assert client.post(f"{BASE}/results/lookup", json={"token": token}).status_code == 200
    assert client.post(f"{BASE}/results/report", json={"token": token}).status_code == 200


def test_consultation_creates_a_linked_lead_with_separate_marketing_consent(client, db, settings):
    token = saved_token(client)
    response = client.post(f"{BASE}/results/consultation", json=consultation(token))
    assert response.status_code == 201, response.text
    lead = db.scalar(select(Lead))
    assert lead.email == "ivana@example.com" and lead.source == "engineering_assessment"
    assert lead.privacy_notice_version == settings.privacy_notice_version and lead.privacy_acknowledged_at
    assert lead.marketing_consent is False and lead.marketing_consent_at is None
    assert lead.service_details["kind"] == "assessment" and lead.service_details["assessment"] == "cloud_platform"
    row = db.scalar(select(AssessmentResultRecord))
    assert row.lead_id == lead.id and row.linked_at is not None
    assert db.scalar(select(AuditLog).where(AuditLog.action == "lead.created")) is not None
    again = client.post(f"{BASE}/results/consultation", json=consultation(token))
    assert again.status_code == 409 and again.json()["code"] == "assessment_consultation_exists"


def test_marketing_consent_is_recorded_only_when_given(client, db, settings):
    token = saved_token(client)
    client.post(f"{BASE}/results/consultation", json=consultation(token, marketing_consent=True))
    lead = db.scalar(select(Lead))
    assert lead.marketing_consent is True and lead.marketing_consent_version == settings.marketing_consent_version


@pytest.mark.parametrize(
    "overrides",
    [
        {"privacy_acknowledged": False},
        {"email": "not-an-email"},
        {"name": "<b>x</b>"},
        {"company": "https://spam.example"},
        {"unexpected": "field"},
    ],
)
def test_consultation_validation(client, db, overrides):
    token = saved_token(client)
    assert client.post(f"{BASE}/results/consultation", json=consultation(token, **overrides)).status_code == 422
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_consultation_spam_controls(client, db):
    token = saved_token(client)
    honeypot = client.post(f"{BASE}/results/consultation", json=consultation(token, website="http://bot"))
    assert honeypot.status_code == 201  # no signal for bots, nothing stored
    assert db.scalar(select(func.count()).select_from(Lead)) == 0
    stale = client.post(f"{BASE}/results/consultation", json=consultation(token, form_token=""))
    assert stale.status_code == 400 and stale.json()["code"] == "form_token_invalid"
    assert client.post(f"{BASE}/results/consultation", json=consultation("y" * 43)).status_code == 404


def test_linked_results_follow_the_lead_not_the_purge(client, admin_client, db):
    token = saved_token(client)
    client.post(f"{BASE}/results/consultation", json=consultation(token))
    unlinked = saved_token(client)
    for row in db.scalars(select(AssessmentResultRecord)):
        row.expires_at = utcnow() - timedelta(days=1)
    db.commit()
    assert service.purge_expired(db).deleted == 1  # only the unlinked one
    assert client.post(f"{BASE}/results/lookup", json={"token": unlinked}).status_code == 404
    lead = db.scalar(select(Lead))
    assert admin_client.delete(f"/api/admin/leads/{lead.id}").status_code in (200, 204)
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(AssessmentResultRecord)) == 0
