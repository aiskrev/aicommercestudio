"""Published read model of the catalogue and the public response builders.

Only `published_snapshot` documents of published domains and services are read; working rows,
drafts, archived entries and admin metadata never reach these functions. References to entries that
are not published are dropped at read time, so publishing or archiving one entry never exposes or
breaks another.

Cache: the parsed snapshots are kept in process, keyed by (published count, latest publication
time). Every request checks that key with one aggregate query, so a publish or archive is visible
on the next request in every API process. HTTP caching is described in API_REFERENCE.md.
"""

from __future__ import annotations

import threading
from collections.abc import Iterable
from dataclasses import dataclass, field, replace
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.catalogue import api_schemas as out
from app.models import CatalogueEntity, CatalogueEntityType, PublishStatus

BAND_ORDER = {"ai": 0, "engineering": 1, "operations": 2}
OFFERING_ORDER = {"service": 0, "assessment": 1, "workshop": 2}
DELIVERY_RANK = {"available": 2, "custom": 1, "planned": 0}
PUBLIC_TYPES = (CatalogueEntityType.DOMAIN.value, CatalogueEntityType.SERVICE.value)


@dataclass(frozen=True)
class Catalogue:
    version: tuple[Any, ...]
    domains: dict[str, dict[str, Any]] = field(default_factory=dict)
    services: dict[str, dict[str, Any]] = field(default_factory=dict)

    def with_document(self, document: dict[str, Any]) -> Catalogue:
        """This catalogue as it would be with `document` published (admin preview)."""
        target = "domains" if document["type"] == CatalogueEntityType.DOMAIN else "services"
        entries = dict(getattr(self, target))
        entries[document["key"]] = document
        return replace(self, version=("preview",), **{target: entries})


_lock = threading.Lock()
_cached: Catalogue | None = None


def published_catalogue(db: Session) -> Catalogue:
    global _cached
    published = (CatalogueEntity.status == PublishStatus.PUBLISHED.value) & CatalogueEntity.entity_type.in_(
        PUBLIC_TYPES
    )
    version = tuple(db.execute(select(func.count(), func.max(CatalogueEntity.published_at)).where(published)).one())
    cached = _cached
    if cached is not None and cached.version == version:
        return cached
    rows = db.execute(
        select(CatalogueEntity.entity_type, CatalogueEntity.key, CatalogueEntity.published_snapshot).where(published)
    ).all()
    catalogue = Catalogue(
        version=version,
        domains={key: snap for kind, key, snap in rows if kind == CatalogueEntityType.DOMAIN},
        services={key: snap for kind, key, snap in rows if kind == CatalogueEntityType.SERVICE},
    )
    with _lock:
        _cached = catalogue
    return catalogue


def reset_cache() -> None:
    global _cached
    with _lock:
        _cached = None


# --------------------------------------------------------------------------- ordering


def domain_order(doc: dict[str, Any]) -> tuple[int, int, str]:
    return BAND_ORDER.get(doc["band"], 9), doc["position"], doc["key"]


def service_order(cat: Catalogue, doc: dict[str, Any]) -> tuple[Any, ...]:
    domain = cat.domains.get(doc.get("primary_domain") or "")
    return (
        0 if domain else 1,
        domain_order(domain) if domain else (9, 0, ""),
        OFFERING_ORDER.get(doc["offering_type"], 9),
        doc["position"],
        doc["key"],
    )


def sorted_domains(cat: Catalogue) -> list[dict[str, Any]]:
    return sorted(cat.domains.values(), key=domain_order)


def sorted_services(cat: Catalogue, docs: Iterable[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    return sorted(cat.services.values() if docs is None else docs, key=lambda d: service_order(cat, d))


# --------------------------------------------------------------------------- lookups


def _text(doc: dict[str, Any], locale: str, name: str) -> Any:
    return (doc["texts"].get(locale) or {}).get(name)


def find_by_slug(entries: dict[str, dict[str, Any]], locale: str, slug: str) -> dict[str, Any] | None:
    return next((doc for doc in entries.values() if _text(doc, locale, "slug") == slug), None)


def domain_ref(cat: Catalogue, key: str | None, locale: str) -> out.DomainRef | None:
    doc = cat.domains.get(key or "")
    if doc is None:
        return None
    return out.DomainRef(
        key=doc["key"], code=doc["code"], slug=_text(doc, locale, "slug"), name=_text(doc, locale, "name")
    )


def service_ref(cat: Catalogue, key: str, locale: str) -> out.ServiceRef | None:
    doc = cat.services.get(key)
    if doc is None:
        return None
    return out.ServiceRef(
        key=doc["key"],
        offering_type=doc["offering_type"],
        slug=_text(doc, locale, "slug"),
        name=_text(doc, locale, "name"),
        short_name=_text(doc, locale, "short_name"),
        delivery_status=doc["delivery_status"],
    )


def _refs(cat: Catalogue, keys: Iterable[str], locale: str) -> list[out.ServiceRef]:
    return [ref for key in keys if (ref := service_ref(cat, key, locale)) is not None]


def _domain_refs(cat: Catalogue, keys: Iterable[str], locale: str) -> list[out.DomainRef]:
    return [ref for key in keys if (ref := domain_ref(cat, key, locale)) is not None]


def _alternate(doc: dict[str, Any]) -> out.AlternateSlugs:
    return out.AlternateSlugs(bg=_text(doc, "bg", "slug"), en=_text(doc, "en", "slug"))


def _items(doc: dict[str, Any], name: str, locale: str) -> list[dict[str, Any]]:
    return [item.get(locale) or {} for item in doc.get(name) or []]


# --------------------------------------------------------------------------- domains


def _live_families(doc: dict[str, Any]) -> list[dict[str, Any]]:
    return [f for f in doc.get("families") or [] if not f.get("archived")]


def domain_delivery(doc: dict[str, Any]) -> str:
    statuses = [f["delivery_status"] for f in _live_families(doc)]
    return max(statuses, key=DELIVERY_RANK.__getitem__) if statuses else "planned"


def domain_services(cat: Catalogue, key: str) -> list[dict[str, Any]]:
    return sorted_services(cat, (s for s in cat.services.values() if s.get("primary_domain") == key))


def domain_summary(cat: Catalogue, doc: dict[str, Any], locale: str) -> out.DomainSummary:
    return out.DomainSummary(
        key=doc["key"],
        code=doc["code"],
        band=doc["band"],
        icon=doc["icon"],
        slug=_text(doc, locale, "slug"),
        alternate_slugs=_alternate(doc),
        name=_text(doc, locale, "name"),
        summary=_text(doc, locale, "summary"),
        delivery_status=domain_delivery(doc),
        service_count=len(domain_services(cat, doc["key"])),
    )


def domain_detail(cat: Catalogue, doc: dict[str, Any], locale: str) -> out.DomainDetail:
    summary = domain_summary(cat, doc, locale)
    return out.DomainDetail(
        **summary.model_dump(),
        locale=locale,
        body=_text(doc, locale, "body"),
        cta_label=_text(doc, locale, "cta_label"),
        contact_service=_contact_category(cat, doc.get("contact_service")),
        seo=out.Seo(title=_text(doc, locale, "seo_title"), description=_text(doc, locale, "seo_description")),
        deliverables=[item["body"] for item in _items(doc, "deliverables", locale)],
        families=[
            out.Family(
                key=f["key"],
                name=f["texts"][locale]["name"],
                summary=f["texts"][locale]["summary"],
                delivery_status=f["delivery_status"],
                prerequisite=f["texts"][locale].get("prerequisite"),
                services=_refs(cat, f["services"], locale),
                via=_domain_refs(cat, f["via"], locale),
            )
            for f in _live_families(doc)
        ],
        services=_refs(cat, (s["key"] for s in domain_services(cat, doc["key"])), locale),
        related_domains=_domain_refs(cat, doc.get("related") or [], locale),
    )


def _contact_category(cat: Catalogue, service_key: str | None) -> str | None:
    service = cat.services.get(service_key or "")
    return service.get("lead_category") if service else None


# --------------------------------------------------------------------------- services


def service_summary(cat: Catalogue, doc: dict[str, Any], locale: str) -> out.ServiceSummary:
    duration = doc.get("duration")
    return out.ServiceSummary(
        key=doc["key"],
        offering_type=doc["offering_type"],
        slug=_text(doc, locale, "slug"),
        alternate_slugs=_alternate(doc),
        name=_text(doc, locale, "name"),
        short_name=_text(doc, locale, "short_name"),
        summary=_text(doc, locale, "summary"),
        delivery_status=doc["delivery_status"],
        primary_domain=domain_ref(cat, doc.get("primary_domain"), locale),
        is_entry_offer=doc["is_entry_offer"],
        custom_page=doc["custom_page"],
        duration=out.Duration(**duration) if duration else None,
    )


def related(cat: Catalogue, doc: dict[str, Any], locale: str) -> out.Related:
    """Explicitly related entries, plus the assessments and workshops of the same primary domain."""
    keys = [k for k in doc.get("related") or [] if k in cat.services and k != doc["key"]]
    domain = doc.get("primary_domain")
    if domain:
        for other in domain_services(cat, domain):
            if other["offering_type"] != "service" and other["key"] not in keys and other["key"] != doc["key"]:
                keys.append(other["key"])
    by_type: dict[str, list[str]] = {"service": [], "assessment": [], "workshop": []}
    for key in keys:
        by_type[cat.services[key]["offering_type"]].append(key)
    return out.Related(
        services=_refs(cat, by_type["service"], locale),
        assessments=_refs(cat, by_type["assessment"], locale),
        workshops=_refs(cat, by_type["workshop"], locale),
    )


def service_detail(cat: Catalogue, doc: dict[str, Any], locale: str) -> out.ServiceDetail:
    summary = service_summary(cat, doc, locale)
    families = []
    for family in doc.get("families") or []:
        domain = cat.domains.get(family["domain"])
        if domain is None:
            continue
        match = next((f for f in _live_families(domain) if f["key"] == family["key"]), None)
        ref = domain_ref(cat, family["domain"], locale)
        if match is not None and ref is not None:
            families.append(out.FamilyRef(key=family["key"], name=match["texts"][locale]["name"], domain=ref))
    return out.ServiceDetail(
        **summary.model_dump(),
        locale=locale,
        body=_text(doc, locale, "body"),
        seo=out.Seo(title=_text(doc, locale, "seo_title"), description=_text(doc, locale, "seo_description")),
        lead_category=doc.get("lead_category"),
        capabilities=[
            out.Capability(title=item["title"], description=item["body"])
            for item in _items(doc, "capabilities", locale)
        ],
        deliverables=[item["body"] for item in _items(doc, "deliverables", locale)],
        families=families,
        related=related(cat, doc, locale),
    )


def filter_services(
    cat: Catalogue,
    locale: str,
    *,
    domains: list[str],
    offering_types: list[str],
    delivery: list[str],
    q: str | None,
    sort: str,
) -> list[dict[str, Any]]:
    docs = list(cat.services.values())
    if domains:
        docs = [d for d in docs if d.get("primary_domain") in domains]
    if offering_types:
        docs = [d for d in docs if d["offering_type"] in offering_types]
    if delivery:
        docs = [d for d in docs if d["delivery_status"] in delivery]
    if q:
        needle = q.casefold()
        docs = [
            d
            for d in docs
            if needle in (_text(d, locale, "name") or "").casefold()
            or needle in (_text(d, locale, "summary") or "").casefold()
        ]
    if sort == "name":
        return sorted(docs, key=lambda d: ((_text(d, locale, "name") or "").casefold(), d["key"]))
    return sorted_services(cat, docs)
