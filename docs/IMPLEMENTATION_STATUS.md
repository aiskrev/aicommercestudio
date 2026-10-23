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
- Not a Git repository yet — run `git init` before the first commit (`.gitignore` is prepared).

## Exact next actions

1. Fill in real company details, contact e-mail/phone (`PUBLIC_CONTACT_EMAIL`, `PUBLIC_CONTACT_PHONE`) and have the legal drafts reviewed.
2. `git init` and commit; push to a private repository.
3. Choose hosting, set production `.env`, deploy with `infra/docker-compose.prod.yml` behind Caddy, schedule `app.cli maintenance` and backups.
4. Configure SMTP for lead notifications.
5. Continue with [ROADMAP.md](ROADMAP.md) V1.1.
