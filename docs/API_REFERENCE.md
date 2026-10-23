# API reference

Base path `/api`. Through the website use `http://localhost:3000/api/...` (same-origin proxy);
directly: `http://localhost:8000/api/...`. Interactive OpenAPI docs: `http://localhost:8000/api/docs`
(development only; schema at `/api/openapi.json`).

Errors are JSON: `{"detail": "<Bulgarian message>"}`. Validation errors (422) add field details:

```json
{
  "detail": "Моля, коригирайте маркираните полета.",
  "errors": [{ "field": "email", "message": "Въведете валиден имейл адрес.", "type": "value_error" }]
}
```

Every response carries `X-Request-ID`. Bodies larger than 64 KB are rejected with 413.

## Health

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness → `{"status":"ok"}` |
| GET | `/api/health/ready` | Readiness incl. DB → 200 or 503 |

## Public

### `GET /api/public/form-token`
Returns a signed timing token for the contact form: `{"token": "1761200000.ab12cd34ef56.<sig>"}`.
A token is accepted only between `FORM_TOKEN_MIN_SECONDS` (3) and `FORM_TOKEN_MAX_AGE_SECONDS` (7200) after issue.

### `POST /api/public/leads` → 201
Rate limited: `CONTACT_RATE_LIMIT` per client per `CONTACT_RATE_WINDOW_SECONDS` (5 / 600 s) and
`CONTACT_GLOBAL_RATE_LIMIT` overall (60 / 600 s) → 429 with `Retry-After`.

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
  "form_token": "<from /form-token>"
}
```

| Field | Rules |
| --- | --- |
| service | one of `maintenance, seo, ai_tools, automation, analytics, integrations, audit, other` |
| name | 2–120 chars, no links/HTML |
| company | 2–160 chars, no links/HTML |
| email | valid address, ≤ 254, stored lower-case |
| phone | optional, `+?[0-9 ()-./]{6,40}` |
| message | 20–5000 chars, no control characters, ≤ 3 links |
| privacy_acknowledged | must be `true` |
| marketing_consent | optional boolean |
| website | honeypot — must be empty (if filled: fake 201, nothing stored) |
| unknown fields | rejected (422) |

Response: `{"status": "received", "reference": "3B78AEBC", "message": "Благодарим ви! …"}`.
400 is returned for an invalid/expired/too-fast token or link spam. Stored leads are never returned by public endpoints.

## Admin authentication

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/admin/auth/login` | `{"email","password"}` → sets `acs_session` (HttpOnly, SameSite=Lax) and `acs_csrf` (SameSite=Strict) cookies. 401 on failure (generic message), 429 when rate-limited (`LOGIN_RATE_LIMIT` per IP and per e-mail / 15 min). |
| POST | `/api/admin/auth/logout` | Revokes the session, clears cookies → 204 |
| GET | `/api/admin/auth/me` | `{"user": {...}, "expires_at": ...}` |

All other `/api/admin/*` endpoints require the session cookie (401 otherwise). `POST`, `PATCH` and
`DELETE` also require the header `X-CSRF-Token: <value of acs_csrf cookie>` (403 otherwise) and a
same-site `Origin` if one is sent. Admin responses are `Cache-Control: no-store`.

## Admin: dashboard & system

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/admin/dashboard/stats` | totals, new, last 7/30 days, open pipeline, won/lost, `by_status`, `by_service`, pending AI actions, recent activity |
| GET | `/api/admin/audit?limit=50` | latest audit entries (1–200) |
| GET | `/api/admin/system/status` | environment, AI provider, e-mail enabled, retention, integration configuration flags (never secrets) |

## Admin: leads

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/leads` | Query: `status`, `service`, `q` (name/company/email, ≤100 chars), `created_from`, `created_to` (ISO), `sort` = `newest`/`oldest`, `page` ≥1, `page_size` 1–100. → `{items,total,page,page_size}` |
| GET | `/api/admin/leads/{id}` | Full lead incl. consents and notes |
| PATCH | `/api/admin/leads/{id}` | `{"status": "CONTACTED"}` — audited (`from`/`to`) |
| POST | `/api/admin/leads/{id}/notes` | `{"body": "..."}` (1–4000 chars) → 201 |
| DELETE | `/api/admin/leads/{id}` | GDPR erasure (lead + notes) → 204 |
| GET | `/api/admin/leads/{id}/audit` | Lead history |
| POST | `/api/admin/leads/{id}/ai/triage` | Read-only AI suggestion: `suggested_service`, `priority`, `summary`, `suggested_next_step`, `signals`, `disclaimer`. 502 if the external provider fails. |

## Admin: AI action approvals

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/admin/ai/actions?status=PENDING` | Proposed agent actions |
| POST | `/api/admin/ai/actions/{id}/decision` | `{"decision": "approve" | "reject", "comment": "..."}`; 409 if already decided |

## Example (PowerShell — illustrative, not part of the automated tests)

```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Method Post http://localhost:3000/api/admin/auth/login -WebSession $s `
  -ContentType 'application/json' -Body '{"email":"admin@example.com","password":"<from .env>"}'
Invoke-RestMethod http://localhost:3000/api/admin/leads?status=NEW -WebSession $s
$csrf = ($s.Cookies.GetCookies("http://localhost:3000") | Where-Object Name -eq 'acs_csrf').Value
Invoke-RestMethod -Method Patch http://localhost:3000/api/admin/leads/<id> -WebSession $s `
  -Headers @{ 'X-CSRF-Token' = $csrf } -ContentType 'application/json' -Body '{"status":"CONTACTED"}'
```
