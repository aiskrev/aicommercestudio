"""Test fixtures. Tests run against a real PostgreSQL database (`<name>_test`) created on the
server from DATABASE_URL and migrated with Alembic — the same path production uses."""

from __future__ import annotations

import os
import time
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

_base_url = make_url(os.environ.get("DATABASE_URL", "postgresql+psycopg://acs:acs@localhost:5433/acs"))
TEST_DB = f"{_base_url.database}_test"
TEST_DATABASE_URL = _base_url.set(database=TEST_DB).render_as_string(hide_password=False)
SERVER_URL = _base_url.set(database="postgres").render_as_string(hide_password=False)

os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": TEST_DATABASE_URL,
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
from app.db import get_sessionmaker  # noqa: E402
from app.models import AdminUser  # noqa: E402
from app.rate_limit import limiter  # noqa: E402
from app.spam import issue_form_token  # noqa: E402

API_ROOT = Path(__file__).resolve().parents[1]
ADMIN_EMAIL = "admin.test@example.com"
ADMIN_PASSWORD = "Test-Password-2026"
TABLES = [
    "content_item_translations", "content_items",
    "entity_relations", "entity_translations", "family_services", "services", "service_families",
    "service_domains", "catalogue_entities",
    "ops_agents", "ops_memberships", "ops_workspaces", "ops_organizations",
    "advisor_assessments", "team_configurations", "assessment_results",
    "ai_action_requests", "audit_logs", "lead_notes", "leads",
    "admin_sessions", "admin_users",
]


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
    yield


@pytest.fixture(autouse=True)
def clean_state(database: None) -> Iterator[None]:
    from app.advisor.service import reset_ai_budget

    limiter.reset()
    reset_ai_budget()
    yield
    with get_sessionmaker()() as db:
        db.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"))
        db.commit()
    limiter.reset()


@pytest.fixture
def db():
    with get_sessionmaker()() as session:
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
