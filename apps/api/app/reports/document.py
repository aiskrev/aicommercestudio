"""Typed, renderer-neutral report documents (docs/REPORTS.md).

A tool builds a `ReportDocument` from its server-side result and server-owned texts; renderers turn
it into a PDF (`app/reports/pdf.py`) or JSON for the accessible HTML view in the web app. Documents
hold plain text only: every string is cleaned here (control characters removed, whitespace
collapsed, length capped) and escaped by each renderer, so nothing in a document is ever executed
or interpreted as markup. Size limits keep generation bounded whatever the input.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal

MAX_TEXT = 1500
MAX_ITEMS = 80
MAX_BLOCKS = 16
MAX_SECTIONS = 20
MAX_CHARACTERS = 80_000

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​-‏‪-‮⁦-⁩]")


class ReportTooLarge(ValueError):
    """The document exceeds the generation limits."""


def clean(text: Any, limit: int = MAX_TEXT) -> str:
    """Plain, single-paragraph text: no control or bidi-override characters, bounded length."""
    value = _CONTROL.sub(" ", str(text))
    value = " ".join(value.split())
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


@dataclass(frozen=True)
class Paragraph:
    text: str
    tone: Literal["normal", "muted", "notice"] = "normal"
    type: str = field(default="paragraph", init=False)


@dataclass(frozen=True)
class Bullets:
    items: tuple[str, ...]
    type: str = field(default="bullets", init=False)


@dataclass(frozen=True)
class Table:
    headers: tuple[str, ...]
    rows: tuple[tuple[str, ...], ...]
    type: str = field(default="table", init=False)


@dataclass(frozen=True)
class ScoreRow:
    label: str
    score: int
    level: str


@dataclass(frozen=True)
class Scores:
    rows: tuple[ScoreRow, ...]
    type: str = field(default="scores", init=False)


@dataclass(frozen=True)
class Finding:
    title: str
    description: str
    # Short tag such as "30 days" or a domain name; may be empty.
    label: str = ""
    because: tuple[str, ...] = ()


@dataclass(frozen=True)
class Findings:
    items: tuple[Finding, ...]
    because_label: str = ""
    type: str = field(default="findings", init=False)


Block = Paragraph | Bullets | Table | Scores | Findings


@dataclass(frozen=True)
class Section:
    heading: str
    blocks: tuple[Block, ...]


@dataclass(frozen=True)
class ReportDocument:
    locale: Literal["bg", "en"]
    brand: str
    title: str
    subtitle: str
    meta: tuple[tuple[str, str], ...]
    sections: tuple[Section, ...]
    footer: str

    def to_dict(self) -> dict[str, Any]:
        """JSON for the web's HTML report view (same content as the PDF)."""
        return {
            "schema_version": "1",
            "locale": self.locale,
            "brand": self.brand,
            "title": self.title,
            "subtitle": self.subtitle,
            "meta": [{"label": k, "value": v} for k, v in self.meta],
            "sections": [{"heading": s.heading, "blocks": [_block_dict(b) for b in s.blocks]} for s in self.sections],
            "footer": self.footer,
        }


def _block_dict(block: Block) -> dict[str, Any]:
    if isinstance(block, Paragraph):
        return {"type": block.type, "text": block.text, "tone": block.tone}
    if isinstance(block, Bullets):
        return {"type": block.type, "items": list(block.items)}
    if isinstance(block, Table):
        return {"type": block.type, "headers": list(block.headers), "rows": [list(r) for r in block.rows]}
    if isinstance(block, Scores):
        return {
            "type": block.type,
            "rows": [{"label": r.label, "score": r.score, "level": r.level} for r in block.rows],
        }
    return {
        "type": block.type,
        "because_label": block.because_label,
        "items": [
            {"title": f.title, "description": f.description, "label": f.label, "because": list(f.because)}
            for f in block.items
        ],
    }


def _text_size(document: ReportDocument) -> int:
    size = len(document.title) + len(document.subtitle) + len(document.footer)
    size += sum(len(k) + len(v) for k, v in document.meta)
    for section in document.sections:
        size += len(section.heading)
        for block in section.blocks:
            if isinstance(block, Paragraph):
                size += len(block.text)
            elif isinstance(block, Bullets):
                size += sum(len(i) for i in block.items)
            elif isinstance(block, Table):
                size += sum(len(c) for row in (block.headers, *block.rows) for c in row)
            elif isinstance(block, Scores):
                size += sum(len(r.label) + len(r.level) for r in block.rows)
            else:
                size += sum(len(f.title) + len(f.description) + sum(len(b) for b in f.because) for f in block.items)
    return size


def check_limits(document: ReportDocument) -> ReportDocument:
    """Reject documents that would make generation unbounded (callers turn this into an error)."""
    if len(document.sections) > MAX_SECTIONS:
        raise ReportTooLarge("too many sections")
    for section in document.sections:
        if len(section.blocks) > MAX_BLOCKS:
            raise ReportTooLarge("too many blocks")
        for block in section.blocks:
            count = len(getattr(block, "items", ())) + len(getattr(block, "rows", ()))
            if count > MAX_ITEMS:
                raise ReportTooLarge("too many items")
    if _text_size(document) > MAX_CHARACTERS:
        raise ReportTooLarge("too much text")
    return document
