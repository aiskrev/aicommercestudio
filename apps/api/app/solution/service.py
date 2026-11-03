"""AI Solution Builder enquiry: a lead with the decoded design attached (only enumerated values)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app import audit
from app.config import Settings
from app.models import InquiryType, Lead, LeadStatus, ServiceKey, utcnow
from app.services.leads import SOLUTION_SOURCE
from app.solution.model import MODEL_VERSION, SolutionConfig, summary
from app.solution.schemas import SolutionEnquiryCreate

_MESSAGE = {
    "bg": (
        "Запитване от конструктора на AI решение: процес {workflow}, {agents} агента, "
        "сложност {band}, одобрение {approval}."
    ),
    "en": (
        "Enquiry from the AI solution builder: workflow {workflow}, {agents} agents, "
        "complexity {band}, approval {approval}."
    ),
}


def create_enquiry(
    db: Session,
    data: SolutionEnquiryCreate,
    config: SolutionConfig,
    settings: Settings,
    *,
    ip_hash: str | None,
) -> Lead:
    """The visitor's explicit request. Everything stored about the design is re-derived from its code."""
    now = utcnow()
    locale = data.locale.value
    design = summary(config)
    band = design["complexity"]["band"]  # type: ignore[index]
    agents = design["agents"]
    summary_text = _MESSAGE[locale].format(
        workflow=config.workflow,
        agents=len(agents),
        band=band,
        approval=config.approval,  # type: ignore[arg-type]
    )
    lead = Lead(
        service=ServiceKey.AI_AGENTS.value,
        submitted_service=ServiceKey.AI_AGENTS.value,
        inquiry_type=InquiryType.CONTACT.value,
        locale=locale,
        service_details={"kind": "solution", "model_version": MODEL_VERSION, "code": data.code, **design},
        name=data.name,
        company=data.company,
        email=data.email,
        message=f"{summary_text}\n\n{data.message}".strip() if data.message else summary_text,
        status=LeadStatus.NEW.value,
        source=SOLUTION_SOURCE,
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
            "source": SOLUTION_SOURCE,
            "marketing_consent": lead.marketing_consent,
            "workflow": config.workflow,
            "agents": len(agents),  # type: ignore[arg-type]
            "complexity": band,
            "locale": locale,
        },
        ip_hash=ip_hash,
    )
    db.commit()
    return lead
