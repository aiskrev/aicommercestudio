"""Stripe billing routes, off unless BILLING_PROVIDER=stripe and the workspace is on.

The browser names an offer and nothing else. The webhook has no session or CSRF token: its signature
on the raw body is the proof, and it only stores the event before answering.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from pydantic import Field

from app.accounts import limits
from app.accounts.mail import dispatch_pending
from app.billing import service
from app.billing.gateway import verify_event
from app.billing.service import BillingError
from app.compliance import service as compliance
from app.compliance.service import Acceptance, ComplianceError, check_acceptance
from app.config import get_settings
from app.deps import AppSettings, DbSession
from app.errors import ApiError
from app.routers.accounts import Account
from app.routers.workspace import Context, WithdrawalWorkspaceCtx, WorkspaceCtx
from app.schemas import StrictModel

logger = logging.getLogger(__name__)


def _enabled() -> None:
    settings = get_settings()
    if not (settings.billing_provider == "stripe" and settings.advisor_workspace_enabled):
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


def billing_role(ctx: WorkspaceCtx) -> Context:
    if ctx.role not in ("owner", "billing"):
        raise ApiError(status.HTTP_403_FORBIDDEN, "Your role doesn't allow this.", "role_not_allowed")
    return ctx


Billing = Annotated[Context, Depends(billing_role)]


def withdrawal_role(ctx: WithdrawalWorkspaceCtx) -> Context:
    """Like `billing_role`, but outside the shared per-workspace request limit: the withdrawal function must stay
    reachable when ordinary page loads have used that limit up. Its routes apply dedicated limits instead."""
    if ctx.role not in ("owner", "billing"):
        raise ApiError(status.HTTP_403_FORBIDDEN, "Your role doesn't allow this.", "role_not_allowed")
    return ctx


WithdrawalCtx = Annotated[Context, Depends(withdrawal_role)]

router = APIRouter(prefix="/api/billing", tags=["billing"], dependencies=[Depends(_enabled), Depends(_no_store)])


class AcceptanceIn(StrictModel):
    """What the customer accepted on the order-review page. The server compares every version with the current one."""

    terms: str = Field(min_length=4, max_length=32)
    subscription_terms: str = Field(min_length=4, max_length=32)
    order_acceptance: str = Field(min_length=4, max_length=32)
    privacy: str = Field(min_length=4, max_length=32)
    customer_kind: Literal["consumer", "business"]
    early_start: bool = False
    early_start_version: str | None = Field(default=None, max_length=32)


class CheckoutIn(StrictModel):
    offer: str = Field(min_length=2, max_length=40)
    locale: Literal["bg", "en"] = "bg"
    acceptance: AcceptanceIn


class WithdrawalRef(StrictModel):
    ref: str = Field(min_length=4, max_length=100)


class WithdrawalIn(StrictModel):
    ref: str = Field(min_length=4, max_length=100)
    statement: str = Field(min_length=10, max_length=2000)
    locale: Literal["bg", "en"] = "bg"
    # The second step: the customer has seen the summary and confirms. A request without it is refused.
    confirmed: bool = False


class PortalIn(StrictModel):
    locale: Literal["bg", "en"] = "bg"


def _error(exc: BillingError) -> ApiError:
    return ApiError(exc.status, exc.detail, exc.code)


@router.get("/offers")
def offers(ctx: WorkspaceCtx, db: DbSession) -> list[dict[str, Any]]:
    return service.public_offers(db)


@router.get("/status")
def billing_status(ctx: Billing, db: DbSession) -> dict[str, Any]:
    return service.status_for(db, ctx.workspace.id)


@router.post("/checkout")
def checkout(payload: CheckoutIn, ctx: Billing, db: DbSession, settings: AppSettings) -> dict[str, Any]:
    accepted = Acceptance(**payload.acceptance.model_dump())
    try:
        check_acceptance(accepted)  # server-side: a checkbox in the browser proves nothing
        result = service.start_checkout(db, settings, ctx.workspace, payload.offer, payload.locale, accepted)
    except ComplianceError as exc:
        raise ApiError(exc.status, exc.detail, exc.code) from exc
    except BillingError as exc:
        raise _error(exc) from exc
    return {"url": result.url, "reused": result.reused}


@router.post("/portal")
def portal(payload: PortalIn, account: Account, ctx: Billing, db: DbSession, settings: AppSettings) -> dict[str, str]:
    try:
        return {"url": service.open_portal(db, settings, ctx.workspace, account.account.id, payload.locale)}
    except BillingError as exc:
        raise _error(exc) from exc


@router.post("/stripe/webhook")
async def webhook(
    request: Request,
    tasks: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
    stripe_signature: Annotated[str | None, Header()] = None,
) -> dict[str, bool]:
    payload = await request.body()
    try:
        event = verify_event(payload, stripe_signature, settings.stripe_webhook_secret or "")
    except ValueError as exc:
        logger.warning("billing_webhook_rejected")
        raise ApiError(status.HTTP_400_BAD_REQUEST, "Invalid signature.", "invalid_signature") from exc
    if event.get("livemode") and not settings.stripe_live_allowed:
        logger.error("billing_live_event_refused")
        raise ApiError(status.HTTP_400_BAD_REQUEST, "Live events aren't accepted.", "live_mode_refused")
    if event["type"] in service.HANDLED:
        await run_in_threadpool(service.record_event, db, event)  # keep the event loop free
        tasks.add_task(service.process_pending)
    return {"received": True}


# ------------------------------------------------------------------------------------------- withdrawal


@router.get("/contracts")
def contracts(ctx: WithdrawalCtx, db: DbSession, settings: AppSettings) -> list[dict[str, Any]]:
    """The workspace's purchases a withdrawal can name, with the system's first reading of the period."""
    limits.hit(
        "contracts:workspace",
        str(ctx.workspace.id),
        settings.legal_read_rate_limit,
        settings.legal_read_rate_window_seconds,
    )
    from sqlalchemy import select

    from app.billing.models import BillingPurchase, BillingSubscription

    refs = [
        row.stripe_subscription_id
        for row in db.scalars(select(BillingSubscription).where(BillingSubscription.workspace_id == ctx.workspace.id))
    ] + [
        row.stripe_session_id
        for row in db.scalars(select(BillingPurchase).where(BillingPurchase.workspace_id == ctx.workspace.id))
    ]
    return [{"ref": ref, **compliance.preview_withdrawal(db, ctx.workspace.id, ref)} for ref in refs]


@router.post("/withdrawals/preview")
def withdrawal_preview(
    payload: WithdrawalRef, ctx: WithdrawalCtx, db: DbSession, settings: AppSettings
) -> dict[str, Any]:
    limits.hit(
        "withdrawal-preview:workspace",
        str(ctx.workspace.id),
        settings.legal_read_rate_limit,
        settings.legal_read_rate_window_seconds,
    )
    try:
        return compliance.preview_withdrawal(db, ctx.workspace.id, payload.ref)
    except ComplianceError as exc:
        raise ApiError(exc.status, exc.detail, exc.code) from exc


@router.post("/withdrawals", status_code=status.HTTP_201_CREATED)
def withdrawal_create(
    payload: WithdrawalIn,
    ctx: WithdrawalCtx,
    account: Account,
    db: DbSession,
    response: Response,
    settings: AppSettings,
    tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Records a withdrawal statement. Two steps: the summary (`/withdrawals/preview`), then this call with
    `confirmed: true`. Nothing is refunded here; staff review every request. A repeat returns the open request."""
    if not payload.confirmed:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_ENTITY, "Confirm the withdrawal.", "confirmation_required")
    # A repeat for a contract that already has an open request returns that request and consumes no limit, so a
    # customer who clicks again (or comes back later) always gets their reference.
    existing = compliance.open_withdrawal(db, ctx.workspace.id, payload.ref)
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        return {**compliance.present_withdrawal(existing), "created": False}
    # Dedicated limits for this request type, per workspace and per account, never per IP alone.
    window = settings.legal_action_rate_window_seconds
    limits.hit("withdrawal:workspace", str(ctx.workspace.id), settings.legal_action_rate_limit, window)
    limits.hit("withdrawal:account", str(account.account.id), settings.legal_action_rate_limit, window)
    try:
        row, created = compliance.create_withdrawal(
            db,
            workspace=ctx.workspace,
            account=account.account,
            ref=payload.ref,
            statement=payload.statement,
            locale=payload.locale,
        )
        if created:
            from app import audit

            audit.record(
                db,
                "billing.withdrawal_received",
                actor_label=f"account:{account.account.id}",
                entity_type="withdrawal_request",
                entity_id=str(row.id),
                details={"reference": row.reference, "eligibility": row.eligibility},
            )
        db.commit()
    except ComplianceError as exc:
        raise ApiError(exc.status, exc.detail, exc.code) from exc
    if not created:
        response.status_code = status.HTTP_200_OK
    else:
        # The acknowledgement on a durable medium goes out at once, not at the next scheduled run: the law asks for it
        # without undue delay (docs/LEGAL_SOURCES.md). A failure stays in the outbox and is retried.
        tasks.add_task(dispatch_pending)
    return {**compliance.present_withdrawal(row), "created": created}


@router.get("/withdrawals")
def withdrawal_list(ctx: WithdrawalCtx, db: DbSession, settings: AppSettings) -> list[dict[str, Any]]:
    limits.hit(
        "withdrawals:workspace",
        str(ctx.workspace.id),
        settings.legal_read_rate_limit,
        settings.legal_read_rate_window_seconds,
    )
    from sqlalchemy import select

    from app.compliance.models import WithdrawalRequest

    rows = db.scalars(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.workspace_id == ctx.workspace.id)
        .order_by(WithdrawalRequest.created_at.desc())
    ).all()
    return [compliance.present_withdrawal(row) for row in rows]
