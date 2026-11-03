"""Public AI Solution Builder endpoint: an optional enquiry with the design attached.

The builder itself runs in the browser and never calls the API. Only an explicit enquiry does: it
carries the enumerated share code, which the server decodes and checks against the same composition
rules (app/solution/model.py) before it creates a lead. Incompatible or unsafe designs are rejected
with the broken rules; nothing is stored for them. Logs carry enumerations and counts only.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status

from app.deps import AppSettings, DbSession, client_ip
from app.errors import ApiError
from app.notifications import notify_new_lead
from app.routers.public import contact_rate_limit
from app.security import hash_ip
from app.solution import model, service
from app.solution.schemas import SolutionEnquiryCreate, SolutionEnquiryOut
from app.spam import check_form_token, looks_like_link_spam

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/public/solution", tags=["solution"])

_SENT = {
    "bg": "Благодарим! Получихме запитването с дизайна и ще се свържем с вас в работно време.",
    "en": "Thank you! We received the enquiry with the design and will get back to you during business hours.",
}
_INVALID = {
    "bg": "Дизайнът не минава правилата за съвместимост и сигурност. Върнете се в конструктора и го коригирайте.",
    "en": "The design does not pass the compatibility and safety rules. Go back to the builder and fix it.",
}
_TOKEN_ERROR = {
    "bg": "Формулярът е изпратен твърде бързо или е изтекъл. Моля, презаредете страницата и опитайте отново.",
    "en": "The form was sent too quickly or has expired. Please reload the page and try again.",
}
_SPAM = {
    "bg": "Съобщението съдържа твърде много връзки. Моля, опишете проекта си с думи.",
    "en": "The message contains too many links. Please describe your project in words.",
}


@router.post(
    "/enquiries",
    status_code=status.HTTP_201_CREATED,
    response_model=SolutionEnquiryOut,
    dependencies=[Depends(contact_rate_limit)],
    summary="Optional enquiry with a solution design attached (creates a lead; marketing consent is separate)",
)
def solution_enquiry(
    payload: SolutionEnquiryCreate,
    request: Request,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> SolutionEnquiryOut:
    locale = payload.locale.value
    ip_hash = hash_ip(client_ip(request), settings.secret_key)
    if payload.website:
        # Honeypot filled: pretend success, store nothing.
        logger.warning("solution_spam_rejected", extra={"reason": "honeypot", "ip_hash": ip_hash})
        return SolutionEnquiryOut(reference=secrets.token_hex(4).upper(), message=_SENT[locale])
    problem = check_form_token(
        payload.form_token, settings.secret_key, settings.form_token_min_seconds, settings.form_token_max_age_seconds
    )
    if problem:
        logger.info("solution_form_token_rejected", extra={"reason": problem})
        raise ApiError(status.HTTP_400_BAD_REQUEST, _TOKEN_ERROR[locale], "form_token_invalid")
    if looks_like_link_spam(payload.message):
        raise ApiError(status.HTTP_400_BAD_REQUEST, _SPAM[locale], "spam_suspected")
    config, issues = model.decode(payload.code)
    if config is None:
        logger.info("solution_design_rejected", extra={"rules": issues})
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            _INVALID[locale],
            "solution_invalid",
            errors=[{"field": "code", "type": rule} for rule in issues],
        )
    lead = service.create_enquiry(db, payload, config, settings, ip_hash=ip_hash)
    logger.info(
        "solution_enquiry_created",
        extra={"lead": lead.reference, "workflow": config.workflow, "locale": locale},
    )
    background.add_task(
        notify_new_lead, settings, str(lead.id), lead.reference, lead.service, lead.inquiry_type, lead.locale
    )
    return SolutionEnquiryOut(reference=lead.reference, message=_SENT[locale])
