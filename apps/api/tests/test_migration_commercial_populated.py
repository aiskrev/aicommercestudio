# ruff: noqa: E501, S608
"""Migrations 0026 to 0032 (commercial expansion) on a populated database; synthetic data only, never production data.

The database is brought to revision 0025 and filled with rows like those of a real installation (leads, accounts, a workspace,
billing offers of every shape, outbox messages). It is then upgraded to the head: nothing is lost or changed, the new columns
default to what the old rows imply, the new tables, the deposit rule and the outbox uniqueness exist. The downgrade is exercised
too: it drops the commercial tables (that is its nature, so it is only safe before commercial data exists) and leaves every old
row untouched, and the upgrade can be repeated afterwards (forward recovery).
"""

from __future__ import annotations

import pytest
from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

from tests.conftest import TEST_DATABASE_URL, alembic_config, recreate_database
from tests.test_migration_legal_populated import OLD_TABLES, _counts, _populate

NAME = "acs_migration_commercial"
URL = TEST_DATABASE_URL.rsplit("/", 1)[0] + f"/{NAME}"
COMMERCIAL_TABLES = (
    "quote_baskets",
    "quotations",
    "commercial_projects",
    "project_milestones",
    "project_events",
    "project_documents",
    "project_document_versions",
    "document_approvals",
    "document_comments",
    "lead_tasks",
)


@pytest.fixture
def migrated():
    recreate_database(NAME)
    cfg = alembic_config(URL)
    command.upgrade(cfg, "0025")
    engine = create_engine(URL)
    ids = _populate(engine)
    with engine.begin() as conn:
        # Offers of the other shapes an installation can hold: a managed service (a subscription that needs a scope)
        # and an approved one-time service.
        conn.execute(
            text(
                "INSERT INTO billing_offers (key, kind, plan_key, billing_interval, stripe_price_id, currency, "
                "amount_minor, requires_scope) VALUES "
                "('managed_monthly', 'subscription', 'managed', 'month', 'price_managed', 'eur', 9900, true), "
                "('audit_once', 'one_time', NULL, NULL, 'price_once', 'eur', 49000, false)"
            )
        )
    before = _counts(engine)
    yield cfg, engine, ids, before
    engine.dispose()


def _tables(engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def test_upgrade_keeps_every_old_row_and_defaults_the_new_columns(migrated):
    cfg, engine, _ids, before = migrated
    assert all(count > 0 for count in before.values()), before
    assert not set(COMMERCIAL_TABLES) & _tables(engine)
    command.upgrade(cfg, "head")
    assert _counts(engine) == before
    assert set(COMMERCIAL_TABLES) <= _tables(engine)
    with engine.connect() as conn:
        # Existing enquiries have no owner and no follow-up; existing outbox rows belong to no project.
        assert conn.execute(text("SELECT count(*) FROM leads WHERE owner_id IS NOT NULL")).scalar_one() == 0
        assert (
            conn.execute(
                text("SELECT count(*) FROM outbox_messages WHERE project_id IS NOT NULL OR event_ref IS NOT NULL")
            ).scalar_one()
            == 0
        )
        categories = dict(conn.execute(text("SELECT key, category FROM billing_offers")).all())
    assert categories == {
        "pro_monthly": "saas_subscription",
        "managed_monthly": "managed_service",
        "audit_once": "one_time_service",
    }


def test_the_deposit_rule_and_the_outbox_uniqueness_exist_after_the_upgrade(migrated):
    cfg, engine, ids, _before = migrated
    command.upgrade(cfg, "head")
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO billing_offers (key, kind, plan_key, billing_interval, stripe_price_id, currency, "
                "amount_minor, requires_scope, category, approved_at) VALUES "
                "('deposit', 'one_time', NULL, NULL, 'price_deposit', 'eur', 100000, false, 'project_deposit', now())"
            )
        )
    event = "11111111-1111-1111-1111-111111111111"
    insert = text(
        "INSERT INTO outbox_messages (id, account_id, kind, locale, status, next_attempt_at, created_at, event_ref) "
        "VALUES (gen_random_uuid(), :a, 'project_update', 'bg', 'pending', now(), now(), :e)"
    )
    with engine.begin() as conn:
        conn.execute(insert, {"a": ids["verified"], "e": event})
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(insert, {"a": ids["verified"], "e": event})


def test_the_downgrade_removes_only_the_commercial_schema_and_the_upgrade_can_be_repeated(migrated):
    cfg, engine, _ids, before = migrated
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "0025")
    assert not set(COMMERCIAL_TABLES) & _tables(engine)
    assert _counts(engine) == before
    columns = {column["name"] for column in inspect(engine).get_columns("billing_offers")}
    assert "category" not in columns
    assert "owner_id" not in {column["name"] for column in inspect(engine).get_columns("leads")}
    # Forward recovery: the same upgrade works again and the old rows are still intact.
    command.upgrade(cfg, "head")
    assert _counts(engine) == before
    assert set(COMMERCIAL_TABLES) <= _tables(engine)
    assert set(OLD_TABLES) <= _tables(engine)
