"""Pydantic request/response models.

Field errors are raised as `PydanticCustomError(<type>, <Bulgarian message>)`; the API renders them in
Bulgarian or English (see app/i18n.py) according to the request's Accept-Language header.
"""

from __future__ import annotations

import enum
import re
import uuid
from datetime import datetime
from typing import Any, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.advisor.schemas import AdvisorAssessmentSummary
from app.models import BudgetRange, InquiryType, LeadLocale, LeadStatus, Platform, ServiceKey, Timeline

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_PHONE_RE = re.compile(r"^\+?[0-9 ()\-./]{6,40}$")
_URL_LIKE = re.compile(r"https?://|www\.|<|>", re.IGNORECASE)

# Text that looks like a credential. Inquiry forms must never transport secrets: the visitor is
# asked to remove them (mirrored client-side in apps/web/src/lib/contact-validation.ts).
_SECRET_PATTERNS = [
    re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}"),
    re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{30,}"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?:password|passwd|парола|api[_ -]?key|secret|token|токен)\s*[:=]\s*\S{6,}", re.IGNORECASE),
]


def looks_like_secret(value: str) -> bool:
    return any(pattern.search(value) for pattern in _SECRET_PATTERNS)


def _error(error_type: str, message: str) -> PydanticCustomError:
    return PydanticCustomError(error_type, message)


def _clean_text(value: str) -> str:
    if _CONTROL_CHARS.search(value):
        raise _error("control_chars", "Текстът съдържа непозволени символи.")
    return value.strip()


def _no_secrets(value: str) -> str:
    if looks_like_secret(value):
        raise _error("secrets", "Текстът прилича на парола, API ключ или токен. Моля, премахнете го.")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


# --------------------------------------------------------------------------- public


class FormTokenOut(BaseModel):
    token: str


class AiSector(enum.StrEnum):
    ECOMMERCE = "ecommerce"
    RETAIL = "retail"
    PROFESSIONAL_SERVICES = "professional_services"
    MANUFACTURING = "manufacturing"
    LOGISTICS = "logistics"
    HEALTHCARE = "healthcare"
    FINANCE = "finance"
    SOFTWARE_SAAS = "software_saas"
    AGENCY = "agency"
    OTHER = "other"


class AiSystemType(enum.StrEnum):
    CUSTOMER_SUPPORT = "customer_support"
    KNOWLEDGE_ASSISTANT = "knowledge_assistant"
    WORKFLOW_AUTOMATION = "workflow_automation"
    SALES_ASSISTANT = "sales_assistant"
    DOCUMENT_PROCESSING = "document_processing"
    CUSTOM_LLM_APP = "custom_llm_app"
    OTHER = "other"


class AiAgentsCount(enum.StrEnum):
    ONE = "1"
    FROM_2_TO_5 = "2_5"
    FROM_6_TO_20 = "6_20"
    OVER_20 = "over_20"
    UNKNOWN = "unknown"


class AiHosting(enum.StrEnum):
    VENDOR_PLATFORM = "vendor_platform"
    PUBLIC_CLOUD = "public_cloud"
    PRIVATE_SERVER = "private_server"
    ON_PREMISE = "on_premise"
    UNKNOWN = "unknown"
    OTHER = "other"


class AiSupportInterest(enum.StrEnum):
    MONITORING = "monitoring"
    MAINTENANCE = "maintenance"
    SECURITY = "security"
    COST_OPTIMIZATION = "cost_optimization"
    QUALITY_EVALUATION = "quality_evaluation"
    INCIDENT_SUPPORT = "incident_support"
    FULL_MANAGED = "full_managed"


class AiManagedDetails(StrictModel):
    """Descriptive information about a client's AI system (AI Managed Services inquiries).

    Never credentials, keys, customer records or documents: free text is checked for secrets.
    Stored in `leads.service_details` (JSONB, `{"kind": "ai_managed", ...}`).
    """

    sector: AiSector
    system_types: list[AiSystemType] = Field(min_length=1, max_length=len(AiSystemType))
    agents_count: AiAgentsCount
    ai_provider: str = Field(default="", max_length=120)
    hosting: AiHosting | None = None
    support_interests: list[AiSupportInterest] = Field(min_length=1, max_length=len(AiSupportInterest))
    communication_language: LeadLocale
    additional_notes: str = Field(default="", max_length=2000)

    @field_validator("system_types", "support_interests")
    @classmethod
    def _unique(cls, value: list[Any]) -> list[Any]:
        return list(dict.fromkeys(value))

    @field_validator("ai_provider")
    @classmethod
    def _provider(cls, value: str) -> str:
        value = _clean_text(value)
        if _URL_LIKE.search(value):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return _no_secrets(value)

    @field_validator("additional_notes")
    @classmethod
    def _notes(cls, value: str) -> str:
        return _no_secrets(_clean_text(value))


class LeadCreate(StrictModel):
    service: ServiceKey
    name: str = Field(min_length=2, max_length=120)
    company: str = Field(min_length=2, max_length=160)
    email: EmailStr = Field(max_length=254)
    phone: str | None = Field(default=None, max_length=40)
    message: str = Field(min_length=20, max_length=5000)
    privacy_acknowledged: bool
    marketing_consent: bool = False
    # Honeypot: real users never see or fill this field.
    website: str = Field(default="", max_length=200)
    form_token: str = Field(default="", max_length=200)
    # Set when the visitor requests a consultation from an AI advisor assessment.
    advisor_assessment_id: uuid.UUID | None = None
    # Website language the inquiry was sent from (allowlist; older clients default to Bulgarian).
    locale: LeadLocale = LeadLocale.BG
    # Only for service == ai_managed.
    ai_managed: AiManagedDetails | None = None

    @field_validator("name", "company")
    @classmethod
    def _no_links(cls, value: str) -> str:
        value = _clean_text(value)
        if _URL_LIKE.search(value):
            raise _error("no_links", "Полето не може да съдържа връзки или HTML.")
        return value

    @field_validator("message")
    @classmethod
    def _message(cls, value: str) -> str:
        return _no_secrets(_clean_text(value))

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        if not isinstance(value, str) or not _PHONE_RE.match(value.strip()):
            raise _error("phone", "Невалиден телефонен номер.")
        return value.strip()

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
    def _ai_details_only_for_ai_managed(self) -> LeadCreate:
        if self.ai_managed is not None and self.service != ServiceKey.AI_MANAGED:
            raise _error(
                "ai_details_service", "Информацията за AI система се приема само за услугата AI Managed Services."
            )
        return self


class QuoteRequestCreate(LeadCreate):
    """Request for a written quote: the contact fields plus structured project information."""

    platform: Platform
    budget_range: BudgetRange
    timeline: Timeline
    website_url: str | None = Field(default=None, max_length=300)

    @field_validator("website_url", mode="before")
    @classmethod
    def _website_url(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        if not isinstance(value, str):
            raise _error("website_url", "Невалиден адрес на сайт.")
        candidate = value.strip()
        if not candidate.lower().startswith(("http://", "https://")):
            candidate = f"https://{candidate}"
        parts = urlsplit(candidate)
        host = parts.hostname or ""
        invalid = parts.scheme not in ("http", "https") or "." not in host
        if invalid or _CONTROL_CHARS.search(candidate) or " " in candidate:
            raise _error("website_url", "Въведете валиден адрес на сайт, например https://example.bg.")
        return candidate


class LeadCreated(BaseModel):
    status: Literal["received"] = "received"
    reference: str
    message: str
    inquiry_type: InquiryType = InquiryType.CONTACT


# --------------------------------------------------------------------------- auth


class LoginIn(StrictModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=256)


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    last_login_at: datetime | None
    role: Literal["admin", "editor", "viewer"]


class SessionOut(BaseModel):
    user: AdminUserOut
    expires_at: datetime


class AdminSessionInfo(BaseModel):
    id: uuid.UUID
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    user_agent: str | None
    current: bool


class LogoutAllOut(BaseModel):
    sessions_revoked: int


# --------------------------------------------------------------------------- leads


class LeadNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    body: str
    created_at: datetime
    author_name: str | None = None


class LeadSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference: str
    service: str
    name: str
    company: str
    email: str
    status: str
    source: str
    inquiry_type: str
    locale: str
    created_at: datetime
    updated_at: datetime


class ReadinessDetailsOut(BaseModel):
    """Stored AI readiness submission as shown to admins (levels and computed result only)."""

    model_version: str
    role: str
    consultation_requested: bool
    overall: int = Field(ge=0, le=100)
    band: str
    dimensions: dict[str, int]
    blockers: list[str]
    actions: list[str]


class TeamDetailsOut(BaseModel):
    """AI team configurator consultation as shown to admins (enumerated configuration and estimate)."""

    reference: str | None = None
    model_version: str
    assumptions_version: str
    role: str
    agents: list[str]
    complexity: str
    deployment: str | None = None
    operations: str | None = None
    currency: str
    one_time_range: list[int]
    monthly_range: list[int]
    expected_one_time: int
    expected_monthly: int


class LeadDetailOut(LeadSummaryOut):
    phone: str | None
    message: str
    privacy_acknowledged_at: datetime
    privacy_notice_version: str
    marketing_consent: bool
    marketing_consent_at: datetime | None
    marketing_consent_version: str | None = None
    status_changed_at: datetime | None
    submitted_service: str
    platform: str | None
    budget_range: str | None
    timeline: str | None
    website_url: str | None
    notes: list[LeadNoteOut]
    advisor_assessment: AdvisorAssessmentSummary | None = None
    # AI Managed Services inquiry details (validated on input; None for other services and older leads).
    ai_managed: AiManagedDetails | None = None
    # AI readiness assessment submission (source readiness_assessment); None otherwise.
    readiness: ReadinessDetailsOut | None = None
    # AI team configurator consultation (source team_configurator); None otherwise.
    team: TeamDetailsOut | None = None


class LeadPage(BaseModel):
    items: list[LeadSummaryOut]
    total: int
    page: int
    page_size: int


class LeadUpdate(StrictModel):
    """Change pipeline status and/or service categorisation.

    `expected_status` enables optimistic concurrency: if another administrator changed the
    status in the meantime, the update is rejected with 409 instead of silently overwriting it.
    """

    status: LeadStatus | None = None
    service: ServiceKey | None = None
    expected_status: LeadStatus | None = None

    @model_validator(mode="after")
    def _something_to_change(self) -> LeadUpdate:
        if self.status is None and self.service is None:
            raise _error("nothing_to_change", "Посочете статус или услуга за промяна.")
        return self


class LeadNoteCreate(StrictModel):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def _body(cls, value: str) -> str:
        return _clean_text(value)


# --------------------------------------------------------------------------- audit / stats


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    actor_label: str
    action: str
    entity_type: str | None
    entity_id: str | None
    details: dict[str, Any]


class DashboardStats(BaseModel):
    total_leads: int
    new_leads: int
    leads_last_7_days: int
    leads_last_30_days: int
    open_pipeline: int
    won: int
    lost: int
    by_status: dict[str, int]
    by_service: dict[str, int]
    by_inquiry_type: dict[str, int]
    by_locale: dict[str, int] = {}
    pending_ai_actions: int
    recent_activity: list[AuditLogOut]


class AuditPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int


class RetentionPreview(BaseModel):
    lead_retention_days: int
    audit_retention_days: int
    leads_due: int
    audit_entries_due: int
    lead_cutoff: datetime
    audit_cutoff: datetime
    advisor_retention_days: int = 0
    advisor_assessments_due: int = 0
    team_configuration_retention_days: int = 0
    team_configurations_due: int = 0


class RetentionRunIn(StrictModel):
    confirm: Literal[True]


class RetentionRunOut(BaseModel):
    leads_deleted: int
    audit_entries_deleted: int
    advisor_assessments_deleted: int = 0
    team_configurations_deleted: int = 0


class IntegrationStatus(BaseModel):
    key: str
    label: str
    configured: bool
    note: str


class SystemStatus(BaseModel):
    environment: str
    ai_provider: str
    email_enabled: bool
    lead_retention_days: int
    integrations: list[IntegrationStatus]


# --------------------------------------------------------------------------- AI


class LeadTriageOut(BaseModel):
    provider: str
    model: str
    suggested_service: str
    priority: Literal["low", "medium", "high"]
    summary: str
    suggested_next_step: str
    signals: list[str]
    disclaimer: str


class AIActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action_type: str
    risk_level: str
    status: str
    summary: str
    payload: dict[str, Any]
    requested_by: str
    created_at: datetime
    decided_at: datetime | None
    decision_comment: str | None
    decided_by_name: str | None = None


class AIActionDecision(StrictModel):
    decision: Literal["approve", "reject"]
    comment: str | None = Field(default=None, max_length=1000)


