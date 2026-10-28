"""Assessment-specific extension points.

An extension is reviewed Python code registered here by name; a definition refers to it with
`"extension": "<name>"` (checked when the registry loads). It may add cross-question validation
and derive extra, JSON-safe values from the answers and the score. It can never change the
overall score, the band or the dimension scores: those come only from the versioned algorithm.
"""

from __future__ import annotations

from typing import Any

from app.assessments.answers import AnswerError, Answers
from app.assessments.definition import AssessmentDefinition
from app.assessments.scoring import ScoreResult


class AssessmentExtension:
    """Base class with no-op hooks. Subclasses override what they need."""

    name: str = ""

    def validate(self, definition: AssessmentDefinition, answers: Answers) -> list[AnswerError]:
        """Cross-question checks after per-question validation passed."""
        return []

    def derive(self, definition: AssessmentDefinition, answers: Answers, result: ScoreResult) -> dict[str, Any]:
        """Extra values for the result (enumerated keys and numbers only, never free text)."""
        return {}


class ObservabilitySignals(AssessmentExtension):
    """Observability: which core telemetry signals are missing, and an on-call answer that needs telemetry."""

    name = "observability_signals"
    CORE_SIGNALS = ("logs", "metrics", "traces")

    def validate(self, definition: AssessmentDefinition, answers: Answers) -> list[AnswerError]:
        if answers.get("alert_routing") == "on_call_rotation" and not answers.get("telemetry"):
            return [AnswerError("alert_routing", "inconsistent")]
        return []

    def derive(self, definition: AssessmentDefinition, answers: Answers, result: ScoreResult) -> dict[str, Any]:
        collected = answers.get("telemetry") or ()
        return {"missing_signals": [s for s in self.CORE_SIGNALS if s not in collected]}


EXTENSIONS: dict[str, AssessmentExtension] = {ext.name: ext for ext in (ObservabilitySignals(),)}
