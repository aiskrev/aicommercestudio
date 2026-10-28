"""Plain-text rules for catalogue content.

Catalogue texts are plain text: the website renders them as React text nodes, never as HTML or
Markdown. Anything that looks like markup, a script URL or an invisible formatting character is
rejected instead of escaped, so stored content stays safe for every future consumer (PDF, e-mail,
JSON-LD) too.
"""

from __future__ import annotations

import re

from pydantic_core import PydanticCustomError

# Tags and comments (<b>, </p>, <!-- -->, <script ...>); a lone "<" in prose ("< 5 дни") is allowed.
_MARKUP = re.compile(r"<\s*[/!?]?\s*[a-zA-Z]")
_SCRIPT_SCHEME = re.compile(r"(?:javascript|vbscript|data)\s*:", re.IGNORECASE)
# HTML entities and Markdown links/images: both would be rendered literally, so they are mistakes.
_ENTITY = re.compile(r"&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]{2,8});")
_MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\([^)]*\)")
# C0/C1 controls except tab and newline; bidi overrides and zero-width characters (spoofing).
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f​-‏‪-‮⁦-⁩﻿]")


def check_plain_text(value: str, *, multiline: bool = False) -> str:
    """Return the trimmed text or raise a field error (types listed in app.i18n.VALIDATION_MESSAGES)."""
    text = value.strip()
    if _CONTROL.search(text) or (not multiline and ("\n" in text or "\t" in text)):
        raise PydanticCustomError("control_chars", "Текстът съдържа непозволени символи.")
    if _MARKUP.search(text) or _ENTITY.search(text) or _MARKDOWN_LINK.search(text):
        raise PydanticCustomError("markup", "Използвайте само обикновен текст, без HTML или Markdown.")
    if _SCRIPT_SCHEME.search(text):
        raise PydanticCustomError("markup", "Използвайте само обикновен текст, без HTML или Markdown.")
    if multiline:
        text = re.sub(r"\n{3,}", "\n\n", text)
    return text
