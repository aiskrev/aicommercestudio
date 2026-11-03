"""Tables of the AI operations platform beyond the tenancy scaffold (migration 0013).

Every table carries `organization_id`. Each reference to another tenant-owned row is a composite
foreign key `(<ref>_id, organization_id)` → `<table>(id, organization_id)`, so the database refuses a
link to another tenant's row even if application code had a bug. Row-level security
(app/ops/rls.py) adds a second, independent barrier for the runtime role.

Nothing here stores provider credentials, telemetry payloads or prompt *content* of executions:
prompt templates live only in reviewed registry versions, and execution records are counters.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import TZDateTime, _in_check, utcnow


def _tenant_fk(column: str, table: str, *, ondelete: str = "CASCADE", name: str) -> ForeignKeyConstraint:
    return ForeignKeyConstraint(
        [column, "organization_id"], [f"{table}.id", f"{table}.organization_id"], ondelete=ondelete, name=name
    )


def _org_column() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid, ForeignKey("ops_organizations.id", ondelete="CASCADE"), nullable=False, index=True)


def _user_column(nullable: bool = True) -> Mapped[uuid.UUID | None]:
    return mapped_column(Uuid, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=nullable)


# ----------------------------------------------------------------------------------- registry


class VersionStatus(enum.StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    RETIRED = "retired"


class OpsAgentVersion(Base):
    """One reviewed configuration of an agent: prompt template, model reference, parameters, tools.

    Immutable once it leaves `draft` (a database trigger refuses content changes); `content_hash` is
    the SHA-256 of the canonical content and is verified on every read. Nothing is deployed from here.
    """

    __tablename__ = "ops_agent_versions"
    __table_args__ = (
        _tenant_fk("agent_id", "ops_agents", name="fk_ops_agent_versions_agent_org"),
        _tenant_fk("based_on_id", "ops_agent_versions", ondelete="NO ACTION", name="fk_ops_agent_versions_based_on"),
        _tenant_fk("rollback_of_id", "ops_agent_versions", ondelete="NO ACTION", name="fk_ops_agent_versions_rollback"),
        # The evaluation that backed the approval (the runs table references versions too: added after both).
        ForeignKeyConstraint(
            ["evaluation_run_id", "organization_id"],
            ["ops_eval_runs.id", "ops_eval_runs.organization_id"],
            name="fk_ops_agent_versions_eval_run",
            use_alter=True,
        ),
        UniqueConstraint("agent_id", "number", name="uq_ops_agent_versions_agent_number"),
        UniqueConstraint("id", "organization_id", name="uq_ops_agent_versions_id_org"),
        CheckConstraint(_in_check("status", VersionStatus), name="status"),
        CheckConstraint("char_length(prompt_template) <= 20000", name="prompt_length"),
        CheckConstraint("number >= 1", name="number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    agent_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=VersionStatus.DRAFT)
    prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(40))
    model: Mapped[str | None] = mapped_column(String(80))
    parameters: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    tools: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    environment: Mapped[str] = mapped_column(String(16), nullable=False)
    owner_user_id: Mapped[uuid.UUID | None] = _user_column()
    change_reason: Mapped[str] = mapped_column(String(500), nullable=False)
    based_on_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    rollback_of_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    reviewed_by: Mapped[uuid.UUID | None] = _user_column()
    reviewed_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    review_note: Mapped[str | None] = mapped_column(String(500))
    evaluation_run_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    retired_at: Mapped[datetime | None] = mapped_column(TZDateTime)


# --------------------------------------------------------------------------------- evaluations


class DatasetStatus(enum.StrEnum):
    DRAFT = "draft"
    LOCKED = "locked"


class ManualLabel(enum.StrEnum):
    PASS = "pass"  # noqa: S105 - a review label, not a credential
    FAIL = "fail"
    NEEDS_REVIEW = "needs_review"


class OpsEvalDataset(Base):
    """A versioned set of test cases for one agent. A locked version never changes."""

    __tablename__ = "ops_eval_datasets"
    __table_args__ = (
        _tenant_fk("agent_id", "ops_agents", name="fk_ops_eval_datasets_agent_org"),
        UniqueConstraint("agent_id", "key", "version", name="uq_ops_eval_datasets_agent_key_version"),
        UniqueConstraint("id", "organization_id", name="uq_ops_eval_datasets_id_org"),
        CheckConstraint(_in_check("status", DatasetStatus), name="status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    agent_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(60), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=DatasetStatus.DRAFT)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    locked_at: Mapped[datetime | None] = mapped_column(TZDateTime)


class OpsEvalCase(Base):
    """A test case: synthetic input, expected behaviour and deterministic assertions."""

    __tablename__ = "ops_eval_cases"
    __table_args__ = (
        _tenant_fk("dataset_id", "ops_eval_datasets", name="fk_ops_eval_cases_dataset_org"),
        UniqueConstraint("dataset_id", "key", name="uq_ops_eval_cases_dataset_key"),
        UniqueConstraint("id", "organization_id", name="uq_ops_eval_cases_id_org"),
        CheckConstraint("char_length(input_text) <= 4000", name="input_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    dataset_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(60), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    expected_behavior: Mapped[str] = mapped_column(String(1000), nullable=False)
    assertions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))


class OpsEvalRun(Base):
    """One evaluation of an agent version against a locked dataset version.

    `simulated` is true for the deterministic local runner: its outputs are not model outputs and are
    labelled as such everywhere they are shown.
    """

    __tablename__ = "ops_eval_runs"
    __table_args__ = (
        _tenant_fk("dataset_id", "ops_eval_datasets", name="fk_ops_eval_runs_dataset_org"),
        _tenant_fk("agent_version_id", "ops_agent_versions", name="fk_ops_eval_runs_version_org"),
        UniqueConstraint("id", "organization_id", name="uq_ops_eval_runs_id_org"),
        CheckConstraint("passed >= 0 AND failed >= 0 AND total = passed + failed", name="counts"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    dataset_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    agent_version_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    runner: Mapped[str] = mapped_column(String(40), nullable=False)
    simulated: Mapped[bool] = mapped_column(Boolean, nullable=False)
    total: Mapped[int] = mapped_column(Integer, nullable=False)
    passed: Mapped[int] = mapped_column(Integer, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    started_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    finished_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsEvalResult(Base):
    __tablename__ = "ops_eval_results"
    __table_args__ = (
        _tenant_fk("run_id", "ops_eval_runs", name="fk_ops_eval_results_run_org"),
        _tenant_fk("case_id", "ops_eval_cases", name="fk_ops_eval_results_case_org"),
        UniqueConstraint("run_id", "case_id", name="uq_ops_eval_results_run_case"),
        CheckConstraint(_in_check("manual_label", ManualLabel, nullable=True), name="manual_label"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    run_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    output_text: Mapped[str] = mapped_column(Text, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    assertion_results: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    manual_label: Mapped[str | None] = mapped_column(String(16))
    labeled_by: Mapped[uuid.UUID | None] = _user_column()
    labeled_at: Mapped[datetime | None] = mapped_column(TZDateTime)


# ------------------------------------------------------------------------------- observability


class RunStatus(enum.StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class ErrorCategory(enum.StrEnum):
    PROVIDER_ERROR = "provider_error"
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    TOOL_ERROR = "tool_error"
    VALIDATION = "validation"
    POLICY_BLOCK = "policy_block"
    OTHER = "other"


class RecordSource(enum.StrEnum):
    SYNTHETIC = "synthetic"
    MANUAL_IMPORT = "manual_import"


class Metric(enum.StrEnum):
    ERROR_RATE_PERCENT = "error_rate_percent"
    AVG_DURATION_MS = "avg_duration_ms"
    TOKENS = "tokens"
    ESTIMATED_COST = "estimated_cost"


class OpsRateCard(Base):
    """A versioned price per million tokens for one provider/model, as entered by staff (with its source)."""

    __tablename__ = "ops_rate_cards"
    __table_args__ = (
        UniqueConstraint("organization_id", "provider", "model", "version", name="uq_ops_rate_cards_version"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency"),
        CheckConstraint("input_per_million >= 0 AND output_per_million >= 0", name="prices"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    version: Mapped[str] = mapped_column(String(40), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    input_per_million: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    output_per_million: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    source_note: Mapped[str] = mapped_column(String(300), nullable=False)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsRun(Base):
    """Execution metadata of one agent run: status, duration, error category, token counters.

    No prompt, input or output content — there is no column for it. `source` says whether the row is
    synthetic sample data or a manual import; nothing arrives from a live gateway yet.
    """

    __tablename__ = "ops_runs"
    __table_args__ = (
        _tenant_fk("agent_id", "ops_agents", name="fk_ops_runs_agent_org"),
        _tenant_fk("agent_version_id", "ops_agent_versions", name="fk_ops_runs_version_org"),
        UniqueConstraint("organization_id", "external_id", name="uq_ops_runs_org_external_id"),
        CheckConstraint(_in_check("status", RunStatus), name="status"),
        CheckConstraint(_in_check("error_category", ErrorCategory, nullable=True), name="error_category"),
        CheckConstraint(_in_check("source", RecordSource), name="source"),
        CheckConstraint("duration_ms >= 0 AND input_tokens >= 0 AND output_tokens >= 0", name="counters"),
        CheckConstraint("status = 'succeeded' OR error_category IS NOT NULL", name="error_needs_category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    agent_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    agent_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    external_id: Mapped[str] = mapped_column(String(80), nullable=False)
    started_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, index=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    error_category: Mapped[str | None] = mapped_column(String(20))
    provider: Mapped[str | None] = mapped_column(String(40))
    model: Mapped[str | None] = mapped_column(String(80))
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsBudget(Base):
    __tablename__ = "ops_budgets"
    __table_args__ = (
        _tenant_fk("agent_id", "ops_agents", name="fk_ops_budgets_agent_org"),
        CheckConstraint("amount > 0", name="amount"),
        CheckConstraint("warn_percent BETWEEN 1 AND 100", name="warn_percent"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    agent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    warn_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsThresholdRule(Base):
    """A rule evaluated on demand against stored records. It sends nothing; breaches are only displayed."""

    __tablename__ = "ops_threshold_rules"
    __table_args__ = (
        _tenant_fk("agent_id", "ops_agents", name="fk_ops_threshold_rules_agent_org"),
        CheckConstraint(_in_check("metric", Metric), name="metric"),
        CheckConstraint("window_days BETWEEN 1 AND 90", name="window_days"),
        CheckConstraint("threshold >= 0", name="threshold"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    agent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    metric: Mapped[str] = mapped_column(String(24), nullable=False)
    threshold: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    window_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsRetentionPolicy(Base):
    __tablename__ = "ops_retention_policies"
    __table_args__ = (
        CheckConstraint("runs_days BETWEEN 7 AND 730", name="runs_days"),
        CheckConstraint("eval_results_days BETWEEN 30 AND 1095", name="eval_results_days"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("ops_organizations.id", ondelete="CASCADE"), primary_key=True
    )
    runs_days: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    eval_results_days: Mapped[int] = mapped_column(Integer, nullable=False, default=365)
    updated_by: Mapped[uuid.UUID | None] = _user_column()
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


# ------------------------------------------------------------------------- incidents and changes


class Severity(enum.StrEnum):
    SEV1 = "sev1"
    SEV2 = "sev2"
    SEV3 = "sev3"
    SEV4 = "sev4"


class Impact(enum.StrEnum):
    CUSTOMER_FACING = "customer_facing"
    INTERNAL = "internal"
    COST = "cost"
    SECURITY = "security"
    DATA_QUALITY = "data_quality"


class IncidentStatus(enum.StrEnum):
    DETECTED = "detected"
    TRIAGED = "triaged"
    INVESTIGATING = "investigating"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"
    REVIEWED = "reviewed"


class ChangeStatus(enum.StrEnum):
    DRAFT = "draft"
    RISK_REVIEW = "risk_review"
    EVALUATION = "evaluation"
    HUMAN_APPROVAL = "human_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    RELEASED = "released"
    REVIEWED = "reviewed"


class RiskLevel(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class EventKind(enum.StrEnum):
    CREATED = "created"
    STATUS = "status"
    NOTE = "note"
    EVIDENCE = "evidence"
    ASSIGNMENT = "assignment"


class OpsIncident(Base):
    __tablename__ = "ops_incidents"
    __table_args__ = (
        _tenant_fk("agent_id", "ops_agents", ondelete="SET NULL (agent_id)", name="fk_ops_incidents_agent_org"),
        _tenant_fk("rollback_version_id", "ops_agent_versions", ondelete="NO ACTION", name="fk_ops_incidents_rollback"),
        UniqueConstraint("organization_id", "number", name="uq_ops_incidents_org_number"),
        UniqueConstraint("id", "organization_id", name="uq_ops_incidents_id_org"),
        CheckConstraint(_in_check("severity", Severity), name="severity"),
        CheckConstraint(_in_check("impact", Impact), name="impact"),
        CheckConstraint(_in_check("status", IncidentStatus), name="status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    severity: Mapped[str] = mapped_column(String(8), nullable=False)
    impact: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=IncidentStatus.DETECTED)
    client_summary: Mapped[str | None] = mapped_column(String(1000))
    owner_user_id: Mapped[uuid.UUID | None] = _user_column()
    rollback_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    detected_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    triaged_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    investigating_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    mitigated_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    resolved_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    reviewed_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    lock_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsChange(Base):
    __tablename__ = "ops_changes"
    __table_args__ = (
        _tenant_fk("agent_id", "ops_agents", name="fk_ops_changes_agent_org"),
        _tenant_fk("agent_version_id", "ops_agent_versions", ondelete="NO ACTION", name="fk_ops_changes_version_org"),
        _tenant_fk("evaluation_run_id", "ops_eval_runs", ondelete="NO ACTION", name="fk_ops_changes_eval_org"),
        _tenant_fk("rollback_version_id", "ops_agent_versions", ondelete="NO ACTION", name="fk_ops_changes_rollback"),
        UniqueConstraint("organization_id", "number", name="uq_ops_changes_org_number"),
        UniqueConstraint("id", "organization_id", name="uq_ops_changes_id_org"),
        CheckConstraint(_in_check("status", ChangeStatus), name="status"),
        CheckConstraint(_in_check("risk", RiskLevel), name="risk"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    agent_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    agent_version_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    risk: Mapped[str] = mapped_column(String(8), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=ChangeStatus.DRAFT)
    risk_notes: Mapped[str | None] = mapped_column(String(2000))
    release_note: Mapped[str | None] = mapped_column(String(1000))
    evaluation_run_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    rollback_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    owner_user_id: Mapped[uuid.UUID | None] = _user_column()
    approved_by: Mapped[uuid.UUID | None] = _user_column()
    approved_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    released_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    reviewed_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    lock_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class _EventColumns:
    """Append-only timeline entries (a trigger refuses UPDATE; the runtime role cannot DELETE)."""

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(16))
    to_status: Mapped[str | None] = mapped_column(String(16))
    body: Mapped[str | None] = mapped_column(Text)
    actor_user_id: Mapped[uuid.UUID | None] = _user_column()
    actor_label: Mapped[str] = mapped_column(String(254), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class OpsIncidentEvent(_EventColumns, Base):
    __tablename__ = "ops_incident_events"
    __table_args__ = (
        _tenant_fk("incident_id", "ops_incidents", name="fk_ops_incident_events_incident_org"),
        CheckConstraint(_in_check("kind", EventKind), name="kind"),
        CheckConstraint("body IS NULL OR char_length(body) <= 4000", name="body_length"),
    )

    incident_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)


class OpsChangeEvent(_EventColumns, Base):
    __tablename__ = "ops_change_events"
    __table_args__ = (
        _tenant_fk("change_id", "ops_changes", name="fk_ops_change_events_change_org"),
        CheckConstraint(_in_check("kind", EventKind), name="kind"),
        CheckConstraint("body IS NULL OR char_length(body) <= 4000", name="body_length"),
    )

    change_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)


# ------------------------------------------------------------------------------- client portal


class PortalUserStatus(enum.StrEnum):
    INVITED = "invited"
    ACTIVE = "active"
    DISABLED = "disabled"


class PortalTokenPurpose(enum.StrEnum):
    INVITATION = "invitation"
    RECOVERY = "recovery"


class PortalUser(Base):
    """A client identity, separate from staff accounts (`admin_users`), bound to one organisation.

    The TOTP secret is never stored: it is derived from SECRET_KEY and the random `mfa_nonce`, so a
    database copy alone cannot generate codes.
    """

    __tablename__ = "portal_users"
    __table_args__ = (
        UniqueConstraint("id", "organization_id", name="uq_portal_users_id_org"),
        CheckConstraint(_in_check("status", PortalUserStatus), name="status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(12), nullable=False, default=PortalUserStatus.INVITED)
    mfa_nonce: Mapped[str | None] = mapped_column(String(64))
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mfa_last_step: Mapped[int | None] = mapped_column(BigInteger)
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(TZDateTime)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    activated_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    last_login_at: Mapped[datetime | None] = mapped_column(TZDateTime)


class PortalToken(Base):
    """One-time invitation or recovery token (only its SHA-256 hash is stored)."""

    __tablename__ = "portal_tokens"
    __table_args__ = (
        _tenant_fk("user_id", "portal_users", name="fk_portal_tokens_user_org"),
        CheckConstraint(_in_check("purpose", PortalTokenPurpose), name="purpose"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(12), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(TZDateTime)
    created_by: Mapped[uuid.UUID | None] = _user_column()
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)


class PortalSession(Base):
    __tablename__ = "portal_sessions"
    __table_args__ = (_tenant_fk("user_id", "portal_users", name="fk_portal_sessions_user_org"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = _org_column()
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    csrf_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    mfa_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(TZDateTime, nullable=False, default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(TZDateTime)


#: Tenant tables protected by row-level security (the migration creates a policy for each).
TENANT_TABLES = (
    "ops_workspaces",
    "ops_agents",
    "ops_agent_versions",
    "ops_eval_datasets",
    "ops_eval_cases",
    "ops_eval_runs",
    "ops_eval_results",
    "ops_rate_cards",
    "ops_runs",
    "ops_budgets",
    "ops_threshold_rules",
    "ops_retention_policies",
    "ops_incidents",
    "ops_incident_events",
    "ops_changes",
    "ops_change_events",
    "portal_users",
    "portal_tokens",
    "portal_sessions",
)
