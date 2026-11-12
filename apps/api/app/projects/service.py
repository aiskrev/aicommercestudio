"""Commercial projects: lifecycle, permissions and views.

Lifecycle (decided before any code; every other move is refused with 409 `project_transition`):

    draft ──staff──▶ quotation ──staff──▶ awaiting_approval ──client──▶ approved ──staff──▶ in_progress
      in_progress ──staff──▶ client_review ──client or staff──▶ completed ──staff──▶ maintenance
      client_review ──client or staff──▶ in_progress (changes requested; a note is required)
      maintenance ──staff──▶ in_progress (new work)

* `quotation → awaiting_approval` needs a linked quotation the client accepted: the offer was answered before the
  project asks for the approval of its scope.
* `awaiting_approval → approved` is the client's approval of the scope: an owner or billing member of the workspace,
  never staff on their behalf, and it records who and when.
* A draft is invisible to the customer. Everything after it is visible.

Roles of the customer workspace (existing, `app/workspace`): the owner and the `billing` member may approve, accept
and ask for changes; every member may read and send change or support requests. Permissions are enforced here, on
the server; the page only follows `allowed_actions`.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import audit
from app.accounts.models import CustomerAccount, OutboxKind
from app.models import AdminUser, Lead, utcnow
from app.opportunities.models import LeadProposal
from app.opportunities.schemas import ProposalContent
from app.projects import notify
from app.projects.models import CommercialProject, ProjectEvent, ProjectMilestone, ProjectStatus
from app.projects.schemas import (
    ClientAction,
    ClientRequest,
    EventOut,
    MilestoneOut,
    MilestonesIn,
    ProjectCreate,
    ProjectDetailOut,
    ProjectSummaryOut,
    ProjectUpdate,
    StaffEventIn,
    StaffProjectOut,
    StaffReply,
    StaffTransition,
)
from app.quotations.models import Quotation
from app.workspace import entitlements

S = ProjectStatus
APPROVER_ROLES = ("owner", "billing")

#: from → {to: who may move it}. "staff", "client" or both.
TRANSITIONS: dict[str, dict[str, tuple[str, ...]]] = {
    S.DRAFT.value: {S.QUOTATION.value: ("staff",)},
    S.QUOTATION.value: {S.AWAITING_APPROVAL.value: ("staff",)},
    S.AWAITING_APPROVAL.value: {S.APPROVED.value: ("client",)},
    S.APPROVED.value: {S.IN_PROGRESS.value: ("staff",)},
    S.IN_PROGRESS.value: {S.CLIENT_REVIEW.value: ("staff",)},
    S.CLIENT_REVIEW.value: {S.IN_PROGRESS.value: ("client", "staff"), S.COMPLETED.value: ("client", "staff")},
    S.COMPLETED.value: {S.MAINTENANCE.value: ("staff",)},
    S.MAINTENANCE.value: {S.IN_PROGRESS.value: ("staff",)},
}
#: What a customer action means in the lifecycle.
CLIENT_MOVES = {
    "approve_scope": (S.AWAITING_APPROVAL.value, S.APPROVED.value),
    "accept_completion": (S.CLIENT_REVIEW.value, S.COMPLETED.value),
    "request_changes": (S.CLIENT_REVIEW.value, S.IN_PROGRESS.value),
}
#: A note is required for these (a reason the customer or staff can read later).
NOTE_REQUIRED = {(S.CLIENT_REVIEW.value, S.IN_PROGRESS.value), (S.IN_PROGRESS.value, S.CLIENT_REVIEW.value)}


class ProjectError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message


def _stale() -> ProjectError:
    return ProjectError(409, "project_stale", "The project was changed by someone else. Reload and try again.")


def can_move(frm: str, to: str, actor: str) -> bool:
    return actor in TRANSITIONS.get(frm, {}).get(to, ())


def staff_transitions(status: str) -> list[str]:
    return [to for to, who in TRANSITIONS.get(status, {}).items() if "staff" in who]


def allowed_for_client(project: CommercialProject, role: str) -> list[str]:
    """What this member may do now. Requests (change, support) are open to every member."""
    actions: list[str] = []
    if project.status == S.DRAFT.value:
        return actions
    if role in APPROVER_ROLES:
        actions += [name for name, (frm, _) in CLIENT_MOVES.items() if frm == project.status]
    actions += ["change_request", "support"]
    return actions


# --------------------------------------------------------------------------- customer side


def workspace_projects(db: Session, workspace_id: uuid.UUID) -> list[CommercialProject]:
    return list(
        db.scalars(
            select(CommercialProject)
            .where(CommercialProject.workspace_id == workspace_id, CommercialProject.status != S.DRAFT.value)
            .order_by(CommercialProject.updated_at.desc())
            .limit(100)
        ).all()
    )


def project_of(db: Session, workspace_id: uuid.UUID, project_id: uuid.UUID, *, lock: bool = False) -> CommercialProject:
    """A visible project of this workspace. A project of another workspace and a draft answer the same 404."""
    query = select(CommercialProject).where(
        CommercialProject.id == project_id,
        CommercialProject.workspace_id == workspace_id,
        CommercialProject.status != S.DRAFT.value,
    )
    if lock:
        query = query.with_for_update()
    project = db.scalar(query)
    if project is None:
        raise ProjectError(404, "project_not_found", "Not found.")
    return project


def _milestones(db: Session, project: CommercialProject) -> list[ProjectMilestone]:
    return list(
        db.scalars(
            select(ProjectMilestone)
            .where(ProjectMilestone.project_id == project.id)
            .order_by(ProjectMilestone.position)
        ).all()
    )


def _events(db: Session, project: CommercialProject, *, internal: bool) -> list[ProjectEvent]:
    query = (
        select(ProjectEvent)
        .where(ProjectEvent.project_id == project.id)
        .order_by(ProjectEvent.created_at, ProjectEvent.id)
    )
    if not internal:
        query = query.where(ProjectEvent.visibility == "client")
    return list(db.scalars(query).all())


def _event_out(event: ProjectEvent, viewer_account: uuid.UUID | None) -> EventOut:
    return EventOut(
        id=event.id,
        kind=event.kind,
        visibility=event.visibility,
        author="client" if event.author_kind == "client" else "team" if event.author_kind == "staff" else "system",
        mine=viewer_account is not None and event.author_account_id == viewer_account,
        body=event.body,
        state=event.state,
        parent_id=event.parent_id,
        meta=event.meta,
        created_at=event.created_at,
    )


def _quotation(db: Session, project: CommercialProject) -> Quotation | None:
    return db.get(Quotation, project.quotation_id) if project.quotation_id else None


def _quotation_status(quotation: Quotation | None) -> str | None:
    from app.quotations.service import effective_status

    return effective_status(quotation) if quotation else None


def _scope(project: CommercialProject) -> ProposalContent | None:
    return ProposalContent.model_validate(project.scope) if project.scope else None


def summary_out(db: Session, project: CommercialProject) -> ProjectSummaryOut:
    open_requests = (
        db.scalar(
            select(func.count())
            .select_from(ProjectEvent)
            .where(ProjectEvent.project_id == project.id, ProjectEvent.state == "open")
        )
        or 0
    )
    return ProjectSummaryOut(
        id=project.id,
        reference=project.reference,
        title=project.title,
        status=project.status,  # type: ignore[arg-type]
        updated_at=project.updated_at,
        open_requests=open_requests,
    )


def _detail(
    db: Session, project: CommercialProject, *, internal: bool, viewer: uuid.UUID | None, actions: list[str]
) -> dict[str, Any]:
    quotation = _quotation(db, project)
    return {
        "id": project.id,
        "reference": project.reference,
        "title": project.title,
        "summary": project.summary,
        "status": project.status,
        "revision": project.revision,
        "quotation_reference": quotation.id.hex[:8].upper() if quotation else None,
        "quotation_status": _quotation_status(quotation),
        "scope_version": project.scope_version,
        "scope": _scope(project),
        "contract_reference": project.contract_reference,
        "invoice_references": list(project.invoice_references or []),
        "maintenance_plan": project.maintenance_plan,
        "maintenance_note": project.maintenance_note,
        "approved_at": project.approved_at,
        "completed_at": project.completed_at,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "milestones": [MilestoneOut.model_validate(m, from_attributes=True) for m in _milestones(db, project)],
        "events": [_event_out(e, viewer) for e in _events(db, project, internal=internal)],
        "allowed_actions": actions,
    }


def client_detail(db: Session, project: CommercialProject, account_id: uuid.UUID, role: str) -> ProjectDetailOut:
    return ProjectDetailOut(
        **_detail(db, project, internal=False, viewer=account_id, actions=allowed_for_client(project, role))
    )


def staff_detail(db: Session, project: CommercialProject) -> StaffProjectOut:
    owner = _owner(db, project)
    return StaffProjectOut(
        **_detail(db, project, internal=True, viewer=None, actions=[]),
        lead_id=project.lead_id,
        quotation_id=project.quotation_id,
        customer_email=owner.email if owner else None,
        customer_name=owner.display_name if owner else None,
        staff_transitions=staff_transitions(project.status),
    )


def _owner(db: Session, project: CommercialProject) -> CustomerAccount | None:
    from app.workspace.models import CustomerWorkspace

    workspace = db.get(CustomerWorkspace, project.workspace_id)
    return db.get(CustomerAccount, workspace.owner_account_id) if workspace else None


def _touch(project: CommercialProject) -> None:
    project.revision += 1
    project.updated_at = utcnow()


def _event(
    db: Session,
    project: CommercialProject,
    kind: str,
    *,
    author_kind: str,
    body: str | None = None,
    visibility: str = "client",
    admin: AdminUser | None = None,
    account: uuid.UUID | None = None,
    state: str | None = None,
    parent: uuid.UUID | None = None,
    meta: dict | None = None,
) -> ProjectEvent:
    event = ProjectEvent(
        project_id=project.id,
        kind=kind,
        visibility=visibility,
        author_kind=author_kind,
        author_admin_id=admin.id if admin else None,
        author_account_id=account,
        body=body or None,
        state=state,
        parent_id=parent,
        meta=meta,
    )
    db.add(event)
    db.flush()
    return event


def _audit(
    db: Session,
    action: str,
    project: CommercialProject,
    *,
    actor: AdminUser | None = None,
    label: str | None = None,
    ip_hash: str | None = None,
    **details: object,
) -> None:
    audit.record(
        db,
        action,
        actor=actor,
        actor_label=label,
        entity_type="project",
        entity_id=str(project.id),
        details={"reference": project.reference, **details},
        ip_hash=ip_hash,
    )


def _move(
    db: Session,
    project: CommercialProject,
    to: str,
    *,
    author_kind: str,
    note: str | None,
    admin: AdminUser | None,
    account: uuid.UUID | None,
) -> ProjectEvent:
    previous = project.status
    project.status = to
    if to == S.APPROVED.value:
        project.approved_at = utcnow()
        project.approved_by_account_id = account
    if to == S.COMPLETED.value:
        project.completed_at = utcnow()
    _touch(project)
    status_event = _event(
        db,
        project,
        "status",
        author_kind=author_kind,
        body=note,
        admin=admin,
        account=account,
        meta={"from": previous, "to": to},
    )
    if to == S.APPROVED.value:
        _event(
            db,
            project,
            "approval",
            author_kind="client",
            account=account,
            meta={"scope_version": project.scope_version},
        )
    return status_event


def client_action(
    db: Session,
    project: CommercialProject,
    payload: ClientAction,
    account: CustomerAccount,
    role: str,
    ip_hash: str | None,
) -> tuple[CommercialProject, bool]:
    """A customer's decision. Returns (project, recorded). The caller holds the row lock."""
    frm, to = CLIENT_MOVES[payload.action]
    if role not in APPROVER_ROLES:
        raise ProjectError(403, "role_not_allowed", "Your role in this workspace may not take this decision.")
    if project.status == to and payload.action != "request_changes":
        return project, False  # the same decision again (a double click or a retry) changes nothing
    if payload.expected_revision != project.revision:
        raise _stale()
    if project.status != frm or not can_move(frm, to, "client"):
        raise ProjectError(409, "project_transition", f"A {project.status} project cannot take '{payload.action}'.")
    if (frm, to) in NOTE_REQUIRED and not (payload.note or "").strip():
        raise ProjectError(422, "note_required", "Say what should change.")
    _move(
        db, project, to, author_kind="client", note=(payload.note or "").strip() or None, admin=None, account=account.id
    )
    _audit(db, f"project.{payload.action}", project, label=f"account:{account.id}", ip_hash=ip_hash, to=to)
    db.commit()
    return project, True


def client_request(
    db: Session, project: CommercialProject, payload: ClientRequest, account: CustomerAccount, ip_hash: str | None
) -> ProjectEvent:
    event = _event(db, project, payload.kind, author_kind="client", body=payload.body, account=account.id, state="open")
    project.updated_at = utcnow()
    _audit(db, f"project.{payload.kind}", project, label=f"account:{account.id}", ip_hash=ip_hash, event=str(event.id))
    db.commit()
    return event


# --------------------------------------------------------------------------- staff side


def record_view(
    db: Session,
    project: CommercialProject,
    actor: AdminUser,
    ip_hash: str | None,
    *,
    action: str = "project.viewed",
    throttle_minutes: int = 15,
) -> None:
    """Audits a staff member reading a customer's project, at most once per person, project and window.

    Reading customer data is itself an event (like opening a lead): the entry holds ids only.
    """
    from datetime import timedelta

    from app.models import AuditLog

    since = utcnow() - timedelta(minutes=throttle_minutes)
    recent = db.scalar(
        select(AuditLog.id)
        .where(
            AuditLog.action == action,
            AuditLog.entity_id == str(project.id),
            AuditLog.actor_id == actor.id,
            AuditLog.created_at >= since,
        )
        .limit(1)
    )
    if recent is None:
        _audit(db, action, project, actor=actor, ip_hash=ip_hash)
        db.commit()


def get(db: Session, project_id: uuid.UUID, *, lock: bool = False) -> CommercialProject | None:
    query = select(CommercialProject).where(CommercialProject.id == project_id)
    if lock:
        query = query.with_for_update()
    return db.scalar(query)


def list_all(db: Session, status: str | None = None, lead_id: uuid.UUID | None = None) -> list[CommercialProject]:
    query = select(CommercialProject).order_by(CommercialProject.updated_at.desc()).limit(200)
    if status:
        query = query.where(CommercialProject.status == status)
    if lead_id:
        query = query.where(CommercialProject.lead_id == lead_id)
    return list(db.scalars(query).all())


def create(
    db: Session, lead: Lead, payload: ProjectCreate, actor: AdminUser, ip_hash: str | None
) -> tuple[CommercialProject, bool]:
    """Creates a draft for the workspace of a verified customer account. Returns (project, created)."""
    account = db.scalar(select(CustomerAccount).where(CustomerAccount.email == payload.account_email))
    if account is None or account.email_verified_at is None or account.erased_at is not None:
        raise ProjectError(422, "account_not_found", "No verified customer account has this e-mail address.")
    workspace = entitlements.workspace_for(db, account.id)
    quotation: Quotation | None = None
    scope: dict | None = None
    scope_version: int | None = None
    if payload.quotation_id is not None:
        quotation = db.get(Quotation, payload.quotation_id)
        if quotation is None or quotation.lead_id != lead.id:
            raise ProjectError(404, "quotation_not_found", "The quotation does not belong to this lead.")
        existing = db.scalar(select(CommercialProject).where(CommercialProject.quotation_id == quotation.id))
        if existing is not None:
            if existing.workspace_id != workspace.id:
                raise ProjectError(409, "project_exists", "This quotation already has a project for another customer.")
            return existing, False
        if quotation.status != "accepted":
            raise ProjectError(409, "quotation_not_accepted", "Only an accepted quotation can start a project.")
        proposal = db.get(LeadProposal, quotation.proposal_id)
        version = (
            next((v for v in proposal.versions if v.number == quotation.version_number), None) if proposal else None
        )
        if version is None:
            raise ProjectError(409, "quotation_not_found", "The approved version of the quotation is missing.")
        scope, scope_version = ProposalContent.model_validate(version.content).model_dump(mode="json"), version.number
    existing = db.scalar(
        select(CommercialProject).where(
            CommercialProject.workspace_id == workspace.id,
            CommercialProject.lead_id == lead.id,
            CommercialProject.title == payload.title,
        )
    )
    if existing is not None:
        return existing, False
    project = CommercialProject(
        workspace_id=workspace.id,
        lead_id=lead.id,
        quotation_id=quotation.id if quotation else None,
        title=payload.title,
        summary=payload.summary or None,
        status=S.DRAFT.value,
        scope=scope,
        scope_version=scope_version,
        contract_reference=payload.contract_reference,
        invoice_references=[],
        created_by_id=actor.id,
    )
    db.add(project)
    db.flush()
    _event(
        db,
        project,
        "status",
        author_kind="staff",
        admin=actor,
        visibility="internal",
        meta={"from": None, "to": S.DRAFT.value},
    )
    _audit(
        db,
        "project.created",
        project,
        actor=actor,
        ip_hash=ip_hash,
        lead=str(lead.id),
        quotation=str(quotation.id) if quotation else None,
    )
    db.commit()
    return project, True


def update_details(
    db: Session, project: CommercialProject, payload: ProjectUpdate, actor: AdminUser, ip_hash: str | None
) -> CommercialProject:
    if payload.expected_revision != project.revision:
        raise _stale()
    changed: list[str] = []
    for field in ("title", "summary", "maintenance_plan", "maintenance_note", "invoice_references"):
        value = getattr(payload, field)
        if value is not None and value != getattr(project, field):
            setattr(project, field, value)
            changed.append(field)
    if payload.clear_contract_reference and project.contract_reference is not None:
        project.contract_reference = None
        changed.append("contract_reference")
    elif payload.contract_reference is not None and payload.contract_reference != project.contract_reference:
        project.contract_reference = payload.contract_reference
        changed.append("contract_reference")
    if changed:
        _touch(project)
        _audit(db, "project.updated", project, actor=actor, ip_hash=ip_hash, fields=changed)
    db.commit()
    return project


def set_milestones(
    db: Session, project: CommercialProject, payload: MilestonesIn, actor: AdminUser, ip_hash: str | None
) -> CommercialProject:
    if payload.expected_revision != project.revision:
        raise _stale()
    existing = {m.id: m for m in _milestones(db, project)}
    before = [(m.title, m.description, m.indicative_timing, m.status) for m in _milestones(db, project)]
    keep: set[uuid.UUID] = set()
    now = utcnow()
    for position, item in enumerate(payload.milestones):
        row = existing.get(item.id) if item.id else None
        if item.id and row is None:
            raise ProjectError(422, "milestone_unknown", "A milestone does not belong to this project.")
        if row is None:
            row = ProjectMilestone(project_id=project.id)
            db.add(row)
        row.position = position
        row.title = item.title
        row.description = item.description or None
        row.indicative_timing = item.indicative_timing or None
        if item.status == "done" and row.status != "done":
            row.completed_at = now
        elif item.status != "done":
            row.completed_at = None
        row.status = item.status
        db.flush()
        keep.add(row.id)
    removed = [mid for mid in existing if mid not in keep]
    if removed:
        db.execute(delete(ProjectMilestone).where(ProjectMilestone.id.in_(removed)))
    after = [(m.title, m.description, m.indicative_timing, m.status) for m in _milestones(db, project)]
    if after != before:
        notify.queue(db, project, OutboxKind.PROJECT_UPDATE, uuid.uuid4())
    _touch(project)
    _audit(db, "project.milestones", project, actor=actor, ip_hash=ip_hash, count=len(payload.milestones))
    db.commit()
    return project


def staff_transition(
    db: Session, project: CommercialProject, payload: StaffTransition, actor: AdminUser, ip_hash: str | None
) -> CommercialProject:
    if payload.expected_revision != project.revision:
        raise _stale()
    if not can_move(project.status, payload.to, "staff"):
        raise ProjectError(
            409, "project_transition", f"A {project.status} project cannot move to {payload.to} by staff."
        )
    note = (payload.note or "").strip() or None
    if (project.status, payload.to) in NOTE_REQUIRED and not note:
        raise ProjectError(422, "note_required", "A note is required for this move.")
    if project.status == S.CLIENT_REVIEW.value and payload.to == S.COMPLETED.value and not note:
        raise ProjectError(
            422, "note_required", "Say how the customer accepted: staff complete a project only with a note."
        )
    if payload.to == S.AWAITING_APPROVAL.value:
        quotation = _quotation(db, project)
        if quotation is None or quotation.status != "accepted":
            raise ProjectError(
                409, "quotation_not_accepted", "The project needs an accepted quotation before it asks for approval."
            )
    previous = project.status
    status_event = _move(db, project, payload.to, author_kind="staff", note=note, admin=actor, account=None)
    kind = {
        S.AWAITING_APPROVAL.value: OutboxKind.APPROVAL_REQUESTED,
        S.CLIENT_REVIEW.value: OutboxKind.REVIEW_REQUESTED,
    }.get(payload.to) or (OutboxKind.PROJECT_AVAILABLE if previous == S.DRAFT.value else OutboxKind.PROJECT_UPDATE)
    notify.queue(db, project, kind, status_event.id)
    _audit(db, "project.transition", project, actor=actor, ip_hash=ip_hash, to=payload.to)
    db.commit()
    return project


def staff_event(
    db: Session, project: CommercialProject, payload: StaffEventIn, actor: AdminUser, ip_hash: str | None
) -> ProjectEvent:
    if project.status == S.DRAFT.value and payload.visibility == "client":
        raise ProjectError(409, "project_draft", "A draft is not visible to the customer yet: write an internal note.")
    event = _event(
        db, project, payload.kind, author_kind="staff", body=payload.body, admin=actor, visibility=payload.visibility
    )
    if payload.visibility == "client":
        project.updated_at = utcnow()
        notify.queue(db, project, OutboxKind.PROJECT_UPDATE, event.id)
    _audit(
        db,
        f"project.{payload.kind}",
        project,
        actor=actor,
        ip_hash=ip_hash,
        event=str(event.id),
        visibility=payload.visibility,
    )
    db.commit()
    return event


def staff_reply(
    db: Session,
    project: CommercialProject,
    request_id: uuid.UUID,
    payload: StaffReply,
    actor: AdminUser,
    ip_hash: str | None,
) -> ProjectEvent:
    request = db.scalar(
        select(ProjectEvent)
        .where(ProjectEvent.id == request_id, ProjectEvent.project_id == project.id)
        .with_for_update()
    )
    if request is None or request.state is None:
        raise ProjectError(404, "request_not_found", "Request not found.")
    reply = _event(db, project, "response", author_kind="staff", body=payload.body, admin=actor, parent=request.id)
    request.state = payload.state
    project.updated_at = utcnow()
    notify.queue(db, project, OutboxKind.SUPPORT_REPLY, reply.id)
    _audit(db, "project.response", project, actor=actor, ip_hash=ip_hash, request=str(request.id), state=payload.state)
    db.commit()
    return reply
