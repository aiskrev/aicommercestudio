"""AI operations platform API: registry, evaluations, observability, incidents and changes.

Staff-only and organisation-scoped like the scaffold (app/routers/ops.py): every route depends on
`require(<permission>, <module>)`, which resolves the caller's membership, enforces the permission,
blocks writes for suspended organisations, answers 404 for a switched-off module and binds the request
to the organisation under row-level security. Reads and writes go through `scoped()` / `get_scoped()`.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.deps import DbSession
from app.errors import ApiError
from app.models import OpsAgent
from app.ops import evaluation as ev
from app.ops import observability as obs
from app.ops import registry as reg
from app.ops import workflows as wf
from app.ops.models import (
    OpsAgentVersion,
    OpsBudget,
    OpsChange,
    OpsEvalDataset,
    OpsEvalResult,
    OpsEvalRun,
    OpsIncident,
    OpsRateCard,
    OpsThresholdRule,
)
from app.ops.rbac import Permission
from app.ops.tenancy import OpsContext, audit_details, get_scoped, require, scoped

router = APIRouter(prefix="/api/ops/organizations/{organization_id}", tags=["ops-platform"])


def _dep(permission: Permission, module: str):
    return Annotated[OpsContext, Depends(require(permission, module))]


RegistryRead = _dep(Permission.REGISTRY_READ, "registry")
RegistryWrite = _dep(Permission.REGISTRY_WRITE, "registry")
RegistryApprove = _dep(Permission.REGISTRY_APPROVE, "registry")
EvalsRead = _dep(Permission.EVALS_READ, "evaluations")
EvalsWrite = _dep(Permission.EVALS_WRITE, "evaluations")
EvalsLabel = _dep(Permission.EVALS_LABEL, "evaluations")
ObsRead = _dep(Permission.OBSERVABILITY_READ, "observability")
ObsWrite = _dep(Permission.OBSERVABILITY_WRITE, "observability")
IncidentsRead = _dep(Permission.INCIDENTS_READ, "incidents")
IncidentsWrite = _dep(Permission.INCIDENTS_WRITE, "incidents")
ChangesRead = _dep(Permission.CHANGES_READ, "changes")
ChangesWrite = _dep(Permission.CHANGES_WRITE, "changes")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _audit_simple(db: Session, ctx: OpsContext, action: str, entity_type: str, entity_id: uuid.UUID, **extra) -> None:
    from app import audit

    audit.record(
        db,
        action,
        actor=ctx.admin.user,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=audit_details(ctx, **extra),
        ip_hash=ctx.admin.ip_hash,
    )


# =========================================================================== registry


@router.get("/agents/{agent_id}/versions", response_model=list[reg.VersionSummary])
def list_versions(
    agent_id: uuid.UUID, ctx: RegistryRead, db: DbSession, response: Response
) -> list[reg.VersionSummary]:
    _no_store(response)
    get_scoped(db, ctx, OpsAgent, agent_id)
    rows = db.scalars(
        scoped(ctx, OpsAgentVersion).where(OpsAgentVersion.agent_id == agent_id).order_by(OpsAgentVersion.number.desc())
    )
    return [reg.VersionSummary.model_validate(v) for v in rows]


@router.post("/agents/{agent_id}/versions", response_model=reg.VersionOut, status_code=status.HTTP_201_CREATED)
def create_version(agent_id: uuid.UUID, body: reg.VersionCreate, ctx: RegistryWrite, db: DbSession) -> reg.VersionOut:
    return reg.to_out(db, reg.create_version(db, ctx, agent_id, body))


@router.get("/versions/{version_id}", response_model=reg.VersionOut)
def get_version(version_id: uuid.UUID, ctx: RegistryRead, db: DbSession, response: Response) -> reg.VersionOut:
    _no_store(response)
    return reg.to_out(db, get_scoped(db, ctx, OpsAgentVersion, version_id))


@router.patch("/versions/{version_id}", response_model=reg.VersionOut)
def update_version(version_id: uuid.UUID, body: reg.VersionUpdate, ctx: RegistryWrite, db: DbSession) -> reg.VersionOut:
    version = get_scoped(db, ctx, OpsAgentVersion, version_id)
    return reg.to_out(db, reg.update_draft(db, ctx, version, body))


@router.post("/versions/{version_id}/submit", response_model=reg.VersionOut)
def submit_version(version_id: uuid.UUID, ctx: RegistryWrite, db: DbSession) -> reg.VersionOut:
    return reg.to_out(db, reg.submit(db, ctx, get_scoped(db, ctx, OpsAgentVersion, version_id)))


@router.post("/versions/{version_id}/review", response_model=reg.VersionOut)
def review_version(
    version_id: uuid.UUID, body: reg.ReviewDecision, ctx: RegistryApprove, db: DbSession
) -> reg.VersionOut:
    return reg.to_out(db, reg.review(db, ctx, get_scoped(db, ctx, OpsAgentVersion, version_id), body))


@router.post("/versions/{version_id}/retire", response_model=reg.VersionOut)
def retire_version(version_id: uuid.UUID, ctx: RegistryApprove, db: DbSession) -> reg.VersionOut:
    return reg.to_out(db, reg.retire(db, ctx, get_scoped(db, ctx, OpsAgentVersion, version_id)))


@router.get("/versions/{version_id}/diff/{other_id}", response_model=reg.VersionDiff)
def diff_versions(version_id: uuid.UUID, other_id: uuid.UUID, ctx: RegistryRead, db: DbSession) -> reg.VersionDiff:
    a = get_scoped(db, ctx, OpsAgentVersion, version_id)
    b = get_scoped(db, ctx, OpsAgentVersion, other_id)
    if a.agent_id != b.agent_id:
        raise ApiError(status.HTTP_409_CONFLICT, "Compare versions of the same agent.", "ops_diff_agent")
    return reg.diff(a, b)


# ======================================================================== evaluations


def _dataset_out(db: Session, ctx: OpsContext, dataset: OpsEvalDataset) -> ev.DatasetOut:
    out = ev.DatasetOut.model_validate(dataset)
    out.case_count = len(ev.cases_of(db, ctx, dataset.id))
    return out


@router.get("/agents/{agent_id}/datasets", response_model=list[ev.DatasetOut])
def list_datasets(agent_id: uuid.UUID, ctx: EvalsRead, db: DbSession, response: Response) -> list[ev.DatasetOut]:
    _no_store(response)
    get_scoped(db, ctx, OpsAgent, agent_id)
    rows = db.scalars(
        scoped(ctx, OpsEvalDataset)
        .where(OpsEvalDataset.agent_id == agent_id)
        .order_by(OpsEvalDataset.key, OpsEvalDataset.version.desc())
    )
    return [_dataset_out(db, ctx, d) for d in rows]


@router.post("/agents/{agent_id}/datasets", response_model=ev.DatasetDetail, status_code=status.HTTP_201_CREATED)
def create_dataset(agent_id: uuid.UUID, body: ev.DatasetCreate, ctx: EvalsWrite, db: DbSession) -> ev.DatasetDetail:
    dataset = ev.create_dataset(db, ctx, agent_id, body)
    return get_dataset(dataset.id, ctx, db, Response())


@router.post(
    "/agents/{agent_id}/datasets/templates/{template}",
    response_model=ev.DatasetDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_dataset_from_template(
    agent_id: uuid.UUID, template: str, ctx: EvalsWrite, db: DbSession
) -> ev.DatasetDetail:
    dataset = ev.create_from_template(db, ctx, agent_id, template)
    return get_dataset(dataset.id, ctx, db, Response())


@router.get("/datasets/{dataset_id}", response_model=ev.DatasetDetail)
def get_dataset(dataset_id: uuid.UUID, ctx: EvalsRead, db: DbSession, response: Response) -> ev.DatasetDetail:
    _no_store(response)
    dataset = get_scoped(db, ctx, OpsEvalDataset, dataset_id)
    cases = [ev.CaseOut.model_validate(c) for c in ev.cases_of(db, ctx, dataset.id)]
    return ev.DatasetDetail(**_dataset_out(db, ctx, dataset).model_dump(), cases=cases)


@router.post("/datasets/{dataset_id}/cases", response_model=ev.CaseOut, status_code=status.HTTP_201_CREATED)
def add_case(dataset_id: uuid.UUID, body: ev.CaseIn, ctx: EvalsWrite, db: DbSession) -> ev.CaseOut:
    return ev.CaseOut.model_validate(ev.add_case(db, ctx, get_scoped(db, ctx, OpsEvalDataset, dataset_id), body))


@router.post("/datasets/{dataset_id}/lock", response_model=ev.DatasetOut)
def lock_dataset(dataset_id: uuid.UUID, ctx: EvalsWrite, db: DbSession) -> ev.DatasetOut:
    return _dataset_out(db, ctx, ev.lock(db, ctx, get_scoped(db, ctx, OpsEvalDataset, dataset_id)))


@router.post("/datasets/{dataset_id}/runs", response_model=ev.RunDetail, status_code=status.HTTP_201_CREATED)
def run_dataset(dataset_id: uuid.UUID, body: ev.RunCreate, ctx: EvalsWrite, db: DbSession) -> ev.RunDetail:
    row = ev.run(db, ctx, get_scoped(db, ctx, OpsEvalDataset, dataset_id), body)
    return ev.RunDetail(**ev.run_out(row).model_dump(), results=ev.results_of(db, ctx, row))


@router.get("/eval-runs", response_model=list[ev.RunOut])
def list_runs(
    ctx: EvalsRead,
    db: DbSession,
    response: Response,
    agent_version_id: uuid.UUID | None = None,
    dataset_id: uuid.UUID | None = None,
) -> list[ev.RunOut]:
    _no_store(response)
    stmt = scoped(ctx, OpsEvalRun).order_by(OpsEvalRun.finished_at.desc()).limit(100)
    if agent_version_id:
        stmt = stmt.where(OpsEvalRun.agent_version_id == agent_version_id)
    if dataset_id:
        stmt = stmt.where(OpsEvalRun.dataset_id == dataset_id)
    return [ev.run_out(r) for r in db.scalars(stmt)]


@router.get("/eval-runs/{run_id}", response_model=ev.RunDetail)
def get_run(run_id: uuid.UUID, ctx: EvalsRead, db: DbSession, response: Response) -> ev.RunDetail:
    _no_store(response)
    row = get_scoped(db, ctx, OpsEvalRun, run_id)
    return ev.RunDetail(**ev.run_out(row).model_dump(), results=ev.results_of(db, ctx, row))


@router.get("/eval-runs/{run_id}/compare/{other_id}", response_model=ev.Comparison)
def compare_runs(run_id: uuid.UUID, other_id: uuid.UUID, ctx: EvalsRead, db: DbSession) -> ev.Comparison:
    return ev.compare(db, ctx, get_scoped(db, ctx, OpsEvalRun, run_id), get_scoped(db, ctx, OpsEvalRun, other_id))


@router.put("/eval-results/{result_id}/label", response_model=ev.ResultOut)
def label_result(result_id: uuid.UUID, body: ev.LabelIn, ctx: EvalsLabel, db: DbSession) -> ev.ResultOut:
    return ev.ResultOut.model_validate(ev.label(db, ctx, get_scoped(db, ctx, OpsEvalResult, result_id), body))


# ====================================================================== observability


@router.post("/observability/import", response_model=obs.ImportOut, status_code=status.HTTP_201_CREATED)
def import_runs(body: obs.ImportIn, ctx: ObsWrite, db: DbSession) -> obs.ImportOut:
    return obs.import_runs(db, ctx, body)


@router.post("/observability/synthetic", response_model=obs.ImportOut, status_code=status.HTTP_201_CREATED)
def synthetic_runs(body: obs.SyntheticIn, ctx: ObsWrite, db: DbSession) -> obs.ImportOut:
    return obs.synthetic_runs(db, ctx, body)


@router.get("/observability/summary", response_model=obs.Summary)
def observability_summary(
    ctx: ObsRead,
    db: DbSession,
    response: Response,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    group_by: Literal["agent", "workspace"] = "agent",
) -> obs.Summary:
    _no_store(response)
    return obs.summary(db, ctx, days, group_by)


@router.get("/observability/evaluation", response_model=obs.Evaluation)
def observability_evaluation(ctx: ObsRead, db: DbSession, response: Response) -> obs.Evaluation:
    _no_store(response)
    return obs.evaluate(db, ctx)


@router.get("/rate-cards", response_model=list[obs.RateCardOut])
def list_rate_cards(ctx: ObsRead, db: DbSession, response: Response) -> list[obs.RateCardOut]:
    _no_store(response)
    rows = db.scalars(
        scoped(ctx, OpsRateCard).order_by(OpsRateCard.provider, OpsRateCard.model, OpsRateCard.effective_from.desc())
    )
    return [obs.RateCardOut.model_validate(r) for r in rows]


@router.post("/rate-cards", response_model=obs.RateCardOut, status_code=status.HTTP_201_CREATED)
def create_rate_card(body: obs.RateCardIn, ctx: ObsWrite, db: DbSession) -> obs.RateCardOut:
    from sqlalchemy.exc import IntegrityError

    card = OpsRateCard(organization_id=ctx.organization_id, created_by=ctx.admin.user.id, **body.model_dump())
    db.add(card)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ApiError(status.HTTP_409_CONFLICT, "This rate card version already exists.", "ops_conflict") from None
    _audit_simple(
        db,
        ctx,
        "ops.rate_card_created",
        "ops_rate_card",
        card.id,
        provider=card.provider,
        model=card.model,
        version=card.version,
        currency=card.currency,
    )
    db.commit()
    return obs.RateCardOut.model_validate(card)


@router.get("/budgets", response_model=list[obs.BudgetOut])
def list_budgets(ctx: ObsRead, db: DbSession, response: Response) -> list[obs.BudgetOut]:
    _no_store(response)
    return [obs.BudgetOut.model_validate(b) for b in db.scalars(scoped(ctx, OpsBudget).order_by(OpsBudget.name))]


@router.post("/budgets", response_model=obs.BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(body: obs.BudgetIn, ctx: ObsWrite, db: DbSession) -> obs.BudgetOut:
    if body.agent_id:
        get_scoped(db, ctx, OpsAgent, body.agent_id)
    budget = OpsBudget(organization_id=ctx.organization_id, created_by=ctx.admin.user.id, **body.model_dump())
    db.add(budget)
    db.flush()
    _audit_simple(db, ctx, "ops.budget_created", "ops_budget", budget.id, currency=budget.currency)
    db.commit()
    return obs.BudgetOut.model_validate(budget)


@router.get("/threshold-rules", response_model=list[obs.ThresholdOut])
def list_rules(ctx: ObsRead, db: DbSession, response: Response) -> list[obs.ThresholdOut]:
    _no_store(response)
    return [
        obs.ThresholdOut.model_validate(r)
        for r in db.scalars(scoped(ctx, OpsThresholdRule).order_by(OpsThresholdRule.name))
    ]


@router.post("/threshold-rules", response_model=obs.ThresholdOut, status_code=status.HTTP_201_CREATED)
def create_rule(body: obs.ThresholdIn, ctx: ObsWrite, db: DbSession) -> obs.ThresholdOut:
    if body.agent_id:
        get_scoped(db, ctx, OpsAgent, body.agent_id)
    rule = OpsThresholdRule(organization_id=ctx.organization_id, created_by=ctx.admin.user.id, **body.model_dump())
    db.add(rule)
    db.flush()
    _audit_simple(db, ctx, "ops.threshold_rule_created", "ops_threshold_rule", rule.id, metric=rule.metric)
    db.commit()
    return obs.ThresholdOut.model_validate(rule)


@router.get("/retention", response_model=obs.RetentionOut)
def get_retention(ctx: ObsRead, db: DbSession, response: Response) -> obs.RetentionOut:
    _no_store(response)
    return obs.retention(db, ctx)


@router.put("/retention", response_model=obs.RetentionOut)
def put_retention(body: obs.RetentionIn, ctx: ObsWrite, db: DbSession) -> obs.RetentionOut:
    return obs.set_retention(db, ctx, body)


# ========================================================================== incidents


@router.get("/incidents", response_model=list[wf.IncidentOut])
def list_incidents(
    ctx: IncidentsRead,
    db: DbSession,
    response: Response,
    incident_status: Annotated[str | None, Query(alias="status", max_length=16)] = None,
) -> list[wf.IncidentOut]:
    _no_store(response)
    stmt = scoped(ctx, OpsIncident).order_by(OpsIncident.number.desc())
    if incident_status:
        stmt = stmt.where(OpsIncident.status == incident_status)
    return [wf.incident_out(ctx, i) for i in db.scalars(stmt)]


@router.post("/incidents", response_model=wf.IncidentOut, status_code=status.HTTP_201_CREATED)
def create_incident(body: wf.IncidentCreate, ctx: IncidentsWrite, db: DbSession) -> wf.IncidentOut:
    return wf.incident_out(ctx, wf.create_incident(db, ctx, body))


@router.get("/incidents/{incident_id}", response_model=wf.IncidentDetail)
def get_incident(incident_id: uuid.UUID, ctx: IncidentsRead, db: DbSession, response: Response) -> wf.IncidentDetail:
    _no_store(response)
    incident = get_scoped(db, ctx, OpsIncident, incident_id)
    return wf.IncidentDetail(
        **wf.incident_out(ctx, incident).model_dump(), events=wf.incident_events(db, ctx, incident)
    )


@router.patch("/incidents/{incident_id}", response_model=wf.IncidentOut)
def update_incident(
    incident_id: uuid.UUID, body: wf.IncidentUpdate, ctx: IncidentsWrite, db: DbSession
) -> wf.IncidentOut:
    return wf.incident_out(ctx, wf.update_incident(db, ctx, incident_id, body))


@router.post("/incidents/{incident_id}/transition", response_model=wf.IncidentOut)
def transition_incident(
    incident_id: uuid.UUID, body: wf.Transition, ctx: IncidentsRead, db: DbSession
) -> wf.IncidentOut:
    # The permission depends on the step (write vs review): checked inside against the state machine.
    return wf.incident_out(ctx, wf.transition_incident(db, ctx, incident_id, body))


@router.post("/incidents/{incident_id}/notes", status_code=status.HTTP_204_NO_CONTENT)
def add_incident_note(incident_id: uuid.UUID, body: wf.NoteIn, ctx: IncidentsWrite, db: DbSession) -> Response:
    wf.add_incident_note(db, ctx, get_scoped(db, ctx, OpsIncident, incident_id), body)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================ changes


@router.get("/changes", response_model=list[wf.ChangeOut])
def list_changes(ctx: ChangesRead, db: DbSession, response: Response) -> list[wf.ChangeOut]:
    _no_store(response)
    return [wf.change_out(ctx, c) for c in db.scalars(scoped(ctx, OpsChange).order_by(OpsChange.number.desc()))]


@router.post("/changes", response_model=wf.ChangeOut, status_code=status.HTTP_201_CREATED)
def create_change(body: wf.ChangeCreate, ctx: ChangesWrite, db: DbSession) -> wf.ChangeOut:
    return wf.change_out(ctx, wf.create_change(db, ctx, body))


@router.get("/changes/{change_id}", response_model=wf.ChangeDetail)
def get_change(change_id: uuid.UUID, ctx: ChangesRead, db: DbSession, response: Response) -> wf.ChangeDetail:
    _no_store(response)
    change = get_scoped(db, ctx, OpsChange, change_id)
    run = db.get(OpsEvalRun, change.evaluation_run_id) if change.evaluation_run_id else None
    return wf.ChangeDetail(
        **wf.change_out(ctx, change).model_dump(),
        events=wf.change_events(db, ctx, change),
        evidence_simulated=run.simulated if run else None,
    )


@router.post("/changes/{change_id}/transition", response_model=wf.ChangeOut)
def transition_change(change_id: uuid.UUID, body: wf.Transition, ctx: ChangesRead, db: DbSession) -> wf.ChangeOut:
    return wf.change_out(ctx, wf.transition_change(db, ctx, change_id, body))


@router.post("/changes/{change_id}/notes", status_code=status.HTTP_204_NO_CONTENT)
def add_change_note(change_id: uuid.UUID, body: wf.NoteIn, ctx: ChangesWrite, db: DbSession) -> Response:
    wf.add_change_note(db, ctx, get_scoped(db, ctx, OpsChange, change_id), body)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
