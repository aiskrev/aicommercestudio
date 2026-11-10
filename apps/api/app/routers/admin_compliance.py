"""Staff side of the legal workflows: withdrawal requests, data-subject requests, consent withdrawal, versions.

Every write is rate-limited per staff member (a repeated click or a script cannot repeat an outcome), audited, and
idempotent where it can be. Nothing here refunds money or deletes anything on its own: a refund is recorded after a
person made it in Stripe, and a deletion is refused while the billing state is not clearly final.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query, Response, status
from pydantic import Field
from sqlalchemy import select

from app import audit, legal
from app.accounts import limits
from app.accounts.models import CustomerAccount
from app.compliance import service
from app.compliance.models import DataRequest, LegalEvent, WithdrawalRequest
from app.config import get_settings
from app.deps import Admin, AppSettings, DbSession
from app.errors import ApiError
from app.models import AuditLog, Lead, utcnow
from app.schemas import StrictModel

router = APIRouter(prefix="/api/admin/compliance", tags=["admin-compliance"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def _error(exc: service.ComplianceError) -> ApiError:
    return ApiError(exc.status, exc.detail, exc.code)


def _staff_limit(ctx: Admin, settings: AppSettings, scope: str) -> None:
    limits.hit(
        f"staff-{scope}:admin",
        str(ctx.user.id),
        settings.staff_action_rate_limit,
        settings.staff_action_rate_window_seconds,
    )


class DecideIn(StrictModel):
    status: Literal["refund_review", "refunded", "closed"]
    note: Annotated[str | None, Field(max_length=500)] = None
    # After refunding in Stripe by hand; required for "refunded". The system never refunds on its own.
    refund_reference: Annotated[str | None, Field(max_length=100)] = None
    refund_amount_minor: Annotated[int | None, Field(ge=1)] = None


class HandleIn(StrictModel):
    action: Literal["done", "reject", "execute_deletion"]
    note: Annotated[str | None, Field(max_length=500)] = None
    # For execute_deletion on an account that has a Stripe customer: the person says they looked at Stripe.
    stripe_checked: bool = False


@router.get("/versions")
def versions(ctx: Admin, response: Response) -> dict[str, Any]:
    """The version ids in force, their revision status (draft | approved | published) and lawyer-review status."""
    _no_store(response)
    return {
        "documents": {
            key: {
                "version": entry["version"],
                "review": entry["review"],
                "status": legal.status(key),  # type: ignore[arg-type]
                "kind": entry["kind"],
            }
            for key, entry in legal.registry().items()
        }
    }


def _withdrawal_row(row: WithdrawalRequest) -> dict[str, Any]:
    return {"id": str(row.id), **service.present_withdrawal(row)}


@router.get("/withdrawals")
def list_withdrawals(
    ctx: Admin,
    db: DbSession,
    response: Response,
    open_only: Annotated[bool, Query()] = False,
    status_filter: Annotated[
        Literal["received", "refund_review", "refunded", "closed"] | None, Query(alias="status")
    ] = None,
) -> list[dict[str, Any]]:
    """The list holds no statement and no e-mail: open a request for the details."""
    _no_store(response)
    query = select(WithdrawalRequest).order_by(WithdrawalRequest.created_at.desc()).limit(200)
    if open_only:
        query = query.where(WithdrawalRequest.status.in_(("received", "refund_review")))
    if status_filter:
        query = query.where(WithdrawalRequest.status == status_filter)
    return [_withdrawal_row(row) for row in db.scalars(query)]


def _trail(db: DbSession, entity_type: str, entity_id: str) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(AuditLog)
        .where(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
        .order_by(AuditLog.created_at)
    ).all()
    return [{"at": r.created_at, "action": r.action, "by": r.actor_label, "details": r.details} for r in rows]


@router.get("/withdrawals/{request_id}")
def get_withdrawal(request_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> dict[str, Any]:
    _no_store(response)
    row = db.get(WithdrawalRequest, request_id)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    account = db.get(CustomerAccount, row.account_id) if row.account_id else None
    return {
        **_withdrawal_row(row),
        "statement": row.statement,
        "locale": row.locale,
        "workspace_id": str(row.workspace_id),
        "subject_kind": row.subject_kind,
        "subject_ref": row.subject_ref,
        "account_email": account.email if account else None,
        "audit": _trail(db, "withdrawal_request", str(row.id)),
    }


@router.post("/withdrawals/{request_id}/decide")
def decide_withdrawal(
    request_id: uuid.UUID, payload: DecideIn, ctx: Admin, db: DbSession, settings: AppSettings
) -> dict[str, Any]:
    _staff_limit(ctx, settings, "withdrawal-decide")
    row = db.get(WithdrawalRequest, request_id, with_for_update=True)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    try:
        service.decide_withdrawal(
            db,
            row,
            status=payload.status,
            note=payload.note,
            refund_reference=payload.refund_reference,
            refund_amount_minor=payload.refund_amount_minor,
            actor=ctx.user.email,
        )
    except service.ComplianceError as exc:
        raise _error(exc) from exc
    audit.record(
        db,
        "billing.withdrawal_decided",
        actor=ctx.user,
        entity_type="withdrawal_request",
        entity_id=str(row.id),
        details={"reference": row.reference, "status": row.status, "refund_reference": row.refund_reference},
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    return _withdrawal_row(row)


def _data_request_row(row: DataRequest) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "reference": row.reference,
        "kind": row.kind,
        "status": row.status,
        "created_at": row.created_at,
        "handled_at": row.handled_at,
        "outcome_note": row.outcome_note,
        "deadline": service.deadline_state(row, get_settings()),
    }


@router.get("/data-requests")
def list_data_requests(
    ctx: Admin,
    db: DbSession,
    response: Response,
    kind: Annotated[Literal["deletion", "correction", "restriction", "objection"] | None, Query()] = None,
    status_filter: Annotated[Literal["open", "done", "rejected"] | None, Query(alias="status")] = None,
) -> list[dict[str, Any]]:
    """The list holds no message and no e-mail: open a request for the details."""
    _no_store(response)
    query = select(DataRequest).order_by(DataRequest.created_at.desc()).limit(200)
    if kind:
        query = query.where(DataRequest.kind == kind)
    if status_filter:
        query = query.where(DataRequest.status == status_filter)
    return [_data_request_row(row) for row in db.scalars(query)]


@router.get("/data-requests/{request_id}")
def get_data_request(request_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> dict[str, Any]:
    _no_store(response)
    row = db.get(DataRequest, request_id)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    account = db.get(CustomerAccount, row.account_id) if row.account_id else None
    blockers: list[str] = []
    attestation = False
    if account is not None and row.kind == "deletion":
        blockers = service.deletion_blockers(db, get_settings(), account)
        attestation = service.needs_stripe_attestation(db, account)
    return {
        **_data_request_row(row),
        "message": row.message,
        "handled_by": row.handled_by,
        "account_email": account.email if account else None,
        # What stands in the way of executing a deletion right now (empty = the local state allows it).
        "deletion_blockers": blockers,
        "stripe_attestation_required": attestation,
        "audit": _trail(db, "data_request", str(row.id)),
    }


@router.post("/data-requests/{request_id}/handle")
def handle_data_request(
    request_id: uuid.UUID, payload: HandleIn, ctx: Admin, db: DbSession, settings: AppSettings
) -> dict[str, Any]:
    _staff_limit(ctx, settings, "data-request-handle")
    row = db.get(DataRequest, request_id, with_for_update=True)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    if row.status != "open":
        raise ApiError(status.HTTP_409_CONFLICT, "This request is already closed.", "already_handled")
    outcome = payload.note
    if payload.action == "execute_deletion":
        if row.kind != "deletion":
            raise ApiError(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Only a deletion request can be executed.", "wrong_kind"
            )
        # The account row is locked for the whole decision, so two staff members cannot execute it twice and a
        # sign-in or a new checkout cannot slip in between the check and the erasure.
        account = db.get(CustomerAccount, row.account_id, with_for_update=True) if row.account_id else None
        if account is None:
            raise ApiError(status.HTTP_409_CONFLICT, "The account no longer exists.", "account_missing")
        if account.erased_at is not None:
            raise ApiError(status.HTTP_409_CONFLICT, "The account was already erased.", "already_erased")
        blockers = service.deletion_blockers(db, settings, account)
        if blockers:
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "The billing state does not allow erasing this account yet: " + ", ".join(blockers) + ".",
                "subscription_active" if any(b.startswith("subscription_") for b in blockers) else "billing_state_open",
            )
        if service.needs_stripe_attestation(db, account) and not payload.stripe_checked:
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "Check the customer in Stripe and confirm it (stripe_checked) before erasing.",
                "stripe_check_required",
            )
        result = service.erase_account(db, account)  # "deleted" or "anonymized"
        outcome = f"{result}; accounting records kept where the law requires" if result == "anonymized" else result
    row.status = "rejected" if payload.action == "reject" else "done"
    row.handled_at = utcnow()
    row.completed_at = row.handled_at
    row.handled_by = ctx.user.email[:120]
    row.outcome_note = (outcome or "")[:500] or None
    audit.record(
        db,
        "account.data_request_handled",
        actor=ctx.user,
        entity_type="data_request",
        entity_id=str(row.id),
        details={
            "reference": row.reference,
            "kind": row.kind,
            "action": payload.action,
            "outcome": row.outcome_note,
            "stripe_checked": payload.stripe_checked,
        },
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    return {"id": str(row.id), "reference": row.reference, "status": row.status, "outcome_note": row.outcome_note}


@router.post("/leads/{lead_id}/marketing-consent/withdraw", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_lead_marketing(lead_id: uuid.UUID, ctx: Admin, db: DbSession, settings: AppSettings) -> None:
    """Withdraws the marketing consent of an inquiry on the person's request. History is kept in `legal_events`."""
    _staff_limit(ctx, settings, "lead-withdraw")
    lead = db.get(Lead, lead_id, with_for_update=True)
    if lead is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    if service.withdraw_lead_marketing(db, lead):
        audit.record(
            db,
            "lead.marketing_consent_withdrawn",
            actor=ctx.user,
            entity_type="lead",
            entity_id=str(lead.id),
            ip_hash=ctx.ip_hash,
        )
    db.commit()


@router.post("/leads/{lead_id}/marketing-withdrawal-link")
def marketing_withdrawal_link(
    lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response, settings: AppSettings, locale: str = "bg"
) -> dict[str, str]:
    """For a campaign: the self-service withdrawal link of this lead. Stable (the same link every time), carries no
    lead id or personal data, and is not stored in clear. Only for a lead that has given marketing consent."""
    _no_store(response)
    _staff_limit(ctx, settings, "lead-link")
    lead = db.get(Lead, lead_id, with_for_update=True)
    if lead is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    if not lead.marketing_consent:
        raise ApiError(status.HTTP_409_CONFLICT, "This inquiry has no marketing consent.", "no_marketing_consent")
    token = service.mint_marketing_token(db, lead)
    db.commit()
    path = "/en/marketing-opt-out" if locale == "en" else "/bg/otkaz-ot-marketing"
    return {"url": f"{settings.site_url.rstrip('/')}{path}#token={token}"}


@router.get("/leads/{lead_id}/consent-history")
def lead_consent_history(lead_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response) -> list[dict[str, Any]]:
    _no_store(response)
    rows = service.in_reading_order(db.scalars(select(LegalEvent).where(LegalEvent.lead_id == lead_id)).all())
    return [
        {"at": r.created_at, "document": r.document, "version": r.version, "action": r.action, "source": r.source}
        for r in rows
    ]


class ExtendIn(StrictModel):
    months: Literal[1, 2]
    reason: Annotated[str, Field(min_length=10, max_length=500)]
    # True when the person has already been told about the extension and why.
    notified: bool = False


@router.post("/data-requests/{request_id}/extend")
def extend_data_request(
    request_id: uuid.UUID, payload: ExtendIn, ctx: Admin, db: DbSession, settings: AppSettings
) -> dict[str, Any]:
    """Record a staff decision to extend the working due date. Never automatic; the legal basis for an extension is
    for the lawyer to confirm (docs/LEGAL_RETENTION.md)."""
    _staff_limit(ctx, settings, "data-request-extend")
    row = db.get(DataRequest, request_id, with_for_update=True)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    try:
        service.extend_data_request(row, months=payload.months, reason=payload.reason, notified=payload.notified)
    except service.ComplianceError as exc:
        raise _error(exc) from exc
    audit.record(
        db,
        "data_request.extended",
        actor=ctx.user,
        entity_type="data_request",
        entity_id=str(row.id),
        details={"reference": row.reference, "months": payload.months, "notified": payload.notified},
        ip_hash=ctx.ip_hash,
    )
    db.commit()
    return _data_request_row(row)


@router.post("/data-requests/{request_id}/extension-notified")
def data_request_extension_notified(
    request_id: uuid.UUID, ctx: Admin, db: DbSession, settings: AppSettings
) -> dict[str, Any]:
    """Record that the person was told about the extension and why (idempotent)."""
    _staff_limit(ctx, settings, "data-request-notified")
    row = db.get(DataRequest, request_id, with_for_update=True)
    if row is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")
    try:
        changed = service.mark_extension_notified(row)
    except service.ComplianceError as exc:
        raise _error(exc) from exc
    if changed:
        audit.record(
            db,
            "data_request.extension_notified",
            actor=ctx.user,
            entity_type="data_request",
            entity_id=str(row.id),
            details={"reference": row.reference},
            ip_hash=ctx.ip_hash,
        )
    db.commit()
    return _data_request_row(row)
