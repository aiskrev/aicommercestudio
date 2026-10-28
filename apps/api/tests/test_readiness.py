"""AI readiness assessment: server scoring, anonymous PDF report, optional submission, admin access."""

from __future__ import annotations

import json
import logging
import re
from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.models import AuditLog, Lead, utcnow
from app.readiness.report import build_report
from app.readiness.scoring import MODEL_VERSION, QUESTION_ORDER, score
from app.services import leads
from tests.conftest import valid_token

VECTORS = json.loads((Path(__file__).parent / "fixtures" / "readiness_vectors.json").read_text(encoding="utf-8"))
REPORT_URL = "/api/public/readiness/report"
SUBMIT_URL = "/api/public/readiness/submissions"


def answers(level: int = 3, **overrides: int) -> dict[str, int]:
    return {**{q: level for q in QUESTION_ORDER}, **overrides}


def report_payload(**overrides) -> dict:
    payload = {
        "schema_version": "1",
        "model_version": MODEL_VERSION,
        "locale": "bg",
        "answers": answers(),
        "form_token": valid_token(),
    }
    payload.update(overrides)
    return payload


def submission_payload(**overrides) -> dict:
    payload = report_payload(
        name="Тест Потребител",
        email="Test.User@Example.com",
        company="Тестова Фирма ЕООД",
        role="Оперативен директор",
        message="",
        consultation_requested=True,
        privacy_acknowledged=True,
        marketing_consent=False,
        website="",
    )
    payload.update(overrides)
    return payload


# --- Scoring ------------------------------------------------------------------------------------


def test_golden_vectors_match_the_server_model():
    """The same file is checked by the web unit tests (scripts/test.ps1 verifies both copies match)."""
    assert VECTORS["model_version"] == MODEL_VERSION
    assert len(VECTORS["vectors"]) >= 50
    for vector in VECTORS["vectors"]:
        assert score(vector["answers"]).summary() == vector["expected"]


def test_score_rejects_incomplete_answers():
    partial = answers()
    partial.pop("data_quality")
    with pytest.raises(ValueError, match="incomplete"):
        score(partial)


def test_band_boundaries_and_blockers():
    assert score(answers(0)).band == "exploration"
    assert score(answers(4)).overall == 100
    assert score(answers(4)).band == "scaling"
    assert score(answers(4)).blockers == []
    assert score(answers(4, gov_oversight=0)).blockers == ["governance"]
    assert score(answers(2)).overall == 50 and score(answers(2)).band == "pilot_ready"


# --- Schema validation ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"answers": {**answers(), "data_quality": 5}}, "answers"),
        ({"answers": {**answers(), "data_quality": -1}}, "answers"),
        ({"answers": {**answers(), "data_quality": True}}, "answers"),
        ({"answers": {**answers(), "data_quality": "3"}}, "answers"),
        ({"answers": {k: v for k, v in answers().items() if k != "data_quality"}}, "answers"),
        ({"answers": {**answers(), "unknown_question": 2}}, "answers"),
        ({"answers": []}, "answers"),
        ({"schema_version": "2"}, "schema_version"),
        ({"locale": "de"}, "locale"),
        ({"client_overall": 101}, "client_overall"),
        ({"company": "x" * 121}, "company"),
        ({"extra_field": "nope"}, "extra_field"),
    ],
)
def test_report_rejects_invalid_payloads(client, overrides, field):
    response = client.post(REPORT_URL, json=report_payload(**overrides))
    assert response.status_code == 422, response.text
    assert field in json.dumps(response.json())


def test_stale_model_version_is_rejected_with_a_reload_hint(client):
    response = client.post(REPORT_URL, json=report_payload(model_version="2025-01.1"))
    assert response.status_code == 422
    body = response.json()
    assert "readiness_model" in json.dumps(body)


def test_english_validation_messages(client):
    response = client.post(
        REPORT_URL,
        json=report_payload(locale="en", answers={**answers(), "data_quality": 9}),
        headers={"Accept-Language": "en"},
    )
    assert response.status_code == 422
    assert "assessment answers are incomplete or invalid" in json.dumps(response.json())


# --- Meta -------------------------------------------------------------------------------------------


def test_meta_reports_versions_and_no_email_delivery(client, settings):
    response = client.get("/api/public/readiness/meta")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["model_version"] == MODEL_VERSION
    assert body["schema_version"] == "1"
    assert body["privacy_notice_version"] == settings.privacy_notice_version
    assert body["marketing_consent_version"] == settings.marketing_consent_version
    assert body["email_delivery"] is False
    assert body["retention_days"] == min(settings.readiness_retention_days, settings.lead_retention_days)


# --- PDF report -------------------------------------------------------------------------------------


@pytest.mark.parametrize("locale", ["bg", "en"])
def test_report_returns_a_pdf_and_stores_nothing(client, db, locale):
    response = client.post(REPORT_URL, json=report_payload(locale=locale, company="Тест & Син"))
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "attachment" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")
    assert response.content.rstrip().endswith(b"%%EOF")
    assert len(response.content) > 5_000
    assert db.scalar(select(func.count()).select_from(Lead)) == 0
    assert db.scalar(select(func.count()).select_from(AuditLog)) == 0


def test_report_company_rejects_html(client):
    response = client.post(REPORT_URL, json=report_payload(company="<b>Фирма</b>"))
    assert response.status_code == 422
    assert response.json()["errors"][0]["type"] == "no_links"


def test_report_filename_follows_locale(client):
    bg = client.post(REPORT_URL, json=report_payload(locale="bg"))
    en = client.post(REPORT_URL, json=report_payload(locale="en"))
    assert "ai-gotovnost-otchet.pdf" in bg.headers["content-disposition"]
    assert "ai-readiness-report.pdf" in en.headers["content-disposition"]


@pytest.mark.parametrize("level", [0, 1, 2, 3, 4])
def test_build_report_renders_every_band(level):
    result = score(answers(level))
    for locale in ("bg", "en"):
        pdf = build_report(result, locale, company=None)
        assert pdf.startswith(b"%PDF-")
    # Cover, results, roadmap and methodology do not fit on one page.
    assert len(re.findall(rb"/Type /Page(?!s)", build_report(score(answers(0)), "en"))) >= 2


def test_report_requires_a_valid_form_token(client):
    for token in ("", "garbage", valid_token(age_seconds=0)):
        response = client.post(REPORT_URL, json=report_payload(form_token=token))
        assert response.status_code == 400
        assert response.json()["code"] == "form_token_invalid"


def test_report_is_rate_limited_per_client(client, settings):
    for _ in range(settings.readiness_report_rate_limit):
        assert client.post(REPORT_URL, json=report_payload()).status_code == 200
    response = client.post(REPORT_URL, json=report_payload())
    assert response.status_code == 429
    # Invalid requests count too: rendering is the expensive part, validation is cheap but abusable.
    assert client.post(REPORT_URL, json={}).status_code == 429


def test_client_score_mismatch_is_logged_without_answers(client, caplog):
    caplog.set_level(logging.INFO)
    response = client.post(REPORT_URL, json=report_payload(client_overall=12, company="Секретна Фирма"))
    assert response.status_code == 200
    records = [r for r in caplog.records if r.name.startswith("app.")]
    mismatch = [r for r in records if r.getMessage() == "readiness_score_mismatch"]
    assert mismatch and mismatch[0].client == 12 and mismatch[0].server == score(answers()).overall
    dumped = json.dumps([r.__dict__ for r in records], default=str, ensure_ascii=False)
    assert "Секретна Фирма" not in dumped
    assert "data_quality" not in dumped


# --- Submissions --------------------------------------------------------------------------------------


def test_submission_creates_a_readiness_lead_with_the_server_result(client, db, settings):
    response = client.post(SUBMIT_URL, json=submission_payload(client_overall=1))
    assert response.status_code == 201, response.text
    body = response.json()
    expected = score(answers())
    assert body["overall"] == expected.overall and body["band"] == expected.band
    assert body["reference"]
    assert "имейл" not in body["message"].lower() and "email" not in body["message"].lower()

    lead = db.scalar(select(Lead))
    assert lead.source == leads.READINESS_SOURCE
    assert lead.service == "audit"
    assert lead.email == "test.user@example.com"
    assert lead.reference == body["reference"]
    assert lead.privacy_acknowledged_at is not None
    assert lead.privacy_notice_version == settings.privacy_notice_version
    details = lead.service_details
    assert details["kind"] == "readiness"
    assert details["model_version"] == MODEL_VERSION
    assert details["schema_version"] == "1"
    assert details["answers"] == answers()
    assert details["result"] == expected.summary()  # never the browser's number
    assert details["consultation_requested"] is True
    assert "/100" in lead.message

    created = db.scalar(select(AuditLog).where(AuditLog.action == "lead.created"))
    assert created.details["source"] == leads.READINESS_SOURCE
    dumped = json.dumps(created.details, ensure_ascii=False)
    assert "test.user@example.com" not in dumped and "Тест Потребител" not in dumped


def test_marketing_consent_is_separate_and_versioned(client, db, settings):
    assert client.post(SUBMIT_URL, json=submission_payload(email="no@example.com")).status_code == 201
    assert (
        client.post(SUBMIT_URL, json=submission_payload(email="yes@example.com", marketing_consent=True)).status_code
        == 201
    )
    without = db.scalar(select(Lead).where(Lead.email == "no@example.com"))
    with_consent = db.scalar(select(Lead).where(Lead.email == "yes@example.com"))
    assert without.marketing_consent is False
    assert without.marketing_consent_at is None and without.marketing_consent_version is None
    assert with_consent.marketing_consent is True
    assert with_consent.marketing_consent_at is not None
    assert with_consent.marketing_consent_version == settings.marketing_consent_version


def test_contact_form_records_the_marketing_consent_version(client, db, make_lead, settings):
    make_lead(email="contact@example.com", marketing_consent=True)
    lead = db.scalar(select(Lead))
    assert lead.marketing_consent_version == settings.marketing_consent_version


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"privacy_acknowledged": False}, "privacy_acknowledged"),
        ({"email": "not-an-email"}, "email"),
        ({"name": "A"}, "name"),
        ({"company": ""}, "company"),
        ({"role": ""}, "role"),
        ({"message": "x" * 1001}, "message"),
        ({"consultation_requested": "maybe"}, "consultation_requested"),
        ({"answers": {**answers(), "people_change": 7}}, "answers"),
    ],
)
def test_submission_validation(client, db, overrides, field):
    response = client.post(SUBMIT_URL, json=submission_payload(**overrides))
    assert response.status_code == 422, response.text
    assert field in json.dumps(response.json())
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_submission_message_rejects_link_spam(client, db):
    message = " ".join(f"https://spam{i}.example.com" for i in range(5))
    response = client.post(SUBMIT_URL, json=submission_payload(message=message))
    assert response.status_code in (400, 422)
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_honeypot_pretends_success_and_stores_nothing(client, db):
    response = client.post(SUBMIT_URL, json=submission_payload(website="http://bot.example"))
    assert response.status_code == 201
    assert response.json()["reference"]
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_submission_requires_a_valid_form_token(client, db):
    response = client.post(SUBMIT_URL, json=submission_payload(form_token=valid_token(age_seconds=0)))
    assert response.status_code == 400
    assert response.json()["code"] == "form_token_invalid"
    assert db.scalar(select(func.count()).select_from(Lead)) == 0


def test_submissions_share_the_contact_rate_limit(client, settings):
    for i in range(settings.contact_rate_limit):
        assert client.post(SUBMIT_URL, json=submission_payload(email=f"u{i}@example.com")).status_code == 201
    assert client.post(SUBMIT_URL, json=submission_payload(email="late@example.com")).status_code == 429


def test_submission_logs_carry_no_personal_data(client, caplog):
    caplog.set_level(logging.INFO)
    payload = submission_payload(
        name="Мария Тайнова", email="maria.secret@example.com", message="Поверителен проект Орион"
    )
    assert client.post(SUBMIT_URL, json=payload).status_code == 201
    records = [r for r in caplog.records if r.name.startswith("app.")]
    assert any(r.getMessage() == "readiness_submission_created" for r in records)
    dumped = json.dumps([r.__dict__ for r in records], default=str, ensure_ascii=False)
    for secret in ("Мария Тайнова", "maria.secret@example.com", "Поверителен проект Орион", "Тестова Фирма"):
        assert secret not in dumped


# --- Admin --------------------------------------------------------------------------------------------


def _submit(client) -> str:
    response = client.post(SUBMIT_URL, json=submission_payload())
    assert response.status_code == 201, response.text
    return response.json()["reference"]


def _lead_id(db, reference: str) -> str:
    # `reference` is derived from the id (first 8 hex digits), not a column.
    (lead_id,) = [lead.id for lead in db.scalars(select(Lead)) if lead.reference == reference]
    return str(lead_id)


def test_admin_readiness_report_requires_login(client, db):
    lead_id = _lead_id(db, _submit(client))
    response = client.get(f"/api/admin/leads/{lead_id}/readiness-report")
    assert response.status_code == 401
    assert client.get(f"/api/admin/leads/{lead_id}").status_code == 401


def test_admin_sees_readiness_details_and_downloads_the_report(admin_client, db):
    reference = _submit(admin_client)
    lead_id = _lead_id(db, reference)

    detail = admin_client.get(f"/api/admin/leads/{lead_id}")
    assert detail.status_code == 200, detail.text
    readiness = detail.json()["readiness"]
    expected = score(answers())
    assert readiness["overall"] == expected.overall
    assert readiness["band"] == expected.band
    assert readiness["dimensions"] == expected.dimensions
    assert readiness["consultation_requested"] is True
    assert readiness["role"] == "Оперативен директор"

    pdf = admin_client.get(f"/api/admin/leads/{lead_id}/readiness-report")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.headers["cache-control"] == "no-store"
    assert f"readiness-{reference}.pdf" in pdf.headers["content-disposition"]
    assert pdf.content.startswith(b"%PDF-")
    db.expire_all()
    audit_entry = db.scalar(select(AuditLog).where(AuditLog.action == "lead.readiness_report_downloaded"))
    assert audit_entry is not None and audit_entry.entity_id == lead_id


def test_admin_readiness_report_is_404_for_other_leads(admin_client, make_lead, db):
    make_lead()
    lead = db.scalar(select(Lead))
    assert admin_client.get(f"/api/admin/leads/{lead.id}").json()["readiness"] is None
    response = admin_client.get(f"/api/admin/leads/{lead.id}/readiness-report")
    assert response.status_code == 404


# --- Retention ----------------------------------------------------------------------------------------


def test_readiness_leads_have_their_own_shorter_retention(client, make_lead, db):
    _submit(client)
    make_lead(email="contact@example.com")
    for lead in db.scalars(select(Lead)):
        lead.updated_at = utcnow() - timedelta(days=400)
    db.commit()

    preview = leads.retention_preview(db, 730, 1095, readiness_retention_days=365)
    assert preview.leads_due == 1
    result = leads.purge_expired(db, lead_retention_days=730, audit_retention_days=1095, readiness_retention_days=365)
    assert result.leads_deleted == 1
    assert [lead.email for lead in db.scalars(select(Lead))] == ["contact@example.com"]


# --- Model 2026-11.1 ---------------------------------------------------------------------------


def test_six_requested_dimensions_and_weights():
    from app.readiness.scoring import DIMENSIONS, QUESTIONS, WEIGHTS

    assert DIMENSIONS == ("strategy", "infrastructure", "data", "governance", "talent", "organization")
    assert sum(WEIGHTS.values()) == 100
    assert all(len(QUESTIONS[d]) == 2 for d in DIMENSIONS) and len(QUESTION_ORDER) == 12


def test_vectors_cover_every_band_threshold_from_both_sides():
    bands = {v["expected"]["overall"]: v["expected"]["band"] for v in VECTORS["vectors"]}
    expected = {0: "exploration", 24: "exploration", 25: "foundation", 49: "foundation", 50: "pilot_ready",
                74: "pilot_ready", 75: "scaling", 100: "scaling"}
    for overall, band in expected.items():
        assert bands.get(overall) == band, overall


def test_expertise_blocker_and_its_action():
    result = score(answers(4, talent_support=0))
    assert result.blockers == ["expertise"]
    assert result.actions[0] == "expertise_first"
    assert result.roadmap["d30"][0] == "expertise_first"


def test_answers_of_the_previous_question_set_are_rejected(client):
    old = {k: v for k, v in answers().items() if not k.startswith("talent_")}
    old.update(process_definition=3, process_repeatability=3)
    response = client.post(REPORT_URL, json=report_payload(answers=old))
    assert response.status_code == 422
    stale = client.post(REPORT_URL, json=report_payload(model_version="2026-10.2"))
    assert stale.status_code == 422


def test_admin_pdf_of_a_submission_scored_with_the_previous_model(admin_client, db):
    """Leads stored before 2026-11.1 keep their dimensions, actions and weights in the PDF."""
    lead_id = _lead_id(db, _submit(admin_client))
    lead = db.get(Lead, lead_id)
    lead.service_details = {
        **lead.service_details,
        "model_version": "2026-10.2",
        "result": {
            "overall": 42,
            "band": "foundation",
            "dimensions": {"strategy": 50, "data": 25, "process": 50, "technology": 38, "people": 50, "governance": 50},
            "blockers": ["data_quality"],
            "strengths": [],
            "gaps": ["data", "technology"],
            "actions": ["data_quality_first", "process_mapping", "foundation_plan"],
            "use_cases": ["process_discovery"],
            "roadmap": {
                "d30": ["data_quality_first", "foundation_d30"],
                "d60": ["foundation_d60"],
                "d90": ["foundation_d90"],
            },
        },
    }
    db.commit()
    detail = admin_client.get(f"/api/admin/leads/{lead_id}").json()["readiness"]
    assert detail["model_version"] == "2026-10.2" and "process" in detail["dimensions"]
    pdf = admin_client.get(f"/api/admin/leads/{lead_id}/readiness-report")
    assert pdf.status_code == 200, pdf.text
    assert pdf.content.startswith(b"%PDF-")


def test_report_texts_cover_the_new_model_in_both_languages():
    from app.readiness.scoring import ACTION_SERVICE, DIMENSIONS
    from app.readiness.texts import TEXTS

    for locale in ("bg", "en"):
        texts = TEXTS[locale]
        assert set(DIMENSIONS) <= set(texts["dimension_names"])
        assert set(ACTION_SERVICE) <= set(texts["actions_texts"])
        assert {"governance", "data_quality", "integration", "expertise", "organisation"} <= set(texts["blocker_texts"])
        joined = " ".join(texts["methodology_paragraphs"]).lower()
        assert ("самооценка" if locale == "bg" else "self-assessment") in joined
        assert ("бенчмарк" not in joined) and ("benchmark" not in joined)
