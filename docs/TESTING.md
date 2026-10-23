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
| `test_security.py` | origin check, CORS preflight, 413 body limit, security headers, no-store caching, malformed JSON, production config refusal (placeholder secret, wildcard CORS, insecure cookies), docs hidden + HSTS in production, Argon2id, password policy |
| `test_ai.py` | mock triage classification, urgency, PII redaction, provider fallback without key, approval policy for every action type, unknown actions fail closed, proposal/approval/rejection workflow + 409 |
| `test_units.py` | form-token lifecycle and tampering, link heuristic, sliding-window limiter |
| `test_migrations_and_retention.py` | `alembic check` (models = migrations), upgrade/downgrade round trip, 0001→0002 data migration (backfill), retention (dry run, deletion, audit purge), idempotent synthetic seed |
| `test_production_features.py` | quote requests (persistence, 9 invalid cases, required fields, honeypot, shared rate limit), error envelope codes + request id, persistent lockout (persistence across limiter reset, unknown-account parity, counter reset), idle-session revocation, logout-all + session list, service re-categorisation, optimistic concurrency (409), throttled `lead.viewed` audit, inquiry-type filter/stats, audit search (filters, pagination, wildcard escaping), retention preview + confirmed run, purge-synthetic, **full lifecycle visitor → admin → audit verified with raw SQL** |

Lint: `ruff check` (pyflakes, pycodestyle, isort, bugbear, pyupgrade, bandit-style `S` rules, simplify).

## Frontend — Vitest + Testing Library (`apps/web/src/**/*.test.ts(x)`)

| File | Covers |
| --- | --- |
| `lib/contact-validation.test.ts` | client validation rules mirror the API; payload normalisation |
| `components/contact/ContactForm.test.tsx` | accessible labels, service pre-selection, error display without submitting, successful submit payload + reference, server field-error mapping, 429 message |
| `content/content.test.ts` | 6 services + audit, keys match the API enum, unique URL-safe slugs, unique titles/descriptions within length limits, complete service pages, no TODO / invented guarantees, legal texts marked as drafts |
| `lib/routing-and-seo.test.ts` | locale rewrite/redirect and admin guard decisions, open-redirect protection, canonical URLs, FAQ JSON-LD, sitemap completeness, robots rules |

The `web-tests` container also runs `next typegen && tsc --noEmit` and `eslint .` (Next core-web-vitals + TypeScript rules).

## End-to-end — Playwright (`apps/web/e2e`)

Runs in `mcr.microsoft.com/playwright` against the running stack (`http://web:3000`), Chromium desktop
and Pixel 7 emulation. Admin credentials come from `.env`.

| Spec | Journey |
| --- | --- |
| `public.spec.ts` | homepage hero/CTAs/6 services, navigation, all 7 service pages (status, unique titles, canonical, meta description, Service JSON-LD), security headers, robots/sitemap, 404, **no third-party requests** |
| `links.spec.ts` | crawls every sitemap URL and every internal link found — none may fail |
| `contact.spec.ts` | invalid form shows errors and sends nothing; server rejects invalid payloads; **quote request** (`?tip=oferta`) with structured fields; valid submission (with `?usluga=` pre-selection) returns a reference |
| `admin.spec.ts` | anonymous redirect to login; admin API 401 with `code` (GET, PATCH, retention run); wrong credentials; full flow: login → dashboard → search lead → change status → add note → reload persists → AI triage → **audit log shows the status change by the admin and the `lead.viewed` access** → logout → protected again |
| `mobile.spec.ts` | no horizontal overflow on 9 pages at phone width; mobile menu; contact form usable |

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
