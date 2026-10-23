"""English advisor output: demo templates, notices, disclaimers, safety rules and the prompt language."""

from __future__ import annotations

import json
import re

from app.advisor import service
from app.advisor.prompt import system_prompt
from app.advisor.safety import CLAIM_REPLACEMENTS, WRITE_APPROVALS, sanitize_assessment
from app.advisor.schemas import AutomationAssessment
from app.ai import advisor_mock_en
from app.ai.advisor_mock import PATTERNS, build_demo_assessment
from tests.test_advisor import URL, _provider, _response, advisor_payload, demo_data, prompt_input

CYRILLIC = re.compile(r"[А-Яа-яЁё]")
EN_DESCRIPTION = (
    "Every day we copy orders from WooCommerce into Excel by hand, then create shipments with the courier "
    "and email customers their tracking numbers."
)


def _strings(node: object) -> list[str]:
    if isinstance(node, str):
        return [node]
    if isinstance(node, list):
        return [s for item in node for s in _strings(item)]
    if isinstance(node, dict):
        return [s for value in node.values() for s in _strings(value)]
    return []


def test_english_templates_cover_every_pattern():
    assert set(advisor_mock_en.PATTERNS) == {p.key for p in PATTERNS}
    for pattern in PATTERNS:
        english = advisor_mock_en.PATTERNS[pattern.key]
        assert english.uses_ai == pattern.uses_ai
        assert len(english.workflow) == len(pattern.workflow)
        assert [s["actor"] for s in english.workflow] == [s["actor"] for s in pattern.workflow]
        assert [s["requires_human_approval"] for s in english.workflow] == [
            s["requires_human_approval"] for s in pattern.workflow
        ]


def test_english_demo_output_has_no_cyrillic_and_no_financial_claims():
    for pattern in advisor_mock_en.PATTERNS.values():
        description = " ".join(pattern.keywords) + " manual work every day."
        data = build_demo_assessment(prompt_input(description, locale="en"))
        visitor_text = description[:220]
        generated = [s for s in _strings(data) if visitor_text not in s]
        assert not any(CYRILLIC.search(s) for s in generated), pattern.key
        _, report = sanitize_assessment(AutomationAssessment.model_validate(data), "en")
        assert (report.claims_removed, report.links_removed, report.approvals_enforced) == (0, 0, 0), pattern.key


def test_english_description_matches_the_same_pattern_on_both_pages():
    description = "We type incoming supplier invoices into the accounting system."
    english = build_demo_assessment(prompt_input(description, locale="en"))
    assert english["opportunities"][0]["title"].startswith("Automatic data extraction from incoming invoices")
    bulgarian_page = build_demo_assessment(prompt_input(description))
    assert "фактури" in bulgarian_page["opportunities"][0]["title"]


def test_english_assessment_via_api(client):
    response = client.post(URL, json=advisor_payload(process_description=EN_DESCRIPTION, locale="en"))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["mode"] == "demo"
    assert body["disclaimer"] == service.message("en", "demo")
    assert body["assessment"]["problem_summary"].startswith("Business: online store")
    decisions = [a["decision"] for a in body["assessment"]["human_approvals"]]
    assert WRITE_APPROVALS["en"].decision in decisions


def test_english_notices_and_status(client):
    description = EN_DESCRIPTION + " Write to ivan@example.com, see https://example.com/page"
    body = client.post(URL, json=advisor_payload(process_description=description, locale="en")).json()
    assert service.message("en", "personal_data") in body["notices"]
    assert service.message("en", "links") in body["notices"]
    status = client.get("/api/public/advisor/status", headers={"Accept-Language": "en"}).json()
    assert status["disclaimer"] == service.message("en", "demo")
    assert client.get("/api/public/advisor/status").json()["disclaimer"] == service.DEMO_DISCLAIMER


def test_unsupported_advisor_locale_is_rejected(client):
    assert client.post(URL, json=advisor_payload(locale="fr")).status_code == 422


def test_english_claims_and_side_effects_are_scrubbed():
    data = demo_data()
    data["problem_summary"] = "This will save 40 hours a month. It pays for itself within weeks. Clear process."
    data["proposed_workflow"][0] = {
        "title": "Update the order status",
        "description": "The system will update the order status in the store automatically.",
        "actor": "system",
        "requires_human_approval": False,
    }
    cleaned, report = sanitize_assessment(AutomationAssessment.model_validate(data), "en")
    assert report.claims_removed == 2
    assert CLAIM_REPLACEMENTS["en"] in cleaned.problem_summary
    assert "Clear process." in cleaned.problem_summary
    assert cleaned.proposed_workflow[0].requires_human_approval is True


def test_prompt_and_option_labels_follow_the_locale():
    assert "natural British English" in system_prompt("en")
    assert "natural Bulgarian" in system_prompt("bg")
    assert system_prompt("xx") == system_prompt("bg")
    provider, fake = _provider(_response(json.dumps(demo_data(), ensure_ascii=False)))
    provider.assess_automation(prompt_input(EN_DESCRIPTION, locale="en"))
    kwargs = fake.beta.messages.kwargs
    assert kwargs["system"] == system_prompt("en")
    user = kwargs["messages"][0]["content"]
    assert '"business_type": "online store"' in user
    assert not CYRILLIC.search(user)
