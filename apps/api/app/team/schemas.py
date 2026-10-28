"""Versioned request/response models for the AI team configurator endpoints.

The configuration is enumerated values only (no free text) and is validated strictly: unknown keys,
unknown values, duplicate entries and invalid teams (no task agent, coordinator without work) are
rejected. `model_version` must equal the server's team model so a stale browser bundle cannot save
or price a configuration under different rules.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models import LeadLocale
from app.schemas import _URL_LIKE, StrictModel, _clean_text, _error, _no_secrets
from app.team.costs import OVERRIDE_BOUNDS
from app.team.model import (
    AGENT_KEYS,
    CHALLENGES,
    CHECKPOINTS,
    COMPANY_SIZES,
    DEPARTMENTS,
    DEPLOYMENTS,
    INDUSTRIES,
    INTEGRATIONS,
    MODEL_VERSION,
    OPERATIONS,
    VOLUMES,
    TeamConfig,
    selected_agents,
    selection_issues,
)

SCHEMA_VERSION = "1"

Industry = Literal[INDUSTRIES]
CompanySize = Literal[COMPANY_SIZES]
Department = Literal[DEPARTMENTS]
Challenge = Literal[CHALLENGES]
Volume = Literal[VOLUMES]
Integration = Literal[INTEGRATIONS]
Checkpoint = Literal[CHECKPOINTS]
AgentKey = Literal[AGENT_KEYS]
Deployment = Literal[DEPLOYMENTS]
Operations = Literal[OPERATIONS]


def _unique(values: list[str]) -> list[str]:
    if len(set(values)) != len(values):
        raise _error("team_duplicates", "Стойностите не трябва да се повтарят.")
    return values


class TeamContextIn(StrictModel):
    industry: Industry
    size: CompanySize
    lead_department: Department
    challenge: Challenge
    volume: Volume


class AgentConfigIn(StrictModel):
    volume: Volume
    integrations: list[Integration] = Field(default_factory=list, max_length=len(INTEGRATIONS))
    checkpoint: Checkpoint

    @field_validator("integrations")
    @classmethod
    def _unique_integrations(cls, value: list[str]) -> list[str]:
        return _unique(value)


class TeamConfigIn(StrictModel):
    context: TeamContextIn
    departments: list[Department] = Field(min_length=1, max_length=len(DEPARTMENTS))
    chosen: list[AgentKey] = Field(min_length=1, max_length=len(AGENT_KEYS))
    agents: dict[AgentKey, AgentConfigIn] = Field(default_factory=dict)
    deployment: Deployment
    operations: Operations

    @field_validator("departments", "chosen")
    @classmethod
    def _unique_lists(cls, value: list[str]) -> list[str]:
        return _unique(value)

    @model_validator(mode="after")
    def _team(self) -> TeamConfigIn:
        if selection_issues(selected_agents(self.to_model())):
            raise _error(
                "team_selection", "Екипът трябва да има поне един агент със задачи (координаторът — поне два)."
            )
        return self

    def to_model(self) -> TeamConfig:
        return TeamConfig(
            context=self.context.model_dump(),
            departments=list(self.departments),
            chosen=list(self.chosen),
            agents={k: v.model_dump() for k, v in self.agents.items()},
            deployment=self.deployment,
            operations=self.operations,
        )


class AssumptionOverrides(StrictModel):
    """Visitor-editable rates (bounds: app/team/costs.py OVERRIDE_BOUNDS)."""

    day_rate: float | None = Field(default=None, ge=OVERRIDE_BOUNDS["day_rate"][0], le=OVERRIDE_BOUNDS["day_rate"][1])
    internal_hourly_rate: float | None = Field(
        default=None, ge=OVERRIDE_BOUNDS["internal_hourly_rate"][0], le=OVERRIDE_BOUNDS["internal_hourly_rate"][1]
    )
    price_per_million_input: float | None = Field(
        default=None, ge=OVERRIDE_BOUNDS["price_per_million_input"][0], le=OVERRIDE_BOUNDS["price_per_million_input"][1]
    )
    price_per_million_output: float | None = Field(
        default=None,
        ge=OVERRIDE_BOUNDS["price_per_million_output"][0],
        le=OVERRIDE_BOUNDS["price_per_million_output"][1],
    )

    def applied(self) -> dict[str, float]:
        return {k: v for k, v in self.model_dump().items() if v is not None}


class TeamRequest(StrictModel):
    schema_version: Literal["1"]
    model_version: str = Field(max_length=32)
    locale: LeadLocale = LeadLocale.BG
    config: TeamConfigIn
    overrides: AssumptionOverrides | None = None

    @field_validator("model_version")
    @classmethod
    def _model(cls, value: str) -> str:
        if value != MODEL_VERSION:
            raise _error("team_model", "Конфигурацията е направена с по-стара версия. Моля, презаредете страницата.")
        return value

    def applied_overrides(self) -> dict[str, float]:
        return self.overrides.applied() if self.overrides else {}


class TeamEstimateRequest(TeamRequest):
    """Stateless estimate: nothing is stored."""


class TeamReportRequest(TeamRequest):
    company: str | None = Field(default=None, max_length=120)
    form_token: str = Field(default="", max_length=200)

    @field_validator("company", mode="before")
    @classmethod
    def _company(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        if not isinstance(value, str):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        cleaned = _clean_text(value)
        if _URL_LIKE.search(cleaned):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return cleaned


class TeamSaveRequest(TeamRequest):
    form_token: str = Field(default="", max_length=200)
    # Only explicitly consented configurations are stored (the visitor ticks the box before saving).
    storage_consent: Literal[True]


class TeamSubmissionCreate(TeamRequest):
    """Optional consultation request: configuration plus contact details. Creates a lead."""

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=254)
    company: str = Field(min_length=2, max_length=160)
    role: str = Field(min_length=2, max_length=80)
    message: str = Field(default="", max_length=1000)
    privacy_acknowledged: bool
    marketing_consent: bool = False
    website: str = Field(default="", max_length=200)
    form_token: str = Field(default="", max_length=200)

    @field_validator("name", "company", "role")
    @classmethod
    def _plain(cls, value: str) -> str:
        value = _clean_text(value)
        if _URL_LIKE.search(value):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return value

    @field_validator("message")
    @classmethod
    def _message(cls, value: str) -> str:
        return _no_secrets(_clean_text(value))

    @field_validator("email")
    @classmethod
    def _email_lower(cls, value: str) -> str:
        return value.lower()

    @field_validator("privacy_acknowledged")
    @classmethod
    def _must_ack(cls, value: bool) -> bool:
        if value is not True:
            raise _error(
                "privacy_required", "Необходимо е да потвърдите, че сте запознати с информацията за поверителност."
            )
        return value

    @model_validator(mode="after")
    def _links_in_message(self) -> TeamSubmissionCreate:
        if len(_URL_LIKE.findall(self.message)) > 3:
            raise _error("too_many_links", "Описанието съдържа твърде много връзки. Опишете процеса с думи.")
        return self


# ------------------------------------------------------------------------------------ responses


class IntegrationEffort(BaseModel):
    integration: str
    complexity: str
    days: float


class ScenarioOut(BaseModel):
    one_time: dict[str, int]
    one_time_days: dict[str, float]
    integrations: list[IntegrationEffort]
    monthly: dict[str, int]
    usage: dict[str, int]
    oversight: dict[str, float]
    monitoring_hours: dict[str, float]


class EstimateOut(BaseModel):
    assumptions_version: str
    currency: str
    rates: dict[str, float]
    overrides: dict[str, float]
    scenarios: dict[str, ScenarioOut]
    ranges: dict[str, list[int]]


class TeamPlanOut(BaseModel):
    """Everything derived on the server from the configuration (enumerated keys; texts are client-side)."""

    model_version: str
    summary: dict[str, Any]
    security: list[str]
    data_flows: list[dict[str, Any]]
    estimate: EstimateOut


class TeamMeta(BaseModel):
    schema_version: str = SCHEMA_VERSION
    model_version: str = MODEL_VERSION
    privacy_notice_version: str
    marketing_consent_version: str
    retention_days: int
    submission_retention_days: int
    assumptions: dict[str, Any]
    # The API sends no e-mail to visitors; the UI must not promise any.
    email_delivery: Literal[False] = False


class TeamSavedOut(BaseModel):
    reference: str
    token: str
    expires_at: datetime


class TeamConfigurationOut(BaseModel):
    reference: str
    created_at: datetime
    expires_at: datetime
    schema_version: str
    model_version: str
    assumptions_version: str
    locale: str
    config: dict[str, Any]
    overrides: dict[str, float]


class TeamSubmitted(BaseModel):
    reference: str
    message: str
