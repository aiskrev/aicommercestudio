import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app
from app.security import hash_password, hash_token, tokens_match, validate_password_strength, verify_password
from tests.conftest import lead_payload


def test_cross_site_post_is_rejected_by_origin_check(client):
    response = client.post("/api/public/leads", json=lead_payload(), headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


def test_allowed_origin_is_accepted(client):
    response = client.post("/api/public/leads", json=lead_payload(), headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 201


def test_same_host_origin_via_proxy_is_accepted(client):
    response = client.post(
        "/api/public/leads",
        json=lead_payload(),
        headers={"Origin": "http://web:3000", "X-Forwarded-Host": "web:3000"},
    )
    assert response.status_code == 201


def test_cors_preflight_only_for_allowed_origins(client):
    allowed = client.options(
        "/api/public/leads",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    denied = client.options(
        "/api/public/leads",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "access-control-allow-origin" not in denied.headers


def test_oversized_body_is_rejected(client):
    response = client.post(
        "/api/public/leads",
        content=b"{" + b" " * (70 * 1024) + b"}",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413


def test_security_headers(client):
    headers = client.get("/api/health").headers
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "no-referrer"
    assert "default-src 'none'" in headers["Content-Security-Policy"]


def test_admin_responses_are_not_cached(admin_client):
    assert admin_client.get("/api/admin/leads").headers["Cache-Control"] == "no-store"


def test_malformed_json_is_rejected(client):
    response = client.post("/api/public/leads", content=b"{not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def _production(**overrides) -> Settings:
    values = {
        "app_env": "production",
        "secret_key": "Zx8k2P0q-unique-production-grade-key-9f3a1c7e",
        "cors_origins": "https://shop-studio.invalid",
        "site_url": "https://shop-studio.invalid",
        "database_url": "postgresql+psycopg://u:p@localhost/db",
        "seed_sample_data": False,
        "cookie_secure": None,
        "enable_api_docs": None,
    }
    values.update(overrides)
    return Settings(**values)


def test_production_rejects_placeholder_secret():
    with pytest.raises(ValidationError):
        _production(secret_key="change-me-generated-by-setup-at-least-32-characters")


def test_production_rejects_wildcard_cors_and_insecure_cookies():
    with pytest.raises(ValidationError):
        _production(cors_origins="*")
    with pytest.raises(ValidationError):
        _production(cookie_secure=False)


@pytest.mark.parametrize(
    "overrides",
    [
        {"site_url": "http://shop-studio.invalid"},
        {"cors_origins": "https://shop-studio.invalid,http://localhost:3000"},
    ],
)
def test_production_requires_https_urls(overrides):
    with pytest.raises(ValidationError):
        _production(**overrides)


def test_database_errors_never_log_bound_parameters():
    from app.db import get_engine

    assert get_engine().hide_parameters is True


def test_production_forces_secure_cookies_and_hides_docs():
    settings = _production()
    assert settings.secure_cookies is True
    assert settings.docs_enabled is False
    with TestClient(create_app(settings)) as prod_client:
        assert prod_client.get("/api/docs").status_code == 404
        assert prod_client.get("/api/openapi.json").status_code == 404
        assert "Strict-Transport-Security" in prod_client.get("/api/health").headers


def test_secret_key_is_mandatory():
    with pytest.raises(ValidationError):
        Settings(secret_key="too-short")


def test_password_hashing_uses_argon2id():
    hashed = hash_password("Correct-Horse-42")
    assert hashed.startswith("$argon2id$")
    assert verify_password(hashed, "Correct-Horse-42")
    assert not verify_password(hashed, "wrong")
    assert not verify_password(None, "anything")
    assert not verify_password("not-a-hash", "anything")


def test_password_policy():
    validate_password_strength("Long-Enough-Pass1")
    for weak in ["short1A", "alllowercase123", "ALLUPPERCASE123", "NoDigitsInThisOne"]:
        with pytest.raises(ValueError):
            validate_password_strength(weak)


def test_token_comparison():
    assert tokens_match("abc", hash_token("abc"))
    assert not tokens_match("abd", hash_token("abc"))
