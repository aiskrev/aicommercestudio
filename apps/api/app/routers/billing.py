"""Stripe billing routes, off unless BILLING_PROVIDER=stripe and the workspace is on.

The browser names an offer and nothing else. The webhook has no session or CSRF token: its signature
on the raw body is the proof, and it only stores the event before answering.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request, Response, status
from pydantic import Field

from app.billing import service
from app.billing.gateway import verify_event
from app.billing.service import BillingError
from app.config import get_settings
from app.deps import AppSettings, DbSession
from app.errors import ApiError
from app.routers.accounts import Account
from app.routers.workspace import WorkspaceCtx
from app.schemas import StrictModel

logger = logging.getLogger(__name__)


def _enabled() -> None:
    settings = get_settings()
    if not (settings.billing_provider == "stripe" and settings.advisor_workspace_enabled):
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/api/billing", tags=["billing"], dependencies=[Depends(_enabled), Depends(_no_store)])


class CheckoutIn(StrictModel):
    offer: str = Field(min_length=2, max_length=40)
    locale: Literal["bg", "en"] = "bg"


class PortalIn(StrictModel):
    locale: Literal["bg", "en"] = "bg"


def _error(exc: BillingError) -> ApiError:
    return ApiError(exc.status, exc.detail, exc.code)


@router.get("/offers")
def offers(ctx: WorkspaceCtx, db: DbSession) -> list[dict[str, Any]]:
    return service.public_offers(db)


@router.get("/status")
def billing_status(ctx: WorkspaceCtx, db: DbSession) -> dict[str, Any]:
    return service.status_for(db, ctx.workspace.id)


@router.post("/checkout")
def checkout(payload: CheckoutIn, ctx: WorkspaceCtx, db: DbSession, settings: AppSettings) -> dict[str, Any]:
    try:
        result = service.start_checkout(db, settings, ctx.workspace, payload.offer, payload.locale)
    except BillingError as exc:
        raise _error(exc) from exc
    return {"url": result.url, "reused": result.reused}


@router.post("/portal")
def portal(
    payload: PortalIn, account: Account, ctx: WorkspaceCtx, db: DbSession, settings: AppSettings
) -> dict[str, str]:
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
        service.record_event(db, event)
        tasks.add_task(service.process_pending)
    return {"received": True}
