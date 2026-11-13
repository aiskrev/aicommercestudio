"""Authorization inventory: every staff route refuses an anonymous caller, found by walking the routing table.

The hand-written list in `test_admin_auth.PROTECTED` covers 18 routes. This test does not rely on anybody remembering to
extend a list: a new route under a staff prefix that forgets its session dependency fails here (audit phase 07,
OWASP A01 broken access control / API1 BOLA, ASVS V4.1).
"""

from __future__ import annotations

import re
import uuid

import pytest

from app.config import Settings, get_settings
from app.main import app
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

STAFF_PREFIXES = ("/api/admin/", "/api/ops/")
# Reached before a session exists, by design: the sign-in itself.
ANONYMOUS_ON_PURPOSE = {("POST", "/api/admin/auth/login")}
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def _staff_routes() -> list[tuple[str, str]]:
    """Method and path template of every staff operation, from the OpenAPI document (the routing table is nested)."""
    found: list[tuple[str, str]] = []
    for path, operations in app.openapi()["paths"].items():
        if not path.startswith(STAFF_PREFIXES):
            continue
        for method in operations:
            verb = method.upper()
            if verb in {"GET", "POST", "PUT", "PATCH", "DELETE"} and (verb, path) not in ANONYMOUS_ON_PURPOSE:
                found.append((verb, path))
    return sorted(found)


ROUTES = _staff_routes()


@pytest.fixture(autouse=True)
def every_feature_on(monkeypatch):
    """Features that are off answer 404 before authorisation is even reached. Switch every one on, so the inventory
    proves what the sign-in guard does on the day a feature is released, not just that it is hidden."""
    settings = get_settings()
    for name, field in Settings.model_fields.items():
        if name.endswith("_enabled") and field.annotation is bool and field.default is False:
            monkeypatch.setattr(settings, name, True)


def test_the_inventory_is_not_empty():
    # A refactor that moves the prefixes must not silently turn this guard into a no-op.
    assert len(ROUTES) >= 150


@pytest.mark.parametrize(("method", "template"), ROUTES, ids=[f"{m} {p}" for m, p in ROUTES])
def test_staff_route_requires_a_session(client, method, template):
    path = re.sub(r"\{[^}]+\}", lambda _: str(uuid.uuid4()), template)
    response = client.request(method, path)
    assert response.status_code == 401, f"{method} {template} answered {response.status_code} without a session"


def test_staff_writes_refuse_a_session_without_the_csrf_header(client, admin_user):
    """A signed-in browser that did not send the CSRF header is refused on every state-changing staff route."""
    login = client.post("/api/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    client.headers.pop("X-CSRF-Token", None)
    accepted = []
    for method, template in ROUTES:
        if method not in UNSAFE:
            continue
        path = re.sub(r"{[^}]+}", lambda _: str(uuid.uuid4()), template)
        status = client.request(method, path).status_code
        # The sign-in code step is for a pending session only: a full session is refused on its stage (409) first.
        if status not in (401, 403) and not (status == 409 and template.endswith("/mfa/verify")):
            accepted.append(f"{method} {template} -> {status}")
    assert accepted == [], "state-changing staff routes that did not demand the CSRF header: " + "; ".join(accepted)
