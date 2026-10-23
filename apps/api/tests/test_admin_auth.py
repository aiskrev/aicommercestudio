from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models import AdminSession, AuditLog, utcnow
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

PROTECTED = [
    ("get", "/api/admin/auth/me"),
    ("post", "/api/admin/auth/logout"),
    ("post", "/api/admin/auth/logout-all"),
    ("get", "/api/admin/auth/sessions"),
    ("get", "/api/admin/retention"),
    ("post", "/api/admin/retention/run"),
    ("get", "/api/admin/dashboard/stats"),
    ("get", "/api/admin/audit"),
    ("get", "/api/admin/system/status"),
    ("get", "/api/admin/leads"),
    ("get", f"/api/admin/leads/{uuid4()}"),
    ("patch", f"/api/admin/leads/{uuid4()}"),
    ("delete", f"/api/admin/leads/{uuid4()}"),
    ("post", f"/api/admin/leads/{uuid4()}/notes"),
    ("get", f"/api/admin/leads/{uuid4()}/audit"),
    ("post", f"/api/admin/leads/{uuid4()}/ai/triage"),
    ("get", "/api/admin/ai/actions"),
    ("post", f"/api/admin/ai/actions/{uuid4()}/decision"),
]


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_admin_endpoints_require_authentication(client, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 401, f"{method.upper()} {path} -> {response.status_code}"


def _login(client, email=ADMIN_EMAIL, password=ADMIN_PASSWORD):
    return client.post("/api/admin/auth/login", json={"email": email, "password": password})


def test_login_success_sets_secure_session_cookies(client, admin_user, settings):
    response = _login(client)
    assert response.status_code == 200
    assert response.json()["user"]["email"] == ADMIN_EMAIL
    assert "password_hash" not in response.text

    set_cookie = response.headers.get_list("set-cookie")
    session_cookie = next(c for c in set_cookie if c.startswith(settings.session_cookie_name + "="))
    csrf_cookie = next(c for c in set_cookie if c.startswith(settings.csrf_cookie_name + "="))
    assert "HttpOnly" in session_cookie
    assert "samesite=lax" in session_cookie.lower()
    assert "HttpOnly" not in csrf_cookie
    assert "samesite=strict" in csrf_cookie.lower()

    me = client.get("/api/admin/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["full_name"] == "Тест Администратор"


def test_session_token_is_stored_hashed(client, admin_user, db, settings):
    _login(client)
    raw = client.cookies.get(settings.session_cookie_name)
    stored = db.scalar(select(AdminSession.token_hash))
    assert raw and stored and raw != stored and len(stored) == 64


def test_login_email_is_case_insensitive(client, admin_user):
    assert _login(client, email=ADMIN_EMAIL.upper()).status_code == 200


@pytest.mark.parametrize(
    ("email", "password"),
    [(ADMIN_EMAIL, "wrong-password-123"), ("nobody@example.com", ADMIN_PASSWORD)],
)
def test_login_failure_is_generic_and_audited(client, admin_user, db, email, password):
    response = _login(client, email, password)
    assert response.status_code == 401
    assert response.json()["detail"] == "Невалиден имейл или парола."
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "auth.login_failed"))
    assert entry is not None
    assert email not in str(entry.details)  # only a hash of the attempted e-mail is kept


def test_login_rate_limit(client, admin_user):
    for _ in range(10):
        _login(client, password="wrong-password-123")
    response = _login(client)
    assert response.status_code == 429


def test_state_changing_request_requires_csrf_token(admin_client, make_lead):
    lead = make_lead()
    lead_id = admin_client.get("/api/admin/leads").json()["items"][0]["id"]
    assert lead["reference"]

    csrf = admin_client.headers.pop("X-CSRF-Token")
    missing = admin_client.patch(f"/api/admin/leads/{lead_id}", json={"status": "CONTACTED"})
    wrong = admin_client.patch(
        f"/api/admin/leads/{lead_id}", json={"status": "CONTACTED"}, headers={"X-CSRF-Token": "forged"}
    )
    ok = admin_client.patch(
        f"/api/admin/leads/{lead_id}", json={"status": "CONTACTED"}, headers={"X-CSRF-Token": csrf}
    )
    assert missing.status_code == 403
    assert wrong.status_code == 403
    assert ok.status_code == 200


def test_logout_revokes_session(admin_client, settings):
    token = admin_client.cookies.get(settings.session_cookie_name)
    assert admin_client.post("/api/admin/auth/logout").status_code == 204
    admin_client.cookies.set(settings.session_cookie_name, token)
    assert admin_client.get("/api/admin/auth/me").status_code == 401


def test_expired_session_is_rejected(admin_client, db):
    session = db.scalar(select(AdminSession))
    session.expires_at = utcnow() - timedelta(minutes=1)
    db.commit()
    assert admin_client.get("/api/admin/auth/me").status_code == 401


def test_deactivated_admin_is_rejected(admin_client, admin_user, db):
    db.merge(admin_user).is_active = False
    db.commit()
    assert admin_client.get("/api/admin/auth/me").status_code == 401


def test_forged_session_cookie_is_rejected(client, admin_user, settings):
    client.cookies.set(settings.session_cookie_name, "forged-token-value")
    assert client.get("/api/admin/leads").status_code == 401


def test_successful_login_is_audited(client, admin_user, db):
    _login(client)
    assert db.scalar(select(AuditLog).where(AuditLog.action == "auth.login")) is not None
