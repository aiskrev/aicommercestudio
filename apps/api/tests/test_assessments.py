"""Assessment engine: definitions, deterministic scoring, rules, extensions, API, persistence, retention."""

from __future__ import annotations

import json
import re
import shutil
from datetime import timedelta
from fractions import Fraction
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.assessments import service
from app.assessments.answers import validate_answers
from app.assessments.definition import AssessmentDefinition
from app.assessments.presenter import present_result, public_definition
from app.assessments.registry import DEFINITIONS_DIR, build_registry, load_definition, registry
from app.assessments.scoring import round_half_up, score
from app.models import AssessmentResultRecord, utcnow
from app.readiness import scoring as readiness

FIXTURES = Path(__file__).resolve().parent / "fixtures"
CYRILLIC = re.compile(r"[Ѐ-ӿ]")

DEVOPS_MAX = {
    "ci_pipeline": "ci_every_change",
    "automated_tests": 4,
    "deploy_method": "pipeline_auto",
    "deploy_frequency": 40,
    "environments": ["development", "staging", "preview_per_change"],
    "change_review": True,
    "rollback": "automated",
    "recovery_time": "under_hour",
}
DEVOPS_MIN = {
    "ci_pipeline": "none",
    "automated_tests": 0,
    "deploy_method": "manual",
    "deploy_frequency": 0,
    "environments": [],
    "change_review": False,
    "rollback": "none",
    "recovery_time": "days",
}
OBSERVABILITY = {
    "telemetry": ["logs", "metrics"],
    "log_retention_days": 30,
    "alert_routing": "chat",
    "actionable_alerts": 2,
    "incident_process": "documented",
    "postmortems": True,
    "slos": "informal",
}


def _texts(definition: dict[str, Any], locale: str) -> dict[str, Any]:
    """Complete texts for a test definition (ASCII, so they are valid for both locales)."""
    titled = {"title": "Title", "description": "Description text"}
    return {
        "title": f"Test assessment {locale}",
        "intro": "An introduction to the test assessment.",
        "disclaimer": "A disclaimer for the test assessment.",
        "dimensions": {d["key"]: titled for d in definition["dimensions"]},
        "bands": {b["key"]: titled for b in definition["bands"]},
        "recommendations": {r["recommendation"]: titled for r in definition.get("rules", [])},
        "questions": {
            q["key"]: {"text": "Question text", "options": {o["key"]: "Option" for o in q.get("options", [])}}
            for q in definition["questions"]
        },
    }


def make_definition(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "key": "test_assessment",
        "version": "1.0.0",
        "status": "preview",
        "scoring": {"algorithm": "weighted-mean/1", "max_recommendations": 2},
        "dimensions": [{"key": "alpha", "weight": 1}],
        "questions": [
            {"key": "q_scale", "type": "scale", "dimension": "alpha", "min": 0, "max": 4},
            {"key": "q_bool", "type": "boolean", "dimension": "alpha", "points_true": 1, "points_false": 0},
        ],
        "bands": [{"key": "low", "min": 0}, {"key": "mid", "min": 25}, {"key": "high", "min": 50}],
        "rules": [],
    }
    data.update(overrides)
    data["texts"] = {"bg": _texts(data, "bg"), "en": _texts(data, "en")}
    return data


def build(**overrides: Any) -> AssessmentDefinition:
    return AssessmentDefinition.model_validate(make_definition(**overrides))


def assessed(definition: AssessmentDefinition, answers: dict[str, Any]):
    return service.assess(definition, answers)[1]


@pytest.fixture(autouse=True)
def legacy_registry(tmp_path_factory, monkeypatch):
    """The engine tests here were written against devops_delivery 1.0.0 and observability 1.0.0.

    devops_delivery 1.1.0 (tests/test_assessments_v2.py) is now current; pinning a registry with only
    the 1.0.0 files keeps these tests about the engine itself, unchanged.
    """
    folder = tmp_path_factory.mktemp("legacy")
    for key in ("devops_delivery", "observability_reliability"):
        (folder / key).mkdir()
        shutil.copy(DEFINITIONS_DIR / key / "1.0.0.json", folder / key / "1.0.0.json")
    legacy = build_registry(folder)
    monkeypatch.setattr("app.assessments.service.registry", lambda: legacy)
    monkeypatch.setattr("app.routers.assessments.registry", lambda: legacy)
    monkeypatch.setitem(globals(), "registry", lambda: legacy)
    return legacy


# --------------------------------------------------------------------------- definitions


def test_shipped_definitions_load_and_validate():
    reg = build_registry()
    assert reg.keys() == ["cloud_platform", "devops_delivery", "observability_reliability"]
    current = {key: (reg.current(key).version, reg.current(key).status) for key in reg.versions}
    assert current == {
        "cloud_platform": ("1.0.0", "live"),
        "devops_delivery": ("1.1.0", "live"),
        "observability_reliability": ("1.1.0", "live"),
    }
    # The superseded version stays, so results saved with it still re-render.
    assert reg.get("devops_delivery", "1.0.0") is not None
    assert reg.get("observability_reliability", "1.0.0") is not None
    for key in reg.versions:
        assert not CYRILLIC.search(reg.current(key).texts["en"].model_dump_json())
    assert reg.current("observability_reliability").extension == "observability_signals"
    assert reg.current("devops_delivery").extension == "devops_evidence"


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"dimensions": [{"key": "alpha", "weight": 0}]}, "greater than or equal to 1"),
        ({"dimensions": [{"key": "alpha", "weight": -5}]}, "greater than or equal to 1"),
        (
            {"dimensions": [{"key": "alpha", "weight": 1}, {"key": "beta", "weight": 1}]},
            "dimension beta has no question",
        ),
        ({"bands": [{"key": "low", "min": 10}, {"key": "high", "min": 50}]}, "bands must start at 0"),
        ({"bands": [{"key": "low", "min": 0}, {"key": "high", "min": 0}]}, "strictly increasing"),
        ({"scoring": {"algorithm": "weighted-mean/9"}}, "weighted-mean/1"),
        (
            {
                "rules": [
                    {
                        "key": "r",
                        "priority": 1,
                        "when": {"kind": "dimension_below", "dimension": "nope", "value": 5},
                        "recommendation": "x",
                    }
                ]
            },
            "unknown dimension nope",
        ),
        (
            {
                "rules": [
                    {
                        "key": "r",
                        "priority": 1,
                        "when": {"kind": "answer_in", "question": "q_scale", "options": ["a"]},
                        "recommendation": "x",
                    }
                ]
            },
            "answer_in needs a choice question",
        ),
        (
            {"rules": [{"key": "r", "priority": 1, "when": {"kind": "eval", "code": "1+1"}, "recommendation": "x"}]},
            "does not match any of the expected tags",
        ),
        (
            {"questions": [{"key": "q", "type": "scale", "dimension": "alpha", "min": 0, "max": 4, "points": 99}]},
            "Extra inputs are not permitted",
        ),
    ],
)
def test_invalid_definitions_are_rejected(change, message):
    with pytest.raises(ValidationError, match=re.escape(message)):
        AssessmentDefinition.model_validate(make_definition(**change))


def test_definition_texts_must_cover_both_locales_and_every_key():
    data = make_definition()
    del data["texts"]["en"]
    with pytest.raises(ValidationError, match="texts missing for locale en"):
        AssessmentDefinition.model_validate(data)
    data = make_definition()
    data["texts"]["en"]["title"] = "Тест на кирилица"
    with pytest.raises(ValidationError, match="Cyrillic"):
        AssessmentDefinition.model_validate(data)
    data = make_definition()
    data["texts"]["bg"]["questions"].pop("q_bool")
    with pytest.raises(ValidationError, match="question texts do not match"):
        AssessmentDefinition.model_validate(data)


def test_definition_file_must_match_its_location_and_extensions_must_exist(tmp_path):
    folder = tmp_path / "test_assessment"
    folder.mkdir()
    (folder / "2.0.0.json").write_text(json.dumps(make_definition()), encoding="utf-8")
    with pytest.raises(ValueError, match="does not match"):
        load_definition(folder / "2.0.0.json")
    (folder / "2.0.0.json").unlink()
    (folder / "1.0.0.json").write_text(json.dumps(make_definition(extension="not_registered")), encoding="utf-8")
    with pytest.raises(ValueError, match="unknown extension"):
        load_definition(folder / "1.0.0.json")


# --------------------------------------------------------------------------- scoring


def test_boundary_scores_and_bands():
    devops = registry().current("devops_delivery")
    top = assessed(devops, DEVOPS_MAX)
    assert (top.overall, top.band) == (100, "advanced")
    assert set(top.dimensions.values()) == {100}
    bottom = assessed(devops, DEVOPS_MIN)
    assert (bottom.overall, bottom.band) == (0, "initial")

    definition = build()
    # scale 1/4 and boolean false → (1/4 + 0) / 2 = 12.5 % → rounded half up to 13 (banker's rounding gives 12)
    assert assessed(definition, {"q_scale": 1, "q_bool": False}).overall == 13
    # exactly on a band minimum: (2/4 + 0) / 2 = 25 → "mid"; just below → "low"
    on_edge = assessed(definition, {"q_scale": 2, "q_bool": False})
    assert (on_edge.overall, on_edge.band) == (25, "mid")
    assert assessed(definition, {"q_scale": 1, "q_bool": False}).band == "low"
    assert round_half_up(Fraction(49, 2)) == 25 and round_half_up(Fraction(-1, 2)) == 0


def test_weighted_dimensions_use_exact_arithmetic():
    devops = registry().current("devops_delivery")
    answers = dict(DEVOPS_MIN, automated_tests=3, deploy_frequency=4, environments=["staging"])
    result = assessed(devops, answers)
    # build_test: (1×0 + 2×3/4) / 3 = 1/2 → 50; release: (0 + 2/4 + 1/3) / 3 = 5/18 → 27.78 → 28
    assert result.dimensions["build_test"] == 50
    assert result.dimensions["release"] == 28
    # overall = (30×1/2 + 30×5/18 + 0 + 0) / 100 = 23.33… → 23
    assert result.overall == 23


def test_scoring_is_deterministic_and_order_independent():
    devops = registry().current("devops_delivery")
    shuffled = dict(reversed(list(DEVOPS_MAX.items())))
    shuffled["environments"] = list(reversed(DEVOPS_MAX["environments"]))
    a, b = assessed(devops, DEVOPS_MAX), assessed(devops, shuffled)
    assert a == b
    assert re.fullmatch(r"[0-9a-f]{16}", a.fingerprint)
    assert assessed(devops, DEVOPS_MIN).fingerprint != a.fingerprint


def test_missing_and_invalid_answers_are_reported_per_question():
    devops = registry().current("devops_delivery")
    _, errors = validate_answers(devops, {})
    assert {e.code for e in errors} == {"missing_required"}
    assert "recovery_time" not in {e.question for e in errors}  # optional

    bad = dict(
        DEVOPS_MAX,
        ci_pipeline="nope",
        automated_tests=True,  # a bool is not a scale value
        deploy_frequency=2.5,  # an integer question
        environments=["staging", "staging"],
        change_review="yes",
        weights={"build_test": 100},  # tampering: weights are not answers
    )
    _, errors = validate_answers(devops, bad)
    assert {(e.question, e.code) for e in errors} == {
        ("ci_pipeline", "invalid_option"),
        ("automated_tests", "invalid_type"),
        ("deploy_frequency", "invalid_type"),
        ("environments", "duplicate_selection"),
        ("change_review", "invalid_type"),
        ("weights", "unknown_question"),
    }
    _, errors = validate_answers(devops, dict(DEVOPS_MAX, deploy_frequency=5000, automated_tests=9))
    assert {(e.question, e.code) for e in errors} == {
        ("deploy_frequency", "out_of_range"),
        ("automated_tests", "out_of_range"),
    }
    _, errors = validate_answers(devops, dict(DEVOPS_MAX, deploy_frequency=float("nan")))
    assert errors[0].code == "invalid_type"
    obs = registry().current("observability_reliability")
    _, errors = validate_answers(
        obs, dict(OBSERVABILITY, telemetry=["logs", "metrics", "traces", "error_tracking", "logs"])
    )
    assert errors[0].code == "duplicate_selection"


def test_optional_unanswered_question_is_excluded_and_can_trigger_a_rule():
    devops = registry().current("devops_delivery")
    answers = {k: v for k, v in DEVOPS_MAX.items() if k != "recovery_time"}
    result = assessed(devops, answers)
    assert result.answered == 7 and result.questions == 8
    assert result.dimensions["recovery"] == 100  # only the answered rollback question counts
    assert "measure_recovery" in result.recommendations


def test_rules_follow_priority_without_duplicates_and_respect_the_limit():
    devops = registry().current("devops_delivery")
    result = assessed(devops, DEVOPS_MIN)
    # priority 1, then the two priority-2 rules by rule key, then priority 3; capped at 4
    assert result.recommendations == [
        "automate_build_and_tests",
        "pipeline_deployments",
        "rollback_plan",
        "require_reviews",
    ]
    assert assessed(devops, DEVOPS_MAX).recommendations == ["optimise_flow"]

    definition = build(
        rules=[
            {
                "key": "a",
                "priority": 1,
                "when": {
                    "kind": "any",
                    "conditions": [{"kind": "overall_below", "value": 0}, {"kind": "band_in", "bands": ["low"]}],
                },
                "recommendation": "first",
            },
            {
                "key": "b",
                "priority": 2,
                "when": {
                    "kind": "all",
                    "conditions": [
                        {"kind": "overall_at_least", "value": 0},
                        {"kind": "dimension_below", "dimension": "alpha", "value": 50},
                    ],
                },
                "recommendation": "first",
            },
            {
                "key": "c",
                "priority": 3,
                "when": {"kind": "dimension_at_least", "dimension": "alpha", "value": 0},
                "recommendation": "second",
            },
        ]
    )
    assert assessed(definition, {"q_scale": 0, "q_bool": False}).recommendations == ["first", "second"]


def test_extension_validates_across_questions_and_derives_extras():
    obs = registry().current("observability_reliability")
    result = assessed(obs, OBSERVABILITY)
    assert result.extras == {"missing_signals": ["traces"]}
    with pytest.raises(service.InvalidAnswers) as exc:
        service.assess(obs, dict(OBSERVABILITY, telemetry=[], alert_routing="on_call_rotation"))
    assert [(e.question, e.code) for e in exc.value.errors] == [("alert_routing", "inconsistent")]


def test_engine_reproduces_the_readiness_golden_vectors():
    """The readiness model expressed as a definition gives the same overall, band and dimension scores."""
    data = make_definition(
        key="readiness_parity",
        dimensions=[{"key": d, "weight": int(readiness.WEIGHTS[d])} for d in readiness.DIMENSIONS],
        questions=[
            {"key": q, "type": "scale", "dimension": d, "min": 0, "max": readiness.MAX_ANSWER}
            for d in readiness.DIMENSIONS
            for q in readiness.QUESTIONS[d]
        ],
        bands=[{"key": band, "min": minimum} for band, minimum in reversed(readiness.BAND_THRESHOLDS)],
    )
    definition = AssessmentDefinition.model_validate(data)
    vectors = json.loads((FIXTURES / "readiness_vectors.json").read_text(encoding="utf-8"))["vectors"]
    assert len(vectors) >= 5
    for vector in vectors:
        result = score(definition, vector["answers"])
        expected = vector["expected"]
        assert (result.overall, result.band, result.dimensions) == (
            expected["overall"],
            expected["band"],
            expected["dimensions"],
        )


def test_localized_views_hide_points_and_weights():
    obs = registry().current("observability_reliability")
    for locale in ("bg", "en"):
        view = public_definition(obs, locale)
        text = json.dumps(view, ensure_ascii=False)
        assert '"points"' not in text and '"weight"' not in text and '"cap"' not in text
        assert len(view["questions"]) == 8
        result = present_result(obs, assessed(obs, OBSERVABILITY), locale)
        assert result["band"]["title"] and result["recommendations"]
        if locale == "en":
            assert not CYRILLIC.search(json.dumps(result))


# --------------------------------------------------------------------------- API


def _score(client, key="devops_delivery", answers=None, **extra):
    body = {
        "schema_version": "1",
        "definition_version": "1.0.0",
        "locale": "en",
        "answers": answers or DEVOPS_MAX,
        **extra,
    }
    return client.post(f"/api/public/assessments/{key}/score", json=body)


def test_api_lists_and_serves_definitions_without_scoring_internals(client):
    listing = client.get("/api/public/assessments", params={"locale": "en"}).json()
    assert [item["key"] for item in listing["items"]] == ["devops_delivery", "observability_reliability"]
    definition = client.get("/api/public/assessments/devops_delivery", params={"locale": "bg"})
    assert definition.status_code == 200
    assert definition.headers["cache-control"] == "no-store"
    body = definition.json()
    assert body["title"] == "Зрелост на DevOps доставката"
    assert "points" not in definition.text and "weight" not in definition.text
    assert client.get("/api/public/assessments/unknown").json()["code"] == "assessment_not_found"


def test_preview_definitions_are_hidden_unless_enabled(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "assessments_preview_enabled", False)
    assert client.get("/api/public/assessments").json()["items"] == []
    assert client.get("/api/public/assessments/devops_delivery").status_code == 404
    assert _score(client).status_code == 404


def test_anonymous_score_needs_no_personal_data_and_stores_nothing(client, db):
    response = _score(client)
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["overall"], body["band"]["key"], body["saved"]) == (100, "advanced", None)
    assert body["recommendations"][0]["key"] == "optimise_flow"
    assert db.scalar(select(func.count()).select_from(AssessmentResultRecord)) == 0


def test_api_rejects_tampering_and_invalid_payloads(client):
    tampered = _score(client, weights={"build_test": 100})
    assert tampered.status_code == 422  # unknown top-level field
    in_answers = _score(client, answers=dict(DEVOPS_MAX, score=100))
    assert in_answers.status_code == 422
    assert in_answers.json()["code"] == "assessment_invalid_answers"
    assert {"field": "answers.score", "type": "unknown_question"}.items() <= in_answers.json()["errors"][0].items()
    missing = _score(client, answers={"ci_pipeline": "none"})
    assert {e["type"] for e in missing.json()["errors"]} == {"missing_required"}
    assert _score(client, answers={f"q{i}": 1 for i in range(61)}).status_code == 422
    assert _score(client, answers=dict(DEVOPS_MAX, ci_pipeline={"$gt": ""})).status_code == 422
    inconsistent = _score(
        client,
        key="observability_reliability",
        answers=dict(OBSERVABILITY, telemetry=[], alert_routing="on_call_rotation"),
    )
    assert inconsistent.json()["errors"][0]["type"] == "inconsistent"


def test_outdated_definition_version_is_refused_with_the_current_version(client):
    response = _score(client, definition_version="0.9.0")
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "assessment_version_outdated"
    assert body["errors"][0]["message"] == "1.0.0"
    assert _score(client, definition_version="latest").status_code == 422


def test_opt_in_save_lookup_and_delete(client, db):
    saved = _score(client, key="observability_reliability", answers=OBSERVABILITY, save=True)
    assert saved.status_code == 200, saved.text
    meta = saved.json()["saved"]
    token = meta["token"]
    assert len(token) >= 40 and re.fullmatch(r"[0-9A-F]{8}", meta["reference"])

    row = db.scalar(select(AssessmentResultRecord))
    assert row.token_hash == service.hash_token(token) and token not in json.dumps(row.answers)
    assert row.answers == {**OBSERVABILITY}
    assert (row.assessment_key, row.definition_version, row.algorithm) == (
        "observability_reliability",
        "1.0.0",
        "weighted-mean/1",
    )
    assert row.expires_at - row.created_at == timedelta(days=90)

    looked_up = client.post("/api/public/assessments/results/lookup", params={"locale": "bg"}, json={"token": token})
    assert looked_up.status_code == 200
    body = looked_up.json()
    assert body["saved"]["token"] is None and body["saved"]["reference"] == meta["reference"]
    assert body["overall"] == saved.json()["overall"] and body["locale"] == "bg"
    assert body["extras"] == {"missing_signals": ["traces"]}

    wrong = client.post("/api/public/assessments/results/lookup", json={"token": "x" * 43})
    assert wrong.status_code == 404 and wrong.json()["code"] == "assessment_result_not_found"
    assert client.post("/api/public/assessments/results/delete", json={"token": token}).status_code == 204
    assert client.post("/api/public/assessments/results/lookup", json={"token": token}).status_code == 404
    assert client.post("/api/public/assessments/results/delete", json={"token": token}).status_code == 204  # idempotent
    assert db.scalar(select(func.count()).select_from(AssessmentResultRecord)) == 0


def test_tampered_stored_result_is_not_served(client, db):
    token = _score(client, save=True).json()["saved"]["token"]
    row = db.scalar(select(AssessmentResultRecord))
    row.result = {**row.result, "overall": 42}
    db.commit()
    assert client.post("/api/public/assessments/results/lookup", json={"token": token}).status_code == 404


def test_saved_results_are_rescored_with_their_own_definition_version(client, db, tmp_path, monkeypatch):
    token = _score(client, save=True).json()["saved"]["token"]
    # A newer version with different weights becomes current; the saved 1.0.0 result must not change.
    folder = tmp_path / "devops_delivery"
    folder.mkdir()
    original = json.loads((DEFINITIONS_DIR / "devops_delivery" / "1.0.0.json").read_text(encoding="utf-8"))
    (folder / "1.0.0.json").write_text(json.dumps(original), encoding="utf-8")
    newer = dict(original, version="1.10.0", dimensions=[dict(d, weight=1) for d in original["dimensions"]])
    (folder / "1.10.0.json").write_text(json.dumps(newer), encoding="utf-8")
    newer_registry = build_registry(tmp_path)
    assert newer_registry.current("devops_delivery").version == "1.10.0"  # semantic, not lexical, ordering
    monkeypatch.setattr("app.assessments.service.registry", lambda: newer_registry)
    monkeypatch.setattr("app.routers.assessments.registry", lambda: newer_registry)

    lookup = client.post("/api/public/assessments/results/lookup", json={"token": token}).json()
    assert (lookup["definition_version"], lookup["overall"]) == ("1.0.0", 100)
    assert _score(client).json()["code"] == "assessment_version_outdated"


def test_expired_results_are_unreachable_and_purged(client, db):
    token = _score(client, save=True).json()["saved"]["token"]
    _score(client, key="observability_reliability", answers=OBSERVABILITY, save=True)
    row = db.scalar(
        select(AssessmentResultRecord).where(AssessmentResultRecord.token_hash == service.hash_token(token))
    )
    row.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.post("/api/public/assessments/results/lookup", json={"token": token}).status_code == 404
    assert service.purge_expired(db, dry_run=True) == service.AssessmentRetention(due=1, deleted=0)
    assert service.purge_expired(db) == service.AssessmentRetention(due=1, deleted=1)
    assert db.scalar(select(func.count()).select_from(AssessmentResultRecord)) == 1
    later = service.purge_expired(db, now=utcnow() + timedelta(days=91))
    assert later.deleted == 1


def test_requests_are_rate_limited(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "assessment_rate_limit", 3)
    statuses = [_score(client).status_code for _ in range(4)]
    assert statuses == [200, 200, 200, 429]


def test_saving_has_its_own_lower_limit(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "assessment_save_rate_limit", 1)
    assert _score(client, save=True).status_code == 200
    assert _score(client, save=True).status_code == 429
    assert _score(client).status_code == 200  # scoring without saving is still allowed


def test_admin_retention_preview_and_run_include_expired_saved_results(client, admin_client, db):
    _score(client, save=True)
    row = db.scalar(select(AssessmentResultRecord))
    row.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    preview = admin_client.get("/api/admin/retention").json()
    assert (preview["assessment_retention_days"], preview["assessment_results_due"]) == (90, 1)
    run = admin_client.post("/api/admin/retention/run", json={"confirm": True}).json()
    assert run["assessment_results_deleted"] == 1
    assert db.scalar(select(func.count()).select_from(AssessmentResultRecord)) == 0
