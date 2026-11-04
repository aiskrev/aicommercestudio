"""Checkout, event processing, access policy and reconciliation (docs/STRIPE_BILLING.md).

An event never decides anything by itself. It only says which object to read again: the state comes
from Stripe at processing time, so order, duplicates and delays cannot leave a stale answer. Access
changes only here, and only from that state; a success URL or `checkout.session.completed` alone does not.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.billing.gateway import Gateway, get_gateway
from app.billing.models import (
    BillingCheckout,
    BillingCustomer,
    BillingEvent,
    BillingIncident,
    BillingOffer,
    BillingPurchase,
    BillingSubscription,
    EventStatus,
    OfferKind,
    Onboarding,
    ScopeConfirmation,
)
from app.config import Settings, get_settings
from app.db import get_sessionmaker
from app.invoicing import service as invoicing
from app.invoicing.models import DocumentKind
from app.models import utcnow
from app.workspace import entitlements
from app.workspace.models import CustomerWorkspace, EntitlementGrant

logger = logging.getLogger(__name__)

SUBSCRIPTION_EVENTS = {
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
}
INVOICE_EVENTS = {"invoice.paid", "invoice.payment_failed", "invoice.payment_action_required"}
CHECKOUT_EVENTS = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
}
CHARGE_EVENTS = {"charge.refunded"}
DISPUTE_EVENTS = {"charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"}
HANDLED = SUBSCRIPTION_EVENTS | INVOICE_EVENTS | CHECKOUT_EVENTS | CHARGE_EVENTS | DISPUTE_EVENTS

BLOCKS_NEW_SUBSCRIPTION = {"active", "trialing", "past_due", "unpaid", "incomplete", "paused"}
RETRY_MINUTES = (1, 5, 30, 120, 720)
MAX_ATTEMPTS = 8


class BillingError(Exception):
    def __init__(self, status: int, code: str, detail: str) -> None:
        super().__init__(code)
        self.status, self.code, self.detail = status, code, detail


@dataclass(frozen=True)
class Checkout:
    url: str
    reused: bool


def _time(value: int | None) -> datetime | None:
    return datetime.fromtimestamp(value, UTC) if value else None


def _lock(db: Session, workspace_id: uuid.UUID) -> None:
    """One billing change per workspace at a time, released with the transaction."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": f"billing:{workspace_id}"})


def _customer(db: Session, gateway: Gateway, workspace: CustomerWorkspace) -> BillingCustomer:
    existing = db.get(BillingCustomer, workspace.id)
    if existing:
        return existing
    customer = BillingCustomer(
        workspace_id=workspace.id,
        stripe_customer_id=gateway.create_customer(str(workspace.id)),
        billing_owner_account_id=workspace.owner_account_id,
    )
    db.add(customer)
    db.flush()
    return customer


def _check_offer(gateway: Gateway, offer: BillingOffer) -> None:
    """The price in Stripe must be what was approved here, or nothing is sold."""
    price = gateway.retrieve_price(offer.stripe_price_id)
    recurring = (price.get("recurring") or {}).get("interval")
    if (
        not price.get("active")
        or price.get("unit_amount") != offer.amount_minor
        or price.get("currency") != offer.currency.lower()
        or recurring != offer.billing_interval
    ):
        logger.error("billing_price_mismatch", extra={"offer": offer.key})
        raise BillingError(409, "offer_unavailable", "This offer isn't available right now.")


def _paths(settings: Settings, locale: str) -> tuple[str, str]:
    root = settings.site_url.rstrip("/") + ("/bg/konto/advisor" if locale == "bg" else "/en/account/advisor")
    return f"{root}/payment", root


def start_checkout(
    db: Session, settings: Settings, workspace: CustomerWorkspace, offer_key: str, locale: str
) -> Checkout:
    gateway = get_gateway()
    _lock(db, workspace.id)
    offer = db.get(BillingOffer, offer_key)
    if offer is None or offer.approved_at is None:
        raise BillingError(404, "offer_unavailable", "This offer isn't available.")
    try:
        invoicing.require_sale_allowed(db, settings, workspace.id)
    except invoicing.ProfileMissing as exc:
        raise BillingError(409, "billing_profile_required", "Add your invoice details first.") from exc
    except invoicing.TaxNotConfirmed as exc:
        raise BillingError(409, "tax_not_confirmed", "This sale isn't available yet. We've been notified.") from exc
    if offer.requires_scope and db.get(ScopeConfirmation, (workspace.id, offer.key)) is None:
        raise BillingError(409, "scope_not_confirmed", "We confirm the scope with you before any payment.")
    _check_offer(gateway, offer)
    customer = _customer(db, gateway, workspace)

    if offer.kind == OfferKind.SUBSCRIPTION.value:
        # Stripe decides, not our copy: a webhook may not have arrived yet.
        for item in gateway.list_subscriptions(customer.stripe_customer_id):
            if item["status"] in BLOCKS_NEW_SUBSCRIPTION:
                raise BillingError(
                    409, "subscription_exists", "You already have a subscription. Manage it in the portal."
                )

    open_rows = db.scalars(
        select(BillingCheckout).where(BillingCheckout.workspace_id == workspace.id, BillingCheckout.status == "open")
    ).all()
    for row in open_rows:
        session = gateway.retrieve_checkout(row.stripe_session_id)
        if row.offer_key == offer.key and session.get("status") == "open":
            db.commit()
            return Checkout(url=session["url"], reused=True)
        if session.get("status") == "open":  # a second tab must not leave two ways to pay
            gateway.expire_checkout(row.stripe_session_id)
        row.status = "expired" if session.get("status") != "complete" else "complete"

    checkout = BillingCheckout(workspace_id=workspace.id, offer_key=offer.key)
    db.add(checkout)
    db.flush()
    metadata = {"workspace_id": str(workspace.id), "offer_key": offer.key, "checkout_id": str(checkout.id)}
    success, cancel = _paths(settings, locale)
    params: dict[str, Any] = {
        "mode": "subscription" if offer.kind == OfferKind.SUBSCRIPTION.value else "payment",
        "customer": customer.stripe_customer_id,
        "client_reference_id": str(checkout.id),
        "line_items": [{"price": offer.stripe_price_id, "quantity": 1}],
        "success_url": f"{success}?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": cancel,
        "locale": locale,
        "metadata": metadata,
        "automatic_tax": {"enabled": settings.stripe_automatic_tax},
    }
    if offer.kind == OfferKind.SUBSCRIPTION.value:
        params["subscription_data"] = {"metadata": metadata}
    else:
        params["payment_intent_data"] = {"metadata": metadata}
    session = gateway.create_checkout(params, f"checkout:{checkout.id}")
    checkout.stripe_session_id = session["id"]
    db.commit()
    return Checkout(url=session["url"], reused=False)


def open_portal(
    db: Session, settings: Settings, workspace: CustomerWorkspace, account_id: uuid.UUID, locale: str
) -> str:
    customer = db.get(BillingCustomer, workspace.id)
    if customer is None or customer.billing_owner_account_id != account_id:
        raise BillingError(404, "not_found", "Not found.")
    return get_gateway().create_portal(customer.stripe_customer_id, _paths(settings, locale)[1])


def _workspace_of(db: Session, customer_id: str | None) -> uuid.UUID | None:
    return db.scalar(select(BillingCustomer.workspace_id).where(BillingCustomer.stripe_customer_id == customer_id))


def _entitled(row: BillingSubscription, settings: Settings, now: datetime) -> bool:
    if row.status in ("active", "trialing"):
        return True
    if row.status == "past_due" and row.past_due_since is not None:
        return now - row.past_due_since < timedelta(days=settings.billing_grace_days)
    return False


def sync_access(db: Session, settings: Settings, workspace_id: uuid.UUID) -> None:
    """Set the plan from subscription state. Grants made by hand or by contract are left alone."""
    now = utcnow()
    grant = db.scalar(
        select(EntitlementGrant).where(
            EntitlementGrant.workspace_id == workspace_id, EntitlementGrant.ended_at.is_(None)
        )
    )
    if grant is not None and grant.source != "stripe":
        return
    rows = db.scalars(select(BillingSubscription).where(BillingSubscription.workspace_id == workspace_id)).all()
    wanted = None
    for row in rows:
        if _entitled(row, settings, now):
            wanted = db.scalar(select(BillingOffer.plan_key).where(BillingOffer.key == row.offer_key))
    current = None
    if grant is not None:
        current = entitlements.resolve(db, workspace_id).plan
    if wanted == current:
        return
    if wanted:
        entitlements.grant(db, workspace_id, wanted, "stripe")
    elif grant is not None:
        grant.ended_at = now  # back to Free. Projects and saved results stay; results lock as documented


def sync_subscription(db: Session, settings: Settings, gateway: Gateway, subscription_id: str) -> None:
    data = gateway.retrieve_subscription(subscription_id)
    workspace_id = _workspace_of(db, data.get("customer"))
    metadata = data.get("metadata") or {}
    if workspace_id is None or metadata.get("workspace_id") != str(workspace_id):
        # Never guess an owner. The event fails, retries, and shows up for reconciliation.
        raise LookupError("subscription_owner_unknown")
    _lock(db, workspace_id)
    offer_key = metadata.get("offer_key")
    offer = db.get(BillingOffer, offer_key)
    if offer is None:
        raise LookupError("offer_unknown")
    latest = data.get("latest_invoice")
    action = False
    if latest:
        invoice = latest if isinstance(latest, dict) else gateway.retrieve_invoice(latest)
        action = invoice.get("status") == "open" and data["status"] in ("incomplete", "past_due")
    items = (data.get("items") or {}).get("data") or [{}]
    row = db.get(BillingSubscription, subscription_id)
    if row is None:
        row = BillingSubscription(
            stripe_subscription_id=subscription_id,
            workspace_id=workspace_id,
            offer_key=offer_key,
            status=data["status"],
            onboarding_status=(Onboarding.PENDING if offer.requires_scope else Onboarding.NOT_REQUIRED).value,
        )
        db.add(row)
    now = utcnow()
    if data["status"] == "past_due" and row.past_due_since is None:
        row.past_due_since = now
    if data["status"] != "past_due":
        row.past_due_since = None
    row.status = data["status"]
    row.cancel_at_period_end = bool(data.get("cancel_at_period_end") or data.get("cancel_at"))
    row.current_period_end = _time(items[0].get("current_period_end"))
    row.action_required = action
    row.synced_at = now
    db.flush()
    sync_access(db, settings, workspace_id)


def sync_checkout(db: Session, settings: Settings, gateway: Gateway, session_id: str) -> None:
    data = gateway.retrieve_checkout(session_id)
    checkout = db.scalar(select(BillingCheckout).where(BillingCheckout.stripe_session_id == session_id))
    if checkout is None:
        raise LookupError("checkout_unknown")
    _lock(db, checkout.workspace_id)
    checkout.status = {"complete": "complete", "expired": "expired"}.get(data.get("status"), checkout.status)
    if data.get("mode") == "subscription":
        if data.get("subscription"):
            sync_subscription(db, settings, gateway, data["subscription"])
        return
    if data.get("status") != "complete":
        return
    offer = db.get(BillingOffer, checkout.offer_key)
    paid = data.get("payment_status") == "paid"
    row = db.get(BillingPurchase, session_id)
    if row is None:
        row = BillingPurchase(
            stripe_session_id=session_id,
            workspace_id=checkout.workspace_id,
            offer_key=checkout.offer_key,
            payment_status=data.get("payment_status") or "unpaid",
            onboarding_status=(Onboarding.PENDING if offer.requires_scope else Onboarding.NOT_REQUIRED).value,
        )
        db.add(row)
    row.payment_intent_id = data.get("payment_intent") or row.payment_intent_id
    if row.payment_status not in ("refunded", "partially_refunded", "disputed", "dispute_lost"):
        row.payment_status = data.get("payment_status") or row.payment_status
        row.access_active = paid
    if paid:
        invoicing.enqueue(
            db,
            workspace_id=checkout.workspace_id,
            source_key=f"purchase:{session_id}",
            kind=DocumentKind.INVOICE,
            amount_minor=data.get("amount_total") or offer.amount_minor,
            currency=data.get("currency") or offer.currency,
            description=offer.key,
            payment_ref=data.get("payment_intent"),
        )


def _purchase_for(db: Session, payment_intent: str | None) -> BillingPurchase | None:
    if not payment_intent:
        return None
    return db.scalar(select(BillingPurchase).where(BillingPurchase.payment_intent_id == payment_intent))


def _incident(db: Session, object_id: str, kind: str, status: str, amount: int, workspace, intent) -> None:
    db.execute(
        insert(BillingIncident)
        .values(
            stripe_object_id=object_id,
            kind=kind,
            status=status,
            amount_minor=amount,
            workspace_id=workspace,
            payment_intent_id=intent,
            updated_at=utcnow(),
        )
        .on_conflict_do_update(
            index_elements=["stripe_object_id"], set_={"status": status, "amount_minor": amount, "updated_at": utcnow()}
        )
    )


def sync_charge(db: Session, gateway: Gateway, charge_id: str) -> None:
    """A refund is recorded. A subscription's access still follows the subscription; nothing is deleted."""
    data = gateway.retrieve_charge(charge_id)
    workspace_id = _workspace_of(db, data.get("customer"))
    intent = data.get("payment_intent")
    full = bool(data.get("refunded"))
    _incident(
        db, charge_id, "refund", "full" if full else "partial", data.get("amount_refunded") or 0, workspace_id, intent
    )
    purchase = _purchase_for(db, intent)
    if purchase is not None:
        purchase.payment_status = "refunded" if full else "partially_refunded"
        if full:
            purchase.access_active = False
    if workspace_id is not None:
        # Linked to the invoice it corrects. Several partial refunds make one note each, for the new part.
        refunded = data.get("amount_refunded") or 0
        fresh = refunded - invoicing.credited_so_far(db, charge_id)
        if fresh > 0:
            invoice_id = gateway.invoice_for_payment(intent) if intent and purchase is None else None
            parent = invoicing.parent_for(db, intent, invoice_id)
            invoicing.enqueue(
                db,
                workspace_id=workspace_id,
                source_key=f"refund:{charge_id}:{refunded}",
                kind=DocumentKind.CREDIT_NOTE,
                amount_minor=fresh,
                currency=data.get("currency") or "eur",
                description="refund",
                payment_ref=intent,
                refund_ref=charge_id,
                parent_id=parent.id if parent else None,
            )


def sync_dispute(db: Session, gateway: Gateway, dispute_id: str) -> None:
    """An open dispute changes nothing for the customer. A lost one ends a one-time purchase's access."""
    data = gateway.retrieve_dispute(dispute_id)
    intent = data.get("payment_intent")
    purchase = _purchase_for(db, intent)
    workspace_id = purchase.workspace_id if purchase else None
    _incident(db, dispute_id, "dispute", data.get("status") or "open", data.get("amount") or 0, workspace_id, intent)
    if purchase is None:
        return
    status = data.get("status")
    if status == "lost":
        purchase.payment_status = "dispute_lost"
        purchase.access_active = False
    elif status == "won":
        purchase.payment_status = "paid"
        purchase.access_active = True
    else:
        purchase.payment_status = "disputed"


def _apply(db: Session, settings: Settings, gateway: Gateway, event: BillingEvent) -> None:
    if event.type in SUBSCRIPTION_EVENTS:
        sync_subscription(db, settings, gateway, event.object_id)
    elif event.type in INVOICE_EVENTS:
        invoice = gateway.retrieve_invoice(event.object_id)
        parent = (invoice.get("parent") or {}).get("subscription_details") or {}
        if parent.get("subscription"):
            sync_subscription(db, settings, gateway, parent["subscription"])
        workspace_id = _workspace_of(db, invoice.get("customer"))
        if invoice.get("status") == "paid" and workspace_id is not None and invoice.get("amount_paid"):
            invoicing.enqueue(
                db,
                workspace_id=workspace_id,
                source_key=f"stripe_invoice:{event.object_id}",
                kind=DocumentKind.INVOICE,
                amount_minor=invoice["amount_paid"],
                currency=invoice.get("currency") or "eur",
                description="subscription",
                stripe_invoice_id=event.object_id,
            )
    elif event.type in CHECKOUT_EVENTS:
        sync_checkout(db, settings, gateway, event.object_id)
    elif event.type in CHARGE_EVENTS:
        sync_charge(db, gateway, event.object_id)
    elif event.type in DISPUTE_EVENTS:
        sync_dispute(db, gateway, event.object_id)


def record_event(db: Session, event: dict[str, Any]) -> None:
    """Store first, answer 2xx, work later. A repeated id is ignored."""
    db.execute(
        insert(BillingEvent)
        .values(id=event["id"], type=event["type"], object_id=event["data"]["object"]["id"], received_at=utcnow())
        .on_conflict_do_nothing()
    )
    db.commit()


def process_pending(gateway: Gateway | None = None, limit: int = 50) -> dict[str, int]:
    """Safe to run from several processes: rows are claimed with SKIP LOCKED, one transaction each."""
    settings = get_settings()
    active = gateway or get_gateway()
    result = {"processed": 0, "retry": 0, "failed": 0}
    for _ in range(limit):
        with get_sessionmaker()() as db:
            event = db.scalar(
                select(BillingEvent)
                .where(
                    BillingEvent.status == EventStatus.RECEIVED.value,
                    BillingEvent.next_attempt_at <= utcnow(),
                )
                .order_by(BillingEvent.received_at)
                .limit(1)
                .with_for_update(skip_locked=True)
            )
            if event is None:
                return result
            event.attempts += 1
            try:
                with db.begin_nested():
                    _apply(db, settings, active, event)
            except Exception as error:  # noqa: BLE001 - any failure must leave the event for a retry
                event.last_error = type(error).__name__[:60]
                if event.attempts >= MAX_ATTEMPTS:
                    event.status = EventStatus.FAILED.value
                    result["failed"] += 1
                    logger.error("billing_event_failed", extra={"event_id": event.id, "type": event.type})
                else:
                    delay = RETRY_MINUTES[min(event.attempts - 1, len(RETRY_MINUTES) - 1)]
                    event.next_attempt_at = utcnow() + timedelta(minutes=delay)
                    result["retry"] += 1
                    logger.warning("billing_event_retry", extra={"event_id": event.id, "type": event.type})
            else:
                event.status = EventStatus.PROCESSED.value
                event.processed_at = utcnow()
                event.last_error = None
                result["processed"] += 1
            db.commit()
    return result


def reconcile(gateway: Gateway | None = None, since_hours: int = 72) -> dict[str, int]:
    """Catch what webhooks missed: fetch recent events, re-read every live subscription, end old grace."""
    settings = get_settings()
    active = gateway or get_gateway()
    since = int((utcnow() - timedelta(hours=since_hours)).timestamp())
    result = {"events_added": 0, "subscriptions": 0, "duplicates": 0, "errors": 0}
    with get_sessionmaker()() as db:
        for event in active.list_events(sorted(HANDLED), since):
            added = db.execute(
                insert(BillingEvent)
                .values(
                    id=event["id"], type=event["type"], object_id=event["data"]["object"]["id"], received_at=utcnow()
                )
                .on_conflict_do_nothing()
                .returning(BillingEvent.id)
            ).scalar()
            result["events_added"] += 1 if added else 0
        db.commit()
        rows = db.scalars(
            select(BillingSubscription.stripe_subscription_id).where(
                BillingSubscription.status.notin_(("canceled", "incomplete_expired"))
            )
        ).all()
        for subscription_id in rows:
            try:
                with db.begin_nested():
                    sync_subscription(db, settings, active, subscription_id)
                result["subscriptions"] += 1
            except Exception:  # noqa: BLE001 - one bad row must not stop the rest
                result["errors"] += 1
                logger.warning("billing_reconcile_failed")
        db.commit()
        duplicates = db.execute(
            select(BillingSubscription.workspace_id)
            .where(BillingSubscription.status.in_(("active", "trialing", "past_due")))
            .group_by(BillingSubscription.workspace_id)
            .having(func.count() > 1)
        ).all()
        result["duplicates"] = len(duplicates)
        if duplicates:
            logger.error("billing_duplicate_subscriptions", extra={"count": len(duplicates)})
    process_pending(active)
    return result


def status_for(db: Session, workspace_id: uuid.UUID) -> dict[str, Any]:
    subscriptions = db.scalars(
        select(BillingSubscription).where(BillingSubscription.workspace_id == workspace_id)
    ).all()
    purchases = db.scalars(select(BillingPurchase).where(BillingPurchase.workspace_id == workspace_id)).all()
    return {
        "subscriptions": [
            {
                "offer": s.offer_key,
                "status": s.status,
                "cancel_at_period_end": s.cancel_at_period_end,
                "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
                "action_required": s.action_required,
                "onboarding_status": s.onboarding_status,
            }
            for s in subscriptions
        ],
        "purchases": [
            {
                "offer": p.offer_key,
                "payment_status": p.payment_status,
                "access_active": p.access_active,
                "onboarding_status": p.onboarding_status,
            }
            for p in purchases
        ],
        "has_customer": db.get(BillingCustomer, workspace_id) is not None,
    }


def public_offers(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(BillingOffer).where(BillingOffer.approved_at.is_not(None)).order_by(BillingOffer.key)
    ).all()
    return [
        {
            "key": r.key,
            "kind": r.kind,
            "plan": r.plan_key,
            "interval": r.billing_interval,
            "currency": r.currency,
            "amount_minor": r.amount_minor,
            "requires_scope": r.requires_scope,
        }
        for r in rows
    ]
