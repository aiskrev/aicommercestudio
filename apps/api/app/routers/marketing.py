"""Self-service withdrawal of marketing consent for people who only sent an inquiry (no account).

The link in a marketing message carries an opaque token in the URL fragment (never the lead id, never personal data;
a fragment is not sent to servers in the request line or in Referer). The page asks for one click and posts the
token here, so a mail scanner that merely opens the link cannot withdraw anyone's consent by accident. The answer is
the same for every outcome that is not an invalid link, so the endpoint reveals nothing about a lead.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Request, Response, status
from pydantic import Field

from app import audit
from app.accounts import limits
from app.compliance import service
from app.deps import AppSettings, DbSession, client_ip_hash
from app.errors import ApiError
from app.schemas import StrictModel

router = APIRouter(prefix="/api/public/marketing", tags=["public"])


class WithdrawIn(StrictModel):
    token: Annotated[str, Field(min_length=64, max_length=64)]
    locale: Literal["bg", "en"] = "bg"


@router.post("/withdraw")
def withdraw(
    payload: WithdrawIn, request: Request, response: Response, db: DbSession, settings: AppSettings
) -> dict[str, str]:
    response.headers["Cache-Control"] = "no-store"
    # By client and, separately, one shared bucket for the whole endpoint, so guessing cannot be scaled up by spoofing.
    limits.hit(
        "marketing-withdraw:ip",
        client_ip_hash(request),
        settings.marketing_withdraw_rate_limit,
        settings.marketing_withdraw_rate_window_seconds,
    )
    limits.hit(
        "marketing-withdraw:all",
        None,
        settings.marketing_withdraw_rate_limit * 20,
        settings.marketing_withdraw_rate_window_seconds,
    )
    lead = service.lead_for_marketing_token(db, payload.token, lock=True)
    if lead is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "This link is invalid or has expired.", "token_invalid")
    changed = service.withdraw_lead_marketing(db, lead, locale=payload.locale, source="self_service")
    if changed:
        audit.record(
            db,
            "lead.marketing_consent_withdrawn_by_person",
            actor_label="lead",
            entity_type="lead",
            entity_id=str(lead.id),
        )
    db.commit()
    return {"status": "withdrawn" if changed else "already_withdrawn"}
