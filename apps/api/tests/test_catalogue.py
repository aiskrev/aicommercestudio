"""Service catalogue V1: seed document, idempotent seeding, integrity rules and schema constraints."""

from __future__ import annotations

import copy
import json
import uuid

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.catalogue.schemas import SeedDocument
from app.catalogue.seed import (
    SEED_FILE,
    SeedValidationError,
    catalogue_problems,
    entity_id,
    load_document,
    purge_catalogue,
    seed_catalogue,
    validate_document,
)
from app.cli import main as cli_main
from app.models import (
    LEAD_CATEGORIES,
    AuditLog,
    CatalogueDomain,
    CatalogueEntity,
    CatalogueService,
    EntityRelation,
    EntityTranslation,
    FamilyService,
    Lead,
    ServiceKey,
    utcnow,
)

RAW = json.loads(SEED_FILE.read_text(encoding="utf-8"))


def raw() -> dict:
    return copy.deepcopy(RAW)


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


# --------------------------------------------------------------------------- seed document


def test_seed_document_is_valid_and_complete():
    doc = load_document()
    assert validate_document(doc) == []
    assert len(doc.domains) == 10
    assert [d.code for d in sorted(doc.domains, key=lambda d: d.code)] == list("ABCDEFGHIJ")
    assert len(doc.families) == 60
    assert {s.lead_category for s in doc.services} == set(LEAD_CATEGORIES)


def test_seed_document_rejects_unknown_fields_and_a_missing_locale():
    data = raw()
    data["domains"][0]["price"] = "1000"
    with pytest.raises(ValidationError):
        SeedDocument.model_validate(data)
    data = raw()
    del data["services"][0]["translations"]["en"]
    with pytest.raises(ValidationError):
        SeedDocument.model_validate(data)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda d: d["services"].pop(), "has no catalogue service"),
        (
            lambda d: d["domains"][0]["translations"]["bg"].update(slug=d["services"][0]["translations"]["bg"]["slug"]),
            "duplicate bg slug",
        ),
        (lambda d: d["families"][0].update(key="other_domain.x"), "key must start with"),
        (lambda d: d["domains"][0].update(contact_service="nonexistent"), "unknown contact service"),
        (lambda d: d["services"][0]["related"].append(d["services"][0]["key"]), "invalid related service"),
    ],
)
def test_validation_rejects_broken_documents(mutate, message, db):
    data = raw()
    mutate(data)
    doc = SeedDocument.model_validate(data)
    assert any(message in problem for problem in validate_document(doc))
    with pytest.raises(SeedValidationError):
        seed_catalogue(db, doc)
    assert count(db, CatalogueEntity) == 0


def test_entity_ids_are_deterministic():
    assert entity_id("domain", "devops_sre") == entity_id("domain", "devops_sre")
    assert entity_id("domain", "devops_sre") != entity_id("service", "devops_sre")
    assert entity_id("service", "seo") == uuid.uuid5(uuid.UUID("6f1c2a52-3b7e-4d0a-9c41-0d5e8a7b2c10"), "service:seo")


# --------------------------------------------------------------------------- seeding


def test_seed_on_an_empty_database_creates_the_full_catalogue(db):
    result = seed_catalogue(db)
    assert dict(result.created) == {"domain": 10, "family": 60, "service": 9}
    assert not result.updated and not result.extra
    assert count(db, CatalogueEntity) == 79
    assert count(db, EntityTranslation) == 79 * 2
    assert count(db, FamilyService) > 0
    assert count(db, EntityRelation) > 0
    assert catalogue_problems(db) == []
    domain = db.get(CatalogueDomain, entity_id("domain", "devops_sre"))
    assert (domain.code, domain.band) == ("F", "engineering")
    assert domain.contact_service_id == entity_id("service", "integrations")


def test_repeated_seeding_changes_nothing(db):
    seed_catalogue(db)
    snapshot = sorted((r.id, r.revision, r.updated_at) for r in db.scalars(select(CatalogueEntity)))
    result = seed_catalogue(db)
    assert not result.created and not result.updated
    assert sum(result.unchanged.values()) == 79
    db.expire_all()
    assert sorted((r.id, r.revision, r.updated_at) for r in db.scalars(select(CatalogueEntity))) == snapshot
    assert count(db, EntityTranslation) == 79 * 2
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "catalogue.seeded")) == 1


def test_changed_content_is_updated_in_place_with_a_new_revision(db):
    seed_catalogue(db)
    data = raw()
    data["domains"][0]["translations"]["en"]["summary"] = "Changed summary for the test."
    data["services"][0]["related"] = data["services"][0]["related"][:1]
    result = seed_catalogue(db, SeedDocument.model_validate(data))
    assert dict(result.updated) == {"domain": 1, "service": 1}
    key = data["domains"][0]["key"]
    row = db.get(CatalogueEntity, entity_id("domain", key))
    assert row.revision == 2
    text = db.get(EntityTranslation, (row.id, "en"))
    assert text.summary == "Changed summary for the test."
    assert count(db, CatalogueEntity) == 79

    result = seed_catalogue(db)  # back to the committed document
    assert dict(result.updated) == {"domain": 1, "service": 1}
    db.expire_all()
    assert db.get(CatalogueEntity, row.id).revision == 3


def test_dry_run_writes_nothing(db):
    result = seed_catalogue(db, dry_run=True)
    assert dict(result.created) == {"domain": 10, "family": 60, "service": 9}
    assert count(db, CatalogueEntity) == 0
    assert count(db, AuditLog) == 0


def test_seeding_never_deletes_entities_missing_from_the_document(db):
    seed_catalogue(db)
    now = utcnow()
    db.add(CatalogueEntity(entity_type="service", key="legacy_service", status="draft", created_at=now, updated_at=now))
    db.commit()
    result = seed_catalogue(db)
    assert result.extra == ["service:legacy_service"]
    assert db.scalar(select(CatalogueEntity).where(CatalogueEntity.key == "legacy_service")) is not None


def test_every_published_service_has_bg_and_en_content_and_a_lead_category(db):
    seed_catalogue(db)
    services = db.scalars(select(CatalogueService)).all()
    assert {s.lead_category for s in services} == {k.value for k in LEAD_CATEGORIES}
    for service in services:
        entity = db.get(CatalogueEntity, service.id)
        assert entity.status == "published"
        for locale in ("bg", "en"):
            text = db.get(EntityTranslation, (service.id, locale))
            assert text is not None and text.slug and text.name and text.seo_title, (entity.key, locale)


def test_catalogue_check_reports_missing_content(db):
    seed_catalogue(db)
    db.delete(db.get(EntityTranslation, (entity_id("service", "seo"), "en")))
    db.commit()
    assert catalogue_problems(db) == ["service:seo is published without en content"]


def test_existing_leads_are_untouched_and_their_service_references_resolve(make_lead, db):
    lead = make_lead(service="seo")
    before = db.scalar(select(Lead))
    snapshot = (before.id, before.service, before.submitted_service, before.updated_at)

    seed_catalogue(db)
    db.expire_all()
    after = db.get(Lead, before.id)
    assert (after.id, after.service, after.submitted_service, after.updated_at) == snapshot
    service = db.scalar(select(CatalogueService).where(CatalogueService.lead_category == after.service))
    assert service is not None
    assert db.get(EntityTranslation, (service.id, "bg")).slug == "seo-optimizatsiya"
    assert lead["reference"]


def test_every_lead_service_key_except_other_maps_to_one_service():
    assert {k.value for k in ServiceKey} - {s.lead_category.value for s in load_document().services} == {"other"}


def test_purge_removes_the_catalogue_and_keeps_leads(make_lead, db):
    make_lead(service="automation")
    seed_catalogue(db)
    assert purge_catalogue(db) == 79
    assert count(db, CatalogueEntity) == 0
    assert count(db, Lead) == 1
    assert dict(seed_catalogue(db).created) == {"domain": 10, "family": 60, "service": 9}


def test_cli_commands(db):
    assert cli_main(["catalogue-check"]) == 1  # empty catalogue: lead categories unmapped
    assert cli_main(["catalogue-seed", "--dry-run"]) == 0
    assert count(db, CatalogueEntity) == 0
    assert cli_main(["catalogue-seed"]) == 0
    assert cli_main(["catalogue-check"]) == 0
    assert cli_main(["catalogue-purge"]) == 1  # refused without --yes
    assert count(db, CatalogueEntity) == 79


# --------------------------------------------------------------------------- schema constraints


def _expect_integrity_error(db, statement) -> None:
    with pytest.raises(IntegrityError):
        statement()
        db.flush()
    db.rollback()


def test_domain_and_service_slugs_cannot_collide_in_one_locale(db):
    seed_catalogue(db)
    domain_text = db.get(EntityTranslation, (entity_id("domain", "devops_sre"), "bg"))

    def collide():
        domain_text.slug = "seo-optimizatsiya"

    _expect_integrity_error(db, collide)


def test_relations_only_allow_the_declared_type_combinations(db):
    seed_catalogue(db)
    _expect_integrity_error(
        db,
        lambda: db.add(
            EntityRelation(
                from_entity_id=entity_id("domain", "devops_sre"),
                from_type="domain",
                kind="related",
                to_entity_id=entity_id("domain", "cloud_platform"),
                to_type="domain",
                position=9,
            )
        ),
    )
    # A stored type that differs from the referenced entity's type violates the composite foreign key.
    _expect_integrity_error(
        db,
        lambda: db.add(
            EntityRelation(
                from_entity_id=entity_id("service", "seo"),
                from_type="service",
                kind="related",
                to_entity_id=entity_id("domain", "devops_sre"),
                to_type="service",
                position=9,
            )
        ),
    )


def test_a_subtype_row_must_match_its_entity_type(db):
    seed_catalogue(db)
    _expect_integrity_error(
        db,
        lambda: db.add(CatalogueDomain(id=entity_id("service", "seo"), code="Z", band="ai", icon="bot", position=9)),
    )


def test_status_and_lead_category_checks(db):
    seed_catalogue(db)
    entity = db.get(CatalogueEntity, entity_id("service", "seo"))

    def archive_without_timestamp():
        entity.status = "archived"

    _expect_integrity_error(db, archive_without_timestamp)
    service = db.get(CatalogueService, entity_id("service", "seo"))

    def other_category():
        service.lead_category = "other"

    _expect_integrity_error(db, other_category)


def test_a_referenced_domain_cannot_be_deleted(db):
    seed_catalogue(db)
    _expect_integrity_error(db, lambda: db.delete(db.get(CatalogueDomain, entity_id("domain", "commerce_engineering"))))
