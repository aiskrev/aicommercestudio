"""Public project configurator: metadata, the deterministic review and an optional quote request.

Off by default (`PROJECT_CONFIGURATOR_ENABLED`): while off, every route answers 404 as if it did not exist.

The review takes enumerated answers and returns what they lead to: a package, the published indicative bands
that apply, what needs an assessment, assumptions, exclusions and why a person must review it. It stores nothing.
Only the quote request creates a lead, once per submission id. No route accepts an amount, and none depends on
language, country or address for a price. Logs carry enumerations and counts only.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status

from app import pricing
from app.config import get_settings
from app.configurator import model, service
from app.configurator.schemas import MetaOut, ReviewOut, ReviewRequest, SubmissionCreate, SubmissionOut
from app.deps import AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.notifications import notify_new_lead
from app.routers.public import contact_rate_limit
from app.security import hash_ip
from app.spam import check_form_token, looks_like_link_spam

logger = logging.getLogger(__name__)


def require_enabled() -> None:
    if not get_settings().project_configurator_enabled:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


router = APIRouter(prefix="/api/public/configurator", tags=["configurator"], dependencies=[Depends(require_enabled)])

_SENT = {
    "bg": "Благодарим! Получихме запитването с конфигурацията. Ще го прегледаме и ще се свържем с вас в работно време.",
    "en": (
        "Thank you! We received the enquiry with the configuration. "
        "We will review it and get back to you during business hours."
    ),
}
_UNSUPPORTED = {
    "bg": "Тази комбинация не се поддържа. Върнете се и променете отбелязаните избори.",
    "en": "This combination is not supported. Go back and change the marked choices.",
}
_TOKEN_ERROR = {
    "bg": "Формулярът е изпратен твърде бързо или е изтекъл. Моля, презаредете страницата и опитайте отново.",
    "en": "The form was sent too quickly or has expired. Please reload the page and try again.",
}
_SPAM = {
    "bg": "Текстът съдържа твърде много връзки. Моля, опишете проекта си с думи.",
    "en": "The text contains too many links. Please describe your project in words.",
}


def review_rate_limit(request: Request) -> None:
    settings = get_settings()
    window = settings.configurator_rate_window_seconds
    enforce_rate_limit(f"configurator-review:{client_ip(request)}", settings.configurator_review_rate_limit, window)
    enforce_rate_limit("configurator:global", settings.configurator_global_rate_limit, window)


def _evaluate(answers: model.Answers, locale: str) -> model.Review:
    try:
        return model.review(answers)
    except ValueError as exc:
        rules = str(exc).split(",")
        logger.info("configurator_combination_rejected", extra={"rules": rules})
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            _UNSUPPORTED[locale],
            "unsupported_combination",
            errors=[{"field": "answers", "type": rule} for rule in rules],
        ) from exc


@router.get("/meta", response_model=MetaOut, summary="Model and price schedule versions the server evaluates with")
def configurator_meta(response: Response) -> MetaOut:
    response.headers["Cache-Control"] = "no-store"
    return MetaOut(model_version=model.MODEL_VERSION, schedule_version=pricing.schedule().version)


@router.post(
    "/review",
    response_model=ReviewOut,
    response_model_by_alias=True,
    dependencies=[Depends(review_rate_limit)],
    summary="Deterministic review of a configuration (indicative, stores nothing)",
)
def configurator_review(payload: ReviewRequest, response: Response) -> ReviewOut:
    response.headers["Cache-Control"] = "no-store"
    return service.review_out(_evaluate(payload.answers.to_model(), "bg"))


@router.post(
    "/submissions",
    status_code=status.HTTP_201_CREATED,
    response_model=SubmissionOut,
    dependencies=[Depends(contact_rate_limit)],
    summary="Quote request with the configuration attached (creates one lead per submission id)",
)
def configurator_submit(
    payload: SubmissionCreate,
    request: Request,
    response: Response,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> SubmissionOut:
    locale = payload.locale.value
    ip_hash = hash_ip(client_ip(request), settings.secret_key)
    if payload.website:
        # Honeypot filled: pretend success, store nothing.
        logger.warning("configurator_spam_rejected", extra={"reason": "honeypot", "ip_hash": ip_hash})
        return SubmissionOut(reference=secrets.token_hex(4).upper(), message=_SENT[locale])
    problem = check_form_token(
        payload.form_token, settings.secret_key, settings.form_token_min_seconds, settings.form_token_max_age_seconds
    )
    if problem:
        logger.info("configurator_form_token_rejected", extra={"reason": problem})
        raise ApiError(status.HTTP_400_BAD_REQUEST, _TOKEN_ERROR[locale], "form_token_invalid")
    if looks_like_link_spam(f"{payload.goals} {payload.special_requirements}"):
        raise ApiError(status.HTTP_400_BAD_REQUEST, _SPAM[locale], "spam_suspected")
    result = _evaluate(payload.answers.to_model(), locale)
    lead, created = service.create_submission(db, payload, result, settings, ip_hash=ip_hash)
    if created:
        logger.info(
            "configurator_submission_created",
            extra={
                "lead": lead.reference,
                "package": result.package,
                "unpriced": len(result.unpriced),
                "locale": locale,
            },
        )
        background.add_task(
            notify_new_lead, settings, str(lead.id), lead.reference, lead.service, lead.inquiry_type, lead.locale
        )
    else:
        # The same submission again (double click, retry): same answer, no second lead, no second notification.
        response.status_code = status.HTTP_200_OK
        logger.info("configurator_submission_repeated", extra={"lead": lead.reference})
    return SubmissionOut(reference=lead.reference, message=_SENT[locale])
