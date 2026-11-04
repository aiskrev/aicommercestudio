"""The single place that creates accounting documents (docs/INVOICING.md).

Only the configured issuer issues; Stripe's own invoices and receipts are payment records here, not our
accounting documents. A payment queues a document and the worker issues it, so an unavailable system
only delays it and shows as a status. No rate, number or rule is invented: numbers come from the
issuer, tax from a confirmed `tax_scenarios` row, and an unknown case is blocked with a staff signal.
"""

from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import timedelta
from typing import Any, Protocol

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings, get_settings
from app.db import get_sessionmaker
from app.invoicing.models import (
    AccountingDocument,
    BillingProfile,
    DocumentKind,
    DocumentStatus,
    TaxScenario,
)
from app.models import utcnow

logger = logging.getLogger(__name__)

# fmt: off
EU = frozenset({
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
    "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
})
# fmt: on
RETRY_MINUTES = (1, 5, 30, 120, 720)
MAX_ATTEMPTS = 10


class TaxNotConfirmed(Exception):
    def __init__(self, scenario: str) -> None:
        super().__init__(scenario)
        self.scenario = scenario


class ProfileMissing(Exception):
    pass


class IssuerUnavailable(Exception):
    pass


class Issuer(Protocol):
    name: str
    demo: bool

    def issue(self, document: AccountingDocument) -> tuple[str, str]: ...


class DemoIssuer:
    """Demonstration only: never a real document. Production refuses to start with it."""

    name = "demo"
    demo = True

    def issue(self, document: AccountingDocument) -> tuple[str, str]:
        reference = document.id.hex[:10].upper()
        return f"DEMO-{reference}", f"demo_{reference}"


def get_issuer(settings: Settings | None = None) -> Issuer | None:
    return DemoIssuer() if (settings or get_settings()).invoicing_source == "demo" else None


def scenario_key(profile: BillingProfile) -> str:
    """A label to look a confirmed answer up by. It decides nothing about tax."""
    if profile.country == "BG":
        return "domestic"
    if profile.country in EU:
        return "eu_business" if profile.vat_id else "eu_consumer"
    return "outside_eu"


def tax_for(db: Session, profile: BillingProfile) -> TaxScenario | None:
    return db.get(TaxScenario, scenario_key(profile))


def require_sale_allowed(db: Session, settings: Settings, workspace_id: uuid.UUID) -> None:
    """Called before Checkout. An unconfirmed scenario stops that sale and tells staff why."""
    if not settings.invoicing_enforce_tax:
        return
    profile = db.get(BillingProfile, workspace_id)
    if profile is None:
        raise ProfileMissing
    if tax_for(db, profile) is None:
        scenario = scenario_key(profile)
        logger.error("tax_scenario_unconfirmed", extra={"scenario": scenario})
        audit.record(db, "invoicing.tax_scenario_missing", entity_type="tax_scenario", entity_id=scenario)
        db.commit()
        raise TaxNotConfirmed(scenario)


def _buyer(profile: BillingProfile | None) -> dict[str, Any]:
    if profile is None:
        return {}
    return {
        "legal_name": profile.legal_name,
        "company_id": profile.company_id,
        "vat_id": profile.vat_id,
        "address": profile.address,
        "country": profile.country,
        "email": profile.email,
    }


def enqueue(
    db: Session,
    *,
    workspace_id: uuid.UUID,
    source_key: str,
    kind: DocumentKind,
    amount_minor: int,
    currency: str,
    description: str,
    payment_ref: str | None = None,
    stripe_invoice_id: str | None = None,
    refund_ref: str | None = None,
    parent_id: uuid.UUID | None = None,
) -> None:
    """Queue a document once per cause. The buyer and tax are copied now, at the moment of the sale."""
    profile = db.get(BillingProfile, workspace_id)
    scenario = tax_for(db, profile) if profile else None
    db.execute(
        insert(AccountingDocument)
        .values(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            kind=kind.value,
            status=DocumentStatus.QUEUED.value,
            source_key=source_key,
            parent_id=parent_id,
            stripe_payment_ref=payment_ref,
            stripe_invoice_id=stripe_invoice_id,
            stripe_refund_ref=refund_ref,
            currency=currency,
            amount_minor=amount_minor,
            description=description,
            buyer=_buyer(profile),
            tax={"scenario": scenario.key, **scenario.config} if scenario else {},
            attempts=0,
            demo=False,
            next_attempt_at=utcnow(),
            created_at=utcnow(),
        )
        .on_conflict_do_nothing(index_elements=["source_key"])
    )


def parent_for(db: Session, payment_ref: str | None, stripe_invoice_id: str | None) -> AccountingDocument | None:
    query = select(AccountingDocument).where(AccountingDocument.kind == DocumentKind.INVOICE.value)
    if stripe_invoice_id:
        return db.scalar(query.where(AccountingDocument.stripe_invoice_id == stripe_invoice_id))
    if payment_ref:
        return db.scalar(query.where(AccountingDocument.stripe_payment_ref == payment_ref))
    return None


def credited_so_far(db: Session, charge_id: str) -> int:
    total = db.scalar(
        select(func.coalesce(func.sum(AccountingDocument.amount_minor), 0)).where(
            AccountingDocument.kind == DocumentKind.CREDIT_NOTE.value,
            AccountingDocument.stripe_refund_ref == charge_id,
        )
    )
    return int(total or 0)


def _problem(document: AccountingDocument) -> str | None:
    if not document.buyer:
        return "billing_profile_missing"
    if not document.tax:
        return "tax_not_confirmed"
    if document.kind == DocumentKind.CREDIT_NOTE.value and document.parent_id is None:
        return "parent_invoice_unknown"
    return None


def issue_pending(issuer: Issuer | None = None, limit: int = 50) -> dict[str, int]:
    """Safe to run from several processes: each row is claimed with SKIP LOCKED."""
    settings = get_settings()
    active = issuer or get_issuer(settings)
    result = {"issued": 0, "retry": 0, "failed": 0, "blocked": 0}
    for _ in range(limit):
        with get_sessionmaker()() as db:
            document = db.scalar(
                select(AccountingDocument)
                .where(
                    AccountingDocument.status == DocumentStatus.QUEUED.value,
                    AccountingDocument.next_attempt_at <= utcnow(),
                )
                .order_by(AccountingDocument.created_at)
                .limit(1)
                .with_for_update(skip_locked=True)
            )
            if document is None:
                return result
            problem = "no_issuer_configured" if active is None else _problem(document)
            if problem:
                document.status = DocumentStatus.BLOCKED.value
                document.last_error = problem
                result["blocked"] += 1
                logger.error("document_blocked", extra={"document_id": str(document.id), "reason": problem})
                db.commit()
                continue
            document.attempts += 1
            try:
                number, reference = active.issue(document)
            except IssuerUnavailable:
                document.last_error = "issuer_unavailable"
                if document.attempts >= MAX_ATTEMPTS:
                    document.status = DocumentStatus.FAILED.value
                    result["failed"] += 1
                else:
                    delay = RETRY_MINUTES[min(document.attempts - 1, len(RETRY_MINUTES) - 1)]
                    document.next_attempt_at = utcnow() + timedelta(minutes=delay)
                    result["retry"] += 1
                logger.warning("document_issue_failed", extra={"document_id": str(document.id)})
                db.commit()
                continue
            document.number = number
            document.provider = active.name
            document.provider_document_id = reference
            document.demo = active.demo
            document.issued_at = utcnow()
            document.last_error = None
            if settings.accounting_retention_years:
                today = utcnow().date()
                document.retain_until = today.replace(year=today.year + settings.accounting_retention_years)
            document.status = DocumentStatus.ISSUED.value
            result["issued"] += 1
            db.commit()
    return result


def release_blocked(db: Session, reason: str) -> int:
    """After the missing piece is fixed, put blocked documents back in the queue."""
    rows = db.scalars(
        select(AccountingDocument).where(
            AccountingDocument.status == DocumentStatus.BLOCKED.value, AccountingDocument.last_error == reason
        )
    ).all()
    for row in rows:
        row.status = DocumentStatus.QUEUED.value
        row.next_attempt_at = utcnow()
    return len(rows)


def present(document: AccountingDocument) -> dict[str, Any]:
    return {
        "id": str(document.id),
        "kind": document.kind,
        "status": document.status,
        "number": document.number,
        "demo": document.demo,
        "reason": document.last_error,
        "amount_minor": document.amount_minor,
        "currency": document.currency,
        "description": document.description,
        "created_at": document.created_at.isoformat(),
        "issued_at": document.issued_at.isoformat() if document.issued_at else None,
        "parent_id": str(document.parent_id) if document.parent_id else None,
    }


def render(document: AccountingDocument) -> str:
    """A plain copy built only from what was stored at issue time."""
    lines = []
    if document.demo:
        lines += ["DEMONSTRATION DOCUMENT. NOT A VALID ACCOUNTING DOCUMENT.", ""]
    lines += [
        f"{document.kind}: {document.number}",
        f"Date: {document.issued_at.date().isoformat()}",
        f"Buyer: {document.buyer.get('legal_name')}",
        f"Address: {document.buyer.get('address')}, {document.buyer.get('country')}",
        f"Item: {document.description}",
        f"Amount: {document.amount_minor / 100:.2f} {document.currency.upper()}",
    ]
    return "\n".join(lines) + "\n"


def export_csv(rows: list[AccountingDocument]) -> str:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        ["number", "kind", "status", "demo", "issued_at", "buyer", "vat_id", "country", "amount", "currency",
         "scenario", "stripe_payment", "stripe_invoice", "stripe_refund", "parent_id"]
    )  # fmt: skip
    for row in rows:
        writer.writerow(
            [
                row.number,
                row.kind,
                row.status,
                row.demo,
                row.issued_at.isoformat() if row.issued_at else "",
                row.buyer.get("legal_name"),
                row.buyer.get("vat_id"),
                row.buyer.get("country"),
                f"{row.amount_minor / 100:.2f}",
                row.currency,
                row.tax.get("scenario"),
                row.stripe_payment_ref,
                row.stripe_invoice_id,
                row.stripe_refund_ref,
                row.parent_id,
            ]
        )
    return out.getvalue()
