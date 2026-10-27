"""AI operations scaffold: authentication, RBAC and tenant isolation.

Two organisations (A and B) with separate members. Every test asserts that a member of one tenant
can neither read nor change the other's data, through any route, and that roles are enforced from
the RBAC matrix.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.cli import ensure_admin
from app.config import get_settings
from app.models import AuditLog, OpsAgent, OpsMembership, OpsOrganization, OpsRole, OpsWorkspace
from app.ops import service as ops
from app.ops.rbac import ROLE_PERMISSIONS, Permission, can, can_assign

PASSWORD = "Ops-Test-Password-2026"


def login(email: str) -> TestClient:
    from app.main import app

    client = TestClient(app)
    response = client.post("/api/admin/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = client.cookies.get(get_settings().csrf_cookie_name)
    return client


def user(db, email: str):
    created, _ = ensure_admin(db, email, PASSWORD, email.split("@")[0])
    return created


def add_member(db, org: OpsOrganization, email: str, role: OpsRole) -> None:
    db.add(OpsMembership(organization_id=org.id, user_id=user(db, email).id, role=role))
    db.commit()


@pytest.fixture
def tenants(db):
    """Org A (owner a@…) and org B (owner b@…), each with a workspace and an agent."""
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


def base(org_id) -> str:
    return f"/api/ops/organizations/{org_id}"


# --------------------------------------------------------------------------- authentication


def test_every_ops_route_requires_an_admin_session(client, tenants):
    org = tenants["tenant-a"]["org"]
    for method, path in [
        ("get", "/api/ops/organizations"),
        ("get", base(org)),
        ("get", f"{base(org)}/agents"),
        ("get", f"{base(org)}/workspaces"),
        ("get", f"{base(org)}/members"),
        ("get", f"{base(org)}/audit"),
        ("post", f"{base(org)}/agents"),
    ]:
        response = getattr(client, method)(path)
        assert response.status_code == 401, (method, path)
        assert response.json()["code"] == "unauthorized"


def test_writes_require_the_csrf_token(db, tenants):
    client = login("owner.a@example.com")
    del client.headers["X-CSRF-Token"]
    t = tenants["tenant-a"]
    response = client.post(
        f"{base(t['org'])}/agents", json={"workspace_id": str(t["workspace"]), "key": "x1", "name": "X1"}
    )
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_failed"


# --------------------------------------------------------------------------- tenant isolation


def test_members_list_only_their_own_organisations(db, tenants):
    a = login("owner.a@example.com").get("/api/ops/organizations").json()
    b = login("owner.b@example.com").get("/api/ops/organizations").json()
    assert [o["slug"] for o in a] == ["tenant-a"]
    assert [o["slug"] for o in b] == ["tenant-b"]
    assert a[0]["role"] == "owner"


def test_another_tenant_is_indistinguishable_from_a_missing_one(db, tenants):
    client = login("owner.a@example.com")
    other = tenants["tenant-b"]["org"]
    for suffix in ["", "/agents", "/workspaces", "/members", "/audit"]:
        foreign = client.get(f"{base(other)}{suffix}")
        missing = client.get(f"{base(uuid.uuid4())}{suffix}")
        assert foreign.status_code == missing.status_code == 404, suffix
        assert foreign.json()["code"] == missing.json()["code"] == "ops_not_found"
    assert client.post(f"{base(other)}/agents", json={}).status_code == 404
    assert (
        client.patch(f"{base(other)}/agents/{tenants['tenant-b']['agent']}", json={"status": "paused"}).status_code
        == 404
    )


def test_foreign_ids_cannot_be_reached_through_the_own_organisation(db, tenants):
    client = login("owner.a@example.com")
    a, b = tenants["tenant-a"], tenants["tenant-b"]
    # Agent of B addressed through A's path.
    assert client.patch(f"{base(a['org'])}/agents/{b['agent']}", json={"status": "paused"}).status_code == 404
    # Creating an agent in A inside B's workspace.
    response = client.post(
        f"{base(a['org'])}/agents", json={"workspace_id": str(b["workspace"]), "key": "intruder", "name": "Intruder"}
    )
    assert response.status_code == 404
    # Membership of B addressed through A's path.
    foreign_membership = db.scalar(select(OpsMembership.id).where(OpsMembership.organization_id == b["org"]))
    assert client.patch(f"{base(a['org'])}/members/{foreign_membership}", json={"role": "viewer"}).status_code == 404
    assert client.delete(f"{base(a['org'])}/members/{foreign_membership}").status_code == 404
    # A's lists never contain B's rows.
    agents = client.get(f"{base(a['org'])}/agents", params={"workspace_id": str(b["workspace"])}).json()
    assert agents == []
    db.expire_all()
    assert db.get(OpsAgent, b["agent"]).status == "active"
    assert db.scalar(select(OpsAgent).where(OpsAgent.key == "intruder")) is None


def test_the_database_rejects_an_agent_in_another_tenants_workspace(db, tenants):
    a, b = tenants["tenant-a"], tenants["tenant-b"]
    db.add(OpsAgent(organization_id=a["org"], workspace_id=b["workspace"], key="cross", name="Cross", status="planned"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_the_audit_view_shows_only_the_organisations_own_entries(db, tenants):
    a = login("owner.a@example.com")
    b = login("owner.b@example.com")
    ta, tb = tenants["tenant-a"], tenants["tenant-b"]
    assert a.patch(f"{base(ta['org'])}/agents/{ta['agent']}", json={"version": "v2"}).status_code == 200
    assert b.patch(f"{base(tb['org'])}/agents/{tb['agent']}", json={"version": "v9"}).status_code == 200
    entries = a.get(f"{base(ta['org'])}/audit").json()
    assert entries and all(e["details"]["organization_id"] == str(ta["org"]) for e in entries)
    assert {e["action"] for e in entries} >= {"ops.agent_updated", "ops.organization_created"}
    assert all(e["entity_id"] != str(tb["agent"]) for e in entries)


# --------------------------------------------------------------------------- RBAC


EXPECTED = {
    # role: (read agents, write agents, read members, write workspaces, read audit)
    OpsRole.VIEWER: (200, 403, 403, 403, 403),
    OpsRole.REVIEWER: (200, 403, 403, 403, 403),
    OpsRole.OPERATOR: (200, 201, 403, 403, 403),
    OpsRole.ADMIN: (200, 201, 200, 201, 200),
    OpsRole.OWNER: (200, 201, 200, 201, 200),
}


@pytest.mark.parametrize("role", list(EXPECTED))
def test_routes_enforce_the_rbac_matrix(db, tenants, role):
    t = tenants["tenant-a"]
    org = db.get(OpsOrganization, t["org"])
    email = f"{role.value}@example.com"
    add_member(db, org, email, role)
    client = login(email)
    results = (
        client.get(f"{base(t['org'])}/agents").status_code,
        client.post(
            f"{base(t['org'])}/agents",
            json={"workspace_id": str(t["workspace"]), "key": f"k-{role.value}", "name": "New agent"},
        ).status_code,
        client.get(f"{base(t['org'])}/members").status_code,
        client.post(
            f"{base(t['org'])}/workspaces",
            json={"slug": f"ws-{role.value}", "name": "Staging", "environment": "staging"},
        ).status_code,
        client.get(f"{base(t['org'])}/audit").status_code,
    )
    assert results == EXPECTED[role]
    overview = client.get(base(t["org"])).json()
    assert overview["role"] == role.value
    assert overview["permissions"] == sorted(p.value for p in ROLE_PERMISSIONS[role])


def test_admins_cannot_grant_or_change_owners_and_the_last_owner_stays(db, tenants):
    t = tenants["tenant-a"]
    org = db.get(OpsOrganization, t["org"])
    add_member(db, org, "admin.a@example.com", OpsRole.ADMIN)
    user(db, "new.person@example.com")
    admin = login("admin.a@example.com")
    owner = login("owner.a@example.com")

    assert (
        admin.post(f"{base(t['org'])}/members", json={"email": "new.person@example.com", "role": "owner"}).status_code
        == 403
    )
    added = admin.post(f"{base(t['org'])}/members", json={"email": "new.person@example.com", "role": "operator"})
    assert added.status_code == 201 and added.json()["role"] == "operator"
    owner_membership = db.scalar(
        select(OpsMembership.id).where(OpsMembership.organization_id == t["org"], OpsMembership.role == "owner")
    )
    assert admin.patch(f"{base(t['org'])}/members/{owner_membership}", json={"role": "viewer"}).status_code == 403
    assert admin.delete(f"{base(t['org'])}/members/{owner_membership}").status_code == 403

    demote = owner.patch(f"{base(t['org'])}/members/{owner_membership}", json={"role": "admin"})
    assert demote.status_code == 409 and demote.json()["code"] == "ops_last_owner"
    assert owner.delete(f"{base(t['org'])}/members/{owner_membership}").json()["code"] == "ops_last_owner"
    assert (
        admin.post(f"{base(t['org'])}/members", json={"email": "nobody@example.com", "role": "viewer"}).json()["code"]
        == "ops_user_unknown"
    )


def test_rbac_matrix_rules():
    assert can("viewer", Permission.AGENTS_READ) and not can("viewer", Permission.AGENTS_WRITE)
    assert can("operator", Permission.AGENTS_WRITE) and not can("operator", Permission.MEMBERS_READ)
    assert can_assign("owner", "owner") and not can_assign("admin", "owner")
    assert can_assign("admin", "admin") and can_assign("admin", "viewer")
    assert not can_assign("operator", "viewer")
    for role in OpsRole:
        assert Permission.ORG_READ in ROLE_PERMISSIONS[role]


# --------------------------------------------------------------------------- data rules


def test_registry_rejects_secrets_and_invalid_identifiers(db, tenants):
    client = login("owner.a@example.com")
    t = tenants["tenant-a"]
    path = f"{base(t['org'])}/agents"
    body = {"workspace_id": str(t["workspace"]), "key": "new-agent", "name": "New agent"}
    assert client.post(path, json={**body, "purpose": "api_key=sk-ant-abcdefghijklmnopqrstuvwxyz"}).status_code == 422
    assert client.post(path, json={**body, "model": "gpt <script>"}).status_code == 422
    assert client.post(path, json={**body, "key": "Not A Slug"}).status_code == 422
    assert client.post(path, json={**body, "connection_string": "x"}).status_code == 422  # unknown fields refused
    assert (
        client.post(
            path, json={**body, "provider": "anthropic", "model": "claude-opus-5-5", "version": "v1.0"}
        ).status_code
        == 201
    )
    assert client.post(path, json=body).json()["code"] == "ops_conflict"


def test_suspended_organisations_are_read_only(db, tenants):
    t = tenants["tenant-a"]
    org = db.get(OpsOrganization, t["org"])
    org.status = "suspended"
    db.commit()
    client = login("owner.a@example.com")
    assert client.get(f"{base(t['org'])}/agents").status_code == 200
    response = client.patch(f"{base(t['org'])}/agents/{t['agent']}", json={"status": "paused"})
    assert response.status_code == 403 and response.json()["code"] == "ops_suspended"


def test_overview_reports_registry_counts_and_no_telemetry(db, tenants):
    t = tenants["tenant-a"]
    overview = login("owner.a@example.com").get(base(t["org"])).json()
    assert overview["workspaces"] == 1
    assert overview["agents_by_status"] == {"active": 1}
    assert overview["telemetry"]["connected"] is False
    assert not {"runs", "cost", "latency", "incidents"} & set(overview)


def test_demo_data_is_labelled_and_never_created_in_production(db):
    user(db, "demo.owner@example.com")
    with pytest.raises(ops.OpsSetupError):
        ops.seed_demo(db, owner_email="demo.owner@example.com", app_env="production")
    org = ops.seed_demo(db, owner_email="demo.owner@example.com", app_env="development")
    assert org.is_demo and "sample" in org.name.lower()
    agents = db.scalars(select(OpsAgent).where(OpsAgent.organization_id == org.id)).all()
    assert agents and all("sample" in a.name.lower() for a in agents)
    assert ops.seed_demo(db, owner_email="demo.owner@example.com", app_env="development").id == org.id  # idempotent
    assert ops.purge_demo(db) == 1
    assert db.scalar(select(OpsOrganization).where(OpsOrganization.is_demo.is_(True))) is None
    assert db.scalar(select(AuditLog).where(AuditLog.action == "ops.organization_created")) is not None
