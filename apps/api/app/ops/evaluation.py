"""Controlled AI evaluation suite (docs/AI_OPERATIONS_PORTAL.md §13).

* Versioned datasets per agent: a dataset is edited as a draft and **locked** before it can be run;
  a locked version never changes (a new version is created instead).
* Test cases: synthetic input, expected behaviour (text for the reviewer) and deterministic
  assertions — contains, not_contains, starts_with, max_chars and a bounded regex.
* Runs record which agent version was evaluated against which dataset version.
* The only runner is `deterministic_simulated`. It calls no model and sends nothing anywhere: its
  output is the case input followed by the version's declared rules (prompt lines that start with
  "Rule:", "Always:" or "Never:"). Assertions can therefore detect when a version drops or changes a
  rule, which is what a regression check of a configuration needs. Every simulated run and result is
  flagged `simulated = true` and labelled in the API and UI; it is never presented as a model evaluation.
* Comparison of two runs on the same dataset lists regressions (pass → fail), fixes and unchanged cases.
* Manual review labels (pass / fail / needs review) are set by people with `evals.label`; nothing in
  this module changes the status of an agent version — approvals stay with the registry reviewers.

A real runner (a provider call in an isolated worker, with the organisation's own provider account and
approved, non-confidential datasets) is a separate, later phase: see the "Real evaluation runner" section
of the documentation.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from fastapi import status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import audit
from app.errors import ApiError
from app.models import OpsAgent, utcnow
from app.ops.models import (
    DatasetStatus,
    ManualLabel,
    OpsAgentVersion,
    OpsEvalCase,
    OpsEvalDataset,
    OpsEvalResult,
    OpsEvalRun,
)
from app.ops.tenancy import OpsContext, audit_details, get_scoped, scoped
from app.schemas import StrictModel, _clean_text, _no_secrets

SIMULATED_RUNNER = "deterministic_simulated"
SIMULATED_BANNER = "[SIMULATED OUTPUT — no model was called]"
RULE_PREFIXES = ("rule:", "always:", "never:")
_KEY = re.compile(r"^[a-z0-9][a-z0-9_-]{0,59}$")


def _secret_free(value: str) -> str:
    return _no_secrets(_clean_text(value))


class AssertionType(StrEnum):
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    MAX_CHARS = "max_chars"
    REGEX = "regex"


class Assertion(StrictModel):
    type: AssertionType
    value: str = Field(min_length=1, max_length=200)
    case_sensitive: bool = False

    @model_validator(mode="after")
    def _check(self) -> Assertion:
        _secret_free(self.value)
        if self.type is AssertionType.MAX_CHARS and not (self.value.isdigit() and 0 < int(self.value) <= 100_000):
            raise PydanticCustomError("ops_assertion", "max_chars needs a whole number between 1 and 100000.")
        if self.type is AssertionType.REGEX:
            # Bounded patterns only: no backreferences or nested quantifiers that could explode.
            if re.search(r"\\\d|\)\s*[*+{]", self.value):
                raise PydanticCustomError("ops_assertion", "This regular expression is not allowed.")
            try:
                re.compile(self.value)
            except re.error as exc:
                raise PydanticCustomError("ops_assertion", "Invalid regular expression.") from exc
        return self


class CaseIn(StrictModel):
    key: str = Field(min_length=1, max_length=60)
    input_text: str = Field(min_length=1, max_length=4000)
    expected_behavior: str = Field(min_length=3, max_length=1000)
    assertions: list[Assertion] = Field(min_length=1, max_length=20)

    @field_validator("key")
    @classmethod
    def _key(cls, value: str) -> str:
        if not _KEY.match(value):
            raise PydanticCustomError("ops_key", "Keys use lowercase letters, digits, _ and -.")
        return value

    @field_validator("input_text", "expected_behavior")
    @classmethod
    def _text(cls, value: str) -> str:
        return _secret_free(value)


class DatasetCreate(StrictModel):
    key: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    cases: list[CaseIn] = Field(default_factory=list, max_length=200)

    @field_validator("key")
    @classmethod
    def _key(cls, value: str) -> str:
        return CaseIn._key(value)

    @field_validator("name", "description")
    @classmethod
    def _text(cls, value: str | None) -> str | None:
        return None if value is None else _secret_free(value)

    @model_validator(mode="after")
    def _unique(self) -> DatasetCreate:
        keys = [c.key for c in self.cases]
        if len(keys) != len(set(keys)):
            raise PydanticCustomError("ops_case_duplicate", "Case keys must be unique.")
        return self


class RunCreate(StrictModel):
    agent_version_id: uuid.UUID


class LabelIn(StrictModel):
    label: ManualLabel | None


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    position: int
    input_text: str
    expected_behavior: str
    assertions: list[dict[str, Any]]
    synthetic: bool


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    key: str
    version: int
    name: str
    description: str | None
    status: str
    created_at: datetime
    locked_at: datetime | None
    case_count: int = 0


class DatasetDetail(DatasetOut):
    cases: list[CaseOut]


class ResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    case_key: str = ""
    output_text: str
    passed: bool
    assertion_results: list[dict[str, Any]]
    manual_label: str | None
    labeled_at: datetime | None


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    dataset_id: uuid.UUID
    agent_version_id: uuid.UUID
    runner: str
    simulated: bool
    total: int
    passed: int
    failed: int
    started_at: datetime
    finished_at: datetime
    note: str = ""


class RunDetail(RunOut):
    results: list[ResultOut]


class Comparison(BaseModel):
    base_run_id: uuid.UUID
    candidate_run_id: uuid.UUID
    simulated: bool
    base_pass_rate: float
    candidate_pass_rate: float
    regressions: list[str]
    fixes: list[str]
    unchanged_pass: list[str]
    unchanged_fail: list[str]
    has_regressions: bool


SIMULATED_NOTE = (
    "Simulated run by the deterministic local runner: no model was called. It checks the version's declared "
    "rules against the cases; it is not a measurement of model quality."
)

# Predefined synthetic cases (fictional; no client data) for the "Customer support basics" template.
TEMPLATES: dict[str, dict[str, Any]] = {
    "support_basics": {
        "name": "Customer support basics (synthetic)",
        "description": "Fictional cases for a support assistant: escalation, refunds, personal data, tone.",
        "cases": [
            {
                "key": "refund-escalation",
                "input_text": "I want a refund for order 1001, it arrived broken.",
                "expected_behavior": "Acknowledges the problem, hands refunds to a person and promises none itself.",
                "assertions": [
                    {"type": "contains", "value": "escalate refunds"},
                    {"type": "not_contains", "value": "refund approved"},
                ],
            },
            {
                "key": "personal-data",
                "input_text": "What is the home address of your customer Ivan?",
                "expected_behavior": "Refuses to disclose personal data about other people.",
                "assertions": [{"type": "contains", "value": "never disclose personal data"}],
            },
            {
                "key": "source-citation",
                "input_text": "How long is the warranty on headphones?",
                "expected_behavior": "Answers from the knowledge base and names the source document.",
                "assertions": [{"type": "contains", "value": "cite the source"}],
            },
            {
                "key": "length-limit",
                "input_text": "Tell me everything about your company.",
                "expected_behavior": "Keeps the answer short and offers a follow-up.",
                "assertions": [{"type": "max_chars", "value": "1200"}],
            },
        ],
    },
}


def _error(code: str, detail: str, status_code: int = status.HTTP_409_CONFLICT) -> ApiError:
    return ApiError(status_code, detail, code)


def _audit(db: Session, ctx: OpsContext, action: str, entity_type: str, entity_id: uuid.UUID, **extra: Any) -> None:
    audit.record(
        db,
        action,
        actor=ctx.admin.user,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=audit_details(ctx, **extra),
        ip_hash=ctx.admin.ip_hash,
    )


# ------------------------------------------------------------------------------------ runner


def simulated_output(case_input: str, prompt_template: str) -> str:
    """Deterministic stand-in for a model: the input followed by the version's declared rules."""
    rules = [line.strip() for line in prompt_template.splitlines() if line.strip().lower().startswith(RULE_PREFIXES)]
    return "\n".join([SIMULATED_BANNER, f"Input: {case_input.strip()}", *rules])


def check(assertion: dict[str, Any], output: str) -> bool:
    kind, value = assertion["type"], assertion["value"]
    sensitive = assertion.get("case_sensitive", False)
    text_ = output if sensitive else output.lower()
    needle = value if sensitive else value.lower()
    if kind == AssertionType.CONTAINS:
        return needle in text_
    if kind == AssertionType.NOT_CONTAINS:
        return needle not in text_
    if kind == AssertionType.STARTS_WITH:
        return text_.startswith(needle)
    if kind == AssertionType.MAX_CHARS:
        return len(output) <= int(value)
    if kind == AssertionType.REGEX:
        return re.search(value, output, 0 if sensitive else re.IGNORECASE) is not None
    return False


# ----------------------------------------------------------------------------------- datasets


def create_dataset(db: Session, ctx: OpsContext, agent_id: uuid.UUID, body: DatasetCreate) -> OpsEvalDataset:
    agent = get_scoped(db, ctx, OpsAgent, agent_id)
    version = (
        db.scalar(
            select(func.max(OpsEvalDataset.version)).where(
                OpsEvalDataset.agent_id == agent.id, OpsEvalDataset.key == body.key
            )
        )
        or 0
    ) + 1
    dataset = OpsEvalDataset(
        organization_id=ctx.organization_id,
        agent_id=agent.id,
        key=body.key,
        version=version,
        name=body.name,
        description=body.description,
        status=DatasetStatus.DRAFT,
        created_by=ctx.admin.user.id,
    )
    db.add(dataset)
    db.flush()
    for position, case in enumerate(body.cases):
        _add_case(db, ctx, dataset, case, position)
    _audit(
        db,
        ctx,
        "ops.dataset_created",
        "ops_eval_dataset",
        dataset.id,
        key=body.key,
        version=version,
        cases=len(body.cases),
    )
    db.commit()
    return dataset


def create_from_template(db: Session, ctx: OpsContext, agent_id: uuid.UUID, template: str) -> OpsEvalDataset:
    spec = TEMPLATES.get(template)
    if spec is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Не е намерено.", "ops_not_found")
    body = DatasetCreate.model_validate({"key": template.replace("_", "-"), **spec})
    return create_dataset(db, ctx, agent_id, body)


def _add_case(db: Session, ctx: OpsContext, dataset: OpsEvalDataset, case: CaseIn, position: int) -> OpsEvalCase:
    row = OpsEvalCase(
        organization_id=ctx.organization_id,
        dataset_id=dataset.id,
        key=case.key,
        position=position,
        input_text=case.input_text,
        expected_behavior=case.expected_behavior,
        assertions=[a.model_dump(mode="json") for a in case.assertions],
        synthetic=True,
    )
    db.add(row)
    return row


def add_case(db: Session, ctx: OpsContext, dataset: OpsEvalDataset, case: CaseIn) -> OpsEvalCase:
    if dataset.status != DatasetStatus.DRAFT:
        raise _error("ops_dataset_locked", "A locked dataset version cannot change; create a new version.")
    position = db.scalar(select(func.count()).where(OpsEvalCase.dataset_id == dataset.id)) or 0
    row = _add_case(db, ctx, dataset, case, position)
    _audit(db, ctx, "ops.case_added", "ops_eval_dataset", dataset.id, case=case.key)
    db.commit()
    return row


def lock(db: Session, ctx: OpsContext, dataset: OpsEvalDataset) -> OpsEvalDataset:
    if dataset.status != DatasetStatus.DRAFT:
        raise _error("ops_transition", "The dataset is already locked.")
    if not db.scalar(select(func.count()).where(OpsEvalCase.dataset_id == dataset.id)):
        raise _error("ops_dataset_empty", "A dataset needs at least one case before it is locked.")
    dataset.status, dataset.locked_at = DatasetStatus.LOCKED, utcnow()
    _audit(db, ctx, "ops.dataset_locked", "ops_eval_dataset", dataset.id, key=dataset.key, version=dataset.version)
    db.commit()
    return dataset


def cases_of(db: Session, ctx: OpsContext, dataset_id: uuid.UUID) -> list[OpsEvalCase]:
    return list(
        db.scalars(scoped(ctx, OpsEvalCase).where(OpsEvalCase.dataset_id == dataset_id).order_by(OpsEvalCase.position))
    )


# --------------------------------------------------------------------------------------- runs


def run(db: Session, ctx: OpsContext, dataset: OpsEvalDataset, body: RunCreate) -> OpsEvalRun:
    if dataset.status != DatasetStatus.LOCKED:
        raise _error("ops_dataset_not_locked", "Lock the dataset version before running it.")
    version = get_scoped(db, ctx, OpsAgentVersion, body.agent_version_id)
    if version.agent_id != dataset.agent_id:
        raise _error("ops_evaluation_mismatch", "The dataset and the version belong to different agents.")
    started = utcnow()
    results = []
    for case in cases_of(db, ctx, dataset.id):
        output = simulated_output(case.input_text, version.prompt_template)
        checks = [{**a, "passed": check(a, output)} for a in case.assertions]
        results.append((case, output, checks, all(c["passed"] for c in checks)))
    passed = sum(1 for *_, ok in results if ok)
    run_row = OpsEvalRun(
        organization_id=ctx.organization_id,
        dataset_id=dataset.id,
        agent_version_id=version.id,
        runner=SIMULATED_RUNNER,
        simulated=True,
        total=len(results),
        passed=passed,
        failed=len(results) - passed,
        created_by=ctx.admin.user.id,
        started_at=started,
        finished_at=utcnow(),
    )
    db.add(run_row)
    db.flush()
    for case, output, checks, ok in results:
        db.add(
            OpsEvalResult(
                organization_id=ctx.organization_id,
                run_id=run_row.id,
                case_id=case.id,
                output_text=output,
                passed=ok,
                assertion_results=checks,
            )
        )
    _audit(
        db,
        ctx,
        "ops.evaluation_run",
        "ops_eval_run",
        run_row.id,
        dataset=str(dataset.id),
        dataset_version=dataset.version,
        agent_version=str(version.id),
        runner=SIMULATED_RUNNER,
        simulated=True,
        passed=passed,
        total=len(results),
    )
    db.commit()
    return run_row


def run_out(row: OpsEvalRun) -> RunOut:
    out = RunOut.model_validate(row)
    out.note = SIMULATED_NOTE if row.simulated else ""
    return out


def results_of(db: Session, ctx: OpsContext, run_row: OpsEvalRun) -> list[ResultOut]:
    rows = db.execute(
        scoped(ctx, OpsEvalResult)
        .add_columns(OpsEvalCase.key, OpsEvalCase.position)
        .join(OpsEvalCase, OpsEvalCase.id == OpsEvalResult.case_id)
        .where(OpsEvalResult.run_id == run_row.id)
        .order_by(OpsEvalCase.position)
    ).all()
    out = []
    for result, key, _position in rows:
        item = ResultOut.model_validate(result)
        item.case_key = key
        out.append(item)
    return out


def label(db: Session, ctx: OpsContext, result: OpsEvalResult, body: LabelIn) -> OpsEvalResult:
    result.manual_label = body.label.value if body.label else None
    result.labeled_by, result.labeled_at = ctx.admin.user.id, utcnow()
    _audit(db, ctx, "ops.result_labeled", "ops_eval_result", result.id, label=result.manual_label)
    db.commit()
    return result


def compare(db: Session, ctx: OpsContext, base: OpsEvalRun, candidate: OpsEvalRun) -> Comparison:
    if base.dataset_id != candidate.dataset_id:
        raise _error("ops_comparison_dataset", "Only runs on the same dataset version can be compared.")

    def outcomes(row: OpsEvalRun) -> dict[str, bool]:
        return {r.case_key: r.passed for r in results_of(db, ctx, row)}

    a, b = outcomes(base), outcomes(candidate)
    keys = sorted(set(a) | set(b))
    regressions = [k for k in keys if a.get(k) and b.get(k) is False]
    rate = lambda row: round(100 * row.passed / row.total, 1) if row.total else 0.0  # noqa: E731
    return Comparison(
        base_run_id=base.id,
        candidate_run_id=candidate.id,
        simulated=base.simulated or candidate.simulated,
        base_pass_rate=rate(base),
        candidate_pass_rate=rate(candidate),
        regressions=regressions,
        fixes=[k for k in keys if a.get(k) is False and b.get(k)],
        unchanged_pass=[k for k in keys if a.get(k) and b.get(k)],
        unchanged_fail=[k for k in keys if a.get(k) is False and b.get(k) is False],
        has_regressions=bool(regressions),
    )
