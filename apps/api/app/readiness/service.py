"""Readiness submissions: score on the server and hand the result to the team as a lead.

Privacy design (docs/READINESS_REPORTS.md):
* Scoring and the PDF report need no personal data and store nothing.
* A submission is the visitor's explicit request to send their results to the team. It creates a
  lead (source `readiness_assessment`) holding the contact details and, in `service_details`, the
  answer levels and the server-computed result — never browser-supplied result text.
* Logs carry only the lead reference, band and model version — never answers or personal data.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app import audit
from app.models import InquiryType, Lead, LeadStatus, ServiceKey, utcnow
from app.readiness.schemas import SCHEMA_VERSION, ReadinessAnswersIn, ReadinessSubmissionCreate
from app.readiness.scoring import MODEL_VERSION, ReadinessResult, score
from app.readiness.texts import TEXTS
from app.services.leads import READINESS_SOURCE

logger = logging.getLogger(__name__)

_MESSAGE = {
    "bg": "Оценка на AI готовността: {overall}/100 ({band}). Заявена консултация: {consultation}. Роля: {role}.",
    "en": "AI readiness assessment: {overall}/100 ({band}). Consultation requested: {consultation}. Role: {role}.",
}
_YES_NO = {"bg": ("да", "не"), "en": ("yes", "no")}


def score_request(payload: ReadinessAnswersIn) -> ReadinessResult:
    """Server-side score; a different browser result is logged (never trusted) as a consistency signal."""
    result = score(payload.answers)
    if payload.client_overall is not None and payload.client_overall != result.overall:
        logger.warning(
            "readiness_score_mismatch",
            extra={"client": payload.client_overall, "server": result.overall, "model_version": MODEL_VERSION},
        )
    return result


def create_submission(
    db: Session,
    data: ReadinessSubmissionCreate,
    result: ReadinessResult,
    *,
    privacy_notice_version: str,
    marketing_consent_version: str,
    ip_hash: str | None,
) -> Lead:
    now = utcnow()
    locale = data.locale.value
    band_title = TEXTS[locale]["bands"][result.band][0]
    yes, no = _YES_NO[locale]
    summary = _MESSAGE[locale].format(
        overall=result.overall, band=band_title, consultation=yes if data.consultation_requested else no, role=data.role
    )
    message = f"{summary}\n\n{data.message}".strip() if data.message else summary
    lead = Lead(
        service=ServiceKey.AUDIT.value,
        submitted_service=ServiceKey.AUDIT.value,
        inquiry_type=InquiryType.CONTACT.value,
        locale=locale,
        service_details={
            "kind": "readiness",
            "schema_version": SCHEMA_VERSION,
            "model_version": MODEL_VERSION,
            "role": data.role,
            "consultation_requested": data.consultation_requested,
            "answers": dict(data.answers),
            "result": result.summary(),
        },
        name=data.name,
        company=data.company,
        email=data.email,
        message=message,
        status=LeadStatus.NEW.value,
        source=READINESS_SOURCE,
        privacy_acknowledged_at=now,
        privacy_notice_version=privacy_notice_version,
        marketing_consent=data.marketing_consent,
        marketing_consent_at=now if data.marketing_consent else None,
        marketing_consent_version=marketing_consent_version if data.marketing_consent else None,
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
            "source": READINESS_SOURCE,
            "marketing_consent": lead.marketing_consent,
            "consultation_requested": data.consultation_requested,
            "band": result.band,
            "locale": locale,
        },
        ip_hash=ip_hash,
    )
    db.commit()
    return lead
