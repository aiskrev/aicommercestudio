# API reference

Base path `/api`. From the browser use the website origin `http://localhost:3000/api/...` (same-origin
proxy); directly: `http://localhost:8000/api/...`.

* Interactive docs (development only): `http://localhost:8000/api/docs`
* Machine-readable spec: [`docs/openapi.json`](openapi.json) (OpenAPI 3.1, generated from the code).
  Regenerate it with
  `docker compose --profile test run --rm --no-deps -v "${PWD}:/repo" api-tests python scripts/docs_sync.py --write`.
* `scripts/test.ps1 -Suite api` fails when the spec differs from the code or when a route below is
  missing from this document (`apps/api/scripts/docs_sync.py`).

## Error envelope

Every error has the same shape. Clients branch on `code`, show `detail`, and quote
`request_id` (also returned as the `X-Request-ID` header and present in the API logs) in support requests.

**Language.** `detail` and field `message`s are Bulgarian by default and English when the request
sends `Accept-Language: en` (any `en-*` tag). Other languages fall back to Bulgarian. `code` values
never change with the language. The web app sends the page language on every call; the admin UI
sends the admin language.

```json
{ "detail": "Невалиден CSRF токен. Презаредете страницата.", "code": "csrf_failed", "request_id": "9f2c…" }
```

Validation errors (422) add `errors`:

```json
{
  "detail": "Моля, коригирайте маркираните полета.",
  "code": "validation_error",
  "request_id": "…",
  "errors": [{ "field": "email", "message": "Въведете валиден имейл адрес.", "type": "value_error" }]
}
```

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `form_token_invalid` | form submitted too fast, token expired, missing or forged |
| 400 | `spam_suspected` | message contains too many links |
| 401 | `unauthorized` | no / invalid / revoked / expired session |
| 401 | `session_expired` | session revoked after `SESSION_IDLE_MINUTES` of inactivity |
| 401 | `invalid_credentials` | wrong e-mail or password (generic, no account enumeration) |
| 403 | `csrf_failed` | missing or wrong `X-CSRF-Token` on a state-changing admin request |
| 403 | `origin_rejected` | cross-site `Origin` on a state-changing request |
| 403 | `forbidden_role` | the staff role does not allow the action (catalogue roles; non-`admin` roles outside the catalogue) |
| 404 | `not_found`, `lead_not_found`, `action_not_found` | unknown route or resource |
| 404 | `domain_not_found`, `service_not_found`, `catalogue_entity_not_found` | unknown or unpublished catalogue entry |
| 404 | `staff_not_found` | unknown staff account |
| 409 | `status_conflict` | `expected_status` no longer matches (another admin changed the lead) |
| 409 | `already_decided` | AI action was already approved/rejected |
| 409 | `key_taken`, `slug_taken`, `invalid_transition`, `domain_archive_not_allowed`, `entity_referenced` | catalogue: duplicate key, concurrent slug clash, action not possible in the current state, delete blocked by links |
| 409 | `own_role`, `last_admin` | staff: changing one's own role; demoting the last active administrator |
| 412 | `revision_conflict` | catalogue: `If-Match` revision is stale |
| 413 | `payload_too_large` | body > 64 KB |
| 422 | `validation_error` | see `errors` |
| 422 | `advisor_declined` | the AI model declined to assess the text |
| 422 | `invalid_filter` | catalogue: unknown filter value or query parameter |
| 422 | `catalogue_incomplete` | catalogue: publishing (or preview) blocked; see `errors` |
| 428 | `precondition_required` | catalogue write without `If-Match` |
| 429 | `rate_limited` | rate limit or locked account; see `Retry-After` |
| 502 | `ai_unavailable` | external AI provider failed |
| 502 | `advisor_invalid_output` | the AI output failed schema validation or was truncated |
| 503 | `advisor_unavailable`, `advisor_busy` | AI provider unreachable / rate-limited |
| 504 | `advisor_timeout` | AI provider did not answer within `ADVISOR_TIMEOUT_SECONDS` (one retry) |
| 500 | `internal_error` | unexpected error (logged with the request id) |

## Health

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness → `{"status":"ok"}` |
| GET | `/api/health/ready` | Readiness incl. database → 200 or 503 |

## Public (no authentication)

Both submission endpoints share the anti-spam pipeline and rate limits: `CONTACT_RATE_LIMIT` per client per
`CONTACT_RATE_WINDOW_SECONDS` (5 / 600 s) plus `CONTACT_GLOBAL_RATE_LIMIT` overall (60 / 600 s). The limit is
applied before validation, so invalid and spam submissions also count. Stored leads are never readable here.

### `GET /api/public/form-token`
Signed timing token: `{"token": "1761200000.ab12cd34ef56.<sig>"}`, valid between
`FORM_TOKEN_MIN_SECONDS` (3) and `FORM_TOKEN_MAX_AGE_SECONDS` (7200) after issue. `Cache-Control: no-store`.

### `POST /api/public/leads` → 201 — contact inquiry

```json
{
  "service": "seo",
  "name": "Иван Петров",
  "company": "Примерна Фирма ЕООД",
  "email": "ivan@example.com",
  "phone": "+359 88 123 4567",
  "message": "Нуждаем се от технически SEO одит на магазина.",
  "privacy_acknowledged": true,
  "marketing_consent": false,
  "website": "",
  "form_token": "<from /form-token>",
  "locale": "bg"
}
```

| Field | Rules |
| --- | --- |
| service | `maintenance, seo, ai_tools, automation, analytics, integrations, audit, ai_managed, other` |
| locale | optional `bg` (default) or `en` — website language, stored on the lead; other values → 422. The success `message` is returned in this language. |
| ai_managed | only with `service = "ai_managed"` (otherwise 422 `ai_details_service`), optional — see below |
| name / company | 2–120 / 2–160 chars, no links or HTML |
| email | valid address ≤ 254, stored lower-case |
| phone | optional, `+?[0-9 ()-./]{6,40}` |
| message | 20–5000 chars, no control characters, ≤ 3 links, must not contain anything that looks like a credential (422 `secrets`) |
| privacy_acknowledged | must be `true` (timestamp + notice version are stored) |
| marketing_consent | optional, stored separately with timestamp |
| website | honeypot — must be empty (filled → fake 201, nothing stored) |
| unknown fields | rejected (422) — e.g. quote fields are not accepted here |

Response: `{"status": "received", "reference": "3B78AEBC", "message": "…", "inquiry_type": "contact"}`.

#### AI Managed Services details (`ai_managed`)

```json
{
  "service": "ai_managed",
  "locale": "en",
  "message": "Our support agent started giving wrong answers after the last prompt change.",
  "ai_managed": {
    "sector": "ecommerce",
    "system_types": ["customer_support", "knowledge_assistant"],
    "agents_count": "2_5",
    "ai_provider": "Anthropic",
    "hosting": "public_cloud",
    "support_interests": ["monitoring", "cost_optimization"],
    "communication_language": "en",
    "additional_notes": ""
  },
  "...": "all other contact fields"
}
```

| Field | Rules |
| --- | --- |
| sector | `ecommerce, retail, professional_services, manufacturing, logistics, healthcare, finance, software_saas, agency, other` |
| system_types | 1+ of `customer_support, knowledge_assistant, workflow_automation, sales_assistant, document_processing, custom_llm_app, other` (duplicates removed) |
| agents_count | `1, 2_5, 6_20, over_20, unknown` |
| ai_provider | optional, ≤ 120 chars, no links/HTML, no credentials |
| hosting | optional: `vendor_platform, public_cloud, private_server, on_premise, unknown, other` |
| support_interests | 1+ of `monitoring, maintenance, security, cost_optimization, quality_evaluation, incident_support, full_managed` |
| communication_language | `bg` or `en` |
| additional_notes | optional, ≤ 2000 chars, no credentials |
| unknown fields | rejected (e.g. `api_key`) |

Field errors inside `ai_managed` are reported with flat names (`ai_system_types`, `ai_provider`, …).
Stored in `leads.service_details` as `{"kind": "ai_managed", ...}`; never returned by public endpoints.

### `POST /api/public/quote-requests` → 201 — request for a written quote

All contact fields plus:

| Field | Rules |
| --- | --- |
| platform | required: `shopify, woocommerce, custom, other, none` |
| budget_range | required: `undisclosed, under_2500, 2500_10000, 10000_25000, over_25000` (indicative, not a price) |
| timeline | required: `asap, within_1_month, within_3_months, flexible` |
| website_url | optional http(s) URL ≤ 300; scheme added if missing (`example.bg` → `https://example.bg`) |

Response as above with `"inquiry_type": "quote"`.

Both lead endpoints accept an optional `advisor_assessment_id` (UUID of a stored advisor assessment).
A valid, unexpired, not yet linked assessment is attached to the new lead; an unknown, expired or
already linked id is ignored and never blocks the request.

## Public: AI Business Automation Advisor

Details, safety controls and limits: [AI_ADVISOR.md](AI_ADVISOR.md).

### `GET /api/public/advisor/status`

```json
{ "mode": "demo", "disclaimer": "Демонстрационен режим: …", "retention_days": 30, "description_min": 40, "description_max": 2000 }
```

The disclaimer follows `Accept-Language` (`bg` | `en`).

### `POST /api/public/advisor/assessments` → 201

Rate limited per client and globally (`ADVISOR_*`), requires a form token. No personal-data fields exist;
unknown fields are rejected. Optional `locale` (`bg` default | `en`) selects the language of the generated
assessment, disclaimer and notices (the demo engine uses English templates; the AI provider is
instructed to answer in English).

| Field | Rules |
| --- | --- |
| business_type | `online_store, retail, wholesale, services, professional, manufacturing, logistics, hospitality, agency, other` |
| process_description | 40–2000 chars, no control characters, ≤ 3 links (links, e-mails and phones are removed before processing) |
| monthly_volume | `under_100, 100_500, 500_2000, 2000_10000, over_10000` |
| team_size | `solo, 2_5, 6_20, 21_50, over_50` |
| tools | list of `shopify, woocommerce, other_ecommerce, spreadsheets, google_workspace, microsoft_365, email, crm, erp, accounting, invoicing, courier, payments, helpdesk, messaging, none` (duplicates removed; `none` is dropped if combined) |
| other_tools | optional, ≤ 200 chars, no links/HTML |
| save_assessment | bool, default `true`; `false` → nothing is stored |
| form_token | from `GET /api/public/form-token`, ≥ 3 s old |
| contract_version | `"1"` (default; the original contract, response unchanged) or `"2"` |
| context | V2 only, required there: `{goal: save_time\|reduce_errors\|faster_response\|handle_growth\|better_visibility, data_sensitivity: none\|business\|personal\|financial\|special_category, customer_facing: bool, system_access: api\|exports\|manual_only\|unknown, change_capacity: no_it\|external_it\|internal_it}`; rejected on V1 |
| include_roadmap | V2 only, bool (default `false`): add the indicative 30/60/90-day roadmap |

V2 responses add `contract_version: "2"` and `insights` (classified opportunities, feasibility with factors,
risk profile, up to four service domains, approval checkpoints, integration and security prerequisites,
a pilot, the optional roadmap and a provenance note). Every insight carries `basis[]` (`source`: `input`,
`assessment` or `rule`). Insights are computed by fixed rules on the server, never by the model
([AI_ADVISOR_V2.md](AI_ADVISOR_V2.md)).

```json
{
  "assessment_id": "b20e2bcc-…", "reference": "B20E2BCC", "mode": "demo", "provider": "mock", "model": "rule-based-v1",
  "disclaimer": "Демонстрационен режим: …", "notices": [], "stored": true,
  "expires_at": "2026-11-22T15:16:06Z", "created_at": "2026-10-23T15:16:06Z",
  "assessment": {
    "problem_summary": "…", "opportunities": [{ "title": "…", "description": "…", "approach": "integration", "priority": "high" }],
    "proposed_workflow": [{ "title": "…", "description": "…", "actor": "system", "requires_human_approval": true }],
    "integrations": [{ "system": "WooCommerce", "purpose": "…", "access": "read_write" }],
    "human_approvals": [{ "decision": "…", "reason": "…" }], "data_protection": ["…"],
    "risks": [{ "risk": "…", "mitigation": "…" }], "complexity": { "level": "medium", "rationale": "…" },
    "phases": [{ "name": "…", "description": "…", "deliverables": ["…"], "indicative_duration": "2–3 седмици" }],
    "clarification_questions": ["…"], "next_steps": ["…"]
  }
}
```

Errors: `422 validation_error`, `400 form_token_invalid`, `429 rate_limited`, `504 advisor_timeout`,
`503 advisor_busy`, `503 advisor_unavailable`, `422 advisor_declined`, `502 advisor_invalid_output`.

## Public: AI readiness assessment

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/public/readiness/meta` | rubric and model versions, whether e-mail delivery is available |
| POST | `/api/public/readiness/report` | anonymous PDF report; nothing stored; form token and rate limit |
| POST | `/api/public/readiness/submissions` | optional hand-off to the team with consent → lead (`service=audit`, details in `service_details`) |

Admins download a submission's PDF from `GET /api/admin/leads/{id}/readiness-report`. Fields,
limits and errors: [READINESS_REPORTS.md](READINESS_REPORTS.md#api).

## Public: AI team configurator

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/public/team/meta` | model and assumption versions, published cost assumptions |
| POST | `/api/public/team/estimate` | plan, security, data flows and costs for three scenarios; nothing stored |
| POST | `/api/public/team/report` | PDF plan; nothing stored |
| POST | `/api/public/team/configurations` | save a configuration privately → secret link token (only its SHA-256 hash is stored; expires) |
| POST | `/api/public/team/configurations/lookup` | load a saved configuration; the token is sent in the body, never in a URL |
| POST | `/api/public/team/submissions` | optional consultation with consent → lead with the linked configuration |

Admins download a consultation's plan from `GET /api/admin/leads/{id}/team-report`. Fields, limits,
cost model and errors: [TEAM_CONFIGURATOR.md](TEAM_CONFIGURATOR.md#api).

## Public: assessment engine

Deterministic questionnaire assessments ([ASSESSMENT_PLATFORM_ARCHITECTURE.md](ASSESSMENT_PLATFORM_ARCHITECTURE.md)).
Definitions with status `preview` are served only when `ASSESSMENTS_PREVIEW_ENABLED=true`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/public/assessments` | the definitions that may be served (`?locale=bg\|en`) |
| GET | `/api/public/assessments/{key}` | localized questions, options and ranges (no points or weights); 404 `assessment_not_found` |
| POST | `/api/public/assessments/{key}/score` | `{schema_version, definition_version, locale, answers, save}` → localized result; with `save: true` also a secret link token (only its SHA-256 hash is stored; expires). 409 `assessment_version_outdated` (current version in `errors[0].message`), 422 `assessment_invalid_answers` (`errors[].field` = `answers.<question>`, `type` = missing_required, unknown_question, invalid_type, invalid_option, out_of_range, too_many_selections, duplicate_selection, inconsistent) |
| POST | `/api/public/assessments/results/lookup` | `{token}` → the saved result, re-scored with its own definition version; 404 `assessment_result_not_found` |
| POST | `/api/public/assessments/results/delete` | `{token}` → 204; deletes the saved result (idempotent) |
| POST | `/api/public/assessments/results/report` | `{token, format}` (`pdf` default \| `json`), `?locale=bg\|en` → the report of the saved result the token opens: `application/pdf` (`attachment; filename="doklad-ocenka.pdf"` / `"assessment-report.pdf"`, `no-store`, `nosniff`) or the same document as JSON for the HTML view. 404 `assessment_result_not_found`, 413 `report_too_large`, 503 `report_unavailable`; own limit `ASSESSMENT_REPORT_RATE_LIMIT` |
| POST | `/api/public/assessments/results/consultation` → 201 | optional: `{token, locale, name, email, company, message?, privacy_acknowledged: true, marketing_consent (default false), website (honeypot), form_token}` → `{reference, message}`; creates a lead (`source = engineering_assessment`) linked to the saved result. 409 `assessment_consultation_exists`, 400 `form_token_invalid` / `spam_suspected`; contact-form rate limit |

Results include `dimensions[].level` (maturity per area), `recommendations[]` with `kind` (`recommendation`,
`risk`, `quick_win`, `target_state`, `pattern`, `context`), `horizon` (30 \| 60 \| 90 \| null), `domains` and
`because` (the inputs or thresholds that triggered the finding), plus `roadmap`, `domains` and `inputs`
(each answer with its `evidence`: `practice`, `metric` or `context`).

## Public: service catalogue (read-only)

Published content only. Responses are built from the publication snapshots of published domains and
services; drafts, archived entries, unpublished edits, ids, revisions, lifecycle status and audit
data never appear. References to entries that are not published are left out.

* **Language:** `locale=bg|en`. Without it the `Accept-Language` header decides; anything else falls
  back to `bg`. There is no text fallback between languages; every published entry is complete in
  both.
* **Unknown query parameters** answer 422 `invalid_filter`. A typo never silently changes a result.
* **Rate limit:** `CATALOGUE_RATE_LIMIT` (120) per client address and `CATALOGUE_GLOBAL_RATE_LIMIT`
  (3000) for all clients, per `CATALOGUE_RATE_WINDOW_SECONDS` (60) → 429 `rate_limited`.
* **Caching:** `Cache-Control: public, max-age=60, stale-while-revalidate=300`, `Vary:
  Accept-Language` and a strong `ETag` (a hash of the response). `If-None-Match` with the same tag
  answers 304 without a body.
  * The API keeps the parsed snapshots in process. Each request checks the number of published
    entries and the latest publication time, so a publish or archive is served on the next request.
  * A shared cache may serve the previous version for up to 60 s, and for up to 5 more minutes while
    it revalidates.
* **Errors:** 404 `domain_not_found` / `service_not_found`; 422 `validation_error` (bad key, slug,
  enum, bounds) or `invalid_filter`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/public/catalogue/domains` | `{locale, items, total, limit, offset}`; `limit` 1–100 (default 50), `offset` ≥ 0. Order: band (AI systems, engineering and platforms, operations and advisory), then position, then key. Item: `key, code, band, icon, slug, alternate_slugs{bg,en}, name, summary, delivery_status` (highest family status), `service_count`. |
| GET | `/api/public/catalogue/domains/{key}` | Domain detail: the summary fields plus `body, cta_label, contact_service` (lead category for the contact form), `seo{title,description}, deliverables[], families[]` (`key, name, summary, delivery_status, prerequisite, services[], via[]`), `services[]` (published entries whose primary domain this is) and `related_domains[]`. |
| GET | `/api/public/catalogue/domains/by-slug/{slug}` | The same, by the slug **in the requested locale** (the other locale's slug → 404). |
| GET | `/api/public/catalogue/services` | `{locale, items, total, limit, offset}`; `limit` 1–100 (default 20). Filters: `domain` (key, repeat for OR; unknown → 422 `invalid_filter`), `offering_type` (`service`/`assessment`/`workshop`), `delivery_status` (`available`/`custom`/`planned`), `q` (substring of name or summary, ≤ 100). `sort=catalogue` (default): primary domain order, then type, position, key; `sort=name`: name in the locale, then key. Item: `key, offering_type, slug, alternate_slugs, name, short_name, summary, delivery_status, primary_domain{key,code,slug,name}, is_entry_offer, custom_page, duration{min_days,max_days}`. |
| GET | `/api/public/catalogue/services/{key}` | Service, assessment or workshop detail: the summary fields plus `body, seo, lead_category, capabilities[{title,description}], deliverables[], families[{key,name,domain}]` and `related{services, assessments, workshops}`. |
| GET | `/api/public/catalogue/services/by-slug/{slug}` | The same, by the slug in the requested locale. |
| GET | `/api/public/catalogue/services/{key}/related` | `{locale, key, related}`. The service's explicitly related entries, plus the published assessments and workshops of its primary domain. |

## Admin authentication

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | `{"email","password"}` → `acs_session` (HttpOnly, SameSite=Lax, Secure in production) + `acs_csrf` (SameSite=Strict) cookies. 401 `invalid_credentials`; 429 `rate_limited` from the per-IP/per-e-mail limiter **or** the persistent lockout (`LOGIN_LOCKOUT_THRESHOLD` consecutive failures → locked `LOGIN_LOCKOUT_MINUTES`). Unknown e-mails behave identically. |
| POST | `/api/admin/auth/logout` | Revokes the current session, clears cookies → 204 |
| POST | `/api/admin/auth/logout-all` | Revokes **all** sessions of the current admin → `{"sessions_revoked": n}` |
| GET | `/api/admin/auth/sessions` | Active sessions: `id, created_at, last_seen_at, expires_at, user_agent, current` |
| GET | `/api/admin/auth/me` | `{"user": {..., "role"}, "expires_at": ...}`; open to every staff role (also `logout`, `logout-all`, `sessions`) |

Every other `/api/admin/*` route requires the session cookie (401). `POST`/`PATCH`/`DELETE` additionally
require `X-CSRF-Token: <acs_csrf cookie value>` (403 `csrf_failed`) and a same-site `Origin` when one is sent.
Sessions expire after `SESSION_TTL_HOURS` (absolute) or `SESSION_IDLE_MINUTES` without activity.
Admin responses are `Cache-Control: no-store`.

## Admin: dashboard, audit, system, retention

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/dashboard/stats` | totals, new, last 7/30 days, open pipeline, won/lost, `by_status`, `by_service`, `by_inquiry_type`, `by_locale`, pending AI actions, recent activity |
| GET | `/api/admin/audit` | Paginated audit search → `{items,total,page,page_size}`. Query: `action`, `action_prefix` (e.g. `lead.`), `entity_type`, `entity_id`, `actor` (substring), `created_from`, `created_to`, `page`, `page_size` ≤ 200 |
| GET | `/api/admin/system/status` | environment, AI provider, e-mail enabled, retention, integration flags (never secrets) |
| GET | `/api/admin/retention` | Preview: `lead_retention_days`, `audit_retention_days`, `leads_due`, `audit_entries_due`, `lead_cutoff`, `audit_cutoff`, `advisor_retention_days`, `advisor_assessments_due`, `team_configuration_retention_days`, `team_configurations_due`. Changes nothing. |
| POST | `/api/admin/retention/run` | Body must be `{"confirm": true}` (else 422). Deletes expired leads/notes (readiness and team leads use their own retention), old audit entries, expired unlinked advisor assessments, saved team configurations and expired saved assessment results; audited as `retention.run` → `{"leads_deleted","audit_entries_deleted","advisor_assessments_deleted","team_configurations_deleted","assessment_results_deleted"}` |

## Admin: leads

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/leads` | Query: `status`, `service`, `inquiry_type`, `locale` (`bg`/`en`), `q` (name/company/e-mail, ≤ 100), `created_from`, `created_to` (ISO 8601), `sort` = `newest`/`oldest`, `page`, `page_size` ≤ 100. Items include `locale`. |
| GET | `/api/admin/leads/{id}` | Full lead incl. consents, quote fields, `submitted_service`, `locale`, `ai_managed` details (or `null`), notes, linked `advisor_assessment` (or `null`). Audited as `lead.viewed` (once per admin per 15 min). |
| PATCH | `/api/admin/leads/{id}` | `{"status"?, "service"?, "expected_status"?}` — at least one of status/service. Row-locked; with `expected_status` a stale update returns 409 `status_conflict`. Audits `lead.status_changed` / `lead.service_changed` with `from`/`to`. `submitted_service` is never changed. |
| POST | `/api/admin/leads/{id}/notes` | `{"body": "..."}` (1–4000) → 201, audited |
| DELETE | `/api/admin/leads/{id}` | GDPR erasure (lead + notes) → 204; audit keeps only id + reason |
| GET | `/api/admin/leads/{id}/audit` | Lead history |
| POST | `/api/admin/leads/{id}/ai/triage` | Read-only AI suggestion (mock provider by default); audited |
| GET | `/api/admin/leads/{id}/readiness-report` | PDF of a readiness submission (404 for other leads) |
| GET | `/api/admin/leads/{id}/team-report` | PDF plan of an AI team consultation (404 for other leads) |

## Admin: service catalogue

Editing, preview and publishing of the catalogue working copy. Model and lifecycle:
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) → "Service catalogue".

* **Authentication:** the existing staff session and CSRF rules apply.
* **Roles** (`admin_users.role`, set with `python -m app.cli set-role`). A role that does not allow an
  action answers 403 `forbidden_role`.
  * `viewer` reads.
  * `editor` also creates entries and saves drafts.
  * `admin` also publishes, archives and restores.
  * Every route outside the catalogue and the session endpoints requires `admin`.
* **Optimistic locking:** writes to an existing entry need `If-Match: "<revision>"`, the value of
  the `ETag` of the last read. A missing header answers 428 `precondition_required`; a stale
  revision answers 412 `revision_conflict`, with the current `ETag`.
* **Content rules:** every text is plain text. HTML tags, HTML entities, Markdown links,
  `javascript:`, `data:` and `vbscript:` URLs, control characters and bidirectional or zero-width
  characters are rejected (422 `validation_error`; field `type` = `markup` or `control_chars`).
* **Field errors** carry the full path, e.g. `translations.en.summary`, `capabilities.2.bg.title`,
  `related.0`, `service.primary_domain`.
* **Audit:** every write is audited: `catalogue.entity_created`, `_updated` (changed areas only, never
  texts), `_published`, `_archived`, `_restored`.
* Responses are `no-store`.

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | `/api/admin/catalogue/entities` | viewer | `{items,total,page,page_size}`; filters `type` (`domain`/`service`), `status`, `offering_type`, `domain` (key), `q` (name, slug or key; ≤ 100); `page`, `page_size` ≤ 100. Items: `id, type, key, status, offering_type, domain, name_bg, name_en, revision, published_revision, has_unpublished_changes, updated_at, published_at`. |
| GET | `/api/admin/catalogue/options` | viewer | the caller's `role`, domains and services for pickers, and `free_lead_categories` |
| POST | `/api/admin/catalogue/entities` | editor | `{key, offering_type, primary_domain?, lead_category?, name_bg, name_en}` → 201 draft. A `service` needs a primary domain and an unused lead category (`ServiceKey` except `other`). Assessments and workshops have no lead category. Domains cannot be created (fixed taxonomy). 409 `key_taken`. |
| GET | `/api/admin/catalogue/entities/{entity_id}` | viewer | Working copy: `translations{bg,en}` (`slug, name, short_name, summary, body, cta_label, seo_title, seo_description`), `capabilities[]` and `deliverables[]` (each item `{bg:{title,body}, en:{title,body}}`), `related[]` (keys), `service{…}` or `domain{code, band, icon, contact_service, families[]}`, `status, revision, published_revision, has_unpublished_changes`, and the caller's `permissions` (`edit`, `publish`, `archive`, `restore`). `ETag: "<revision>"`. |
| PATCH | `/api/admin/catalogue/entities/{entity_id}` | editor | Domains may also send `families`: the full ordered list of `{key, delivery_status, services[], via[], bg{name, summary, prerequisite}, en{…}}`. `key` is the local key (`[a-z][a-z0-9_]*`); a new key creates a family, a family left out is archived (it is excluded from snapshots and revived if its key comes back). Field errors look like `families.2.en.name`, `families.0.services.1`, `families.1.key` (`duplicate_key`). Publishing a domain needs a name and summary for every family in both locales, and a prerequisite for planned families. Saves the whole working copy (the body shape of the GET, minus read-only fields; lists are replaced in order). Drafts may be incomplete. The revision increases only when something changed. Archived entries → 409 `invalid_transition`; a slug in use → 422 `slug_taken`. The public API is unaffected until publishing. |
| GET | `/api/admin/catalogue/entities/{entity_id}/checks` | viewer | `{publishable, errors[{field,message,type}]}`: what blocks publishing |
| GET | `/api/admin/catalogue/entities/{entity_id}/preview` | viewer | The public detail (`?locale=bg\|en`) the working copy would have after publishing; 422 `catalogue_incomplete` with field errors if it could not be published |
| POST | `/api/admin/catalogue/entities/{entity_id}/publish` | admin | Publishes the working copy. Both locales must be complete: name, slug, summary, body and SEO texts; a short name for services; a CTA for domains; every list item; SEO title ≤ 60 (domains) or ≤ 70 (services); SEO description 120–160 (domains) or 70–175 (services). Otherwise 422 `catalogue_incomplete` with field errors. Archived → 409 `invalid_transition`. |
| POST | `/api/admin/catalogue/entities/{entity_id}/archive` | admin | Withdraws a service, assessment or workshop from the public API; 409 `domain_archive_not_allowed` for domains |
| POST | `/api/admin/catalogue/entities/{entity_id}/restore` | admin | Archived → draft (publish again to make it public) |
| DELETE | `/api/admin/catalogue/entities/{entity_id}` | admin | Deletes a service, assessment or workshop that was **never published** (status draft, no `first_published_at`) and that nothing links to → 204, audited `catalogue.entity_deleted`. Otherwise 409 `invalid_transition` (published, once published, or a domain) or `entity_referenced` (linked as related, from a family, or as a domain's contact service). Needs `If-Match`. The `delete` permission appears in `permissions` only when allowed. |
| GET | `/api/admin/catalogue/entities/{entity_id}/history` | viewer | The entry's audit entries, newest first (≤ 50) |

## Admin: staff and roles

Administrators only (`editor`/`viewer` → 403 `forbidden_role`). Accounts are still created with the
CLI; this API only changes roles. Responses are `no-store`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/staff` | `[{id, email, full_name, role, is_active, last_login_at, is_self}]`, sorted by e-mail (no password data) |
| PATCH | `/api/admin/staff/{user_id}` | `{"role": "admin" \| "editor" \| "viewer"}`. Revokes the person's sessions (the new rights apply immediately), audited `admin.role_changed` with the acting admin. 409 `own_role` for one's own account, 409 `last_admin` when it would leave no active administrator, 404 `staff_not_found`. |

## Admin: AI action approvals

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/ai/actions?status=PENDING` | Proposed agent actions |
| POST | `/api/admin/ai/actions/{id}/decision` | `{"decision": "approve" \| "reject", "comment"?}`; 409 `already_decided` |

## AI operations (staff-only scaffold)

Design, isolation and RBAC: [AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md).

* **Authentication:** every route requires the admin session (401). Writes also require
  `X-CSRF-Token` (403 `csrf_failed`).
* **Membership:** routes under `/organizations/{org}` resolve the caller's membership. With no
  membership, the answer is 404 `ops_not_found`, the same as for a missing organisation.
* **Permissions:** a member without the permission gets 403 `ops_forbidden`. Writes to a suspended
  organisation get 403 `ops_suspended`.
* **Responses** are `no-store`.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/api/ops/organizations` | session | the caller's organisations with their role |
| GET | `/api/ops/organizations/{organization_id}` | `org.read` | overview: organisation, role, permissions, workspace count, agents by status, `telemetry.connected=false` |
| GET | `/api/ops/organizations/{organization_id}/workspaces` | `workspaces.read` | workspaces |
| POST | `/api/ops/organizations/{organization_id}/workspaces` | `workspaces.write` | create a workspace → 201; 409 `ops_conflict` |
| GET | `/api/ops/organizations/{organization_id}/agents` | `agents.read` | agent registry; query `workspace_id`, `status` |
| POST | `/api/ops/organizations/{organization_id}/agents` | `agents.write` | register an agent → 201. 404 if the workspace belongs to another organisation; 422 for secret-like text or invalid identifiers; 409 duplicate key |
| PATCH | `/api/ops/organizations/{organization_id}/agents/{agent_id}` | `agents.write` | update name, status, provider, model, version, purpose; audited |
| GET | `/api/ops/organizations/{organization_id}/members` | `members.read` | members with role |
| POST | `/api/ops/organizations/{organization_id}/members` | `members.write` + rank rule | add an existing staff user by e-mail → 201. 404 `ops_user_unknown`; 409 when already a member |
| PATCH | `/api/ops/organizations/{organization_id}/members/{membership_id}` | `members.write` + rank rule | change a role. 409 `ops_last_owner` |
| DELETE | `/api/ops/organizations/{organization_id}/members/{membership_id}` | `members.write` + rank rule | remove a member → 204. 409 `ops_last_owner` |
| GET | `/api/ops/organizations/{organization_id}/audit` | `audit.read` | this organisation's `ops.*` audit entries (`limit` ≤ 200) |

## Executed example

`scripts/demo-lead-flow.ps1` performs the complete path (invalid submit → valid submit → PostgreSQL row →
anonymous 401 → login → find/view → status change without CSRF (403) → with CSRF (200) → stale update (409) →
audit trail via API and SQL) against the running stack. See the recorded output in
[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
