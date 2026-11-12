"""Evidence, consumer withdrawal and data-subject rights.

Principles (docs/LEGAL_COMPLIANCE_REMEDIATION_2026-11-10.md):
* A withdrawal statement is always recorded and confirmed on a durable medium (e-mail); staff decide what is refunded
  and no money moves automatically.
* Accounting records are never deleted because a login is deleted: an account with billing or accounting data is
  anonymized, not removed.
* Nothing here stores an IP address or a user agent.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import legal
from app.accounts.models import (
    CustomerAccount,
    CustomerSession,
    CustomerToken,
    OutboxKind,
    OutboxMessage,
)
from app.billing.models import (
    BillingCheckout,
    BillingCustomer,
    BillingOffer,
    BillingPurchase,
    BillingSubscription,
)
from app.compliance.models import DataRequest, LegalEvent, WithdrawalRequest
from app.config import Settings, get_settings
from app.invoicing.models import AccountingDocument, BillingProfile
from app.models import Lead, utcnow
from app.projects.doc_models import DocumentApproval, DocumentComment, ProjectDocument, ProjectDocumentVersion
from app.projects.models import CommercialProject, ProjectEvent
from app.workspace.models import (
    AssessmentVersion,
    CustomerWorkspace,
    SupportRequest,
    WorkspaceInvitation,
    WorkspaceMember,
    WorkspaceProject,
)

WITHDRAWAL_DAYS = 14
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class ComplianceError(Exception):
    def __init__(self, status: int, code: str, detail: str):
        super().__init__(detail)
        self.status, self.code, self.detail = status, code, detail


# ------------------------------------------------------------------------------------------- evidence


def in_reading_order(events: Sequence[LegalEvent]) -> list[LegalEvent]:
    """Oldest first. Events written together share a timestamp; the acknowledgement of the privacy notice is listed
    before a consent given with it, and a withdrawal after everything else at that moment."""
    return sorted(events, key=lambda e: (e.created_at, e.document != "privacy", e.action == "withdrawn"))


def record_event(
    db: Session,
    *,
    document: legal.DocumentKey,
    action: str,
    version: str | None = None,
    locale: str | None = None,
    source: str | None = None,
    lead_id: uuid.UUID | None = None,
    account_id: uuid.UUID | None = None,
    checkout_id: uuid.UUID | None = None,
    withdrawal_id: uuid.UUID | None = None,
    at: datetime | None = None,
) -> LegalEvent:
    event = LegalEvent(
        document=document,
        version=version or legal.version(document),
        action=action,
        locale=locale if locale in ("bg", "en") else None,
        source=source,
        lead_id=lead_id,
        account_id=account_id,
        checkout_id=checkout_id,
        withdrawal_id=withdrawal_id,
        created_at=at or utcnow(),
    )
    db.add(event)
    return event


def record_event_once(db: Session, **kwargs: Any) -> bool:
    """Records an event for a checkout unless the same document, action and version is already recorded for it.

    A retried request (a double click, a reused checkout, a client retry) must not write the same acceptance twice.
    A partial unique index on `legal_events` enforces it in the database; the savepoint keeps a lost race from
    aborting the caller's transaction. Returns True when a row was written."""
    checkout_id = kwargs.get("checkout_id")
    document = kwargs["document"]
    action = kwargs["action"]
    version = kwargs.get("version") or legal.version(document)
    if checkout_id is not None:
        already = db.scalar(
            select(func.count())
            .select_from(LegalEvent)
            .where(
                LegalEvent.checkout_id == checkout_id,
                LegalEvent.document == document,
                LegalEvent.action == action,
                LegalEvent.version == version,
            )
        )
        if already:
            return False
    try:
        with db.begin_nested():
            record_event(db, **kwargs)
            db.flush()
    except IntegrityError:
        return False
    return True


def new_reference(prefix: str) -> str:
    return f"{prefix}-{utcnow():%Y%m%d}-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))


def withdraw_lead_marketing(db: Session, lead: Lead, *, locale: str | None = None, source: str = "staff") -> bool:
    """Withdraws the marketing consent of an inquiry (by staff on the person's request, or by the person with the
    link). Idempotent: returns False if there was nothing to withdraw. The consent row keeps its version and time;
    the withdrawal is a new, append-only event. Nothing else about the inquiry is touched."""
    if not lead.marketing_consent:
        return False
    lead.marketing_consent = False
    lead.marketing_consent_withdrawn_at = utcnow()
    record_event(
        db,
        document="marketing_consent",
        action="withdrawn",
        version=lead.marketing_consent_version,
        locale=locale or lead.locale,
        source=source,
        lead_id=lead.id,
    )
    return True


# ------------------------------------------------------------------------------------------- self-service withdrawal
#
# The link in a marketing message carries an opaque token, never the lead id. The token is an HMAC of the lead id
# with the server secret, so it can be minted again at any time and cannot be guessed; the database stores only its
# SHA-256 (`leads.marketing_token_hash`), so a copy of the database does not contain usable links. It does not expire:
# an unsubscribe link must keep working for as long as the person can receive marketing.


def _marketing_token(lead_id: uuid.UUID) -> str:
    material = f"marketing-withdrawal:{lead_id}".encode()
    key = get_settings().secret_key.encode()
    return hmac.new(key, material, hashlib.sha256).hexdigest()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def mint_marketing_token(db: Session, lead: Lead) -> str:
    """For staff, when preparing a campaign: the token for this lead (stable; recomputed from the secret)."""
    token = _marketing_token(lead.id)
    lead.marketing_token_hash = _token_hash(token)
    return token


def lead_for_marketing_token(db: Session, token: str, *, lock: bool = False) -> Lead | None:
    token = (token or "").strip().lower()
    if len(token) != 64 or any(ch not in "0123456789abcdef" for ch in token):
        return None
    query = select(Lead).where(Lead.marketing_token_hash == _token_hash(token))
    if lock:
        query = query.with_for_update()
    lead = db.scalar(query)
    # Constant-time confirmation that the stored hash really belongs to a token this server minted.
    if lead is None or not hmac.compare_digest(_marketing_token(lead.id), token):
        return None
    return lead


# ------------------------------------------------------------------------------------------- withdrawal


@dataclass(frozen=True)
class Contract:
    kind: str  # subscription | purchase
    ref: str
    offer_key: str
    concluded_at: datetime | None
    customer_kind: str
    early_start: bool


def _checkout_of(
    db: Session, workspace_id: uuid.UUID, offer_key: str, session_id: str | None
) -> BillingCheckout | None:
    query = select(BillingCheckout).where(
        BillingCheckout.workspace_id == workspace_id, BillingCheckout.status == "complete"
    )
    query = (
        query.where(BillingCheckout.stripe_session_id == session_id)
        if session_id
        else query.where(BillingCheckout.offer_key == offer_key)
    )
    return db.scalars(query.order_by(BillingCheckout.created_at.desc())).first()


def find_contract(db: Session, workspace_id: uuid.UUID, ref: str) -> Contract | None:
    """The subscription or one-time purchase of this workspace that `ref` names (never another workspace's)."""
    sub = db.scalar(
        select(BillingSubscription).where(
            BillingSubscription.stripe_subscription_id == ref, BillingSubscription.workspace_id == workspace_id
        )
    )
    purchase = (
        None
        if sub
        else db.scalar(
            select(BillingPurchase).where(
                BillingPurchase.stripe_session_id == ref, BillingPurchase.workspace_id == workspace_id
            )
        )
    )
    if sub is None and purchase is None:
        return None
    offer_key = sub.offer_key if sub else purchase.offer_key
    checkout = _checkout_of(db, workspace_id, offer_key, purchase.stripe_session_id if purchase else None)
    concluded = (
        checkout.completed_at or checkout.created_at if checkout else (purchase.created_at if purchase else None)
    )
    # The customer kind comes from the acceptance recorded at checkout. Without that evidence (a contract made before
    # these records existed) it is NOT assumed to be a business: the statement is recorded and staff decide.
    kind, early = "consumer", False
    if checkout is not None:
        events = db.scalars(select(LegalEvent).where(LegalEvent.checkout_id == checkout.id)).all()
        for event in events:
            if event.document == "order_acceptance" and event.source:
                kind = "business" if event.source.endswith("business") else "consumer"
            if event.document == "early_start" and event.action == "requested":
                early = True
    return Contract(
        kind="subscription" if sub else "purchase",
        ref=ref,
        offer_key=offer_key,
        concluded_at=concluded,
        customer_kind=kind,
        early_start=early,
    )


def assess(customer_kind: str, concluded_at: datetime | None, now: datetime) -> tuple[str, datetime | None]:
    """The system's first reading of a statement. It never rejects it: staff decide."""
    if customer_kind != "consumer":
        return "business_customer", None
    if concluded_at is None:
        return "unknown_contract_date", None
    ends = concluded_at + timedelta(days=WITHDRAWAL_DAYS)
    return ("within_period" if now <= ends else "period_expired"), ends


def open_withdrawal(db: Session, workspace_id: uuid.UUID, ref: str) -> WithdrawalRequest | None:
    """The open request for this workspace's contract, if any (never another workspace's)."""
    return db.scalar(
        select(WithdrawalRequest).where(
            WithdrawalRequest.workspace_id == workspace_id,
            WithdrawalRequest.subject_ref == ref,
            WithdrawalRequest.status.in_(("received", "refund_review")),
        )
    )


def preview_withdrawal(db: Session, workspace_id: uuid.UUID, ref: str) -> dict[str, Any]:
    contract = find_contract(db, workspace_id, ref)
    if contract is None:
        raise ComplianceError(404, "contract_not_found", "This purchase wasn't found.")
    eligibility, ends = assess(contract.customer_kind, contract.concluded_at, utcnow())
    existing = db.scalar(
        select(WithdrawalRequest).where(
            WithdrawalRequest.workspace_id == workspace_id,
            WithdrawalRequest.subject_ref == ref,
            WithdrawalRequest.status.in_(("received", "refund_review")),
        )
    )
    return {
        "offer": contract.offer_key,
        "kind": contract.kind,
        "customer_kind": contract.customer_kind,
        "concluded_at": contract.concluded_at,
        "period_ends_at": ends,
        "eligibility": eligibility,
        "early_start_requested": contract.early_start,
        "existing_reference": existing.reference if existing else None,
    }


def create_withdrawal(
    db: Session,
    *,
    workspace: CustomerWorkspace,
    account: CustomerAccount,
    ref: str,
    statement: str,
    locale: str,
) -> tuple[WithdrawalRequest, bool]:
    """Record the statement and queue the confirmation. Returns (request, created); a repeat returns the open one."""
    contract = find_contract(db, workspace.id, ref)
    if contract is None:
        raise ComplianceError(404, "contract_not_found", "This purchase wasn't found.")
    open_request = db.scalar(
        select(WithdrawalRequest).where(
            WithdrawalRequest.workspace_id == workspace.id,
            WithdrawalRequest.subject_ref == ref,
            WithdrawalRequest.status.in_(("received", "refund_review")),
        )
    )
    if open_request is not None:
        return open_request, False
    now = utcnow()
    eligibility, ends = assess(contract.customer_kind, contract.concluded_at, now)
    request = WithdrawalRequest(
        reference=new_reference("W"),
        workspace_id=workspace.id,
        account_id=account.id,
        subject_kind=contract.kind,
        subject_ref=ref,
        offer_key=contract.offer_key,
        statement=statement.strip(),
        locale=locale if locale in ("bg", "en") else "bg",
        customer_kind=contract.customer_kind,
        early_start_requested=contract.early_start,
        contract_concluded_at=contract.concluded_at,
        period_ends_at=ends,
        eligibility=eligibility,
        created_at=now,
    )
    try:
        with db.begin_nested():  # savepoint: losing the race must not abort the caller's transaction
            db.add(request)
            db.flush()
    except IntegrityError:
        # A parallel request opened it first (partial unique index uq_withdrawal_requests_open): answer as for a repeat.
        winner = db.scalar(
            select(WithdrawalRequest).where(
                WithdrawalRequest.workspace_id == workspace.id,
                WithdrawalRequest.subject_ref == ref,
                WithdrawalRequest.status.in_(("received", "refund_review")),
            )
        )
        if winner is None:
            raise ComplianceError(409, "withdrawal_exists", "A withdrawal for this purchase is already open.") from None
        return winner, False
    record_event(
        db,
        document="withdrawal_info",
        action="requested",
        locale=request.locale,
        source="withdrawal",
        withdrawal_id=request.id,
    )
    db.add(
        OutboxMessage(
            account_id=account.id,
            kind=OutboxKind.WITHDRAWAL_RECEIVED.value,
            locale=request.locale,
            reference=request.reference,
        )
    )
    request.confirmation_queued_at = now
    return request, True


def decide_withdrawal(
    db: Session,
    request: WithdrawalRequest,
    *,
    status: str,
    note: str | None,
    refund_reference: str | None,
    refund_amount_minor: int | None,
    actor: str,
) -> WithdrawalRequest:
    if request.status in ("refunded", "closed"):
        raise ComplianceError(409, "already_decided", "This request is already closed.")
    if status == "refunded" and not (refund_reference and refund_amount_minor and refund_amount_minor > 0):
        raise ComplianceError(
            422, "refund_details_required", "Record the Stripe refund reference and amount after refunding there."
        )
    request.status = status
    request.outcome_note = (note or "").strip()[:500] or None
    if status == "refunded":
        request.refund_reference = refund_reference
        request.refund_amount_minor = refund_amount_minor
    if status in ("refunded", "closed"):
        request.decided_at = utcnow()
        request.decided_by = actor[:120]
    return request


def present_withdrawal(row: WithdrawalRequest) -> dict[str, Any]:
    return {
        "reference": row.reference,
        "offer": row.offer_key,
        "status": row.status,
        "eligibility": row.eligibility,
        "customer_kind": row.customer_kind,
        "early_start_requested": row.early_start_requested,
        "contract_concluded_at": row.contract_concluded_at,
        "period_ends_at": row.period_ends_at,
        "created_at": row.created_at,
        "decided_at": row.decided_at,
        "outcome_note": row.outcome_note,
        "refund_reference": row.refund_reference,
        "refund_amount_minor": row.refund_amount_minor,
        "confirmation_queued_at": row.confirmation_queued_at,
    }


# ------------------------------------------------------------------------------------------- data rights


def build_export(db: Session, account: CustomerAccount) -> dict[str, Any]:
    """Everything the account holder is entitled to see about their own account. No hashes, no secrets."""
    events = in_reading_order(db.scalars(select(LegalEvent).where(LegalEvent.account_id == account.id)).all())
    sessions = db.scalars(select(CustomerSession).where(CustomerSession.account_id == account.id)).all()
    owned = db.scalars(select(CustomerWorkspace).where(CustomerWorkspace.owner_account_id == account.id)).all()
    member_of = db.scalars(select(WorkspaceMember).where(WorkspaceMember.account_id == account.id)).all()
    workspace_ids = [w.id for w in owned]
    projects = (
        db.scalars(select(WorkspaceProject).where(WorkspaceProject.workspace_id.in_(workspace_ids))).all()
        if workspace_ids
        else []
    )
    versions = (
        db.scalars(select(AssessmentVersion).where(AssessmentVersion.project_id.in_([p.id for p in projects]))).all()
        if projects
        else []
    )
    profile = db.get(BillingProfile, workspace_ids[0]) if workspace_ids else None
    support = db.scalars(select(SupportRequest).where(SupportRequest.created_by == account.id)).all()
    withdrawals = db.scalars(select(WithdrawalRequest).where(WithdrawalRequest.account_id == account.id)).all()
    documents = (
        db.scalars(select(AccountingDocument).where(AccountingDocument.workspace_id.in_(workspace_ids))).all()
        if workspace_ids
        else []
    )
    return {
        "generated_at": utcnow(),
        "note": "Data held about this account. Password and token hashes are never included.",
        "account": {
            "email": account.email,
            "display_name": account.display_name,
            "locale": account.locale,
            "email_verified_at": account.email_verified_at,
            "created_at": account.created_at,
            "privacy_notice_version": account.privacy_notice_version,
            "privacy_acknowledged_at": account.privacy_acknowledged_at,
            "marketing_consent": account.marketing_consent_at is not None,
            "marketing_consent_version": account.marketing_consent_version,
            "marketing_consent_at": account.marketing_consent_at,
        },
        "consent_history": [
            {"at": e.created_at, "document": e.document, "version": e.version, "action": e.action, "locale": e.locale}
            for e in events
        ],
        "sessions": [
            {"created_at": s.created_at, "last_seen_at": s.last_seen_at, "device": s.user_agent} for s in sessions
        ],
        "workspaces_owned": [str(w.id) for w in owned],
        "workspaces_member_of": [{"workspace": str(m.workspace_id), "role": m.role} for m in member_of],
        "projects": [{"name": p.name, "created_at": p.created_at} for p in projects],
        "assessment_versions": [
            {"number": v.number, "label": v.label, "inputs": v.inputs, "locale": v.locale, "created_at": v.created_at}
            for v in versions
        ],
        "billing_profile": (
            {
                "legal_name": profile.legal_name,
                "company_id": profile.company_id,
                "vat_id": profile.vat_id,
                "address": profile.address,
                "country": profile.country,
                "email": profile.email,
            }
            if profile
            else None
        ),
        "accounting_documents": [
            {"kind": d.kind, "status": d.status, "created_at": d.created_at, "number": getattr(d, "number", None)}
            for d in documents
        ],
        "support_requests": [{"subject": s.subject, "message": s.message, "created_at": s.created_at} for s in support],
        "commercial_projects": _project_export(db, workspace_ids, account.id),
        "project_documents": _document_export(db, workspace_ids, account.id),
        "withdrawal_requests": [present_withdrawal(w) for w in withdrawals],
    }


def _document_export(db: Session, workspace_ids: list, account_id) -> dict[str, list[dict[str, Any]]]:
    """What the account itself did with project documents: its uploads, its decisions and its feedback. The files
    themselves are the project's and are not part of this export."""
    empty: dict[str, list[dict[str, Any]]] = {"uploads": [], "decisions": [], "comments": []}
    if not workspace_ids:
        return empty
    projects = {
        p.id: p
        for p in db.scalars(select(CommercialProject).where(CommercialProject.workspace_id.in_(workspace_ids))).all()
    }
    if not projects:
        return empty
    documents = {
        d.id: d for d in db.scalars(select(ProjectDocument).where(ProjectDocument.project_id.in_(projects))).all()
    }
    versions = {
        v.id: v
        for v in db.scalars(
            select(ProjectDocumentVersion).where(ProjectDocumentVersion.document_id.in_(documents))
        ).all()
    }
    out = empty
    for v in versions.values():
        if v.uploaded_by_account_id == account_id:
            d = documents[v.document_id]
            out["uploads"].append(
                {
                    "project": projects[d.project_id].reference,
                    "document": d.title,
                    "version": v.number,
                    "file": v.filename,
                    "at": v.created_at,
                }
            )
    for a in db.scalars(select(DocumentApproval).where(DocumentApproval.project_id.in_(projects))).all():
        if a.decided_by_account_id == account_id and a.version_id in versions:
            out["decisions"].append(
                {
                    "project": projects[a.project_id].reference,
                    "document": documents[a.document_id].title,
                    "version": versions[a.version_id].number,
                    "decision": a.state,
                    "note": a.decision_note,
                    "at": a.decided_at,
                }
            )
    for c in db.scalars(select(DocumentComment).where(DocumentComment.document_id.in_(documents))).all():
        if c.author_account_id == account_id:
            out["comments"].append({"document": documents[c.document_id].title, "text": c.body, "at": c.created_at})
    return out


def _project_export(db: Session, workspace_ids: list, account_id) -> list[dict[str, Any]]:
    """The commercial projects of the account's workspaces and what the account itself wrote in them. Staff-written
    internal notes are not the customer's data and are not included."""
    if not workspace_ids:
        return []
    rows = db.scalars(select(CommercialProject).where(CommercialProject.workspace_id.in_(workspace_ids))).all()
    out: list[dict[str, Any]] = []
    for project in rows:
        written = db.scalars(
            select(ProjectEvent).where(
                ProjectEvent.project_id == project.id, ProjectEvent.author_account_id == account_id
            )
        ).all()
        out.append(
            {
                "reference": project.reference,
                "title": project.title,
                "status": project.status,
                "created_at": project.created_at,
                "approved_at": project.approved_at,
                "your_messages": [{"kind": e.kind, "text": e.body, "at": e.created_at} for e in written],
            }
        )
    return out


def open_data_request(
    db: Session, account: CustomerAccount, kind: str, message: str | None
) -> tuple[DataRequest, bool]:
    existing = db.scalar(
        select(DataRequest).where(
            DataRequest.account_id == account.id, DataRequest.kind == kind, DataRequest.status == "open"
        )
    )
    if existing is not None:
        return existing, False
    received = utcnow()
    request = DataRequest(
        reference=new_reference("D"),
        account_id=account.id,
        kind=kind,
        message=(message or "").strip()[:1000] or None,
        received_at=received,
        base_due_at=add_months(received, get_settings().data_request_due_months),
    )
    try:
        with db.begin_nested():
            db.add(request)
            db.flush()
    except IntegrityError:  # a parallel request opened it first (partial unique index uq_data_requests_open)
        winner = db.scalar(
            select(DataRequest).where(
                DataRequest.account_id == account.id, DataRequest.kind == kind, DataRequest.status == "open"
            )
        )
        if winner is None:
            raise
        return winner, False
    return request, True


def _has_accounting_data(db: Session, account: CustomerAccount) -> bool:
    workspace_ids = db.scalars(
        select(CustomerWorkspace.id).where(CustomerWorkspace.owner_account_id == account.id)
    ).all()
    if not workspace_ids:
        return False
    checks = (
        select(func.count()).select_from(AccountingDocument).where(AccountingDocument.workspace_id.in_(workspace_ids)),
        select(func.count()).select_from(BillingCustomer).where(BillingCustomer.workspace_id.in_(workspace_ids)),
        select(func.count()).select_from(BillingCheckout).where(BillingCheckout.workspace_id.in_(workspace_ids)),
        select(func.count()).select_from(WithdrawalRequest).where(WithdrawalRequest.workspace_id.in_(workspace_ids)),
        # A commercial project is a contractual record: it stays (the account is anonymised), its customer-written
        # text is erased below.
        select(func.count()).select_from(CommercialProject).where(CommercialProject.workspace_id.in_(workspace_ids)),
    )
    return any((db.scalar(check) or 0) > 0 for check in checks)


# Subscription states that can still charge, or may change before the account is gone. Only these two are final:
# a canceled subscription cannot be revived, and an incomplete_expired one never became a subscription.
TERMINAL_SUBSCRIPTION_STATES = ("canceled", "incomplete_expired")
KNOWN_BLOCKING_STATES = ("active", "trialing", "past_due", "unpaid", "paused", "incomplete")


def deletion_blockers(
    db: Session, settings: Settings, account: CustomerAccount, *, now: datetime | None = None
) -> list[str]:
    """Reasons the account must NOT be deleted or anonymised yet. Empty = the local billing state allows it.

    Fail closed: any state that is not clearly final blocks, including a state this code does not know. The check is
    local (no Stripe call), so an unreachable Stripe cannot make it unsafe; staff additionally attest that they looked
    at Stripe for an account that has a Stripe customer (see `needs_stripe_attestation`). Erasing the account never
    cancels anything at Stripe: a blocked account is ended there by a person first (docs/STRIPE_BILLING.md).

    State matrix (docs/LEGAL_RETENTION.md):
      terminal (canceled, incomplete_expired)         allowed
      active, trialing, past_due, unpaid, paused,
        incomplete                                    blocks deletion and anonymisation
      cancel_at_period_end on a non-final state       blocks (service and billing continue until the period ends)
      any other value                                 blocks (state unknown)
      a checkout still open (young)                   blocks
      a completed subscription checkout without a
        subscription row (webhook not processed yet)  blocks
    """
    current = now or utcnow()
    workspace_ids = db.scalars(
        select(CustomerWorkspace.id).where(CustomerWorkspace.owner_account_id == account.id)
    ).all()
    if not workspace_ids:
        return []
    reasons: set[str] = set()
    subscriptions = db.scalars(
        select(BillingSubscription).where(BillingSubscription.workspace_id.in_(workspace_ids))
    ).all()
    for row in subscriptions:
        if row.status in TERMINAL_SUBSCRIPTION_STATES:
            continue
        reasons.add(
            f"subscription_{row.status}" if row.status in KNOWN_BLOCKING_STATES else "subscription_state_unknown"
        )
        if row.cancel_at_period_end:
            reasons.add("subscription_cancels_at_period_end")
    cutoff = current - timedelta(hours=settings.billing_open_checkout_block_hours)
    open_checkouts = db.scalar(
        select(func.count())
        .select_from(BillingCheckout)
        .where(
            BillingCheckout.workspace_id.in_(workspace_ids),
            BillingCheckout.status == "open",
            BillingCheckout.created_at >= cutoff,
        )
    )
    if open_checkouts:
        reasons.add("checkout_open")
    subscribed = {row.workspace_id for row in subscriptions}
    completed_subscription_checkouts = db.scalars(
        select(BillingCheckout.workspace_id)
        .join(BillingOffer, BillingOffer.key == BillingCheckout.offer_key)
        .where(
            BillingCheckout.workspace_id.in_(workspace_ids),
            BillingCheckout.status == "complete",
            BillingOffer.kind == "subscription",
        )
    ).all()
    if any(workspace_id not in subscribed for workspace_id in completed_subscription_checkouts):
        reasons.add("subscription_state_pending")
    return sorted(reasons)


def needs_stripe_attestation(db: Session, account: CustomerAccount) -> bool:
    """True when a Stripe customer exists for the account: staff must say they checked Stripe before an erasure."""
    workspace_ids = db.scalars(
        select(CustomerWorkspace.id).where(CustomerWorkspace.owner_account_id == account.id)
    ).all()
    if not workspace_ids:
        return False
    return bool(
        db.scalar(
            select(func.count()).select_from(BillingCustomer).where(BillingCustomer.workspace_id.in_(workspace_ids))
        )
    )


def erase_account(db: Session, account: CustomerAccount) -> str:
    """Delete or anonymize a person's account. Returns "deleted" or "anonymized".

    Accounting documents and payment records are kept for the legal period (docs/INVOICING.md): an account that has
    them is anonymized (no e-mail, name, password, sessions, profile, support text or projects), the rest stays. An
    account without them is deleted completely. The caller commits.
    """
    if _has_accounting_data(db, account):
        workspace_ids = db.scalars(
            select(CustomerWorkspace.id).where(CustomerWorkspace.owner_account_id == account.id)
        ).all()
        project_ids = db.scalars(
            select(WorkspaceProject.id).where(WorkspaceProject.workspace_id.in_(workspace_ids))
        ).all()
        if project_ids:
            db.execute(delete(AssessmentVersion).where(AssessmentVersion.project_id.in_(project_ids)))
            db.execute(delete(WorkspaceProject).where(WorkspaceProject.id.in_(project_ids)))
        db.execute(delete(SupportRequest).where(SupportRequest.workspace_id.in_(workspace_ids)))
        db.execute(delete(WorkspaceInvitation).where(WorkspaceInvitation.workspace_id.in_(workspace_ids)))
        db.execute(delete(WorkspaceMember).where(WorkspaceMember.workspace_id.in_(workspace_ids)))
        db.execute(delete(BillingProfile).where(BillingProfile.workspace_id.in_(workspace_ids)))
        db.execute(delete(CustomerSession).where(CustomerSession.account_id == account.id))
        db.execute(delete(CustomerToken).where(CustomerToken.account_id == account.id))
        db.execute(delete(OutboxMessage).where(OutboxMessage.account_id == account.id))
        db.execute(
            update(ProjectEvent)
            .where(ProjectEvent.author_account_id == account.id)
            .values(body="[erased]", author_account_id=None)
        )
        db.execute(
            update(DocumentComment)
            .where(DocumentComment.author_account_id == account.id)
            .values(body="[erased]", author_account_id=None)
        )
        db.execute(
            update(DocumentApproval)
            .where(DocumentApproval.decided_by_account_id == account.id, DocumentApproval.decision_note.is_not(None))
            .values(decision_note="[erased]")
        )
        db.execute(
            update(WithdrawalRequest).where(WithdrawalRequest.account_id == account.id).values(statement="[erased]")
        )
        account.email = f"erased-{account.id}@invalid.invalid"
        account.display_name = None
        account.password_hash = "!" + secrets.token_urlsafe(48)  # not a valid hash: nobody can sign in
        account.email_verified_at = None
        account.marketing_consent_at = None
        account.marketing_consent_version = None
        account.erased_at = utcnow()
        record_event(
            db,
            document="marketing_consent",
            action="withdrawn",
            account_id=account.id,
            source="erasure",
            locale=account.locale,
        )
        return "anonymized"
    db.delete(account)  # cascades: sessions, tokens, workspace, projects, members, support requests
    return "deleted"


# ------------------------------------------------------------------------------------------- order acceptance


@dataclass(frozen=True)
class Acceptance:
    """What the customer accepted on the order-review page. Versions are those the web displayed."""

    terms: str
    subscription_terms: str
    order_acceptance: str
    privacy: str
    customer_kind: str  # consumer | business
    early_start: bool = False
    early_start_version: str | None = None


def check_acceptance(acceptance: Acceptance) -> None:
    """Server-side check: every version must be the current one, so the record matches the text that was shown."""
    stale = {
        key: legal.version(key)  # type: ignore[arg-type]
        for key, claimed in (
            ("terms", acceptance.terms),
            ("subscription_terms", acceptance.subscription_terms),
            ("order_acceptance", acceptance.order_acceptance),
            ("privacy", acceptance.privacy),
        )
        if not legal.is_current(key, claimed)  # type: ignore[arg-type]
    }
    if (
        acceptance.early_start
        and acceptance.customer_kind == "consumer"
        and not legal.is_current("early_start", acceptance.early_start_version)
    ):
        stale["early_start"] = legal.version("early_start")
    if stale:
        raise ComplianceError(409, "terms_version_changed", "The terms have changed. Review the order again.")
    # A draft text can never back a live contract: in production, with payments on, every document must be approved.
    settings = get_settings()
    if settings.is_production and settings.billing_provider != "disabled":
        unapproved = [
            key
            for key in ("terms", "subscription_terms", "order_acceptance", "privacy")
            if not legal.is_approved(key)  # type: ignore[arg-type]
        ]
        if unapproved:
            raise ComplianceError(409, "legal_text_not_approved", "The terms are not published yet.")


def record_acceptance(db: Session, checkout_id: uuid.UUID, acceptance: Acceptance, locale: str) -> None:
    source = f"checkout_{acceptance.customer_kind}"
    for key, version in (
        ("terms", acceptance.terms),
        ("subscription_terms", acceptance.subscription_terms),
        ("order_acceptance", acceptance.order_acceptance),
    ):
        record_event_once(
            db, document=key, action="accepted", version=version, locale=locale, source=source, checkout_id=checkout_id
        )
    record_event_once(
        db,
        document="privacy",
        action="acknowledged",
        version=acceptance.privacy,
        locale=locale,
        source=source,
        checkout_id=checkout_id,
    )
    if acceptance.early_start and acceptance.customer_kind == "consumer":
        record_event_once(
            db,
            document="early_start",
            action="requested",
            version=acceptance.early_start_version,
            locale=locale,
            source=source,
            checkout_id=checkout_id,
        )


# ------------------------------------------------------------------------------------------- retention


def _years(years: int) -> timedelta:
    return timedelta(days=365 * years)


def purge_legal_records(db: Session, settings: Settings, *, now: datetime | None = None) -> dict[str, int]:
    """Deletes closed withdrawal and data requests after their approved retention. Does nothing unless the owner
    has switched `LEGAL_CLEANUP_ENABLED` on AND approved a period (docs/LEGAL_RETENTION.md): a period left unset
    means "keep", never "delete after a default". Open requests are never touched. A withdrawal that ended in a
    refund is accounting evidence: it also needs ACCOUNTING_RETENTION_YEARS and is kept for the longer of the two.
    The consent history of leads and accounts (legal_events) is not touched here: it goes with the lead or account.
    The caller commits."""
    result = {"withdrawals": 0, "data_requests": 0, "events": 0, "kept_for_accounting": 0}
    if not settings.legal_cleanup_enabled:
        return result
    current = now or utcnow()
    if settings.data_request_retention_years is not None:
        cutoff = current - _years(settings.data_request_retention_years)
        result["data_requests"] = db.execute(
            delete(DataRequest).where(DataRequest.status.in_(("done", "rejected")), DataRequest.handled_at < cutoff)
        ).rowcount
    if settings.withdrawal_retention_years is not None:
        cutoff = current - _years(settings.withdrawal_retention_years)
        rows = db.scalars(
            select(WithdrawalRequest).where(
                WithdrawalRequest.status.in_(("refunded", "closed")), WithdrawalRequest.decided_at < cutoff
            )
        ).all()
        for row in rows:
            if row.refund_reference:
                accounting = settings.accounting_retention_years
                if accounting is None or (row.decided_at and row.decided_at >= current - _years(accounting)):
                    result["kept_for_accounting"] += 1
                    continue
            result["events"] += db.execute(delete(LegalEvent).where(LegalEvent.withdrawal_id == row.id)).rowcount
            db.execute(delete(OutboxMessage).where(OutboxMessage.reference == row.reference))
            db.delete(row)
            result["withdrawals"] += 1
    return result


# ------------------------------------------------------------------------------------------- request deadlines


def add_months(moment: datetime, months: int) -> datetime:
    """The same day `months` calendar months later (the last day of a shorter month when it has no such day)."""
    import calendar

    year, month = divmod(moment.month - 1 + months, 12)
    year, month = moment.year + year, month + 1
    day = min(moment.day, calendar.monthrange(year, month)[1])
    return moment.replace(year=year, month=month, day=day)


def deadline_state(row: DataRequest, settings: Settings, now: datetime | None = None) -> dict[str, Any]:
    """Staff indicator: closed, on_track, due_soon or overdue, against the extended date when there is one. A working
    aid only; it decides nothing."""
    current = now or utcnow()
    due = row.extended_due_at or row.base_due_at
    if row.status != "open":
        state = "closed"
    elif due is None:
        state = "on_track"
    elif current > due:
        state = "overdue"
    elif due - current <= timedelta(days=settings.data_request_due_soon_days):
        state = "due_soon"
    else:
        state = "on_track"
    return {
        "state": state,
        "received_at": row.received_at,
        "base_due_at": row.base_due_at,
        "extended_due_at": row.extended_due_at,
        "effective_due_at": due,
        "extension_reason": row.extension_reason,
        "extension_notified_at": row.extension_notified_at,
        "completed_at": row.completed_at,
    }


def extend_data_request(row: DataRequest, *, months: int, reason: str, notified: bool) -> None:
    """Recorded only on a staff decision. Never automatic; one extension per request."""
    if row.status != "open":
        raise ComplianceError(409, "already_handled", "This request is already closed.")
    if row.extended_due_at is not None:
        raise ComplianceError(409, "already_extended", "This request was already extended.")
    if row.base_due_at is None:
        raise ComplianceError(409, "no_due_date", "This request has no due date.")
    row.extended_due_at = add_months(row.base_due_at, months)
    row.extension_reason = reason.strip()[:500]
    if notified:
        row.extension_notified_at = utcnow()


def mark_extension_notified(row: DataRequest) -> bool:
    """Staff record that they told the person about the extension and why. Idempotent."""
    if row.extended_due_at is None:
        raise ComplianceError(409, "not_extended", "This request was not extended.")
    if row.extension_notified_at is not None:
        return False
    row.extension_notified_at = utcnow()
    return True
