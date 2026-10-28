"""Admin operations on the catalogue working copy (list, read, create, update, checks, options).

Writes change only working rows and the revision. They never touch `published_snapshot`, so the
public API keeps serving the last published version until an admin publishes again
(app/catalogue/documents.py).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.catalogue import api_schemas as schemas
from app.catalogue.documents import LOCALES, Problem, build_document
from app.i18n import Locale, validation_message
from app.models import (
    LEAD_CATEGORIES,
    AdminRole,
    AuditLog,
    CatalogueDomain,
    CatalogueEntity,
    CatalogueEntityType,
    CatalogueService,
    ContentItem,
    ContentItemTranslation,
    ContentItemType,
    EntityRelation,
    EntityTranslation,
    OfferingType,
    PublishStatus,
    RelationKind,
    RouteNamespace,
    utcnow,
)

EDITABLE_TYPES = (CatalogueEntityType.DOMAIN.value, CatalogueEntityType.SERVICE.value)


class KeyTaken(Exception):
    pass


class FieldErrors(Exception):
    def __init__(self, problems: list[Problem]) -> None:
        super().__init__(f"{len(problems)} field error(s)")
        self.problems = problems


def localize(problems: list[Problem], locale: Locale) -> list[dict[str, str]]:
    return [
        {
            "field": p.field,
            "message": validation_message(p.type, locale, p.ctx) or validation_message("value_error", locale) or "",
            "type": p.type,
        }
        for p in problems
    ]


def editable_entity(db: Session, entity_id: uuid.UUID) -> CatalogueEntity | None:
    entity = db.get(CatalogueEntity, entity_id)
    return entity if entity is not None and entity.entity_type in EDITABLE_TYPES else None


def has_unpublished_changes(entity: CatalogueEntity) -> bool:
    return entity.status != PublishStatus.ARCHIVED and entity.published_revision != entity.revision


def permissions(entity: CatalogueEntity, role: str) -> list[str]:
    archived = entity.status == PublishStatus.ARCHIVED
    allowed: list[str] = []
    if role in (AdminRole.ADMIN, AdminRole.EDITOR) and not archived:
        allowed.append("edit")
    if role == AdminRole.ADMIN:
        if not archived:
            allowed.append("publish")
        if entity.entity_type == CatalogueEntityType.SERVICE and not archived:
            allowed.append("archive")
        if archived:
            allowed.append("restore")
    return allowed


# --------------------------------------------------------------------------- read


def _names(db: Session, ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[str, str]]:
    names: dict[uuid.UUID, dict[str, str]] = {}
    if ids:
        for row in db.execute(
            select(EntityTranslation.entity_id, EntityTranslation.locale, EntityTranslation.name).where(
                EntityTranslation.entity_id.in_(ids)
            )
        ):
            names.setdefault(row[0], {})[row[1]] = row[2]
    return names


@dataclass
class EntityFilters:
    type: str | None = None
    status: str | None = None
    q: str | None = None
    domain: str | None = None
    offering_type: str | None = None


def list_entities(
    db: Session, f: EntityFilters, page: int, page_size: int
) -> tuple[list[schemas.EntitySummaryOut], int]:
    service = CatalogueService.__table__.alias("svc")
    domain_entity = CatalogueEntity.__table__.alias("dom")
    own_domain = CatalogueDomain.__table__.alias("own")
    query = (
        select(
            CatalogueEntity,
            service.c.offering_type,
            domain_entity.c.key.label("domain_key"),
            own_domain.c.code,
            own_domain.c.band,
            own_domain.c.position.label("domain_position"),
            service.c.position.label("service_position"),
        )
        .outerjoin(service, service.c.id == CatalogueEntity.id)
        .outerjoin(domain_entity, domain_entity.c.id == service.c.primary_domain_id)
        .outerjoin(own_domain, own_domain.c.id == CatalogueEntity.id)
        .where(CatalogueEntity.entity_type.in_(EDITABLE_TYPES))
    )
    if f.type:
        query = query.where(CatalogueEntity.entity_type == f.type)
    if f.status:
        query = query.where(CatalogueEntity.status == f.status)
    if f.offering_type:
        query = query.where(service.c.offering_type == f.offering_type)
    if f.domain:
        query = query.where(or_(domain_entity.c.key == f.domain, CatalogueEntity.key == f.domain))
    if f.q:
        pattern = "%" + f.q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        matches = select(EntityTranslation.entity_id).where(
            or_(EntityTranslation.name.ilike(pattern, escape="\\"), EntityTranslation.slug.ilike(pattern, escape="\\"))
        )
        query = query.where(or_(CatalogueEntity.id.in_(matches), CatalogueEntity.key.ilike(pattern, escape="\\")))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(
        query.order_by(
            CatalogueEntity.entity_type,  # "domain" before "service"
            own_domain.c.code,
            domain_entity.c.key,
            service.c.position,
            CatalogueEntity.key,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    names = _names(db, [row[0].id for row in rows])
    items = [
        schemas.EntitySummaryOut(
            id=entity.id,
            type=entity.entity_type,
            key=entity.key,
            status=entity.status,
            offering_type=offering,
            domain=domain_key if entity.entity_type == CatalogueEntityType.SERVICE else code,
            name_bg=names.get(entity.id, {}).get("bg", entity.key),
            name_en=names.get(entity.id, {}).get("en", entity.key),
            revision=entity.revision,
            published_revision=entity.published_revision,
            has_unpublished_changes=has_unpublished_changes(entity),
            updated_at=entity.updated_at,
            published_at=entity.published_at,
        )
        for entity, offering, domain_key, code, *_ in rows
    ]
    return items, total


def entity_out(db: Session, entity: CatalogueEntity, role: str) -> schemas.EntityOut:
    doc = build_document(db, entity)
    translations = {}
    for locale in LOCALES:
        texts = doc["texts"].get(locale) or {}
        translations[locale] = schemas.TranslationOut(
            slug=texts.get("slug"),
            name=texts.get("name") or entity.key,
            short_name=texts.get("short_name"),
            summary=texts.get("summary"),
            body=texts.get("body"),
            cta_label=texts.get("cta_label"),
            seo_title=texts.get("seo_title"),
            seo_description=texts.get("seo_description"),
        )

    def items(name: str) -> list[schemas.ItemOut]:
        return [
            schemas.ItemOut(bg=schemas.ItemTextOut(**item["bg"]), en=schemas.ItemTextOut(**item["en"]))
            for item in doc.get(name) or []
        ]

    service_fields = domain_fields = None
    if entity.entity_type == CatalogueEntityType.SERVICE:
        duration = doc.get("duration") or {}
        service_fields = schemas.ServiceFieldsOut(
            offering_type=doc["offering_type"],
            primary_domain=doc.get("primary_domain"),
            delivery_status=doc["delivery_status"],
            lead_category=doc.get("lead_category"),
            position=doc["position"],
            duration_min_days=duration.get("min_days"),
            duration_max_days=duration.get("max_days"),
            custom_page=doc["custom_page"],
            is_entry_offer=doc["is_entry_offer"],
        )
    else:
        domain_fields = schemas.DomainFieldsOut(
            code=doc["code"],
            band=doc["band"],
            icon=doc["icon"],
            contact_service=doc.get("contact_service"),
            families=[
                schemas.AdminFamilyOut(
                    key=f["key"],
                    name_bg=(f["texts"].get("bg") or {}).get("name") or f["key"],
                    name_en=(f["texts"].get("en") or {}).get("name") or f["key"],
                    delivery_status=f["delivery_status"],
                    services=f["services"],
                )
                for f in doc.get("families") or []
            ],
        )
    return schemas.EntityOut(
        id=entity.id,
        type=entity.entity_type,
        key=entity.key,
        status=entity.status,
        revision=entity.revision,
        published_revision=entity.published_revision,
        has_unpublished_changes=has_unpublished_changes(entity),
        first_published_at=entity.first_published_at,
        published_at=entity.published_at,
        archived_at=entity.archived_at,
        updated_at=entity.updated_at,
        translations=translations,
        capabilities=items("capabilities"),
        deliverables=items("deliverables"),
        related=doc.get("related") or [],
        service=service_fields,
        domain=domain_fields,
        permissions=permissions(entity, role),
    )


def options(db: Session, role: str) -> schemas.OptionsOut:
    rows = db.execute(
        select(CatalogueEntity, CatalogueDomain.code, CatalogueService.offering_type, CatalogueService.lead_category)
        .outerjoin(CatalogueDomain, CatalogueDomain.id == CatalogueEntity.id)
        .outerjoin(CatalogueService, CatalogueService.id == CatalogueEntity.id)
        .where(CatalogueEntity.entity_type.in_(EDITABLE_TYPES))
        .order_by(CatalogueDomain.code, CatalogueEntity.key)
    ).all()
    names = _names(db, [row[0].id for row in rows])
    used = {row[3] for row in rows if row[3]}

    def name(entity: CatalogueEntity, locale: str) -> str:
        return names.get(entity.id, {}).get(locale, entity.key)

    return schemas.OptionsOut(
        role=role,
        domains=[
            schemas.OptionDomain(key=e.key, code=code, name_bg=name(e, "bg"), name_en=name(e, "en"))
            for e, code, _, _ in rows
            if e.entity_type == CatalogueEntityType.DOMAIN
        ],
        services=[
            schemas.OptionService(
                key=e.key, offering_type=kind, status=e.status, name_bg=name(e, "bg"), name_en=name(e, "en")
            )
            for e, _, kind, _ in rows
            if e.entity_type == CatalogueEntityType.SERVICE
        ],
        free_lead_categories=[c.value for c in LEAD_CATEGORIES if c.value not in used],
    )


def history(db: Session, entity: CatalogueEntity, limit: int = 50) -> list[schemas.HistoryEntry]:
    rows = db.scalars(
        select(AuditLog)
        .where(AuditLog.entity_type == f"catalogue.{entity.entity_type}", AuditLog.entity_id == str(entity.id))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
    ).all()
    return [
        schemas.HistoryEntry(action=r.action, actor_label=r.actor_label, created_at=r.created_at, details=r.details)
        for r in rows
    ]


# --------------------------------------------------------------------------- write


def _id_by_key(db: Session, entity_type: str, key: str) -> uuid.UUID | None:
    return db.scalar(
        select(CatalogueEntity.id).where(CatalogueEntity.entity_type == entity_type, CatalogueEntity.key == key)
    )


def create_service(db: Session, payload: schemas.EntityCreate, actor_id: uuid.UUID) -> CatalogueEntity:
    problems: list[Problem] = []
    if _id_by_key(db, CatalogueEntityType.SERVICE.value, payload.key):
        raise KeyTaken()
    domain_id = None
    if payload.primary_domain:
        domain_id = _id_by_key(db, CatalogueEntityType.DOMAIN.value, payload.primary_domain)
        if domain_id is None:
            problems.append(Problem("primary_domain", "unknown_reference"))
    category = payload.lead_category.value if payload.lead_category else None
    if category and db.scalar(select(CatalogueService.id).where(CatalogueService.lead_category == category)):
        problems.append(Problem("lead_category", "lead_category_taken"))
    if problems:
        raise FieldErrors(problems)

    now = utcnow()
    entity = CatalogueEntity(
        id=uuid.uuid4(),
        entity_type=CatalogueEntityType.SERVICE.value,
        key=payload.key,
        status=PublishStatus.DRAFT.value,
        revision=1,
        created_at=now,
        updated_at=now,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    db.add(entity)
    db.flush()
    position = db.scalar(
        select(func.coalesce(func.max(CatalogueService.position) + 1, 0)).where(
            CatalogueService.primary_domain_id == domain_id
        )
    )
    db.add(
        CatalogueService(
            id=entity.id,
            offering_type=payload.offering_type,
            primary_domain_id=domain_id,
            delivery_status="custom" if payload.offering_type != OfferingType.SERVICE else "available",
            lead_category=category,
            position=min(int(position or 0), 999),
        )
    )
    for locale, name in (("bg", payload.name_bg), ("en", payload.name_en)):
        db.add(EntityTranslation(entity_id=entity.id, locale=locale, name=name, updated_at=now))
    db.flush()
    return entity


def _replace_items(
    db: Session, entity_id: uuid.UUID, item_type: ContentItemType, items: list[schemas.ItemEdit]
) -> None:
    db.execute(delete(ContentItem).where(ContentItem.entity_id == entity_id, ContentItem.item_type == item_type.value))
    db.flush()
    for position, item in enumerate(items):
        row = ContentItem(id=uuid.uuid4(), entity_id=entity_id, item_type=item_type.value, position=position)
        db.add(row)
        db.flush()
        for locale in LOCALES:
            text = getattr(item, locale)
            title = text.title if item_type == ContentItemType.CAPABILITY else None
            if title or text.body:
                db.add(ContentItemTranslation(item_id=row.id, locale=locale, title=title, body=text.body))


def _replace_relations(
    db: Session, entity: CatalogueEntity, kind: RelationKind, target_type: str, ids: list[uuid.UUID]
) -> None:
    db.execute(
        delete(EntityRelation).where(EntityRelation.from_entity_id == entity.id, EntityRelation.kind == kind.value)
    )
    db.flush()
    for position, target in enumerate(ids):
        db.add(
            EntityRelation(
                from_entity_id=entity.id,
                from_type=entity.entity_type,
                kind=kind.value,
                to_entity_id=target,
                to_type=target_type,
                position=position,
            )
        )


def _comparable(doc: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in doc.items() if k not in ("revision", "families", "schema")}


def update_entity(
    db: Session, entity: CatalogueEntity, payload: schemas.EntityUpdate, actor_id: uuid.UUID
) -> list[str]:
    """Replace the working copy. Returns the changed top-level areas ([] = nothing changed)."""
    is_service = entity.entity_type == CatalogueEntityType.SERVICE
    problems: list[Problem] = []

    # References first: everything is validated before anything is written.
    related_type = CatalogueEntityType.SERVICE.value if is_service else CatalogueEntityType.DOMAIN.value
    related_ids: list[uuid.UUID] = []
    for index, key in enumerate(dict.fromkeys(payload.related)):
        target = _id_by_key(db, related_type, key)
        if target is None:
            problems.append(Problem(f"related.{index}", "unknown_reference"))
        elif target == entity.id:
            problems.append(Problem(f"related.{index}", "self_reference"))
        else:
            related_ids.append(target)

    if not is_service and payload.capabilities:
        problems.append(Problem("capabilities", "items_not_allowed"))
    if not is_service and payload.service is not None:
        problems.append(Problem("service", "value_error"))

    service = db.get(CatalogueService, entity.id) if is_service else None
    domain_id = None
    if service is not None:
        fields = payload.service
        if fields is None:
            problems.append(Problem("service", "missing"))
        else:
            if fields.primary_domain:
                domain_id = _id_by_key(db, CatalogueEntityType.DOMAIN.value, fields.primary_domain)
                if domain_id is None:
                    problems.append(Problem("service.primary_domain", "unknown_reference"))
            elif service.offering_type == OfferingType.SERVICE:
                problems.append(Problem("service.primary_domain", "primary_domain_required"))
            if fields.duration_min_days is not None and service.offering_type == OfferingType.SERVICE:
                problems.append(Problem("service.duration_min_days", "duration_offering"))

    for locale in LOCALES:
        slug = getattr(payload.translations, locale).slug
        if slug:
            clash = db.scalar(
                select(EntityTranslation.entity_id).where(
                    EntityTranslation.locale == locale,
                    EntityTranslation.route_namespace == RouteNamespace.SERVICES.value,
                    EntityTranslation.slug == slug,
                    EntityTranslation.entity_id != entity.id,
                )
            )
            if clash:
                problems.append(Problem(f"translations.{locale}.slug", "slug_taken"))
    if problems:
        raise FieldErrors(problems)

    before = _comparable(build_document(db, entity))
    now = utcnow()
    for locale in LOCALES:
        text = getattr(payload.translations, locale)
        row = db.get(EntityTranslation, (entity.id, locale))
        if row is None:
            row = EntityTranslation(entity_id=entity.id, locale=locale, name=text.name, updated_at=now)
            db.add(row)
        values = {
            "route_namespace": RouteNamespace.SERVICES.value if text.slug else None,
            "slug": text.slug,
            "name": text.name,
            "short_name": text.short_name if is_service else None,
            "summary": text.summary,
            "body": text.body,
            "cta_label": text.cta_label if not is_service else None,
            "seo_title": text.seo_title,
            "seo_description": text.seo_description,
        }
        if any(getattr(row, k) != v for k, v in values.items()):
            for k, v in values.items():
                setattr(row, k, v)
            row.updated_at = now

    if is_service:
        _replace_items(db, entity.id, ContentItemType.CAPABILITY, payload.capabilities)
    _replace_items(db, entity.id, ContentItemType.DELIVERABLE, payload.deliverables)
    _replace_relations(
        db, entity, RelationKind.RELATED if is_service else RelationKind.CROSS_SELL, related_type, related_ids
    )
    if service is not None and payload.service is not None:
        fields = payload.service
        service.primary_domain_id = domain_id
        service.delivery_status = fields.delivery_status
        service.position = fields.position
        service.duration_min_days = Decimal(str(fields.duration_min_days)) if fields.duration_min_days else None
        service.duration_max_days = Decimal(str(fields.duration_max_days)) if fields.duration_max_days else None
    db.flush()

    after = _comparable(build_document(db, entity))
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    if changed:
        entity.revision += 1
        entity.updated_at = now
        entity.updated_by_id = actor_id
    return changed
