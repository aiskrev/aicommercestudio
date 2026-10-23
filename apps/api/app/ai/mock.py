"""Deterministic, offline provider used in development, tests and whenever no API key is set."""

from __future__ import annotations

from app.advisor.prompt import AdvisorPromptInput
from app.ai.advisor_mock import build_demo_assessment
from app.ai.base import AssessmentDraft, LeadTriage, LeadTriageInput, Priority

# (service key, keywords) — matched case-insensitively against the inquiry text.
_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("seo", ("seo", "класиране", "google", "органич", "search console", "ключови думи", "core web vitals")),
    ("maintenance", ("поддръжк", "shopify", "woocommerce", "бавен", "грешк", "срив", "обновяван", "бекъп")),
    ("ai_tools", ("чатбот", "асистент", "ai ", "изкуствен интелект", "rag", "описания на продукти", "gpt")),
    ("automation", ("автоматиз", "ръчно", "workflow", "фактур", "имейли", "crm процес", "повтаря")),
    ("analytics", ("анализ", "ga4", "конверс", "отчет", "dashboard", "табло", "колич", "изоставени")),
    ("integrations", ("api", "интеграц", "erp", "синхрониз", "webhook", "склад", "облак", "сигурност")),
    ("audit", ("одит", "оценка", "преглед", "план за подобрение")),
]

_URGENT = ("спешно", "веднага", "не работи", "срив", "спря", "загубваме", "down")
_SCOPE = ("бюджет", "срок", "оферта", "проект", "месечно", "договор")

_NEXT_STEPS = {
    "maintenance": "Поискайте временен достъп за технически преглед и договорете първоначален одит на магазина.",
    "seo": "Предложете технически SEO одит и уточнете приоритетните категории и пазари.",
    "ai_tools": "Насрочете разговор за конкретния случай на употреба, наличните данни и изискванията за поверителност.",
    "automation": "Картографирайте текущия процес стъпка по стъпка и определете къде е нужно човешко одобрение.",
    "analytics": "Проверете наличните източници на данни (GA4, платформа, ERP) и договорете базов отчет.",
    "integrations": "Съберете списък със системите, наличните API и обема на данните за техническа оценка.",
    "audit": "Изпратете кратък въпросник за обхвата на одита и предложете времева рамка за изпълнение.",
    "other": "Свържете се за уточняващ разговор, за да определите правилната услуга.",
}


class MockProvider:
    name = "mock"
    model = "rule-based-v1"

    def triage_lead(self, data: LeadTriageInput) -> LeadTriage:
        text = f" {data.message.lower()} "
        scores: dict[str, int] = {}
        signals: list[str] = []
        for service, keywords in _RULES:
            hits = [k.strip() for k in keywords if k in text]
            if hits:
                scores[service] = len(hits)
                signals.append(f"{service}: {', '.join(hits[:3])}")

        suggested = max(scores, key=lambda s: scores[s]) if scores else data.service
        if data.service != "other" and scores.get(data.service, 0) >= scores.get(suggested, 0):
            suggested = data.service

        priority: Priority = "medium"
        if any(word in text for word in _URGENT):
            priority = "high"
            signals.append("спешност: съобщението описва активен проблем")
        elif len(data.message) < 80 and not any(word in text for word in _SCOPE):
            priority = "low"
            signals.append("кратко запитване без уточнен обхват")

        first_sentence = data.message.strip().split(".")[0][:220]
        return LeadTriage(
            provider=self.name,
            model=self.model,
            suggested_service=suggested,
            priority=priority,
            summary=f"Запитване за „{suggested}“: {first_sentence}",
            suggested_next_step=_NEXT_STEPS.get(suggested, _NEXT_STEPS["other"]),
            signals=signals,
        )

    def assess_automation(self, data: AdvisorPromptInput) -> AssessmentDraft:
        """Template-based demo output — the advisor labels it as a demonstration, not AI analysis."""
        return AssessmentDraft(provider=self.name, model=self.model, data=build_demo_assessment(data))
