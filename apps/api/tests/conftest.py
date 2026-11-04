"""Test fixtures. Tests run against a real PostgreSQL database (`<name>_test`) created on the
server from DATABASE_URL and migrated with Alembic — the same path production uses."""

from __future__ import annotations

import os
import time
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

_base_url = make_url(os.environ.get("DATABASE_URL", "postgresql+psycopg://acs:acs@localhost:5433/acs"))
TEST_DB = f"{_base_url.database}_test"
TEST_DATABASE_URL = _base_url.set(database=TEST_DB).render_as_string(hide_password=False)
SERVER_URL = _base_url.set(database="postgres").render_as_string(hide_password=False)
# Requests run as the API's restricted role, as in production. Fixtures, migrations and the CLI use the owner.
API_ROLE_PASSWORD = "test-only-api-role"  # noqa: S105
API_DATABASE_URL = (
    _base_url.set(username="acs_app_api", password=API_ROLE_PASSWORD, database=TEST_DB)
).render_as_string(hide_password=False)

os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": API_DATABASE_URL,
        "SECRET_KEY": os.environ.get("TEST_SECRET_KEY", "test-only-key-0123456789-abcdefghijklmnopqrstuvwxyz"),
        "CORS_ORIGINS": "http://localhost:3000",
        "COOKIE_SECURE": "false",
        "TRUST_PROXY_HEADERS": "true",
        "SEED_SAMPLE_DATA": "false",
        "AI_PROVIDER": "mock",
        "CONTACT_RATE_LIMIT": "5",
        "CONTACT_RATE_WINDOW_SECONDS": "600",
        "LOGIN_RATE_LIMIT": "10",
        "LOGIN_RATE_WINDOW_SECONDS": "900",
        "FORM_TOKEN_MIN_SECONDS": "3",
        "FORM_TOKEN_MAX_AGE_SECONDS": "7200",
        "SMTP_HOST": "",
        "ADMIN_BOOTSTRAP_EMAIL": "",
        "ADMIN_BOOTSTRAP_PASSWORD": "",
        "LOG_LEVEL": "WARNING",
        # Assessment definitions in "preview" are tested end to end; production keeps them off.
        "ASSESSMENTS_PREVIEW_ENABLED": "true",
    }
)

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.cli import ensure_admin  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.models import AdminUser  # noqa: E402
from app.rate_limit import limiter  # noqa: E402
from app.spam import issue_form_token  # noqa: E402

API_ROOT = Path(__file__).resolve().parents[1]
ADMIN_EMAIL = "admin.test@example.com"
ADMIN_PASSWORD = "Test-Password-2026"
TABLES = [
    "outbox_messages",
    "customer_tokens",
    "customer_sessions",
    "customer_accounts",
    "rate_limit_buckets",
    "content_item_translations",
    "content_items",
    "entity_relations",
    "entity_translations",
    "family_services",
    "services",
    "service_families",
    "service_domains",
    "catalogue_entities",
    "portal_sessions",
    "portal_tokens",
    "portal_users",
    "ops_change_events",
    "ops_changes",
    "ops_incident_events",
    "ops_incidents",
    "ops_retention_policies",
    "ops_threshold_rules",
    "ops_budgets",
    "ops_runs",
    "ops_rate_cards",
    "ops_eval_results",
    "ops_eval_runs",
    "ops_eval_cases",
    "ops_eval_datasets",
    "ops_agent_versions",
    "ops_agents",
    "ops_memberships",
    "ops_workspaces",
    "ops_organizations",
    "advisor_assessments",
    "team_configurations",
    "assessment_results",
    "lead_proposal_versions",
    "lead_proposals",
    "lead_opportunities",
    "ai_action_requests",
    "audit_logs",
    "lead_notes",
    "leads",
    "admin_mfa_recovery_codes",
    "admin_sessions",
    "admin_users",
]


owner_sessionmaker = sessionmaker(bind=create_engine(TEST_DATABASE_URL), autoflush=False, expire_on_commit=False)


def recreate_database(name: str) -> None:
    engine = create_engine(SERVER_URL, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    engine.dispose()


def alembic_config(url: str) -> Config:
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    cfg.attributes["configure_logger"] = False
    return cfg


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    recreate_database(TEST_DB)
    command.upgrade(alembic_config(TEST_DATABASE_URL), "head")
    with owner_sessionmaker() as session:
        session.execute(text(f"ALTER ROLE acs_app_api LOGIN PASSWORD '{API_ROLE_PASSWORD}'"))
        session.commit()
    yield


@pytest.fixture(autouse=True)
def cli_runs_as_owner(monkeypatch) -> None:
    monkeypatch.setattr("app.cli.get_sessionmaker", lambda: owner_sessionmaker)


@pytest.fixture(autouse=True)
def clean_state(database: None) -> Iterator[None]:
    from app.advisor.service import reset_ai_budget

    limiter.reset()
    reset_ai_budget()
    yield
    with owner_sessionmaker() as db:
        db.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"))
        db.commit()
    limiter.reset()


@pytest.fixture
def db():
    with owner_sessionmaker() as session:
        yield session


@pytest.fixture
def settings():
    return get_settings()


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_user(db) -> AdminUser:
    user, _ = ensure_admin(db, ADMIN_EMAIL, ADMIN_PASSWORD, "Тест Администратор")
    return user


@pytest.fixture
def admin_client(client: TestClient, admin_user: AdminUser) -> TestClient:
    response = client.post("/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = client.cookies.get(get_settings().csrf_cookie_name)
    return client


def valid_token(age_seconds: float = 10) -> str:
    return issue_form_token(get_settings().secret_key, now=time.time() - age_seconds)


def lead_payload(**overrides) -> dict:
    payload = {
        "service": "seo",
        "name": "Тест Потребител",
        "company": "Тестова Фирма ЕООД",
        "email": "Test.User@Example.com",
        "phone": "+359 88 123 4567",
        "message": "Искаме технически SEO одит на онлайн магазина ни и план за подобрения.",
        "privacy_acknowledged": True,
        "marketing_consent": False,
        "website": "",
        "form_token": valid_token(),
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def make_lead(client: TestClient):
    def _make(**overrides) -> dict:
        response = client.post("/api/public/leads", json=lead_payload(**overrides))
        assert response.status_code == 201, response.text
        return response.json()

    return _make


@pytest.fixture
def tenants(db):
    """Ops tenants: org A (owner a@…) and org B (owner b@…), each with a production workspace and an agent."""
    from app.models import OpsAgent, OpsWorkspace
    from app.ops import service as ops
    from tests.test_ops_portal import user

    user(db, "owner.a@example.com")
    user(db, "owner.b@example.com")
    org_a = ops.create_organization(db, slug="tenant-a", name="Tenant A", owner_email="owner.a@example.com")
    org_b = ops.create_organization(db, slug="tenant-b", name="Tenant B", owner_email="owner.b@example.com")
    data = {}
    for org in (org_a, org_b):
        ws = OpsWorkspace(organization_id=org.id, slug="production", name="Production", environment="production")
        db.add(ws)
        db.flush()
        agent = OpsAgent(organization_id=org.id, workspace_id=ws.id, key="support", name="Support", status="active")
        db.add(agent)
        db.commit()
        data[org.slug] = {"org": org.id, "workspace": ws.id, "agent": agent.id}
    return data
