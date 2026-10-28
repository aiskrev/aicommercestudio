"""Request and response schemas of the catalogue API (public read-only and admin).

Public schemas expose only published content: keys, slugs and texts. They never carry database ids,
revisions, lifecycle status, authorship or audit data. Every model forbids extra fields, so a change
in the read model cannot leak a new attribute silently.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.catalogue.text import check_plain_text
from app.models import SLUG_PATTERN, ServiceKey

Locale = Literal["bg", "en"]
Band = Literal["ai", "engineering", "operations"]
Delivery = Literal["available", "custom", "planned"]
Offering = Literal["service", "assessment", "workshop"]
Status = Literal["draft", "published", "archived"]
Role = Literal["admin", "editor", "viewer"]

KEY_PATTERN = r"^[a-z][a-z0-9_]{0,59}$"


class OutModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


# --------------------------------------------------------------------------- public


class AlternateSlugs(OutModel):
    bg: str
    en: str


class DomainRef(OutModel):
    key: str
    code: str
    slug: str
    name: str


class ServiceRef(OutModel):
    key: str
    offering_type: Offering
    slug: str
    name: str
    short_name: str | None
    delivery_status: Delivery


class Seo(OutModel):
    title: str
    description: str


class Capability(OutModel):
    title: str
    description: str


class Duration(OutModel):
    min_days: float
    max_days: float


class Family(OutModel):
    key: str
    name: str
    summary: str
    delivery_status: Delivery
    prerequisite: str | None
    services: list[ServiceRef]
    via: list[DomainRef]


class FamilyRef(OutModel):
    key: str
    name: str
    domain: DomainRef


class DomainSummary(OutModel):
    key: str
    code: str
    band: Band
    icon: str
    slug: str
    alternate_slugs: AlternateSlugs
    name: str
    summary: str
    delivery_status: Delivery = Field(description="Highest status of the domain's families.")
    service_count: int = Field(description="Published services, assessments and workshops in this domain.")


class DomainDetail(DomainSummary):
    locale: Locale
    body: str
    cta_label: str
    contact_service: str | None = Field(description="Lead category to pre-select in the contact form.")
    seo: Seo
    deliverables: list[str]
    families: list[Family]
    services: list[ServiceRef] = Field(description="Published services whose primary domain this is.")
    related_domains: list[DomainRef]


class DomainPage(OutModel):
    locale: Locale
    items: list[DomainSummary]
    total: int
    limit: int
    offset: int


class ServiceSummary(OutModel):
    key: str
    offering_type: Offering
    slug: str
    alternate_slugs: AlternateSlugs
    name: str
    short_name: str | None
    summary: str
    delivery_status: Delivery
    primary_domain: DomainRef | None
    is_entry_offer: bool
    custom_page: bool = Field(description="Rendered by a dedicated website route instead of the service template.")
    duration: Duration | None = Field(description="Indicative duration band in working days (assessments, workshops).")


class Related(OutModel):
    services: list[ServiceRef]
    assessments: list[ServiceRef]
    workshops: list[ServiceRef]


class ServiceDetail(ServiceSummary):
    locale: Locale
    body: str
    seo: Seo
    lead_category: str | None = Field(description="Contact-form category (ServiceKey) for services.")
    capabilities: list[Capability]
    deliverables: list[str]
    families: list[FamilyRef]
    related: Related


class ServicePage(OutModel):
    locale: Locale
    items: list[ServiceSummary]
    total: int
    limit: int
    offset: int


class RelatedResponse(OutModel):
    locale: Locale
    key: str
    related: Related


# --------------------------------------------------------------------------- admin: input


def _plain(value: str | None, multiline: bool = False) -> str | None:
    if value is None:
        return None
    value = check_plain_text(value, multiline=multiline)
    return value or None


class EditModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


Slug = Annotated[str, StringConstraints(max_length=80)]


class TranslationEdit(EditModel):
    """Texts of one locale. Empty strings are stored as empty (allowed in drafts, not for publishing)."""

    slug: Slug | None = None
    name: Annotated[str, StringConstraints(min_length=1, max_length=160)]
    short_name: Annotated[str, StringConstraints(max_length=80)] | None = None
    summary: Annotated[str, StringConstraints(max_length=300)] | None = None
    body: Annotated[str, StringConstraints(max_length=2000)] | None = None
    cta_label: Annotated[str, StringConstraints(max_length=80)] | None = None
    seo_title: Annotated[str, StringConstraints(max_length=70)] | None = None
    seo_description: Annotated[str, StringConstraints(max_length=175)] | None = None

    @field_validator("name", "short_name", "summary", "cta_label", "seo_title", "seo_description")
    @classmethod
    def _single_line(cls, value: str | None) -> str | None:
        return _plain(value)

    @field_validator("body")
    @classmethod
    def _multiline(cls, value: str | None) -> str | None:
        return _plain(value, multiline=True)

    @field_validator("slug")
    @classmethod
    def _slug(cls, value: str | None) -> str | None:
        if not value:
            return None
        if not re.fullmatch(SLUG_PATTERN, value):
            raise PydanticCustomError("catalogue_slug", "Използвайте малки латински букви, цифри и единични тирета.")
        return value


class TranslationsEdit(EditModel):
    bg: TranslationEdit
    en: TranslationEdit


class ItemTextEdit(EditModel):
    title: Annotated[str, StringConstraints(max_length=200)] | None = None
    body: Annotated[str, StringConstraints(max_length=1000)] | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, value: str | None) -> str | None:
        return _plain(value)

    @field_validator("body")
    @classmethod
    def _body(cls, value: str | None) -> str | None:
        return _plain(value, multiline=True)


class ItemEdit(EditModel):
    """One list entry in both locales (the lists stay aligned between BG and EN)."""

    bg: ItemTextEdit
    en: ItemTextEdit


CatalogueKey = Annotated[str, StringConstraints(pattern=KEY_PATTERN)]


class ServiceFieldsEdit(EditModel):
    primary_domain: CatalogueKey | None = None
    delivery_status: Delivery
    position: int = Field(ge=0, le=999)
    duration_min_days: float | None = Field(default=None, ge=0.5, le=99)
    duration_max_days: float | None = Field(default=None, ge=0.5, le=99)

    @model_validator(mode="after")
    def _duration(self) -> ServiceFieldsEdit:
        low, high = self.duration_min_days, self.duration_max_days
        if (low is None) != (high is None) or (low is not None and high is not None and high < low):
            raise PydanticCustomError("duration", "Невалидна продължителност.")
        return self


class FamilyTextEdit(EditModel):
    name: Annotated[str, StringConstraints(min_length=1, max_length=160)]
    summary: Annotated[str, StringConstraints(max_length=300)] | None = None
    prerequisite: Annotated[str, StringConstraints(max_length=400)] | None = None

    @field_validator("name", "summary", "prerequisite")
    @classmethod
    def _plain(cls, value: str | None) -> str | None:
        return _plain(value)


class FamilyEdit(EditModel):
    """A service family of a domain. `key` is the part after "<domain>." and cannot be renamed:
    a new key creates a new family; a family left out of the list is archived, not deleted."""

    key: Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{0,40}$")]
    delivery_status: Delivery
    services: list[CatalogueKey] = Field(default_factory=list, max_length=10)
    via: list[CatalogueKey] = Field(default_factory=list, max_length=4)
    bg: FamilyTextEdit
    en: FamilyTextEdit


class EntityUpdate(EditModel):
    """The editor's working copy. Lists are replaced as a whole (ordering = list order)."""

    translations: TranslationsEdit
    capabilities: list[ItemEdit] = Field(default_factory=list, max_length=20)
    deliverables: list[ItemEdit] = Field(default_factory=list, max_length=20)
    related: list[CatalogueKey] = Field(default_factory=list, max_length=8)
    service: ServiceFieldsEdit | None = None
    # Domains only; None keeps the families unchanged.
    families: list[FamilyEdit] | None = Field(default=None, max_length=20)


class EntityCreate(EditModel):
    key: Annotated[str, StringConstraints(max_length=60)]
    offering_type: Offering
    primary_domain: CatalogueKey | None = None
    lead_category: ServiceKey | None = None
    name_bg: Annotated[str, StringConstraints(min_length=1, max_length=160)]
    name_en: Annotated[str, StringConstraints(min_length=1, max_length=160)]

    @field_validator("key")
    @classmethod
    def _key(cls, value: str) -> str:
        if not re.fullmatch(KEY_PATTERN, value):
            raise PydanticCustomError("catalogue_key", "Невалиден ключ.")
        return value

    @field_validator("name_bg", "name_en")
    @classmethod
    def _name(cls, value: str) -> str:
        return check_plain_text(value)

    @model_validator(mode="after")
    def _service_needs(self) -> EntityCreate:
        if self.offering_type == "service":
            if not self.primary_domain:
                raise PydanticCustomError("primary_domain_required", "Услугата трябва да има основно направление.")
            if self.lead_category is None or self.lead_category == ServiceKey.OTHER:
                raise PydanticCustomError("missing", "Полето е задължително.")
        elif self.lead_category is not None:
            raise PydanticCustomError("value_error", "Само услугите имат категория за запитвания.")
        return self


# --------------------------------------------------------------------------- admin: output


class TranslationOut(OutModel):
    slug: str | None
    name: str
    short_name: str | None
    summary: str | None
    body: str | None
    cta_label: str | None
    seo_title: str | None
    seo_description: str | None


class ItemTextOut(OutModel):
    title: str | None
    body: str | None


class ItemOut(OutModel):
    bg: ItemTextOut
    en: ItemTextOut


class ServiceFieldsOut(OutModel):
    offering_type: Offering
    primary_domain: str | None
    delivery_status: Delivery
    lead_category: str | None
    position: int
    duration_min_days: float | None
    duration_max_days: float | None
    custom_page: bool
    is_entry_offer: bool


class FamilyTextOut(OutModel):
    name: str
    summary: str | None
    prerequisite: str | None


class AdminFamilyOut(OutModel):
    key: str = Field(description="Local key (the part after '<domain>.').")
    delivery_status: Delivery
    services: list[str]
    via: list[str]
    bg: FamilyTextOut
    en: FamilyTextOut


class DomainFieldsOut(OutModel):
    code: str
    band: Band
    icon: str
    contact_service: str | None
    families: list[AdminFamilyOut]


class EntityOut(OutModel):
    id: uuid.UUID
    type: Literal["domain", "service"]
    key: str
    status: Status
    revision: int
    published_revision: int | None
    has_unpublished_changes: bool
    first_published_at: datetime | None
    published_at: datetime | None
    archived_at: datetime | None
    updated_at: datetime
    translations: dict[Locale, TranslationOut]
    capabilities: list[ItemOut]
    deliverables: list[ItemOut]
    related: list[str]
    service: ServiceFieldsOut | None
    domain: DomainFieldsOut | None
    permissions: list[Literal["edit", "publish", "archive", "restore", "delete"]]


class EntitySummaryOut(OutModel):
    id: uuid.UUID
    type: Literal["domain", "service"]
    key: str
    status: Status
    offering_type: Offering | None
    domain: str | None = Field(description="Primary domain key of a service, or the domain's own code.")
    name_bg: str
    name_en: str
    revision: int
    published_revision: int | None
    has_unpublished_changes: bool
    updated_at: datetime
    published_at: datetime | None


class EntityPage(OutModel):
    items: list[EntitySummaryOut]
    total: int
    page: int
    page_size: int


class FieldProblem(OutModel):
    field: str
    message: str
    type: str


class ChecksOut(OutModel):
    publishable: bool
    errors: list[FieldProblem]


class HistoryEntry(OutModel):
    action: str
    actor_label: str
    created_at: datetime
    details: dict[str, Any]


class OptionDomain(OutModel):
    key: str
    code: str
    name_bg: str
    name_en: str


class OptionService(OutModel):
    key: str
    offering_type: Offering
    status: Status
    name_bg: str
    name_en: str


class StaffOut(OutModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    is_active: bool
    last_login_at: datetime | None
    is_self: bool


class RoleUpdate(EditModel):
    role: Role


class OptionsOut(OutModel):
    role: Role
    domains: list[OptionDomain]
    services: list[OptionService]
    free_lead_categories: list[str] = Field(description="ServiceKey values not yet used by a catalogue service.")
