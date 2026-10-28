# Database schema v2: service catalogue

**Status:** the V1 slice is implemented in migration `0009`: `catalogue_entities`,
`service_domains`, `service_families`, `services` (services only), `family_services`,
`entity_translations` and `entity_relations` (three relation kinds). See
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md#service-catalogue-migration-0009). The rest of this
document is still a design, including the additive column in §3.15. The rationale, conflicts and roll-out are in
[SERVICE_CATALOGUE_ARCHITECTURE.md](SERVICE_CATALOGUE_ARCHITECTURE.md). The API is in
[API_ARCHITECTURE_V2.md](API_ARCHITECTURE_V2.md).

## 1. Conventions (unchanged from v1)

* PostgreSQL 17, managed only by Alembic. `alembic check` keeps models and migrations identical.
* UUID v4 primary keys (`Uuid`), except the append-only `slug_history` and the release `number`.
* Enumerations are `varchar` + CHECK, built with `_in_check()`. **No PostgreSQL enum types**, so a
  new value is a CHECK change in a reviewed migration, as with `leads.service` today.
* All timestamps are `timestamptz` in UTC.
* Naming: `pk_<table>`, `fk_<table>_<column>_<ref>`, `uq_<table>_<column>`, `ck_<table>_<name>`,
  `ix_<table>_<column>`.
* `position` columns are `smallint ≥ 0`. A position is unique within its parent through a
  `DEFERRABLE INITIALLY DEFERRED` unique constraint, so a whole list can be reordered in one
  transaction.
* `locale` is `varchar(2)` with CHECK `('bg','en')`, the same values as `leads.locale`.
* Text lengths are bounded by `varchar(n)` or by `CHECK (char_length(col) <= n)` on `text`.

## 2. Entity-relationship overview

```
admin_users ──< catalogue_entities.created_by_id / updated_by_id        (SET NULL)

catalogue_entities (id, entity_type, key, status, revision)
   │ 1:1 by (id, entity_type)
   ├── service_domains  (code, band, icon, position, contact_service_id → services)
   │       ▲ 1:N
   ├── service_families (domain_id → service_domains, delivery_status, position)
   │       ▲ N:M family_services ▼
   ├── services         (offering_type, primary_domain_id → service_domains,
   │                     parent_service_id → services, lead_category, tier_rank, …)
   └── technologies     (category)
        (industries: entity_type = 'industry', no subtype table)

catalogue_entities ──< entity_translations (entity_id, locale)            1:N, ≤ 2
catalogue_entities ──< content_items ──< content_item_translations         1:N, 1:N ≤ 2
catalogue_entities ──< entity_engagements (domain | service owners)        1:N
catalogue_entities ──< entity_tools (domain | service owners)              1:N
catalogue_entities ──< entity_relations >── catalogue_entities             N:M typed
catalogue_entities ──< slug_history                                        1:N
catalogue_releases (immutable snapshots; at most one active)
```

**Cardinalities.**

| Relationship | Cardinality | Enforced by |
| --- | --- | --- |
| entity ↔ subtype row | 1 : 0..1 (exactly 1 for domain, family, service, technology) | composite FK `(id, entity_type)` + constant CHECK in the subtype; completeness by the validator |
| domain → families | 1 : N | `service_families.domain_id` NOT NULL |
| domain → primary services | 1 : N | `services.primary_domain_id` |
| service → primary domain | N : 1, required for `offering_type = 'service'` | CHECK |
| family ↔ service | N : M | `family_services` |
| managed service → managed offerings | 1 : N | `services.parent_service_id` + CHECK |
| entity → translations | 1 : 0..2 (one per locale) | PK `(entity_id, locale)` |
| entity → content items → translations | 1 : N : 0..2 | PKs |
| domain/service → engagement models | 1 : 0..N, ≤ 1 row per (model, via) | unique `NULLS NOT DISTINCT` |
| entity → entity (relations) | N : M per `kind` | PK `(from_entity_id, kind, to_entity_id)` + allowed-type CHECK |

## 3. Tables

### 3.1 `catalogue_entities` (supertype)

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | uuid | no | PK |
| entity_type | varchar(16) | no | CHECK `('domain','family','service','industry','technology')` |
| key | varchar(80) | no | CHECK `key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$'`; immutable after first publication (API rule) |
| status | varchar(12) | no | default `'draft'`; CHECK `('draft','published','archived')` |
| revision | integer | no | default 1; CHECK `revision >= 1`; +1 on every write to the entity or its children |
| first_published_at | timestamptz | yes | set once, at the first release that included the entity; blocks hard delete |
| archived_at | timestamptz | yes | CHECK `(status = 'archived') = (archived_at IS NOT NULL)` |
| created_at, updated_at | timestamptz | no | |
| created_by_id, updated_by_id | uuid | yes | FK → `admin_users` `ON DELETE SET NULL` |

Constraints and indexes:

* `uq_catalogue_entities_type_key` UNIQUE `(entity_type, key)`.
* `uq_catalogue_entities_id_type` UNIQUE `(id, entity_type)`: the target of the typed composite
  FKs below.
* `ix_catalogue_entities_type_status` `(entity_type, status)`: admin lists and release assembly.

### 3.2 `service_domains`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | uuid | no | PK |
| entity_type | varchar(16) | no | default `'domain'`; CHECK `entity_type = 'domain'`; FK `(id, entity_type)` → `catalogue_entities (id, entity_type)` `ON DELETE CASCADE` |
| code | char(1) | no | UNIQUE; CHECK `code ~ '^[A-Z]$'` (A–J today) |
| band | varchar(16) | no | CHECK `('ai','engineering','operations')` |
| icon | varchar(32) | no | icon name from the web icon set; validated against the export |
| position | smallint | no | order within the band; UNIQUE `(band, position)` deferrable |
| contact_service_id | uuid | yes | FK → `services.id` `ON DELETE RESTRICT`; the contact form pre-selection. Nullable to break the insert cycle with `services.primary_domain_id`; required for published domains (validator). |

### 3.3 `service_families`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | uuid | no | PK |
| entity_type | varchar(16) | no | `'family'` + composite FK as in 3.2 |
| domain_id | uuid | no | FK → `service_domains.id` `ON DELETE RESTRICT`; indexed |
| delivery_status | varchar(12) | no | CHECK `('available','custom','planned')` |
| position | smallint | no | UNIQUE `(domain_id, position)` deferrable |

A family's key is qualified with its domain's key (`ai_governance.evaluation`). The validator checks
the prefix.

### 3.4 `services` (services, assessments, workshops, managed offerings)

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | uuid | no | PK |
| entity_type | varchar(16) | no | `'service'` + composite FK |
| offering_type | varchar(20) | no | CHECK `('service','assessment','workshop','managed_offering')` |
| primary_domain_id | uuid | yes | FK → `service_domains.id` `RESTRICT`; indexed. CHECK `offering_type <> 'service' OR primary_domain_id IS NOT NULL` |
| parent_service_id | uuid | yes | FK → `services.id` `RESTRICT`; indexed. CHECK `offering_type <> 'managed_offering' OR parent_service_id IS NOT NULL`; CHECK `parent_service_id IS DISTINCT FROM id` |
| delivery_status | varchar(12) | no | CHECK `('available','custom','planned')` |
| lead_category | varchar(32) | yes | CHECK the `ServiceKey` values (same list as `ck_leads_service`). CHECK `offering_type <> 'service' OR lead_category IS NOT NULL`. Not a FK to leads, in either direction. |
| icon | varchar(32) | yes | |
| custom_page | boolean | no | default false; rendered by a dedicated route (`ai-managed-services`) |
| is_entry_offer | boolean | no | default false; the recommended first step (today's `isOffering`, the audit) |
| tool_key | varchar(32) | yes | self-service tool behind an assessment; CHECK `tool_key ~ '^[a-z][a-z0-9_]*$'`; CHECK `tool_key IS NULL OR offering_type = 'assessment'` |
| duration_min_days, duration_max_days | numeric(4,1) | yes | assessments and workshops only. CHECK both NULL, or `0 < min <= max`; CHECK NULL unless `offering_type IN ('assessment','workshop')` |
| tier_rank | smallint | yes | managed offerings only. CHECK `(offering_type = 'managed_offering') = (tier_rank IS NOT NULL)`; UNIQUE `(parent_service_id, tier_rank)` |
| position | smallint | no | order within the primary domain or the parent |

There are deliberately **no price, currency, SLA or capacity columns** (claims policy; internal
pricing stays in AI_MANAGED_SERVICES_PRICING.md).

### 3.5 `technologies`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | uuid | no | PK |
| entity_type | varchar(16) | no | `'technology'` + composite FK |
| category | varchar(24) | no | CHECK `('commerce_platform','cloud','data_store','ai_provider','observability','devops','business_system','integration_protocol')` |
| position | smallint | no | UNIQUE `(category, position)` deferrable |

Industries have no subtype columns. They are `catalogue_entities` rows (`entity_type = 'industry'`)
with translations, items and `applies_to` relations.

### 3.6 `family_services`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| family_id | uuid | no | FK → `service_families.id` `ON DELETE CASCADE` |
| service_id | uuid | no | FK → `services.id` `ON DELETE RESTRICT`; indexed (reverse lookup "families of a service") |
| position | smallint | no | UNIQUE `(family_id, position)` deferrable |

PK `(family_id, service_id)`. "Also listed in" (SERVICE_TAXONOMY §3) is derived: the domains of the
families that link a service, minus its primary domain.

### 3.7 `entity_translations`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| entity_id | uuid | no | FK → `catalogue_entities.id` `ON DELETE CASCADE` |
| locale | varchar(2) | no | CHECK `('bg','en')` |
| route_namespace | varchar(16) | yes | CHECK `('services','industries')`; CHECK `(route_namespace IS NULL) = (slug IS NULL)` |
| slug | varchar(80) | yes | CHECK `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` |
| name | varchar(160) | no | page H1 / card title |
| short_name | varchar(80) | yes | navigation label (`shortTitle`) |
| summary | varchar(300) | yes | one line for cards |
| body | text | yes | intro / positioning; CHECK `char_length(body) <= 2000` |
| cta_label | varchar(80) | yes | |
| prerequisite | varchar(400) | yes | required for `planned` families and services (validator) |
| heading_problems, heading_capabilities, heading_checks, heading_workflow, heading_deliverables | varchar(160) | yes | service-specific H2s (`services-depth.ts` `headings`) |
| seo_title | varchar(70) | yes | ≤ 60 for publication (validator); the column allows the current 70-character test limit |
| seo_description | varchar(175) | yes | 120–160 for publication (validator) |
| primary_keyword | varchar(100) | yes | |
| secondary_keywords | varchar(100)[] | no | default `'{}'`; CHECK `cardinality(secondary_keywords) <= 8` |
| search_intent | varchar(16) | yes | CHECK `('transactional','commercial','informational','navigational')` |
| keyword_evidence | varchar(200) | yes | source and date once verified; NULL = unverified (keyword map rule) |
| updated_at | timestamptz | no | |

Constraints and indexes:

* PK `(entity_id, locale)`.
* `uq_entity_translations_route` UNIQUE `(locale, route_namespace, slug)` `WHERE slug IS NOT NULL`:
  domain and service slugs share the `services` namespace (K4).
* `uq_entity_translations_primary_keyword` UNIQUE `(locale, lower(primary_keyword))`
  `WHERE primary_keyword IS NOT NULL`: no keyword cannibalisation inside the catalogue. Pages
  outside the catalogue (home, articles) are checked by the validator against the web keyword map.

`secondary_keywords` is a typed array of short strings, not JSON. It is presentation metadata, not
a business rule.

### 3.8 `content_items`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | uuid | no | PK |
| entity_id | uuid | no | FK → `catalogue_entities.id` `ON DELETE CASCADE` |
| item_type | varchar(20) | no | CHECK `('ideal_customer','problem','capability','deliverable','prerequisite','limitation','check','workflow_step','approach_step','use_case','input','output','faq','inclusion')` |
| position | smallint | no | UNIQUE `(entity_id, item_type, position)` deferrable; also the main index |
| area_key | varchar(40) | yes | AMS operating area (`reliability`, `cost`, …); CHECK format `^[a-z][a-z0-9_]*$` |
| inclusion_level | varchar(12) | yes | CHECK `('included','limited','not_included','on_request')`; CHECK `(item_type = 'inclusion') = (inclusion_level IS NOT NULL)`; CHECK `item_type <> 'inclusion' OR area_key IS NOT NULL` |

`output` items are the artefacts of an assessment or workshop.

### 3.9 `content_item_translations`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| item_id | uuid | no | FK → `content_items.id` `ON DELETE CASCADE` |
| locale | varchar(2) | no | CHECK `('bg','en')` |
| title | varchar(200) | yes | FAQ question, capability title |
| body | text | yes | CHECK `char_length(body) <= 2000`; FAQ answer, description, list text |

PK `(item_id, locale)`. CHECK `title IS NOT NULL OR body IS NOT NULL`. Inclusion items need no
translation (the level and area are language-independent); the validator knows which item types
require text.

### 3.10 `entity_engagements`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | uuid | no | PK |
| entity_id | uuid | no | composite FK `(entity_id, owner_type)` → `catalogue_entities (id, entity_type)` `ON DELETE CASCADE` |
| owner_type | varchar(16) | no | CHECK `('domain','service')` |
| model | varchar(16) | no | CHECK `('assessment','workshop','architecture','implementation','managed')` |
| via_domain_id | uuid | yes | FK → `service_domains.id` `RESTRICT`; delivered through another domain; CHECK `via_domain_id IS DISTINCT FROM entity_id` |
| position | smallint | no | |

UNIQUE `(entity_id, model, via_domain_id) NULLS NOT DISTINCT` (PostgreSQL ≥ 15): a model appears
once directly, or once per `via` domain. Index `(entity_id, position)`.

### 3.11 `entity_relations`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| from_entity_id | uuid | no | composite FK `(from_entity_id, from_type)` → `catalogue_entities (id, entity_type)` `ON DELETE CASCADE` |
| from_type | varchar(16) | no | |
| kind | varchar(20) | no | CHECK `('related','cross_sell','delivered_through','applies_to','uses_technology','integrates_with')` |
| to_entity_id | uuid | no | composite FK `(to_entity_id, to_type)` → `catalogue_entities (id, entity_type)` `ON DELETE RESTRICT` |
| to_type | varchar(16) | no | |
| position | smallint | no | UNIQUE `(from_entity_id, kind, position)` deferrable |

PK `(from_entity_id, kind, to_entity_id)`. CHECK `from_entity_id <> to_entity_id`. Index
`ix_entity_relations_to` `(to_entity_id, kind)` for reverse lookups ("services for this industry").

**Allowed combinations** (one CHECK, `ck_entity_relations_kind_types`):

| kind | from_type → to_type | Meaning |
| --- | --- | --- |
| `related` | service → service | related services on a service page |
| `cross_sell` | domain → domain | related domains on a hub (SERVICE_TAXONOMY §6) |
| `delivered_through` | family → domain | "through domain X" on a family card |
| `applies_to` | industry → service, industry → domain | industry applicability |
| `uses_technology` | service → technology, domain → technology | technologies a service is built with |
| `integrates_with` | service → technology | systems a service connects to (Shopify, ERP, CRM) |

The composite FKs make the stored `from_type` / `to_type` provably equal to the referenced
entities' types, so the CHECK on combinations is sound without triggers.

### 3.12 `entity_tools`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| entity_id | uuid | no | composite FK `(entity_id, owner_type)` → `catalogue_entities` `ON DELETE CASCADE` |
| owner_type | varchar(16) | no | CHECK `('domain','service')` |
| tool_key | varchar(32) | no | CHECK `tool_key ~ '^[a-z][a-z0-9_]*$'`; existence validated against the exported tool registry (tools stay in code) |
| position | smallint | no | UNIQUE `(entity_id, position)` deferrable |

PK `(entity_id, tool_key)`.

### 3.13 `slug_history`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | bigint identity | no | PK |
| entity_id | uuid | no | FK → `catalogue_entities.id` `ON DELETE CASCADE` (only never-published drafts can be deleted, and they have no history) |
| locale | varchar(2) | no | CHECK `('bg','en')` |
| route_namespace | varchar(16) | no | CHECK `('services','industries')` |
| old_slug | varchar(80) | no | same format CHECK as 3.7 |
| replaced_at | timestamptz | no | |
| replaced_by_id | uuid | yes | FK → `admin_users` `SET NULL` |

UNIQUE `(locale, route_namespace, old_slug)`: a retired slug belongs to one entity forever. The
API also refuses a new slug that appears here for another entity. The release document exports
`redirects` built from this table.

### 3.14 `catalogue_releases`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| number | integer identity | no | PK; release #1 is the import |
| schema_version | varchar(8) | no | version of the document shape (e.g. `1`) |
| document | jsonb | no | the denormalised read model: entities by locale, slug maps, redirects, availability. **Immutable.** |
| content_hash | char(64) | no | SHA-256 of the canonical JSON; used as ETag |
| entity_count | integer | no | CHECK `>= 0` |
| source | varchar(12) | no | CHECK `('import','editor')`. A rollback creates no row; it re-activates an existing one. |
| note | varchar(300) | yes | |
| is_active | boolean | no | default false |
| published_at | timestamptz | no | |
| published_by_id | uuid | yes | FK → `admin_users` `SET NULL` |
| activated_at | timestamptz | yes | last activation |
| revalidated_at | timestamptz | yes | web revalidation hook succeeded for this activation |

`uq_catalogue_releases_active` UNIQUE `(is_active)` `WHERE is_active`: at most one active release.
Never updated except `is_active`, `activated_at` and `revalidated_at`, never deleted by the
application. Expected size: well under 1 MB per release.

### 3.15 Change to an existing table: `admin_users.role`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| role | varchar(12) | no | server default `'admin'` (every existing admin keeps full rights); CHECK `('admin','editor','viewer')` |

Additive, in a migration of its own (`0010`), downgrade drops the column. Permissions:

| Action | viewer | editor | admin |
| --- | --- | --- | --- |
| Read catalogue, history, releases | ✓ | ✓ | ✓ |
| Create and edit drafts and published entities (working copy) | | ✓ | ✓ |
| Archive, restore, change a published slug | | ✓ | ✓ |
| Validate | | ✓ | ✓ |
| Publish a release, activate an older release, hard-delete a draft | | | ✓ |
| Leads, retention, AI approvals, ops (existing endpoints) | unchanged: `editor` and `viewer` get **no** access until those endpoints check roles | | ✓ |

The last row needs one change in `deps.require_admin`: it must reject `editor` and `viewer` on
existing endpoints by default. This keeps K3 additive and safe.

## 4. Ordering

Every list is ordered by `position`, then `key`, so ordering is deterministic even before
positions are normalised:

* domains by `code`, and within a band by `position`;
* families by `(domain, position)`;
* services by `(primary domain, position)`, offerings by `(parent, tier_rank)`;
* items by `(item_type, position)`, relations by `(kind, position)`.

The admin API reorders a list with one `PUT` of the full ordered list, inside one transaction (the
deferred unique constraints allow the temporary duplicates).

## 5. Delete and archive rules (database side)

| FK | Rule | Why |
| --- | --- | --- |
| subtype → `catalogue_entities` | CASCADE | the subtype row is part of the entity |
| translations, items, item translations, engagements (owner), tools, relations (`from`), slug history | CASCADE | owned children; deleted only with a never-published draft |
| relations (`to`), `via_domain_id`, `family_services.service_id`, `services.primary_domain_id`, `services.parent_service_id`, `service_domains.contact_service_id`, `service_families.domain_id` | RESTRICT | a referenced entity can only be archived, never deleted under its references |
| `*_by_id` → `admin_users` | SET NULL | deleting an admin keeps the history (the audit log keeps `actor_label`) |

The application allows hard delete only when `first_published_at IS NULL` (SERVICE_CATALOGUE §10).

## 6. Audit catalogue additions

`audit_logs` is reused unchanged. `entity_type` is `catalogue.<type>`, `catalogue.release` or
`catalogue`.

| Action | `details` |
| --- | --- |
| `catalogue.entity_created`, `catalogue.entity_updated` | `revision`, changed `fields`, `locale` if a translation changed |
| `catalogue.items_replaced`, `catalogue.relations_replaced`, `catalogue.engagements_replaced`, `catalogue.tools_replaced` | `revision`, `item_type` / `kind`, `count` |
| `catalogue.slug_changed` | `locale`, `from`, `to` |
| `catalogue.entity_archived`, `catalogue.entity_restored`, `catalogue.entity_deleted` | `key`, `revision` |
| `catalogue.release_published`, `catalogue.release_activated` | `number`, `content_hash`, `entity_count`, `previous` |
| `catalogue.validation_failed` | `error_count` (on a refused publish) |
| `catalogue.imported` | `number`, `source_sha`, counts per type (CLI, actor `cli`) |
| `admin.role_changed` | `user_id`, `from`, `to` (CLI) |

No full texts go into `details`. The texts of what was public are in the release documents.

## 7. Migrations (planned, not created)

| Revision | Content | Downgrade |
| --- | --- | --- |
| `0009` (**created**) | V1 slice: the seven tables listed in the status note, with their constraints; no data | drops the seven tables |
| next | the remaining tables (content items, engagements, tools, technologies, slug history, releases), the other offering types and their columns, the other relation kinds | drops what it added |
| next | `admin_users.role` (NOT NULL, server default `'admin'`, CHECK) | drops the column |

Data is loaded by the CLI importer, not by migrations (SERVICE_CATALOGUE_ARCHITECTURE §12, S3).
Tests to add to `test_migrations_and_retention.py`:

* `alembic check` after 0009 and 0010;
* the upgrade/downgrade round trip;
* `0008` data survives `0010` (existing admins become `admin`);
* the constraints: a duplicate slug across a domain and a service in one locale fails; a managed
  offering without a parent fails; a disallowed relation kind fails; two active releases fail.

## 8. Estimated volume

| Table | Rows after import (approx.) |
| --- | --- |
| `catalogue_entities` | 10 domains + 60 families + 9 services + 3 offerings + ~6 industries + ~25 technologies ≈ 115 |
| `entity_translations` | ≈ 230 |
| `content_items` / translations | ≈ 900 / ≈ 1 700 |
| `entity_relations` | ≈ 120 |
| `catalogue_releases` | 1 (+1 per publication) |

Every query is a primary-key or small-index lookup. The public API never queries these tables
anyway (it serves the release document). No partitioning or extra caching tables are needed.
