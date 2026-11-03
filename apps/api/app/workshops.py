"""Titles of the Workshops & Advisory catalogue for staff-facing text (proposal drafts, lead details).

`workshop_keys.json` is a byte-for-byte copy of apps/web/src/lib/workshop-keys.json (scripts/test.ps1
compares the two; the web tests compare that file with the page content, and the API tests compare its
keys with `WorkshopKey`).
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

_PATH = Path(__file__).with_name("workshop_keys.json")


@cache
def workshop_titles() -> dict[str, dict[str, str]]:
    return json.loads(_PATH.read_text(encoding="utf-8"))


def workshop_title(key: str, locale: str = "bg") -> str:
    titles = workshop_titles().get(key)
    return titles.get(locale, titles["bg"]) if titles else key
