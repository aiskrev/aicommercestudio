# API architecture v2: service catalogue

**Status:** design only. No route exists yet, and [API_REFERENCE.md](API_REFERENCE.md) and
`docs/openapi.json` describe the current API unchanged. When these routes are built, they are added
to API_REFERENCE.md and the spec is regenerated. `scripts/docs_sync.py` fails the API suite
otherwise.

**Companion documents:**

* [SERVICE_CATALOGUE_ARCHITECTURE.md](SERVICE_CATALOGUE_ARCHITECTURE.md): model, lifecycle, locale
  policy, caching and roll-out.
* [DATABASE_SCHEMA_V2.md](DATABASE_SCHEMA_V2.md): tables and constraints.

## 1. Principles

* **Same application, same conventions.** A new module `app/catalogue/` contains `models.py`,
  `schemas.py`, `validation.py`, `release.py` (builds the document), `service.py` (writes),
  `cache.py`, and two routers: `public_catalogue.py` and `admin_catalogue.py`. Sessions, CSRF,
  the error envelope, `X-Request-ID`, the rate limiter and `Accept-Language` handling are reused as
  they are.
* **Public reads come only from the active release.** They never touch the working tables. Drafts,
  archived entities and unpublished edits are therefore unreachable from the public API by
  construction.
* **Admin reads and writes use the working tables.** Every write is a short transaction that
  increments the entity revision and records an audit entry.
* **Read models are documents; write models are typed.** The release document is JSON. Every write
  payload is a strict Pydantic model (`StrictModel`, `extra="forbid"`) mapped to typed columns.

## 2. Public endpoints (no authentication)

Base: `/api/public/catalogue`. All endpoints are `GET`, take `locale` (`bg` | `en`), and return
`ETag` plus `Cache-Control: public, max-age=60, stale-while-revalidate=300`.

| Method and path | Returns | Notes |
| --- | --- | --- |
| `GET /release` | `{number, content_hash, schema_version, published_at}` | cheap freshness check (build scripts, monitoring) |
| `GET /domains` | domains in band order with name, summary, status, code, band, icon, slug, service links | services index, navigation |
| `GET /domains/{slug}` | one hub: translations, families (status, service links, `via`), items, engagements, related domains, tools, `available_locales`, `alternate_slugs` | 404 if unknown in that locale |
| `GET /services` | paginated list (§4) | filters: `domain`, `offering_type`, `delivery_status`, `industry`, `technology`, `q` |
| `GET /services/{slug}` | one service or offering: everything a page renders, plus `primary_domain`, `families`, `offerings` (for a managed service), `related`, `faqs`, `tools`, `article_keys` | |
| `GET /industries`, `GET /industries/{slug}` | industries with applicable services and domains | |
| `GET /technologies` | technologies with category; filter `category` | labels and filters only (CA-5) |
| `GET /routes` | `{slugs: {bg→en per namespace}, redirects: [{locale, from, to}], availability}` | language switcher, the proxy's 308s, sitemap |
| `GET /export` | the full active release document (both locales) | build-time input for the web (S5); stricter rate limit |

**Locale resolution.** `locale` query parameter, then `Accept-Language` (`en-*` → `en`), then
`bg`. There is no text fallback between languages. An entity that is not available in the requested
locale answers 404 `not_available_in_locale`, with `available_locales` in the body.

**Example: `GET /api/public/catalogue/domains/devops-sre-and-observability?locale=en`**

```json
{
  "release": 7,
  "locale": "en",
  "key": "devops_sre",
  "code": "F",
  "band": "engineering",
  "slug": "devops-sre-and-observability",
  "alternate_slugs": { "bg": "devops-sre-i-nablyudaemost" },
  "available_locales": ["bg", "en"],
  "name": "DevOps, SRE & Observability",
  "summary": "…",
  "body": "…",
  "status": "custom",
  "cta": { "label": "Request a delivery and observability review", "contact_service": "integrations" },
  "families": [
    { "key": "devops_sre.cicd", "title": "CI/CD pipelines", "capabilities": "…", "status": "custom",
      "services": [], "via": [] }
  ],
  "items": { "ideal_customer": ["…"], "problem": ["…"], "deliverable": ["…"],
             "prerequisite": ["…"], "limitation": ["…"] },
  "engagements": [ { "model": "managed", "via": [ { "key": "managed_operations", "slug": "managed-ai-and-platform-operations" } ] } ],
  "related": [ { "key": "cloud_platform", "slug": "cloud-and-platform-engineering", "name": "…", "summary": "…" } ],
  "tools": [],
  "seo": { "title": "…", "description": "…" }
}
```

The `status` field is the derived delivery status. Lifecycle states (`draft`, `published`,
`archived`) never appear publicly: everything in a release is published by definition.

## 3. Admin endpoints

Base: `/api/admin/catalogue`. Session cookie + `X-CSRF-Token` on writes (the existing dependency),
plus a role check (DATABASE_SCHEMA_V2 §3.15). Responses carry `Cache-Control: no-store`.

### 3.1 Entities

| Method and path | Role | Purpose |
| --- | --- | --- |
| `GET /entities` | viewer | paginated list; filters: `type`, `status`, `domain`, `delivery_status`, `offering_type`, `locale_missing`, `q`; sort: `position`, `key`, `updated` |
| `POST /entities` | editor | create a draft: `{type, key, …subtype fields}`; 409 `key_taken` |
| `GET /entities/{id}` | viewer | full working copy: subtype fields, both translations, items, engagements, relations, tools, family links; `ETag: "<revision>"` |
| `PATCH /entities/{id}` | editor | subtype fields (band, position, delivery status, primary domain, tier, …). `key` and `entity_type` are rejected (422 `key_immutable`). |
| `PUT /entities/{id}/translations/{locale}` | editor | replace one translation; a slug change on a published entity writes `slug_history` |
| `PUT /entities/{id}/items/{item_type}` | editor | replace the ordered list of one item type with its translations, atomically |
| `PUT /entities/{id}/relations/{kind}` | editor | replace the ordered outgoing relations of one kind (target keys) |
| `PUT /entities/{id}/engagements` | editor | replace the engagement models and `via` domains |
| `PUT /entities/{id}/tools` | editor | replace the ordered tool keys |
| `PUT /families/{id}/services` | editor | replace the services that implement a family |
| `POST /entities/{id}/status` | editor | `{to: "published" \| "archived"}`; restore is `archived → published` |
| `DELETE /entities/{id}` | admin | hard delete, only if never published and unreferenced; otherwise 409 |
| `GET /entities/{id}/history` | viewer | the audit entries of this entity (paged) |

**Optimistic concurrency.** Every `PATCH`, `PUT`, `POST …/status` and `DELETE` requires
`If-Match: "<revision>"`. A missing header answers 428 `precondition_required`. A stale revision
answers 412 `revision_conflict`, and the body includes the current revision. A successful write
returns the new `ETag`.

**Replace-list semantics.** List endpoints take the complete ordered list. The server diffs it
against the stored list, rewrites positions in one transaction (the deferred unique constraints
allow this), and records one audit entry with counts. There are no per-item endpoints: catalogue
lists are short, and replacing the whole list avoids ordering races.

### 3.2 Validation and releases

| Method and path | Role | Purpose |
| --- | --- | --- |
| `POST /validate` | editor | runs the release validator on the current working copy; returns `{ok, errors[], warnings[]}`; writes nothing |
| `GET /releases` | viewer | paginated list (number, author, note, counts, active, `revalidated_at`) |
| `GET /releases/{number}` | viewer | metadata; `GET /releases/{number}/document` returns the document |
| `GET /releases/{a}/diff/{b}` | viewer | entity-level diff (added, removed, changed fields per locale), computed on demand |
| `POST /releases` | admin | `{note}`: validate, build, store, activate, call the web hook. 201 with the release, or 422 `catalogue_invalid` with the errors. |
| `POST /releases/{number}/activate` | admin | rollback or roll-forward to an existing release; audited |

**Validator error item:**

```json
{ "rule": "seo.title_length", "severity": "error", "entity": "domain:devops_sre",
  "locale": "bg", "field": "seo_title", "message": "Заглавието е 64 знака; максимумът е 60." }
```

`message` follows the request language, as every API message does. `rule` is stable, and clients
branch on it.

## 4. Pagination, filtering and sorting

| Aspect | Public | Admin |
| --- | --- | --- |
| Style | `limit` (1–100, default 50) + `offset` (≥ 0) | `page` (1–10 000) + `page_size` (1–100, default 20), as `/api/admin/leads` |
| Envelope | `{items, total, limit, offset, release}` | `{items, total, page, page_size}` (the shape of `LeadPage`) |
| Stability | stable: a release is immutable, and `release` in the envelope lets a client detect a change between pages | the working copy can change between pages; acceptable at this size |
| Default order | `position`, then `key` (domain order by code) | `position`; `sort=key` / `sort=updated` |

**Filter semantics.**

* Different parameters combine with AND.
* A repeated parameter combines with OR (`?domain=devops_sre&domain=cloud_platform`).
* Values are keys (`domain=devops_sre`), not slugs or UUIDs, so they work in both locales.
* `q` is a case-insensitive substring match on name and summary in the requested locale, at most
  100 characters.
* Unknown filter values answer 422 `validation_error` with the usual field list. They are not
  ignored silently.

**Why offset, not cursors.** Public lists are read from an immutable release of about a hundred
entities, and admin lists from a table of the same size. Offset pagination is exact here and
matches the existing admin endpoints. Cursor pagination would add complexity without benefit.

## 5. Caching and conditional requests

| Response | Headers | Conditional |
| --- | --- | --- |
| public `GET` | `ETag: "<content_hash>-<locale>"`, `Cache-Control: public, max-age=60, stale-while-revalidate=300`, `Vary: Accept-Language` | `If-None-Match` → 304 without a body |
| `GET /export` | `ETag: "<content_hash>"`, `Cache-Control: public, max-age=60` | 304 |
| admin `GET` | `Cache-Control: no-store`, `ETag: "<revision>"` | `If-Match` on writes (§3.1) |

**In-process cache.** `app/catalogue/cache.py` keeps the active release document, parsed into
per-locale indexes (by slug, by key, slug maps), keyed by `(number, content_hash)`. The active
number is re-read with a primary-key query at most every 5 seconds. Publishing or activating in the
same process invalidates the cache immediately.

**Web revalidation (phase S5).**

1. After a publish or activation, the API sends `POST {WEB_INTERNAL_URL}/api/web-revalidate` with
   `Authorization: Bearer <REVALIDATE_SECRET>` and `{release, content_hash}`.
2. The route handler sits in `apps/web/src/app/api/web-revalidate/route.ts`. A static segment
   takes precedence over the existing `/api/[...path]` proxy. It calls `revalidateTag("catalogue")`.
3. The reverse proxy (Caddy) must deny `/api/web-revalidate` from outside, and the handler compares
   the secret in constant time.
4. The API sets `catalogue_releases.revalidated_at` on success. On failure it logs and leaves the
   column empty, and `python -m app.cli catalogue-revalidate` retries. A failed hook never rolls
   back the release.

## 6. Errors

The existing error envelope `{detail, code, request_id[, errors]}` is unchanged. New codes:

| HTTP | `code` | When |
| --- | --- | --- |
| 403 | `forbidden_role` | the admin's role does not allow the action |
| 404 | `not_found` | unknown slug, key or id (existing code) |
| 404 | `not_available_in_locale` | entity exists, but not in this locale; body adds `available_locales` |
| 409 | `key_taken`, `slug_taken` | uniqueness, including retired slugs in `slug_history` |
| 409 | `entity_referenced` | archive or delete blocked by references; body lists them as `{type, key, kind}` |
| 412 | `revision_conflict` | stale `If-Match`; body adds `current_revision` |
| 422 | `key_immutable` | `PATCH` tried to change `key` or `entity_type` |
| 422 | `catalogue_invalid` | publish refused by the validator; `errors` holds validator items (§3.2) |
| 428 | `precondition_required` | write without `If-Match` |
| 503 | `no_active_release` | public read before the first import |

## 7. Rate limits and abuse

The in-memory limiter is reused (single API instance, a known limitation):

* public catalogue `GET`: 120 requests per minute per IP hash;
* `GET /export`: 10 per minute per IP hash;
* admin writes: the existing admin limits.

Public responses contain no personal data and no internal ids (keys and slugs only).

## 8. Interaction with existing endpoints

| Endpoint | Change |
| --- | --- |
| `POST /api/public/leads`, `/quote-requests` | none. `service` stays a `ServiceKey`. In S4+ the web form can list services from the catalogue, filtered to entries whose `lead_category` is set. |
| `GET /api/admin/leads?service=` | none. Lead categories stay `ServiceKey` (K2). |
| `deps.require_admin` | gains the role. Existing endpoints require `admin` explicitly, so `editor` and `viewer` cannot reach leads, retention, AI approvals or ops. |
| `/api/public/readiness/*`, `/team/*` | none; they keep creating `audit` / `ai_agents` leads. |
| `GET /api/health/ready` | unchanged; `no_active_release` is not a readiness failure, because the website still builds from its snapshot. |

## 9. Testing plan (for the implementation phase)

* **Unit:** each validator rule, with positive and negative cases, in both locales; release
  document builder (deterministic hash for the same input); locale resolution.
* **API:**
  * public endpoints serve only the active release (a draft edit is invisible until publish);
  * 304 on a matching ETag;
  * 404 vs `not_available_in_locale`;
  * filters, pagination bounds and 422 on unknown values;
  * admin role matrix (viewer, editor, admin) on every route, including the existing lead routes;
  * CSRF on writes;
  * `If-Match` 428 / 412;
  * replace-list ordering;
  * archive and delete rules with 409s;
  * slug change → history and redirect;
  * publish refused with `catalogue_invalid`; activation and rollback; audit entries for each
    write.
* **Migrations:** see DATABASE_SCHEMA_V2 §7.
* **Parity (S3):** the API export of the imported release equals the web export, in the
  `test.ps1` API suite, like the readiness and team vectors.
* **Web (S5):** the existing unit, e2e, SEO and links suites run against the snapshot, plus one
  build with the API unreachable (fallback path).
