"""Advisor pipeline: screen input → provider → validate → sanitise → (optionally) store.

Logs contain only categorical metadata and counters — never the description, the prompt or
the generated text.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.advisor.prompt import PROMPT_VERSION, AdvisorPromptInput
from app.advisor.safety import sanitize_assessment, screen_text
from app.advisor.schemas import (
    AdvisorAssessmentSummary,
    AdvisorRequest,
    AdvisorResponse,
    AutomationAssessment,
)
from app.ai.base import AIProvider, AIProviderError
from app.config import Settings
from app.models import AdvisorAssessment, AdvisorMode, utcnow

logger = logging.getLogger(__name__)

DEMO_DISCLAIMER = (
    "Демонстрационен режим: този резултат е съставен автоматично от предварително написани шаблони и "
    "прости правила според вашите отговори. Той не е анализ, генериран от изкуствен интелект, и не "
    "отчита особеностите на вашия бизнес."
)
AI_DISCLAIMER = (
    "Тази оценка е генерирана от AI модел въз основа само на въведената от вас информация. Тя е "
    "ориентировъчна, може да съдържа неточности и не е оферта. Не съдържа и не гарантира прогнози за "
    "спестявания или възвръщаемост. Системата не е изпълнила никакви действия във вашите системи."
)
NOTICE_INJECTION = (
    "Описанието съдържаше текст, който прилича на инструкции към AI система. Той беше третиран само "
    "като данни и не промени правилата на оценката."
)
NOTICE_PERSONAL_DATA = "Имейл адреси и телефонни номера бяха премахнати от описанието, преди то да бъде обработено."
NOTICE_LINKS = "Връзките бяха премахнати от описанието, преди то да бъде обработено."
NOTICE_CLAIMS = (
    "Част от генерирания текст беше премахната, защото съдържаше прогнози за спестявания, приходи или "
    "възвръщаемост, които не могат да бъдат обосновани без анализ на реални данни."
)
NOTICE_APPROVALS = (
    "Стъпки, които биха изпратили съобщения, плащания или промени към външни системи, бяха маркирани "
    "като изискващи човешко одобрение."
)


class AdvisorError(Exception):
    def __init__(self, kind: str) -> None:
        super().__init__(kind)
        self.kind = kind


def mode_for(provider: AIProvider) -> AdvisorMode:
    return AdvisorMode.DEMO if provider.name == "mock" else AdvisorMode.AI


def disclaimer_for(mode: AdvisorMode) -> str:
    return DEMO_DISCLAIMER if mode is AdvisorMode.DEMO else AI_DISCLAIMER


def create_assessment(
    db: Session, settings: Settings, provider: AIProvider, request: AdvisorRequest
) -> AdvisorResponse:
    started = time.perf_counter()
    description = screen_text(request.process_description)
    other_tools = screen_text(request.other_tools) if request.other_tools else None
    injection = description.injection_suspected or bool(other_tools and other_tools.injection_suspected)
    prompt_input = AdvisorPromptInput(
        business_type=request.business_type,
        process_description=description.text,
        monthly_volume=request.monthly_volume,
        team_size=request.team_size,
        tools=tuple(request.tools),
        other_tools=other_tools.text if other_tools else "",
        injection_suspected=injection,
    )
    mode = mode_for(provider)
    log_meta = {
        "mode": mode.value,
        "provider": provider.name,
        "business_type": request.business_type.value,
        "monthly_volume": request.monthly_volume.value,
        "team_size": request.team_size.value,
        "tools_count": len(request.tools),
        "description_chars": len(request.process_description),
        "injection_suspected": injection,
    }

    try:
        draft = provider.assess_automation(prompt_input)
    except AIProviderError as exc:
        logger.warning("advisor_provider_error", extra={**log_meta, "kind": exc.kind, "duration_ms": _ms(started)})
        raise AdvisorError(exc.kind) from exc

    try:
        assessment = AutomationAssessment.model_validate(draft.data)
    except ValidationError as exc:
        logger.warning(
            "advisor_output_invalid",
            extra={**log_meta, "errors": len(exc.errors()), "duration_ms": _ms(started)},
        )
        raise AdvisorError("invalid_output") from exc

    assessment, report = sanitize_assessment(assessment)

    notices: list[str] = []
    if injection:
        notices.append(NOTICE_INJECTION)
    if description.personal_data_removed:
        notices.append(NOTICE_PERSONAL_DATA)
    if description.links_removed:
        notices.append(NOTICE_LINKS)
    if report.claims_removed:
        notices.append(NOTICE_CLAIMS)
    if report.approvals_enforced:
        notices.append(NOTICE_APPROVALS)

    now = utcnow()
    row: AdvisorAssessment | None = None
    if request.save_assessment:
        row = AdvisorAssessment(
            id=uuid.uuid4(),
            created_at=now,
            expires_at=now + timedelta(days=settings.advisor_retention_days),
            business_type=request.business_type.value,
            monthly_volume=request.monthly_volume.value,
            team_size=request.team_size.value,
            tools=[t.value for t in request.tools],
            process_description=description.text,
            result=assessment.model_dump(),
            mode=mode.value,
            provider=draft.provider,
            model=draft.model[:64],
            prompt_version=PROMPT_VERSION,
            injection_suspected=injection,
        )
        db.add(row)
        db.commit()

    logger.info(
        "advisor_assessment_created",
        extra={
            **log_meta,
            "model": draft.model,
            "stored": row is not None,
            "claims_removed": report.claims_removed,
            "links_removed": report.links_removed,
            "approvals_enforced": report.approvals_enforced,
            "duration_ms": _ms(started),
        },
    )
    return AdvisorResponse(
        assessment_id=row.id if row else None,
        reference=row.reference if row else None,
        mode=mode.value,
        provider=draft.provider,
        model=draft.model,
        disclaimer=disclaimer_for(mode),
        notices=notices,
        stored=row is not None,
        expires_at=row.expires_at if row else None,
        created_at=now,
        assessment=assessment,
    )


def link_to_lead(db: Session, assessment_id: uuid.UUID, lead_id: uuid.UUID) -> bool:
    """Attach a stored, unexpired, not yet linked assessment to a new lead (same transaction)."""
    row = db.get(AdvisorAssessment, assessment_id, with_for_update=True)
    if row is None or row.lead_id is not None or row.expires_at <= utcnow():
        return False
    row.lead_id = lead_id
    row.linked_at = utcnow()
    return True


def summary_for_lead(db: Session, lead_id: uuid.UUID) -> AdvisorAssessmentSummary | None:
    row = db.scalar(
        select(AdvisorAssessment).where(AdvisorAssessment.lead_id == lead_id).order_by(AdvisorAssessment.created_at)
    )
    if row is None:
        return None
    return AdvisorAssessmentSummary(
        id=row.id,
        reference=row.reference,
        mode=row.mode,
        created_at=row.created_at,
        business_type=row.business_type,
        monthly_volume=row.monthly_volume,
        team_size=row.team_size,
        tools=row.tools,
        assessment=AutomationAssessment.model_validate(row.result),
    )


@dataclass(frozen=True)
class AdvisorRetention:
    due: int
    deleted: int


def _expired(now: datetime):
    return (AdvisorAssessment.expires_at < now) & AdvisorAssessment.lead_id.is_(None)


def count_expired(db: Session, now: datetime | None = None) -> int:
    now = now or utcnow()
    return db.scalar(select(func.count()).select_from(AdvisorAssessment).where(_expired(now))) or 0


def purge_expired(db: Session, *, dry_run: bool = False, now: datetime | None = None) -> AdvisorRetention:
    """Delete expired assessments that were never linked to a lead. Linked ones follow the lead."""
    now = now or utcnow()
    due = count_expired(db, now)
    if dry_run or not due:
        return AdvisorRetention(due, 0)
    deleted = db.execute(delete(AdvisorAssessment).where(_expired(now))).rowcount or 0
    db.commit()
    return AdvisorRetention(due, deleted)


def _ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)
