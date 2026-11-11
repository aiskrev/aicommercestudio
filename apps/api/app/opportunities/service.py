"""Opportunity workflow: the opportunity record, proposal/SOW drafts, versions and human approval.

Rules (docs/OPPORTUNITY_WORKFLOW.md):
* Only admins reach it (`require_admin`); every change is audited on the lead without personal data.
* The record holds only what staff entered; stakeholders only when the client named them.
* Proposal versions are append-only. A new version is allowed in `draft` and `rejected` (the latter
  returns the proposal to `draft`); approved and withdrawn proposals are closed.
* `approve` is a human decision on the latest version, refused while a blocking review finding
  remains (commercial terms or placeholders not completed by a person) and, with other findings,
  unless the reviewer acknowledges them. Approval is not a signature and sends nothing.
* Nothing here sends e-mail, syncs a CRM or touches the lead's consents.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import audit
from app.models import (
    AdminUser,
    AdvisorAssessment,
    AssessmentResultRecord,
    Lead,
    TeamConfiguration,
    utcnow,
)
from app.opportunities import configured, drafts
from app.opportunities.models import LeadOpportunity, LeadProposal, LeadProposalVersion, ProposalStatus, VersionOrigin
from app.opportunities.schemas import (
    LinkedRecord,
    OpportunityOut,
    OpportunitySource,
    OpportunityUpdate,
    ProposalContent,
    ProposalCreate,
    ProposalOut,
    ProposalTransition,
    Stakeholder,
    VersionCreate,
    VersionMeta,
    VersionOut,
)

OPPORTUNITY_FIELDS = (
    "service_domain",
    "problem_summary",
    "scope_summary",
    "discovery_status",
    "qualification_status",
    "qualification_rationale",
    "technical_constraints",
    "stakeholders",
    "next_action",
    "next_action_due",
    "notes",
    "recommended_workshop",
    "recommended_assessment",
    "recommendation_rationale",
)


@dataclass
class WorkflowError(Exception):
    status: int
    code: str
    message: str


def _stale() -> WorkflowError:
    return WorkflowError(409, "opportunity_stale", "The record was changed by someone else. Reload and try again.")


def _who(user: AdminUser | None) -> str | None:
    return (user.full_name or user.email) if user else None


def _audit(db: Session, action: str, lead: Lead, actor: AdminUser, ip_hash: str | None, **details: object) -> None:
    audit.record(db, action, actor=actor, entity_type="lead", entity_id=str(lead.id), details=details, ip_hash=ip_hash)


# --------------------------------------------------------------------------- opportunity


def linked_records(db: Session, lead: Lead) -> list[LinkedRecord]:
    """Assessments and tool results attached to the lead by the public flows (read-only)."""
    linked: list[LinkedRecord] = []
    for row in db.scalars(select(AdvisorAssessment).where(AdvisorAssessment.lead_id == lead.id)):
        linked.append(
            LinkedRecord(kind="advisor_assessment", reference=row.reference, detail=row.mode, created_at=row.created_at)
        )
    for row in db.scalars(select(AssessmentResultRecord).where(AssessmentResultRecord.lead_id == lead.id)):
        linked.append(
            LinkedRecord(
                kind="assessment_result", reference=row.reference, detail=row.assessment_key, created_at=row.created_at
            )
        )
    for row in db.scalars(select(TeamConfiguration).where(TeamConfiguration.lead_id == lead.id)):
        linked.append(LinkedRecord(kind="team_configuration", reference=row.reference, created_at=row.created_at))
    kind = (lead.service_details or {}).get("kind")
    if kind in ("readiness", "solution", "ai_managed", "project_configurator", "quote_basket"):
        linked.append(LinkedRecord(kind=kind, reference=lead.reference, detail=lead.source))
    return linked


def get_opportunity(db: Session, lead: Lead) -> LeadOpportunity | None:
    return db.get(LeadOpportunity, lead.id)


def opportunity_out(db: Session, lead: Lead) -> OpportunityOut:
    source = OpportunitySource(
        source=lead.source,
        inquiry_type=lead.inquiry_type,
        submitted_service=lead.submitted_service,
        workshop_key=lead.workshop_key,
        linked=linked_records(db, lead),
    )
    row = get_opportunity(db, lead)
    if row is None:
        # Defaults, pre-filled from the enquiry where that is a fact: the workshop it was sent about, and for a
        # configured project the package and the client's choices. Nothing is saved until staff save the record.
        return OpportunityOut(
            exists=False,
            lead_id=lead.id,
            source=source,
            recommended_workshop=lead.workshop_key,
            scope_summary=configured.summary(lead, lead.locale),
        )
    return OpportunityOut(
        exists=True,
        lead_id=lead.id,
        source=source,
        **{field: getattr(row, field) for field in OPPORTUNITY_FIELDS if field != "stakeholders"},
        stakeholders=[Stakeholder.model_validate(s) for s in row.stakeholders],
        revision=row.revision,
        updated_at=row.updated_at,
        updated_by=_who(row.updated_by),
    )


def save_opportunity(
    db: Session, lead: Lead, payload: OpportunityUpdate, actor: AdminUser, ip_hash: str | None
) -> OpportunityOut:
    # The router holds the lead row lock, which serialises concurrent saves; the revision catches stale editors.
    row = db.scalars(
        select(LeadOpportunity).where(LeadOpportunity.lead_id == lead.id).with_for_update(of=LeadOpportunity)
    ).one_or_none()
    current = 0 if row is None else row.revision
    if payload.expected_revision != current:
        raise _stale()
    values = payload.model_dump(include=set(OPPORTUNITY_FIELDS))
    now = utcnow()
    if row is None:
        row = LeadOpportunity(lead_id=lead.id, revision=1, created_at=now, **values)
        db.add(row)
        changed = [field for field in OPPORTUNITY_FIELDS if values[field] not in (None, "", [])]
    else:
        before = {field: getattr(row, field) for field in OPPORTUNITY_FIELDS}
        for field, value in values.items():
            setattr(row, field, value)
        db.flush()
        changed = [field for field in OPPORTUNITY_FIELDS if _jsonish(before[field]) != _jsonish(getattr(row, field))]
        row.revision += 1
    row.updated_at = now
    row.updated_by = actor
    # Field names and statuses only: the free text and the stakeholder names stay out of the audit log.
    _audit(
        db,
        "opportunity.saved",
        lead,
        actor,
        ip_hash,
        fields=changed,
        discovery_status=row.discovery_status,
        qualification_status=row.qualification_status,
        stakeholders=len(row.stakeholders),
    )
    db.commit()
    db.refresh(row)
    return opportunity_out(db, lead)


def _jsonish(value: object) -> object:
    return value.isoformat() if hasattr(value, "isoformat") else value


# --------------------------------------------------------------------------- proposals


def _version_out(version: LeadProposalVersion, previous: LeadProposalVersion | None) -> VersionOut:
    content = ProposalContent.model_validate(version.content)
    return VersionOut(
        **_version_meta(version, previous).model_dump(),
        content=content,
        findings=drafts.review(content),
    )


def _version_meta(version: LeadProposalVersion, previous: LeadProposalVersion | None) -> VersionMeta:
    return VersionMeta(
        number=version.number,
        origin=version.origin,
        change_note=version.change_note,
        author=_who(version.author),
        created_at=version.created_at,
        changed_sections=drafts.changed_sections(previous.content if previous else None, version.content),
    )


def proposal_out(proposal: LeadProposal) -> ProposalOut:
    versions = proposal.versions
    metas = [_version_meta(v, versions[i - 1] if i else None) for i, v in enumerate(versions)]
    latest = versions[-1]
    return ProposalOut(
        id=proposal.id,
        lead_id=proposal.lead_id,
        kind=proposal.kind,
        title=proposal.title,
        status=proposal.status,
        current_version=proposal.current_version,
        revision=proposal.revision,
        created_by=_who(proposal.created_by),
        decided_by=_who(proposal.decided_by),
        decision_note=proposal.decision_note,
        approved_version=proposal.approved_version,
        approved_at=proposal.approved_at,
        created_at=proposal.created_at,
        updated_at=proposal.updated_at,
        versions=metas,
        latest=_version_out(latest, versions[-2] if len(versions) > 1 else None),
    )


def version_out(proposal: LeadProposal, number: int) -> VersionOut | None:
    versions = proposal.versions
    for index, version in enumerate(versions):
        if version.number == number:
            return _version_out(version, versions[index - 1] if index else None)
    return None


def list_proposals(db: Session, lead: Lead) -> list[LeadProposal]:
    stmt = select(LeadProposal).where(LeadProposal.lead_id == lead.id).order_by(LeadProposal.created_at)
    return list(db.scalars(stmt).unique().all())


def get_proposal(db: Session, lead: Lead, proposal_id: uuid.UUID, *, for_update: bool = False) -> LeadProposal | None:
    stmt = select(LeadProposal).where(LeadProposal.id == proposal_id, LeadProposal.lead_id == lead.id)
    if for_update:
        stmt = stmt.with_for_update(of=LeadProposal)
    return db.scalars(stmt).unique().one_or_none()


def create_proposal(
    db: Session, lead: Lead, payload: ProposalCreate, actor: AdminUser, ip_hash: str | None
) -> LeadProposal:
    if payload.generate:
        content, origin = drafts.generate(lead, get_opportunity(db, lead), payload.kind), VersionOrigin.GENERATED_DRAFT
    else:
        content, origin = payload.content or ProposalContent(), VersionOrigin.HUMAN
    now = utcnow()
    proposal = LeadProposal(
        lead_id=lead.id,
        kind=payload.kind.value,
        title=payload.title,
        status=ProposalStatus.DRAFT.value,
        current_version=1,
        revision=1,
        created_by=actor,
        created_at=now,
        updated_at=now,
    )
    proposal.versions.append(
        LeadProposalVersion(
            number=1, origin=origin.value, content=content.model_dump(mode="json"), author=actor, created_at=now
        )
    )
    db.add(proposal)
    db.flush()
    _audit(
        db, "proposal.created", lead, actor, ip_hash, proposal=str(proposal.id), kind=proposal.kind, origin=origin.value
    )
    db.commit()
    return get_proposal(db, lead, proposal.id)  # type: ignore[return-value]


def add_version(
    db: Session, lead: Lead, proposal: LeadProposal, payload: VersionCreate, actor: AdminUser, ip_hash: str | None
) -> LeadProposal:
    if payload.expected_revision != proposal.revision:
        raise _stale()
    if proposal.status not in (ProposalStatus.DRAFT, ProposalStatus.REJECTED):
        raise WorkflowError(409, "proposal_closed", "Only a draft or a rejected proposal takes a new version.")
    now = utcnow()
    number = proposal.current_version + 1
    proposal.versions.append(
        LeadProposalVersion(
            number=number,
            origin=VersionOrigin.HUMAN.value,
            content=payload.content.model_dump(mode="json"),
            change_note=payload.change_note,
            author=actor,
            created_at=now,
        )
    )
    proposal.current_version = number
    proposal.status = ProposalStatus.DRAFT.value
    proposal.revision += 1
    proposal.updated_at = now
    _audit(db, "proposal.version_added", lead, actor, ip_hash, proposal=str(proposal.id), version=number)
    db.commit()
    return get_proposal(db, lead, proposal.id)  # type: ignore[return-value]


# action → (allowed current statuses, new status)
TRANSITIONS: dict[str, tuple[tuple[ProposalStatus, ...], ProposalStatus]] = {
    "submit": ((ProposalStatus.DRAFT,), ProposalStatus.IN_REVIEW),
    "approve": ((ProposalStatus.IN_REVIEW,), ProposalStatus.APPROVED),
    "reject": ((ProposalStatus.IN_REVIEW,), ProposalStatus.REJECTED),
    "reopen": ((ProposalStatus.REJECTED, ProposalStatus.IN_REVIEW), ProposalStatus.DRAFT),
    "withdraw": ((ProposalStatus.DRAFT, ProposalStatus.IN_REVIEW, ProposalStatus.REJECTED), ProposalStatus.WITHDRAWN),
}


def transition(
    db: Session, lead: Lead, proposal: LeadProposal, payload: ProposalTransition, actor: AdminUser, ip_hash: str | None
) -> LeadProposal:
    if payload.expected_revision != proposal.revision:
        raise _stale()
    allowed, target = TRANSITIONS[payload.action]
    if proposal.status not in allowed:
        raise WorkflowError(
            409, "proposal_transition", f"A {proposal.status} proposal cannot be moved with '{payload.action}'."
        )
    note = (payload.note or "").strip() or None
    if payload.action in ("reject", "withdraw") and not note:
        raise WorkflowError(422, "note_required", "Rejecting or withdrawing needs a note.")
    now = utcnow()
    if payload.action == "approve":
        findings = drafts.review(ProposalContent.model_validate(proposal.versions[-1].content))
        if any(f.blocking for f in findings):
            raise WorkflowError(
                422,
                "proposal_incomplete",
                "A person must complete the commercial terms and every placeholder before approval.",
            )
        if findings and not payload.acknowledge_warnings:
            raise WorkflowError(422, "warnings_unacknowledged", "Review the warnings and acknowledge them to approve.")
        proposal.approved_version = proposal.current_version
        proposal.approved_at = now
    if payload.action in ("approve", "reject"):
        proposal.decided_by = actor
        proposal.decision_note = note
    elif payload.action == "withdraw":
        proposal.decision_note = note
    proposal.status = target.value
    proposal.revision += 1
    proposal.updated_at = now
    _audit(
        db,
        f"proposal.{payload.action}",
        lead,
        actor,
        ip_hash,
        proposal=str(proposal.id),
        version=proposal.current_version,
        status=proposal.status,
        warnings_acknowledged=payload.acknowledge_warnings if payload.action == "approve" else None,
    )
    db.commit()
    return get_proposal(db, lead, proposal.id)  # type: ignore[return-value]
