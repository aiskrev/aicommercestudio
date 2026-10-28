"""Public catalogue API (published content only) and the admin catalogue workflow."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.catalogue import public
from app.catalogue.seed import entity_id, seed_catalogue
from app.cli import ensure_admin, set_admin_role
from app.config import get_settings
from app.models import AuditLog
from tests.conftest import ADMIN_EMAIL

API = "/api/public/catalogue"
ADMIN = "/api/admin/catalogue"
AI_BAND = ["ai_strategy", "ai_agents_automation", "ai_applications", "ai_governance"]
ENGINEERING_BAND = ["commerce_engineering", "cloud_platform", "devops_sre", "data_integration"]
DOMAIN_ORDER = [*AI_BAND, *ENGINEERING_BAND, "managed_operations", "advisory_enablement"]
FORBIDDEN_KEYS = {"id", "revision", "status", "published_revision", "published_at", "updated_by_id", "archived"}


@pytest.fixture(autouse=True)
def _fresh_cache():
    public.reset_cache()
    yield
    public.reset_cache()


@pytest.fixture
def seeded(db):
    seed_catalogue(db)
    return db


def keys(payload: dict[str, Any]) -> list[str]:
    return [item["key"] for item in payload["items"]]


def walk_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {k for v in value.values() for k in walk_keys(v)}
    if isinstance(value, list):
        return {k for v in value for k in walk_keys(v)}
    return set()


def staff_client(db, email: str, role: str) -> TestClient:
    from app.main import app

    ensure_admin(db, email, "Staff-Password-2026", "Staff")
    set_admin_role(db, email, role)
    client = TestClient(app)
    response = client.post("/api/admin/auth/login", json={"email": email, "password": "Staff-Password-2026"})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = client.cookies.get(get_settings().csrf_cookie_name)
    return client


def editable(entity: dict[str, Any]) -> dict[str, Any]:
    """The PATCH body that keeps an entity as it is (the editor's form state)."""
    texts = {loc: {k: v for k, v in entity["translations"][loc].items() if v is not None} for loc in ("bg", "en")}
    body: dict[str, Any] = {
        "translations": texts,
        "capabilities": entity["capabilities"],
        "deliverables": entity["deliverables"],
        "related": entity["related"],
    }
    if entity["service"]:
        s = entity["service"]
        body["service"] = {
            "primary_domain": s["primary_domain"],
            "delivery_status": s["delivery_status"],
            "position": s["position"],
            "duration_min_days": s["duration_min_days"],
            "duration_max_days": s["duration_max_days"],
        }
    return body


def get_entity(client: TestClient, entity_id_: Any) -> tuple[dict[str, Any], str]:
    response = client.get(f"{ADMIN}/entities/{entity_id_}")
    assert response.status_code == 200, response.text
    return response.json(), response.headers["ETag"]


# --------------------------------------------------------------------------- public: reads


def test_domains_are_listed_in_taxonomy_order_in_both_languages(client, seeded):
    bg = client.get(f"{API}/domains").json()
    en = client.get(f"{API}/domains", params={"locale": "en"}).json()
    assert keys(bg) == DOMAIN_ORDER == keys(en)
    assert (bg["locale"], en["locale"], bg["total"]) == ("bg", "en", 10)
    devops = next(i for i in en["items"] if i["key"] == "devops_sre")
    assert devops["name"] == "DevOps, SRE & Observability"
    assert devops["alternate_slugs"] == {"bg": "devops-sre-i-nablyudaemost", "en": "devops-sre-and-observability"}
    assert devops["delivery_status"] == "custom"
    assert client.get(f"{API}/domains", headers={"Accept-Language": "en-GB"}).json()["locale"] == "en"


def test_domain_detail_by_key_and_by_slug(client, seeded):
    by_key = client.get(f"{API}/domains/commerce_engineering", params={"locale": "en"}).json()
    by_slug = client.get(f"{API}/domains/by-slug/commerce-engineering", params={"locale": "en"}).json()
    assert by_key == by_slug
    assert [s["key"] for s in by_key["services"]] == ["maintenance", "seo", "analytics"]
    assert by_key["contact_service"] == "audit"
    assert by_key["deliverables"] and by_key["families"]
    assert all(r["key"] in DOMAIN_ORDER for r in by_key["related_domains"])
    seo_family = next(f for f in by_key["families"] if f["key"] == "commerce_engineering.seo")
    assert [s["key"] for s in seo_family["services"]] == ["seo"]


def test_service_detail_by_key_and_by_locale_slug(client, seeded):
    bg = client.get(f"{API}/services/seo").json()
    assert client.get(f"{API}/services/by-slug/seo-optimizatsiya").json() == bg
    en = client.get(f"{API}/services/by-slug/seo-optimization", params={"locale": "en"}).json()
    assert en["key"] == "seo" and en["locale"] == "en"
    assert en["primary_domain"]["key"] == "commerce_engineering"
    assert en["capabilities"] and all(c["title"] and c["description"] for c in en["capabilities"])
    assert en["lead_category"] == "seo"
    assert {"services", "assessments", "workshops"} == set(en["related"])
    related = client.get(f"{API}/services/seo/related", params={"locale": "en"}).json()
    assert related["related"] == en["related"]


def test_no_internal_metadata_leaks(client, seeded):
    for path in ("/domains", "/domains/devops_sre", "/services", "/services/ai_managed", "/services/seo/related"):
        payload = client.get(f"{API}{path}").json()
        assert not walk_keys(payload) & FORBIDDEN_KEYS, path


def test_slug_of_the_other_locale_and_unknown_entries_are_404(client, seeded):
    response = client.get(f"{API}/services/by-slug/seo-optimization")  # EN slug, BG request
    assert (response.status_code, response.json()["code"]) == (404, "service_not_found")
    assert client.get(f"{API}/services/unknown_key").json()["code"] == "service_not_found"
    response = client.get(f"{API}/domains/nope", headers={"Accept-Language": "en"})
    assert (response.status_code, response.json()["code"], response.json()["detail"]) == (
        404,
        "domain_not_found",
        "Service domain not found.",
    )
    assert client.get(f"{API}/services/Bad-Key").status_code == 422


def test_service_listing_pagination_and_deterministic_order(client, seeded):
    full = client.get(f"{API}/services", params={"limit": 100}).json()
    assert full["total"] == 9 and len(full["items"]) == 9
    assert keys(full) == [
        "ai_agents",
        "automation",
        "ai_tools",
        "maintenance",
        "seo",
        "analytics",
        "integrations",
        "ai_managed",
        "audit",
    ]
    pages = [client.get(f"{API}/services", params={"limit": 4, "offset": o}).json() for o in (0, 4, 8)]
    assert sum((keys(p) for p in pages), []) == keys(full)
    assert [p["offset"] for p in pages] == [0, 4, 8] and pages[2]["limit"] == 4
    assert client.get(f"{API}/services", params={"offset": 50}).json()["items"] == []
    by_name = client.get(f"{API}/services", params={"sort": "name", "locale": "en", "limit": 100}).json()
    names = [i["name"].casefold() for i in by_name["items"]]
    assert names == sorted(names)
    assert client.get(f"{API}/services", params={"limit": 101}).status_code == 422
    assert client.get(f"{API}/services", params={"limit": 0}).status_code == 422
    assert client.get(f"{API}/services", params={"offset": -1}).status_code == 422


def test_service_filters(client, seeded):
    commerce = client.get(f"{API}/services", params={"domain": "commerce_engineering"}).json()
    assert keys(commerce) == ["maintenance", "seo", "analytics"]
    two = client.get(f"{API}/services", params=[("domain", "commerce_engineering"), ("domain", "managed_operations")])
    assert keys(two.json()) == ["maintenance", "seo", "analytics", "ai_managed"]
    assert client.get(f"{API}/services", params={"offering_type": "workshop"}).json()["total"] == 0
    assert keys(client.get(f"{API}/services", params={"q": "SEO", "locale": "en"}).json()) == ["seo"]


@pytest.mark.parametrize(
    ("params", "code"),
    [
        ({"domain": "unknown_domain"}, "invalid_filter"),
        ({"colour": "red"}, "invalid_filter"),
        ({"offering_type": "package"}, "validation_error"),
        ({"delivery_status": "soon"}, "validation_error"),
        ({"sort": "random"}, "validation_error"),
        ({"locale": "de"}, "validation_error"),
        ({"q": "x" * 101}, "validation_error"),
    ],
)
def test_invalid_filters_are_rejected(client, seeded, params, code):
    response = client.get(f"{API}/services", params=params)
    assert (response.status_code, response.json()["code"]) == (422, code)


def test_http_caching_headers_and_conditional_requests(client, seeded):
    response = client.get(f"{API}/domains/devops_sre", params={"locale": "en"})
    etag = response.headers["ETag"]
    assert response.headers["Cache-Control"] == "public, max-age=60, stale-while-revalidate=300"
    assert "Accept-Language" in response.headers["Vary"]
    again = client.get(f"{API}/domains/devops_sre", params={"locale": "en"}, headers={"If-None-Match": etag})
    assert (again.status_code, again.content) == (304, b"")
    bg = client.get(f"{API}/domains/devops_sre", params={"locale": "bg"}, headers={"If-None-Match": etag})
    assert bg.status_code == 200 and bg.headers["ETag"] != etag


def test_public_rate_limit(client, seeded, monkeypatch):
    monkeypatch.setattr(get_settings(), "catalogue_rate_limit", 3)
    statuses = [client.get(f"{API}/domains").status_code for _ in range(4)]
    assert statuses == [200, 200, 200, 429]
    assert client.get(f"{API}/domains").json()["code"] == "rate_limited"


def test_empty_catalogue_answers_with_empty_lists(client):
    assert client.get(f"{API}/domains").json()["items"] == []
    assert client.get(f"{API}/services/seo").status_code == 404


# --------------------------------------------------------------------------- admin: access control


def test_admin_catalogue_requires_a_session_and_csrf(client, admin_client, seeded):
    anonymous = TestClient(client.app)
    assert anonymous.get(f"{ADMIN}/entities").status_code == 401
    entity, etag = get_entity(admin_client, entity_id("service", "seo"))
    no_csrf = admin_client.patch(
        f"{ADMIN}/entities/{entity['id']}", json=editable(entity), headers={"If-Match": etag, "X-CSRF-Token": ""}
    )
    assert (no_csrf.status_code, no_csrf.json()["code"]) == (403, "csrf_failed")


def test_roles_are_enforced_by_the_api(db, seeded):
    editor = staff_client(db, "editor@example.com", "editor")
    viewer = staff_client(db, "viewer@example.com", "viewer")
    assert editor.get("/api/admin/auth/me").json()["user"]["role"] == "editor"
    seo = entity_id("service", "seo")

    entity, etag = get_entity(viewer, seo)
    response = viewer.patch(f"{ADMIN}/entities/{seo}", json=editable(entity), headers={"If-Match": etag})
    assert (response.status_code, response.json()["code"]) == (403, "forbidden_role")
    assert viewer.post(f"{ADMIN}/entities/{seo}/publish", headers={"If-Match": etag}).status_code == 403

    assert editor.patch(f"{ADMIN}/entities/{seo}", json=editable(entity), headers={"If-Match": etag}).status_code == 200
    response = editor.post(f"{ADMIN}/entities/{seo}/publish", headers={"If-Match": etag})
    assert (response.status_code, response.json()["code"]) == (403, "forbidden_role")
    assert editor.post(f"{ADMIN}/entities/{seo}/archive", headers={"If-Match": etag}).status_code == 403
    assert get_entity(editor, seo)[0]["permissions"] == ["edit"]
    assert get_entity(viewer, seo)[0]["permissions"] == []

    # Editors and viewers never reach leads, retention, AI approvals or the ops registry.
    for client in (editor, viewer):
        for path in ("/api/admin/leads", "/api/admin/dashboard/stats", "/api/admin/audit", "/api/ops/organizations"):
            response = client.get(path)
            assert (response.status_code, response.json()["code"]) == (403, "forbidden_role"), path


def test_optimistic_locking(admin_client, seeded):
    seo = entity_id("service", "seo")
    entity, etag = get_entity(admin_client, seo)
    missing = admin_client.patch(f"{ADMIN}/entities/{seo}", json=editable(entity))
    assert (missing.status_code, missing.json()["code"]) == (428, "precondition_required")
    stale = admin_client.patch(f"{ADMIN}/entities/{seo}", json=editable(entity), headers={"If-Match": '"99"'})
    assert (stale.status_code, stale.json()["code"]) == (412, "revision_conflict")
    assert stale.headers["ETag"] == etag


# --------------------------------------------------------------------------- admin: editing and validation


def test_editing_changes_the_working_copy_only_until_published(admin_client, client, db, seeded):
    seo = entity_id("service", "seo")
    entity, etag = get_entity(admin_client, seo)
    body = editable(entity)
    body["translations"]["en"]["summary"] = "A new English summary written in the editor."
    body["capabilities"] = body["capabilities"][:2]
    saved = admin_client.patch(f"{ADMIN}/entities/{seo}", json=body, headers={"If-Match": etag})
    assert saved.status_code == 200, saved.text
    assert saved.json()["revision"] == 2 and saved.json()["has_unpublished_changes"] is True

    live = client.get(f"{API}/services/seo", params={"locale": "en"}).json()
    assert live["summary"] != "A new English summary written in the editor."
    preview = admin_client.get(f"{ADMIN}/entities/{seo}/preview", params={"locale": "en"}).json()
    assert preview["summary"] == "A new English summary written in the editor." and len(preview["capabilities"]) == 2

    published = admin_client.post(f"{ADMIN}/entities/{seo}/publish", headers={"If-Match": saved.headers["ETag"]})
    assert published.status_code == 200, published.text
    assert published.json()["has_unpublished_changes"] is False
    live = client.get(f"{API}/services/seo", params={"locale": "en"}).json()
    assert live["summary"] == "A new English summary written in the editor." and len(live["capabilities"]) == 2

    unchanged = admin_client.patch(
        f"{ADMIN}/entities/{seo}", json=body, headers={"If-Match": published.headers["ETag"]}
    )
    assert unchanged.json()["revision"] == 2  # no change, no new revision

    actions = [e["action"] for e in admin_client.get(f"{ADMIN}/entities/{seo}/history").json()]
    assert actions[:2] == ["catalogue.entity_published", "catalogue.entity_updated"]
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "catalogue.entity_updated"))
    assert entry.actor_label == ADMIN_EMAIL and entry.details["key"] == "seo" and entry.details["fields"]
    assert "A new English summary" not in str(entry.details)  # field names only, never texts


@pytest.mark.parametrize(
    ("mutate", "field", "error_type"),
    [
        (lambda b: b["translations"]["en"].update(summary="<b>Bold</b> claims"), "translations.en.summary", "markup"),
        (
            lambda b: b["translations"]["bg"].update(body="Вижте [тук](javascript:alert(1))"),
            "translations.bg.body",
            "markup",
        ),
        (lambda b: b["translations"]["en"].update(name="Name‮evil"), "translations.en.name", "control_chars"),
        (lambda b: b["translations"]["en"].update(slug="Not A Slug"), "translations.en.slug", "catalogue_slug"),
        (lambda b: b["translations"]["en"].update(slug="ecommerce-maintenance"), "translations.en.slug", "slug_taken"),
        (lambda b: b["capabilities"].append({"bg": {"title": "<script>"}, "en": {}}), "capabilities.", "markup"),
        (lambda b: b["related"].append("seo"), "related.", "self_reference"),
        (lambda b: b["related"].append("no_such_service"), "related.", "unknown_reference"),
        (lambda b: b["service"].update(primary_domain=None), "service.primary_domain", "primary_domain_required"),
        (
            lambda b: b["service"].update(duration_min_days=1, duration_max_days=2),
            "service.duration_min_days",
            "duration_offering",
        ),
    ],
)
def test_invalid_or_dangerous_content_is_rejected(admin_client, seeded, mutate, field, error_type):
    seo = entity_id("service", "seo")
    entity, etag = get_entity(admin_client, seo)
    body = editable(entity)
    mutate(body)
    response = admin_client.patch(f"{ADMIN}/entities/{seo}", json=body, headers={"If-Match": etag})
    assert response.status_code == 422, response.text
    errors = response.json()["errors"]
    assert any(e["field"].startswith(field) and e["type"] == error_type for e in errors), errors
    assert get_entity(admin_client, seo)[0]["revision"] == 1  # nothing was written


# --------------------------------------------------------------------------- admin: lifecycle


def test_draft_lifecycle_create_publish_archive_restore(admin_client, client, seeded):
    created = admin_client.post(
        f"{ADMIN}/entities",
        json={
            "key": "seo_migration_workshop",
            "offering_type": "workshop",
            "primary_domain": "commerce_engineering",
            "name_bg": "Работна среща за SEO миграция",
            "name_en": "SEO migration workshop",
        },
    )
    assert created.status_code == 201, created.text
    workshop = created.json()
    assert (workshop["status"], workshop["permissions"]) == ("draft", ["edit", "publish", "archive"])

    # Drafts are invisible publicly.
    assert client.get(f"{API}/services/seo_migration_workshop").status_code == 404
    assert "seo_migration_workshop" not in keys(client.get(f"{API}/services", params={"limit": 100}).json())

    # Publishing an incomplete entry is refused with field errors, in the admin's language.
    refused = admin_client.post(
        f"{ADMIN}/entities/{workshop['id']}/publish",
        headers={"If-Match": created.headers["ETag"], "Accept-Language": "en"},
    )
    assert (refused.status_code, refused.json()["code"]) == (422, "catalogue_incomplete")
    fields = {e["field"] for e in refused.json()["errors"]}
    assert {"translations.bg.slug", "translations.en.summary", "translations.en.seo_description"} <= fields
    checks = admin_client.get(f"{ADMIN}/entities/{workshop['id']}/checks").json()
    assert checks["publishable"] is False and checks["errors"]
    assert admin_client.get(f"{ADMIN}/entities/{workshop['id']}/preview").json()["code"] == "catalogue_incomplete"

    body = editable(workshop)
    for loc, slug in (("bg", "rabotna-sreshta-seo-migratsiya"), ("en", "seo-migration-workshop")):
        body["translations"][loc].update(
            slug=slug,
            summary="Half a day with your team before a platform migration.",
            body="We review redirects, structured data and tracking before the switch.",
            seo_title="SEO migration workshop",
            seo_description=(
                "A half-day workshop that prepares redirects, structured data and tracking "
                "for a store migration without losing visibility."
            ),
        )
    body["deliverables"] = [{"bg": {"body": "Карта на пренасочванията"}, "en": {"body": "A redirect map"}}]
    body["service"]["duration_min_days"] = 0.5
    body["service"]["duration_max_days"] = 1
    saved = admin_client.patch(
        f"{ADMIN}/entities/{workshop['id']}", json=body, headers={"If-Match": created.headers["ETag"]}
    )
    assert saved.status_code == 200, saved.text
    published = admin_client.post(
        f"{ADMIN}/entities/{workshop['id']}/publish", headers={"If-Match": saved.headers["ETag"]}
    )
    assert published.status_code == 200, published.text

    detail = client.get(f"{API}/services/seo_migration_workshop", params={"locale": "en"}).json()
    assert detail["offering_type"] == "workshop" and detail["duration"] == {"min_days": 0.5, "max_days": 1.0}
    assert detail["deliverables"] == ["A redirect map"]
    related = client.get(f"{API}/services/seo/related").json()["related"]
    assert [w["key"] for w in related["workshops"]] == ["seo_migration_workshop"]
    assert keys(client.get(f"{API}/services", params={"offering_type": "workshop"}).json()) == [
        "seo_migration_workshop"
    ]

    archived = admin_client.post(
        f"{ADMIN}/entities/{workshop['id']}/archive", headers={"If-Match": published.headers["ETag"]}
    )
    assert archived.json()["status"] == "archived" and archived.json()["permissions"] == ["restore"]
    assert client.get(f"{API}/services/seo_migration_workshop").status_code == 404
    blocked = admin_client.patch(
        f"{ADMIN}/entities/{workshop['id']}", json=body, headers={"If-Match": archived.headers["ETag"]}
    )
    assert (blocked.status_code, blocked.json()["code"]) == (409, "invalid_transition")

    restored = admin_client.post(
        f"{ADMIN}/entities/{workshop['id']}/restore", headers={"If-Match": archived.headers["ETag"]}
    )
    assert restored.json()["status"] == "draft"
    assert client.get(f"{API}/services/seo_migration_workshop").status_code == 404  # must be published again

    actions = [e["action"] for e in admin_client.get(f"{ADMIN}/entities/{workshop['id']}/history").json()]
    assert actions == [
        "catalogue.entity_restored",
        "catalogue.entity_archived",
        "catalogue.entity_published",
        "catalogue.entity_updated",
        "catalogue.entity_created",
    ]


def test_create_validation(admin_client, seeded):
    base = {"offering_type": "service", "primary_domain": "commerce_engineering", "name_bg": "Име", "name_en": "Name"}
    taken = admin_client.post(f"{ADMIN}/entities", json={**base, "key": "seo", "lead_category": "seo"})
    assert (taken.status_code, taken.json()["code"]) == (409, "key_taken")
    category = admin_client.post(f"{ADMIN}/entities", json={**base, "key": "seo_two", "lead_category": "seo"})
    assert category.status_code == 422 and category.json()["errors"][0]["type"] == "lead_category_taken"
    no_domain = admin_client.post(
        f"{ADMIN}/entities", json={**base, "key": "x_one", "primary_domain": None, "lead_category": "other"}
    )
    assert no_domain.status_code == 422
    bad_key = admin_client.post(
        f"{ADMIN}/entities", json={**base, "key": "Bad-Key", "lead_category": None, "offering_type": "assessment"}
    )
    assert bad_key.status_code == 422 and bad_key.json()["errors"][0]["type"] == "catalogue_key"


def test_domains_cannot_be_archived_and_list_filters(admin_client, seeded):
    domain = entity_id("domain", "devops_sre")
    _, etag = get_entity(admin_client, domain)
    response = admin_client.post(f"{ADMIN}/entities/{domain}/archive", headers={"If-Match": etag})
    assert (response.status_code, response.json()["code"]) == (409, "domain_archive_not_allowed")

    listing = admin_client.get(f"{ADMIN}/entities", params={"type": "domain"}).json()
    assert listing["total"] == 10 and [i["domain"] for i in listing["items"]] == list("ABCDEFGHIJ")
    services = admin_client.get(
        f"{ADMIN}/entities", params={"type": "service", "domain": "commerce_engineering"}
    ).json()
    assert [i["key"] for i in services["items"]] == ["maintenance", "seo", "analytics"]
    found = admin_client.get(f"{ADMIN}/entities", params={"q": "seo-optim"}).json()
    assert [i["key"] for i in found["items"]] == ["seo"]
    assert admin_client.get(f"{ADMIN}/entities", params={"page_size": 101}).status_code == 422
    options = admin_client.get(f"{ADMIN}/options").json()
    assert options["role"] == "admin" and len(options["domains"]) == 10 and options["free_lead_categories"] == []
