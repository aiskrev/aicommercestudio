"""Bounded internal observability data model (docs/AI_OBSERVABILITY.md).

What exists: execution metadata (status, duration, error category, token counters), versioned rate
cards for estimated costs, workspace/agent aggregations, budgets, threshold rules evaluated on demand
and a per-organisation retention policy. Records come only from

* a **manual import** (JSON, at most 200 records per request, idempotent by `external_id`), or
* **synthetic** sample data, generated only for demo organisations and labelled as such.

There is no telemetry gateway, no message broker and no client integration. Prompt, input and
output content is never accepted: the import schema has no field for it and rejects unknown fields.
Every response states the data sources, the freshness of the newest record and `live: false`.

Costs are estimates: tokens × the rate card in force at the run's start (latest `effective_from`
not after it) for the run's provider/model. Runs without a matching card are counted as
`missing_rate` and excluded from cost totals, never priced at zero. Amounts are Decimal, rounded half
up to 4 places per run and summed per currency; currencies are never mixed or converted.
"""

from __future__ import annotations

import hashlib
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

from fastapi import status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import audit
from app.errors import ApiError
from app.models import OpsAgent, OpsWorkspace, utcnow
from app.ops.models import (
    ErrorCategory,
    Metric,
    OpsAgentVersion,
    OpsBudget,
    OpsEvalResult,
    OpsEvalRun,
    OpsRateCard,
    OpsRetentionPolicy,
    OpsRun,
    OpsThresholdRule,
    RecordSource,
    RunStatus,
)
from app.ops.tenancy import OpsContext, audit_details, scoped
from app.schemas import StrictModel, _clean_text, _no_secrets

# Fits the API's 64 KB request limit (a record is about 280 bytes of JSON).
MAX_IMPORT = 200
FOUR_PLACES = Decimal("0.0001")
MILLION = Decimal(1_000_000)


def _label(value: str | None) -> str | None:
    if value is None:
        return None
    value = _no_secrets(_clean_text(value))
    if not value or len(value) > 80 or not all(c.isalnum() or c in "._:/ -" for c in value):
        raise PydanticCustomError("ops_label", "Use letters, digits and . _ : / -")
    return value


# ------------------------------------------------------------------------------------ schemas


class RunIn(StrictModel):
    """One execution record. Metadata and counters only — there is no field for prompt or output content."""

    external_id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9._:-]+$")
    agent_id: uuid.UUID
    agent_version_id: uuid.UUID | None = None
    started_at: datetime
    duration_ms: int = Field(ge=0, le=86_400_000)
    status: RunStatus
    error_category: ErrorCategory | None = None
    provider: str | None = None
    model: str | None = None
    input_tokens: int = Field(default=0, ge=0, le=50_000_000)
    output_tokens: int = Field(default=0, ge=0, le=50_000_000)

    _labels = field_validator("provider", "model")(classmethod(lambda cls, v: _label(v)))

    @model_validator(mode="after")
    def _error_category(self) -> RunIn:
        if self.status is RunStatus.SUCCEEDED and self.error_category is not None:
            raise PydanticCustomError("ops_error_category", "A succeeded run has no error category.")
        if self.status is not RunStatus.SUCCEEDED and self.error_category is None:
            raise PydanticCustomError("ops_error_category", "A failed run needs an error category.")
        if self.started_at.tzinfo is None:
            raise PydanticCustomError("ops_timezone", "Timestamps need a time zone.")
        return self


class ImportIn(StrictModel):
    records: list[RunIn] = Field(min_length=1, max_length=MAX_IMPORT)


class ImportOut(BaseModel):
    batch_id: uuid.UUID
    received: int
    inserted: int
    duplicates: int
    source: Literal["manual_import"] = "manual_import"


class SyntheticIn(StrictModel):
    days: int = Field(default=14, ge=1, le=60)
    runs_per_day: int = Field(default=20, ge=1, le=200)


class RateCardIn(StrictModel):
    provider: str
    model: str
    version: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9._-]+$")
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    input_per_million: Decimal = Field(ge=0, le=Decimal("100000"), decimal_places=6)
    output_per_million: Decimal = Field(ge=0, le=Decimal("100000"), decimal_places=6)
    effective_from: datetime
    source_note: str = Field(min_length=3, max_length=300)

    _labels = field_validator("provider", "model")(classmethod(lambda cls, v: _label(v)))
    _note = field_validator("source_note")(classmethod(lambda cls, v: _no_secrets(_clean_text(v))))


class RateCardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    model: str
    version: str
    currency: str
    input_per_million: Decimal
    output_per_million: Decimal
    effective_from: datetime
    source_note: str
    created_at: datetime


class BudgetIn(StrictModel):
    name: str = Field(min_length=2, max_length=120)
    agent_id: uuid.UUID | None = None
    amount: Decimal = Field(gt=0, le=Decimal("100000000"), decimal_places=2)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    warn_percent: int = Field(default=80, ge=1, le=100)

    _name = field_validator("name")(classmethod(lambda cls, v: _no_secrets(_clean_text(v))))


class BudgetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    agent_id: uuid.UUID | None
    amount: Decimal
    currency: str
    warn_percent: int


class ThresholdIn(StrictModel):
    name: str = Field(min_length=2, max_length=120)
    agent_id: uuid.UUID | None = None
    metric: Metric
    threshold: Decimal = Field(ge=0, le=Decimal("1000000000"))
    window_days: int = Field(default=7, ge=1, le=90)
    enabled: bool = True

    _name = field_validator("name")(classmethod(lambda cls, v: _no_secrets(_clean_text(v))))


class ThresholdOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    agent_id: uuid.UUID | None
    metric: str
    threshold: Decimal
    window_days: int
    enabled: bool


class RetentionIn(StrictModel):
    runs_days: int = Field(ge=7, le=730)
    eval_results_days: int = Field(ge=30, le=1095)


class RetentionOut(BaseModel):
    runs_days: int
    eval_results_days: int
    configured: bool


class Freshness(BaseModel):
    """Always present: where the numbers come from and how old the newest record is."""

    live: Literal[False] = False
    sources: dict[str, int]
    latest_record_at: datetime | None
    note: str = (
        "No live telemetry. Records are synthetic samples or manual imports; costs are estimates from the "
        "rate cards entered here."
    )


class Group(BaseModel):
    key: str
    label: str
    runs: int
    succeeded: int
    failed: int
    error_rate_percent: float
    avg_duration_ms: float
    error_categories: dict[str, int]
    input_tokens: int
    output_tokens: int
    estimated_cost: dict[str, Decimal]
    missing_rate_runs: int


class Summary(BaseModel):
    period_days: int
    period_start: datetime
    group_by: Literal["agent", "workspace"]
    groups: list[Group]
    totals: Group
    freshness: Freshness


class BudgetStatus(BaseModel):
    budget: BudgetOut
    month_to_date: Decimal | None
    percent_used: float | None
    state: Literal["ok", "warning", "exceeded", "no_cost_data"]
    missing_rate_runs: int


class RuleStatus(BaseModel):
    rule: ThresholdOut
    value: Decimal | None
    breached: bool | None


class Evaluation(BaseModel):
    budgets: list[BudgetStatus]
    rules: list[RuleStatus]
    freshness: Freshness
    note: str = "Evaluated on request against stored records. Nothing is sent or notified."


# ------------------------------------------------------------------------------------- import


def _audit(db: Session, ctx: OpsContext, action: str, **extra: Any) -> None:
    audit.record(
        db,
        action,
        actor=ctx.admin.user,
        entity_type="ops_organization",
        entity_id=str(ctx.organization_id),
        details=audit_details(ctx, **extra),
        ip_hash=ctx.admin.ip_hash,
    )


def import_runs(
    db: Session, ctx: OpsContext, body: ImportIn, *, source: RecordSource = RecordSource.MANUAL_IMPORT
) -> ImportOut:
    agent_ids = {r.agent_id for r in body.records}
    known = set(db.scalars(scoped(ctx, OpsAgent).with_only_columns(OpsAgent.id).where(OpsAgent.id.in_(agent_ids))))
    if agent_ids - known:
        # Same answer for "another tenant's agent" and "no such agent": nothing to enumerate.
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown agent in the import.", "ops_import_agent")
    version_ids = {r.agent_version_id for r in body.records if r.agent_version_id}
    versions = {
        v.id: v.agent_id for v in db.scalars(scoped(ctx, OpsAgentVersion).where(OpsAgentVersion.id.in_(version_ids)))
    }
    for record in body.records:
        if record.agent_version_id and versions.get(record.agent_version_id) != record.agent_id:
            raise ApiError(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown agent version in the import.", "ops_import_version"
            )
    ids = [r.external_id for r in body.records]
    if len(ids) != len(set(ids)):
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Duplicate external_id in the import.", "ops_import_duplicate"
        )
    existing = set(
        db.scalars(scoped(ctx, OpsRun).with_only_columns(OpsRun.external_id).where(OpsRun.external_id.in_(ids)))
    )
    batch = uuid.uuid4()
    inserted = 0
    for record in body.records:
        if record.external_id in existing:
            continue
        db.add(OpsRun(organization_id=ctx.organization_id, source=source, batch_id=batch, **record.model_dump()))
        inserted += 1
    _audit(db, ctx, "ops.runs_imported", batch=str(batch), source=source.value, received=len(ids), inserted=inserted)
    db.commit()
    return ImportOut(batch_id=batch, received=len(ids), inserted=inserted, duplicates=len(ids) - inserted)


def synthetic_runs(db: Session, ctx: OpsContext, body: SyntheticIn, now: datetime | None = None) -> ImportOut:
    """Deterministic sample records for a demo organisation only; source = synthetic."""
    if not ctx.organization.is_demo:
        raise ApiError(status.HTTP_409_CONFLICT, "Synthetic records are only for demo organisations.", "ops_not_demo")
    now = (now or utcnow()).replace(minute=0, second=0, microsecond=0)
    agents = list(db.scalars(scoped(ctx, OpsAgent).order_by(OpsAgent.key)))
    records = []
    for agent in agents:
        for day in range(body.days):
            for n in range(body.runs_per_day):
                seed = int(hashlib.sha256(f"{agent.key}:{day}:{n}".encode()).hexdigest()[:8], 16)
                failed = seed % 17 == 0
                records.append(
                    RunIn(
                        external_id=f"synthetic:{agent.key}:{day}:{n}",
                        agent_id=agent.id,
                        started_at=now - timedelta(days=day, minutes=seed % 1440),
                        duration_ms=400 + seed % 3600,
                        status=RunStatus.FAILED if failed else RunStatus.SUCCEEDED,
                        error_category=(ErrorCategory.PROVIDER_ERROR, ErrorCategory.TIMEOUT, ErrorCategory.TOOL_ERROR)[
                            seed % 3
                        ]
                        if failed
                        else None,
                        provider=agent.provider or "sample-provider",
                        model=agent.model or "sample-model",
                        input_tokens=300 + seed % 2500,
                        output_tokens=80 + seed % 900,
                    )
                )
    out = ImportOut(batch_id=uuid.uuid4(), received=0, inserted=0, duplicates=0)
    for start in range(0, len(records), MAX_IMPORT):
        part = import_runs(
            db, ctx, ImportIn(records=records[start : start + MAX_IMPORT]), source=RecordSource.SYNTHETIC
        )
        out.received += part.received
        out.inserted += part.inserted
        out.duplicates += part.duplicates
        out.batch_id = part.batch_id
    return out


# -------------------------------------------------------------------------------- aggregation


def _rate_index(db: Session, ctx: OpsContext) -> dict[tuple[str, str], list[OpsRateCard]]:
    index: dict[tuple[str, str], list[OpsRateCard]] = defaultdict(list)
    for card in db.scalars(scoped(ctx, OpsRateCard).order_by(OpsRateCard.effective_from.desc())):
        index[(card.provider, card.model)].append(card)
    return index


def run_cost(run: OpsRun, index: dict[tuple[str, str], list[OpsRateCard]]) -> tuple[str, Decimal] | None:
    """(currency, cost) of one run with the card in force at its start, or None when no card applies."""
    for card in index.get((run.provider or "", run.model or ""), []):
        if card.effective_from <= run.started_at:
            cost = (
                Decimal(run.input_tokens) * card.input_per_million
                + Decimal(run.output_tokens) * card.output_per_million
            ) / MILLION
            return card.currency, cost.quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)
    return None


def _group(key: str, label: str, runs: list[OpsRun], index: dict) -> Group:
    succeeded = sum(1 for r in runs if r.status == RunStatus.SUCCEEDED)
    categories: dict[str, int] = defaultdict(int)
    costs: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    missing = 0
    for r in runs:
        if r.error_category:
            categories[r.error_category] += 1
        priced = run_cost(r, index)
        if priced is None:
            missing += 1
        else:
            costs[priced[0]] += priced[1]
    total = len(runs)
    return Group(
        key=key,
        label=label,
        runs=total,
        succeeded=succeeded,
        failed=total - succeeded,
        error_rate_percent=round(100 * (total - succeeded) / total, 2) if total else 0.0,
        avg_duration_ms=round(sum(r.duration_ms for r in runs) / total, 1) if total else 0.0,
        error_categories=dict(sorted(categories.items())),
        input_tokens=sum(r.input_tokens for r in runs),
        output_tokens=sum(r.output_tokens for r in runs),
        estimated_cost=dict(sorted(costs.items())),
        missing_rate_runs=missing,
    )


def freshness(db: Session, ctx: OpsContext) -> Freshness:
    runs = list(db.scalars(scoped(ctx, OpsRun).with_only_columns(OpsRun.source)))
    latest = db.scalar(
        scoped(ctx, OpsRun).with_only_columns(OpsRun.created_at).order_by(OpsRun.created_at.desc()).limit(1)
    )
    sources: dict[str, int] = defaultdict(int)
    for s in runs:
        sources[s] += 1
    return Freshness(sources=dict(sources), latest_record_at=latest)


def _runs_since(db: Session, ctx: OpsContext, since: datetime, agent_id: uuid.UUID | None = None) -> list[OpsRun]:
    stmt = scoped(ctx, OpsRun).where(OpsRun.started_at >= since)
    if agent_id:
        stmt = stmt.where(OpsRun.agent_id == agent_id)
    return list(db.scalars(stmt))


def summary(
    db: Session, ctx: OpsContext, days: int, group_by: Literal["agent", "workspace"], now: datetime | None = None
) -> Summary:
    start = (now or utcnow()) - timedelta(days=days)
    runs = _runs_since(db, ctx, start)
    index = _rate_index(db, ctx)
    agents = {a.id: a for a in db.scalars(scoped(ctx, OpsAgent))}
    workspaces = {w.id: w for w in db.scalars(scoped(ctx, OpsWorkspace))}
    buckets: dict[str, list[OpsRun]] = defaultdict(list)
    labels: dict[str, str] = {}
    for r in runs:
        agent = agents[r.agent_id]
        if group_by == "agent":
            key, label = str(agent.id), agent.name
        else:
            ws = workspaces[agent.workspace_id]
            key, label = str(ws.id), ws.name
        buckets[key].append(r)
        labels[key] = label
    groups = [_group(k, labels[k], buckets[k], index) for k in sorted(buckets, key=lambda k: labels[k])]
    return Summary(
        period_days=days,
        period_start=start,
        group_by=group_by,
        groups=groups,
        totals=_group("total", "total", runs, index),
        freshness=freshness(db, ctx),
    )


def _metric(metric: str, runs: list[OpsRun], index: dict) -> Decimal | None:
    if not runs:
        return None
    group = _group("", "", runs, index)
    if metric == Metric.ERROR_RATE_PERCENT:
        return Decimal(str(group.error_rate_percent))
    if metric == Metric.AVG_DURATION_MS:
        return Decimal(str(group.avg_duration_ms))
    if metric == Metric.TOKENS:
        return Decimal(group.input_tokens + group.output_tokens)
    # Estimated cost: only meaningful in a single currency and with every run priced.
    if group.missing_rate_runs or len(group.estimated_cost) != 1:
        return None
    return next(iter(group.estimated_cost.values()))


def evaluate(db: Session, ctx: OpsContext, now: datetime | None = None) -> Evaluation:
    now = now or utcnow()
    index = _rate_index(db, ctx)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    budgets = []
    for budget in db.scalars(scoped(ctx, OpsBudget).order_by(OpsBudget.name)):
        runs = _runs_since(db, ctx, month_start, budget.agent_id)
        group = _group("", "", runs, index)
        spent = group.estimated_cost.get(budget.currency)
        other_currency = any(c != budget.currency for c in group.estimated_cost)
        if spent is None and not runs:
            spent = Decimal(0)
        if spent is None or other_currency:
            state, percent = "no_cost_data", None
        else:
            percent = float(round(100 * spent / budget.amount, 1))
            state = "exceeded" if percent >= 100 else "warning" if percent >= budget.warn_percent else "ok"
        budgets.append(
            BudgetStatus(
                budget=BudgetOut.model_validate(budget),
                month_to_date=spent,
                percent_used=percent,
                state=state,
                missing_rate_runs=group.missing_rate_runs,
            )
        )
    rules = []
    for rule in db.scalars(scoped(ctx, OpsThresholdRule).order_by(OpsThresholdRule.name)):
        value = (
            _metric(rule.metric, _runs_since(db, ctx, now - timedelta(days=rule.window_days), rule.agent_id), index)
            if rule.enabled
            else None
        )
        rules.append(
            RuleStatus(
                rule=ThresholdOut.model_validate(rule),
                value=value,
                breached=None if value is None else value > rule.threshold,
            )
        )
    return Evaluation(budgets=budgets, rules=rules, freshness=freshness(db, ctx))


# ----------------------------------------------------------------------------------- retention


DEFAULT_RETENTION = RetentionOut(runs_days=90, eval_results_days=365, configured=False)


def retention(db: Session, ctx: OpsContext) -> RetentionOut:
    row = db.get(OpsRetentionPolicy, ctx.organization_id)
    if row is None:
        return DEFAULT_RETENTION
    return RetentionOut(runs_days=row.runs_days, eval_results_days=row.eval_results_days, configured=True)


def set_retention(db: Session, ctx: OpsContext, body: RetentionIn) -> RetentionOut:
    row = db.get(OpsRetentionPolicy, ctx.organization_id)
    if row is None:
        row = OpsRetentionPolicy(organization_id=ctx.organization_id)
        db.add(row)
    row.runs_days, row.eval_results_days = body.runs_days, body.eval_results_days
    row.updated_by, row.updated_at = ctx.admin.user.id, utcnow()
    _audit(db, ctx, "ops.retention_updated", runs_days=body.runs_days, eval_results_days=body.eval_results_days)
    db.commit()
    return retention(db, ctx)


def purge_expired(db: Session, now: datetime | None = None) -> dict[str, int]:
    """Maintenance (CLI, runs as the schema owner): delete runs and evaluation results past each
    organisation's retention. Organisations without a policy use the defaults."""
    from app.models import OpsOrganization

    now = now or utcnow()
    removed = {"runs": 0, "eval_results": 0}
    policies = {p.organization_id: p for p in db.scalars(select(OpsRetentionPolicy))}
    for org_id in db.scalars(select(OpsOrganization.id)):
        policy = policies.get(org_id)
        runs_days = policy.runs_days if policy else DEFAULT_RETENTION.runs_days
        results_days = policy.eval_results_days if policy else DEFAULT_RETENTION.eval_results_days
        removed["runs"] += (
            db.execute(
                delete(OpsRun).where(
                    OpsRun.organization_id == org_id, OpsRun.started_at < now - timedelta(days=runs_days)
                )
            ).rowcount
            or 0
        )
        old_runs = select(OpsEvalRun.id).where(
            OpsEvalRun.organization_id == org_id, OpsEvalRun.finished_at < now - timedelta(days=results_days)
        )
        removed["eval_results"] += (
            db.execute(
                delete(OpsEvalResult).where(OpsEvalResult.organization_id == org_id, OpsEvalResult.run_id.in_(old_runs))
            ).rowcount
            or 0
        )
    audit.record(db, "ops.retention_purged", actor_label="cli", details=removed)
    db.commit()
    return removed
