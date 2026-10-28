# Service catalogue architecture

**Status:** design, with the first slice implemented. Step S1 (the web export,
`lib/catalogue-seed.ts`) is done. Step S2/S3 is done for V1: migration `0009` (seven tables) and
the idempotent `catalogue-seed`. No endpoint or page uses the catalogue yet, and no release or role
exists. Baseline: branch
`feature/domain-hubs` @ `2a6866a` (the ten domain hubs, built on `main` @ `52bf6e1`; Alembic head
`0008`).

**Companion documents:**

* [DATABASE_SCHEMA_V2.md](DATABASE_SCHEMA_V2.md): tables, columns, constraints and indexes.
* [API_ARCHITECTURE_V2.md](API_ARCHITECTURE_V2.md): endpoints, pagination, filtering, caching and
  errors.

**Inputs:**

* [SERVICE_TAXONOMY.md](SERVICE_TAXONOMY.md): domains, families, statuses and slugs.
* [CONTENT_STRATEGY_BG_EN.md](CONTENT_STRATEGY_BG_EN.md): content model §7, claims policy.
* [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md): routes and hubs.
* [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), [API_REFERENCE.md](API_REFERENCE.md): the current
  schema and API.

## 1. Goal and non-goals

**Goal.** One structured, auditable source for the service catalogue (domains, families,
services and the offerings around them), stored in the existing PostgreSQL database and served by
the existing FastAPI application. Editors change it without a code deployment. The public website
and the lead pipeline keep working unchanged during every step of the transition.

**Non-goals.**

* No separate CMS, no headless-CMS product and no new service or database. The catalogue is a
  module of the modular monolith (`app/catalogue/`), like `app/ops/` and `app/team/`.
* **No prices.** Neither the public catalogue nor its tables hold prices, ranges or outcome figures.
  The internal pricing guidance (AI_MANAGED_SERVICES_PRICING.md) stays a document.
* No migration of articles, legal texts, tool logic, the readiness and team scoring vectors or the
  agent library. They stay in code. The catalogue references tools by their stable `ToolKey`.
* No generic JSON for business rules. JSONB appears only in the immutable release snapshots
  (a read model) and in the existing audit log `details`.

## 2. Current state (inspected)

| Area | Where | What matters for the catalogue |
| --- | --- | --- |
| Service texts | `apps/web/src/content/{bg,en}/services.ts` + `services-depth.ts` + `services-template.ts` | 9 services; each has key, slug, icon, titles, intro, signals, capabilities, deliverables, free-text engagement labels, FAQs, related services, headings, checks, workflow, inputs, related articles, approach, use cases; EN typed against BG |
| Domains | `apps/web/src/lib/domains.ts` + `content/{bg,en}/domains.ts` (branch `feature/domain-hubs`) | 10 domains, 60 families with status, engagement models with `via`, related domains, tools, primary and also-listed services, contact pre-selection, `published` flag |
| AI Managed Services | `content/{bg,en}/ai-managed.ts` | 3 packages (`monitor`, `care`, `optimize`) + custom quote, 8 operating areas, inclusion matrix, planned portal |
| Industries | `content/{bg,en}/pages.ts` → `industries.segments` | segments with icon, title, description, needs and service keys; **no stable keys** |
| Tools | `apps/web/src/lib/tools.ts` | 7 tools, `ToolKey`, availability flags |
| Lead categories | `apps/api/app/models.py` `ServiceKey` (9 services + `other`) | CHECK constraints `ck_leads_service`, `ck_leads_submitted_service`; filter enum in `/api/admin/leads`; used by readiness and team flows |
| Rendering | `app/[locale]/uslugi/[slug]/page.tsx` | `generateStaticParams` + `dynamicParams = false`; the Docker `builder` stage runs `next build` **without API or database access** |
| Admin auth | `admin_users`, `admin_sessions`, `deps.require_admin` | session cookie + CSRF; **every admin has the same rights** (no roles) |
| Audit | `audit_logs` + `app/audit.record()` | append-only, in the caller's transaction; `entity_type` varchar(40), `entity_id` varchar(64) |
| Conventions | `app/db.py`, migrations 0001–0008 | UUID PKs, `varchar` + CHECK instead of PG enums, `timestamptz`, the naming convention, `alembic check` in the tests |

## 3. Conflicts with the existing schema and code

These must be resolved, or explicitly accepted, before the first migration.

| # | Conflict | Consequence | Resolution in this design |
| --- | --- | --- | --- |
| K1 | **Static build without data access.** Public pages are generated at build time from TypeScript; `next build` in Docker cannot reach the API or database. | A database catalogue cannot feed the pages unless the build or rendering changes. | TypeScript stays the source of truth until phase S5. The database is filled from a TypeScript export (S2). Later the web build reads a **published release export** (API at build time, with a committed snapshot fallback) and on-demand revalidation (§9). |
| K2 | **Lead categories are a hard-coded enum.** `ServiceKey` exists in Python, TypeScript (`FormServiceKey`) and two CHECK constraints. Migrations 0004 and 0005 altered the CHECKs to add a service. | A service added in the catalogue would not be accepted as a lead category. Deleting or renaming a key would break historical leads. | Catalogue service keys are **immutable**. A catalogue service declares `lead_category` (one of the `ServiceKey` values). Adding a new lead category stays a reviewed migration (decision D4). `leads` gets **no foreign key** to the catalogue, so archival never touches leads. |
| K3 | **No admin roles.** Every admin can do everything. | Publishing needs at least an editor / publisher split. | Additive `admin_users.role` (`admin`, `editor`, `viewer`; default `admin` for existing rows) in a separate migration. Only `admin` publishes. The staff RBAC is independent of `OpsRole`, which is tenant-scoped. |
| K4 | **One slug namespace.** Domains and services share `/uslugi/<slug>`; AI Managed Services has a dedicated route (`customPage`). | Slug uniqueness must span two entity types per locale; one service is not rendered by the template. | One translation table with `route_namespace` and a partial unique index on `(locale, route_namespace, slug)`. `services.custom_page` is a column. |
| K5 | **Free-text engagement labels.** Service pages list strings ("Проект с фиксиран обхват"); domains use the five engagement models. | They cannot be filtered or validated as they are. | The backfill maps each existing label to a model through a reviewed mapping table in the import script. Unmapped labels fail the import. |
| K6 | **Industries have no keys.** Segments are identified only by title and icon. | Applicability links and translations need stable identifiers. | The backfill assigns keys (`online_smb`, `shopify_merchants`, …). The web content gets the same keys first, in step S1. |
| K7 | **The Python package `app/services/`** holds business logic (`leads.py`, …). | A `services` table and a `Service` ORM class would be ambiguous in code reviews. | The table keeps the name `services` as requested. The ORM classes are `CatalogueService`, `CatalogueDomain` and so on, in `app/catalogue/`. |
| K8 | **Domains exist only on an unmerged branch.** | The backfill depends on `feature/domain-hubs`. | That branch merges first, or this work is based on it (as this document is). |
| K9 | **Web content tests run on TypeScript** (`content.test.ts`, `seo-map.test.ts`, `domains.test.ts`, the claims guard). | Once the database is the source, the same rules must run on the database. | The rules move to a shared **release validator** in the API (§7). The web tests keep running on the exported snapshot. |
| K10 | **AMS package names have commercial meaning**, and the internal pricing doc has figures. | Prices could leak into a public table. | The schema has no price columns. Managed offerings store only their tier and their inclusions. |
| K11 | **Family keys repeat across domains.** `evaluation` exists in C and H, and `integrations` is both a D family and a lead category. | A key that is unique per entity type would reject them. | Family and offering keys are qualified: `ai_applications.evaluation`, `ai_managed.monitor`. The validator checks that the prefix equals the parent's key. Domain, service, industry and technology keys stay unqualified. |

None of these (K1–K11) requires changing an existing column or constraint. The only change to an existing
table is the additive `admin_users.role` (K3).

## 4. Model overview

The catalogue uses a **supertype / subtype** design. Every catalogue object (domain, family,
service, industry, technology) is a row in `catalogue_entities`, which carries the shared concerns:
stable key, lifecycle, revision counter and who changed it. Typed subtype tables hold what is
specific. Translations, content items, relations and engagement models attach to the supertype.
They are therefore modelled once, not once per entity type.

```
catalogue_entities (supertype: key, type, status, revision)
 ├── service_domains        1:1  (code A–J, band, icon, position)
 ├── service_families       1:1  (domain, delivery status, position)
 ├── services               1:1  (offering type, primary domain, lead category, parent, custom page …)
 ├── technologies           1:1  (category)
 │   (industries need no subtype columns: they are entity + translations)
 │
 ├── entity_translations     1:N per locale (slug, name, summary, body, CTA, SEO)
 ├── content_items           1:N ordered (capability, deliverable, problem, FAQ, …)
 │    └── content_item_translations  1:N per locale
 ├── entity_engagements      1:N (engagement model, optionally "via" a domain)
 ├── entity_relations        N:M typed (related, cross-sell, applies-to-industry, uses-technology, …)
 └── entity_tools            1:N ordered tool keys (tools themselves stay in code)

family_services             N:M (family ↔ service that implements it)
slug_history                1:N (old slugs → redirects)
catalogue_releases          immutable published snapshots; one is active
admin_users.role            additive column (editor / admin / viewer)
```

**14 tables plus one column.** Each requested concept is covered as follows:

| Requested concept | Modelled as |
| --- | --- |
| service_domains | `catalogue_entities` + `service_domains` |
| service_families | `catalogue_entities` + `service_families` |
| services | `catalogue_entities` + `services` (`offering_type = service`) |
| service_capabilities, service_deliverables | `content_items` (`item_type` = `capability`, `deliverable`) |
| service_engagements | `entity_engagements` (5 models, optional `via_domain_id`) |
| industries and service applicability | `catalogue_entities` (`entity_type = industry`) + `entity_relations` (`applies_to`) |
| technologies and related integrations | `catalogue_entities` + `technologies` + `entity_relations` (`uses_technology`, `integrates_with`) |
| assessment definitions | `services` with `offering_type = assessment` (fixed scope, duration band, output items, optional `tool_key` for the self-service part) |
| workshops | `services` with `offering_type = workshop` |
| managed offerings | `services` with `offering_type = managed_offering`, `parent_service_id` → the managed service, `tier_rank` + `inclusion` items |
| FAQs | `content_items` (`item_type = faq`: title = question, body = answer) |
| localized content and SEO | `entity_translations`, `content_item_translations` |
| related services | `entity_relations` (`related`, `cross_sell`) |
| publishing status and version history | `catalogue_entities.status` / `revision`, `catalogue_releases`, `audit_logs` |

### Why not 20 tables

* **One list table for many item types.** Capabilities, deliverables, problems, prerequisites,
  limitations, checks, workflow steps, approach steps, use cases, inputs, ideal customers and FAQs
  all have the same shape: owner, kind, position, title, body, per locale. Twelve identical tables
  would be twelve sets of migrations, endpoints and tests.
* **Offerings share the service table.** Assessments, workshops and managed offerings are sold and
  presented like services. They differ in a few typed columns, each guarded by a CHECK on
  `offering_type`. Separate tables would duplicate the slug, SEO, item and relation machinery.
* **One relation table with typed endpoints.** Related services, cross-sell between domains,
  industry applicability and technology links are all directed, ordered edges. A composite foreign
  key on `(id, entity_type)` plus a CHECK on the allowed `(kind, from_type, to_type)` combinations
  keeps them as strict as dedicated join tables.
* **Releases instead of per-entity version tables.** History is the audit log (who changed what and
  when, per entity) plus immutable whole-catalogue releases (what was public at any moment).

### What stays out of JSON

Statuses, ordering, slugs, lead categories, engagement models, relations, tier ranks, durations and
delivery statuses are typed columns with CHECK constraints. JSONB is used only for:

1. `catalogue_releases.document`: the denormalised, immutable read model that the public API
   serves. It is never edited and never queried for business decisions.
2. `audit_logs.details` (existing): changed field names and revision numbers, never full texts.

## 5. Identity, keys and slugs

| Identifier | Rule |
| --- | --- |
| `id` | UUID v4, internal. Never shown in URLs. |
| `key` | Stable `snake_case`, qualified with the parent key for families and offerings (`ai_applications.evaluation`, K11), unique per `entity_type`, **immutable** after the first publication (enforced by the API: `PATCH` does not accept `key`; no database trigger). Existing keys are reused: `ServiceKey` values, domain keys, family keys, `ToolKey`. |
| `code` | Domains only: `A`–`J`, unique. |
| `slug` | Per locale, in `entity_translations`. Lowercase ASCII words joined by hyphens, ≤ 80 characters, Bulgarian slugs transliterated as in SERVICE_TAXONOMY §1. Unique per `(locale, route_namespace)`. |
| `route_namespace` | `services` (domains and services share `/uslugi` ↔ `/services`), `industries`. Families, technologies and offerings without a page have no slug. |

**Slug changes.** A published slug may change only through the API. The old slug goes to
`slug_history`, and the release exports a redirect map (`old → new`, per locale). The web proxy
answers with 308. A slug that has been used once is never reused for another entity: the API
checks `slug_history` before accepting it.

## 6. Lifecycle, publishing and history

**Entity status** (`catalogue_entities.status`):

| Status | Meaning | Allowed transitions |
| --- | --- | --- |
| `draft` | Being prepared. Never in a release. | → `published`, → deleted (only if never published) |
| `published` | Included in the next release if it passes validation. Edits continue on the same row and reach the public site only with the next release. | → `archived` |
| `archived` | Withdrawn. Excluded from releases. Key and slugs stay reserved; the release exports a redirect to the nearest live page, or the page answers 410. | → `published` (restore) |

`delivery_status` (`available` / `custom` / `planned`, on families and services) is a separate,
business-facing property. It describes what is offered today, not whether the page is public.

**Releases (publishing).** Publishing is a catalogue-wide, atomic operation:

1. An `admin` calls `POST /api/admin/catalogue/releases`.
2. The API loads every `published` entity with its translations, items, engagements and relations,
   then runs the **release validator** (§7). On any error nothing is written, and the response
   lists the errors.
3. On success it writes one `catalogue_releases` row: an incremental `number`, the denormalised
   `document`, its SHA-256 `content_hash`, the author, a note, and `is_active = true`. In the same
   transaction it deactivates the previous release and records `catalogue.release_published` in
   the audit log.
4. **Rollback** re-activates an earlier release (`POST …/releases/{number}/activate`). It changes
   no working rows and is audited (`catalogue.release_activated`).

Releases are immutable and never deleted by the application.

Catalogue-wide releases keep cross-entity rules atomic. A service cannot become public while
pointing at an archived domain, and two slugs cannot collide between the BG and EN halves of the
same release.

**Revision counter and optimistic concurrency.** Every write to an entity, or to anything it owns
(translations, items, engagements, outgoing relations), increments `catalogue_entities.revision`.
Admin `PATCH` / `PUT` require `If-Match: "<revision>"`; a stale revision answers 412
`revision_conflict`. This prevents lost updates when two editors work on the same page.

**Version history.**

* Per entity: `audit_logs` entries with `entity_type = "catalogue.<type>"`, `entity_id = <uuid>`,
  and `details = {"revision": n, "fields": [...], "locale": "en"}`. Field names only, no texts.
* Per publication: `catalogue_releases.document` holds the full text of everything public at that
  moment. A diff between two releases is computed on demand by the admin API.

## 7. Validation: one validator, three callers

The rules of SERVICE_TAXONOMY §7 and CONTENT_STRATEGY §3–§4 become one Python module,
`app/catalogue/validation.py`. It runs:

* on every admin write, for the rules local to that write (field lengths, slug format, allowed
  relation types);
* on `POST /releases` and `POST /validate`, for the whole catalogue;
* in CI, on the TypeScript export (phases S1–S4), so the web tests and the database agree.

Rules:

1. Domains: exactly the codes A–J, unique keys, unique slugs per `(locale, namespace)`, no slug
   equal to a service slug. A domain marked available needs at least one available family.
2. Every published `offering_type = service` row has exactly one primary domain, and its
   `lead_category` is a valid `ServiceKey`.
3. A `planned` family or service has a prerequisite text in every published locale.
4. SEO: title ≤ 60 characters, description 120–160, primary keyword contained in the title and
   unique across the catalogue per locale. Secondary keywords must not equal another entity's
   primary keyword.
5. Claims: no currency symbols, percentages, "guarantee" wording outside limitations, or client
   names. This uses the same patterns as `content.test.ts`; the list lives in one place.
6. References: relations, `via` domains, parents and family links point only to published
   entities. `tool_key` values exist in the tool registry snapshot.
7. Locale completeness (§8).

## 8. Locale policy and fallback

* **Locales:** `bg` (default, canonical) and `en`, the same CHECK as `leads.locale`.
* **No text fallback across languages on public pages.** An English page never shows Bulgarian
  text (enforced today by `i18n.test.ts`).
* **Availability per locale.** An entity is available in a locale when its translation in that
  locale is complete. Complete means: required fields present, every content item translated, and
  a slug for routable types. The release document lists `available_locales` per entity. The web
  emits hreflang only for those (as articles already do), with `x-default` → `bg`.
* **Publishing rule.** A published entity must be complete in `bg`. Missing `en` excludes it from
  the English site (no page, no links, not in the EN sitemap) and the validator reports a warning,
  not an error. Domains and `offering_type = service` rows must be complete in both locales
  (error), because navigation and lead flows assume both.
* **Fallback for non-text fields** (icon, code, band, tier, ordering): language-independent by
  construction, so there is nothing to fall back.
* **API language selection:** the `locale` query parameter; otherwise `Accept-Language` (`en-*` →
  `en`), otherwise `bg`. This is the same rule as for API error messages. An unavailable locale
  answers 404 `not_available_in_locale` and includes the locales in which it is available.

## 9. Caching and invalidation

The catalogue changes rarely (a few times a month) and is small (well under 1 MB per release).
The design therefore caches whole releases.

| Layer | Mechanism | Invalidation |
| --- | --- | --- |
| API process | The active release document is held in memory, keyed by `(release number, content_hash)`. Each request checks the active release number with a primary-key lookup, cached for at most 5 s. | A new active release changes the number; the next check reloads it. The API runs as one instance today (the rate limiter is in memory too). With several instances the 5 s bound still holds. |
| HTTP | Public responses: `ETag: "<content_hash>-<locale>"`, `Cache-Control: public, max-age=60, stale-while-revalidate=300`; `If-None-Match` → 304. Admin responses stay `no-store` (existing `_no_store`). | ETag changes with each release. |
| Web build (S5) | `next build` fetches `GET /api/public/catalogue/export` once. If the API is unreachable, the build uses the committed snapshot `apps/web/src/content/catalogue.snapshot.json` and prints a warning; a release build can be configured to fail instead. | Rebuild, or on-demand revalidation (next row). |
| Web runtime (S5) | Pages are statically generated with a cache tag `catalogue`. A new route `POST /api/web-revalidate` (a static segment that takes precedence over the existing `/api/[...path]` proxy; shared secret; denied by the reverse proxy from outside) calls `revalidateTag("catalogue")`. | The API calls the hook after a successful publish or rollback. `catalogue_releases.revalidated_at` stays empty until the hook succeeds, and `catalogue-revalidate` (CLI, or the next publish) retries it. A failed hook never rolls back the release. |
| Browser | Ordinary page caching; the client never fetches the catalogue directly. | — |

Admin views always read the working tables, never the cache.

## 10. Safe deletion and archival

| Situation | Allowed operation |
| --- | --- |
| Draft, never published, nothing references it | Hard delete (`DELETE`): its translations, items, engagements and outgoing relations cascade. Audited (`catalogue.entity_deleted`). |
| Published or ever published | Archive only. The row, key and slugs stay. Incoming references must be removed first, or the archive request lists them (409 `entity_referenced`). |
| Domain with families or primary services | Archive is refused until they are moved or archived (409). |
| Service used as a lead category | Archive is allowed. Leads keep their `service` value and the admin filter keeps working, because lead categories come from `ServiceKey`, not from the catalogue (K2). |
| Release | Never deleted by the application. Retention can be decided later; releases hold no personal data. |

Foreign keys between catalogue rows use `ON DELETE RESTRICT`. Owned children use
`ON DELETE CASCADE`. Hard deletes therefore succeed only where the application already allows
them, and a mistake in application code cannot cascade through published content.

## 11. Compatibility with the hard-coded content

| Existing source | Mapping |
| --- | --- |
| `services.ts` fields | `title` → `name`; `shortTitle` → `short_name`; `summary`; `intro` → `body`; `metaTitle`/`metaDescription` → SEO; `signals` → `problem`; `capabilities` → `capability`; `deliverables` → `deliverable`; `faqs` → `faq`; `checks` → `check`; `workflow` → `workflow_step`; `inputs` → `input`; `approach` → `approach_step`; `useCases` → `use_case`; `headings` → `entity_translations.section_headings` (typed columns, see the schema doc); `related` → `related` relations; `engagement` strings → `entity_engagements` via the mapping (K5); `customPage` → `custom_page`; `isOffering` → `is_entry_offer`; `relatedArticles` → stays in code (articles are not in the catalogue) and is exported as article keys |
| `domains.ts` + `lib/domains.ts` | entity + `service_domains` + translations; families → `service_families` + `family_services`; `idealCustomers`, `problems`, `deliverables`, `prerequisites`, `limitations` → items; `engagement` → `entity_engagements`; `related` → `cross_sell` relations; `tools` → `entity_tools`; `contactService` → `service_domains.contact_service_id`; `published` → status |
| `ai-managed.ts` packages | `managed_offering` rows (`monitor`, `care`, `optimize`) under `ai_managed`, `tier_rank` 1–3, inclusion matrix → `inclusion` items with `area_key` + `inclusion_level`. Operating areas are items of `ai_managed` (`item_type = capability`, `area_key`). |
| Industries segments | industry entities with assigned keys (K6) + `applies_to` relations to services |
| `ToolKey` | `entity_tools.tool_key` (and `services.tool_key` for the self-service part of an assessment), validated against the exported tool registry. Tools stay in code. |
| Lead `ServiceKey` | `services.lead_category`. No change to `leads`. |

Until phase S5 the TypeScript files remain the source of truth, and the database is a verified
copy. From S5 on, the database is the source, and the TypeScript files are replaced by the
generated snapshot. **Both never stay editable at the same time.**

## 12. Incremental migration and backfill plan

Every step can ship and be reverted on its own. No step changes an existing column or constraint;
the only change to an existing table is the additive `admin_users.role` in S3.

| Step | Change | Data | Verification | Rollback |
| --- | --- | --- | --- | --- |
| **S0** Decisions | Accept K1–K10; decide D4 (lead categories) and who holds the `admin` role. | — | Review of this document. | — |
| **S1** Export (web only) | `npm run catalogue:export` writes `catalogue-export.json` (schema-versioned) from the TypeScript content. Adds industry keys (K6) and the engagement-label mapping (K5) in code. | none in the database | Web test: the export round-trips the TypeScript content and passes the shared rules. | Remove the script. |
| **S2** Schema `0009` | Create the 14 tables (empty). `alembic check`, upgrade/downgrade round trip. | none | `test_migrations_and_retention.py` extended. | `alembic downgrade 0008` drops only the new tables. |
| **S3** Import + roles `0010` | `0010`: `admin_users.role` (NOT NULL, default `admin`, CHECK). CLI `python -m app.cli catalogue-import --file catalogue-export.json [--dry-run]`: idempotent upsert by `(entity_type, key)`, runs the validator, creates release #1 with note `imported from web <git sha>`, audit `catalogue.imported`. **Not an Alembic data migration**: content is environment data, and migrations stay schema-only, as they are now. | Backfill of all domains, families, services, packages, industries and technologies in one transaction. | Parity test in `test.ps1` (pattern of "Readiness vectors API = web copy"): `GET /export` of release #1 equals the web export, field by field. | Delete the imported rows (`catalogue-purge --imported-only`) or downgrade. |
| **S4** Read API + admin read-only | Public `GET` endpoints (from the active release) and admin read endpoints. No editing yet. | — | API tests; OpenAPI and API_REFERENCE in sync (docs_sync). | Remove the router; tables stay. |
| **S5** Switch the source | Web build reads the export (snapshot fallback); `dynamicParams` stays false; revalidation hook. The TypeScript service and domain files are replaced by the generated snapshot. Admin editing enabled behind `CATALOGUE_EDITING=true`. | Release #2 = first edited content. | All web unit and e2e suites run on the snapshot; links and SEO crawl unchanged; Lighthouse sample. | Pin the build to the committed snapshot and switch editing off; release rollback for content. |
| **S6** Optional (D4) | Lead categories from the catalogue: either a new migration adds values to the CHECKs when a service is created, or `leads.service` gets an FK to `services.key` (only immutable keys). | — | Lead tests, existing leads unchanged. | Revert to the CHECK. |

**Ordering constraints.** S1 before S2–S3 (the import consumes the export). K8 (the
`feature/domain-hubs` merge) before S1. S5 needs a decision on where the production build runs and
how it reaches the API.

## 13. Security and privacy

* The catalogue contains no personal data. Audit entries hold field names and revisions only.
* Public endpoints are read-only, unauthenticated and rate limited like the other public routes.
  They serve only the active release, so drafts never leak, even with a guessed id.
* Admin writes use the existing session + CSRF dependency, plus the new role check (`editor` writes
  drafts; `admin` also publishes, activates and deletes).
* Text fields are plain text. No HTML or Markdown is rendered from the catalogue; the web renders
  strings as React text. Line breaks are the only structure.
* The validator's claims rules (§7.5) are the last line against invented prices, guarantees and
  client names.

## 14. Open decisions

| # | Decision | Default in this design |
| --- | --- | --- |
| CA-1 | Merge `feature/domain-hubs` first (K8)? | Yes |
| CA-2 | Lead categories from the catalogue (D4, step S6)? | No; keep `ServiceKey` |
| CA-3 | Roles: is `editor` needed now, or only `admin`? | Add the column with `admin` + `editor` + `viewer` |
| CA-4 | Web build with API access (S5): where does the production build run? | Fallback snapshot keeps builds offline-capable |
| CA-5 | Do technologies appear publicly (a page per technology) or only as filters? | Filters and labels only, no pages |
