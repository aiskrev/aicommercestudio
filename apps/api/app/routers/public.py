"""Unauthenticated endpoints used by the public website. Nothing here returns stored lead data."""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status

from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.models import InquiryType
from app.notifications import notify_new_lead
from app.schemas import FormTokenOut, LeadCreate, LeadCreated, QuoteRequestCreate
from app.security import hash_ip
from app.services import leads
from app.spam import check_form_token, issue_form_token, looks_like_link_spam

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/public", tags=["public"])

SUCCESS_MESSAGES = {
    "bg": "Благодарим ви! Получихме запитването и ще се свържем с вас в рамките на работното време.",
    "en": "Thank you! We have received your inquiry and will get back to you during business hours.",
}


def contact_rate_limit(request: Request) -> None:
    """Runs before body validation, so invalid and spam submissions also count toward the limit."""
    settings = get_settings()
    enforce_rate_limit(
        f"contact:{client_ip(request)}", settings.contact_rate_limit, settings.contact_rate_window_seconds
    )
    enforce_rate_limit("contact:global", settings.contact_global_rate_limit, settings.contact_rate_window_seconds)


@router.get("/form-token", response_model=FormTokenOut)
def form_token(response: Response, settings: AppSettings) -> FormTokenOut:
    response.headers["Cache-Control"] = "no-store"
    return FormTokenOut(token=issue_form_token(settings.secret_key))


@router.post(
    "/leads",
    status_code=status.HTTP_201_CREATED,
    response_model=LeadCreated,
    dependencies=[Depends(contact_rate_limit)],
    summary="Submit a contact inquiry",
)
def submit_lead(
    payload: LeadCreate,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> LeadCreated:
    return _accept_submission(payload, request, background, db, settings)


@router.post(
    "/quote-requests",
    status_code=status.HTTP_201_CREATED,
    response_model=LeadCreated,
    dependencies=[Depends(contact_rate_limit)],
    summary="Submit a request for a written quote",
)
def submit_quote_request(
    payload: QuoteRequestCreate,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> LeadCreated:
    return _accept_submission(payload, request, background, db, settings)


def _accept_submission(
    payload: LeadCreate,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> LeadCreated:
    """Shared anti-spam pipeline for contact and quote submissions."""
    ip_hash = hash_ip(client_ip(request), settings.secret_key)
    inquiry_type = InquiryType.QUOTE if isinstance(payload, QuoteRequestCreate) else InquiryType.CONTACT

    if payload.website:
        # Honeypot filled: pretend success so bots get no signal, but store nothing.
        logger.warning("contact_spam_rejected", extra={"reason": "honeypot", "ip_hash": ip_hash})
        return LeadCreated(
            reference=secrets.token_hex(4).upper(),
            message=SUCCESS_MESSAGES[payload.locale.value],
            inquiry_type=inquiry_type,
        )

    token_problem = check_form_token(
        payload.form_token,
        settings.secret_key,
        settings.form_token_min_seconds,
        settings.form_token_max_age_seconds,
    )
    if token_problem:
        logger.info("contact_form_token_rejected", extra={"reason": token_problem, "ip_hash": ip_hash})
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "Формулярът е изпратен твърде бързо или е изтекъл. Моля, опитайте отново след няколко секунди.",
            "form_token_invalid",
        )
    if looks_like_link_spam(payload.message):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "Съобщението съдържа твърде много връзки. Моля, опишете проекта си с думи.",
            "spam_suspected",
        )

    lead = leads.create_lead(db, payload, privacy_notice_version=settings.privacy_notice_version, ip_hash=ip_hash)
    logger.info(
        "lead_created",
        extra={"lead": lead.reference, "service": lead.service, "inquiry_type": lead.inquiry_type},
    )
    background.add_task(
        notify_new_lead, settings, str(lead.id), lead.reference, lead.service, lead.inquiry_type, lead.locale
    )
    return LeadCreated(
        reference=lead.reference, message=SUCCESS_MESSAGES[payload.locale.value], inquiry_type=inquiry_type
    )
