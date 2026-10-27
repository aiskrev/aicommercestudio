"""Request/response models of the AI operations API. Free text is checked for secrets: the registry
holds metadata only — never API keys, tokens or connection strings."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.models import OpsAgentStatus, OpsEnvironment, OpsRole
from app.schemas import StrictModel, _clean_text, _no_secrets

_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# Provider, model and version identifiers: letters, digits and . _ : / - (e.g. "claude-opus-5-5", "v1.4").
_LABEL = re.compile(r"^[A-Za-z0-9._:/ -]+$")


def _slug(value: str) -> str:
    if not _SLUG.match(value):
        raise PydanticCustomError("ops_slug", "Използвайте малки латински букви, цифри и тирета.")
    return value


def _text(value: str | None) -> str | None:
    if value is None:
        return None
    return _no_secrets(_clean_text(value)) or None


def _label(value: str | None) -> str | None:
    value = _text(value)
    if value is not None and not _LABEL.match(value):
        raise PydanticCustomError("ops_label", "Използвайте латински букви, цифри и . _ : / -")
    return value


# --------------------------------------------------------------------------- organisations


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    status: str
    data_region: str
    is_demo: bool


class MyOrganizationOut(OrganizationOut):
    role: OpsRole


class TelemetryStatus(BaseModel):
    """Always reported, so a client never mistakes an empty dashboard for a healthy system."""

    connected: bool = False
    note: str = "No telemetry source is connected. Run, cost, latency and incident data are not collected yet."


class OverviewOut(BaseModel):
    organization: OrganizationOut
    role: OpsRole
    permissions: list[str]
    workspaces: int
    agents_by_status: dict[str, int]
    telemetry: TelemetryStatus = Field(default_factory=TelemetryStatus)


# --------------------------------------------------------------------------- workspaces


class WorkspaceCreate(StrictModel):
    slug: str = Field(min_length=2, max_length=60)
    name: str = Field(min_length=2, max_length=120)
    environment: OpsEnvironment

    check_slug = field_validator("slug")(_slug)
    check_name = field_validator("name")(_text)


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    environment: str
    created_at: datetime


# --------------------------------------------------------------------------- agents


class AgentCreate(StrictModel):
    workspace_id: uuid.UUID
    key: str = Field(min_length=2, max_length=60)
    name: str = Field(min_length=2, max_length=120)
    status: OpsAgentStatus = OpsAgentStatus.PLANNED
    provider: str | None = Field(default=None, max_length=40)
    model: str | None = Field(default=None, max_length=80)
    version: str | None = Field(default=None, max_length=40)
    purpose: str | None = Field(default=None, max_length=300)

    check_key = field_validator("key")(_slug)
    check_text = field_validator("name", "purpose")(_text)
    check_label = field_validator("provider", "model", "version")(_label)


class AgentUpdate(StrictModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    status: OpsAgentStatus | None = None
    provider: str | None = Field(default=None, max_length=40)
    model: str | None = Field(default=None, max_length=80)
    version: str | None = Field(default=None, max_length=40)
    purpose: str | None = Field(default=None, max_length=300)

    check_text = field_validator("name", "purpose")(_text)
    check_label = field_validator("provider", "model", "version")(_label)

    @model_validator(mode="after")
    def _something(self) -> AgentUpdate:
        if not self.model_fields_set:
            raise PydanticCustomError("nothing_to_change", "Няма какво да се промени.")
        return self


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    key: str
    name: str
    status: str
    provider: str | None
    model: str | None
    version: str | None
    purpose: str | None
    created_at: datetime
    updated_at: datetime


# --------------------------------------------------------------------------- members


class MemberCreate(StrictModel):
    email: EmailStr
    role: OpsRole


class MemberUpdate(StrictModel):
    role: OpsRole


class MemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str
    role: OpsRole
    created_at: datetime


class OpsAuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    actor_label: str
    action: str
    entity_type: str | None
    entity_id: str | None
    details: dict[str, Any]
