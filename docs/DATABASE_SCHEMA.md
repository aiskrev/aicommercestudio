# Database schema

PostgreSQL 17. Schema is managed exclusively by Alembic (`apps/api/alembic/versions`).
`tests/test_migrations_and_retention.py` runs `alembic check` (models ↔ migrations must match), a full
upgrade/downgrade round trip on a fresh database, and a data-migration test (rows written under 0001 survive 0002).

## Migrations

| Revision | Content |
| --- | --- |
| `0001` | admin users & sessions, leads, notes, audit log, AI action approvals |
| `0002` | quote requests (`inquiry_type`, `platform`, `budget_range`, `timeline`, `website_url`), service re-categorisation (`submitted_service`, backfilled from `service`), persistent login lockout (`failed_login_count`, `locked_until`), indexes on `leads.service`, `leads.inquiry_type`, `audit_logs.action`, `audit_logs.actor_id` |
| `0003` | `advisor_assessments` (anonymous AI advisor assessments with expiry and optional lead link, FK `ON DELETE CASCADE`) |
| `0004` | AI Managed Services and lead language: `ai_managed` added to the `service` / `submitted_service` CHECKs; `leads.locale` (`bg`/`en`, NOT NULL, server default `bg` — existing rows become `bg`, CHECK `ck_leads_locale`, index `ix_leads_locale`); `leads.service_details` JSONB null. Downgrade re-categorises `ai_managed` leads as `other` (details are dropped with the column) instead of deleting them. |
| `0005` | AI agent development: `ai_agents` added to the `service` / `submitted_service` CHECKs. No existing row changes. |
| `0006` | `leads.marketing_consent_version` varchar(32) null — wording version of a given marketing consent (contact form and AI readiness submissions). Nullable, no default; downgrade drops the column. |
| `0007` | `team_configurations`: saved AI team configurations (enumerated JSONB, schema/model/assumptions versions, visitor rate overrides, SHA-256 `token_hash` unique, `locale` CHECK, `expires_at` index, `lead_id` FK `ON DELETE CASCADE`). New table only; downgrade drops it. |
| `0009` | Service catalogue V1: `catalogue_entities` (supertype: `entity_type`, stable `key`, `status` draft/published/archived, `revision`), `service_domains`, `service_families`, `services` (subtypes sharing the entity id through the composite FK `(id, entity_type)`), `family_services`, `entity_translations` (per locale; slug unique per `(locale, route_namespace)`), `entity_relations` (typed edges with an allowed-combination CHECK). New tables only, no data; `leads` unchanged and not referenced. Downgrade drops the seven tables. See [Service catalogue](#service-catalogue-migration-0009). |
| `0008` | AI operations scaffold: `ops_organizations` (slug unique, status/region, `is_demo`), `ops_workspaces` (unique `(organization_id, slug)` and `(id, organization_id)`), `ops_memberships` (user × organisation × role CHECK, unique pair), `ops_agents` (registry metadata; composite FK `(workspace_id, organization_id)` → workspaces so an agent cannot sit in another tenant's workspace). New tables only; downgrade drops them. See AI_OPERATIONS_PORTAL.md. |

Apply: automatic on container start (`RUN_MIGRATIONS_ON_START=true`), or manually
`docker compose exec api alembic upgrade head`. Inspect: `docker compose exec api alembic current`.
New migration: change `app/models.py`, then `docker compose exec api alembic revision --autogenerate -m "..."`
and review the generated file (CHECK constraints must be added by hand).

Naming convention: `pk_<table>`, `fk_<table>_<column>_<ref>`, `uq_<table>_<column>`, `ck_<table>_<name>`, `ix_<table>_<column>`.
All timestamps are `timestamptz` in UTC.

## admin_users

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| email | varchar(254) unique | stored lower-case |
| full_name | varchar(120) | |
| password_hash | varchar(255) | Argon2id |
| is_active | boolean | inactive users cannot log in or use sessions |
| created_at, last_login_at | timestamptz | |
| failed_login_count | integer, default 0 | consecutive failed logins; reset on success or when a lock is applied |
| locked_until | timestamptz null | set after `LOGIN_LOCKOUT_THRESHOLD` failures for `LOGIN_LOCKOUT_MINUTES` |

## admin_sessions

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK → admin_users (CASCADE) | indexed |
| token_hash | varchar(64) unique | SHA-256 of the cookie token |
| csrf_hash | varchar(64) | SHA-256 of the CSRF token |
| created_at, last_seen_at, expires_at, revoked_at | timestamptz | `expires_at` indexed |
| ip_hash | varchar(64) | keyed HMAC of the IP, never the raw IP |
| user_agent | varchar(255) | |

## leads

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | public reference = first 8 hex chars, upper-case |
| service | varchar(32) | current categorisation (admins may change it); CHECK in (`maintenance`, `seo`, `ai_tools`, `automation`, `analytics`, `integrations`, `audit`, `ai_managed`, `other`); indexed |
| submitted_service | varchar(32) | what the visitor selected — never changed; same CHECK |
| inquiry_type | varchar(16), default `contact` | CHECK in (`contact`, `quote`); indexed |
| platform | varchar(32) null | quotes only: CHECK in (`shopify`, `woocommerce`, `custom`, `other`, `none`) |
| budget_range | varchar(32) null | quotes only: CHECK in (`undisclosed`, `under_2500`, `2500_10000`, `10000_25000`, `over_25000`) — indicative, not a price |
| timeline | varchar(32) null | quotes only: CHECK in (`asap`, `within_1_month`, `within_3_months`, `flexible`) |
| website_url | varchar(300) null | quotes only, validated http(s) URL |
| name, company | varchar(120), varchar(160) | |
| email | varchar(254) | lower-case |
| phone | varchar(40) null | optional |
| message | text | ≤ 5000 chars (validated) |
| status | varchar(20) | CHECK in (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `WON`, `LOST`); indexed |
| source | varchar(40) | `website_contact_form`, `readiness_assessment` (AI readiness submission, `service_details.kind = "readiness"`), `team_configurator` (AI team consultation, `service_details.kind = "team"`, configuration in `team_configurations`) or `synthetic_seed` |
| privacy_acknowledged_at | timestamptz | when the visitor confirmed the privacy information |
| privacy_notice_version | varchar(32) | `PRIVACY_NOTICE_VERSION` at submission time |
| marketing_consent | boolean | separate, optional consent |
| marketing_consent_at | timestamptz null | |
| marketing_consent_version | varchar(32) null | `MARKETING_CONSENT_VERSION` when consent was given; null otherwise and for consents before `0006` |
| ip_hash | varchar(64) null | abuse correlation without storing the IP |
| locale | varchar(2), default `bg` | website language of the inquiry; CHECK in (`bg`, `en`); indexed (admin filter) |
| service_details | jsonb null | service-specific, validated data. AI Managed Services: `{"kind": "ai_managed", "sector", "system_types"[], "agents_count", "ai_provider", "hosting", "support_interests"[], "communication_language", "additional_notes"}` — descriptive only, never credentials (free text is screened for secrets) |
| created_at, updated_at, status_changed_at | timestamptz | `created_at`, `updated_at` indexed |

## lead_notes

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| lead_id | uuid FK → leads (CASCADE) | indexed — notes are erased with the lead |
| author_id | uuid FK → admin_users (SET NULL) | |
| body | text | ≤ 4000 chars |
| created_at | timestamptz | |

## audit_logs

Append-only activity log. `details` must never contain raw personal data.

| Column | Type | Notes |
| --- | --- | --- |
| id | bigint PK | |
| created_at | timestamptz | indexed |
| actor_id | uuid FK → admin_users (SET NULL) | indexed |
| actor_label | varchar(254) | admin e-mail, `website`, `cli`, `retention-job`, `anonymous` … |
| action | varchar(64) | indexed; see the action catalogue below |
| entity_type, entity_id | varchar | composite index |
| details | jsonb | e.g. `{"from":"NEW","to":"QUALIFIED"}` |
| ip_hash | varchar(64) | |

### Audit action catalogue

| Action | Recorded when |
| --- | --- |
| `lead.created` | a contact or quote request is stored (`details.inquiry_type`); AI readiness submissions add `source`, `band`, `consultation_requested` |
| `lead.readiness_report_downloaded` | an admin downloaded the PDF report of a readiness submission |
| `lead.team_report_downloaded` | an admin downloaded the PDF plan of an AI team consultation |
| `lead.viewed` | an admin opens a lead (personal-data access; at most once per admin / lead / 15 min) |
| `lead.status_changed`, `lead.service_changed` | pipeline or categorisation change (`from`, `to`) |
| `lead.note_added`, `lead.deleted` | note added; GDPR erasure or retention deletion (`reason`) |
| `auth.login`, `auth.logout`, `auth.logout_all` | session lifecycle |
| `auth.login_failed`, `auth.account_locked`, `auth.login_blocked` | failed login (hash of e-mail only), lockout applied, attempt on a locked account |
| `auth.session_idle_timeout` | session revoked for inactivity |
| `retention.run` | an admin applied the retention policy (counts) |
| `ai.lead_triage`, `ai_action.proposed/approved/rejected` | AI suggestion and approval workflow |
| `admin.created`, `admin.password_reset`, `seed.synthetic_data`, `seed.synthetic_purged` | CLI operations |
| `ops.organization_created` | CLI `ops-create-org` / `ops-seed-demo` (actor `cli`) |
| `ops.workspace_created`, `ops.agent_created`, `ops.agent_updated` | AI operations registry writes (`details.organization_id`; agent updates list changed field names) |
| `catalogue.seeded`, `catalogue.purged` | service catalogue seed with changes (`created` / `updated` counts per type, `schema_version`) or purge (`entities`); actor `cli` |
| `ops.member_added`, `ops.member_role_changed`, `ops.member_removed` | organisation membership changes (`user_id`, roles) |

## ai_action_requests

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| action_type | varchar(64) | see `app/ai/policy.py` |
| risk_level | varchar(16) | `low` / `high` / `critical` |
| status | varchar(16) | CHECK in (`PENDING`, `APPROVED`, `REJECTED`, `EXECUTED`); indexed |
| summary | varchar(300) | |
| payload | jsonb | proposed change |
| requested_by | varchar(120) | agent identifier |
| decided_by_id | uuid FK → admin_users (SET NULL) | |
| created_at, decided_at | timestamptz | |
| decision_comment | text | |


## advisor_assessments

Anonymous AI advisor assessments ([AI_ADVISOR.md](AI_ADVISOR.md)). No personal data is collected; the
description is stored after e-mails, phone numbers and links were removed.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | reference = first 8 hex chars, upper case |
| created_at, expires_at | timestamptz | `expires_at = created_at + ADVISOR_RETENTION_DAYS`; index `ix_advisor_assessments_expires_at` |
| business_type, monthly_volume, team_size | varchar | API enums (validated by Pydantic) |
| tools | jsonb | list of tool keys |
| process_description | text | screened text (PII and links removed, `<`/`>` neutralised) |
| result | jsonb | validated and sanitised `AutomationAssessment` |
| mode | varchar(8) | `demo` or `ai` (CHECK `ck_advisor_assessments_mode`) |
| provider, model, prompt_version | varchar | which engine produced the result |
| injection_suspected | bool | injection phrasing detected in the input |
| lead_id | uuid FK → leads.id **ON DELETE CASCADE**, nullable | set when the visitor requests a consultation; index `ix_advisor_assessments_lead_id` |
| linked_at | timestamptz | when it was linked |

## team_configurations

Saved AI team configurations ([TEAM_CONFIGURATOR.md](TEAM_CONFIGURATOR.md)). Enumerated values only —
no personal data and no free text.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | reference = first 8 hex chars, upper case |
| created_at, expires_at | timestamptz | unlinked: `+ TEAM_CONFIGURATION_RETENTION_DAYS`; index `ix_team_configurations_expires_at` |
| token_hash | varchar(64) null, UNIQUE | SHA-256 of the secret link token; null for configurations attached to a consultation (not retrievable by link) |
| schema_version, model_version, assumptions_version | varchar | request shape, team model and cost assumptions the row was saved/priced with |
| locale | varchar(2), default `bg` | CHECK `ck_team_configurations_locale` |
| config | jsonb | context, departments, chosen agents, per-agent settings (team members only), deployment, operations |
| overrides | jsonb | visitor rate overrides (bounded by the API) |
| lead_id | uuid FK → leads.id **ON DELETE CASCADE**, nullable | the consultation lead; index `ix_team_configurations_lead_id` |

## AI operations scaffold (`ops_*`, migration 0008)

Staff-only tenancy foundation ([AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md)). Every
tenant-owned row carries `organization_id`, and the API reads it only through
`app/ops/tenancy.py::scoped`. The tables hold no telemetry and no credentials. RLS is not enabled
(see `IMPLEMENTATION_DEPENDENCIES_V2.md`, P1).

### ops_organizations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| slug | varchar(60) UNIQUE | `uq_ops_organizations_slug` |
| name | varchar(120) | |
| status | varchar(16), default `active` | CHECK `ck_ops_organizations_status` (`active`, `suspended`). Writes to a suspended organisation are refused. |
| data_region | varchar(8), default `eu` | |
| is_demo | boolean, default false | sample data from `ops-seed-demo` (refused in production) |
| created_at | timestamptz | |

### ops_workspaces

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| organization_id | uuid FK → ops_organizations.id **ON DELETE CASCADE** | index `ix_ops_workspaces_organization_id` |
| slug, name | varchar(60), varchar(120) | UNIQUE `(organization_id, slug)` = `uq_ops_workspaces_org_slug` |
| environment | varchar(16) | CHECK `ck_ops_workspaces_environment` (`production`, `staging`, `development`) |
| created_at | timestamptz | |

UNIQUE `(id, organization_id)` (`uq_ops_workspaces_id_org`) is the target of the composite tenant
foreign key on `ops_agents`.

### ops_memberships

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| organization_id | uuid FK → ops_organizations.id **ON DELETE CASCADE** | index `ix_ops_memberships_organization_id` |
| user_id | uuid FK → admin_users.id **ON DELETE CASCADE** | index `ix_ops_memberships_user_id`; staff principals only today |
| role | varchar(16) | CHECK `ck_ops_memberships_role` (`owner`, `admin`, `operator`, `reviewer`, `viewer`) |
| created_at | timestamptz | |

UNIQUE `(organization_id, user_id)` = `uq_ops_memberships_org_user`.

### ops_agents

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| organization_id | uuid FK → ops_organizations.id **ON DELETE CASCADE** | index `ix_ops_agents_organization_id` |
| workspace_id | uuid | **composite FK** `(workspace_id, organization_id)` → `ops_workspaces (id, organization_id)` ON DELETE CASCADE (`fk_ops_agents_workspace_org`). The database rejects an agent placed in another tenant's workspace. Index `ix_ops_agents_workspace_id`. |
| key | varchar(60) | UNIQUE `(workspace_id, key)` = `uq_ops_agents_workspace_key` |
| name | varchar(120) | |
| status | varchar(16) | CHECK `ck_ops_agents_status` (`planned`, `active`, `paused`, `retired`) |
| provider, model, version | varchar(40/80/40) null | identifiers only; the API rejects secret-like text |
| purpose | varchar(300) null | |
| created_at, updated_at | timestamptz | |

Ops writes are audited in `audit_logs` (`ops.*` actions) with `details.organization_id`.
Retention: contract lifecycle; there is no automatic purge, and `ops-purge-demo` removes demo
organisations.

## Service catalogue (migration 0009)

First bounded slice of [DATABASE_SCHEMA_V2.md](DATABASE_SCHEMA_V2.md). Models are in
`app/models.py` (`CatalogueEntity`, `CatalogueDomain`, `CatalogueFamily`, `CatalogueService`,
`FamilyService`, `EntityTranslation`, `EntityRelation`). The seed, its validation and the
integrity check are in `app/catalogue/`.

| Table | Key columns | Integrity |
| --- | --- | --- |
| `catalogue_entities` | `entity_type` (domain, family, service), `key`, `status`, `revision`, `first_published_at`, `archived_at`, `created_by_id` / `updated_by_id` | unique `(entity_type, key)` and `(id, entity_type)`; key format (family keys qualified, e.g. `devops_sre.cicd`); `archived_at` set exactly when archived |
| `service_domains` | `code` A–J, `band`, `icon`, `position`, `contact_service_id` → `services` | unique code; unique `(band, position)` deferrable; FK `(id, entity_type)` → entity (CASCADE) |
| `service_families` | `domain_id`, `delivery_status`, `position` | unique `(domain_id, position)` deferrable; domain FK RESTRICT |
| `services` | `offering_type` (V1: `service`), `primary_domain_id`, `delivery_status`, `lead_category`, `icon`, `custom_page`, `is_entry_offer`, `position` | `lead_category` ∈ ServiceKey except `other`, unique; a service needs a primary domain and a lead category |
| `family_services` | `family_id`, `service_id`, `position` | PK pair; service FK RESTRICT |
| `entity_translations` | `entity_id`, `locale`, `route_namespace`, `slug`, `name`, `short_name`, `summary`, `body`, `cta_label`, `prerequisite`, `seo_title`, `seo_description`, `primary_keyword` | PK `(entity_id, locale)`; unique `(locale, route_namespace, slug)` and `(locale, lower(primary_keyword))` (partial); slug format |
| `entity_relations` | `from_entity_id`/`from_type`, `kind`, `to_entity_id`/`to_type`, `position` | composite FKs to `(id, entity_type)`; CHECK: `related` service→service, `cross_sell` domain→domain, `delivered_through` family→domain |

**Not in V1** (later migrations, SCHEMA_V2 §3): content items, engagement models, tools,
technologies and industries, assessments, workshops and managed offerings, slug history, releases,
`admin_users.role`.

**Source and seeding.** The web content stays the source of truth. `apps/web/src/lib/catalogue-seed.ts`
generates `catalogue-seed.json`; the API keeps an identical copy, `app/catalogue/seed_v1.json`,
and `scripts/test.ps1` compares the hashes. `python -m app.cli catalogue-seed`:

* validates the document (Pydantic, then the cross-reference rules);
* reconciles the database in one transaction: entities matched by `(entity_type, key)`, with new
  ids that are deterministic (`uuid5`);
* updates changed rows in place and increments `revision` once per changed entity;
* **never deletes**: entities missing from the document are reported and left as they are.

A repeated run changes nothing. `--dry-run` rolls back. `python -m app.cli seed` runs it on every
container start.

**Existing service references.** `leads.service` / `submitted_service` keep their ServiceKey
values and CHECKs, with no foreign key to the catalogue. The seed refuses a document in which any
ServiceKey except `other` has no catalogue service (`services.lead_category`, unique).
`catalogue-check` verifies:

* every published domain and service has BG and EN content with a slug;
* every published domain has a contact service;
* every lead category maps to a published service.

**Rollback.** Applied on a copy of the local development database (277 leads), 2026-10-28: lead,
note, admin, assessment and configuration data were unchanged after the upgrade, after the seed and
after the downgrade.

| Situation | Action | Effect |
| --- | --- | --- |
| Bad catalogue content | fix the web content, regenerate and copy the seed, run `catalogue-seed` | rows corrected in place, revision +1 |
| Remove the catalogue data, keep the schema | `python -m app.cli catalogue-purge --yes` | catalogue rows deleted (audited `catalogue.purged`); rebuild with `catalogue-seed` |
| Remove the schema | `alembic downgrade 0008` | the seven tables are dropped; no other table is touched; `alembic upgrade head` + `catalogue-seed` restore it |

Before rolling back the schema in production, the API image must be one without the catalogue
seed in `app.cli seed`. Otherwise the next container start upgrades again.

## Retention & erasure

| Data | Rule | Mechanism |
| --- | --- | --- |
| Leads + notes | deleted when `updated_at` older than `LEAD_RETENTION_DAYS` (default 730) | `python -m app.cli maintenance`, or admin dashboard (`GET /api/admin/retention` preview, `POST /api/admin/retention/run` with confirmation) |
| Audit log | deleted after `AUDIT_RETENTION_DAYS` (default 1095) | same command |
| Sessions | removed after expiry / 1 day after revocation | same command |
| Advisor assessments | unlinked rows deleted after `expires_at` (`ADVISOR_RETENTION_DAYS`, default 30); linked rows are deleted with their lead | same command and admin retention panel |
| AI team configurations | unlinked rows deleted after `expires_at` (`TEAM_CONFIGURATION_RETENTION_DAYS`, default 90); linked rows are deleted with their lead; configurator leads also expire after `TEAM_LEAD_RETENTION_DAYS` (default 365) | same command and admin retention panel |
| Individual erasure request | admin deletes the lead in the UI (`DELETE /api/admin/leads/{id}`); a linked advisor assessment is deleted with it | audit keeps only id + reason |

## Seed data

`python -m app.cli seed` (runs automatically on container start):

* creates the bootstrap admin if `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are set;
* when `SEED_SAMPLE_DATA=true` and not production: 7 synthetic leads (`@example.com`,
  `[СИНТЕТИЧНИ ДАННИ]`, `source=synthetic_seed`; three of them are quote requests) and one pending
  synthetic AI action. Idempotent. Refused in production by configuration validation.
* `python -m app.cli purge-synthetic` removes all synthetic leads and synthetic AI actions (real leads untouched).
* in every environment: the service catalogue (`catalogue-seed`, idempotent; see
  [Service catalogue](#service-catalogue-migration-0009)). A seed that fails validation makes
  `seed` exit with 1.
