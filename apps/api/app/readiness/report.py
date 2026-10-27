"""Bilingual PDF report for the AI Readiness Assessment (reportlab, server-side).

Only server-owned texts (app/readiness/texts.py) and the computed result are printed. The one
user-supplied string — an optional company name for the cover — is XML-escaped. The PDF is built in
memory and returned; nothing is written to disk or logged.
"""

from __future__ import annotations

import io
from datetime import date
from functools import lru_cache
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.graphics.shapes import Drawing, Rect
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.readiness.scoring import ACTION_SERVICE, MODEL_VERSION, WEIGHTS, ReadinessResult
from app.readiness.texts import TEXTS

FONT_DIRS = (Path("/usr/share/fonts/truetype/dejavu"), Path("/usr/share/fonts/dejavu"))
INK = colors.HexColor("#14232d")
MUTED = colors.HexColor("#45606e")
ACCENT = colors.HexColor("#0c6670")
NAVY = colors.HexColor("#0d1724")
CYAN = colors.HexColor("#22d3ee")
LINE = colors.HexColor("#d5dde2")
WARN_BG = colors.HexColor("#fdf4e1")
WARN = colors.HexColor("#8a5a00")
BAND_COLOURS = {"exploration": "#b4233c", "foundation": "#8a5a00", "pilot_ready": "#0c6670", "scaling": "#1d7a4c"}


class ReportUnavailable(RuntimeError):
    """Raised when the report cannot be rendered on this server (e.g. fonts missing)."""


@lru_cache
def _register_fonts() -> tuple[str, str]:
    """DejaVu covers Latin and Cyrillic. Installed in the API image (fonts-dejavu-core)."""
    for directory in FONT_DIRS:
        regular, bold = directory / "DejaVuSans.ttf", directory / "DejaVuSans-Bold.ttf"
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("ACS-Sans", str(regular)))
            pdfmetrics.registerFont(TTFont("ACS-Sans-Bold", str(bold)))
            # Lets <b> inside paragraphs switch to the bold face.
            registerFontFamily(
                "ACS-Sans", normal="ACS-Sans", bold="ACS-Sans-Bold", italic="ACS-Sans", boldItalic="ACS-Sans-Bold"
            )
            return "ACS-Sans", "ACS-Sans-Bold"
    raise ReportUnavailable("DejaVu fonts not found")


def _styles(regular: str, bold: str) -> dict[str, ParagraphStyle]:
    base = ParagraphStyle("base", fontName=regular, fontSize=9.5, leading=13.5, textColor=INK, alignment=TA_LEFT)
    return {
        "body": base,
        "muted": ParagraphStyle("muted", parent=base, textColor=MUTED, fontSize=8.5, leading=12),
        "small": ParagraphStyle("small", parent=base, fontSize=8, leading=11, textColor=MUTED),
        "title": ParagraphStyle("title", parent=base, fontName=bold, fontSize=24, leading=28),
        "subtitle": ParagraphStyle("subtitle", parent=base, fontSize=12, leading=16, textColor=MUTED),
        "h2": ParagraphStyle("h2", parent=base, fontName=bold, fontSize=13, leading=17, spaceBefore=12, spaceAfter=6),
        "h3": ParagraphStyle("h3", parent=base, fontName=bold, fontSize=10, leading=14),
        "score": ParagraphStyle("score", parent=base, fontName=bold, fontSize=40, leading=44, textColor=NAVY),
        "band": ParagraphStyle("band", parent=base, fontName=bold, fontSize=13, leading=17, textColor=ACCENT),
        "warn": ParagraphStyle("warn", parent=base, textColor=WARN),
    }


def _bar(score: int, width: float = 52 * mm, height: float = 3.2 * mm) -> Drawing:
    colour = "#1d7a4c" if score >= 75 else "#8a5a00" if score >= 50 else "#b4233c"
    drawing = Drawing(width, height)
    drawing.add(Rect(0, 0, width, height, fillColor=colors.HexColor("#e4eaee"), strokeColor=None, rx=1.6, ry=1.6))
    if score > 0:
        drawing.add(
            Rect(0, 0, width * score / 100, height, fillColor=colors.HexColor(colour), strokeColor=None, rx=1.6, ry=1.6)
        )
    return drawing


def _numbered_canvas(texts: dict, regular: str, bold: str) -> type[Canvas]:
    """Canvas that draws the branded header/footer with "page n of total" once all pages are known."""

    class NumberedCanvas(Canvas):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(*args, **kwargs)
            self._saved: list[dict] = []

        def showPage(self) -> None:  # noqa: N802 (reportlab API)
            self._saved.append(dict(self.__dict__))
            self._startPage()

        def save(self) -> None:
            total = len(self._saved)
            for state in self._saved:
                self.__dict__.update(state)
                self._decorate(total)
                super().showPage()
            super().save()

        def _decorate(self, total: int) -> None:
            width, height = A4
            self.saveState()
            self.setFillColor(NAVY)
            self.rect(0, height - 16 * mm, width, 16 * mm, stroke=0, fill=1)
            # Monogram: tile with the logo's "A" and node, drawn in vector form.
            x, y = 18 * mm, height - 12.2 * mm
            self.setStrokeColor(CYAN)
            self.setLineWidth(0.9)
            self.roundRect(x, y, 8.5 * mm, 8.5 * mm, 2.2 * mm, stroke=1, fill=0)
            self.setLineWidth(1.2)
            self.line(x + 2.2 * mm, y + 1.9 * mm, x + 4.1 * mm, y + 6.6 * mm)
            self.line(x + 4.1 * mm, y + 6.6 * mm, x + 6.0 * mm, y + 1.9 * mm)
            self.line(x + 2.9 * mm, y + 3.6 * mm, x + 5.3 * mm, y + 3.6 * mm)
            self.setFillColor(CYAN)
            self.circle(x + 6.5 * mm, y + 6.4 * mm, 0.55 * mm, stroke=0, fill=1)
            self.setFillColor(colors.white)
            self.setFont(bold, 10.5)
            self.drawString(x + 11 * mm, y + 2.6 * mm, texts["brand"])
            self.setFont(regular, 8.5)
            self.drawRightString(width - 18 * mm, y + 2.6 * mm, texts["title"])
            self.setFillColor(MUTED)
            self.setFont(regular, 7.5)
            self.drawString(18 * mm, 10 * mm, texts["brand"])
            self.drawRightString(width - 18 * mm, 10 * mm, texts["page"].format(n=self._pageNumber, total=total))
            self.restoreState()

    return NumberedCanvas


def build_report(result: ReadinessResult, locale: str, company: str | None = None, today: date | None = None) -> bytes:
    regular, bold = _register_fonts()
    texts = TEXTS["en" if locale == "en" else "bg"]
    s = _styles(regular, bold)
    names = texts["dimension_names"]
    band_title, band_text = texts["bands"][result.band]
    story: list = []

    # ------------------------------------------------------------------ cover + summary
    story += [
        Paragraph(escape(texts["title"]), s["title"]),
        Spacer(1, 2 * mm),
        Paragraph(escape(texts["subtitle"]), s["subtitle"]),
    ]
    meta = [f"{texts['generated']}: {(today or date.today()).isoformat()}", f"{texts['model']}: {MODEL_VERSION}"]
    if company:
        meta.insert(0, f"{texts['prepared_for']}: <b>{escape(company)}</b>")
    story += [Spacer(1, 4 * mm), Paragraph(" · ".join(meta), s["muted"]), Spacer(1, 6 * mm)]

    summary = Table(
        [
            [
                Paragraph(f"{result.overall}", s["score"]),
                [
                    Paragraph(f"{escape(texts['overall'])} · {escape(texts['out_of'])}", s["muted"]),
                    Spacer(1, 1.5 * mm),
                    Paragraph(
                        f"{escape(texts['band'])}: {escape(band_title)}",
                        ParagraphStyle("b", parent=s["band"], textColor=colors.HexColor(BAND_COLOURS[result.band])),
                    ),
                    Spacer(1, 1.5 * mm),
                    Paragraph(escape(band_text), s["body"]),
                ],
            ]
        ],
        colWidths=[34 * mm, None],
    )
    summary.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#eef6f7")),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        )
    )
    story += [Paragraph(escape(texts["summary"]), s["h2"]), summary]

    # ------------------------------------------------------------------ dimensions
    rows = [
        [Paragraph(f"<b>{escape(texts[k])}</b>", s["small"]) for k in ("dimension_col", "weight_col", "score_col")]
        + [""]
    ]
    for dimension, value in result.dimensions.items():
        rows.append(
            [
                Paragraph(escape(names[dimension]), s["body"]),
                Paragraph(f"{int(WEIGHTS[dimension])}%", s["body"]),
                Paragraph(str(value), s["body"]),
                _bar(value),
            ]
        )
    table = Table(rows, colWidths=[48 * mm, 22 * mm, 18 * mm, None])
    table.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
            ]
        )
    )
    story += [Paragraph(escape(texts["dimensions"]), s["h2"]), table]

    # ------------------------------------------------------------------ strengths / gaps
    def bullet_list(items: list[str], empty: str) -> list:
        if not items:
            return [Paragraph(escape(empty), s["muted"])]
        return [Paragraph(f"• {escape(names[i])} ({result.dimensions[i]})", s["body"]) for i in items]

    sg = Table(
        [
            [Paragraph(escape(texts["strengths"]), s["h3"]), Paragraph(escape(texts["gaps"]), s["h3"])],
            [bullet_list(result.strengths, texts["none_strengths"]), bullet_list(result.gaps, texts["none_gaps"])],
        ],
        colWidths=["50%", "50%"],
    )
    sg.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story += [Spacer(1, 4 * mm), sg]

    # ------------------------------------------------------------------ blockers
    story.append(Paragraph(escape(texts["blockers"]), s["h2"]))
    if result.blockers:
        cells = [
            [
                Paragraph(
                    f"<b>{escape(texts['blocker_texts'][b][0])}.</b> {escape(texts['blocker_texts'][b][1])}", s["warn"]
                )
            ]
            for b in result.blockers
        ]
        blockers = Table(cells, colWidths=["100%"])
        blockers.setStyle(
            TableStyle([("BACKGROUND", (0, 0), (-1, -1), WARN_BG), ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm)])
        )
        story.append(blockers)
    else:
        story.append(Paragraph(escape(texts["no_blockers"]), s["body"]))

    # ------------------------------------------------------------------ actions
    story.append(Paragraph(escape(texts["actions"]), s["h2"]))
    for index, action in enumerate(result.actions, start=1):
        title, text = texts["actions_texts"][action]
        service = texts["services"].get(ACTION_SERVICE[action], "")
        story.append(
            KeepTogether(
                [
                    Paragraph(f"<font color='#0c6670'>{index:02d}</font>  <b>{escape(title)}</b>", s["body"]),
                    Paragraph(escape(text), s["body"]),
                    Paragraph(f"{escape(texts['service'])}: {escape(service)}", s["small"]),
                    Spacer(1, 2.5 * mm),
                ]
            )
        )

    # ------------------------------------------------------------------ use cases
    story.append(Paragraph(escape(texts["use_cases"]), s["h2"]))
    for use_case in result.use_cases:
        title, text = texts["use_case_texts"][use_case]
        story.append(Paragraph(f"<b>{escape(title)}</b> — {escape(text)}", s["body"]))
        story.append(Spacer(1, 1.5 * mm))

    # ------------------------------------------------------------------ roadmap
    def roadmap_text(item: str) -> str:
        if item in texts["roadmap_items"]:
            return texts["roadmap_items"][item]
        return texts["actions_texts"][item][0]

    def roadmap_cell(phase: str) -> list:
        cell: list = []
        for item in result.roadmap[phase]:
            cell += [Paragraph(f"• {escape(roadmap_text(item))}", s["body"]), Spacer(1, 1 * mm)]
        return cell

    phases = ("d30", "d60", "d90")
    roadmap = Table(
        [
            [Paragraph(f"<b>{escape(texts['phases'][p])}</b>", s["h3"]) for p in phases],
            [roadmap_cell(p) for p in phases],
        ],
        colWidths=["33.3%", "33.3%", "33.4%"],
    )
    roadmap.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEABOVE", (0, 0), (-1, 0), 1.4, ACCENT),
                ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
            ]
        )
    )
    story += [Paragraph(escape(texts["roadmap"]), s["h2"]), roadmap]

    # ------------------------------------------------------------------ methodology
    story.append(Paragraph(escape(texts["methodology"]), s["h2"]))
    for paragraph in texts["methodology_paragraphs"]:
        story += [Paragraph(escape(paragraph), s["muted"]), Spacer(1, 1.5 * mm)]

    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=24 * mm,
        bottomMargin=18 * mm,
        title=texts["title"],
        author=texts["brand"],
        creator=texts["brand"],
        subject=texts["subtitle"],
    )
    document.build(story, canvasmaker=_numbered_canvas(texts, regular, bold))
    return buffer.getvalue()
