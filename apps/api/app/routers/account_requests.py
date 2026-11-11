"""A signed-in customer's own quote requests (docs/ACCOUNTS_HARDENING.md).

This is the only link between quote requests and customer accounts, and it is read-only and ownership-checked:

* The account must be signed in with a live session (`require_account`), with a **verified** e-mail address and not
  erased. Someone who registers with another person's address never gets past verification, so cannot see anything.
* A request belongs to the account when it was **sent from the account's own verified address** (compared after
  trimming and lower-casing; leads are stored lower-case). Nothing is matched by company name, domain, phone or name.
* Only the customer's own submission is shown: reference, date, kind, service and, when quotations are on, the state
  of the quotation. Never contact details, free text, staff notes, the pipeline status, a quotation link or the
  content of a quotation: the link is the credential and staff hand it out themselves.

The anonymous quote and contact routes are unchanged: a request needs no account, and sending one never creates,
changes or signs in an account. Off with customer accounts (`CUSTOMER_ACCOUNTS_ENABLED`).
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.accounts import limits
from app.config import get_settings
from app.deps import AppSettings, DbSession
from app.models import Lead
from app.quotations import service as quotation_service
from app.quotations.models import Quotation
from app.routers.accounts import Account, _enabled, _no_store
from app.services import leads

router = APIRouter(
    prefix="/api/accounts/quote-requests",
    tags=["accounts"],
    dependencies=[Depends(_enabled), Depends(_no_store)],
)

MAX_ROWS = 50
Kind = Literal["contact", "quote", "configurator", "basket", "tool"]


class QuoteRequestOut(BaseModel):
    reference: str
    created_at: str
    kind: Kind
    service: str
    # Only while quotations are switched on, and only a state: never the link or the content.
    quotation_status: Literal["published", "accepted", "declined", "withdrawn", "expired"] | None = None


def _kind(lead: Lead) -> Kind:
    if lead.source == leads.CONFIGURATOR_SOURCE:
        return "configurator"
    if lead.source == leads.QUOTE_BASKET_SOURCE:
        return "basket"
    if lead.source in (leads.READINESS_SOURCE, leads.TEAM_SOURCE, leads.SOLUTION_SOURCE, leads.ASSESSMENT_SOURCE):
        return "tool"
    return "quote" if lead.inquiry_type == "quote" else "contact"


def owned_by(account_email: str, verified: bool, erased: bool):
    """The condition 'sent from the account's own verified address', or None when the account has no claim."""
    if not verified or erased:
        return None
    return Lead.email == account_email.strip().lower()


@router.get(
    "", response_model=list[QuoteRequestOut], summary="Quote and contact requests sent from the account's address"
)
def my_quote_requests(ctx: Account, db: DbSession, settings: AppSettings) -> list[QuoteRequestOut]:
    limits.hit(
        "quote-requests:account",
        str(ctx.account.id),
        settings.legal_read_rate_limit,
        settings.legal_action_rate_window_seconds,
    )
    condition = owned_by(
        ctx.account.email, ctx.account.email_verified_at is not None, ctx.account.erased_at is not None
    )
    if condition is None:
        return []
    rows = db.scalars(select(Lead).where(condition).order_by(Lead.created_at.desc()).limit(MAX_ROWS)).all()
    show_quotations = get_settings().quotations_enabled
    out: list[QuoteRequestOut] = []
    for lead in rows:
        status = None
        if show_quotations:
            latest = db.scalars(
                select(Quotation).where(Quotation.lead_id == lead.id).order_by(Quotation.published_at.desc()).limit(1)
            ).one_or_none()
            status = quotation_service.effective_status(latest) if latest else None
        out.append(
            QuoteRequestOut(
                reference=lead.reference,
                created_at=lead.created_at.isoformat(),
                kind=_kind(lead),
                service=lead.service,
                quotation_status=status,  # type: ignore[arg-type]
            )
        )
    return out
