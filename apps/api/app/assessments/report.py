"""Report document for a saved engine assessment (rendered by app/reports).

Built only from the server-side result view (`present_result` with the saved answers) and texts
owned by the server: the definition's own texts and the frame below. Nothing the visitor typed as
free text exists in an engine assessment, and every string still passes through `clean()`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.reports.document import (
    Bullets,
    Finding,
    Findings,
    Paragraph,
    ReportDocument,
    ScoreRow,
    Scores,
    Section,
    Table,
    clean,
)

BRAND = "A.I. Commerce Studio"

DOMAIN_NAMES: dict[str, dict[str, str]] = {
    "bg": {
        "ai_strategy": "AI стратегия и трансформация",
        "ai_agents_automation": "AI агенти и бизнес автоматизация",
        "ai_applications": "AI приложения и системи за знания",
        "commerce_engineering": "Инженеринг за електронна търговия",
        "cloud_platform": "Облачен и платформен инженеринг",
        "devops_sre": "DevOps, SRE и наблюдаемост",
        "data_integration": "Инженеринг на данни и интеграции",
        "ai_governance": "AI управление, сигурност и надеждност",
        "managed_operations": "Управлявани AI и платформени операции",
        "advisory_enablement": "Консултации, оценки и обучение",
    },
    "en": {
        "ai_strategy": "AI Strategy & Transformation",
        "ai_agents_automation": "AI Agents & Business Automation",
        "ai_applications": "AI Applications & Knowledge Systems",
        "commerce_engineering": "Commerce Engineering",
        "cloud_platform": "Cloud & Platform Engineering",
        "devops_sre": "DevOps, SRE & Observability",
        "data_integration": "Data & Integration Engineering",
        "ai_governance": "AI Governance, Security & Assurance",
        "managed_operations": "Managed AI & Platform Operations",
        "advisory_enablement": "Advisory, Assessments & Enablement",
    },
}

TEXTS: dict[str, dict[str, Any]] = {
    "bg": {
        "subtitle": "Доклад от самооценка",
        "generated": "Създаден",
        "version": "Версия на методиката",
        "reference": "Референция",
        "expires": "Достъпен до",
        "about": "За тази оценка",
        "methodology": (
            "Резултатите са изчислени на сървъра с детерминистични правила ({algorithm}) от вашите отговори. "
            "Едни и същи отговори дават един и същ резултат. Практиките са самооценка; метриките са въведени от вас. "
            "Нито едното, нито другото е проверено от нас."
        ),
        "inputs": "Вашите отговори и допускания",
        "practice": "Практики (самооценка)",
        "metric": "Метрики, въведени от вас (непроверени)",
        "context": "Контекст на средата",
        "question": "Въпрос",
        "answer": "Отговор",
        "results": "Резултати",
        "overall": "Общ резултат: {overall}/100 — {band}",
        "breakdown": "Разбивка по области",
        "because": "Защо",
        "kinds": {
            "risk": "Рискове",
            "quick_win": "Бързи подобрения",
            "recommendation": "Препоръки",
            "target_state": "Целево състояние",
            "pattern": "Примерни архитектурни модели",
            "context": "Бележки за вашия контекст",
        },
        "roadmap": "Ориентировъчна пътна карта",
        "roadmap_note": "Последователност, не график: сроковете зависят от екипа и обхвата и не са оферта.",
        "horizon": "{days} дни",
        "services": "Свързани услуги",
        "services_note": "Области от каталога на A.I. Commerce Studio, свързани с откритията по-горе.",
        "limitations": "Ограничения",
        "limits": [
            "Самооценка по вашите отговори; не сме имали достъп до вашите системи или облачни среди.",
            "Не е извършено сканиране, одит или тест на живо.",
            "Не е сертификат за съответствие и не замества одит.",
            "Изчисленията не са проверени от независима страна.",
        ],
        "footer": "{brand} · Този доклад съдържа само избраните от вас отговори и изчисления на сървъра.",
    },
    "en": {
        "subtitle": "Self-assessment report",
        "generated": "Created",
        "version": "Methodology version",
        "reference": "Reference",
        "expires": "Available until",
        "about": "About this assessment",
        "methodology": (
            "Results were computed on the server by deterministic rules ({algorithm}) from your answers. "
            "The same answers always give the same result. Practices are self-reported; metrics were entered "
            "by you. We have verified neither."
        ),
        "inputs": "Your answers and assumptions",
        "practice": "Practices (self-reported)",
        "metric": "Metrics you entered (not verified)",
        "context": "Environment context",
        "question": "Question",
        "answer": "Answer",
        "results": "Results",
        "overall": "Overall score: {overall}/100 — {band}",
        "breakdown": "Breakdown by area",
        "because": "Why",
        "kinds": {
            "risk": "Risks",
            "quick_win": "Quick wins",
            "recommendation": "Recommendations",
            "target_state": "Target state",
            "pattern": "Example architecture patterns",
            "context": "Notes for your context",
        },
        "roadmap": "Indicative roadmap",
        "roadmap_note": "A sequence, not a schedule: timing depends on your team and scope, and it is not a quote.",
        "horizon": "{days} days",
        "services": "Related services",
        "services_note": "Areas of the A.I. Commerce Studio catalogue related to the findings above.",
        "limitations": "Limitations",
        "limits": [
            "A self-assessment based on your answers; we had no access to your systems or cloud environments.",
            "No live scanning, audit or test was performed.",
            "Not a compliance certification and not a substitute for an audit.",
            "The calculations have not been independently verified.",
        ],
        "footer": "{brand} · This report contains only the answers you chose and the server's calculations.",
    },
}

KIND_ORDER = ("risk", "quick_win", "recommendation", "target_state", "pattern", "context")


def build_document(
    view: dict[str, Any], *, locale: str, created_at: datetime, expires_at: datetime, reference: str
) -> ReportDocument:
    t = TEXTS[locale]
    sections: list[Section] = [
        Section(
            clean(t["about"], 120),
            (Paragraph(clean(t["methodology"].format(algorithm=view["algorithm"]))),),
        )
    ]

    by_evidence: dict[str, list[tuple[str, str]]] = {"practice": [], "metric": [], "context": []}
    for item in view["inputs"]:
        by_evidence[item["evidence"]].append((clean(item["text"], 300), clean(item["answer"], 300)))
    input_blocks = []
    for evidence in ("context", "practice", "metric"):
        rows = by_evidence[evidence]
        if rows:
            input_blocks += [
                Paragraph(clean(t[evidence], 120), "muted"),
                Table((t["question"], t["answer"]), tuple(rows)),
            ]
    if input_blocks:
        sections.append(Section(clean(t["inputs"], 120), tuple(input_blocks)))

    sections.append(
        Section(
            clean(t["results"], 120),
            (
                Paragraph(clean(t["overall"].format(overall=view["overall"], band=view["band"]["title"]))),
                Paragraph(clean(view["band"]["description"]), "muted"),
                Paragraph(clean(t["breakdown"], 120), "muted"),
                Scores(
                    tuple(
                        ScoreRow(clean(d["title"], 120), int(d["score"]), clean(d["level"]["title"], 80))
                        for d in view["dimensions"]
                    )
                ),
            ),
        )
    )

    titles = {f["key"]: f["title"] for f in view["recommendations"]}
    for kind in KIND_ORDER:
        items = [f for f in view["recommendations"] if f["kind"] == kind]
        if not items:
            continue
        findings = tuple(
            Finding(
                clean(f["title"], 200),
                clean(f["description"]),
                clean(t["horizon"].format(days=f["horizon"]), 40) if f["horizon"] else "",
                tuple(clean(b, 300) for b in f["because"]),
            )
            for f in items
        )
        sections.append(Section(clean(t["kinds"][kind], 120), (Findings(findings, clean(t["because"], 40)),)))

    if view["roadmap"]:
        rows = tuple(
            (clean(t["horizon"].format(days=step["horizon"]), 40), clean("; ".join(titles[k] for k in step["items"])))
            for step in view["roadmap"]
        )
        sections.append(
            Section(
                clean(t["roadmap"], 120),
                (Paragraph(clean(t["roadmap_note"]), "muted"), Table(("", ""), rows)),
            )
        )

    if view["domains"]:
        names = DOMAIN_NAMES[locale]
        sections.append(
            Section(
                clean(t["services"], 120),
                (
                    Paragraph(clean(t["services_note"]), "muted"),
                    Bullets(tuple(clean(names[d], 120) for d in view["domains"])),
                ),
            )
        )

    sections.append(
        Section(
            clean(t["limitations"], 120),
            (Bullets(tuple(clean(x) for x in t["limits"])), Paragraph(clean(view["disclaimer"]), "notice")),
        )
    )

    return ReportDocument(
        locale="en" if locale == "en" else "bg",
        brand=BRAND,
        title=clean(view["title"], 160),
        subtitle=clean(t["subtitle"], 120),
        meta=(
            (t["generated"], created_at.date().isoformat()),
            (t["version"], f"{view['definition_version']} ({view['algorithm']})"),
            (t["reference"], reference),
            (t["expires"], expires_at.date().isoformat()),
        ),
        sections=tuple(sections),
        footer=clean(t["footer"].format(brand=BRAND)),
    )


# Generic, non-identifying download names (never the reference, the token or a company name).
FILE_NAMES = {"bg": "doklad-ocenka.pdf", "en": "assessment-report.pdf"}
