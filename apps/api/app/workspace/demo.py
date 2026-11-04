"""Synthetic demo. Fixed data in code: it never touches workspace tables, so it cannot mix with real ones."""

from __future__ import annotations

from typing import Any

DEMO: dict[str, Any] = {
    "synthetic": True,
    "project": "Примерен магазин (синтетични данни)",
    "versions": [
        {
            "number": 1,
            "label": "Базов вариант",
            "result_kind": "template",
            "preview": "Измислен магазин обработва ръчно заявките за връщане на стоки.",
            "complexity": "low",
        },
        {
            "number": 2,
            "label": "С интеграция към склада",
            "result_kind": "template",
            "preview": "Същият измислен магазин, след уточнение за складовата система.",
            "complexity": "medium",
        },
    ],
}
