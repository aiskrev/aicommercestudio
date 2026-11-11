"""Quote basket: create, change, view and send.

Every view is computed here from the stored inputs and the published schedule; a basket never holds an amount.
Changes take a row lock and compare the version the caller saw, so two tabs cannot overwrite each other and a
double click cannot send the basket twice.
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import audit, pricing
from app.config import Settings
from app.configurator import model
from app.configurator import service as configurator_service
from app.configurator.schemas import AnswersIn, BandOut, HumanReviewOut
from app.models import InquiryType, Lead, LeadStatus, ServiceKey, utcnow
from app.quotes.models import BasketStatus, QuoteBasket
from app.quotes.schemas import (
    MAX_ITEMS,
    BasketItemOut,
    BasketOut,
    BasketSubmit,
    BasketTotalsOut,
    ConfigurationItemIn,
    ExtraItemIn,
    ExtraOut,
    UnpricedOut,
)
from app.security import generate_token, hash_token
from app.services.leads import QUOTE_BASKET_SOURCE

KIND = "quote_basket"
#: How long a sent basket stays readable (the browser shows the confirmation), before the maintenance job removes it.
SUBMITTED_DAYS = 1

_MESSAGE = {
    "bg": "Заявка за оферта от {count} позиции: {items}. Ориентирът не е оферта и се преглежда от човек.",
    "en": "Quote request with {count} items: {items}. The estimate is not a quote and is reviewed by a person.",
}
_LABELS = {
    "bg": {"goals": "Цели", "special": "Специални изисквания"},
    "en": {"goals": "Goals", "special": "Special requirements"},
}


class BasketError(Exception):
    """A refused change, with the HTTP status and the stable error code the router answers with."""

    def __init__(self, status: int, code: str, rules: list[str] | None = None) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.rules = rules or []


def _expiry(settings: Settings):
    return utcnow() + timedelta(days=settings.quote_basket_days)


def create(db: Session, locale: str, settings: Settings) -> tuple[QuoteBasket, str]:
    token = generate_token()
    basket = QuoteBasket(token_hash=hash_token(token), locale=locale, items=[], expires_at=_expiry(settings))
    db.add(basket)
    db.flush()
    return basket, token


def load(db: Session, token: str, *, for_update: bool = False) -> QuoteBasket | None:
    """The basket this token owns, unless it has expired. Unknown and expired look the same to the caller."""
    query = select(QuoteBasket).where(QuoteBasket.token_hash == hash_token(token), QuoteBasket.expires_at > utcnow())
    if for_update:
        query = query.with_for_update()
    return db.scalar(query)


def _stored(item: ConfigurationItemIn | ExtraItemIn, item_id: str) -> dict[str, Any]:
    if isinstance(item, ExtraItemIn):
        if pricing.band(item.group, item.key) is None:
            raise BasketError(422, "unknown_offer")
        return {"id": item_id, "kind": "extra", "group": item.group, "key": item.key}
    answers = item.answers.to_model()
    broken = model.violations(answers)
    if broken:
        raise BasketError(422, "unsupported_combination", broken)
    return {
        "id": item_id,
        "kind": "configuration",
        "model_version": model.MODEL_VERSION,
        "answers": {
            **{name: getattr(answers, name) for name in answers.__dataclass_fields__},
            "features": list(answers.features),
            "operations": list(answers.operations),
        },
    }


def _check_writable(basket: QuoteBasket, expected_version: int) -> None:
    if basket.status != BasketStatus.OPEN.value:
        raise BasketError(409, "basket_submitted")
    if basket.version != expected_version:
        raise BasketError(409, "basket_changed")


def _no_duplicate_extra(items: list[dict[str, Any]], candidate: dict[str, Any], *, ignore: str | None = None) -> None:
    if candidate["kind"] != "extra":
        return
    for existing in items:
        same = existing["kind"] == "extra" and (existing["group"], existing["key"]) == (
            candidate["group"],
            candidate["key"],
        )
        if same and existing["id"] != ignore:
            raise BasketError(422, "duplicate_item")


def _touch(basket: QuoteBasket, items: list[dict[str, Any]], settings: Settings) -> None:
    basket.items = items  # a new list, so the JSONB change is tracked
    basket.version += 1
    basket.updated_at = utcnow()
    basket.expires_at = _expiry(settings)


def add_item(
    basket: QuoteBasket, expected_version: int, item: ConfigurationItemIn | ExtraItemIn, settings: Settings
) -> str:
    _check_writable(basket, expected_version)
    if len(basket.items) >= MAX_ITEMS:
        raise BasketError(422, "basket_full")
    stored = _stored(item, str(uuid.uuid4()))
    _no_duplicate_extra(basket.items, stored)
    _touch(basket, [*basket.items, stored], settings)
    return stored["id"]


def replace_item(
    basket: QuoteBasket,
    item_id: str,
    expected_version: int,
    item: ConfigurationItemIn | ExtraItemIn,
    settings: Settings,
) -> None:
    _check_writable(basket, expected_version)
    if not any(existing["id"] == item_id for existing in basket.items):
        raise BasketError(404, "item_not_found")
    stored = _stored(item, item_id)
    _no_duplicate_extra(basket.items, stored, ignore=item_id)
    _touch(basket, [stored if existing["id"] == item_id else existing for existing in basket.items], settings)


def remove_item(basket: QuoteBasket, item_id: str, expected_version: int, settings: Settings) -> None:
    _check_writable(basket, expected_version)
    remaining = [existing for existing in basket.items if existing["id"] != item_id]
    if len(remaining) == len(basket.items):
        raise BasketError(404, "item_not_found")
    _touch(basket, remaining, settings)


def view(basket: QuoteBasket, reference: str | None = None) -> BasketOut:
    """The basket as the visitor sees it: every line and total recomputed from the published schedule."""
    schedule = pricing.schedule()
    items: list[BasketItemOut] = []
    unpriced: list[UnpricedOut] = []
    assumptions: list[str] = []
    exclusions: list[str] = list(model.EXCLUSION_KEYS)
    reasons: list[str] = ["indicative_only"]
    one_time = monthly = priced = 0

    def merge(target: list[str], values: list[str]) -> None:
        target.extend(value for value in values if value not in target)

    for stored in basket.items:
        if stored["kind"] == "extra":
            band = pricing.band(stored["group"], stored["key"])
            if band is None:  # the offer left the schedule after it was added
                items.append(BasketItemOut(id=stored["id"], kind="extra", needs_update=True))
                continue
            priced += 1
            one_time += 0 if band.recurring else band.from_
            monthly += band.from_ if band.recurring else 0
            extra = ExtraOut(
                group=stored["group"],
                key=stored["key"],
                band=BandOut(unit=band.unit, from_=band.from_, typical=band.typical),
            )
            items.append(BasketItemOut(id=stored["id"], kind="extra", extra=extra))
            continue
        try:
            result = model.review(AnswersIn.model_validate(stored["answers"]).to_model())
        except ValueError:  # the rules changed since it was added (pydantic's ValidationError is a ValueError too)
            items.append(
                BasketItemOut(id=stored["id"], kind="configuration", needs_update=True, answers=stored["answers"])
            )
            continue
        review = configurator_service.review_out(result)
        priced += sum(1 for line in result.items if line.band)
        one_time += result.one_time_from
        monthly += result.monthly_from
        unpriced.extend(UnpricedOut(item_id=stored["id"], key=key) for key in result.unpriced)
        merge(assumptions, list(result.assumptions))
        merge(reasons, list(result.review_reasons))
        items.append(BasketItemOut(id=stored["id"], kind="configuration", answers=stored["answers"], review=review))

    return BasketOut(
        status=basket.status,  # type: ignore[arg-type]
        version=basket.version,
        expires_at=basket.expires_at,
        locale=basket.locale,
        model_version=model.MODEL_VERSION,
        schedule_version=schedule.version,
        currency=schedule.currency,
        owner_approval=schedule.owner_approval,
        tax_treatment=schedule.tax_treatment,
        items=items,
        totals=BasketTotalsOut(
            one_time_from=one_time, monthly_from=monthly, priced_lines=priced, unpriced_lines=len(unpriced)
        ),
        unpriced=unpriced,
        assumptions=assumptions,
        exclusions=exclusions,
        human_review=HumanReviewOut(reasons=reasons),
        reference=reference,
    )


def _lead_service(current: BasketOut) -> str:
    """The service a lead is filed under: the first configured project, else the first extra that is a service."""
    for item in current.items:
        if item.review:
            return item.review.service
    for item in current.items:
        if item.extra and item.extra.group == "service":
            return item.extra.key
        if item.extra and item.extra.group == "ai_managed":
            return ServiceKey.AI_MANAGED.value
    return ServiceKey.OTHER.value


def _item_label(item: BasketItemOut) -> str:
    if item.review:
        return item.review.package
    return f"{item.extra.group}:{item.extra.key}" if item.extra else item.kind


def submitted_lead(db: Session, basket: QuoteBasket) -> Lead | None:
    return db.get(Lead, basket.lead_id) if basket.lead_id else None


def submit(
    db: Session, basket: QuoteBasket, data: BasketSubmit, settings: Settings, *, ip_hash: str | None
) -> tuple[Lead, bool]:
    """Sends the basket as one quote request. Returns (lead, created); the caller holds the row lock.

    A basket is sent once: a repeated or simultaneous request finds it already sent and gets the first lead back.
    The lead stores the view computed here, not anything the browser displayed.
    """
    if basket.status == BasketStatus.SUBMITTED.value:
        existing = submitted_lead(db, basket)
        if existing is None:
            raise BasketError(409, "basket_submitted")
        return existing, False
    if basket.version != data.expected_version:
        raise BasketError(409, "basket_changed")
    if not basket.items:
        raise BasketError(422, "basket_empty")
    current = view(basket)
    if any(item.needs_update for item in current.items):
        raise BasketError(422, "basket_needs_update")

    now = utcnow()
    locale = data.locale.value
    first = next((item for item in current.items if item.answers), None)
    labels = ", ".join(_item_label(item) for item in current.items)
    parts = [_MESSAGE[locale].format(count=len(current.items), items=labels)]
    if data.goals:
        parts.append(f"{_LABELS[locale]['goals']}: {data.goals}")
    if data.special_requirements:
        parts.append(f"{_LABELS[locale]['special']}: {data.special_requirements}")
    service_key = _lead_service(current)
    lead = Lead(
        service=service_key,
        submitted_service=service_key,
        inquiry_type=InquiryType.QUOTE.value,
        budget_range=first.answers.get("budget_range") if first and first.answers else None,
        timeline=first.answers.get("timeline") if first and first.answers else None,
        locale=locale,
        service_details={
            "kind": KIND,
            "basket_id": str(basket.id),
            "model_version": model.MODEL_VERSION,
            "basket": current.model_dump(mode="json", by_alias=True),
        },
        name=data.name,
        company=data.company,
        email=data.email,
        phone=data.phone or None,
        message="\n\n".join(parts),
        status=LeadStatus.NEW.value,
        source=QUOTE_BASKET_SOURCE,
        privacy_acknowledged_at=now,
        privacy_notice_version=settings.privacy_notice_version,
        marketing_consent=data.marketing_consent,
        marketing_consent_at=now if data.marketing_consent else None,
        marketing_consent_version=settings.marketing_consent_version if data.marketing_consent else None,
        ip_hash=ip_hash,
        created_at=now,
        updated_at=now,
    )
    db.add(lead)
    db.flush()
    basket.status = BasketStatus.SUBMITTED.value
    basket.lead_id = lead.id
    basket.submitted_at = now
    basket.updated_at = now
    basket.version += 1
    basket.expires_at = now + timedelta(days=SUBMITTED_DAYS)
    audit.record(
        db,
        "lead.created",
        actor_label="website",
        entity_type="lead",
        entity_id=str(lead.id),
        details={
            "service": lead.service,
            "inquiry_type": lead.inquiry_type,
            "source": QUOTE_BASKET_SOURCE,
            "marketing_consent": lead.marketing_consent,
            "items": len(current.items),
            "unpriced": current.totals.unpriced_lines,
            "locale": locale,
        },
        ip_hash=ip_hash,
    )
    return lead, True


def purge_expired(db: Session, *, dry_run: bool = False) -> int:
    """Deletes expired baskets (abandoned drafts and sent ones past their confirmation window)."""
    expired = QuoteBasket.expires_at <= utcnow()
    if dry_run:
        return db.scalar(select(func.count()).select_from(QuoteBasket).where(expired)) or 0
    return db.execute(delete(QuoteBasket).where(expired)).rowcount
