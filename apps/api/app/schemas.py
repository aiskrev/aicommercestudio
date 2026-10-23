"""Pydantic request/response models. Validation messages are in Bulgarian because
they are shown directly to website visitors and administrators."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import LeadStatus, ServiceKey

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_PHONE_RE = re.compile(r"^\+?[0-9 ()\-./]{6,40}$")
_URL_LIKE = re.compile(r"https?://|www\.|<|>", re.IGNORECASE)


def _clean_text(value: str) -> str:
    if _CONTROL_CHARS.search(value):
        raise ValueError("Текстът съдържа непозволени символи.")
    return value.strip()


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


# --------------------------------------------------------------------------- public


class FormTokenOut(BaseModel):
    token: str


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

    @field_validator("name", "company")
    @classmethod
    def _no_links(cls, value: str) -> str:
        value = _clean_text(value)
        if _URL_LIKE.search(value):
            raise ValueError("Полето не може да съдържа връзки или HTML.")
        return value

    @field_validator("message")
    @classmethod
    def _message(cls, value: str) -> str:
        return _clean_text(value)

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        if not isinstance(value, str) or not _PHONE_RE.match(value.strip()):
            raise ValueError("Невалиден телефонен номер.")
        return value.strip()

    @field_validator("email")
    @classmethod
    def _email_lower(cls, value: str) -> str:
        return value.lower()

    @field_validator("privacy_acknowledged")
    @classmethod
    def _must_ack(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Необходимо е да потвърдите, че сте запознати с информацията за поверителност.")
        return value


class LeadCreated(BaseModel):
    status: Literal["received"] = "received"
    reference: str
    message: str


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


class SessionOut(BaseModel):
    user: AdminUserOut
    expires_at: datetime


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
    created_at: datetime
    updated_at: datetime


class LeadDetailOut(LeadSummaryOut):
    phone: str | None
    message: str
    privacy_acknowledged_at: datetime
    privacy_notice_version: str
    marketing_consent: bool
    marketing_consent_at: datetime | None
    status_changed_at: datetime | None
    notes: list[LeadNoteOut]


class LeadPage(BaseModel):
    items: list[LeadSummaryOut]
    total: int
    page: int
    page_size: int


class LeadUpdate(StrictModel):
    status: LeadStatus


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
    pending_ai_actions: int
    recent_activity: list[AuditLogOut]


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


