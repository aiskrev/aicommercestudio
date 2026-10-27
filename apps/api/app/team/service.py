"""AI team configurator: plans with cost estimates, saved configurations and consultation requests.

Privacy design (docs/TEAM_CONFIGURATOR.md):
* A plan, an estimate and a PDF need no personal data and store nothing.
* A saved configuration holds enumerated values only (never the custom department name). It is
  retrieved with a secret link token of which only the SHA-256 hash is stored; unlinked rows expire.
* A consultation request is the visitor's explicit request: it creates a lead (source
  `team_configurator`) plus a configuration row linked to it, deleted together with the lead.
* Logs carry references, enumerations and counts only.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import audit
from app.config import Settings
from app.models import InquiryType, Lead, LeadStatus, ServiceKey, TeamConfiguration, utcnow
from app.services.leads import TEAM_SOURCE
from app.team import costs
from app.team.model import AGENT_KEYS, MODEL_VERSION, TeamConfig, complexity, selected_agents, summary
from app.team.plan import data_flows, security_considerations
from app.team.schemas import SCHEMA_VERSION, TeamRequest, TeamSubmissionCreate

_MESSAGE = {
    "bg": (
        "AI екип: {agents} агента, сложност {band}. "
        "Ориентировъчно: еднократно {one_time} €, месечно {monthly} € (очакван сценарий)."
    ),
    "en": (
        "AI team: {agents} agents, {band} complexity. "
        "Indicative: one-time EUR {one_time}, monthly EUR {monthly} (expected scenario)."
    ),
}


def assumptions(settings: Settings) -> dict[str, Any]:
    return costs.load_assumptions(settings.team_cost_assumptions_file)


def assumptions_for_version(settings: Settings, version: str) -> dict[str, Any]:
    """The document a stored configuration was priced with, if it is still available; else the current one."""
    current = assumptions(settings)
    if version == current["version"]:
        return current
    archived = costs.PRICING_DIR / f"{Path(version).name}.json"
    if archived.is_file():
        try:
            return costs.load_assumptions(str(archived))
        except costs.AssumptionsError:
            return current
    return current


def build_plan(config: TeamConfig, doc: dict[str, Any], overrides: dict[str, float]) -> dict[str, Any]:
    return {
        "model_version": MODEL_VERSION,
        "summary": summary(config),
        "security": security_considerations(config),
        "data_flows": data_flows(config),
        "estimate": costs.estimate(config, doc, overrides),
    }


def _stored_config(config: TeamConfig) -> dict[str, Any]:
    """Data minimisation: keep settings only for agents that are actually in the team."""
    data = config.to_dict()
    team = set(selected_agents(config))
    data["agents"] = {k: v for k, v in data["agents"].items() if k in team}
    return data


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def save_configuration(db: Session, payload: TeamRequest, settings: Settings) -> tuple[TeamConfiguration, str]:
    now = utcnow()
    token = secrets.token_urlsafe(32)
    row = TeamConfiguration(
        created_at=now,
        expires_at=now + timedelta(days=settings.team_configuration_retention_days),
        token_hash=hash_token(token),
        schema_version=SCHEMA_VERSION,
        model_version=MODEL_VERSION,
        assumptions_version=assumptions(settings)["version"],
        locale=payload.locale.value,
        config=_stored_config(payload.config.to_model()),
        overrides=payload.applied_overrides(),
    )
    db.add(row)
    db.commit()
    return row, token


def find_configuration(db: Session, token: str) -> TeamConfiguration | None:
    if not token or len(token) > 100:
        return None
    row = db.scalar(select(TeamConfiguration).where(TeamConfiguration.token_hash == hash_token(token)))
    if row is None or row.lead_id is not None or row.expires_at <= utcnow():
        return None
    return row


def config_from_row(row: TeamConfiguration) -> TeamConfig:
    data = row.config
    return TeamConfig(
        context=dict(data["context"]),
        departments=list(data["departments"]),
        chosen=[a for a in data["chosen"] if a in AGENT_KEYS],
        agents={k: dict(v) for k, v in data.get("agents", {}).items()},
        deployment=data.get("deployment"),
        operations=data.get("operations"),
    )


def create_submission(
    db: Session,
    data: TeamSubmissionCreate,
    settings: Settings,
    *,
    ip_hash: str | None,
) -> tuple[Lead, dict[str, Any]]:
    now = utcnow()
    locale = data.locale.value
    config = data.config.to_model()
    doc = assumptions(settings)
    overrides = data.applied_overrides()
    estimate = costs.estimate(config, doc, overrides)
    expected = estimate["scenarios"]["expected"]
    team = selected_agents(config)
    level = complexity(config)
    summary_text = _MESSAGE[locale].format(
        agents=len(team),
        band=level["band"],
        one_time=expected["one_time"]["total"],
        monthly=expected["monthly"]["total"],
    )
    lead = Lead(
        service=ServiceKey.AI_AGENTS.value,
        submitted_service=ServiceKey.AI_AGENTS.value,
        inquiry_type=InquiryType.CONTACT.value,
        locale=locale,
        service_details={
            "kind": "team",
            "schema_version": SCHEMA_VERSION,
            "model_version": MODEL_VERSION,
            "assumptions_version": doc["version"],
            "role": data.role,
            "agents": team,
            "complexity": {"band": level["band"], "points": level["points"]},
            "deployment": config.deployment,
            "operations": config.operations,
            "currency": estimate["currency"],
            "ranges": estimate["ranges"],
            "expected": {"one_time": expected["one_time"]["total"], "monthly": expected["monthly"]["total"]},
        },
        name=data.name,
        company=data.company,
        email=data.email,
        message=f"{summary_text}\n\n{data.message}".strip() if data.message else summary_text,
        status=LeadStatus.NEW.value,
        source=TEAM_SOURCE,
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
    db.add(
        TeamConfiguration(
            created_at=now,
            expires_at=now + timedelta(days=settings.team_lead_retention_days),
            token_hash=None,
            schema_version=SCHEMA_VERSION,
            model_version=MODEL_VERSION,
            assumptions_version=doc["version"],
            locale=locale,
            config=_stored_config(config),
            overrides=overrides,
            lead_id=lead.id,
        )
    )
    audit.record(
        db,
        "lead.created",
        actor_label="website",
        entity_type="lead",
        entity_id=str(lead.id),
        details={
            "service": lead.service,
            "inquiry_type": lead.inquiry_type,
            "source": TEAM_SOURCE,
            "marketing_consent": lead.marketing_consent,
            "agents": len(team),
            "complexity": level["band"],
            "locale": locale,
        },
        ip_hash=ip_hash,
    )
    db.commit()
    return lead, estimate


def configuration_for_lead(db: Session, lead_id: Any) -> TeamConfiguration | None:
    return db.scalar(
        select(TeamConfiguration).where(TeamConfiguration.lead_id == lead_id).order_by(TeamConfiguration.created_at)
    )


@dataclass(frozen=True)
class TeamRetention:
    due: int
    deleted: int


def _expired(now: datetime):
    return (TeamConfiguration.lead_id.is_(None)) & (TeamConfiguration.expires_at <= now)


def count_expired(db: Session, now: datetime | None = None) -> int:
    return db.scalar(select(func.count()).select_from(TeamConfiguration).where(_expired(now or utcnow()))) or 0


def purge_expired(db: Session, *, dry_run: bool = False, now: datetime | None = None) -> TeamRetention:
    """Delete expired saved configurations without a lead. Linked ones follow the lead."""
    now = now or utcnow()
    due = count_expired(db, now)
    if dry_run or not due:
        return TeamRetention(due, 0)
    deleted = db.execute(delete(TeamConfiguration).where(_expired(now))).rowcount or 0
    db.commit()
    return TeamRetention(due, deleted)
