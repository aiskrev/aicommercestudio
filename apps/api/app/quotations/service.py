"""Customer-facing quotations: publish an approved version, show it to the link holder, record the answer.

Human approval is the gate: only a proposal in status `approved` can be published, and what the client sees is the
approved version itself (immutable), never a draft and never anything a generator wrote without a person
completing and approving it. Nothing is sent by the system.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.models import AdminUser, Lead, utcnow
from app.opportunities.models import LeadProposal, ProposalStatus
from app.opportunities.schemas import ProposalContent
from app.opportunities.service import WorkflowError
from app.quotations.models import Quotation, QuotationStatus
from app.quotations.schemas import (
    DecisionOut,
    QuotationDecision,
    QuotationPublicOut,
    QuotationPublish,
    QuotationStaffOut,
    QuotationWithdraw,
)
from app.security import generate_token, hash_token

DECISIONS = {"accept": QuotationStatus.ACCEPTED, "decline": QuotationStatus.DECLINED}


def _who(user: AdminUser | None) -> str | None:
    return (user.full_name or user.email) if user else None


def effective_status(quotation: Quotation, today: date | None = None) -> str:
    """`expired` is derived: a published quotation past the validity date staff set."""
    past_validity = quotation.valid_until is not None and (today or utcnow().date()) > quotation.valid_until
    if quotation.status == QuotationStatus.PUBLISHED.value and past_validity:
        return "expired"
    return quotation.status


def staff_out(quotation: Quotation) -> QuotationStaffOut:
    return QuotationStaffOut(
        id=quotation.id,
        proposal_id=quotation.proposal_id,
        version_number=quotation.version_number,
        status=effective_status(quotation),  # type: ignore[arg-type]
        locale=quotation.locale,
        valid_until=quotation.valid_until,
        published_by=_who(quotation.published_by),
        published_at=quotation.published_at,
        first_viewed_at=quotation.first_viewed_at,
        last_viewed_at=quotation.last_viewed_at,
        view_count=quotation.view_count,
        decided_at=quotation.decided_at,
        decision_name=quotation.decision_name,
        decision_note=quotation.decision_note,
        withdrawn_at=quotation.withdrawn_at,
        withdrawal_note=quotation.withdrawal_note,
        revision=quotation.revision,
    )


def latest(db: Session, proposal: LeadProposal, *, for_update: bool = False) -> Quotation | None:
    """The most recent quotation of a proposal (the live one if there is one)."""
    query = (
        select(Quotation).where(Quotation.proposal_id == proposal.id).order_by(Quotation.published_at.desc()).limit(1)
    )
    if for_update:
        query = query.with_for_update(of=Quotation)
    return db.scalars(query).unique().one_or_none()


def publish(
    db: Session,
    lead: Lead,
    proposal: LeadProposal,
    payload: QuotationPublish,
    actor: AdminUser,
    ip_hash: str | None,
) -> tuple[Quotation, str]:
    """Makes the approved version reachable through a secret link. The caller holds the lead row lock."""
    if payload.expected_revision != proposal.revision:
        raise WorkflowError(409, "opportunity_stale", "The record was changed by someone else. Reload and try again.")
    if proposal.status != ProposalStatus.APPROVED.value or proposal.approved_version is None:
        raise WorkflowError(409, "proposal_not_approved", "Only an approved proposal can be shown to the client.")
    if payload.valid_until is not None and payload.valid_until <= utcnow().date():
        raise WorkflowError(422, "validity_in_the_past", "The validity date must be in the future.")
    current = latest(db, proposal)
    if current is not None and current.status == QuotationStatus.PUBLISHED.value:
        raise WorkflowError(409, "quotation_exists", "This proposal already has a live quotation. Withdraw it first.")
    if current is not None and current.status == QuotationStatus.ACCEPTED.value:
        raise WorkflowError(409, "quotation_accepted", "The client has already accepted this quotation.")
    token = generate_token()
    quotation = Quotation(
        lead_id=lead.id,
        proposal_id=proposal.id,
        version_number=proposal.approved_version,
        token_hash=hash_token(token),
        locale=lead.locale if lead.locale in ("bg", "en") else "bg",
        valid_until=payload.valid_until,
        published_by=actor,
        published_at=utcnow(),
    )
    db.add(quotation)
    db.flush()
    audit.record(
        db,
        "quotation.published",
        actor=actor,
        entity_type="lead",
        entity_id=str(lead.id),
        details={
            "quotation": str(quotation.id),
            "proposal": str(proposal.id),
            "version": quotation.version_number,
            "valid_until": payload.valid_until.isoformat() if payload.valid_until else None,
        },
        ip_hash=ip_hash,
    )
    db.commit()
    return quotation, token


def withdraw(
    db: Session, lead: Lead, quotation: Quotation, payload: QuotationWithdraw, actor: AdminUser, ip_hash: str | None
) -> Quotation:
    if payload.expected_revision != quotation.revision:
        raise WorkflowError(409, "opportunity_stale", "The record was changed by someone else. Reload and try again.")
    if quotation.status != QuotationStatus.PUBLISHED.value:
        raise WorkflowError(409, "quotation_closed", "Only a live quotation can be withdrawn.")
    quotation.status = QuotationStatus.WITHDRAWN.value
    quotation.withdrawn_at = utcnow()
    quotation.withdrawn_by = actor
    quotation.withdrawal_note = payload.note
    quotation.revision += 1
    audit.record(
        db,
        "quotation.withdrawn",
        actor=actor,
        entity_type="lead",
        entity_id=str(lead.id),
        details={"quotation": str(quotation.id), "proposal": str(quotation.proposal_id)},
        ip_hash=ip_hash,
    )
    db.commit()
    return quotation


# --------------------------------------------------------------------------- the link holder


def by_token(db: Session, token: str, *, for_update: bool = False) -> Quotation | None:
    query = select(Quotation).where(Quotation.token_hash == hash_token(token))
    if for_update:
        query = query.with_for_update(of=Quotation)
    return db.scalars(query).unique().one_or_none()


def _version_content(db: Session, quotation: Quotation) -> tuple[LeadProposal, ProposalContent] | None:
    proposal = db.get(LeadProposal, quotation.proposal_id)
    if proposal is None:
        return None
    version = next((v for v in proposal.versions if v.number == quotation.version_number), None)
    if version is None:
        return None
    return proposal, ProposalContent.model_validate(version.content)


def public_out(db: Session, quotation: Quotation) -> QuotationPublicOut | None:
    """The link holder's view. The content is withheld once staff withdrew the quotation."""
    found = _version_content(db, quotation)
    lead = db.get(Lead, quotation.lead_id)
    if found is None or lead is None:
        return None
    proposal, content = found
    status = effective_status(quotation)
    decided = quotation.decided_at is not None and quotation.decision_name is not None
    return QuotationPublicOut(
        reference=quotation.id.hex[:8].upper(),
        status=status,  # type: ignore[arg-type]
        kind=proposal.kind,  # type: ignore[arg-type]
        title=proposal.title,
        company=lead.company,
        locale=quotation.locale,
        published_at=quotation.published_at,
        valid_until=quotation.valid_until,
        version=quotation.version_number,
        content=None if status == QuotationStatus.WITHDRAWN.value else content,
        decision=DecisionOut(decided_at=quotation.decided_at, name=quotation.decision_name) if decided else None,  # type: ignore[arg-type]
        open=status == QuotationStatus.PUBLISHED.value,
    )


def mark_viewed(db: Session, quotation: Quotation) -> None:
    now = utcnow()
    quotation.first_viewed_at = quotation.first_viewed_at or now
    quotation.last_viewed_at = now
    quotation.view_count += 1
    db.commit()


def decide(
    db: Session, quotation: Quotation, payload: QuotationDecision, ip_hash: str | None
) -> tuple[Quotation, bool]:
    """Records the client's answer once. Returns (quotation, recorded); the caller holds the row lock.

    The same answer again (a double click, a retry) is not an error and records nothing new. A different answer
    after one was given, or an answer to a withdrawn or expired quotation, is refused.
    """
    target = DECISIONS[payload.decision]
    status = effective_status(quotation)
    if status == target.value:
        return quotation, False
    if status != QuotationStatus.PUBLISHED.value:
        raise WorkflowError(409, "quotation_closed", "This quotation can no longer be answered.")
    quotation.status = target.value
    quotation.decided_at = utcnow()
    quotation.decision_name = payload.name
    quotation.decision_note = payload.note or None
    quotation.decision_ip_hash = ip_hash
    quotation.revision += 1
    audit.record(
        db,
        f"quotation.{target.value}",
        actor_label="client",
        entity_type="lead",
        entity_id=str(quotation.lead_id),
        # No name and no note here: the audit log carries what happened, the quotation row carries who said it.
        details={
            "quotation": str(quotation.id),
            "proposal": str(quotation.proposal_id),
            "version": quotation.version_number,
        },
        ip_hash=ip_hash,
    )
    db.commit()
    return quotation, True
