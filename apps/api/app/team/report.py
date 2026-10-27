"""Bilingual PDF plan for a configured AI team (reportlab, same look as the readiness report).

Texts come from app/team/texts.json — a snapshot of the web content (apps/web/src/lib/team-texts.ts)
— plus the few PDF-only labels below. The one visitor-supplied string, an optional company name for
the cover, is XML-escaped. Built in memory; nothing is written to disk or logged.
"""

from __future__ import annotations

import io
import json
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.readiness.report import ACCENT, INK, LINE, WARN, WARN_BG, _numbered_canvas, _register_fonts, _styles
from app.team.costs import SCENARIOS
from app.team.model import AGENTS, DATA_SOURCES, INTEGRATIONS, MODEL_VERSION, TeamConfig, agent_configs

TEXTS_FILE = Path(__file__).with_name("texts.json")

LABELS = {
    "bg": {
        "brand": "A.I. Commerce Studio",
        "title": "План за AI екип",
        "subtitle": "Препоръчан екип, архитектура, сигурност, етапи и ориентировъчни разходи",
        "prepared_for": "Изготвен за",
        "generated": "Дата",
        "versions": "Модел {model} · допускания {assumptions}",
        "page": "Страница {n} от {total}",
        "context": "Контекст",
        "summary": "Обобщение",
        "agents_count": "Агенти",
        "complexity": "Сложност",
        "expected": "Очакван сценарий",
        "one_time": "еднократно",
        "monthly": "месечно",
        "not_deployed": "Това е план за обсъждане. Нищо не е изградено или внедрено.",
        "line": "Позиция",
        "used_by": "Използва се от",
        "rates": "Ставки",
        "rate_day": "Дневна ставка",
        "rate_hour": "Час от вашия екип",
        "rate_in": "1 млн. входящи токена",
        "rate_out": "1 млн. изходящи токена",
        "sample": "Преглед на извадка",
        "ranges": "Диапазон (всички сценарии)",
    },
    "en": {
        "brand": "A.I. Commerce Studio",
        "title": "AI team plan",
        "subtitle": "Recommended team, architecture, security, phases and indicative costs",
        "prepared_for": "Prepared for",
        "generated": "Date",
        "versions": "Model {model} · assumptions {assumptions}",
        "page": "Page {n} of {total}",
        "context": "Context",
        "summary": "Summary",
        "agents_count": "Agents",
        "complexity": "Complexity",
        "expected": "Expected scenario",
        "one_time": "one-time",
        "monthly": "monthly",
        "not_deployed": "This is a plan for discussion. Nothing has been built or deployed.",
        "line": "Item",
        "used_by": "Used by",
        "rates": "Rates",
        "rate_day": "Day rate",
        "rate_hour": "An hour of your team",
        "rate_in": "1M input tokens",
        "rate_out": "1M output tokens",
        "sample": "Sample review",
        "ranges": "Range (all scenarios)",
    },
}

LANE_COLOURS = {
    "users": colors.HexColor("#45606e"),
    "orchestration": colors.HexColor("#0c6670"),
    "agents": colors.HexColor("#0c6670"),
    "approvals": colors.HexColor("#8a5a00"),
    "data": colors.HexColor("#3b5bb5"),
    "systems": colors.HexColor("#45606e"),
}


@lru_cache
def _texts() -> dict[str, Any]:
    return json.loads(TEXTS_FILE.read_text(encoding="utf-8"))


def money(value: float, locale: str) -> str:
    amount = int(round(value))
    if locale == "en":
        return f"EUR {amount:,}"
    return f"{amount:,}".replace(",", " ") + " €"


def count(value: float, locale: str) -> str:
    """Thousands separator per locale (space in Bulgarian, comma in English)."""
    text = f"{int(round(value)):,}"
    return text if locale == "en" else text.replace(",", " ")


def fill(template: str, **values: Any) -> str:
    for key, value in values.items():
        template = template.replace("{" + key + "}", str(value))
    return template


def _wrap(text: str, width: int, max_lines: int = 3) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in text.split():
        if not line:
            line = word
        elif len(line) + 1 + len(word) <= width:
            line += " " + word
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1][: width - 1] + "…"
    return lines


def node_label(node: dict[str, Any], t: dict[str, Any]) -> str:
    kind = node["kind"]
    if kind in ("team", "customers", "coordinator", "router", "supervisor"):
        return t["architecture"]["nodes"][kind]
    if kind == "agent":
        return t["agents"][node["agent"]]["name"]
    if kind == "approval":
        return t["checkpoints"][node["checkpoint"]]["title"]
    return t["integrations"][node["integration"]]


def architecture_drawing(graph: dict[str, list[dict[str, Any]]], t: dict[str, Any], regular: str, bold: str) -> Drawing:
    """Lanes as columns (users → orchestration → agents → approvals → systems), shared data below."""
    width = 174 * mm
    box_w, gap = 30.5 * mm, 5.4 * mm
    columns = ["users", "orchestration", "agents", "approvals", "systems"]
    x_of = {lane: i * (box_w + gap) for i, lane in enumerate(columns)}
    line_h = 2.9 * mm

    def box_h(lines: int) -> float:
        return 3.2 * mm + lines * line_h

    placed: dict[str, tuple[float, float, float, list[str], str]] = {}
    heights = {}
    for lane in columns:
        items = [n for n in graph["nodes"] if n["lane"] == lane]
        heights[lane] = sum(box_h(len(_wrap(node_label(n, t), 19))) for n in items) + max(0, len(items) - 1) * 3 * mm
    main_h = max([*heights.values(), 12 * mm])
    data = [n for n in graph["nodes"] if n["lane"] == "data"]
    data_h = max([box_h(len(_wrap(node_label(n, t), 19))) for n in data] or [0])
    top_pad, data_gap = 7 * mm, 10 * mm if data else 0
    total_h = top_pad + main_h + (data_gap + 5 * mm + data_h if data else 0) + 2 * mm
    drawing = Drawing(width, total_h)

    for lane in columns:
        drawing.add(
            String(
                x_of[lane],
                total_h - 4 * mm,
                t["architecture"]["lanes"][lane].upper(),
                fontName=bold,
                fontSize=5.6,
                fillColor=LANE_COLOURS[lane],
            )
        )
        items = [n for n in graph["nodes"] if n["lane"] == lane]
        y = total_h - top_pad - (main_h - heights[lane]) / 2
        for node in items:
            lines = _wrap(node_label(node, t), 19)
            h = box_h(len(lines))
            y -= h
            placed[node["id"]] = (x_of[lane], y, h, lines, lane)
            y -= 3 * mm
    if data:
        row_y = total_h - top_pad - main_h - data_gap
        # Lane title in the empty left column, clear of the connectors coming down from the agents.
        drawing.add(
            String(
                x_of["users"],
                row_y - 6 * mm,
                t["architecture"]["lanes"]["data"].upper(),
                fontName=bold,
                fontSize=5.6,
                fillColor=LANE_COLOURS["data"],
            )
        )
        for i, node in enumerate(data):
            lines = _wrap(node_label(node, t), 19)
            h = box_h(len(lines))
            placed[node["id"]] = (x_of["agents"] + i * (box_w + gap), row_y - 2 * mm - h, h, lines, "data")

    edge_colour = {"read": colors.HexColor("#3b5bb5"), "review": WARN, "supervise": WARN, "act": ACCENT}
    for edge in graph["edges"]:
        if edge["from"] not in placed or edge["to"] not in placed:
            continue
        fx, fy, fh, _, _ = placed[edge["from"]]
        tx, ty, th, _, to_lane = placed[edge["to"]]
        colour = edge_colour.get(edge["kind"], LINE)
        dash = [2, 1.5] if edge["kind"] in ("read", "review", "supervise") else None
        if to_lane == "data":
            start, end = (fx + box_w / 2, fy), (tx + box_w / 2, ty + th)
        elif edge["kind"] == "supervise":
            start, end = (fx, fy + fh / 2), (tx, ty + th / 2)
            drawing.add(
                Line(
                    start[0],
                    start[1],
                    start[0] - 2.5 * mm,
                    start[1],
                    strokeColor=colour,
                    strokeWidth=0.5,
                    strokeDashArray=dash,
                )
            )
            drawing.add(
                Line(
                    start[0] - 2.5 * mm,
                    start[1],
                    end[0] - 2.5 * mm,
                    end[1],
                    strokeColor=colour,
                    strokeWidth=0.5,
                    strokeDashArray=dash,
                )
            )
            start = (end[0] - 2.5 * mm, end[1])
        else:
            start, end = (fx + box_w, fy + fh / 2), (tx, ty + th / 2)
        drawing.add(
            Line(start[0], start[1], end[0], end[1], strokeColor=colour, strokeWidth=0.55, strokeDashArray=dash)
        )

    for _node_id, (x, y, h, lines, lane) in placed.items():
        drawing.add(
            Rect(
                x,
                y,
                box_w,
                h,
                rx=1.6 * mm,
                ry=1.6 * mm,
                fillColor=colors.white,
                strokeColor=LANE_COLOURS[lane],
                strokeWidth=0.7,
                strokeDashArray=[2, 1.2] if lane == "approvals" else None,
            )
        )
        for i, text in enumerate(lines):
            drawing.add(
                String(
                    x + 2 * mm,
                    y + h - 2.1 * mm - (i + 1) * line_h + 0.6 * mm,
                    text,
                    fontName=bold if i == 0 else regular,
                    fontSize=6.2,
                    fillColor=INK,
                )
            )
    return drawing


def build_team_report(
    config: TeamConfig, plan: dict[str, Any], locale: str, company: str | None = None, today: date | None = None
) -> bytes:
    regular, bold = _register_fonts()
    locale = "en" if locale == "en" else "bg"
    t = _texts()[locale]
    labels = LABELS[locale]
    s = _styles(regular, bold)
    r = t["result"]
    c = t["costs"]
    summary = plan["summary"]
    estimate = plan["estimate"]
    configs = agent_configs(config)
    agent_name = lambda key: t["agents"][key]["name"]  # noqa: E731
    story: list = []

    def h2(text: str) -> Paragraph:
        return Paragraph(escape(text), s["h2"])

    def bullets(items: list[str]) -> list:
        return [Paragraph(f"• {item}", s["body"]) for item in items]

    def table(rows: list[list], widths: list, header: bool = True, zebra: bool = False) -> Table:
        tbl = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
        style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ]
        if zebra:
            style.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef5f6")))
        tbl.setStyle(TableStyle(style))
        return tbl

    # ------------------------------------------------------------------ cover
    meta = [
        f"{labels['generated']}: {(today or date.today()).isoformat()}",
        fill(labels["versions"], model=MODEL_VERSION, assumptions=estimate["assumptions_version"]),
    ]
    if company:
        meta.insert(0, f"{labels['prepared_for']}: <b>{escape(company)}</b>")
    story += [
        Paragraph(escape(labels["title"]), s["title"]),
        Spacer(1, 2 * mm),
        Paragraph(escape(labels["subtitle"]), s["subtitle"]),
        Spacer(1, 4 * mm),
        Paragraph(" · ".join(meta), s["muted"]),
        Spacer(1, 3 * mm),
        Paragraph(escape(labels["not_deployed"]), s["muted"]),
    ]

    ctx = config.context
    tc = t["context"]
    context_rows = [
        [tc["industry"]["label"], tc["industry"]["options"][ctx["industry"]]],
        [tc["size"]["label"], tc["size"]["options"][ctx["size"]]],
        [tc["leadDepartment"]["label"], t["departments"]["options"][ctx["lead_department"]]["title"]],
        [tc["challenge"]["label"], tc["challenge"]["options"][ctx["challenge"]]],
        [tc["volume"]["label"], tc["volume"]["options"][ctx["volume"]]],
        [t["departments"]["label"], ", ".join(t["departments"]["options"][d]["title"] for d in config.departments)],
        [t["deployment"]["label"], t["deployment"]["options"][config.deployment]["title"]],
        [t["operations"]["label"], t["operations"]["options"][config.operations]["title"]],
    ]
    story += [
        h2(labels["context"]),
        table(
            [[Paragraph(escape(k), s["small"]), Paragraph(escape(v), s["body"])] for k, v in context_rows],
            [52 * mm, None],
            header=False,
        ),
    ]

    expected = estimate["scenarios"]["expected"]
    ranges = estimate["ranges"]
    band = summary["complexity"]["band"]
    story += [
        h2(labels["summary"]),
        table(
            [
                [
                    Paragraph(escape(labels["agents_count"]), s["small"]),
                    Paragraph(str(len(summary["selected"])), s["body"]),
                ],
                [
                    Paragraph(escape(labels["complexity"]), s["small"]),
                    Paragraph(f"{escape(t['complexity'][band])} ({summary['complexity']['points']})", s["body"]),
                ],
                [
                    Paragraph(escape(labels["expected"]), s["small"]),
                    Paragraph(
                        f"{money(expected['one_time']['total'], locale)} {escape(labels['one_time'])} · "
                        f"{money(expected['monthly']['total'], locale)} {escape(labels['monthly'])}",
                        s["body"],
                    ),
                ],
                [
                    Paragraph(escape(labels["ranges"]), s["small"]),
                    Paragraph(
                        escape(
                            fill(
                                c["rangeOneTime"],
                                min=money(ranges["one_time"][0], locale),
                                max=money(ranges["one_time"][1], locale),
                            )
                        )
                        + " · "
                        + escape(
                            fill(
                                c["rangeMonthly"],
                                min=money(ranges["monthly"][0], locale),
                                max=money(ranges["monthly"][1], locale),
                            )
                        ),
                        s["body"],
                    ),
                ],
            ],
            [52 * mm, None],
            header=False,
        ),
    ]

    # ------------------------------------------------------------------ team
    rows = [
        [
            Paragraph(f"<b>{escape(r['rolesTitle'])}</b>", s["small"]),
            Paragraph(f"<b>{escape(r['checkpointLabel'])}</b>", s["small"]),
            Paragraph(f"<b>{escape(r['volumeLabel'])}</b>", s["small"]),
        ]
    ]
    for agent in summary["selected"]:
        cfg = configs[agent]
        integrations = ", ".join(t["integrations"][i] for i in cfg["integrations"])
        rows.append(
            [
                [
                    Paragraph(f"<b>{escape(agent_name(agent))}</b>", s["body"]),
                    Paragraph(escape(t["agents"][agent]["purpose"]), s["small"]),
                    *([Paragraph(escape(integrations), s["small"])] if integrations else []),
                ],
                Paragraph(escape(t["checkpoints"][cfg["checkpoint"]]["title"]), s["small"]),
                Paragraph(escape(tc["volume"]["options"][cfg["volume"]]), s["small"]),
            ]
        )
    story += [h2(r["rolesTitle"]), table(rows, [100 * mm, 42 * mm, 32 * mm], zebra=True)]

    # ------------------------------------------------------------------ architecture
    story += [h2(t["architecture"]["title"]), architecture_drawing(summary["architecture"], t, regular, bold)]

    used = {i for cfg in configs.values() for i in cfg["integrations"]}
    systems = [i for i in INTEGRATIONS if i in used]
    used_by = {i: [agent_name(a) for a in summary["selected"] if i in configs[a]["integrations"]] for i in systems}
    sys_rows = [
        [
            Paragraph(f"<b>{escape(t['integrations'][i])}</b>", s["body"]),
            Paragraph(escape(r["dataSources"] if i in DATA_SOURCES else r["systems"]), s["small"]),
            Paragraph(escape(", ".join(used_by[i])), s["small"]),
        ]
        for i in systems
    ]
    if sys_rows:
        story += [h2(r["integrationsTitle"]), table(sys_rows, [44 * mm, 44 * mm, None], header=False)]

    flows = []
    df = t["dataFlows"]
    for flow in plan["data_flows"]:
        integration = t["integrations"][flow["integration"]]
        if flow["via"] == "orchestration":
            flows.append(fill(df["actOrchestration"], integration=integration))
        elif flow["via"] == "supervisor":
            flows.append(fill(df["actSupervisor"], integration=integration))
        elif flow["kind"] == "read":
            flows.append(fill(df["read"], agent=agent_name(flow["agent"]), integration=integration))
        elif flow["approval"]:
            flows.append(
                fill(
                    df["actApproved"],
                    agent=agent_name(flow["agent"]),
                    integration=integration,
                    checkpoint=t["checkpoints"][flow["approval"]]["title"],
                )
            )
        else:
            flows.append(fill(df["act"], agent=agent_name(flow["agent"]), integration=integration))
    if flows:
        story += [h2(df["title"]), *bullets([escape(f) for f in flows])]

    # The approval supervisor routes the approvals; the approval points belong to the task agents.
    tasks = [a for a in summary["selected"] if AGENTS[a].role == "task"]
    gated = [a for a in tasks if configs[a]["checkpoint"] in ("before_external", "every_action")]
    hitl = [
        f"<b>{escape(agent_name(a))}</b> — {escape(t['checkpoints'][configs[a]['checkpoint']]['title'])}: "
        f"{escape(t['checkpoints'][configs[a]['checkpoint']]['text'])}"
        for a in gated
    ]
    sampled = [agent_name(a) for a in tasks if configs[a]["checkpoint"] == "sample_review"]
    if sampled:
        hitl.append(f"<b>{escape(labels['sample'])}</b>: {escape(', '.join(sampled))}")
    story += [
        h2(t["hitlTitle"]),
        *(bullets(hitl) if gated or sampled else [Paragraph(escape(t["hitlNone"]), s["body"])]),
    ]

    if summary["workflows"]:
        story.append(h2(r["workflowsTitle"]))
        for workflow in summary["workflows"]:
            steps = []
            for step in workflow["steps"]:
                if step["kind"] == "trigger":
                    steps.append(r["workflows"][workflow["key"]]["trigger"])
                elif step["kind"] == "outcome":
                    steps.append(r["workflows"][workflow["key"]]["outcome"])
                elif step["kind"] == "human":
                    steps.append(fill(r["humanStep"], checkpoint=t["checkpoints"][step["checkpoint"]]["title"]))
                else:
                    steps.append(agent_name(step["agent"]))
            story += [
                Paragraph(f"<b>{escape(r['workflows'][workflow['key']]['title'])}</b>", s["body"]),
                Paragraph(escape(" → ".join(steps)), s["small"]),
                Spacer(1, 1.5 * mm),
            ]

    # ------------------------------------------------------------------ security, risks, prerequisites
    sec = t["security"]
    story += [
        h2(sec["title"]),
        *bullets(
            [f"<b>{escape(sec['items'][k]['title'])}.</b> {escape(sec['items'][k]['text'])}" for k in plan["security"]]
        ),
    ]
    if summary["risks"]:
        risk_cells = [
            [Paragraph(f"<b>{escape(r['risks'][k]['title'])}.</b> {escape(r['risks'][k]['text'])}", s["warn"])]
            for k in summary["risks"]
        ]
        risk_table = Table(risk_cells, colWidths=["100%"])
        risk_table.setStyle(
            TableStyle([("BACKGROUND", (0, 0), (-1, -1), WARN_BG), ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm)])
        )
        story += [h2(r["risksTitle"]), risk_table]
    story += [
        h2(r["prerequisitesTitle"]),
        *bullets(
            [
                f"<b>{escape(r['prerequisites'][k]['title'])}.</b> {escape(r['prerequisites'][k]['text'])}"
                for k in summary["prerequisites"]
            ]
        ),
    ]

    # ------------------------------------------------------------------ phases
    story.append(h2(r["rolloutTitle"]))
    for index, phase in enumerate(summary["rollout"], start=1):
        meta_line = (
            fill(r["weeks"], min=phase["weeks"][0], max=phase["weeks"][1])
            + " · "
            + fill(r["phaseComplexity"], complexity=t["complexity"][phase["complexity"]].lower())
        )
        story.append(
            KeepTogether(
                [
                    Paragraph(
                        f"<font color='#0c6670'>{index:02d}</font>  "
                        f"<b>{escape(r['phases'][phase['key']]['title'])}</b>",
                        s["body"],
                    ),
                    Paragraph(escape(r["phases"][phase["key"]]["goal"]), s["body"]),
                    Paragraph(escape(", ".join(agent_name(a) for a in phase["agents"])), s["small"]),
                    Paragraph(escape(meta_line), s["small"]),
                    Spacer(1, 2 * mm),
                ]
            )
        )
    story.append(Paragraph(escape(r["effortNote"]), s["muted"]))

    # ------------------------------------------------------------------ costs
    head = [Paragraph(f"<b>{escape(labels['line'])}</b>", s["small"])] + [
        Paragraph(f"<b>{escape(c['scenarios'][name]['title'])}</b>", s["small"]) for name in SCENARIOS
    ]

    def cost_rows(group: str, keys: list[str]) -> list[list]:
        out = []
        for key in keys:
            label = c["oneTime" if group == "one_time" else "monthly"][key]
            style = s["body"] if key != "total" else s["h3"]
            out.append(
                [Paragraph(escape(label), style)]
                + [Paragraph(money(estimate["scenarios"][name][group][key], locale), style) for name in SCENARIOS]
            )
        return out

    one_time_keys = ["discovery", "agents", "integrations", "approvals", "deployment", "testing", "total"]
    monthly_keys = ["infrastructure", "model_usage", "monitoring", "oversight", "total"]
    widths = [74 * mm, 33 * mm, 33 * mm, 34 * mm]
    story += [
        h2(c["title"]),
        Paragraph(escape(c["lead"]), s["muted"]),
        Spacer(1, 2 * mm),
        Paragraph(f"<b>{escape(c['oneTimeTitle'])}</b>", s["body"]),
        table([head, *cost_rows("one_time", one_time_keys)], widths, zebra=True),
        Spacer(1, 3 * mm),
        Paragraph(f"<b>{escape(c['monthlyTitle'])}</b>", s["body"]),
        table([head, *cost_rows("monthly", monthly_keys)], widths, zebra=True),
        Spacer(1, 2 * mm),
    ]
    usage = expected["usage"]
    story += [
        Paragraph(
            escape(
                f"{c['monthly']['model_usage']} ({c['scenarios']['expected']['title']}): "
                + fill(
                    c["notes"]["model_usage"],
                    tasks=count(usage["tasks_per_month"], locale),
                    input=round(usage["input_tokens"] / 1_000_000, 1),
                    output=round(usage["output_tokens"] / 1_000_000, 1),
                )
            ),
            s["small"],
        ),
        Paragraph(
            escape(
                f"{c['monthly']['oversight']}: "
                + fill(
                    c["notes"]["oversight"],
                    reviews=count(expected["oversight"]["reviews_per_month"], locale),
                    hours=expected["oversight"]["hours_per_month"],
                )
            ),
            s["small"],
        ),
        Paragraph(
            escape(
                f"{c['monthly']['monitoring']}: "
                + fill(
                    c["notes"]["monitoring"],
                    studio=expected["monitoring_hours"]["studio"],
                    internal=expected["monitoring_hours"]["internal"],
                )
            ),
            s["small"],
        ),
    ]
    if expected["integrations"]:
        story += [
            Spacer(1, 2 * mm),
            Paragraph(f"<b>{escape(c['integrationEffortTitle'])}</b>", s["body"]),
            *bullets(
                [
                    escape(
                        f"{t['integrations'][row['integration']]}: "
                        + fill(c["integrationRow"], complexity=t["complexity"][row["complexity"]], days=row["days"])
                    )
                    for row in expected["integrations"]
                ]
            ),
        ]

    rates = estimate["rates"]
    custom = set(estimate["overrides"])
    rate_rows = [
        ("day_rate", labels["rate_day"], money(rates["day_rate"], locale)),
        ("internal_hourly_rate", labels["rate_hour"], money(rates["internal_hourly_rate"], locale)),
        (
            "price_per_million_input",
            labels["rate_in"],
            f"{rates['price_per_million_input']:g} €"
            if locale == "bg"
            else f"EUR {rates['price_per_million_input']:g}",
        ),
        (
            "price_per_million_output",
            labels["rate_out"],
            f"{rates['price_per_million_output']:g} €"
            if locale == "bg"
            else f"EUR {rates['price_per_million_output']:g}",
        ),
    ]
    story += [
        h2(c["assumptionsTitle"]),
        Paragraph(escape(fill(c["assumptionsVersion"], version=estimate["assumptions_version"])), s["small"]),
        table(
            [
                [
                    Paragraph(escape(label), s["small"]),
                    Paragraph(escape(value + (f" ({c['customised']})" if key in custom else "")), s["body"]),
                ]
                for key, label, value in rate_rows
            ],
            [74 * mm, None],
            header=False,
        ),
        Spacer(1, 2 * mm),
        *[Paragraph(escape(f), s["muted"]) for f in c["formulas"]],
        Spacer(1, 3 * mm),
        Paragraph(escape(c["disclaimer"]), s["muted"]),
        Spacer(1, 1.5 * mm),
        Paragraph(escape(r["disclaimer"]), s["muted"]),
    ]

    buffer = io.BytesIO()
    page_texts = {"brand": labels["brand"], "title": labels["title"], "page": labels["page"]}
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=24 * mm,
        bottomMargin=18 * mm,
        title=labels["title"],
        author=labels["brand"],
        creator=labels["brand"],
    )
    document.build(story, canvasmaker=_numbered_canvas(page_texts, regular, bold))
    return buffer.getvalue()
