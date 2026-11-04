"""H-1: the API connects as a role that owns nothing, cannot bypass RLS and cannot read tenant data
outside a tenant binding. These tests run on the API's own engine, so they prove the real connection.
"""

from __future__ import annotations

from argparse import Namespace
from datetime import timedelta

import pytest
from sqlalchemy import create_engine, make_url, select, text
from sqlalchemy.exc import DBAPIError

from app.cli import cmd_db_api_role
from app.config import Settings, get_settings
from app.db import get_engine, get_sessionmaker
from app.models import AuditLog, utcnow
from app.ops import rls
from app.ops.models import TENANT_TABLES
from tests.conftest import API_ROLE_PASSWORD

API_ROLE = "acs_app_api"
RLS_TABLES = (*TENANT_TABLES, "ops_memberships", "ops_organizations")


def test_the_api_really_connects_as_the_restricted_role():
    with get_engine().connect() as connection:
        assert connection.execute(text("SELECT session_user")).scalar() == API_ROLE


def test_the_role_cannot_bypass_anything(db):
    row = db.execute(
        text("SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = :r"),
        {"r": API_ROLE},
    ).one()
    assert tuple(row) == (False, False, False, False)
    owned = db.execute(text("SELECT count(*) FROM pg_tables WHERE tableowner = :r"), {"r": API_ROLE}).scalar()
    assert owned == 0


@pytest.mark.parametrize("table", RLS_TABLES)
def test_tenant_tables_are_closed_without_a_binding(table):
    with get_sessionmaker()() as session, pytest.raises(DBAPIError, match="permission denied"):
        session.execute(text(f"SELECT 1 FROM {table} LIMIT 1"))  # noqa: S608 - fixed names


def test_a_binding_sees_only_its_own_organisation(db, tenants):
    first, second = tenants["tenant-a"]["org"], tenants["tenant-b"]["org"]
    with get_sessionmaker()() as session:
        rls.bind(session, organization_id=first)
        visible = session.execute(text("SELECT id FROM ops_organizations")).scalars().all()
        assert visible == [first]
        assert second not in visible


def test_bootstrap_reads_portal_identities_but_no_tenant_data():
    with get_sessionmaker()() as session:
        rls.bootstrap(session)
        assert session.execute(text("SELECT count(*) FROM portal_users")).scalar() == 0
        with pytest.raises(DBAPIError, match="permission denied"):
            session.execute(text("SELECT 1 FROM ops_agents"))


def test_bootstrap_cannot_change_an_organisation(db, tenants):
    with get_sessionmaker()() as session:
        rls.bootstrap(session)
        with pytest.raises(DBAPIError, match="permission denied"):
            session.execute(text("UPDATE ops_organizations SET name = 'x'"))


@pytest.mark.parametrize(
    "statement",
    [
        "CREATE TABLE stolen (id int)",
        "DROP TABLE leads",
        "ALTER TABLE leads DISABLE ROW LEVEL SECURITY",
        "ALTER TABLE ops_agents DISABLE ROW LEVEL SECURITY",
        "SELECT * FROM alembic_version",
        "UPDATE audit_logs SET action = 'x'",
        "DELETE FROM audit_logs",
        "SET ROLE acs",
    ],
)
def test_the_role_cannot_change_the_schema_or_rewrite_history(statement):
    with get_sessionmaker()() as session, pytest.raises(DBAPIError):
        session.execute(text(statement))


def test_retention_can_only_remove_expired_audit_entries(db):
    now = utcnow()
    db.add_all(
        [
            AuditLog(action="old", actor_label="test", created_at=now - timedelta(days=400)),
            AuditLog(action="recent", actor_label="test", created_at=now - timedelta(days=1)),
        ]
    )
    db.commit()
    with get_sessionmaker()() as session:
        session.execute(text("SELECT acs_purge_audit_logs(:c)"), {"c": now - timedelta(days=30)})
        session.commit()
    db.expire_all()
    assert db.scalars(select(AuditLog.action)).all() == ["recent"]


def test_the_purge_function_is_closed_to_tenant_roles():
    with get_sessionmaker()() as session:
        rls.bootstrap(session)
        with pytest.raises(DBAPIError, match="permission denied"):
            session.execute(text("SELECT acs_purge_audit_logs(now())"))


def test_every_other_table_is_a_deliberate_grant(db):
    """A new table without a grant fails here, and a tenant table with a direct grant fails too."""
    tables = db.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).scalars().all()
    for table in tables:
        allowed = db.execute(text("SELECT has_table_privilege(:r, :t, 'SELECT')"), {"r": API_ROLE, "t": table}).scalar()
        if table == "alembic_version" or table in RLS_TABLES:
            assert not allowed, table
        else:
            assert allowed, table


def test_db_api_role_sets_the_password_without_printing_it(db, monkeypatch, capsys):
    secret = "pass'word-with-a-quote"
    monkeypatch.setenv("API_DB_PASSWORD", secret)
    try:
        assert cmd_db_api_role(Namespace()) == 0
        output = capsys.readouterr().out
        assert secret not in output
        url = make_url(get_settings().database_url).set(password=secret)
        with create_engine(url).connect() as connection:
            assert connection.execute(text("SELECT session_user")).scalar() == API_ROLE
    finally:
        db.execute(text(f"ALTER ROLE acs_app_api PASSWORD '{API_ROLE_PASSWORD}'"))
        db.commit()


def test_db_api_role_does_nothing_without_a_password(monkeypatch, capsys):
    monkeypatch.delenv("API_DB_PASSWORD", raising=False)
    assert cmd_db_api_role(Namespace()) == 0
    assert "NOLOGIN" in capsys.readouterr().out


def test_production_will_not_open_accounts_on_the_owner_connection():
    base = get_settings().model_dump()
    owner = make_url(base["database_url"]).set(username="acs").render_as_string(hide_password=False)
    base.update(app_env="production", customer_accounts_enabled=True, database_url=owner)
    with pytest.raises(ValueError, match="restricted database role"):
        Settings(**base)
