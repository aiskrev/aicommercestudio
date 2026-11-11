"""Customer-facing quotations: what the holder of a quotation link can do, and how staff publish one.

Off by default (`QUOTATIONS_ENABLED`): while off, every route here answers 404, including the staff routes, so a
link can never be handed out that leads nowhere.

Staff (`require_admin`) publish the approved version of a proposal and get the secret link once. They send it to
the client themselves: this module sends no e-mail. The holder of the link can read the approved version and
answer once. The secret travels in a request body (the page keeps it in the URL fragment, which browsers do not
send to servers), so it does not reach access logs. An unknown link is a plain 404.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, Request, Response, status

from app.config import get_settings
from app.deps import Admin, DbSession, client_ip, client_ip_hash, enforce_rate_limit
from app.errors import ApiError
from app.opportunities.service import WorkflowError
from app.quotations import service
from app.quotations.schemas import (
    QuotationDecision,
    QuotationPublicOut,
    QuotationPublish,
    QuotationPublished,
    QuotationStaffOut,
    QuotationView,
    QuotationWithdraw,
)
from app.routers.admin_opportunities import _lead, _proposal
from app.security import hash_ip

logger = logging.getLogger(__name__)


def require_enabled() -> None:
    if not get_settings().quotations_enabled:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def _limit(kind: str, setting: str):
    def dependency(request: Request) -> None:
        settings = get_settings()
        window = settings.quotation_rate_window_seconds
        enforce_rate_limit(f"quotation-{kind}:{client_ip(request)}", getattr(settings, setting), window)
        enforce_rate_limit("quotation:global", settings.quotation_global_rate_limit, window)

    return dependency


public = APIRouter(prefix="/api/public/quotations", tags=["quotations"], dependencies=[Depends(require_enabled)])
staff = APIRouter(
    prefix="/api/admin/leads/{lead_id}/proposals/{proposal_id}/quotation",
    tags=["admin-opportunities"],
    dependencies=[Depends(require_enabled)],
)

_NOT_FOUND = {
    "bg": "Офертата не е намерена. Проверете връзката или се свържете с нас.",
    "en": "The quotation was not found. Check the link or contact us.",
}
CONFLICT = {409: {"description": "`expected_revision` is stale, or the quotation or proposal is in another state"}}


def _raise(exc: WorkflowError) -> ApiError:
    return ApiError(exc.status, exc.message, exc.code)


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


# --------------------------------------------------------------------------- staff


@staff.get("", response_model=QuotationStaffOut | None, summary="The latest quotation of a proposal, or null")
def get_quotation(
    lead_id: uuid.UUID, proposal_id: uuid.UUID, ctx: Admin, db: DbSession, response: Response
) -> QuotationStaffOut | None:
    _no_store(response)
    lead = _lead(db, lead_id)
    quotation = service.latest(db, _proposal(db, lead, proposal_id))
    return service.staff_out(quotation) if quotation else None


@staff.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=QuotationPublished,
    responses=CONFLICT,
    summary="Publish the approved version for the client; returns the secret link token once",
)
def publish_quotation(
    lead_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: QuotationPublish,
    request: Request,
    ctx: Admin,
    db: DbSession,
    response: Response,
) -> QuotationPublished:
    _no_store(response)
    lead = _lead(db, lead_id, for_update=True)
    proposal = _proposal(db, lead, proposal_id, for_update=True)
    try:
        quotation, token = service.publish(db, lead, proposal, payload, ctx.user, client_ip_hash(request))
    except WorkflowError as exc:
        raise _raise(exc) from exc
    logger.info("quotation_published", extra={"lead": lead.reference, "version": quotation.version_number})
    return QuotationPublished(token=token, quotation=service.staff_out(quotation))


@staff.post("/withdraw", response_model=QuotationStaffOut, responses=CONFLICT, summary="Withdraw the live quotation")
def withdraw_quotation(
    lead_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: QuotationWithdraw,
    request: Request,
    ctx: Admin,
    db: DbSession,
) -> QuotationStaffOut:
    lead = _lead(db, lead_id, for_update=True)
    proposal = _proposal(db, lead, proposal_id)
    quotation = service.latest(db, proposal, for_update=True)
    if quotation is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Quotation not found.", "quotation_not_found")
    try:
        return service.staff_out(service.withdraw(db, lead, quotation, payload, ctx.user, client_ip_hash(request)))
    except WorkflowError as exc:
        raise _raise(exc) from exc


# --------------------------------------------------------------------------- the link holder


@public.post(
    "/view",
    response_model=QuotationPublicOut,
    dependencies=[Depends(_limit("view", "quotation_view_rate_limit"))],
    summary="The approved quotation behind a link (the secret is in the body, never in a URL)",
)
def view_quotation(payload: QuotationView, response: Response, db: DbSession) -> QuotationPublicOut:
    _no_store(response)
    quotation = service.by_token(db, payload.token)
    out = service.public_out(db, quotation) if quotation else None
    if quotation is None or out is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, _NOT_FOUND["bg"], "quotation_not_found")
    service.mark_viewed(db, quotation)
    return out


@public.post(
    "/decision",
    response_model=QuotationPublicOut,
    dependencies=[Depends(_limit("decision", "quotation_decision_rate_limit"))],
    responses={409: {"description": "The quotation was already answered differently, withdrawn or has expired"}},
    summary="The client's answer, recorded once (the same answer again changes nothing)",
)
def decide_quotation(
    payload: QuotationDecision, request: Request, response: Response, db: DbSession
) -> QuotationPublicOut:
    _no_store(response)
    settings = get_settings()
    # The row lock makes a second, simultaneous answer wait and then find the first one recorded.
    quotation = service.by_token(db, payload.token, for_update=True)
    if quotation is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, _NOT_FOUND["bg"], "quotation_not_found")
    try:
        quotation, recorded = service.decide(db, quotation, payload, hash_ip(client_ip(request), settings.secret_key))
    except WorkflowError as exc:
        db.rollback()
        raise _raise(exc) from exc
    if recorded:
        logger.info("quotation_decided", extra={"status": quotation.status})
    out = service.public_out(db, quotation)
    if out is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, _NOT_FOUND["bg"], "quotation_not_found")
    return out
