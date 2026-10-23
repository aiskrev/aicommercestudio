# Implementation status

Last updated: 2026-10-23. Environment: Windows 11 Pro, Docker Desktop 29.3.1 (Compose v5.1.1),
images `python:3.13-slim`, `node:24-alpine`, `postgres:17-alpine`, `mcr.microsoft.com/playwright:v1.64.1-noble`.

## Executed verification (actually run)

| Check | Command | Result |
| --- | --- | --- |
| Backend tests | `docker compose --profile test run --rm api-tests` | **121 passed** |
| Backend lint | `ruff check --no-cache .` | **0 issues** |
| Frontend typecheck | `next typegen && tsc --noEmit` | **0 errors** |
| Frontend lint | `eslint .` | **0 errors, 0 warnings** |
| Frontend unit/component | `vitest run` | **36 passed** (4 files) |
| Production build | `next build` (in Docker) | **succeeded**, 32 static routes |
| End-to-end | `docker compose --profile test run --rm e2e` | **18 passed** (desktop Chromium + Pixel 7) |
| Python dependency audit | `pip-audit -r requirements.txt` | **no known vulnerabilities** |
| npm dependency audit | `npm audit --omit=dev` | **0 vulnerabilities** |
| Stack health | `docker compose ps` | db, api, web **healthy** |
| Manual browser check | in-app browser at 1024 px and 375 px | home, service, contact, admin login/dashboard/leads/detail rendered; issues found were fixed (see below) |

## SEO, content and conversion (fourth iteration)

Full checklist, keyword map, indexation rules, editorial guidelines and lab performance:
[SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md).

Executed with `.\scripts\test.ps1` (all suites, exit code 0): **pytest 161 passed**, ruff clean,
`next typegen && tsc --noEmit` 0 errors, ESLint 0 problems, **Vitest 78 passed** (7 files, new
`seo-map.test.ts`), production image built, **Playwright 28 passed** (new `seo.spec.ts` crawls every
sitemap URL; sticky-quote-bar tests in `mobile.spec.ts`).

Lighthouse 13.5.0 (lab, 3 runs per page): SEO 100 and Accessibility 100 on all measured pages, CLS 0;
performance is unchanged within run-to-run variance (no improvement is claimed).

Bug found and fixed: client components compared `usePathname()` (which returns the internally
rewritten `/bg/...` path) with public URLs, so the header never marked the current page. Fixed with
`toPublicPath` / `usePublicPathname`.

Not verified: keyword search volume (no Keyword Planner / Search Console access), field Core Web Vitals,
rich-result eligibility in Google's Rich Results Test (JSON-LD is only checked for valid JSON and `@type`).

## Backend & admin production hardening (third iteration)

| # | Requirement | Implementation | Verified by |
| --- | --- | --- | --- |
| 1 | Persistent leads | PostgreSQL `leads` (+ notes, audit) | pytest (real PostgreSQL), demo SQL output |
| 2 | Alembic migrations | `0001` + `0002`; live dev DB upgraded `0001 → 0002` with 22 existing rows backfilled | `alembic check`, round trip, data-migration test, container log |
| 3 | Contact **and** quote API | `POST /api/public/leads`, `POST /api/public/quote-requests` (platform, budget, timeline, URL) | 13 quote/contact validation tests, e2e quote journey |
| 4 | Secure login/logout | Argon2id, generic errors, **persistent lockout** (5 failures → 15 min), logout, **logout-all** | lockout persistence + unknown-account parity tests |
| 5 | HTTP-only sessions | hashed opaque tokens, HttpOnly/SameSite cookies (Secure in prod), absolute TTL + **idle timeout**, session list | cookie flag, idle-revocation, logout-all tests |
| 6 | Protected routes | `require_admin` on every admin route; Next.js proxy + server-side layout check | 18 parametrised anonymous-401 cases, e2e |
| 7 | Dashboard filters/search | status, service, **inquiry type**, **date range**, text search, sort, pagination | API filter tests, e2e search |
| 8 | Pipeline | NEW→CONTACTED→QUALIFIED→PROPOSAL→WON/LOST, row lock + **`expected_status` (409)** | concurrency test, demo step 7 |
| 9 | Notes & history | notes + per-lead audit history in the UI | tests, e2e |
| 10 | Service categorisation | `service` (re-categorisable, audited) vs immutable `submitted_service`; AI suggestion can be applied with one click | re-categorisation test |
| 11 | Audit log | 20 action types incl. **`lead.viewed`** (personal-data access); filterable + paginated `GET /api/admin/audit`; activity page filters | audit search tests, e2e audit check |
| 12 | Configurable retention | `LEAD_RETENTION_DAYS`, `AUDIT_RETENTION_DAYS`; CLI + **admin preview / confirmed run** (audited) | retention API tests |
| 13 | Safe seeding | synthetic data only outside production; **`purge-synthetic`** | seed/purge tests |
| 14 | API errors + UI handling | uniform envelope `detail` / `code` / `request_id`; admin UI shows a support code, handles 409 with reload | error-code tests, unit tests |
| 15 | Rate limiting, anti-spam, authz tests | per-client + global limits, honeypot, signed timing token, link heuristic, CSRF, origin check | 40 new tests incl. negative authorization |
| 16 | Environment configuration | new: `SESSION_IDLE_MINUTES`, `LOGIN_LOCKOUT_THRESHOLD`, `LOGIN_LOCKOUT_MINUTES`; production validation | config tests |
| 17 | API + schema docs | `API_REFERENCE.md` (incl. error catalogue), generated `openapi.json`, `DATABASE_SCHEMA.md` (migrations, audit catalogue) | — |

Executed results: **pytest 161 passed**, ruff clean, **Vitest 55 passed**, tsc/ESLint clean,
**Playwright 19 passed** (incl. quote request and audit-event check in the UI).

### Demonstrated path (`.\scripts\demo-lead-flow.ps1`, executed against the running stack)

```
▶ 1. Visitor: invalid submission is rejected by server-side validation
  ✔ 422 validation_error: name, company, email, message, privacy_acknowledged
▶ 2. Visitor: valid submission (anti-bot timing token + 3.5 s like a human)
  ✔ 201 received, reference 637CD2CA
▶ 3. PostgreSQL: the lead is persisted
 reference | status |  service   | inquiry_type |        company
 637CD2CA  | NEW    | automation | contact      | Демо Поток 132145 ООД
▶ 4. Admin API is closed to anonymous users
  ✔ 401 unauthorized
▶ 5. Admin logs in (HTTP-only session cookie + CSRF token)
  ✔ logged in as admin@example.com; session cookie HttpOnly=True
▶ 6. Admin finds and views the lead
  ✔ found 1 lead: #637CD2CA · Демо Поток 132145 ООД · status NEW
▶ 7. Admin changes the status — without CSRF token it is refused
  ✔ 403 csrf_failed
  ✔ 200 status is now QUALIFIED
  ✔ stale concurrent update rejected: 409 status_conflict
▶ 9. PostgreSQL: lead status and audit events
  status QUALIFIED | status_changed t
  63 | lead.created        | website           | {"source": "website_contact_form", "service": "automation", ...}
  65 | lead.viewed         | admin@example.com | {}
  66 | lead.status_changed | admin@example.com | {"to": "QUALIFIED", "from": "NEW"}
```

No real e-mail sending, payments or customer-data transfers were added; SMTP and the Anthropic provider
remain disabled unless explicitly configured.

## UI/UX redesign (2026-10-23, second iteration)

Design system, header/navigation, homepage, service pages, process diagrams, FAQ, CTAs, contact-form
and admin states were redesigned — see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). API contracts, routes,
forms and authentication are unchanged (all API tests and e2e journeys pass unmodified except two
locators that were made stricter).

| Check | Result |
| --- | --- |
| `tsc --noEmit` | 0 errors |
| `eslint .` | 0 errors, 0 warnings |
| Vitest | **44 passed** (6 files; +8 new tests for header keyboard/focus/scroll-lock, button states, alert, timeline) |
| Playwright | **18 passed** (mobile-menu test strengthened: panel must be visible and > 300 px tall) |
| Pytest / Ruff | 121 passed / clean (backend untouched) |
| Production build | succeeded, 32 static routes |
| Manual browser check | hero, mega menu, services, problems→solutions, industries, process diagram, AI-control flow, service page, contact error state, mobile hero and menu |

Bug found and fixed during verification: the mobile menu panel was invisible because the header's
`backdrop-filter` created a containing block for the `position: fixed` panel. The previous e2e test
did not detect it (it clicked the footer link); the test now asserts the panel itself.

Not verified: the reduced-motion rendering was reviewed in CSS but not visually emulated; the
`::details-content` accordion animation only runs in browsers that support it (others open instantly).

## Acceptance criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Frontend starts locally | ✅ | web container healthy; all public routes 200 |
| 2 | Backend starts locally | ✅ | api container healthy (`/api/health/ready`) |
| 3 | PostgreSQL connects | ✅ | readiness check + tests against real PostgreSQL |
| 4 | Migrations execute | ✅ | container log `Running upgrade -> 0001`; `alembic check` + round-trip tests |
| 5 | Home and service pages render | ✅ | e2e `public.spec.ts` (all 7 service pages) |
| 6 | Contact form creates a DB record | ✅ | pytest `test_valid_submission_creates_lead`; e2e contact + admin search finds it |
| 7 | Invalid submissions rejected | ✅ | 11 parametrised API cases, unit tests, e2e |
| 8 | Unauthorized users cannot access admin | ✅ | 14 admin endpoints → 401; page redirect e2e |
| 9 | Admin login works | ✅ | pytest + e2e |
| 10 | Admin can view and update lead statuses | ✅ | pytest (all 6 statuses) + e2e |
| 11 | Works on mobile | ✅ | e2e mobile project (no overflow on 9 pages, menu, form) + manual check |
| 12 | No broken navigation links | ✅ | e2e crawler over sitemap + all internal links |
| 13 | Tests exist, results honest | ✅ | this document |
| 14 | Windows setup docs | ✅ | `INSTALL_WINDOWS.md`; `setup.ps1`, `start.ps1`, `test.ps1` executed in this environment |
| 15 | No production secrets / real data | ✅ | `.env` git-ignored and generated locally; demo data synthetic |

## Issues found during verification and fixed

- Tailwind `hidden` vs `inline-flex` conflict showed the header CTA on phones → moved visibility to a wrapper.
- Hero diagram: floating card overlapped nodes and side nodes were clipped → enlarged viewBox, moved nodes.
- Manrope's Bulgarian localized glyphs differed from body text → standard Cyrillic forms for headings.
- Admin lead filters overflowed at medium widths → responsive grid.
- Contact service `<select>` lost its arrow → added chevron.
- Next.js does not overwrite a client-supplied `X-Forwarded-For` → added a global contact rate limit and
  documented that the web container must sit behind the reverse proxy in production.

## Not verified / known limitations

- **Hot-reload mode** (`docker-compose.dev.yml`, `start.ps1 -Dev`) was written but not run in this session.
- **Production override** (`infra/docker-compose.prod.yml`) and the Caddy example were not deployed;
  production settings validation is covered by unit tests only.
- **Anthropic provider** is implemented with the official SDK (`anthropic==2.1.0`) but was not called
  (no API key). Only the mock provider was exercised.
- **SMTP notifications** were not tested against a real server (disabled by default; skip path tested via logs).
- **Non-Docker local workflow** (section 6 of INSTALL_WINDOWS.md) was not executed — the machine has no Node.js and only Python 3.9.
- The PowerShell API example in `API_REFERENCE.md` is illustrative and was not executed.
- Rate limiting is in-memory (single API instance); restarts reset counters.
- `eslint@10` triggers npm peer-dependency warnings from some plugins bundled in `eslint-config-next`
  (lint itself runs cleanly). ESLint 9 was avoided because it is end-of-life.
- Legal texts, company details and contact data are placeholders/drafts.
- The project lives in `D:\Projects\Site`; see INSTALL_WINDOWS.md §2 to move it to `D:\Projects\AI-Commerce-Studio`.
- `apps/web/node_modules` on the host was installed by a Linux container (used for tooling); run
  `npm ci` again if you later develop with a local Windows Node.js.

## Exact next actions

1. Fill in real company details, contact e-mail/phone (`PUBLIC_CONTACT_EMAIL`, `PUBLIC_CONTACT_PHONE`) and have the legal drafts reviewed.
2. Verify the SEO keyword map in Keyword Planner / Search Console ([SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md) §6).
3. Choose hosting, set production `.env`, deploy with `infra/docker-compose.prod.yml` behind Caddy, schedule `app.cli maintenance` and backups.
4. Configure SMTP for lead notifications.
5. Continue with [ROADMAP.md](ROADMAP.md) V1.1.
