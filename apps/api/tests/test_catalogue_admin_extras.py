"""Admin catalogue: family editing in domains, deleting never-published drafts, staff roles."""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy import select

from app.catalogue import public
from app.catalogue.seed import entity_id, seed_catalogue
from app.cli import ensure_admin, set_admin_role
from app.models import AuditLog, CatalogueEntity
from app.services.staff import StaffError
from tests.conftest import ADMIN_EMAIL
from tests.test_catalogue_api import ADMIN, API, editable, get_entity, staff_client


@pytest.fixture(autouse=True)
def _fresh_cache():
    public.reset_cache()
    yield
    public.reset_cache()


@pytest.fixture
def seeded(db):
    seed_catalogue(db)
    return db


def families_body(entity: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {k: family[k] for k in ("key", "delivery_status", "services", "via", "bg", "en")}
        for family in entity["domain"]["families"]
    ]


def patch(client, entity_id_, body, etag):
    return client.patch(f"{ADMIN}/entities/{entity_id_}", json=body, headers={"If-Match": etag})


# --------------------------------------------------------------------------- families


def test_families_are_edited_reordered_added_and_archived_then_published(admin_client, client, db, seeded):
    domain = entity_id("domain", "devops_sre")
    entity, etag = get_entity(admin_client, domain)
    families = families_body(entity)
    assert [f["key"] for f in families][:2] == ["cicd", "release"]

    families[0], families[1] = families[1], families[0]  # reorder
    families[0]["en"]["summary"] = "Gated migrations, feature flags and safe rollouts."
    families[0]["services"] = ["integrations"]
    removed = families.pop()  # the last family is left out → archived
    families.append(
        {
            "key": "ai_cost_reviews",
            "delivery_status": "planned",
            "services": [],
            "via": ["managed_operations"],
            "bg": {
                "name": "Прегледи на AI разходите",
                "summary": "Месечен преглед на токените.",
                "prerequisite": "Достъп до данните за потребление.",
            },
            "en": {
                "name": "AI cost reviews",
                "summary": "A monthly token review.",
                "prerequisite": "Access to usage data.",
            },
        }
    )
    body = editable(entity) | {"families": families}
    saved = patch(admin_client, domain, body, etag)
    assert saved.status_code == 200, saved.text
    out = saved.json()
    assert out["revision"] == 2
    assert [f["key"] for f in out["domain"]["families"]] == [f["key"] for f in families]
    assert out["domain"]["families"][0]["services"] == ["integrations"]
    archived = db.scalar(select(CatalogueEntity).where(CatalogueEntity.key == f"devops_sre.{removed['key']}"))
    assert archived.status == "archived"

    # The public API changes only after publishing.
    before = client.get(f"{API}/domains/devops_sre", params={"locale": "en"}).json()
    assert before["families"][0]["key"] == "devops_sre.cicd"
    published = admin_client.post(f"{ADMIN}/entities/{domain}/publish", headers={"If-Match": saved.headers["ETag"]})
    assert published.status_code == 200, published.text
    after = client.get(f"{API}/domains/devops_sre", params={"locale": "en"}).json()
    keys = [f["key"] for f in after["families"]]
    assert keys[0] == "devops_sre.release" and keys[-1] == "devops_sre.ai_cost_reviews"
    assert f"devops_sre.{removed['key']}" not in keys
    assert after["families"][0]["summary"] == "Gated migrations, feature flags and safe rollouts."
    assert [s["key"] for s in after["families"][0]["services"]] == ["integrations"]
    assert after["families"][-1]["via"][0]["key"] == "managed_operations"

    # Re-adding an archived family revives it.
    entity, etag = get_entity(admin_client, domain)
    revived = families_body(entity) + [removed]
    response = patch(admin_client, domain, editable(entity) | {"families": revived}, etag)
    assert response.status_code == 200, response.text
    db.expire_all()
    assert db.get(CatalogueEntity, archived.id).status == "published"


@pytest.mark.parametrize(
    ("mutate", "field", "error_type"),
    [
        (lambda f: f.append(dict(f[0])), "families.", "duplicate_key"),
        (lambda f: f[0].update(services=["no_such_service"]), "families.0.services.0", "unknown_reference"),
        (lambda f: f[0].update(via=["devops_sre"]), "families.0.via.0", "self_reference"),
        (lambda f: f[0]["en"].update(name="<i>CI</i>"), "families.0.en.name", "markup"),
        (lambda f: f[0].update(key="Bad Key"), "families.0.key", "string_pattern_mismatch"),
    ],
)
def test_family_validation(admin_client, seeded, mutate, field, error_type):
    domain = entity_id("domain", "devops_sre")
    entity, etag = get_entity(admin_client, domain)
    families = families_body(entity)
    mutate(families)
    response = patch(admin_client, domain, editable(entity) | {"families": families}, etag)
    assert response.status_code == 422, response.text
    errors = response.json()["errors"]
    assert any(e["field"].startswith(field) and e["type"] == error_type for e in errors), errors


def test_planned_family_needs_a_prerequisite_in_both_languages_to_publish(admin_client, seeded):
    domain = entity_id("domain", "devops_sre")
    entity, etag = get_entity(admin_client, domain)
    families = families_body(entity)
    families[0]["delivery_status"] = "planned"
    families[0]["en"]["prerequisite"] = None
    saved = patch(admin_client, domain, editable(entity) | {"families": families}, etag)
    assert saved.status_code == 200, saved.text
    refused = admin_client.post(f"{ADMIN}/entities/{domain}/publish", headers={"If-Match": saved.headers["ETag"]})
    assert (refused.status_code, refused.json()["code"]) == (422, "catalogue_incomplete")
    assert {e["field"] for e in refused.json()["errors"]} >= {
        "families.0.bg.prerequisite",
        "families.0.en.prerequisite",
    }


def test_services_have_no_families(admin_client, seeded):
    seo = entity_id("service", "seo")
    entity, etag = get_entity(admin_client, seo)
    response = patch(admin_client, seo, editable(entity) | {"families": []}, etag)
    assert response.status_code == 422 and response.json()["errors"][0]["field"] == "families"


# --------------------------------------------------------------------------- deleting drafts


def create_draft(client, key: str) -> dict[str, Any]:
    response = client.post(
        f"{ADMIN}/entities",
        json={
            "key": key,
            "offering_type": "assessment",
            "primary_domain": "advisory_enablement",
            "name_bg": "Чернова",
            "name_en": "Draft",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_a_never_published_draft_can_be_deleted_by_an_admin(admin_client, db, seeded):
    draft = create_draft(admin_client, "draft_to_delete")
    assert "delete" in draft["permissions"]
    path = f"{ADMIN}/entities/{draft['id']}"
    assert admin_client.delete(path).json()["code"] == "precondition_required"
    editor = staff_client(db, "deleting.editor@example.com", "editor")
    forbidden = editor.delete(path, headers={"If-Match": '"1"'})
    assert (forbidden.status_code, forbidden.json()["code"]) == (403, "forbidden_role")
    assert "delete" not in get_entity(editor, draft["id"])[0]["permissions"]

    assert admin_client.delete(path, headers={"If-Match": '"1"'}).status_code == 204
    assert admin_client.get(path).status_code == 404
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "catalogue.entity_deleted"))
    assert entry.actor_label == ADMIN_EMAIL and entry.details["key"] == "draft_to_delete"


def test_published_referenced_or_once_published_entries_cannot_be_deleted(admin_client, seeded):
    seo, etag = get_entity(admin_client, entity_id("service", "seo"))
    assert "delete" not in seo["permissions"]
    response = admin_client.delete(f"{ADMIN}/entities/{seo['id']}", headers={"If-Match": etag})
    assert (response.status_code, response.json()["code"]) == (409, "invalid_transition")

    draft = create_draft(admin_client, "linked_draft")
    body = editable(seo)
    body["related"] = [*body["related"], "linked_draft"]
    linked = admin_client.patch(f"{ADMIN}/entities/{seo['id']}", json=body, headers={"If-Match": etag})
    assert linked.status_code == 200, linked.text
    response = admin_client.delete(f"{ADMIN}/entities/{draft['id']}", headers={"If-Match": '"1"'})
    assert (response.status_code, response.json()["code"]) == (409, "entity_referenced")

    domain, domain_etag = get_entity(admin_client, entity_id("domain", "commerce_engineering"))
    response = admin_client.delete(f"{ADMIN}/entities/{domain['id']}", headers={"If-Match": domain_etag})
    assert response.json()["code"] == "invalid_transition"


# --------------------------------------------------------------------------- staff roles


def test_admins_list_staff_and_change_roles(admin_client, admin_user, db):
    viewer = staff_client(db, "roles.viewer@example.com", "viewer")
    staff = admin_client.get("/api/admin/staff").json()
    me = next(s for s in staff if s["email"] == ADMIN_EMAIL)
    target = next(s for s in staff if s["email"] == "roles.viewer@example.com")
    assert me["is_self"] and me["role"] == "admin" and not target["is_self"]
    assert "password_hash" not in me

    response = admin_client.patch(f"/api/admin/staff/{target['id']}", json={"role": "editor"})
    assert response.status_code == 200 and response.json()["role"] == "editor"
    assert viewer.get(f"{ADMIN}/options").status_code == 401  # sessions revoked
    entry = db.scalar(
        select(AuditLog).where(AuditLog.action == "admin.role_changed", AuditLog.actor_label == ADMIN_EMAIL)
    )
    assert entry.details == {"from": "viewer", "to": "editor"}

    own = admin_client.patch(f"/api/admin/staff/{me['id']}", json={"role": "viewer"})
    assert (own.status_code, own.json()["code"]) == (409, "own_role")
    assert admin_client.patch(f"/api/admin/staff/{target['id']}", json={"role": "owner"}).status_code == 422
    missing = admin_client.patch("/api/admin/staff/00000000-0000-4000-8000-000000000000", json={"role": "viewer"})
    assert missing.json()["code"] == "staff_not_found"


def test_only_admins_manage_roles(db, admin_user):
    editor = staff_client(db, "roles.editor@example.com", "editor")
    for response in (
        editor.get("/api/admin/staff"),
        editor.patch(f"/api/admin/staff/{admin_user.id}", json={"role": "viewer"}),
    ):
        assert (response.status_code, response.json()["code"]) == (403, "forbidden_role")


def test_the_last_active_admin_cannot_be_demoted(db, admin_user):
    with pytest.raises(StaffError) as exc:
        set_admin_role(db, ADMIN_EMAIL, "viewer")
    assert exc.value.code == "last_admin"
    db.rollback()
    ensure_admin(db, "second.admin@example.com", "Second-Password-2026", "Second")
    assert set_admin_role(db, ADMIN_EMAIL, "viewer") is True
