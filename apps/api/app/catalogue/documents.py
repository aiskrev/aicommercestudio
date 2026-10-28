"""Catalogue documents: the working copy of a domain or service, the publication checks and the
publish / archive / restore transitions.

A *document* is the language-complete, JSON-serialisable description of one domain or service,
with references by key. The same builder produces the preview (working copy) and the publication
snapshot stored in `catalogue_entities.published_snapshot`, so what an editor previews is exactly
what the public API serves after publishing.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    CatalogueDomain,
    CatalogueEntity,
    CatalogueEntityType,
    CatalogueFamily,
    CatalogueService,
    ContentItem,
    ContentItemTranslation,
    ContentItemType,
    EntityRelation,
    EntityTranslation,
    FamilyService,
    OfferingType,
    PublishStatus,
    RelationKind,
    utcnow,
)

DOCUMENT_SCHEMA = 1
LOCALES = ("bg", "en")
TEXT_FIELDS = ("slug", "name", "short_name", "summary", "body", "cta_label", "seo_title", "seo_description")

# SEO limits (SERVICE_TAXONOMY §7 for domains; the existing content tests' limits for services).
SEO_TITLE_MAX = {"domain": 60, "service": 70}
SEO_DESCRIPTION_RANGE = {"domain": (120, 160), "service": (70, 175)}


@dataclass(frozen=True)
class Problem:
    """A publication problem on one field; `type` is a key of app.i18n.VALIDATION_MESSAGES."""

    field: str
    type: str
    ctx: dict[str, Any] | None = None


def _decimal(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _keys_by_id(db: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    return dict(db.execute(select(CatalogueEntity.id, CatalogueEntity.key).where(CatalogueEntity.id.in_(ids))).all())


def _texts(db: Session, entity_id: uuid.UUID) -> dict[str, dict[str, Any]]:
    rows = {t.locale: t for t in db.scalars(select(EntityTranslation).where(EntityTranslation.entity_id == entity_id))}
    return {
        locale: {name: getattr(rows[locale], name) for name in TEXT_FIELDS} if locale in rows else {}
        for locale in LOCALES
    }


def item_texts(db: Session, entity_id: uuid.UUID, item_type: ContentItemType) -> list[dict[str, dict[str, str | None]]]:
    items = db.scalars(
        select(ContentItem)
        .where(ContentItem.entity_id == entity_id, ContentItem.item_type == item_type.value)
        .order_by(ContentItem.position)
    ).all()
    texts: dict[uuid.UUID, dict[str, ContentItemTranslation]] = {}
    if items:
        for t in db.scalars(
            select(ContentItemTranslation).where(ContentItemTranslation.item_id.in_([i.id for i in items]))
        ):
            texts.setdefault(t.item_id, {})[t.locale] = t

    def text(item_id: uuid.UUID, locale: str) -> dict[str, str | None]:
        row = texts.get(item_id, {}).get(locale)
        return {"title": row.title if row else None, "body": row.body if row else None}

    return [{locale: text(item.id, locale) for locale in LOCALES} for item in items]


def _relations(db: Session, entity_id: uuid.UUID, kind: RelationKind) -> list[str]:
    rows = db.execute(
        select(CatalogueEntity.key)
        .join(EntityRelation, EntityRelation.to_entity_id == CatalogueEntity.id)
        .where(EntityRelation.from_entity_id == entity_id, EntityRelation.kind == kind.value)
        .order_by(EntityRelation.position)
    ).all()
    return [row[0] for row in rows]


def build_document(db: Session, entity: CatalogueEntity) -> dict[str, Any]:
    """The working copy of a domain or service as a document (preview and publication snapshot)."""
    base: dict[str, Any] = {
        "schema": DOCUMENT_SCHEMA,
        "type": entity.entity_type,
        "key": entity.key,
        "revision": entity.revision,
        "texts": _texts(db, entity.id),
        "deliverables": item_texts(db, entity.id, ContentItemType.DELIVERABLE),
    }
    if entity.entity_type == CatalogueEntityType.DOMAIN:
        domain = db.get(CatalogueDomain, entity.id)
        assert domain is not None
        families = db.scalars(
            select(CatalogueFamily).where(CatalogueFamily.domain_id == entity.id).order_by(CatalogueFamily.position)
        ).all()
        family_entities = {
            e.id: e for e in db.scalars(select(CatalogueEntity).where(CatalogueEntity.id.in_([f.id for f in families])))
        }
        links: dict[uuid.UUID, list[uuid.UUID]] = {}
        for link in db.scalars(
            select(FamilyService)
            .where(FamilyService.family_id.in_([f.id for f in families]))
            .order_by(FamilyService.position)
        ):
            links.setdefault(link.family_id, []).append(link.service_id)
        service_keys = _keys_by_id(db, {sid for ids in links.values() for sid in ids})
        contact = _keys_by_id(db, {domain.contact_service_id} if domain.contact_service_id else set())
        base.update(
            code=domain.code,
            band=domain.band,
            icon=domain.icon,
            position=domain.position,
            contact_service=contact.get(domain.contact_service_id) if domain.contact_service_id else None,
            related=_relations(db, entity.id, RelationKind.CROSS_SELL),
            families=[
                {
                    "key": family_entities[f.id].key,
                    "delivery_status": f.delivery_status,
                    "position": f.position,
                    "archived": family_entities[f.id].status == PublishStatus.ARCHIVED,
                    "services": [service_keys[sid] for sid in links.get(f.id, [])],
                    "via": _relations(db, f.id, RelationKind.DELIVERED_THROUGH),
                    "texts": {
                        locale: {k: v for k, v in texts.items() if k in ("name", "summary")}
                        | {"prerequisite": _prerequisite(db, f.id, locale)}
                        for locale, texts in _texts(db, f.id).items()
                    },
                }
                for f in families
            ],
        )
    else:
        service = db.get(CatalogueService, entity.id)
        assert service is not None
        domain_key = _keys_by_id(db, {service.primary_domain_id} if service.primary_domain_id else set())
        family_rows = db.execute(
            select(CatalogueEntity.key, CatalogueFamily.domain_id)
            .join(CatalogueFamily, CatalogueFamily.id == CatalogueEntity.id)
            .join(FamilyService, FamilyService.family_id == CatalogueFamily.id)
            .where(FamilyService.service_id == entity.id)
            .order_by(CatalogueEntity.key)
        ).all()
        family_domains = _keys_by_id(db, {row[1] for row in family_rows})
        base.update(
            offering_type=service.offering_type,
            primary_domain=domain_key.get(service.primary_domain_id) if service.primary_domain_id else None,
            delivery_status=service.delivery_status,
            lead_category=service.lead_category,
            icon=service.icon,
            custom_page=service.custom_page,
            is_entry_offer=service.is_entry_offer,
            position=service.position,
            duration=(
                {"min_days": _decimal(service.duration_min_days), "max_days": _decimal(service.duration_max_days)}
                if service.duration_min_days is not None
                else None
            ),
            related=_relations(db, entity.id, RelationKind.RELATED),
            families=[{"key": key, "domain": family_domains[domain_id]} for key, domain_id in family_rows],
            capabilities=item_texts(db, entity.id, ContentItemType.CAPABILITY),
        )
    return base


def _prerequisite(db: Session, family_id: uuid.UUID, locale: str) -> str | None:
    return db.scalar(
        select(EntityTranslation.prerequisite).where(
            EntityTranslation.entity_id == family_id, EntityTranslation.locale == locale
        )
    )


# --------------------------------------------------------------------------- publication checks


def publication_problems(db: Session, entity: CatalogueEntity, document: dict[str, Any]) -> list[Problem]:
    """Everything that must hold before a domain or service may be published (both locales)."""
    problems: list[Problem] = []
    kind = entity.entity_type
    required = ["name", "slug", "summary", "body", "seo_title", "seo_description"]
    if kind == CatalogueEntityType.DOMAIN:
        required.append("cta_label")
    elif document.get("offering_type") == OfferingType.SERVICE:
        required.append("short_name")

    for locale in LOCALES:
        texts = document["texts"].get(locale) or {}
        for name in required:
            if not (texts.get(name) or "").strip():
                problems.append(Problem(f"translations.{locale}.{name}", "required_to_publish"))
        title = texts.get("seo_title") or ""
        if title and len(title) > SEO_TITLE_MAX[kind]:
            problems.append(
                Problem(f"translations.{locale}.seo_title", "seo_title_length", {"max": SEO_TITLE_MAX[kind]})
            )
        description = texts.get("seo_description") or ""
        low, high = SEO_DESCRIPTION_RANGE[kind]
        if description and not low <= len(description) <= high:
            problems.append(
                Problem(f"translations.{locale}.seo_description", "seo_description_length", {"min": low, "max": high})
            )

    for list_name, needs_title in (("capabilities", True), ("deliverables", False)):
        for index, item in enumerate(document.get(list_name) or []):
            for locale in LOCALES:
                text = item.get(locale) or {}
                if needs_title and not (text.get("title") or "").strip():
                    problems.append(Problem(f"{list_name}.{index}.{locale}.title", "required_to_publish"))
                if not (text.get("body") or "").strip():
                    problems.append(Problem(f"{list_name}.{index}.{locale}.body", "required_to_publish"))

    live_families = [f for f in document.get("families") or [] if not f.get("archived")]
    if kind == CatalogueEntityType.DOMAIN:
        for index, family in enumerate(live_families):
            for locale in LOCALES:
                texts = family["texts"].get(locale) or {}
                for name in ("name", "summary"):
                    if not (texts.get(name) or "").strip():
                        problems.append(Problem(f"families.{index}.{locale}.{name}", "required_to_publish"))
                if family["delivery_status"] == "planned" and not (texts.get("prerequisite") or "").strip():
                    problems.append(Problem(f"families.{index}.{locale}.prerequisite", "required_to_publish"))

    is_service = kind == CatalogueEntityType.SERVICE and document["offering_type"] == OfferingType.SERVICE
    if is_service and not document.get("primary_domain"):
        problems.append(Problem("service.primary_domain", "primary_domain_required"))

    archived = set(
        db.scalars(select(CatalogueEntity.key).where(CatalogueEntity.status == PublishStatus.ARCHIVED.value))
    )
    for index, key in enumerate(document.get("related") or []):
        if key in archived:
            problems.append(Problem(f"related.{index}", "archived_reference"))
    return problems


# --------------------------------------------------------------------------- transitions


class TransitionError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def publish(db: Session, entity: CatalogueEntity, *, actor_id: uuid.UUID | None) -> list[Problem]:
    """Publish the working copy. Returns problems (nothing is changed) or [] on success."""
    if entity.entity_type == CatalogueEntityType.FAMILY:
        raise TransitionError("invalid_transition")
    if entity.status == PublishStatus.ARCHIVED:
        raise TransitionError("invalid_transition")
    document = build_document(db, entity)
    problems = publication_problems(db, entity, document)
    if problems:
        return problems
    now = utcnow()
    entity.status = PublishStatus.PUBLISHED.value
    entity.published_snapshot = document
    entity.published_revision = entity.revision
    entity.published_at = now
    entity.published_by_id = actor_id
    entity.first_published_at = entity.first_published_at or now
    return []


def archive(entity: CatalogueEntity) -> None:
    if entity.entity_type == CatalogueEntityType.DOMAIN:
        raise TransitionError("domain_archive_not_allowed")
    if entity.entity_type != CatalogueEntityType.SERVICE or entity.status == PublishStatus.ARCHIVED:
        raise TransitionError("invalid_transition")
    entity.status = PublishStatus.ARCHIVED.value
    entity.archived_at = utcnow()


def restore(entity: CatalogueEntity) -> None:
    """Archived → draft. It must be published again to reach the public API."""
    if entity.status != PublishStatus.ARCHIVED:
        raise TransitionError("invalid_transition")
    entity.status = PublishStatus.DRAFT.value
    entity.archived_at = None
