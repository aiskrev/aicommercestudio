"""Projects and assessment versions on top of the free Advisor, which stays exactly as it is.

An assessment is produced by the existing `advisor.create_assessment`: same prompts, sanitising,
scoring and human-approval rules. This module only decides who may run it, reserves quota and keeps
the result. `result_kind` records what really produced a result, not what was requested.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.advisor import service as advisor
from app.advisor.safety import screen_text
from app.advisor.schemas import (
    DESCRIPTION_MAX,
    DESCRIPTION_MIN,
    AdvisorContext,
    AdvisorRequest,
    BusinessType,
    MonthlyVolume,
    TeamSize,
    ToolKey,
)
from app.ai.factory import get_ai_provider
from app.ai.mock import MockProvider
from app.config import Settings
from app.models import AdvisorMode
from app.workspace import usage
from app.workspace.entitlements import Entitlements
from app.workspace.models import AssessmentVersion, ResultKind, WorkspaceProject

SECTIONS = (
    "opportunities",
    "proposed_workflow",
    "integrations",
    "human_approvals",
    "data_protection",
    "risks",
    "phases",
    "clarification_questions",
    "next_steps",
)
PREVIEW_CHARS = 160


class RunIn(BaseModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    engine: str = Field(default="template", pattern="^(template|ai)$")
    business_type: BusinessType | None = None
    process_description: str | None = Field(default=None, min_length=DESCRIPTION_MIN, max_length=DESCRIPTION_MAX)
    monthly_volume: MonthlyVolume | None = None
    team_size: TeamSize | None = None
    tools: list[ToolKey] = Field(default_factory=list, max_length=len(ToolKey))
    other_tools: str = Field(default="", max_length=200)
    context: AdvisorContext | None = None
    locale: str = Field(default="bg", pattern="^(bg|en)$")
    label: str | None = Field(default=None, max_length=80)
    parent_number: int | None = Field(default=None, ge=1)
    clarification: str | None = Field(default=None, min_length=3, max_length=1000)

    @model_validator(mode="after")
    def _complete(self) -> RunIn:
        if self.clarification and self.parent_number is None:
            raise ValueError("A clarification needs parent_number")
        if self.parent_number is None and not (
            self.business_type and self.process_description and self.monthly_volume and self.team_size
        ):
            raise ValueError("A new assessment needs its inputs")
        return self


class WorkspaceError(Exception):
    def __init__(self, status: int, code: str, detail: str, extra: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.status, self.code, self.detail, self.extra = status, code, detail, extra or {}


def not_found() -> WorkspaceError:
    return WorkspaceError(404, "not_found", "Not found.")


def not_in_plan(feature: str) -> WorkspaceError:
    return WorkspaceError(403, "feature_not_in_plan", "Your plan doesn't include this.", {"feature": feature})


def project_of(db: Session, workspace_id: uuid.UUID, project_id: uuid.UUID, *, lock: bool = False) -> WorkspaceProject:
    """The only way to reach a project. Someone else's answers the same as one that doesn't exist."""
    query = select(WorkspaceProject).where(
        WorkspaceProject.id == project_id, WorkspaceProject.workspace_id == workspace_id
    )
    project = db.scalar(query.with_for_update() if lock else query)
    if project is None:
        raise not_found()
    return project


def version_of(db: Session, project_id: uuid.UUID, number: int) -> AssessmentVersion:
    version = db.scalar(
        select(AssessmentVersion).where(AssessmentVersion.project_id == project_id, AssessmentVersion.number == number)
    )
    if version is None:
        raise not_found()
    return version


def locked(version: AssessmentVersion, rights: Entitlements) -> bool:
    return version.result_kind == ResultKind.AI_MODEL.value and not rights.has("ai_results")


def present(version: AssessmentVersion, rights: Entitlements) -> dict[str, Any]:
    """A version as an API answer. A locked result returns a short preview and never the full text."""
    hidden = locked(version, rights)
    summary = version.result["problem_summary"]
    return {
        "number": version.number,
        "parent_number": version.parent_number,
        "label": version.label,
        "clarification": version.clarification,
        "result_kind": version.result_kind,
        "provider": version.provider,
        "model": version.model,
        "created_at": version.created_at.isoformat(),
        "disclaimer": version.disclaimer,
        "notices": version.notices,
        "locked": hidden,
        "preview": summary[:PREVIEW_CHARS],
        "complexity": version.result["complexity"]["level"],
        "assessment": None if hidden else version.result,
        "insights": None if hidden else version.insights,
    }


def _inputs(db: Session, project: WorkspaceProject, data: RunIn, rights: Entitlements) -> dict[str, Any]:
    if data.parent_number is None:
        base = data.model_dump(mode="json", include={"business_type", "monthly_volume", "team_size", "tools"})
        base |= {"process_description": data.process_description, "other_tools": data.other_tools}
        base["context"] = data.context.model_dump(mode="json") if data.context else None
    else:
        if not rights.has("follow_ups"):
            raise not_in_plan("follow_ups")
        base = dict(version_of(db, project.id, data.parent_number).inputs)
    if data.clarification:
        base["process_description"] = f"{base['process_description']}\n\n{data.clarification}"
    size = len(base["process_description"])
    if size > min(rights.limit("limit_input_chars"), DESCRIPTION_MAX):
        raise WorkspaceError(422, "input_too_large", "The description is too long.", {"size": size})
    return base


def _hash(project_id: uuid.UUID, data: RunIn) -> str:
    body = json.dumps([str(project_id), data.model_dump(mode="json")], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(body.encode()).hexdigest()


def _items(settings: Settings, engine: str, rights: Entitlements) -> list[usage.Item]:
    if engine == "template":
        return [usage.Item("limit_template_runs_month", 1, rights.limit("limit_template_runs_month"))]
    cost = settings.workspace_ai_call_cost_micros
    return [
        usage.Item("limit_ai_runs_month", 1, rights.limit("limit_ai_runs_month")),
        usage.Item("limit_ai_cost_micros_month", cost, rights.limit("limit_ai_cost_micros_month"), kind="cost"),
        usage.Item(
            "global_ai_cost_micros",
            cost,
            settings.workspace_ai_global_monthly_micros,
            kind="cost",
            scope=usage.GLOBAL_SCOPE,
        ),
    ]


def _save(
    db: Session, project_id: uuid.UUID, data: RunIn, inputs: dict[str, Any], response: Any, rights: Entitlements
) -> AssessmentVersion:
    project = db.scalar(select(WorkspaceProject).where(WorkspaceProject.id == project_id).with_for_update())
    if project is None:
        raise not_found()
    count = db.scalar(
        select(func.count()).select_from(AssessmentVersion).where(AssessmentVersion.project_id == project_id)
    )
    if count >= rights.limit("limit_versions_per_project"):
        raise WorkspaceError(403, "quota_exceeded", "This project has no room for more versions.")
    screened = dict(inputs)
    screened["process_description"] = screen_text(inputs["process_description"], data.locale).text
    insights = getattr(response, "insights", None)
    version = AssessmentVersion(
        id=uuid.uuid4(),
        project_id=project_id,
        number=(
            db.scalar(select(func.max(AssessmentVersion.number)).where(AssessmentVersion.project_id == project_id)) or 0
        )
        + 1,
        parent_number=data.parent_number,
        label=data.label,
        clarification=screen_text(data.clarification, data.locale).text if data.clarification else None,
        inputs=screened,
        result=response.assessment.model_dump(mode="json"),
        insights=insights.model_dump(mode="json") if insights else None,
        notices=response.notices,
        disclaimer=response.disclaimer,
        result_kind=(ResultKind.AI_MODEL if response.mode == AdvisorMode.AI.value else ResultKind.TEMPLATE).value,
        provider=response.provider,
        model=response.model[:64],
        locale=data.locale,
    )
    db.add(version)
    db.flush()
    return version


def run(
    db: Session,
    settings: Settings,
    workspace_id: uuid.UUID,
    project_id: uuid.UUID,
    data: RunIn,
    key: str,
    rights: Entitlements,
) -> AssessmentVersion:
    project = project_of(db, workspace_id, project_id)
    if data.engine == "ai":
        if not rights.has("ai_assessments"):
            raise not_in_plan("ai_assessments")
        provider = get_ai_provider()
        if provider.name == "mock":
            raise WorkspaceError(503, "ai_unavailable", "A real AI model isn't connected. Use a template assessment.")
    else:
        provider = MockProvider()
    inputs = _inputs(db, project, data, rights)

    ttl = int(settings.advisor_timeout_seconds * 2) + 60
    try:
        reserved = usage.reserve(workspace_id, key, _hash(project_id, data), _items(settings, data.engine, rights), ttl)
    except usage.QuotaExceeded as exc:
        raise WorkspaceError(
            403, "quota_exceeded", "This month's limit is reached.", {"metric": exc.metric, "limit": exc.limit}
        ) from exc
    except usage.IdempotencyConflict as exc:
        raise WorkspaceError(409, "idempotency_conflict", "This key was used for a different request.") from exc
    except usage.InProgress as exc:
        raise WorkspaceError(409, "in_progress", "This request is still running.") from exc
    if reserved.replay_version_id:
        replay = db.get(AssessmentVersion, reserved.replay_version_id)
        if replay is None:
            raise not_found()
        return replay

    request = AdvisorRequest(
        business_type=inputs["business_type"],
        process_description=inputs["process_description"],
        monthly_volume=inputs["monthly_volume"],
        team_size=inputs["team_size"],
        tools=inputs["tools"],
        other_tools=inputs["other_tools"],
        save_assessment=False,
        locale=data.locale,
        contract_version="2" if inputs.get("context") else "1",
        context=inputs.get("context"),
    )
    try:
        response = advisor.create_assessment(db, settings, provider, request)
    except advisor.AdvisorError as exc:
        usage.fail(reserved.id, usage.PROVIDER_ERRORS.get(exc.kind, "timeout"))
        raise
    except Exception:
        usage.fail(reserved.id, "timeout")
        raise

    # The daily spending guard may have answered from the template engine: then no AI was used.
    outcome = "not_called" if data.engine == "ai" and response.mode != AdvisorMode.AI.value else "success"
    try:
        version = _save(db, project_id, data, inputs, response, rights)
        if outcome == "success":
            usage.finish(db, reserved.id, "success", version.id)
        else:
            usage.finish(db, reserved.id, outcome)
        db.commit()
    except usage.ReservationLost as exc:
        db.rollback()
        raise WorkspaceError(409, "reservation_expired", "This took too long. Please try again.") from exc
    except WorkspaceError:
        db.rollback()
        usage.fail(reserved.id, "save_failed")
        raise
    except Exception:
        db.rollback()
        usage.fail(reserved.id, "save_failed")
        raise
    return version


def compare(left: AssessmentVersion, right: AssessmentVersion) -> dict[str, Any]:
    """A plain side-by-side of what each version says. It compares; it does not re-score anything."""

    def items(version: AssessmentVersion, section: str) -> list[str]:
        return [json.dumps(item, sort_keys=True, ensure_ascii=False) for item in version.result.get(section, [])]

    sections = {}
    for section in SECTIONS:
        a, b = items(left, section), items(right, section)
        sections[section] = {
            "left_count": len(a),
            "right_count": len(b),
            "only_left": [json.loads(x) for x in a if x not in b],
            "only_right": [json.loads(x) for x in b if x not in a],
        }
    return {
        "left": {"number": left.number, "label": left.label, "result_kind": left.result_kind},
        "right": {"number": right.number, "label": right.label, "result_kind": right.result_kind},
        "complexity": {"left": left.result["complexity"]["level"], "right": right.result["complexity"]["level"]},
        "sections": sections,
    }


def _lines(value: Any, depth: int = 0) -> list[str]:
    pad = "  " * depth
    if isinstance(value, dict):
        return [line for v in value.values() for line in _lines(v, depth)]
    if isinstance(value, list):
        return [line for v in value for line in _lines(v, depth)]
    return [f"{pad}- {value}"]


def to_markdown(project: WorkspaceProject, version: AssessmentVersion) -> str:
    kind = {"template": "Template assessment", "ai_model": f"AI model result ({version.model})"}[version.result_kind]
    lines = [
        f"# {project.name}: version {version.number}",
        "",
        f"**{kind}**",
        "",
        version.disclaimer,
        "",
        "## problem_summary",
        "",
        version.result["problem_summary"],
        "",
        "## complexity",
        "",
        *_lines(version.result["complexity"]),
    ]
    for section in SECTIONS:
        lines += ["", f"## {section}", "", *_lines(version.result.get(section, []))]
    return "\n".join(lines) + "\n"
