# Database schema

PostgreSQL 17. Schema is managed exclusively by Alembic (`apps/api/alembic/versions`).
`tests/test_migrations_and_retention.py` runs `alembic check` (models ↔ migrations must match) and a
full upgrade/downgrade round trip on a fresh database.

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
| service | varchar(32) | CHECK in (`maintenance`, `seo`, `ai_tools`, `automation`, `analytics`, `integrations`, `audit`, `other`) |
| name, company | varchar(120), varchar(160) | |
| email | varchar(254) | lower-case |
| phone | varchar(40) null | optional |
| message | text | ≤ 5000 chars (validated) |
| status | varchar(20) | CHECK in (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `WON`, `LOST`); indexed |
| source | varchar(40) | `website_contact_form` or `synthetic_seed` |
| privacy_acknowledged_at | timestamptz | when the visitor confirmed the privacy information |
| privacy_notice_version | varchar(32) | `PRIVACY_NOTICE_VERSION` at submission time |
| marketing_consent | boolean | separate, optional consent |
| marketing_consent_at | timestamptz null | |
| ip_hash | varchar(64) null | abuse correlation without storing the IP |
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
| actor_id | uuid FK → admin_users (SET NULL) | |
| actor_label | varchar(254) | admin e-mail, `website`, `cli`, `retention-job`, `anonymous` … |
| action | varchar(64) | e.g. `lead.created`, `lead.status_changed`, `auth.login_failed`, `ai_action.approved` |
| entity_type, entity_id | varchar | composite index |
| details | jsonb | e.g. `{"from":"NEW","to":"QUALIFIED"}` |
| ip_hash | varchar(64) | |

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

## Retention & erasure

| Data | Rule | Mechanism |
| --- | --- | --- |
| Leads + notes | deleted when `updated_at` older than `LEAD_RETENTION_DAYS` (default 730) | `python -m app.cli maintenance` |
| Audit log | deleted after `AUDIT_RETENTION_DAYS` (default 1095) | same command |
| Sessions | removed after expiry / 1 day after revocation | same command |
| Individual erasure request | admin deletes the lead in the UI (`DELETE /api/admin/leads/{id}`) | audit keeps only id + reason |

## Seed data

`python -m app.cli seed` (runs automatically on container start):

* creates the bootstrap admin if `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are set;
* when `SEED_SAMPLE_DATA=true` and not production: 7 synthetic leads (`@example.com`,
  `[СИНТЕТИЧНИ ДАННИ]`, `source=synthetic_seed`) and one pending synthetic AI action. Idempotent.
