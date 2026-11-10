"""Version ids of the legal documents and consent wordings (docs/LEGAL_COMPLIANCE_REMEDIATION_2026-11-10.md).

One registry for the web and the API: `legal_versions.json` here is a copy of `apps/web/src/lib/legal-versions.json`
(scripts/test.ps1 fails when they differ). A version is the date of the text; the Bulgarian and the English texts are
revised together and share the id. What is recorded with a consent or an acceptance is always the id the web
showed, and the API refuses a stale id (`current` / `require_current`).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

DocumentKey = Literal[
    "privacy",
    "cookies",
    "terms",
    "subscription_terms",
    "withdrawal_info",
    "marketing_consent",
    "order_acceptance",
    "early_start",
]

_FILE = Path(__file__).with_name("legal_versions.json")


@lru_cache(maxsize=1)
def registry() -> dict[str, dict[str, object]]:
    return json.loads(_FILE.read_text(encoding="utf-8"))["documents"]


def version(key: DocumentKey) -> str:
    return str(registry()[key]["version"])


def review_status(key: DocumentKey) -> str:
    return str(registry()[key]["review"])


def is_current(key: DocumentKey, claimed: str | None) -> bool:
    return claimed is not None and claimed == version(key)


def status(key: DocumentKey) -> str:
    """draft | approved | published. A draft is a working text that may still change under the same id; an approved
    text was signed off by a lawyer (its hash is `approved_content_sha256`); a published one is live under that id."""
    return str(registry()[key].get("status", "draft"))


def languages(key: DocumentKey) -> list[str]:
    """The languages that share this version id. Always both: the two texts are revised and approved together."""
    return list(registry()[key].get("languages", ["bg", "en"]))  # type: ignore[arg-type]


def is_approved(key: DocumentKey) -> bool:
    return review_status(key) == "reviewed" and status(key) in ("approved", "published")


def pending_review() -> list[str]:
    """Document keys whose text is not approved, so it must not back a live contractual acceptance."""
    return [key for key in registry() if not is_approved(key)]  # type: ignore[arg-type]
