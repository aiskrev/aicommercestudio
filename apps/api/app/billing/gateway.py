"""The only module that talks to Stripe. Tests replace it; nothing else imports `stripe`.

No payment method types are named: hosted Checkout shows what the Dashboard has switched on and what
the customer's device and currency support, so the site never claims a method is available.
"""

from __future__ import annotations

from typing import Any, Protocol

import stripe

from app.config import Settings, get_settings


class GatewayError(Exception):
    pass


class Gateway(Protocol):
    def create_customer(self, workspace_id: str) -> str: ...

    def retrieve_price(self, price_id: str) -> dict[str, Any]: ...

    def create_checkout(self, params: dict[str, Any], idempotency_key: str) -> dict[str, Any]: ...

    def retrieve_checkout(self, session_id: str) -> dict[str, Any]: ...

    def expire_checkout(self, session_id: str) -> None: ...

    def list_subscriptions(self, customer_id: str) -> list[dict[str, Any]]: ...

    def retrieve_subscription(self, subscription_id: str) -> dict[str, Any]: ...

    def retrieve_invoice(self, invoice_id: str) -> dict[str, Any]: ...

    def retrieve_charge(self, charge_id: str) -> dict[str, Any]: ...

    def retrieve_dispute(self, dispute_id: str) -> dict[str, Any]: ...

    def create_portal(self, customer_id: str, return_url: str) -> str: ...

    def list_events(self, types: list[str], since: int) -> list[dict[str, Any]]: ...


class StripeGateway:
    def __init__(self, settings: Settings) -> None:
        self.client = stripe.StripeClient(settings.stripe_secret_key or "", max_network_retries=2)

    def create_customer(self, workspace_id: str) -> str:
        customer = self.client.v1.customers.create(
            {"metadata": {"workspace_id": workspace_id}}, {"idempotency_key": f"customer:{workspace_id}"}
        )
        return customer.id

    def retrieve_price(self, price_id: str) -> dict[str, Any]:
        return self.client.v1.prices.retrieve(price_id).to_dict()

    def create_checkout(self, params: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self.client.v1.checkout.sessions.create(params, {"idempotency_key": idempotency_key}).to_dict()

    def retrieve_checkout(self, session_id: str) -> dict[str, Any]:
        return self.client.v1.checkout.sessions.retrieve(session_id).to_dict()

    def expire_checkout(self, session_id: str) -> None:
        self.client.v1.checkout.sessions.expire(session_id)

    def list_subscriptions(self, customer_id: str) -> list[dict[str, Any]]:
        page = self.client.v1.subscriptions.list({"customer": customer_id, "status": "all", "limit": 100})
        return [item.to_dict() for item in page.data]

    def retrieve_subscription(self, subscription_id: str) -> dict[str, Any]:
        return self.client.v1.subscriptions.retrieve(subscription_id).to_dict()

    def retrieve_invoice(self, invoice_id: str) -> dict[str, Any]:
        return self.client.v1.invoices.retrieve(invoice_id).to_dict()

    def retrieve_charge(self, charge_id: str) -> dict[str, Any]:
        return self.client.v1.charges.retrieve(charge_id).to_dict()

    def retrieve_dispute(self, dispute_id: str) -> dict[str, Any]:
        return self.client.v1.disputes.retrieve(dispute_id).to_dict()

    def create_portal(self, customer_id: str, return_url: str) -> str:
        return self.client.v1.billing_portal.sessions.create({"customer": customer_id, "return_url": return_url}).url

    def list_events(self, types: list[str], since: int) -> list[dict[str, Any]]:
        page = self.client.v1.events.list({"types": types, "created": {"gte": since}, "limit": 100})
        return [item.to_dict() for item in page.data]


def get_gateway() -> Gateway:
    return StripeGateway(get_settings())


def verify_event(payload: bytes, signature: str | None, secret: str) -> dict[str, Any]:
    """Check the signature on the raw body. Raises ValueError for anything Stripe did not sign."""
    try:
        return stripe.Webhook.construct_event(payload, signature or "", secret).to_dict()
    except stripe.SignatureVerificationError as exc:
        raise ValueError("signature") from exc
