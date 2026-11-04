"""Ops platform security foundation: restricted runtime role, row-level security, composite foreign
keys, transaction-local tenant context, permission matrix, enumeration, suspension and audit isolation.

RLS is exercised as `acs_app_runtime` (NOLOGIN, NOBYPASSRLS, owns nothing) — the role tenant-scoped
requests actually run as. Tests that only used the schema owner would prove nothing, because the owner
bypasses RLS; `test_owner_bypasses_rls_which_is_why_the_runtime_role_exists` shows exactly that.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError, ProgrammingError

from app.db import get_sessionmaker
from app.models import AuditLog, OpsAgent, OpsOrganization
from app.ops import rls
from app.ops.models import TENANT_TABLES, OpsAgentVersion, OpsIncidentEvent
from app.ops.rbac import ROLE_PERMISSIONS, WRITE_PERMISSIONS, Permission
from app.ops.tenancy import MODULES
from tests.test_ops_portal import base, login

RUNTIME = rls.RUNTIME_ROLE


def as_runtime(db, org_id=None, user_id=None) -> None:
    """Start a transaction as the restricted role with the given tenant context."""
    db.execute(text(f"SET LOCAL ROLE {RUNTIME}"))
    db.execute(
        text("SELECT set_config('app.ops_org', :o, true), set_config('app.ops_user', :u, true)"),
        {"o": str(org_id) if org_id else "", "u": str(user_id) if user_id else ""},
    )


# --------------------------------------------------------------------------- the role itself


def test_runtime_role_is_restricted(db):
    row = db.execute(
        text("SELECT rolsuper, rolbypassrls, rolcanlogin, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = :r"),
        {"r": RUNTIME},
    ).one()
    assert tuple(row) == (False, False, False, False, False)
    owners = db.scalars(
        text(
            "SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public' "
            "AND tablename LIKE ANY (ARRAY['ops_%', 'portal_%'])"
        )
    ).all()
    assert RUNTIME not in owners


def test_every_tenant_table_has_rls_and_a_policy(db):
    tables = [*TENANT_TABLES, "ops_memberships", "ops_organizations"]
    enabled = dict(
        db.execute(text("SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY(:t)"), {"t": tables}).all()
    )
    assert set(enabled) == set(tables) and all(enabled.values())
    with_policy = set(db.scalars(text("SELECT tablename FROM pg_policies WHERE tablename = ANY(:t)"), {"t": tables}))
    assert with_policy == set(tables)


def test_runtime_role_cannot_rewrite_audit_or_timelines(db, tenants):
    for statement in (
        "UPDATE audit_logs SET action = 'x'",
        "DELETE FROM audit_logs",
        "DELETE FROM ops_incident_events",
    ):
        as_runtime(db, tenants["tenant-a"]["org"])
        with pytest.raises(ProgrammingError):
            db.execute(text(statement))
        db.rollback()


# --------------------------------------------------------------------------- RLS behaviour


def test_rls_restricts_reads_to_the_bound_organisation(db, tenants):
    a, b = tenants["tenant-a"], tenants["tenant-b"]
    as_runtime(db, a["org"])
    assert set(db.scalars(text("SELECT id FROM ops_agents"))) == {a["agent"]}
    # Even an explicit filter for the other tenant returns nothing.
    assert db.scalars(text("SELECT id FROM ops_agents WHERE organization_id = :b"), {"b": b["org"]}).all() == []
    assert db.scalars(text("SELECT id FROM ops_workspaces WHERE id = :w"), {"w": b["workspace"]}).all() == []
    db.rollback()


def test_rls_without_context_sees_nothing(db, tenants):
    as_runtime(db)
    assert db.scalar(text("SELECT count(*) FROM ops_agents")) == 0
    assert db.scalar(text("SELECT count(*) FROM ops_organizations")) == 0
    db.rollback()


def test_rls_refuses_writes_into_another_organisation(db, tenants):
    a, b = tenants["tenant-a"], tenants["tenant-b"]
    as_runtime(db, a["org"])
    with pytest.raises(DBAPIError, match="row-level security"):
        db.execute(
            text(
                "INSERT INTO ops_agents (id, organization_id, workspace_id, key, name, status, created_at, updated_at) "
                "VALUES (:id, :org, :ws, 'x', 'X', 'planned', now(), now())"
            ),
            {"id": uuid.uuid4(), "org": b["org"], "ws": b["workspace"]},
        )
    db.rollback()
    as_runtime(db, a["org"])
    # Updates and deletes of B's rows silently match nothing.
    assert db.execute(text("UPDATE ops_agents SET name = 'pwned' WHERE id = :id"), {"id": b["agent"]}).rowcount == 0
    assert db.execute(text("DELETE FROM ops_agents WHERE id = :id"), {"id": b["agent"]}).rowcount == 0
    # Moving A's own row into B fails WITH CHECK.
    with pytest.raises(DBAPIError, match="row-level security"):
        db.execute(text("UPDATE ops_agents SET organization_id = :b WHERE id = :id"), {"b": b["org"], "id": a["agent"]})
    db.rollback()


def test_membership_and_organisation_visibility_for_the_organisation_list(db, tenants):
    from app.models import AdminUser

    owner_a = db.scalar(select(AdminUser.id).where(AdminUser.email == "owner.a@example.com"))
    as_runtime(db, None, owner_a)
    orgs = db.scalars(text("SELECT slug FROM ops_organizations")).all()
    assert orgs == ["tenant-a"]
    assert db.scalar(text("SELECT count(*) FROM ops_memberships")) == 1
    db.rollback()


def test_owner_bypasses_rls_which_is_why_the_runtime_role_exists(db, tenants):
    """The schema owner (migrations, CLI) sees every tenant; tenant requests must not run as it."""
    db.execute(text("SELECT set_config('app.ops_org', :o, true)"), {"o": str(tenants["tenant-a"]["org"])})
    assert db.scalar(text("SELECT count(*) FROM ops_agents")) == 2
    db.rollback()


def test_bound_sessions_run_every_transaction_as_the_runtime_role(db, tenants):
    a, b = tenants["tenant-a"], tenants["tenant-b"]
    with get_sessionmaker()() as session:
        rls.bind(session, organization_id=a["org"])
        assert session.scalar(text("SELECT current_user")) == RUNTIME
        # A query that "forgot" the tenant filter still sees only the bound organisation…
        assert set(session.scalars(select(OpsAgent.id))) == {a["agent"]}
        session.commit()
        # …also in the next transaction of the same session.
        assert set(session.scalars(select(OpsAgent.id))) == {a["agent"]}
        assert session.get(OpsAgent, b["agent"]) is None
    # The setting and the role are transaction-local: a fresh session on the pool is unscoped.
    with get_sessionmaker()() as session:
        assert session.scalar(text("SELECT current_user")) != RUNTIME
        assert session.scalar(text("SELECT current_setting('app.ops_org', true)")) in (None, "")


# --------------------------------------------------------------------------- composite foreign keys


def test_composite_foreign_keys_refuse_cross_tenant_links(db, tenants):
    a, b = tenants["tenant-a"], tenants["tenant-b"]
    db.add(
        OpsAgentVersion(
            organization_id=a["org"],
            agent_id=b["agent"],
            number=1,
            status="draft",
            prompt_template="x",
            parameters={},
            tools=[],
            environment="production",
            change_reason="test",
            sensitive=True,
            content_hash="0" * 64,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


# --------------------------------------------------------------------------- immutability


def test_approved_versions_and_timelines_are_immutable_in_the_database(db, tenants):
    a = tenants["tenant-a"]
    version = OpsAgentVersion(
        organization_id=a["org"],
        agent_id=a["agent"],
        number=1,
        status="approved",
        prompt_template="Rule: be kind",
        parameters={},
        tools=[],
        environment="production",
        change_reason="initial",
        sensitive=True,
        content_hash="0" * 64,
    )
    db.add(version)
    db.commit()
    version.prompt_template = "Rule: be unkind"
    with pytest.raises(DBAPIError, match="immutable"):
        db.commit()
    db.rollback()
    from app.ops.models import OpsIncident

    incident = OpsIncident(
        organization_id=a["org"],
        number=1,
        title="t",
        severity="sev3",
        impact="internal",
        status="detected",
        lock_version=1,
    )
    db.add(incident)
    db.flush()
    event = OpsIncidentEvent(organization_id=a["org"], incident_id=incident.id, kind="created", actor_label="x")
    db.add(event)
    db.commit()
    event.body = "rewritten"
    with pytest.raises(DBAPIError, match="append-only"):
        db.commit()
    db.rollback()


# --------------------------------------------------------------------------- permission matrix


def test_permission_matrix_is_complete_and_separates_duties():
    from app.models import OpsRole

    assert ROLE_PERMISSIONS[OpsRole.OWNER] == frozenset(Permission)
    assert ROLE_PERMISSIONS[OpsRole.ADMIN] == frozenset(Permission)
    for role in (OpsRole.OPERATOR, OpsRole.REVIEWER, OpsRole.VIEWER):
        assert {
            p
            for p in Permission
            if p.value.endswith(".read")
            and p not in (Permission.MEMBERS_READ, Permission.AUDIT_READ, Permission.PORTAL_USERS_READ)
        } <= ROLE_PERMISSIONS[role]
    operator, reviewer = ROLE_PERMISSIONS[OpsRole.OPERATOR], ROLE_PERMISSIONS[OpsRole.REVIEWER]
    deciding = {
        Permission.REGISTRY_APPROVE,
        Permission.CHANGES_APPROVE,
        Permission.INCIDENTS_REVIEW,
        Permission.EVALS_LABEL,
    }
    assert not (operator & deciding) and deciding <= reviewer
    assert not (reviewer & {Permission.REGISTRY_WRITE, Permission.CHANGES_WRITE, Permission.OBSERVABILITY_WRITE})
    assert ROLE_PERMISSIONS[OpsRole.VIEWER] <= {p for p in Permission if p.value.endswith(".read")}
    assert all(not p.value.endswith(".read") for p in WRITE_PERMISSIONS)


def test_every_tenant_route_declares_a_permission():
    """No route under an organisation path is reachable without `require()` (or the portal session)."""
    from app.routers import ops, ops_platform, portal

    checked = 0
    for route in [*ops.router.routes, *ops_platform.router.routes, *portal.staff.routes]:
        path = getattr(route, "path", "")
        if not path.startswith("/api/ops/organizations/{organization_id}"):
            continue
        names = {d.call.__qualname__ for d in route.dependant.dependencies if d.call}
        assert any(n.startswith("require.<locals>") for n in names), path
        checked += 1
    assert checked >= 50


def test_switched_off_modules_answer_404(tenants, monkeypatch):
    from app.config import get_settings

    client = login("owner.a@example.com")
    org = tenants["tenant-a"]["org"]
    assert client.get(f"{base(org)}/incidents").status_code == 200
    monkeypatch.setattr(get_settings(), "ops_modules", "registry")
    assert client.get(f"{base(org)}/incidents").status_code == 404
    assert client.get(f"{base(org)}/agents/{tenants['tenant-a']['agent']}/versions").status_code == 200
    assert client.get(base(org)).json()["modules"] == ["registry"]
    assert set(MODULES) == {"registry", "evaluations", "observability", "incidents", "changes"}


# --------------------------------------------------------------------------- enumeration and suspension


def test_objects_of_another_tenant_cannot_be_enumerated(tenants):
    client = login("owner.a@example.com")
    a, b = tenants["tenant-a"], tenants["tenant-b"]
    missing = client.get(f"{base(uuid.uuid4())}/incidents")
    foreign = client.get(f"{base(b['org'])}/incidents")
    assert missing.status_code == foreign.status_code == 404
    assert missing.json()["code"] == foreign.json()["code"] == "ops_not_found"
    # Another tenant's object through one's own organisation path is simply not found.
    assert client.get(f"{base(a['org'])}/agents/{b['agent']}/versions").status_code == 404
    assert client.get(f"{base(a['org'])}/versions/{uuid.uuid4()}").status_code == 404


def test_suspended_organisation_is_read_only(db, tenants):
    a = tenants["tenant-a"]
    client = login("owner.a@example.com")
    org = db.get(OpsOrganization, a["org"])
    org.status = "suspended"
    db.commit()
    assert client.get(f"{base(a['org'])}/incidents").status_code == 200
    created = client.post(
        f"{base(a['org'])}/incidents", json={"title": "Outage", "severity": "sev2", "impact": "internal"}
    )
    assert created.status_code == 403 and created.json()["code"] == "ops_suspended"
    assert (
        client.post(
            f"{base(a['org'])}/agents/{a['agent']}/versions",
            json={"content": {"prompt_template": "x"}, "change_reason": "test"},
        ).status_code
        == 403
    )


def test_audit_view_is_restricted_to_the_organisation(db, tenants):
    a, b = tenants["tenant-a"], tenants["tenant-b"]
    client_a, client_b = login("owner.a@example.com"), login("owner.b@example.com")
    assert (
        client_b.post(
            f"{base(b['org'])}/incidents", json={"title": "B only", "severity": "sev3", "impact": "internal"}
        ).status_code
        == 201
    )
    entries = client_a.get(f"{base(a['org'])}/audit").json()
    assert all(e["details"].get("organization_id") == str(a["org"]) for e in entries)
    assert not any(e["action"] == "ops.incident_created" for e in entries)
    # Entries without an organisation (site actions) never appear in an organisation's audit view.
    db.add(AuditLog(action="ops.unscoped_example", actor_label="system", details={}))
    db.commit()
    assert not any(e["action"] == "ops.unscoped_example" for e in client_a.get(f"{base(a['org'])}/audit").json())
