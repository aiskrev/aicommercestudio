"""Input and output schemas for the automation advisor.

Input is strict (enums, lengths, no unknown fields). Output models describe what the AI
provider must return; they are used both to generate the JSON schema sent to the model and
to validate what comes back. Over-long strings and lists are truncated instead of rejected,
while wrong types, unknown fields, invalid enum values and missing sections are rejected.

No `from __future__ import annotations` here: the `Text(...)` / `Items(...)` annotations are
evaluated eagerly by Pydantic.
"""

import enum
import re
import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
MAX_LINKS_IN_DESCRIPTION = 3
DESCRIPTION_MIN = 40
DESCRIPTION_MAX = 2000


class BusinessType(enum.StrEnum):
    ONLINE_STORE = "online_store"
    RETAIL = "retail"
    WHOLESALE = "wholesale"
    SERVICES = "services"
    PROFESSIONAL = "professional"
    MANUFACTURING = "manufacturing"
    LOGISTICS = "logistics"
    HOSPITALITY = "hospitality"
    AGENCY = "agency"
    OTHER = "other"


class MonthlyVolume(enum.StrEnum):
    UNDER_100 = "under_100"
    FROM_100_TO_500 = "100_500"
    FROM_500_TO_2000 = "500_2000"
    FROM_2000_TO_10000 = "2000_10000"
    OVER_10000 = "over_10000"


class TeamSize(enum.StrEnum):
    SOLO = "solo"
    FROM_2_TO_5 = "2_5"
    FROM_6_TO_20 = "6_20"
    FROM_21_TO_50 = "21_50"
    OVER_50 = "over_50"


class ToolKey(enum.StrEnum):
    SHOPIFY = "shopify"
    WOOCOMMERCE = "woocommerce"
    OTHER_ECOMMERCE = "other_ecommerce"
    SPREADSHEETS = "spreadsheets"
    GOOGLE_WORKSPACE = "google_workspace"
    MICROSOFT_365 = "microsoft_365"
    EMAIL = "email"
    CRM = "crm"
    ERP = "erp"
    ACCOUNTING = "accounting"
    INVOICING = "invoicing"
    COURIER = "courier"
    PAYMENTS = "payments"
    HELPDESK = "helpdesk"
    MESSAGING = "messaging"
    NONE = "none"


# Labels are part of the prompt and of the demo output, so they live next to the enums.
BUSINESS_TYPE_LABELS: dict[BusinessType, str] = {
    BusinessType.ONLINE_STORE: "онлайн магазин",
    BusinessType.RETAIL: "търговия на дребно с физически обект",
    BusinessType.WHOLESALE: "търговия на едро и дистрибуция",
    BusinessType.SERVICES: "услуги за крайни клиенти",
    BusinessType.PROFESSIONAL: "професионални услуги (счетоводство, право, консултации)",
    BusinessType.MANUFACTURING: "производство",
    BusinessType.LOGISTICS: "логистика и транспорт",
    BusinessType.HOSPITALITY: "хотелиерство и ресторантьорство",
    BusinessType.AGENCY: "агенция (маркетинг, дизайн, IT)",
    BusinessType.OTHER: "друг вид бизнес",
}
VOLUME_LABELS: dict[MonthlyVolume, str] = {
    MonthlyVolume.UNDER_100: "под 100 на месец",
    MonthlyVolume.FROM_100_TO_500: "100–500 на месец",
    MonthlyVolume.FROM_500_TO_2000: "500–2 000 на месец",
    MonthlyVolume.FROM_2000_TO_10000: "2 000–10 000 на месец",
    MonthlyVolume.OVER_10000: "над 10 000 на месец",
}
TEAM_LABELS: dict[TeamSize, str] = {
    TeamSize.SOLO: "1 човек",
    TeamSize.FROM_2_TO_5: "2–5 души",
    TeamSize.FROM_6_TO_20: "6–20 души",
    TeamSize.FROM_21_TO_50: "21–50 души",
    TeamSize.OVER_50: "над 50 души",
}
TOOL_LABELS: dict[ToolKey, str] = {
    ToolKey.SHOPIFY: "Shopify",
    ToolKey.WOOCOMMERCE: "WooCommerce",
    ToolKey.OTHER_ECOMMERCE: "друга e-commerce платформа",
    ToolKey.SPREADSHEETS: "Excel / Google Sheets таблици",
    ToolKey.GOOGLE_WORKSPACE: "Google Workspace",
    ToolKey.MICROSOFT_365: "Microsoft 365",
    ToolKey.EMAIL: "имейл",
    ToolKey.CRM: "CRM система",
    ToolKey.ERP: "ERP система",
    ToolKey.ACCOUNTING: "счетоводен софтуер",
    ToolKey.INVOICING: "софтуер за фактуриране",
    ToolKey.COURIER: "куриерски услуги с онлайн профил",
    ToolKey.PAYMENTS: "платежен доставчик",
    ToolKey.HELPDESK: "система за клиентска поддръжка",
    ToolKey.MESSAGING: "Viber / WhatsApp / Messenger",
    ToolKey.NONE: "без специализиран софтуер",
}


def _clean(value: str) -> str:
    if _CONTROL_CHARS.search(value):
        raise ValueError("Текстът съдържа непозволени символи.")
    return value.strip()


class AdvisorRequest(BaseModel):
    """What a visitor submits. No personal data is requested."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    business_type: BusinessType
    process_description: str = Field(min_length=DESCRIPTION_MIN, max_length=DESCRIPTION_MAX)
    monthly_volume: MonthlyVolume
    team_size: TeamSize
    tools: list[ToolKey] = Field(default_factory=list, max_length=len(ToolKey))
    other_tools: str = Field(default="", max_length=200)
    save_assessment: bool = True
    form_token: str = Field(default="", max_length=200)

    @field_validator("process_description")
    @classmethod
    def _description(cls, value: str) -> str:
        value = _clean(value)
        if len(_URL_RE.findall(value)) > MAX_LINKS_IN_DESCRIPTION:
            raise ValueError("Описанието съдържа твърде много връзки. Опишете процеса с думи.")
        return value

    @field_validator("other_tools")
    @classmethod
    def _other_tools(cls, value: str) -> str:
        value = _clean(value)
        if _URL_RE.search(value) or "<" in value or ">" in value:
            raise ValueError("Полето не може да съдържа връзки или HTML.")
        return value

    @field_validator("tools")
    @classmethod
    def _unique_tools(cls, value: list[ToolKey]) -> list[ToolKey]:
        unique = list(dict.fromkeys(value))
        if ToolKey.NONE in unique and len(unique) > 1:
            unique.remove(ToolKey.NONE)
        return unique


# --------------------------------------------------------------------------- output


def _truncate(limit: int) -> Callable[[Any], Any]:
    def apply(value: Any) -> Any:
        if isinstance(value, str):
            value = " ".join(value.split()) if "\n" not in value else value.strip()
            return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"
        return value

    return apply


def _cap(limit: int) -> Callable[[Any], Any]:
    def apply(value: Any) -> Any:
        return value[:limit] if isinstance(value, list) else value

    return apply


def Text(limit: int) -> Any:  # noqa: N802 - reads like a type in annotations
    return Annotated[str, BeforeValidator(_truncate(limit)), Field(min_length=1)]


def Items(item: Any, minimum: int, maximum: int) -> Any:  # noqa: N802
    return Annotated[list[item], BeforeValidator(_cap(maximum)), Field(min_length=minimum)]


class OutputModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


Level = Literal["low", "medium", "high"]


class Opportunity(OutputModel):
    title: Text(120)
    description: Text(600)
    approach: Literal["rules", "ai_assisted", "integration", "reporting"]
    priority: Level


class WorkflowStep(OutputModel):
    title: Text(120)
    description: Text(500)
    actor: Literal["system", "ai", "human"]
    requires_human_approval: bool


class IntegrationCandidate(OutputModel):
    system: Text(80)
    purpose: Text(300)
    access: Literal["read", "write", "read_write"]


class HumanApproval(OutputModel):
    decision: Text(200)
    reason: Text(300)


class Risk(OutputModel):
    risk: Text(300)
    mitigation: Text(300)


class Complexity(OutputModel):
    level: Level
    rationale: Text(500)


class Phase(OutputModel):
    name: Text(100)
    description: Text(400)
    deliverables: Items(Text(200), 1, 5)
    indicative_duration: Text(60)


class AutomationAssessment(OutputModel):
    problem_summary: Text(800)
    opportunities: Items(Opportunity, 1, 6)
    proposed_workflow: Items(WorkflowStep, 2, 10)
    integrations: Items(IntegrationCandidate, 0, 8)
    human_approvals: Items(HumanApproval, 1, 6)
    data_protection: Items(Text(300), 1, 6)
    risks: Items(Risk, 1, 6)
    complexity: Complexity
    phases: Items(Phase, 1, 5)
    clarification_questions: Items(Text(250), 2, 8)
    next_steps: Items(Text(250), 1, 5)


class AdvisorResponse(BaseModel):
    assessment_id: uuid.UUID | None
    reference: str | None
    mode: Literal["demo", "ai"]
    provider: str
    model: str
    disclaimer: str
    notices: list[str]
    stored: bool
    expires_at: datetime | None
    created_at: datetime
    assessment: AutomationAssessment


class AdvisorStatus(BaseModel):
    mode: Literal["demo", "ai"]
    disclaimer: str
    retention_days: int
    description_min: int = DESCRIPTION_MIN
    description_max: int = DESCRIPTION_MAX


class AdvisorAssessmentSummary(BaseModel):
    """Shown to administrators on a lead that was submitted from an assessment."""

    id: uuid.UUID
    reference: str
    mode: str
    created_at: datetime
    business_type: str
    monthly_volume: str
    team_size: str
    tools: list[str]
    assessment: AutomationAssessment
