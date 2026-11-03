"""Read-only client portal: feature gate, separate identities, invitation + TOTP activation, login
with the second factor, session expiry, CSRF, recovery, read-only enforcement, tenant isolation (the
organisation comes from the session, under RLS), no prompt content, demo/suspended organisations and
the audit of client access."""

from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.main import app
from app.models import AuditLog, OpsOrganization, utcnow
from app.ops.models import OpsIncident, OpsIncidentEvent, PortalSession, PortalUser
from app.portal import totp
from tests.test_ops_portal import base, login
from tests.test_ops_registry_evals import run_dataset, version

PASSWORD = "Client-Portal-2026"


@pytest.fixture(autouse=True)
def portal_on(monkeypatch):
    monkeypatch.setattr(get_settings(), "client_portal_enabled", True)


def code_for(db, email: str, offset: int = 0) -> str:
    user = db.scalar(select(PortalUser).where(PortalUser.email == email))
    db.refresh(user)
    secret = totp.secret_for(get_settings().secret_key, user.id, user.mfa_nonce)
    return totp.code_at(secret, totp.current_step() + offset)


def invite(staff: TestClient, org, email="client@example.com") -> str:
    response = staff.post(f"{base(org)}/portal-users", json={"email": email, "full_name": "Client User"})
    assert response.status_code == 201, response.text
    return response.json()["path"].split("#", 1)[1]


def activate(db, staff, org, email="client@example.com") -> None:
    token = invite(staff, org, email)
    public = TestClient(app)
    enrol = public.post("/api/portal/activate", json={"token": token, "password": PASSWORD})
    assert enrol.status_code == 200 and enrol.json()["otpauth_uri"].startswith("otpauth://totp/")
    assert (
        public.post("/api/portal/activate/confirm", json={"token": token, "code": code_for(db, email)}).status_code
        == 204
    )


def signed_in(db, email="client@example.com") -> TestClient:
    client = TestClient(app)
    assert client.post("/api/portal/login", json={"email": email, "password": PASSWORD}).status_code == 200
    client.headers["X-CSRF-Token"] = client.cookies.get(get_settings().portal_csrf_cookie_name)
    # The enrolment just used the current TOTP step; replay protection refuses it again. Instead of
    # waiting 30 seconds, move the recorded step back (equivalent to the clock moving on).
    _forget_last_step(db, email)
    assert client.post("/api/portal/login/mfa", json={"code": code_for(db, email)}).status_code == 200
    return client


def _forget_last_step(db, email: str) -> None:
    user = db.scalar(select(PortalUser).where(PortalUser.email == email))
    db.refresh(user)
    user.mfa_last_step = totp.current_step() - 2
    db.commit()


@pytest.fixture
def portal(db, tenants):
    staff = login("owner.a@example.com")
    activate(db, staff, tenants["tenant-a"]["org"])
    return {"staff": staff, **tenants}


# --------------------------------------------------------------------------------- gates


def test_portal_is_off_unless_enabled(monkeypatch, tenants):
    monkeypatch.setattr(get_settings(), "client_portal_enabled", False)
    assert (
        TestClient(app).post("/api/portal/login", json={"email": "a@example.com", "password": "x"}).status_code == 404
    )
    assert login("owner.a@example.com").get(f"{base(tenants['tenant-a']['org'])}/portal-users").status_code == 404


def test_totp_matches_rfc_6238_vectors():
    secret = b"12345678901234567890"
    assert totp.code_at(secret, 59 // 30) == "287082"
    assert totp.code_at(secret, 1111111109 // 30) == "081804"
    assert totp.verify(secret, "287082", None, now=59) == 1
    assert totp.verify(secret, "287082", 1, now=59) is None  # replay refused


# ------------------------------------------------------------------------- authentication


def test_invitation_activation_login_and_mfa(db, portal):
    client = TestClient(app)
    # Password alone gives a pending session that cannot read anything.
    assert (
        client.post("/api/portal/login", json={"email": "client@example.com", "password": PASSWORD}).status_code == 200
    )
    assert client.get("/api/portal/dashboard").status_code == 401
    assert client.get("/api/portal/dashboard").json()["code"] == "portal_mfa_required"
    full = signed_in(db)
    me = full.get("/api/portal/me").json()
    assert me == {"email": "client@example.com", "full_name": "Client User", "organization": "Tenant A"}


def test_invitation_tokens_are_single_use_and_staff_and_clients_are_separate(db, portal):
    token = invite(portal["staff"], portal["tenant-a"]["org"], "second@example.com")
    public = TestClient(app)
    public.post("/api/portal/activate", json={"token": token, "password": PASSWORD})
    public.post("/api/portal/activate/confirm", json={"token": token, "code": code_for(db, "second@example.com")})
    assert public.post("/api/portal/activate", json={"token": token, "password": PASSWORD}).status_code == 400
    # A staff password does not open the portal, and a client session does not open the admin.
    assert (
        public.post(
            "/api/portal/login", json={"email": "owner.a@example.com", "password": "Ops-Test-Password-2026"}
        ).status_code
        == 401
    )
    client = signed_in(db)
    assert client.get("/api/admin/leads").status_code == 401
    assert client.get("/api/ops/organizations").status_code == 401


def test_weak_password_wrong_codes_and_lockout(db, tenants):
    staff = login("owner.a@example.com")
    token = invite(staff, tenants["tenant-a"]["org"], "weak@example.com")
    public = TestClient(app)
    assert public.post("/api/portal/activate", json={"token": token, "password": "short"}).status_code == 422
    public.post("/api/portal/activate", json={"token": token, "password": PASSWORD})
    assert public.post("/api/portal/activate/confirm", json={"token": token, "code": "000000"}).status_code == 400
    # Not active yet: login refused with the same answer as a wrong password.
    wrong = public.post("/api/portal/login", json={"email": "weak@example.com", "password": PASSWORD})
    unknown = public.post("/api/portal/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401 and wrong.json()["code"] == unknown.json()["code"]


def test_login_lockout_after_repeated_failures(db, portal):
    public = TestClient(app)
    for _ in range(5):
        public.post("/api/portal/login", json={"email": "client@example.com", "password": "Wrong-Password-1"})
    locked = public.post("/api/portal/login", json={"email": "client@example.com", "password": PASSWORD})
    assert locked.status_code == 401
    user = db.scalar(select(PortalUser).where(PortalUser.email == "client@example.com"))
    db.refresh(user)
    assert user.locked_until is not None


def test_sessions_expire_and_logout_revokes(db, portal):
    client = signed_in(db)
    assert client.get("/api/portal/dashboard").status_code == 200
    session = db.scalar(select(PortalSession).where(PortalSession.mfa_verified.is_(True)))
    session.last_seen_at = utcnow() - timedelta(minutes=get_settings().portal_session_idle_minutes + 1)
    db.commit()
    expired = client.get("/api/portal/dashboard")
    assert expired.status_code == 401 and expired.json()["code"] == "portal_session_expired"
    client = signed_in(db)
    assert client.post("/api/portal/logout").status_code == 204
    assert client.get("/api/portal/dashboard").status_code == 401


def test_csrf_is_required_for_state_changes(db, portal):
    client = signed_in(db)
    client.headers.pop("X-CSRF-Token")
    assert client.post("/api/portal/logout").status_code == 403


def test_recovery_resets_password_and_second_factor(db, portal):
    staff = portal["staff"]
    user = db.scalar(select(PortalUser).where(PortalUser.email == "client@example.com"))
    old = signed_in(db)
    path = staff.post(f"{base(portal['tenant-a']['org'])}/portal-users/{user.id}/recovery").json()["path"]
    token = path.split("#", 1)[1]
    public = TestClient(app)
    public.post("/api/portal/recover", json={"token": token, "password": "New-Client-Portal-2027"})
    assert old.get("/api/portal/dashboard").status_code == 401  # existing sessions revoked
    _forget_last_step(db, "client@example.com")
    assert (
        public.post(
            "/api/portal/recover/confirm", json={"token": token, "code": code_for(db, "client@example.com")}
        ).status_code
        == 204
    )
    assert (
        public.post("/api/portal/login", json={"email": "client@example.com", "password": PASSWORD}).status_code == 401
    )
    assert (
        public.post(
            "/api/portal/login", json={"email": "client@example.com", "password": "New-Client-Portal-2027"}
        ).status_code
        == 200
    )


# ------------------------------------------------------------------------- data and isolation


def test_read_only_dashboard_with_not_connected_state(db, portal):
    client = signed_in(db)
    dashboard = client.get("/api/portal/dashboard").json()
    assert dashboard["telemetry"]["connected"] is False and "No monitoring source" in dashboard["telemetry"]["note"]
    assert dashboard["agents_by_status"] == {"active": 1}
    for method, path in (
        ("post", "/api/portal/agents"),
        ("put", "/api/portal/incidents"),
        ("delete", "/api/portal/agents"),
        ("patch", "/api/portal/dashboard"),
    ):
        assert getattr(client, method)(path).status_code == 405


def test_agents_evaluations_and_incidents_without_prompt_content(db, portal):
    staff = portal["staff"]
    a = portal["tenant-a"]
    v = version(staff, a["org"], a["agent"], prompt="Rule: the secret phrase is pineapple.")
    run_dataset(staff, a["org"], a["agent"], v["id"])
    incident = staff.post(
        f"{base(a['org'])}/incidents",
        json={
            "title": "Slow answers",
            "severity": "sev3",
            "impact": "customer_facing",
            "client_summary": "Answers were slower than usual.",
            "note": "Internal: provider latency spike",
        },
    ).json()
    staff.post(f"{base(a['org'])}/incidents/{incident['id']}/transition", json={"to": "triaged", "expected_version": 1})
    client = signed_in(db)
    everything = " ".join(
        client.get(f"/api/portal/{p}").text for p in ("agents", "evaluations", "incidents", "incidents/1")
    )
    assert "pineapple" not in everything and "Internal:" not in everything and "prompt" not in everything
    evaluations = client.get("/api/portal/evaluations").json()
    assert evaluations[0]["simulated"] is True and evaluations[0]["total"] == 4
    detail = client.get("/api/portal/incidents/1").json()
    assert detail["client_summary"] == "Answers were slower than usual."
    assert [h["to_status"] for h in detail["history"]] == ["detected", "triaged"]


def test_tenant_comes_from_the_session_never_the_url(db, portal):
    """Client B cannot see A's records; there is no client route that takes an organisation id."""
    b = portal["tenant-b"]
    staff_b = login("owner.b@example.com")
    activate(db, staff_b, b["org"], "client.b@example.com")
    db.add(
        OpsIncident(
            organization_id=portal["tenant-a"]["org"],
            number=7,
            title="A only",
            severity="sev4",
            impact="internal",
            status="detected",
            lock_version=1,
        )
    )
    db.commit()
    client_b = signed_in(db, "client.b@example.com")
    assert client_b.get("/api/portal/incidents/7").status_code == 404
    assert client_b.get("/api/portal/incidents").json() == []
    assert client_b.get("/api/portal/me").json()["organization"] == "Tenant B"
    assert client_b.get(f"/api/portal/incidents?organization_id={portal['tenant-a']['org']}").json() == []
    from app.routers.portal import client as portal_client

    portal_paths = [r.path for r in portal_client.routes]
    assert len(portal_paths) >= 10 and not any("organization" in p for p in portal_paths)


def test_suspended_organisation_and_disabled_user_lose_access(db, portal):
    client = signed_in(db)
    org = db.get(OpsOrganization, portal["tenant-a"]["org"])
    org.status = "suspended"
    db.commit()
    assert client.get("/api/portal/dashboard").status_code == 401
    org.status = "active"
    db.commit()
    client = signed_in(db)
    user = db.scalar(select(PortalUser).where(PortalUser.email == "client@example.com"))
    assert portal["staff"].post(f"{base(org.id)}/portal-users/{user.id}/disable").json()["status"] == "disabled"
    assert client.get("/api/portal/dashboard").status_code == 401


def test_demo_organisations_have_no_client_access(db, tenants):
    org = db.get(OpsOrganization, tenants["tenant-a"]["org"])
    org.is_demo = True
    db.commit()
    staff = login("owner.a@example.com")
    response = staff.post(f"{base(org.id)}/portal-users", json={"email": "demo@example.com", "full_name": "Demo"})
    assert response.status_code == 409 and response.json()["code"] == "ops_demo_portal"


def test_staff_permissions_for_client_accounts(db, portal):
    from app.models import OpsRole
    from tests.test_ops_portal import add_member

    org = db.get(OpsOrganization, portal["tenant-a"]["org"])
    add_member(db, org, "operator.p@example.com", OpsRole.OPERATOR)
    operator = login("operator.p@example.com")
    assert (
        operator.post(f"{base(org.id)}/portal-users", json={"email": "x@example.com", "full_name": "X Y"}).status_code
        == 403
    )
    assert operator.get(f"{base(org.id)}/portal-users").status_code == 403
    other = login("owner.b@example.com")
    assert other.get(f"{base(org.id)}/portal-users").status_code == 404


def test_client_access_is_audited_per_organisation(db, portal):
    client = signed_in(db)
    client.get("/api/portal/incidents")
    entries = db.scalars(select(AuditLog).where(AuditLog.action == "ops.portal_viewed")).all()
    assert entries and all(e.details["organization_id"] == str(portal["tenant-a"]["org"]) for e in entries)
    assert all(e.actor_label.startswith("portal:") for e in entries)
    staff_view = portal["staff"].get(f"{base(portal['tenant-a']['org'])}/audit").json()
    assert any(e["action"] == "ops.portal_login" for e in staff_view)
    assert db.scalar(select(OpsIncidentEvent)) is None
