from datetime import timedelta

from alembic import command
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.orm import Session

from app.catalogue.seed import catalogue_problems, entity_id, seed_catalogue
from app.cli import SYNTHETIC_SOURCE, ensure_admin, seed_synthetic_data
from app.models import AIActionRequest, AuditLog, Lead, utcnow
from app.services import leads
from tests.conftest import TEST_DATABASE_URL, alembic_config, recreate_database


def test_models_match_migrations():
    """`alembic check` fails if the ORM models drift from the migration files."""
    command.check(alembic_config(TEST_DATABASE_URL))


def test_migration_upgrade_downgrade_roundtrip():
    url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/acs_migration_roundtrip"
    recreate_database("acs_migration_roundtrip")
    cfg = alembic_config(url)
    command.upgrade(cfg, "head")
    engine = create_engine(url)
    assert {"leads", "lead_notes", "admin_users", "admin_sessions", "audit_logs", "ai_action_requests"} <= set(
        inspect(engine).get_table_names()
    )
    command.downgrade(cfg, "base")
    assert "leads" not in inspect(engine).get_table_names()
    engine.dispose()


def test_migration_0002_backfills_existing_leads():
    """Data written under schema 0001 survives the upgrade: submitted_service is backfilled."""
    url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/acs_migration_backfill"
    recreate_database("acs_migration_backfill")
    cfg = alembic_config(url)
    command.upgrade(cfg, "0001")
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO leads (id, service, name, company, email, message, status, source, "
            "privacy_acknowledged_at, privacy_notice_version, marketing_consent, created_at, updated_at) "
            "VALUES (gen_random_uuid(), 'seo', 'Стар', 'Стара ООД', 'old@example.com', "
            "'Стар запис отпреди миграцията', "
            "'NEW', 'website_contact_form', now(), 'v1', false, now(), now())"
        ))
    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT service, submitted_service, inquiry_type, platform FROM leads")).one()
    assert tuple(row) == ("seo", "seo", "contact", None)
    command.downgrade(cfg, "0001")
    engine.dispose()


def test_migration_0009_keeps_existing_data_seeds_and_rolls_back():
    """An existing 0008 database migrates to 0009 without data loss, the catalogue seeds into it, and
    downgrading removes only the catalogue tables (the documented rollback)."""
    url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/acs_migration_catalogue"
    recreate_database("acs_migration_catalogue")
    cfg = alembic_config(url)
    command.upgrade(cfg, "0008")
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO leads (id, service, submitted_service, name, company, email, message, status, source, "
            "privacy_acknowledged_at, privacy_notice_version, marketing_consent, created_at, updated_at) "
            "VALUES (gen_random_uuid(), 'ai_managed', 'ai_managed', 'Стар', 'Стара ООД', 'old@example.com', "
            "'Запис отпреди каталога', 'QUALIFIED', 'website_contact_form', now(), 'v1', false, now(), now())"
        ))
        conn.execute(text(
            "INSERT INTO ops_organizations (id, slug, name, created_at) "
            "VALUES (gen_random_uuid(), 'acme', 'Acme', now())"
        ))
    before = _row_snapshot(engine)

    command.upgrade(cfg, "head")
    with Session(engine) as session:
        assert dict(seed_catalogue(session).published) == {"domain": 10, "service": 9}
        assert catalogue_problems(session) == []
        assert seed_catalogue(session).changed is False
    assert _row_snapshot(engine) == before

    command.downgrade(cfg, "0008")
    tables = set(inspect(engine).get_table_names())
    assert not tables & {"catalogue_entities", "services", "service_domains", "entity_translations"}
    assert _row_snapshot(engine) == before
    command.upgrade(cfg, "head")  # re-applying after a rollback works on the same data
    engine.dispose()


def test_migration_0010_turns_unsnapshotted_rows_into_drafts_and_the_seed_republishes():
    """0009 published rows have no snapshot; 0010 makes them drafts, keeps admins as `admin`, and the
    bootstrap seed publishes the seeded entries again."""
    url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/acs_migration_0010"
    recreate_database("acs_migration_0010")
    cfg = alembic_config(url)
    command.upgrade(cfg, "0009")
    engine = create_engine(url)
    service_id = entity_id("service", "seo")
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO admin_users (id, email, full_name, password_hash, is_active, created_at, failed_login_count) "
            "VALUES (gen_random_uuid(), 'old.admin@example.com', 'Old', 'x', true, now(), 0)"
        ))
        conn.execute(text(
            "INSERT INTO catalogue_entities (id, entity_type, key, status, revision, created_at, updated_at) "
            "VALUES (:id, 'service', 'seo', 'published', 1, now(), now())"
        ), {"id": service_id})
    command.upgrade(cfg, "0010")
    with engine.connect() as conn:
        assert conn.execute(text("SELECT role FROM admin_users")).scalar() == "admin"
        assert conn.execute(text("SELECT status FROM catalogue_entities")).scalar() == "draft"
    with engine.begin() as conn:  # the half-seeded 0009 row is replaced by a clean seed
        conn.execute(text("DELETE FROM catalogue_entities"))
    with Session(engine) as session:
        assert dict(seed_catalogue(session).published) == {"domain": 10, "service": 9}
        assert catalogue_problems(session) == []
    command.downgrade(cfg, "0009")
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM catalogue_entities WHERE status = 'published' "
            "AND entity_type IN ('domain', 'service')")).scalar() == 19
        assert "role" not in {c["name"] for c in inspect(engine).get_columns("admin_users")}
    engine.dispose()


def _row_snapshot(engine):
    with engine.connect() as conn:
        leads_rows = conn.execute(text("SELECT id, service, submitted_service, status, updated_at FROM leads")).all()
        orgs = conn.execute(text("SELECT id, slug FROM ops_organizations")).all()
    return sorted(map(tuple, leads_rows)), sorted(map(tuple, orgs))


def test_retention_deletes_only_expired_leads(client, make_lead, db):
    make_lead(email="old@example.com")
    make_lead(email="fresh@example.com")
    old = db.scalar(select(Lead).where(Lead.email == "old@example.com"))
    old.updated_at = utcnow() - timedelta(days=800)
    db.commit()

    dry = leads.purge_expired(db, lead_retention_days=730, audit_retention_days=1095, dry_run=True)
    assert dry.leads_deleted == 1
    assert db.scalar(select(func.count()).select_from(Lead)) == 2

    result = leads.purge_expired(db, lead_retention_days=730, audit_retention_days=1095)
    assert result.leads_deleted == 1
    assert [e for (e,) in db.execute(select(Lead.email))] == ["fresh@example.com"]
    deleted = db.scalar(select(AuditLog).where(AuditLog.action == "lead.deleted"))
    assert deleted.actor_label == "retention-job"


def test_retention_purges_old_audit_entries(db):
    db.add(AuditLog(action="old.entry", actor_label="system", details={}, created_at=utcnow() - timedelta(days=2000)))
    db.commit()
    result = leads.purge_expired(db, lead_retention_days=730, audit_retention_days=1095)
    assert result.audit_entries_deleted == 1
    assert db.scalar(select(AuditLog).where(AuditLog.action == "old.entry")) is None


def test_synthetic_seed_is_idempotent_and_clearly_labelled(db):
    admin, created = ensure_admin(db, "seed.admin@example.com", "Seed-Password-2026", "Seed")
    assert created
    assert ensure_admin(db, "SEED.ADMIN@example.com", "Seed-Password-2026", "Seed")[1] is False

    assert seed_synthetic_data(db, admin) == 7
    assert seed_synthetic_data(db, admin) == 0
    rows = db.scalars(select(Lead)).all()
    assert all(r.source == SYNTHETIC_SOURCE for r in rows)
    assert all(r.email.endswith("@example.com") for r in rows)
    assert all("СИНТЕТИЧНИ ДАННИ" in r.message for r in rows)
    assert db.scalar(select(func.count()).select_from(AIActionRequest)) == 1
