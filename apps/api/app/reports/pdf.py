"""PDF renderer for `ReportDocument` (reportlab, in memory).

Reuses the branded page frame, the DejaVu fonts (Latin and Cyrillic) and the score bars of the
readiness report, so every PDF the platform produces looks the same. All text is XML-escaped before
it reaches reportlab's paragraph markup; the result is bounded by the document limits and by
`MAX_PDF_BYTES`.
"""

from __future__ import annotations

import io
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, ListFlowable, ListItem, SimpleDocTemplate, Spacer, TableStyle
from reportlab.platypus import Paragraph as PdfParagraph
from reportlab.platypus import Table as PdfTable

from app.readiness.report import LINE, WARN_BG, _bar, _numbered_canvas, _register_fonts, _styles
from app.reports.document import (
    Bullets,
    Findings,
    Paragraph,
    ReportDocument,
    ReportTooLarge,
    Scores,
    Table,
    check_limits,
)

MAX_PDF_BYTES = 2_000_000
PAGE_TEXTS = {"bg": "Страница {n} от {total}", "en": "Page {n} of {total}"}


def _p(text: str, style) -> PdfParagraph:
    return PdfParagraph(escape(text), style)


def _block(block, s, width: float) -> list:
    if isinstance(block, Paragraph):
        style = {"normal": s["body"], "muted": s["muted"], "notice": s["warn"]}[block.tone]
        if block.tone == "notice":
            box = PdfTable([[_p(block.text, style)]], colWidths=[width])
            box.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), WARN_BG),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            return [box, Spacer(1, 3 * mm)]
        return [_p(block.text, style), Spacer(1, 2 * mm)]
    if isinstance(block, Bullets):
        items = [ListItem(_p(item, s["body"]), leftIndent=10) for item in block.items]
        bullets = ListFlowable(
            items, bulletType="bullet", start="•", leftIndent=10, bulletFontName=s["body"].fontName
        )
        return [bullets, Spacer(1, 2 * mm)]
    if isinstance(block, Table):
        columns = len(block.headers)
        data = [[_p(h, s["h3"]) for h in block.headers]] + [[_p(c, s["body"]) for c in row] for row in block.rows]
        widths = [width * 0.45] + [width * 0.55 / (columns - 1)] * (columns - 1) if columns > 1 else [width]
        table = PdfTable(data, colWidths=widths, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        return [table, Spacer(1, 3 * mm)]
    if isinstance(block, Scores):
        rows = [
            [_p(r.label, s["body"]), _bar(r.score, width=48 * mm), _p(f"{r.score}/100 · {r.level}", s["muted"])]
            for r in block.rows
        ]
        table = PdfTable(rows, colWidths=[width * 0.42, 52 * mm, width * 0.58 - 52 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return [table, Spacer(1, 3 * mm)]
    if isinstance(block, Findings):
        flow: list = []
        for item in block.items:
            parts = [
                _p(item.title + (f" · {item.label}" if item.label else ""), s["h3"]),
                _p(item.description, s["body"]),
            ]
            if item.because:
                parts.append(_p(f"{block.because_label}: " + "; ".join(item.because), s["muted"]))
            parts.append(Spacer(1, 3 * mm))
            flow.append(KeepTogether(parts))
        return flow
    raise TypeError(f"unsupported block: {type(block).__name__}")  # pragma: no cover


def render_pdf(document: ReportDocument) -> bytes:
    """Render a document. Raises `ReportTooLarge` and `ReportUnavailable` (fonts missing)."""
    check_limits(document)
    regular, bold = _register_fonts()
    s = _styles(regular, bold)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=24 * mm,
        bottomMargin=18 * mm,
        title=document.title,
        author=document.brand,
    )
    width = A4[0] - 36 * mm
    story: list = [
        _p(document.title, s["title"]),
        Spacer(1, 2 * mm),
        _p(document.subtitle, s["subtitle"]),
        Spacer(1, 4 * mm),
        _p(" · ".join(f"{k}: {v}" for k, v in document.meta), s["muted"]),
        Spacer(1, 4 * mm),
    ]
    for section in document.sections:
        story.append(_p(section.heading, s["h2"]))
        for block in section.blocks:
            story += _block(block, s, width)
    story += [Spacer(1, 4 * mm), _p(document.footer, s["small"])]
    frame = {"brand": document.brand, "title": document.title[:70], "page": PAGE_TEXTS[document.locale]}
    doc.build(story, canvasmaker=_numbered_canvas(frame, regular, bold))
    pdf = buffer.getvalue()
    if len(pdf) > MAX_PDF_BYTES:
        raise ReportTooLarge("pdf too large")
    return pdf


__all__ = ["MAX_PDF_BYTES", "render_pdf"]
