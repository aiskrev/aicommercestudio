"""Input screening and output post-processing for the advisor.

Defence in depth against prompt injection and misleading output:

1. Input: personal data and links are removed before the text is stored or sent to a provider;
   characters that could close the prompt's data delimiters are neutralised; known injection
   phrasing is detected (the request still runs, the visitor is told the text was treated as data).
2. Prompt: instructions live only in the system prompt; visitor text is JSON-encoded inside a
   `<visitor_input>` block that the model is told to treat as untrusted data (see `prompt.py`).
3. Capability: the model gets no tools and no credentials — it can only return JSON.
4. Output: strict schema validation, then links and financial promises (guaranteed savings,
   ROI, money or percentage figures) are removed, and every workflow step that would change
   something outside the business's own review is forced to require human approval.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.advisor.schemas import AutomationAssessment, HumanApproval
from app.ai.base import redact_personal_data

_URL_RE = re.compile(r"(?:https?://|www\.)[^\s\"'<>]+", re.IGNORECASE)

_INJECTION_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"ignore\s+(?:all\s+|any\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|prompts?|rules)",
        r"disregard\s+(?:all\s+|the\s+)?(?:previous|prior|above|system)",
        r"\b(?:system|developer)\s+(?:prompt|message|instructions)\b",
        r"\byou\s+are\s+now\b",
        r"\bact\s+as\s+(?:a|an|the)\b",
        r"\bjailbreak\b|\bDAN\s+mode\b|developer\s+mode",
        r"\breveal\s+(?:your|the)\s+(?:prompt|instructions|system)",
        r"</?\s*(?:system|assistant|user|visitor_input|instructions?)\s*>",
        r"игнорира(?:й|йте|не)\s+(?:всички\s+)?(?:предишн|горн|досегашн|системн)",
        r"(?:забрави|забравете)\s+(?:всички\s+)?(?:предишн|инструкц|правила)",
        r"системн(?:ия|ият|ите|а)\s+(?:промпт|инструкц|съобщени)",
        r"(?:покажи|покажете|разкрий|разкрийте)\s+(?:си\s+)?(?:промпт|инструкци|системн)",
        r"\bвече\s+си\b|\bот\s+сега\s+нататък\s+си\b",
        r"(?:изпрати|изпратете|направи|направете)\s+(?:плащане|превод|имейл\s+до)",
    )
]

# A sentence that promises money, savings, ROI or percentages is removed from model output.
_CLAIM_RE = re.compile(
    r"гарант|\bROI\b|възвръщаем|изплаща\s+се|печалб|"
    r"\d[\d\s.,]*\s*(?:%|процент|лв\b|лева|bgn|€|евро|eur\b|\$|usd)|"
    r"(?:€|\$)\s*\d|"
    r"спест\w*\s+(?:до\s+|над\s+|поне\s+)?\d|"
    r"guarantee|return\s+on\s+investment|pays?\s+(?:for\s+)?itself|payback|\bprofit|"
    r"\d[\d\s.,]*\s*(?:percent|per\s+cent|euros?\b|dollars?\b|leva\b)|"
    r"sav(?:e|es|ed|ing|ings)\s+(?:of\s+|up\s+to\s+|over\s+|at\s+least\s+)?\d",
    re.IGNORECASE,
)
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+")
CLAIM_REPLACEMENTS = {
    "bg": "[Премахнато: прогнози за спестявания, приходи или възвръщаемост не се дават без анализ на реални данни.]",
    "en": "[Removed: savings, revenue or return forecasts are not given without an analysis of real data.]",
}
LINK_REPLACEMENTS = {"bg": "[връзка премахната]", "en": "[link removed]"}
CLAIM_REPLACEMENT = CLAIM_REPLACEMENTS["bg"]
LINK_REPLACEMENT = LINK_REPLACEMENTS["bg"]

# Steps that change the outside world must never run without a human decision.
_SIDE_EFFECT_RE = re.compile(
    r"изпра[тщ]|"
    r"(?:извършва|нарежда|инициира|изпълнява)\w*\s+(?:на\s+)?(?:плащан|превод)|\bплаща\b|\bплати\b|"
    r"превежда|превод\s+на\s+(?:пари|сум)|възстановява\w*|рефунд|"
    r"изтрива|изтриване|публикува|публикуване|"
    r"промен\w*\s+(?:на\s+)?(?:цен|поръч|наличн|статус|продукт)|анулира|"
    r"запис\w*\s+в\s+(?:erp|счетоводн|магазин)|"
    r"\bsend|\bpay\b|refund|delete|publish|\bcancel|transfers?\s+(?:money|funds)|"
    r"(?:update|change|modif)\w*\s+(?:the\s+)?(?:price|order|stock|status|product)|"
    r"(?:writes?|records?|posts?)\s+(?:it\s+)?(?:to|into|in)\s+(?:the\s+)?(?:erp|accounting|store|shop)",
    re.IGNORECASE,
)
WRITE_APPROVALS = {
    "bg": HumanApproval(
        decision="Всеки запис или промяна във външна система (магазин, CRM, ERP, счетоводство)",
        reason="Автоматизацията подготвя промяната, но човек я потвърждава, преди да бъде изпълнена.",
    ),
    "en": HumanApproval(
        decision="Every write or change in an external system (store, CRM, ERP, accounting)",
        reason="The automation prepares the change, but a person confirms it before it is carried out.",
    ),
}
WRITE_APPROVAL = WRITE_APPROVALS["bg"]


def write_approval(locale: str) -> HumanApproval:
    return WRITE_APPROVALS.get(locale, WRITE_APPROVAL)


@dataclass(frozen=True)
class ScreenedText:
    text: str
    injection_suspected: bool
    personal_data_removed: bool
    links_removed: bool


def screen_text(value: str, locale: str = "bg") -> ScreenedText:
    """Prepare visitor text for storage and for the prompt."""
    injection = any(p.search(value) for p in _INJECTION_PATTERNS)
    redacted = redact_personal_data(value)
    unlinked = _URL_RE.sub(LINK_REPLACEMENTS.get(locale, LINK_REPLACEMENT), redacted)
    # Angle brackets could imitate the prompt's XML-style delimiters; backticks code fences.
    neutral = unlinked.replace("<", "‹").replace(">", "›").replace("```", "'''")
    return ScreenedText(
        text=neutral,
        injection_suspected=injection,
        personal_data_removed=redacted != value,
        links_removed=unlinked != redacted,
    )


@dataclass
class ScrubReport:
    claims_removed: int = 0
    links_removed: int = 0
    approvals_enforced: int = 0
    locale: str = "bg"


def _scrub_text(value: str, report: ScrubReport) -> str:
    if _URL_RE.search(value):
        report.links_removed += len(_URL_RE.findall(value))
        value = _URL_RE.sub(LINK_REPLACEMENTS.get(report.locale, LINK_REPLACEMENT), value)
    if not _CLAIM_RE.search(value):
        return value
    replacement = CLAIM_REPLACEMENTS.get(report.locale, CLAIM_REPLACEMENT)
    kept: list[str] = []
    for sentence in _SENTENCE_SPLIT.split(value):
        if _CLAIM_RE.search(sentence):
            report.claims_removed += 1
            if replacement not in kept:
                kept.append(replacement)
        else:
            kept.append(sentence)
    return " ".join(kept)


def _scrub(node: object, report: ScrubReport) -> object:
    if isinstance(node, str):
        return _scrub_text(node, report)
    if isinstance(node, list):
        return [_scrub(item, report) for item in node]
    if isinstance(node, dict):
        return {key: _scrub(value, report) for key, value in node.items()}
    return node


def sanitize_assessment(
    assessment: AutomationAssessment, locale: str = "bg"
) -> tuple[AutomationAssessment, ScrubReport]:
    """Remove links and financial promises; enforce human approval for side effects."""
    report = ScrubReport(locale=locale)
    data = _scrub(assessment.model_dump(), report)
    cleaned = AutomationAssessment.model_validate(data)

    for step in cleaned.proposed_workflow:
        text = f"{step.title} {step.description}"
        if step.actor != "human" and not step.requires_human_approval and _SIDE_EFFECT_RE.search(text):
            step.requires_human_approval = True
            report.approvals_enforced += 1

    writes = any(i.access != "read" for i in cleaned.integrations)
    markers = {a.decision for a in WRITE_APPROVALS.values()}
    if writes and not any(a.decision in markers for a in cleaned.human_approvals):
        cleaned.human_approvals = [*cleaned.human_approvals[:5], write_approval(locale)]
        report.approvals_enforced += 1
    return cleaned, report
