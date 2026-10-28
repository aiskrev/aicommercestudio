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


class DevopsEvidence(AssessmentExtension):
    """DevOps delivery: keeps self-reported practices apart from the delivery metrics.

    Metrics are optional and never scored. A metrics source without any metric is inconsistent;
    the derived `metrics_evidence` says whether the numbers were measured by tooling, estimated,
    given without a source, or not given at all, so they are never presented as measured by default.
    """

    name = "devops_evidence"
    METRICS = ("dora_deploy_frequency", "dora_lead_time_hours", "dora_change_failure_rate", "dora_restore_hours")

    def validate(self, definition: AssessmentDefinition, answers: Answers) -> list[AnswerError]:
        if "dora_source" in answers and not any(m in answers for m in self.METRICS):
            return [AnswerError("dora_source", "inconsistent")]
        return []

    def derive(self, definition: AssessmentDefinition, answers: Answers, result: ScoreResult) -> dict[str, Any]:
        provided = [m for m in self.METRICS if m in answers]
        if not provided:
            evidence = "none"
        else:
            evidence = {"tooling": "measured", "estimate": "estimate"}.get(answers.get("dora_source"), "unspecified")
        return {"metrics_provided": len(provided), "metrics_evidence": evidence}


EXTENSIONS: dict[str, AssessmentExtension] = {
    ext.name: ext for ext in (ObservabilitySignals(), DevopsEvidence())
}
