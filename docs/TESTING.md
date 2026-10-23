# Testing

All suites run in Docker; no local Node or Python is needed.

```powershell
.\scripts\test.ps1                 # api + web + e2e
.\scripts\test.ps1 -Suite api      # docker compose --profile test run --rm --build api-tests  (+ ruff)
.\scripts\test.ps1 -Suite web      # docker compose --profile test run --rm --build web-tests
.\scripts\test.ps1 -Suite e2e      # docker compose up -d --build; docker compose --profile test run --rm --build e2e
.\scripts\test.ps1 -Suite audit    # pip-audit + npm audit --omit=dev
```

## Backend — Pytest (`apps/api/tests`)

Runs against a **real PostgreSQL** database `<POSTGRES_DB>_test`, created fresh per session and
migrated with Alembic (the same path production uses). Tables are truncated between tests.

| File | Covers |
| --- | --- |
| `test_health.py` | liveness, readiness (DB), request IDs, OpenAPI availability |
| `test_public_leads.py` | valid lead persisted with consents & IP hash; 11 invalid-input cases; Bulgarian messages; honeypot; form-token missing/forged/too fast/expired; link spam; per-IP and global rate limits; SQL-injection payload stored as plain text; no public lead listing |
| `test_admin_auth.py` | all 14 admin endpoints return 401 anonymously; cookie flags (HttpOnly, SameSite); token stored hashed; generic login errors + audit; login rate limit; CSRF missing/forged; logout revocation; expired session; deactivated user; forged cookie |
| `test_admin_leads.py` | pagination, sorting, filters, LIKE-wildcard escaping, invalid filters, details, status updates (all 6 statuses) with audit trail, notes, GDPR deletion without PII in audit, 404/422 ids, dashboard stats from real data, system status, audit endpoint |
| `test_security.py` | origin check, CORS preflight, 413 body limit, security headers, no-store caching, malformed JSON, production config refusal (placeholder secret, wildcard CORS, insecure cookies, non-https SITE_URL/CORS), DB errors without bound parameters, docs hidden + HSTS in production, Argon2id, password policy |
| `test_ai.py` | mock triage classification, urgency, PII redaction, provider fallback without key, approval policy for every action type, unknown actions fail closed, proposal/approval/rejection workflow + 409 |
| `test_units.py` | form-token lifecycle and tampering, link heuristic, sliding-window limiter |
| `test_migrations_and_retention.py` | `alembic check` (models = migrations), upgrade/downgrade round trip, 0001→0002 data migration (backfill), retention (dry run, deletion, audit purge), idempotent synthetic seed |
| `test_production_features.py` | CLI `set-password` (lockout cleared, sessions revoked, audited), quote requests (persistence, 9 invalid cases, required fields, honeypot, shared rate limit), error envelope codes + request id, persistent lockout (persistence across limiter reset, unknown-account parity, counter reset), idle-session revocation, logout-all + session list, service re-categorisation, optimistic concurrency (409), throttled `lead.viewed` audit, inquiry-type filter/stats, audit search (filters, pagination, wildcard escaping), retention preview + confirmed run, purge-synthetic, **full lifecycle visitor → admin → audit verified with raw SQL** |
| `test_ai_managed_and_locale.py` | AI Managed inquiry persisted with details + language + audit; default `bg`; invalid locale 422; details only for `ai_managed`; 5 malformed-detail cases (empty lists, unknown enum, unknown field `api_key`); secrets rejected in message/notes/provider with English message; `Accept-Language` selects error language (fallback `bg`); flat nested field names; admin filter by language/service, detail with `ai_managed`, `by_locale` stats; no public exposure; re-categorisation to `ai_managed`; bilingual mock triage; customer acknowledgement templates; **migration 0004** backfill (`locale = bg`) and downgrade re-categorisation |
| `test_advisor_english.py` | English templates cover every pattern with the same structure/approval flags; English demo output without Cyrillic and without financial claims; English description matched on both pages; English API response, disclaimer, notices and write-approval; unsupported locale 422; English claim/side-effect scrubbing; system prompt language and English option labels sent to the provider |
| `test_advisor.py` | AI advisor: demo mode labelling, all 11 output sections, determinism, no financial claims in demo output, storage opt-out, PII/link removal before storage, 11 invalid-input cases, form token, rate limit (invalid requests count), prompt-injection flagging and delimiter neutralising, invalid model output → 502 (6 cases), truncation of over-long output, removal of financial promises and links, forced human approval, provider error mapping (5 kinds), logs without description/output, structured-output schema compatibility, consultation link + admin view + audit flag, unknown/reused/expired ids ignored, cascade delete with the lead, retention; Anthropic adapter with a fake SDK client (request shape, no tools, refusal, truncation, invalid JSON, timeout/connection errors) |

Lint: `ruff check` (pyflakes, pycodestyle, isort, bugbear, pyupgrade, bandit-style `S` rules, simplify).

## Frontend — Vitest + Testing Library (`apps/web/src/**/*.test.ts(x)`)

| File | Covers |
| --- | --- |
| `lib/contact-validation.test.ts` | client validation rules mirror the API; payload normalisation |
| `components/contact/ContactForm.test.tsx` | accessible labels, service pre-selection, error display without submitting, successful submit payload + reference, server field-error mapping, 429 message |
| `content/content.test.ts` | per locale: 7 services + audit, keys match the API enum (incl. `ai_managed`), AI Managed packages without prices / unlimited / 24-7 / SLA, unique URL-safe slugs, unique titles/descriptions within length limits, complete service pages, no TODO / invented guarantees, legal texts marked as drafts |
| `lib/routing-and-seo.test.ts` | root redirect (default / cookie / invalid cookie, query kept), legacy 308 to `/bg`, `/en` rewrites and Bulgarian-segment redirects with query translation, admin guard, open-redirect protection, `localizePath` / `toPublicPath` / round trips, language-switcher mapping (services, articles, topics, query, fallbacks), canonical + hreflang + OG locale, sitemap completeness for both languages with reciprocal alternates, robots rules |
| `lib/i18n.test.ts` | identical key sets for site and admin dictionaries, no empty translations, **no Cyrillic in English UI/admin/content**, no raw keys, admin labels for every AI Managed option, placeholder filling; AI Managed form validation in both languages, credential detection, payload with `locale` and `ai_managed` only for that service |
| `components/advisor/AdvisorTool.test.tsx` | advisor validation helpers (required fields, links, exclusive "none", no personal-data fields in the payload, only `locale` added); demo notice before submit; errors without sending; full result with demo disclaimer and focus; consultation form pre-filled and sending `advisor_assessment_id`; timeout message |
| `content/seo-map.test.ts` | for **each locale**: keyword map: one page per primary keyword, no cross-page overlap, keyword in title, mapped paths in sitemap, unverified volume unless evidence; editorial integrity (categories, related services/articles, inline links, tables, unique service H2s, every article reachable); case-study publish guard; draft legal + thin topic pages excluded from sitemap |

The `web-tests` container also runs `next typegen && tsc --noEmit` and `eslint .` (Next core-web-vitals + TypeScript rules).

## End-to-end — Playwright (`apps/web/e2e`)

Runs in `mcr.microsoft.com/playwright` against the running stack (`http://web:3000`), Chromium desktop
and Pixel 7 emulation. Admin credentials come from `.env`.

| Spec | Journey |
| --- | --- |
| `public.spec.ts` | homepage hero/CTAs/7 services, navigation, all 8 service pages incl. AI Managed Services (status, unique titles, canonical, meta description, Service JSON-LD), security headers, robots/sitemap, 404, **no third-party requests** |
| `links.spec.ts` | crawls every sitemap URL and every internal link found — none may fail |
| `contact.spec.ts` | invalid form shows errors and sends nothing; server rejects invalid payloads; **quote request** (`?tip=oferta`) with structured fields; valid submission (with `?usluga=` pre-selection) returns a reference |
| `admin.spec.ts` | anonymous redirect to login; admin API 401 with `code` (GET, PATCH, retention run); wrong credentials; full flow: login → dashboard → search lead → change status → add note → reload persists → AI triage → **audit log shows the status change by the admin and the `lead.viewed` access** → logout → protected again |
| `mobile.spec.ts` | no horizontal overflow on 19 pages (BG and EN) at phone width; mobile menu; sticky quote bar (appears after scrolling, hides at the footer, absent on `/kontakti`, dismiss persists for the session); contact form usable |
| `seo.spec.ts` | crawls **every sitemap URL**: status 200, exactly one H1, unique title, description ≥ 70 chars, self-canonical, `og:title`, not `noindex`, valid JSON-LD; draft legal + thin topic pages are `noindex`; article features (key points, table, inline CTA, related services, `Article` JSON-LD); `/proekti` 404; quote CTA pre-fills the form; message helper + blur validation; nav `aria-current` |
| `i18n.spec.ts` | `/` → `/bg` by default and `/en` with the preference cookie; legacy 308 and `/en/<bg-segment>` 308 with query translation; English pages: `lang="en"`, no Cyrillic, no raw keys, self-canonical, reciprocal hreflang + `x-default`, `og:locale`; desktop switcher to the equivalent page + cookie; query preservation; mobile-menu switcher; English validation messages; API language by `Accept-Language`; English advisor demo output; AI Managed page in both languages (3 packages with custom-quote label, no prices/24-7/unlimited, no-SLA note, secrets warning, Service JSON-LD); **English AI Managed inquiry → admin (switched to English) shows language and AI details → admin switched back to Bulgarian**; credentials rejected client-side before sending |
| `advisor.spec.ts` | demo-mode journey: fill the advisor form → structured result with demo disclaimer and approval flags, no money/percentage figures → consultation linked to the assessment → admin sees `AI оценка #<ref>` on the lead; API rejects invalid input and personal-data fields; promo link from `/ai-resheniya` |

Lighthouse is not part of `test.ps1`; the method used for the lab measurements is described in
[SEO_IMPLEMENTATION.md §5](SEO_IMPLEMENTATION.md#5-performance-measurements-lab-only).

Notes:
* The contact form has an anti-bot timing check, so e2e waits 3.5 s before submitting.
* Each e2e run sends a random `X-Forwarded-For` so repeated runs do not exhaust the per-IP rate
  limit of the local stack (there is no reverse proxy locally). The global limit (60 / 10 min) still applies.
* HTML report: `apps/web/e2e/playwright-report/index.html`.

## Results

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for the last executed run. Never record a
suite as passing unless it was actually run.

## Scripted demonstration

```powershell
.\scripts\demo-lead-flow.ps1
```

Runs the complete lead lifecycle against the running stack through the public origin and prints PostgreSQL
rows for the lead and its audit events (see IMPLEMENTATION_STATUS.md for a recorded run).

```powershell
.\scripts\demo-advisor.ps1
```

Runs the AI advisor with synthetic data against the running stack (demo mode): validation, assessment,
prompt-injection and personal-data handling, non-storage, PostgreSQL rows, consultation linked to a lead,
admin view, retention preview and a log check (see [AI_ADVISOR.md](AI_ADVISOR.md)).

## Backup and restore check

```powershell
pwsh .\scripts\backup-db.ps1
pwsh .\scripts\restore-db.ps1 -File .\backups\<file>.dump   # destructive; asks for confirmation
```

The round trip (backup → new lead → restore → lead gone) was executed on a throw-away stack; see
[VERIFICATION_REPORT.md](VERIFICATION_REPORT.md).
