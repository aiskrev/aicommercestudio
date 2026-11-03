"""Opportunity workflow for staff (docs/OPPORTUNITY_WORKFLOW.md). Every route depends on `require_admin`."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Response, status

from app.deps import Admin, DbSession
from app.errors import ApiError
from app.models import Lead
from app.opportunities import service
from app.opportunities.models import LeadProposal
from app.opportunities.schemas import (
    OpportunityOut,
    OpportunityUpdate,
    ProposalCreate,
    ProposalOut,
    ProposalTransition,
    VersionCreate,
    VersionOut,
)
from app.services import leads

router = APIRouter(prefix="/api/admin/leads/{lead_id}", tags=["admin-opportunities"])

CONFLICT = {409: {"description": "`expected_revision` is stale, or the transition is not allowed"}}


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _lead(db: DbSession, lead_id: uuid.UUID, *, for_update: bool = False) -> Lead:
    lead = leads.get_lead(db, lead_id, for_update=for_update)
    if lead is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Запитването не е намерено.", "lead_not_found")
    return lead


def _proposal(db: DbSession, lead: Lead, proposal_id: uuid.UUID, *, for_update: bool = False) -> LeadProposal:
    proposal = service.get_proposal(db, lead, proposal_id, for_update=for_update)
    if proposal is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Proposal not found.", "proposal_not_found")
    return proposal


def _raise(exc: service.WorkflowError) -> ApiError:
    return ApiError(exc.status, exc.message, exc.code)


@router.get("/opportunity", response_model=OpportunityOut)
def get_opportunity(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> OpportunityOut:
    """The opportunity record with the lead's source and linked assessments (defaults when none yet)."""
    _no_store(response)
    return service.opportunity_out(db, _lead(db, lead_id))


@router.put("/opportunity", response_model=OpportunityOut, responses=CONFLICT)
def save_opportunity(lead_id: uuid.UUID, payload: OpportunityUpdate, ctx: Admin, db: DbSession) -> OpportunityOut:
    lead = _lead(db, lead_id, for_update=True)
    try:
        return service.save_opportunity(db, lead, payload, ctx.user, ctx.ip_hash)
    except service.WorkflowError as exc:
        raise _raise(exc) from exc


@router.get("/proposals", response_model=list[ProposalOut])
def list_proposals(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> list[ProposalOut]:
    _no_store(response)
    return [service.proposal_out(p) for p in service.list_proposals(db, _lead(db, lead_id))]


@router.post("/proposals", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
def create_proposal(lead_id: uuid.UUID, payload: ProposalCreate, ctx: Admin, db: DbSession) -> ProposalOut:
    """Create a proposal or SOW draft: blank, with content, or a generated first draft (`generate`)."""
    lead = _lead(db, lead_id)
    return service.proposal_out(service.create_proposal(db, lead, payload, ctx.user, ctx.ip_hash))


@router.get("/proposals/{proposal_id}", response_model=ProposalOut)
def get_proposal(
    lead_id: uuid.UUID, proposal_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response
) -> ProposalOut:
    _no_store(response)
    return service.proposal_out(_proposal(db, _lead(db, lead_id), proposal_id))


@router.get("/proposals/{proposal_id}/versions/{number}", response_model=VersionOut)
def get_version(
    lead_id: uuid.UUID, proposal_id: uuid.UUID, number: int, ctx: Admin, db: DbSession, response: Response
) -> VersionOut:
    _no_store(response)
    version = service.version_out(_proposal(db, _lead(db, lead_id), proposal_id), number)
    if version is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Version not found.", "version_not_found")
    return version


@router.post("/proposals/{proposal_id}/versions", response_model=ProposalOut, responses=CONFLICT)
def add_version(
    lead_id: uuid.UUID, proposal_id: uuid.UUID, payload: VersionCreate, ctx: Admin, db: DbSession
) -> ProposalOut:
    lead = _lead(db, lead_id)
    proposal = _proposal(db, lead, proposal_id, for_update=True)
    try:
        return service.proposal_out(service.add_version(db, lead, proposal, payload, ctx.user, ctx.ip_hash))
    except service.WorkflowError as exc:
        raise _raise(exc) from exc


@router.post("/proposals/{proposal_id}/transition", response_model=ProposalOut, responses=CONFLICT)
def transition(
    lead_id: uuid.UUID, proposal_id: uuid.UUID, payload: ProposalTransition, ctx: Admin, db: DbSession
) -> ProposalOut:
    """submit · approve · reject · reopen · withdraw. Approval is a recorded human decision; nothing is sent."""
    lead = _lead(db, lead_id)
    proposal = _proposal(db, lead, proposal_id, for_update=True)
    try:
        return service.proposal_out(service.transition(db, lead, proposal, payload, ctx.user, ctx.ip_hash))
    except service.WorkflowError as exc:
        raise _raise(exc) from exc
