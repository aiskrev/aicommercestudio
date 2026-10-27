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
| source | varchar(40) | `website_contact_form`, `readiness_assessment` (AI readiness submission, `service_details.kind = "readiness"`) or `synthetic_seed` |
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
| `lead.viewed` | an admin opens a lead (personal-data access; at most once per admin / lead / 15 min) |
| `lead.status_changed`, `lead.service_changed` | pipeline or categorisation change (`from`, `to`) |
| `lead.note_added`, `lead.deleted` | note added; GDPR erasure or retention deletion (`reason`) |
| `auth.login`, `auth.logout`, `auth.logout_all` | session lifecycle |
| `auth.login_failed`, `auth.account_locked`, `auth.login_blocked` | failed login (hash of e-mail only), lockout applied, attempt on a locked account |
| `auth.session_idle_timeout` | session revoked for inactivity |
| `retention.run` | an admin applied the retention policy (counts) |
| `ai.lead_triage`, `ai_action.proposed/approved/rejected` | AI suggestion and approval workflow |
| `admin.created`, `admin.password_reset`, `seed.synthetic_data`, `seed.synthetic_purged` | CLI operations |

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

## Retention & erasure

| Data | Rule | Mechanism |
| --- | --- | --- |
| Leads + notes | deleted when `updated_at` older than `LEAD_RETENTION_DAYS` (default 730) | `python -m app.cli maintenance`, or admin dashboard (`GET /api/admin/retention` preview, `POST /api/admin/retention/run` with confirmation) |
| Audit log | deleted after `AUDIT_RETENTION_DAYS` (default 1095) | same command |
| Sessions | removed after expiry / 1 day after revocation | same command |
| Advisor assessments | unlinked rows deleted after `expires_at` (`ADVISOR_RETENTION_DAYS`, default 30); linked rows are deleted with their lead | same command and admin retention panel |
| Individual erasure request | admin deletes the lead in the UI (`DELETE /api/admin/leads/{id}`); a linked advisor assessment is deleted with it | audit keeps only id + reason |

## Seed data

`python -m app.cli seed` (runs automatically on container start):

* creates the bootstrap admin if `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are set;
* when `SEED_SAMPLE_DATA=true` and not production: 7 synthetic leads (`@example.com`,
  `[СИНТЕТИЧНИ ДАННИ]`, `source=synthetic_seed`; three of them are quote requests) and one pending
  synthetic AI action. Idempotent. Refused in production by configuration validation.
* `python -m app.cli purge-synthetic` removes all synthetic leads and synthetic AI actions (real leads untouched).
