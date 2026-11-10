"""Writes the consent history whenever a lead or an account is created.

One listener per table instead of a call in every place that creates one (contact form, readiness, team, assessments,
solution builder, registration): the acknowledgement and the marketing consent are recorded with the versions the
row already carries. Registered by importing this module (app.main and the CLI do).
"""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import event, insert

from app.accounts.models import CustomerAccount
from app.compliance.models import LegalEvent
from app.models import Lead, utcnow


def _rows(*, subject: str, subject_id, locale, privacy_version, privacy_at, marketing_version, marketing_at, source):
    rows = [
        {
            "document": "privacy",
            "version": privacy_version,
            "action": "acknowledged",
            "created_at": privacy_at or utcnow(),
        }
    ]
    if marketing_at is not None and marketing_version:
        rows.append(
            {
                "document": "marketing_consent",
                "version": marketing_version,
                "action": "consented",
                "created_at": marketing_at,
            }
        )
    return [
        {
            **row,
            subject: subject_id,
            "locale": locale if locale in ("bg", "en") else None,
            "source": source,
        }
        for row in rows
    ]


@event.listens_for(Lead, "after_insert")
def _lead_inserted(mapper, connection, lead: Lead) -> None:
    rows = _rows(
        subject="lead_id",
        subject_id=lead.id,
        locale=lead.locale,
        privacy_version=lead.privacy_notice_version,
        privacy_at=lead.privacy_acknowledged_at,
        marketing_version=lead.marketing_consent_version,
        marketing_at=lead.marketing_consent_at,
        source=(lead.source or "form")[:24],
    )
    connection.execute(insert(LegalEvent.__table__), [{"id": uuid4(), **row} for row in rows])


@event.listens_for(CustomerAccount, "after_insert")
def _account_inserted(mapper, connection, account: CustomerAccount) -> None:
    rows = _rows(
        subject="account_id",
        subject_id=account.id,
        locale=account.locale,
        privacy_version=account.privacy_notice_version,
        privacy_at=account.privacy_acknowledged_at,
        marketing_version=account.marketing_consent_version,
        marketing_at=account.marketing_consent_at,
        source="registration",
    )
    connection.execute(insert(LegalEvent.__table__), [{"id": uuid4(), **row} for row in rows])
