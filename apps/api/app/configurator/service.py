"""Project configurator: the review as a response, and the quote request as a lead."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app import audit, pricing
from app.config import Settings
from app.configurator import model
from app.configurator.schemas import (
    BandOut,
    HumanReviewOut,
    ItemOut,
    ReviewOut,
    SubmissionCreate,
    TotalsOut,
)
from app.models import InquiryType, Lead, LeadStatus, utcnow
from app.services.leads import CONFIGURATOR_SOURCE

KIND = "project_configurator"

_MESSAGE = {
    "bg": "Запитване от конфигуратора на проект: {package}. Ориентирът не е оферта и се преглежда от човек.",
    "en": "Enquiry from the project configurator: {package}. The estimate is not a quote and is reviewed by a person.",
}
_LABELS = {
    "bg": {"goals": "Цели", "special": "Специални изисквания"},
    "en": {"goals": "Goals", "special": "Special requirements"},
}


def review_out(result: model.Review) -> ReviewOut:
    schedule = pricing.schedule()
    return ReviewOut(
        model_version=model.MODEL_VERSION,
        schedule_version=schedule.version,
        currency=schedule.currency,
        owner_approval=schedule.owner_approval,
        tax_treatment=schedule.tax_treatment,
        package=result.package,
        service=result.service,
        delivery=result.delivery,  # type: ignore[arg-type]
        items=[
            ItemOut(
                kind=item.kind,  # type: ignore[arg-type]
                key=item.key,
                reason=item.reason,
                band=BandOut(unit=item.band.unit, from_=item.band.from_, typical=item.band.typical)
                if item.band
                else None,
            )
            for item in result.items
        ],
        included=list(result.included),
        unpriced=list(result.unpriced),
        assumptions=list(result.assumptions),
        exclusions=list(result.exclusions),
        totals=TotalsOut(
            one_time_from=result.one_time_from,
            monthly_from=result.monthly_from,
            primary_priced=result.primary_priced,
        ),
        human_review=HumanReviewOut(reasons=list(result.review_reasons)),
    )


def find_submission(db: Session, submission_id: str) -> Lead | None:
    """The lead an earlier request with the same submission id created, if any."""
    return db.scalar(
        select(Lead)
        .where(Lead.source == CONFIGURATOR_SOURCE, Lead.service_details["submission_id"].astext == submission_id)
        .limit(1)
    )


def create_submission(
    db: Session,
    data: SubmissionCreate,
    result: model.Review,
    settings: Settings,
    *,
    ip_hash: str | None,
) -> tuple[Lead, bool]:
    """Creates the lead once per submission id. Returns (lead, created).

    The review stored with the lead is the one computed here from the validated answers; nothing the browser
    displayed (and no amount it could send) is stored. A transaction-scoped advisory lock on the submission id
    makes two simultaneous requests wait for each other, so a double click cannot create two leads.
    """
    submission_id = str(data.submission_id)
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": f"configurator:{submission_id}"})
    existing = find_submission(db, submission_id)
    if existing:
        db.commit()  # releases the lock
        return existing, False

    now = utcnow()
    locale = data.locale.value
    answers = data.answers.to_model()
    stored_review: dict[str, Any] = review_out(result).model_dump(mode="json", by_alias=True)
    parts = [_MESSAGE[locale].format(package=result.package)]
    if data.goals:
        parts.append(f"{_LABELS[locale]['goals']}: {data.goals}")
    if data.special_requirements:
        parts.append(f"{_LABELS[locale]['special']}: {data.special_requirements}")

    lead = Lead(
        service=result.service,
        submitted_service=result.service,
        inquiry_type=InquiryType.QUOTE.value,
        budget_range=answers.budget_range,
        timeline=answers.timeline,
        locale=locale,
        service_details={
            "kind": KIND,
            "model_version": model.MODEL_VERSION,
            "submission_id": submission_id,
            "answers": {
                **{name: getattr(answers, name) for name in answers.__dataclass_fields__},
                "features": list(answers.features),
                "operations": list(answers.operations),
            },
            "review": stored_review,
        },
        name=data.name,
        company=data.company,
        email=data.email,
        phone=data.phone or None,
        message="\n\n".join(parts),
        status=LeadStatus.NEW.value,
        source=CONFIGURATOR_SOURCE,
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
    audit.record(
        db,
        "lead.created",
        actor_label="website",
        entity_type="lead",
        entity_id=str(lead.id),
        details={
            "service": lead.service,
            "inquiry_type": lead.inquiry_type,
            "source": CONFIGURATOR_SOURCE,
            "marketing_consent": lead.marketing_consent,
            "package": result.package,
            "unpriced": len(result.unpriced),
            "locale": locale,
        },
        ip_hash=ip_hash,
    )
    db.commit()
    return lead, True
