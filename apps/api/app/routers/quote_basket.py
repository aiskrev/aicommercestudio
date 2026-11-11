"""Public quote basket: a server-side draft of a request for a written quote.

Off by default (`QUOTE_BASKET_ENABLED`): while off, every route answers 404 as if it did not exist.

This is not a shop cart and nothing here is a payment. A basket holds configured projects and optional extras as
inputs; every answer recomputes the lines from the published indicative schedule and says what needs an assessment.

Ownership: creating a basket returns a secret token once. Every later request sends it in the `X-Basket-Token`
header; the server stores only its hash. The token is not a cookie, so a cross-site request cannot carry it, and it
is never part of a URL. An unknown token and an expired basket are answered identically (404).
"""

from __future__ import annotations

import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Path, Query, Request, Response, status

from app.config import get_settings
from app.deps import AppSettings, DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.notifications import notify_new_lead
from app.quotes import service
from app.quotes.models import QuoteBasket
from app.quotes.schemas import BasketCreate, BasketCreated, BasketOut, BasketSubmit, BasketSubmitted, ItemWrite
from app.routers.public import contact_rate_limit
from app.security import hash_ip
from app.spam import check_form_token, looks_like_link_spam

logger = logging.getLogger(__name__)


def require_enabled() -> None:
    if not get_settings().quote_basket_enabled:
        raise ApiError(status.HTTP_404_NOT_FOUND, "Not found.", "not_found")


def basket_rate_limit(request: Request) -> None:
    settings = get_settings()
    window = settings.quote_basket_rate_window_seconds
    enforce_rate_limit(f"quote-basket:{client_ip(request)}", settings.quote_basket_rate_limit, window)
    enforce_rate_limit("quote-basket:global", settings.quote_basket_global_rate_limit, window)


def create_rate_limit(request: Request) -> None:
    settings = get_settings()
    window = settings.quote_basket_rate_window_seconds
    enforce_rate_limit(f"quote-basket-create:{client_ip(request)}", settings.quote_basket_create_rate_limit, window)


router = APIRouter(
    prefix="/api/public/quote-basket",
    tags=["quote-basket"],
    dependencies=[Depends(require_enabled), Depends(basket_rate_limit)],
)

BasketToken = Annotated[str, Header(alias="X-Basket-Token", min_length=20, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")]
# Item ids are UUIDs the server issued; anything else is refused before the basket is touched.
ItemId = Annotated[str, Path(pattern=r"^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$")]

_MESSAGES = {
    "basket_not_found": {
        "bg": "Заявката не е намерена или е изтекла.",
        "en": "The request was not found or has expired.",
    },
    "basket_changed": {
        "bg": "Заявката е променена на друго място. Показваме актуалното ѝ състояние.",
        "en": "The request was changed elsewhere. We show its current state.",
    },
    "basket_submitted": {"bg": "Заявката вече е изпратена.", "en": "The request has already been sent."},
    "basket_full": {
        "bg": "Заявката е пълна. Премахнете позиция, за да добавите нова.",
        "en": "The request is full. Remove an item to add a new one.",
    },
    "basket_empty": {"bg": "Заявката е празна.", "en": "The request is empty."},
    "basket_needs_update": {
        "bg": "Една от позициите трябва да се обнови, преди да изпратите заявката.",
        "en": "One of the items has to be updated before you send the request.",
    },
    "duplicate_item": {"bg": "Тази позиция вече е в заявката.", "en": "This item is already in the request."},
    "unknown_offer": {"bg": "Няма такава услуга в ценовата схема.", "en": "There is no such offer in the schedule."},
    "item_not_found": {"bg": "Позицията не е намерена.", "en": "The item was not found."},
    "unsupported_combination": {
        "bg": "Тази комбинация не се поддържа. Променете отбелязаните избори.",
        "en": "This combination is not supported. Change the marked choices.",
    },
}
_SENT = {
    "bg": "Благодарим! Получихме заявката. Ще я прегледаме и ще се свържем с вас в работно време.",
    "en": "Thank you! We received the request. We will review it and get back to you during business hours.",
}
_TOKEN_ERROR = {
    "bg": "Формулярът е изпратен твърде бързо или е изтекъл. Моля, презаредете страницата и опитайте отново.",
    "en": "The form was sent too quickly or has expired. Please reload the page and try again.",
}
_SPAM = {
    "bg": "Текстът съдържа твърде много връзки. Моля, опишете проекта си с думи.",
    "en": "The text contains too many links. Please describe your project in words.",
}


def _refuse(error: service.BasketError, locale: str) -> ApiError:
    return ApiError(
        error.status,
        _MESSAGES[error.code][locale],
        error.code,
        errors=[{"field": "item", "type": rule} for rule in error.rules] or None,
    )


def _owned(db: DbSession, token: str, *, for_update: bool = False) -> QuoteBasket:
    basket = service.load(db, token, for_update=for_update)
    if basket is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, _MESSAGES["basket_not_found"]["bg"], "basket_not_found")
    return basket


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=BasketCreated,
    response_model_by_alias=True,
    dependencies=[Depends(create_rate_limit)],
    summary="Start a basket (optionally with a first item); returns the secret token once",
)
def create_basket(payload: BasketCreate, response: Response, db: DbSession, settings: AppSettings) -> BasketCreated:
    _no_store(response)
    basket, token = service.create(db, payload.locale.value, settings)
    try:
        if payload.item is not None:
            service.add_item(basket, basket.version, payload.item, settings)
    except service.BasketError as error:
        db.rollback()
        raise _refuse(error, payload.locale.value) from error
    db.commit()
    logger.info("quote_basket_created", extra={"items": len(basket.items), "locale": basket.locale})
    return BasketCreated(token=token, basket=service.view(basket))


@router.get("", response_model=BasketOut, response_model_by_alias=True, summary="The basket this token owns")
def read_basket(token: BasketToken, response: Response, db: DbSession) -> BasketOut:
    _no_store(response)
    basket = _owned(db, token)
    lead = service.submitted_lead(db, basket)
    return service.view(basket, reference=lead.reference if lead else None)


@router.post(
    "/items",
    status_code=status.HTTP_201_CREATED,
    response_model=BasketOut,
    response_model_by_alias=True,
    summary="Add a configured project or an optional extra",
)
def add_item(
    payload: ItemWrite, token: BasketToken, response: Response, db: DbSession, settings: AppSettings
) -> BasketOut:
    _no_store(response)
    basket = _owned(db, token, for_update=True)
    try:
        service.add_item(basket, payload.expected_version, payload.item, settings)
    except service.BasketError as error:
        db.rollback()
        raise _refuse(error, basket.locale) from error
    db.commit()
    return service.view(basket)


@router.put(
    "/items/{item_id}",
    response_model=BasketOut,
    response_model_by_alias=True,
    summary="Replace an item (edit a configuration)",
)
def replace_item(
    item_id: ItemId,
    payload: ItemWrite,
    token: BasketToken,
    response: Response,
    db: DbSession,
    settings: AppSettings,
) -> BasketOut:
    _no_store(response)
    basket = _owned(db, token, for_update=True)
    try:
        service.replace_item(basket, item_id, payload.expected_version, payload.item, settings)
    except service.BasketError as error:
        db.rollback()
        raise _refuse(error, basket.locale) from error
    db.commit()
    return service.view(basket)


@router.delete("/items/{item_id}", response_model=BasketOut, response_model_by_alias=True, summary="Remove an item")
def remove_item(
    item_id: ItemId,
    expected_version: Annotated[int, Query(ge=1)],
    token: BasketToken,
    response: Response,
    db: DbSession,
    settings: AppSettings,
) -> BasketOut:
    _no_store(response)
    basket = _owned(db, token, for_update=True)
    try:
        service.remove_item(basket, item_id, expected_version, settings)
    except service.BasketError as error:
        db.rollback()
        raise _refuse(error, basket.locale) from error
    db.commit()
    return service.view(basket)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, summary="Discard the basket")
def discard_basket(token: BasketToken, db: DbSession) -> Response:
    basket = _owned(db, token, for_update=True)
    db.delete(basket)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/submit",
    status_code=status.HTTP_201_CREATED,
    response_model=BasketSubmitted,
    dependencies=[Depends(contact_rate_limit)],
    summary="Send the basket as one quote request (creates one lead; a repeat returns the same reference)",
)
def submit_basket(
    payload: BasketSubmit,
    token: BasketToken,
    request: Request,
    response: Response,
    background: BackgroundTasks,
    db: DbSession,
    settings: AppSettings,
) -> BasketSubmitted:
    locale = payload.locale.value
    ip_hash = hash_ip(client_ip(request), settings.secret_key)
    if payload.website:
        # Honeypot filled: pretend success, store nothing.
        logger.warning("quote_basket_spam_rejected", extra={"reason": "honeypot", "ip_hash": ip_hash})
        return BasketSubmitted(reference=secrets.token_hex(4).upper(), message=_SENT[locale])
    problem = check_form_token(
        payload.form_token, settings.secret_key, settings.form_token_min_seconds, settings.form_token_max_age_seconds
    )
    if problem:
        logger.info("quote_basket_form_token_rejected", extra={"reason": problem})
        raise ApiError(status.HTTP_400_BAD_REQUEST, _TOKEN_ERROR[locale], "form_token_invalid")
    if looks_like_link_spam(f"{payload.goals} {payload.special_requirements}"):
        raise ApiError(status.HTTP_400_BAD_REQUEST, _SPAM[locale], "spam_suspected")
    # The row lock makes a second, simultaneous request wait and then find the basket already sent.
    basket = _owned(db, token, for_update=True)
    try:
        lead, created = service.submit(db, basket, payload, settings, ip_hash=ip_hash)
    except service.BasketError as error:
        db.rollback()
        raise _refuse(error, locale) from error
    db.commit()
    if created:
        logger.info("quote_basket_submitted", extra={"lead": lead.reference, "items": len(basket.items)})
        background.add_task(
            notify_new_lead, settings, str(lead.id), lead.reference, lead.service, lead.inquiry_type, lead.locale
        )
    else:
        response.status_code = status.HTTP_200_OK
        logger.info("quote_basket_submit_repeated", extra={"lead": lead.reference})
    return BasketSubmitted(reference=lead.reference, message=_SENT[locale])
