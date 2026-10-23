from datetime import timedelta

from alembic import command
from sqlalchemy import create_engine, func, inspect, select

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
