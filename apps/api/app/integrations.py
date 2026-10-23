"""Integration contracts and configuration status for future connectors.

V1 does not call any external platform. The protocols below define the boundary that
future Shopify / WooCommerce / CRM adapters must implement; write operations on them
must be routed through `app.services.ai_actions` when initiated by an AI agent.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from app.config import Settings


class CommercePlatform(Protocol):
    """Read operations are safe; write operations require an approved AIActionRequest."""

    def list_products(self, limit: int = 50) -> list[dict[str, Any]]: ...

    def get_order(self, order_id: str) -> dict[str, Any] | None: ...

    def update_product(self, product_id: str, changes: dict[str, Any], approval_id: str) -> None: ...


class CRMConnector(Protocol):
    def upsert_contact(self, contact: dict[str, Any], approval_id: str) -> str: ...


@dataclass(frozen=True)
class IntegrationInfo:
    key: str
    label: str
    configured: bool
    note: str


_PREPARED = "Подготвен интерфейс; не се извършват заявки във V1"


def integration_status(settings: Settings) -> list[IntegrationInfo]:
    anthropic_ready = settings.ai_provider == "anthropic" and bool(settings.anthropic_api_key)
    return [
        IntegrationInfo(
            "ai",
            "AI доставчик",
            True,
            "Anthropic Claude (активен)" if anthropic_ready else "Локален mock доставчик — без външни заявки",
        ),
        IntegrationInfo(
            "email",
            "Имейл известия",
            settings.email_enabled,
            "SMTP е конфигуриран" if settings.email_enabled else "Не е конфигуриран — имейли не се изпращат",
        ),
        IntegrationInfo(
            "shopify",
            "Shopify Admin API",
            bool(settings.shopify_store_domain and settings.shopify_admin_api_token),
            _PREPARED,
        ),
        IntegrationInfo(
            "woocommerce",
            "WooCommerce REST API",
            bool(
                settings.woocommerce_url
                and settings.woocommerce_consumer_key
                and settings.woocommerce_consumer_secret
            ),
            _PREPARED,
        ),
        IntegrationInfo("crm", "CRM", bool(settings.crm_provider), _PREPARED),
        IntegrationInfo(
            "automation",
            "Workflow автоматизации (webhook)",
            bool(settings.automation_webhook_url),
            _PREPARED,
        ),
        IntegrationInfo(
            "seo",
            "SEO доставчик на данни",
            bool(settings.seo_data_provider),
            _PREPARED,
        ),
    ]
