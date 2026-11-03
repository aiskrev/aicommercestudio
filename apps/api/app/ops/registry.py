"""Versioned configuration and prompt registry for managed AI systems (docs/AI_OPERATIONS_PORTAL.md §12).

A registry and review workflow only: nothing here deploys, calls a provider or executes anything.

* A version holds a prompt template, a model/provider reference, an allow-listed set of generation
  parameters and declared tools (name, kind, integration label, read/write access). No credentials:
  free text is checked for secrets, URLs are refused in tool declarations, unknown parameter keys are
  rejected, and nothing is ever evaluated or executed.
* Lifecycle: draft → in_review → approved → retired (a reviewer may send in_review back to draft).
  Approving a version retires the previously approved one of the same agent.
* A version is *sensitive* when it targets a production workspace, declares a write tool, or changes
  the provider or model of its base version. A sensitive version must be approved by someone other
  than its author, and a production version needs a recorded evaluation run of that exact version.
* Content is immutable after draft (database trigger) and its SHA-256 is verified on every read.
"""

from __future__ import annotations

import difflib
import hashlib
import json
import re
import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from fastapi import status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import audit
from app.errors import ApiError
from app.models import OpsAgent, OpsEnvironment, OpsWorkspace, utcnow
from app.ops.models import OpsAgentVersion, OpsEvalRun, VersionStatus
from app.ops.tenancy import OpsContext, audit_details, forbidden, get_scoped, scoped
from app.schemas import _URL_LIKE, StrictModel, _clean_text, _no_secrets

_NAME = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,59}$")
_LABEL = re.compile(r"^[A-Za-z0-9._:/ -]{1,80}$")


def _secret_free(value: str) -> str:
    return _no_secrets(_clean_text(value))


class Parameters(StrictModel):
    """Generation parameters. Only these keys exist; anything else (e.g. an API key) is rejected."""

    temperature: float | None = Field(default=None, ge=0, le=2)
    top_p: float | None = Field(default=None, ge=0, le=1)
    top_k: int | None = Field(default=None, ge=1, le=1000)
    max_tokens: int | None = Field(default=None, ge=1, le=200_000)
    stop_sequences: list[str] = Field(default_factory=list, max_length=4)

    @field_validator("stop_sequences")
    @classmethod
    def _stops(cls, values: list[str]) -> list[str]:
        for value in values:
            if not value or len(value) > 32:
                raise PydanticCustomError("ops_stop", "Stop sequences have 1–32 characters.")
            _secret_free(value)
        return values


class ToolKind(StrEnum):
    RETRIEVAL = "retrieval"
    ACTION = "action"
    FUNCTION = "function"


class Tool(StrictModel):
    """A declared tool: what the agent may call. A declaration only — no endpoint, code or credential."""

    name: str = Field(min_length=1, max_length=60)
    kind: ToolKind
    integration: str | None = Field(default=None, max_length=60)
    access: Literal["read", "write"]
    requires_approval: bool = False
    description: str | None = Field(default=None, max_length=300)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        if not _NAME.match(value):
            raise PydanticCustomError("ops_tool_name", "Tool names use lowercase letters, digits and . _ -")
        return value

    @field_validator("integration")
    @classmethod
    def _integration(cls, value: str | None) -> str | None:
        if value is not None and not _LABEL.match(value):
            raise PydanticCustomError("ops_label", "Use letters, digits and . _ : / -")
        return value

    @field_validator("description")
    @classmethod
    def _description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = _secret_free(value)
        if _URL_LIKE.search(value):
            raise PydanticCustomError("no_links", "Tool declarations cannot contain links or HTML.")
        return value

    @model_validator(mode="after")
    def _write_needs_approval(self) -> Tool:
        if self.access == "write" and not self.requires_approval:
            raise PydanticCustomError("ops_tool_approval", "A write tool must require human approval.")
        return self


class VersionContent(StrictModel):
    prompt_template: str = Field(min_length=1, max_length=20_000)
    provider: str | None = Field(default=None, max_length=40)
    model: str | None = Field(default=None, max_length=80)
    parameters: Parameters = Field(default_factory=Parameters)
    tools: list[Tool] = Field(default_factory=list, max_length=30)

    @field_validator("prompt_template")
    @classmethod
    def _prompt(cls, value: str) -> str:
        return _secret_free(value)

    @field_validator("provider", "model")
    @classmethod
    def _labels(cls, value: str | None) -> str | None:
        if value is not None and not _LABEL.match(value):
            raise PydanticCustomError("ops_label", "Use letters, digits and . _ : / -")
        return value

    @model_validator(mode="after")
    def _unique_tools(self) -> VersionContent:
        names = [t.name for t in self.tools]
        if len(names) != len(set(names)):
            raise PydanticCustomError("ops_tool_duplicate", "Tool names must be unique.")
        return self


class VersionCreate(StrictModel):
    content: VersionContent | None = None
    change_reason: str = Field(min_length=3, max_length=500)
    based_on_id: uuid.UUID | None = None
    # Creates a draft that restores the content of an earlier version (content must then be omitted).
    rollback_of_id: uuid.UUID | None = None

    @field_validator("change_reason")
    @classmethod
    def _reason(cls, value: str) -> str:
        return _secret_free(value)

    @model_validator(mode="after")
    def _content_or_rollback(self) -> VersionCreate:
        if (self.content is None) == (self.rollback_of_id is None):
            raise PydanticCustomError("ops_version_source", "Give either the content or a version to roll back to.")
        return self


class VersionUpdate(StrictModel):
    content: VersionContent | None = None
    change_reason: str | None = Field(default=None, min_length=3, max_length=500)

    @field_validator("change_reason")
    @classmethod
    def _reason(cls, value: str | None) -> str | None:
        return None if value is None else _secret_free(value)


class ReviewDecision(StrictModel):
    decision: Literal["approve", "request_changes"]
    note: str | None = Field(default=None, max_length=500)
    evaluation_run_id: uuid.UUID | None = None

    @field_validator("note")
    @classmethod
    def _note(cls, value: str | None) -> str | None:
        return None if value is None else _secret_free(value)


class VersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    number: int
    status: str
    environment: str
    provider: str | None
    model: str | None
    sensitive: bool
    change_reason: str
    based_on_id: uuid.UUID | None
    rollback_of_id: uuid.UUID | None
    created_by: uuid.UUID | None
    created_at: datetime
    submitted_at: datetime | None
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    review_note: str | None
    evaluation_run_id: uuid.UUID | None
    retired_at: datetime | None


class VersionOut(VersionSummary):
    prompt_template: str
    parameters: dict[str, Any]
    tools: list[dict[str, Any]]
    content_hash: str
    integrity_ok: bool
    evidence_simulated: bool | None = None


class FieldChange(BaseModel):
    field: str
    before: Any
    after: Any


class VersionDiff(BaseModel):
    from_version: int
    to_version: int
    changes: list[FieldChange]
    prompt_diff: list[str]


# ------------------------------------------------------------------------------------- logic

CONTENT_FIELDS = ("prompt_template", "provider", "model", "parameters", "tools")


def content_hash(content: dict[str, Any]) -> str:
    canonical = json.dumps(
        {k: content[k] for k in CONTENT_FIELDS}, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _content_of(version: OpsAgentVersion) -> dict[str, Any]:
    return {k: getattr(version, k) for k in CONTENT_FIELDS}


def _dump(content: VersionContent) -> dict[str, Any]:
    data = content.model_dump(mode="json")
    data["parameters"] = {k: v for k, v in data["parameters"].items() if v not in (None, [])}
    return data


def is_sensitive(environment: str, content: dict[str, Any], base: OpsAgentVersion | None) -> bool:
    if environment == OpsEnvironment.PRODUCTION:
        return True
    if any(tool.get("access") == "write" for tool in content["tools"]):
        return True
    return base is not None and (base.provider, base.model) != (content["provider"], content["model"])


def _error(code: str, detail: str, status_code: int = status.HTTP_409_CONFLICT) -> ApiError:
    return ApiError(status_code, detail, code)


def _record(db: Session, ctx: OpsContext, action: str, version: OpsAgentVersion, **extra: Any) -> None:
    # Never the prompt or tool content: identifiers, numbers and flags only.
    audit.record(
        db,
        action,
        actor=ctx.admin.user,
        entity_type="ops_agent_version",
        entity_id=str(version.id),
        details=audit_details(
            ctx,
            agent_id=str(version.agent_id),
            number=version.number,
            status=version.status,
            sensitive=version.sensitive,
            content_hash=version.content_hash,
            **extra,
        ),
        ip_hash=ctx.admin.ip_hash,
    )


def to_out(db: Session, version: OpsAgentVersion) -> VersionOut:
    out = VersionOut.model_validate(
        {
            **VersionSummary.model_validate(version).model_dump(),
            "prompt_template": version.prompt_template,
            "parameters": version.parameters,
            "tools": version.tools,
            "content_hash": version.content_hash,
            "integrity_ok": content_hash(_content_of(version)) == version.content_hash,
        }
    )
    if version.evaluation_run_id:
        run = db.get(OpsEvalRun, version.evaluation_run_id)
        out.evidence_simulated = run.simulated if run else None
    return out


def create_version(db: Session, ctx: OpsContext, agent_id: uuid.UUID, body: VersionCreate) -> OpsAgentVersion:
    agent = get_scoped(db, ctx, OpsAgent, agent_id)
    workspace = get_scoped(db, ctx, OpsWorkspace, agent.workspace_id)
    base_id = body.based_on_id
    if body.rollback_of_id is not None:
        source = get_scoped(db, ctx, OpsAgentVersion, body.rollback_of_id)
        if source.agent_id != agent.id or source.status not in (VersionStatus.APPROVED, VersionStatus.RETIRED):
            raise _error("ops_rollback_source", "Roll back only to an approved or retired version of this agent.")
        content = _content_of(source)
        base_id = base_id or source.id
    else:
        content = _dump(body.content)  # type: ignore[arg-type]
    base = None
    if base_id is not None:
        base = get_scoped(db, ctx, OpsAgentVersion, base_id)
        if base.agent_id != agent.id:
            raise ApiError(status.HTTP_404_NOT_FOUND, "Не е намерено.", "ops_not_found")
    number = (db.scalar(select(func.max(OpsAgentVersion.number)).where(OpsAgentVersion.agent_id == agent.id)) or 0) + 1
    version = OpsAgentVersion(
        organization_id=ctx.organization_id,
        agent_id=agent.id,
        number=number,
        status=VersionStatus.DRAFT,
        environment=workspace.environment,
        owner_user_id=ctx.admin.user.id,
        change_reason=body.change_reason,
        based_on_id=base.id if base else None,
        rollback_of_id=body.rollback_of_id,
        sensitive=is_sensitive(workspace.environment, content, base),
        content_hash=content_hash(content),
        created_by=ctx.admin.user.id,
        **content,
    )
    db.add(version)
    db.flush()
    _record(
        db, ctx, "ops.version_created", version, rollback_of=str(body.rollback_of_id) if body.rollback_of_id else None
    )
    db.commit()
    return version


def update_draft(db: Session, ctx: OpsContext, version: OpsAgentVersion, body: VersionUpdate) -> OpsAgentVersion:
    if version.status != VersionStatus.DRAFT:
        raise _error("ops_version_locked", "Only a draft can be edited; create a new version instead.")
    if body.content is not None:
        content = _dump(body.content)
        for key, value in content.items():
            setattr(version, key, value)
        base = db.get(OpsAgentVersion, version.based_on_id) if version.based_on_id else None
        version.sensitive = is_sensitive(version.environment, content, base)
        version.content_hash = content_hash(content)
    if body.change_reason is not None:
        version.change_reason = body.change_reason
    _record(db, ctx, "ops.version_updated", version)
    db.commit()
    return version


def submit(db: Session, ctx: OpsContext, version: OpsAgentVersion) -> OpsAgentVersion:
    if version.status != VersionStatus.DRAFT:
        raise _error("ops_transition", "Only a draft can be submitted for review.")
    version.status = VersionStatus.IN_REVIEW
    version.submitted_at = utcnow()
    _record(db, ctx, "ops.version_submitted", version)
    db.commit()
    return version


def review(db: Session, ctx: OpsContext, version: OpsAgentVersion, body: ReviewDecision) -> OpsAgentVersion:
    if version.status != VersionStatus.IN_REVIEW:
        raise _error("ops_transition", "Only a version in review can be decided.")
    if body.decision == "request_changes":
        version.status = VersionStatus.DRAFT
        version.reviewed_by, version.reviewed_at, version.review_note = ctx.admin.user.id, utcnow(), body.note
        _record(db, ctx, "ops.version_changes_requested", version)
        db.commit()
        return version
    if version.sensitive and version.created_by == ctx.admin.user.id:
        # Four eyes: the author cannot approve their own sensitive change, whatever their role.
        raise forbidden()
    run = None
    if body.evaluation_run_id is not None:
        run = get_scoped(db, ctx, OpsEvalRun, body.evaluation_run_id)
        if run.agent_version_id != version.id:
            raise _error("ops_evaluation_mismatch", "The evaluation run must be of this version.")
    if version.environment == OpsEnvironment.PRODUCTION and run is None:
        raise _error("ops_evaluation_required", "A production version needs an evaluation run of this version.")
    now = utcnow()
    previous = db.scalars(
        scoped(ctx, OpsAgentVersion).where(
            OpsAgentVersion.agent_id == version.agent_id, OpsAgentVersion.status == VersionStatus.APPROVED
        )
    ).all()
    for old in previous:
        old.status, old.retired_at = VersionStatus.RETIRED, now
        _record(db, ctx, "ops.version_retired", old, replaced_by=version.number)
    version.status = VersionStatus.APPROVED
    version.reviewed_by, version.reviewed_at, version.review_note = ctx.admin.user.id, now, body.note
    version.evaluation_run_id = run.id if run else None
    _record(
        db,
        ctx,
        "ops.version_approved",
        version,
        evaluation_run=str(run.id) if run else None,
        evidence_simulated=run.simulated if run else None,
    )
    db.commit()
    return version


def retire(db: Session, ctx: OpsContext, version: OpsAgentVersion) -> OpsAgentVersion:
    if version.status != VersionStatus.APPROVED:
        raise _error("ops_transition", "Only an approved version can be retired.")
    version.status, version.retired_at = VersionStatus.RETIRED, utcnow()
    _record(db, ctx, "ops.version_retired", version)
    db.commit()
    return version


def diff(a: OpsAgentVersion, b: OpsAgentVersion) -> VersionDiff:
    changes = [
        FieldChange(field=f, before=getattr(a, f), after=getattr(b, f))
        for f in CONTENT_FIELDS
        if f != "prompt_template" and getattr(a, f) != getattr(b, f)
    ]
    lines = list(
        difflib.unified_diff(
            a.prompt_template.splitlines(),
            b.prompt_template.splitlines(),
            fromfile=f"v{a.number}",
            tofile=f"v{b.number}",
            lineterm="",
            n=2,
        )
    )
    return VersionDiff(from_version=a.number, to_version=b.number, changes=changes, prompt_diff=lines)
