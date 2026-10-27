# API reference

Base path `/api`. From the browser use the website origin `http://localhost:3000/api/...` (same-origin
proxy); directly: `http://localhost:8000/api/...`.

* Interactive docs (development only): `http://localhost:8000/api/docs`
* Machine-readable spec: [`docs/openapi.json`](openapi.json) (OpenAPI 3.1, generated from the code with
  `docker compose --profile test run --rm -T api-tests python -c "import json; from app.main import app; print(json.dumps(app.openapi(), ensure_ascii=False, indent=2))" > docs/openapi.json`)

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
| 404 | `not_found`, `lead_not_found`, `action_not_found` | unknown route or resource |
| 409 | `status_conflict` | `expected_status` no longer matches (another admin changed the lead) |
| 409 | `already_decided` | AI action was already approved/rejected |
| 413 | `payload_too_large` | body > 64 KB |
| 422 | `validation_error` | see `errors` |
| 422 | `advisor_declined` | the AI model declined to assess the text |
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

`GET /api/public/readiness/meta`, `POST /api/public/readiness/report` (anonymous PDF, nothing
stored) and `POST /api/public/readiness/submissions` (optional hand-off to the team, creates a
lead); admins download a submission's PDF from `GET /api/admin/leads/{id}/readiness-report`.
Fields, limits and errors: [READINESS_REPORTS.md](READINESS_REPORTS.md#api).

## Admin authentication

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | `{"email","password"}` → `acs_session` (HttpOnly, SameSite=Lax, Secure in production) + `acs_csrf` (SameSite=Strict) cookies. 401 `invalid_credentials`; 429 `rate_limited` from the per-IP/per-e-mail limiter **or** the persistent lockout (`LOGIN_LOCKOUT_THRESHOLD` consecutive failures → locked `LOGIN_LOCKOUT_MINUTES`). Unknown e-mails behave identically. |
| POST | `/api/admin/auth/logout` | Revokes the current session, clears cookies → 204 |
| POST | `/api/admin/auth/logout-all` | Revokes **all** sessions of the current admin → `{"sessions_revoked": n}` |
| GET | `/api/admin/auth/sessions` | Active sessions: `id, created_at, last_seen_at, expires_at, user_agent, current` |
| GET | `/api/admin/auth/me` | `{"user": {...}, "expires_at": ...}` |

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
| GET | `/api/admin/retention` | Preview: `lead_retention_days`, `audit_retention_days`, `leads_due`, `audit_entries_due`, cut-off dates, `advisor_retention_days`, `advisor_assessments_due`. Changes nothing. |
| POST | `/api/admin/retention/run` | Body must be `{"confirm": true}` (else 422). Deletes expired leads/notes, old audit entries and expired unlinked advisor assessments; audited as `retention.run` → `{"leads_deleted","audit_entries_deleted","advisor_assessments_deleted"}` |

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

## Admin: AI action approvals

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/ai/actions?status=PENDING` | Proposed agent actions |
| POST | `/api/admin/ai/actions/{id}/decision` | `{"decision": "approve" \| "reject", "comment"?}`; 409 `already_decided` |

## Executed example

`scripts/demo-lead-flow.ps1` performs the complete path (invalid submit → valid submit → PostgreSQL row →
anonymous 401 → login → find/view → status change without CSRF (403) → with CSRF (200) → stale update (409) →
audit trail via API and SQL) against the running stack. See the recorded output in
[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
