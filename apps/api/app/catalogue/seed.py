"""Idempotent, deterministic seeding of the service catalogue from `seed_v1.json`.

The web content is the source of truth until phase S5 (SERVICE_CATALOGUE_ARCHITECTURE §11), so the
seed *reconciles* the database with the document:

* entities are matched by (entity_type, key); new ones get a deterministic UUID (uuid5 of type and
  key), so every environment has the same ids;
* changed fields, translations, family links and relations are updated in place, and the entity's
  revision is incremented once per run in which anything about it changed;
* nothing is deleted. Entities that exist in the database but not in the document are reported
  (`extra`) and left untouched, so a mistaken document can never remove published content;
* everything happens in one transaction; any validation or database error rolls the whole run back.

Leads are never read or written. The backfill guarantee for existing service references is a
validation rule: every lead category (ServiceKey except `other`) must map to exactly one service.
"""

from __future__ import annotations

import json
import uuid
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import audit
from app.catalogue.schemas import DomainSeed, FamilySeed, SeedDocument, ServiceSeed
from app.models import (
    LEAD_CATEGORIES,
    CatalogueDomain,
    CatalogueEntity,
    CatalogueEntityType,
    CatalogueFamily,
    CatalogueService,
    EntityRelation,
    EntityTranslation,
    FamilyService,
    PublishStatus,
    RelationKind,
    RouteNamespace,
    utcnow,
)

SEED_FILE = Path(__file__).with_name("seed_v1.json")
# Fixed namespace for deterministic entity ids: uuid5(NAMESPACE, "<entity_type>:<key>").
CATALOGUE_NAMESPACE = uuid.UUID("6f1c2a52-3b7e-4d0a-9c41-0d5e8a7b2c10")
LOCALES = ("bg", "en")


class SeedValidationError(ValueError):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(f"{len(problems)} problem(s) in the catalogue seed: " + "; ".join(problems[:10]))
        self.problems = problems


@dataclass
class SeedResult:
    created: Counter[str] = field(default_factory=Counter)
    updated: Counter[str] = field(default_factory=Counter)
    unchanged: Counter[str] = field(default_factory=Counter)
    extra: list[str] = field(default_factory=list)

    @property
    def changed(self) -> bool:
        return bool(self.created or self.updated)

    def summary(self) -> str:
        def fmt(counter: Counter[str]) -> str:
            return ", ".join(f"{kind}={counter[kind]}" for kind in ("domain", "family", "service") if counter[kind])

        parts = [f"created: {fmt(self.created) or 'none'}", f"updated: {fmt(self.updated) or 'none'}"]
        parts.append(f"unchanged: {sum(self.unchanged.values())}")
        if self.extra:
            parts.append(f"not in seed (left untouched): {', '.join(self.extra)}")
        return "; ".join(parts)


def entity_id(entity_type: str, key: str) -> uuid.UUID:
    return uuid.uuid5(CATALOGUE_NAMESPACE, f"{entity_type}:{key}")


# --------------------------------------------------------------------------- document


def load_document(path: Path = SEED_FILE) -> SeedDocument:
    return SeedDocument.model_validate(json.loads(path.read_text(encoding="utf-8")))


def validate_document(doc: SeedDocument) -> list[str]:
    """Cross-reference rules a single model cannot express (SERVICE_TAXONOMY §7 subset for V1)."""
    problems: list[str] = []
    domains = {d.key: d for d in doc.domains}
    services = {s.key: s for s in doc.services}

    def dupes(values: list[str], label: str) -> None:
        for value, count in Counter(values).items():
            if count > 1:
                problems.append(f"duplicate {label}: {value}")

    dupes([d.key for d in doc.domains], "domain key")
    dupes([f.key for f in doc.families], "family key")
    dupes([s.key for s in doc.services], "service key")
    dupes([d.code for d in doc.domains], "domain code")
    dupes([f"{d.band}:{d.position}" for d in doc.domains], "domain band position")
    dupes([f"{f.domain}:{f.position}" for f in doc.families], "family position")
    if sorted(doc.locales) != sorted(LOCALES):
        problems.append(f"locales must be {LOCALES}")

    for domain in doc.domains:
        if domain.contact_service not in services:
            problems.append(f"domain {domain.key}: unknown contact service {domain.contact_service}")
        for key in domain.related:
            if key not in domains or key == domain.key:
                problems.append(f"domain {domain.key}: invalid related domain {key}")
        for locale in LOCALES:
            text = getattr(domain.translations, locale)
            if domain.status == "published" and len(text.seo_title) > 60:
                problems.append(f"domain {domain.key} ({locale}): SEO title longer than 60 characters")
            if domain.status == "published" and not 120 <= len(text.seo_description) <= 160:
                problems.append(f"domain {domain.key} ({locale}): SEO description outside 120–160 characters")

    for family in doc.families:
        if family.domain not in domains:
            problems.append(f"family {family.key}: unknown domain {family.domain}")
        elif not family.key.startswith(f"{family.domain}."):
            problems.append(f"family {family.key}: key must start with '{family.domain}.'")
        for key in family.services:
            if key not in services:
                problems.append(f"family {family.key}: unknown service {key}")
        for key in family.via:
            if key not in domains or key == family.domain:
                problems.append(f"family {family.key}: invalid via domain {key}")
        if family.delivery_status == "planned":
            for locale in LOCALES:
                if not getattr(family.translations, locale).prerequisite:
                    problems.append(f"family {family.key} ({locale}): planned family needs a prerequisite")

    for service in doc.services:
        if service.primary_domain not in domains:
            problems.append(f"service {service.key}: unknown primary domain {service.primary_domain}")
        for key in service.related:
            if key not in services or key == service.key:
                problems.append(f"service {service.key}: invalid related service {key}")
    dupes([s.lead_category.value for s in doc.services], "lead category")
    mapped = {s.lead_category for s in doc.services}
    for category in LEAD_CATEGORIES:
        if category not in mapped:
            problems.append(f"lead category {category.value} has no catalogue service")
    if any(s.lead_category.value == "other" for s in doc.services):
        problems.append("lead category 'other' cannot be a catalogue service")

    # Domains and services share the /uslugi namespace; primary keywords must not repeat.
    for locale in LOCALES:
        slugs = [getattr(d.translations, locale).slug for d in doc.domains]
        slugs += [getattr(s.translations, locale).slug for s in doc.services]
        dupes(slugs, f"{locale} slug")
        keywords = [getattr(e.translations, locale).primary_keyword for e in [*doc.domains, *doc.services]]
        dupes([k.lower() for k in keywords if k], f"{locale} primary keyword")
    return problems


# --------------------------------------------------------------------------- reconciliation


def _assign(row: Any, values: dict[str, Any]) -> bool:
    changed = False
    for name, value in values.items():
        if getattr(row, name) != value:
            setattr(row, name, value)
            changed = True
    return changed


class _Seeder:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.now = utcnow()
        self.result = SeedResult()
        self.ids: dict[tuple[str, str], uuid.UUID] = {}
        self.touched: set[uuid.UUID] = set()
        self.created: set[uuid.UUID] = set()

    def entity(self, entity_type: str, key: str, status: str) -> CatalogueEntity:
        row = self.db.scalar(
            select(CatalogueEntity).where(CatalogueEntity.entity_type == entity_type, CatalogueEntity.key == key)
        )
        if row is None:
            row = CatalogueEntity(
                id=entity_id(entity_type, key),
                entity_type=entity_type,
                key=key,
                status=status,
                revision=1,
                created_at=self.now,
                updated_at=self.now,
            )
            self.db.add(row)
            self.created.add(row.id)
        elif row.status != status:
            row.status = status
            self.touched.add(row.id)
        row.archived_at = (row.archived_at or self.now) if status == PublishStatus.ARCHIVED else None
        if status == PublishStatus.PUBLISHED and row.first_published_at is None:
            row.first_published_at = self.now
        self.ids[(entity_type, key)] = row.id
        return row

    def id_of(self, entity_type: CatalogueEntityType, key: str) -> uuid.UUID:
        return self.ids[(entity_type.value, key)]

    def subtype(self, model: type, row_id: uuid.UUID, values: dict[str, Any]) -> None:
        row = self.db.get(model, row_id)
        if row is None:
            self.db.add(model(id=row_id, **values))
            self.touched.add(row_id)
        elif _assign(row, values):
            self.touched.add(row_id)

    def translations(self, row_id: uuid.UUID, wanted: dict[str, dict[str, Any]]) -> None:
        rows = self.db.scalars(select(EntityTranslation).where(EntityTranslation.entity_id == row_id))
        existing = {t.locale: t for t in rows}
        for locale, values in wanted.items():
            row = existing.pop(locale, None)
            if row is None:
                self.db.add(EntityTranslation(entity_id=row_id, locale=locale, updated_at=self.now, **values))
                self.touched.add(row_id)
            elif _assign(row, values):
                row.updated_at = self.now
                self.touched.add(row_id)
        for row in existing.values():
            self.db.delete(row)
            self.touched.add(row_id)

    def family_links(self, family_id: uuid.UUID, service_ids: list[uuid.UUID]) -> None:
        wanted = {service_id: position for position, service_id in enumerate(service_ids)}
        existing = {
            link.service_id: link
            for link in self.db.scalars(select(FamilyService).where(FamilyService.family_id == family_id))
        }
        for service_id, link in existing.items():
            if service_id not in wanted:
                self.db.delete(link)
                self.touched.add(family_id)
            elif link.position != wanted[service_id]:
                link.position = wanted[service_id]
                self.touched.add(family_id)
        for service_id, position in wanted.items():
            if service_id not in existing:
                self.db.add(FamilyService(family_id=family_id, service_id=service_id, position=position))
                self.touched.add(family_id)

    def relations(
        self,
        from_id: uuid.UUID,
        from_type: CatalogueEntityType,
        kind: RelationKind,
        to_type: CatalogueEntityType,
        to_ids: list[uuid.UUID],
    ) -> None:
        wanted = {to_id: position for position, to_id in enumerate(to_ids)}
        existing = {
            rel.to_entity_id: rel
            for rel in self.db.scalars(
                select(EntityRelation).where(
                    EntityRelation.from_entity_id == from_id, EntityRelation.kind == kind.value
                )
            )
        }
        for to_id, rel in existing.items():
            if to_id not in wanted:
                self.db.delete(rel)
                self.touched.add(from_id)
            elif rel.position != wanted[to_id]:
                rel.position = wanted[to_id]
                self.touched.add(from_id)
        for to_id, position in wanted.items():
            if to_id not in existing:
                self.db.add(
                    EntityRelation(
                        from_entity_id=from_id,
                        from_type=from_type.value,
                        kind=kind.value,
                        to_entity_id=to_id,
                        to_type=to_type.value,
                        position=position,
                    )
                )
                self.touched.add(from_id)


def _domain_text(domain: DomainSeed, locale: str) -> dict[str, Any]:
    t = getattr(domain.translations, locale)
    return {
        "route_namespace": RouteNamespace.SERVICES.value,
        "slug": t.slug,
        "name": t.name,
        "short_name": None,
        "summary": t.summary,
        "body": t.body,
        "cta_label": t.cta_label,
        "prerequisite": None,
        "seo_title": t.seo_title,
        "seo_description": t.seo_description,
        "primary_keyword": t.primary_keyword,
    }


def _family_text(family: FamilySeed, locale: str) -> dict[str, Any]:
    t = getattr(family.translations, locale)
    return {
        "route_namespace": None,
        "slug": None,
        "name": t.name,
        "short_name": None,
        "summary": t.summary,
        "body": None,
        "cta_label": None,
        "prerequisite": t.prerequisite,
        "seo_title": None,
        "seo_description": None,
        "primary_keyword": None,
    }


def _service_text(service: ServiceSeed, locale: str) -> dict[str, Any]:
    t = getattr(service.translations, locale)
    return {
        "route_namespace": RouteNamespace.SERVICES.value,
        "slug": t.slug,
        "name": t.name,
        "short_name": t.short_name,
        "summary": t.summary,
        "body": t.body,
        "cta_label": None,
        "prerequisite": None,
        "seo_title": t.seo_title,
        "seo_description": t.seo_description,
        "primary_keyword": t.primary_keyword,
    }


def seed_catalogue(db: Session, doc: SeedDocument | None = None, *, dry_run: bool = False) -> SeedResult:
    """Reconcile the catalogue with the seed document in one transaction (rolled back on dry run)."""
    doc = doc or load_document()
    problems = validate_document(doc)
    if problems:
        raise SeedValidationError(problems)

    s = _Seeder(db)
    domain, family, service = CatalogueEntityType.DOMAIN, CatalogueEntityType.FAMILY, CatalogueEntityType.SERVICE
    try:
        # 1. Entities (supertype rows), then subtypes in dependency order.
        for d in doc.domains:
            s.entity(domain.value, d.key, d.status)
        for f in doc.families:
            s.entity(family.value, f.key, f.status)
        for sv in doc.services:
            s.entity(service.value, sv.key, sv.status)
        db.flush()

        for d in doc.domains:
            existing = db.get(CatalogueDomain, s.id_of(domain, d.key))
            # contact_service_id is set after the services exist (the two tables reference each other).
            contact = existing.contact_service_id if existing else None
            s.subtype(
                CatalogueDomain,
                s.id_of(domain, d.key),
                {"code": d.code, "band": d.band, "icon": d.icon, "position": d.position, "contact_service_id": contact},
            )
        db.flush()
        for f in doc.families:
            s.subtype(
                CatalogueFamily,
                s.id_of(family, f.key),
                {"domain_id": s.id_of(domain, f.domain), "delivery_status": f.delivery_status, "position": f.position},
            )
        for sv in doc.services:
            s.subtype(
                CatalogueService,
                s.id_of(service, sv.key),
                {
                    "offering_type": sv.offering_type,
                    "primary_domain_id": s.id_of(domain, sv.primary_domain),
                    "delivery_status": sv.delivery_status,
                    "lead_category": sv.lead_category.value,
                    "icon": sv.icon,
                    "custom_page": sv.custom_page,
                    "is_entry_offer": sv.is_entry_offer,
                    "position": sv.position,
                },
            )
        db.flush()
        for d in doc.domains:
            row = db.get(CatalogueDomain, s.id_of(domain, d.key))
            if row is not None and _assign(row, {"contact_service_id": s.id_of(service, d.contact_service)}):
                s.touched.add(row.id)

        # 2. Translations, family links and relations.
        for d in doc.domains:
            s.translations(s.id_of(domain, d.key), {loc: _domain_text(d, loc) for loc in LOCALES})
            s.relations(
                s.id_of(domain, d.key), domain, RelationKind.CROSS_SELL, domain, [s.id_of(domain, k) for k in d.related]
            )
        for f in doc.families:
            fid = s.id_of(family, f.key)
            s.translations(fid, {loc: _family_text(f, loc) for loc in LOCALES})
            s.family_links(fid, [s.id_of(service, k) for k in f.services])
            s.relations(fid, family, RelationKind.DELIVERED_THROUGH, domain, [s.id_of(domain, k) for k in f.via])
        for sv in doc.services:
            sid = s.id_of(service, sv.key)
            s.translations(sid, {loc: _service_text(sv, loc) for loc in LOCALES})
            s.relations(sid, service, RelationKind.RELATED, service, [s.id_of(service, k) for k in sv.related])
        db.flush()

        # 3. Revisions, counts and the untouched remainder.
        for (entity_type, _key), row_id in s.ids.items():
            if row_id in s.created:
                s.result.created[entity_type] += 1
            elif row_id in s.touched:
                row = db.get(CatalogueEntity, row_id)
                assert row is not None
                row.revision += 1
                row.updated_at = s.now
                s.result.updated[entity_type] += 1
            else:
                s.result.unchanged[entity_type] += 1
        known = set(s.ids.values())
        s.result.extra = sorted(
            f"{row.entity_type}:{row.key}" for row in db.scalars(select(CatalogueEntity)) if row.id not in known
        )

        if s.result.changed:
            audit.record(
                db,
                "catalogue.seeded",
                actor_label="cli",
                entity_type="catalogue",
                details={
                    "created": dict(s.result.created),
                    "updated": dict(s.result.updated),
                    "schema_version": doc.schema_version,
                },
            )
        if dry_run:
            db.rollback()
        else:
            db.commit()
    except Exception:
        db.rollback()
        raise
    return s.result


# --------------------------------------------------------------------------- integrity check


def catalogue_problems(db: Session) -> list[str]:
    """Rules that span rows and therefore live outside the schema (checked by `catalogue-check`)."""
    problems: list[str] = []
    entities = {row.id: row for row in db.scalars(select(CatalogueEntity))}
    translations: dict[uuid.UUID, dict[str, EntityTranslation]] = {}
    for t in db.scalars(select(EntityTranslation)):
        translations.setdefault(t.entity_id, {})[t.locale] = t

    routable = {CatalogueEntityType.DOMAIN.value, CatalogueEntityType.SERVICE.value}
    for row in entities.values():
        if row.status != PublishStatus.PUBLISHED:
            continue
        texts = translations.get(row.id, {})
        for locale in LOCALES:
            text = texts.get(locale)
            if text is None:
                problems.append(f"{row.entity_type}:{row.key} is published without {locale} content")
            elif row.entity_type in routable and not text.slug:
                problems.append(f"{row.entity_type}:{row.key} ({locale}) has no slug")
        if row.entity_type == CatalogueEntityType.DOMAIN.value:
            domain = db.get(CatalogueDomain, row.id)
            if domain is None or domain.contact_service_id is None:
                problems.append(f"domain:{row.key} is published without a contact service")

    published_categories = {
        s.lead_category
        for s in db.scalars(select(CatalogueService))
        if entities.get(s.id) is not None and entities[s.id].status == PublishStatus.PUBLISHED
    }
    for category in LEAD_CATEGORIES:
        if category.value not in published_categories:
            problems.append(f"lead category {category.value} has no published catalogue service")
    return problems


def purge_catalogue(db: Session) -> int:
    """Delete every catalogue row (rollback helper; leads are not affected). Returns the entity count."""
    count = len(db.scalars(select(CatalogueEntity.id)).all())
    db.execute(delete(EntityRelation))
    db.execute(delete(FamilyService))
    db.execute(delete(EntityTranslation))
    db.execute(delete(CatalogueFamily))
    # Break the domain ↔ service reference cycle before deleting either side.
    for row in db.scalars(select(CatalogueDomain)):
        row.contact_service_id = None
    db.flush()
    db.execute(delete(CatalogueService))
    db.execute(delete(CatalogueDomain))
    db.execute(delete(CatalogueEntity))
    audit.record(db, "catalogue.purged", actor_label="cli", entity_type="catalogue", details={"entities": count})
    db.commit()
    return count
