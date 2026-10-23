# Verification report — QA, application security and DevOps review

Date: 2026-10-23. Reviewer role: independent QA / AppSec / DevOps. Environment: Windows 11 Pro,
Docker Desktop 29.3.1 (Compose v5.1.1), PowerShell 7, images `python:3.13-slim`, `node:24-alpine`,
`postgres:17-alpine`, `mcr.microsoft.com/playwright:v1.64.1-noble`, `caddy:2.10-alpine` (parse only).

Everything marked **executed** was run during this review; nothing else is claimed. Nothing was
deployed, no domain or paid resource was created, no live account was changed.

## 1. Acceptance criterion

> The project runs locally and a test lead can be submitted, saved, viewed and updated through the admin dashboard.

**Met — executed twice:**

1. **Clean copy, fresh secrets:** the working tree without ignored files (no `.env`, no `node_modules`)
   was copied to a new folder and started as a separate Docker project (`COMPOSE_PROJECT_NAME=acs-verify`)
   with `setup.ps1` → `start.ps1` (healthy after 46 s with cached layers). `demo-lead-flow.ps1`:
   - invalid submission rejected (422),
   - valid lead stored (201),
   - visible in PostgreSQL,
   - anonymous admin access refused (401),
   - admin login with an HttpOnly session,
   - lead found and viewed,
   - status change refused without CSRF (403), accepted with CSRF (200), stale update rejected (409),
   - audit events `lead.created`, `lead.viewed` and `lead.status_changed` recorded.

   `test.ps1` on that copy: pytest 222, ruff clean, tsc/ESLint clean, Vitest 87, Playwright 31 — all passed.
2. **Existing stack:** Playwright `admin.spec.ts` performs the same path **through the admin UI**:
   login → dashboard → search → open lead → change status → note → reload persists → AI triage →
   audit log → logout.

## 2. Executed checks

| Area | Check | Result |
| --- | --- | --- |
| Repository | folder structure, tracked files, `.gitignore`/`.dockerignore` (`.env`, `node_modules`, reports, new `backups/`) | ok |
| Repository | env vars: 56 API settings vs `.env.example` vs compose vs `process.env.*` in the web app | 1 missing documented var (`ANTHROPIC_TIMEOUT_SECONDS`) → added; the others are internal or compose-provided |
| Repository | frontend ↔ backend: 21 API paths used by the web app vs generated OpenAPI | all exist |
| Repository | dead code / broken imports: `ruff` (F401 etc.), `tsc`, ESLint, unreferenced Python functions and single-use TS exports | none (only route handlers and exported types) |
| Backend | startup, PostgreSQL, migrations `0001→0003` on a fresh DB, `alembic current` = `0003 (head)` | ok |
| Backend | pytest (real PostgreSQL): lead submission, validation, auth, lockout, sessions, CSRF, origin, 401 on all admin routes, CRUD, retention, AI advisor, errors | **222 passed** |
| Backend | CLI on the fresh stack: `create-admin` (prompt twice: mismatch refused, match ok, weak password refused), `set-password`, `maintenance --dry-run` | ok |
| Frontend | `next typegen && tsc --noEmit`, `eslint .`, Vitest | 0 errors, 0 problems, **87 passed** |
| Frontend | production build (`next build` in Docker) | ok |
| Frontend | Playwright desktop + Pixel 7: every sitemap URL (H1, title, canonical, JSON-LD), all internal links, contact + quote forms, admin journey, advisor journey, 10 pages without horizontal overflow, mobile menu | **31 passed** |
| Frontend | API stopped: public pages still 200; proxy returns Bulgarian 502 after ~5 s; login page shows "API услугата не отговаря" and an error after submit | ok |
| Frontend | hot-reload mode `start.ps1 -Dev` | **bug found and fixed** (web changes were not picked up); API reload ok (2 s), web reload ok (~3 s) after the fix |
| Security | live probe through the running stack (13 checks): security headers web + API, no `X-Powered-By`, CORS preflight from a foreign origin refused / own origin allowed, cross-site POST → 403 `origin_rejected`, 70 KB body → 413, anonymous admin API → 401, admin page → login redirect, robots disallows `/admin` and `/api/` | 13/13 pass |
| Security | secrets: no secret-like env vars in the web container, no secret names in `.next` bundles, no keys/private keys/passwords in tracked files | ok |
| Security | dependency audit: `pip-audit -r requirements.txt`; `npm audit` (prod, all, e2e) | no known vulnerabilities |
| AI | mock mode without key (`mode: demo`, labelled), real provider optional (factory falls back to mock without key), key read only by API, output schema-validated, no tools / no side effects | tests + demo (see [AI_ADVISOR.md](AI_ADVISOR.md)) |
| DevOps | `backup-db.ps1` → new lead → `restore-db.ps1 -Force` on the fresh stack | 12 → 13 → **12** leads, API healthy, schema `0003` |
| DevOps | `infra/backup-db.sh` (Git Bash against the local stack) | dump created and verified (8 tables) |
| DevOps | production override rendered with `docker compose … config` | only web published, on 127.0.0.1; `APP_ENV=production`, docs off, seed off, log rotation |
| DevOps | Caddyfile parsed with `caddy adapt` | ok (redundant directive removed, see L2) |

## 3. Security review summary

| Topic | Finding |
| --- | --- |
| SQL injection | All queries use the SQLAlchemy ORM with bound parameters; `LIKE` patterns are escaped (`_escape_like`); only raw SQL is `SELECT 1`. Test stores an injection payload as plain text. |
| XSS | React escapes all output; the only `dangerouslySetInnerHTML` is JSON-LD with `<` escaped. Names reject links/HTML; admin `website_url` links are validated `http(s)` with `rel="noopener noreferrer nofollow"`. AI output is rendered as text. |
| CSRF | Admin writes need the `X-CSRF-Token` header (double-submit, hashed server side) + SameSite=Lax cookies + Origin check on every unsafe `/api/*` request. |
| CORS | Explicit allow-list with credentials; `*` and (new) non-https origins refused in production. |
| Auth / sessions | Argon2id; opaque tokens stored as SHA-256; HttpOnly + SameSite (+ Secure in production); absolute TTL 8 h + idle 60 min; persistent lockout after 5 failures; logout-all; generic errors; constant-time dummy hash. |
| Secrets | `.env` git- and docker-ignored, generated by `setup.ps1`; API key only in the API container. |
| Sensitive logging | Request logs contain method/path/status only; advisor logs metadata only. **Fixed M1:** database errors could include bound parameters (lead data) → `hide_parameters=True`. |
| API permissions | Every `/api/admin/*` route depends on `require_admin` (parametrised 401 test). Single admin role (M8). |
| Rate limiting | Contact, quote, login, advisor: per client + global. In-memory; client IP from `X-Forwarded-For` — safe behind Caddy, spoofable if the web port is exposed directly (M6). |
| Dependencies | Exact pins; audits clean. |
| Data retention | Leads 730 d, audit 1095 d, advisor assessments 30 d, sessions; CLI + admin panel; erasure per lead incl. linked assessments. |

## 4. Issues

### Critical
None found.

### High
| # | Issue | Status |
| --- | --- | --- |
| H1 | A fresh clone with a new `.env` on a machine that already has the `ai-commerce-studio_pgdata` volume cannot start: PostgreSQL keeps the old password, the API restarts endlessly (`password authentication failed`) and `start.ps1` only reported a timeout. Reproduced. This is exactly the move to `D:\Projects\AI-Commerce-Studio`. | **Fixed:** `start.ps1` detects it and explains the two remedies; INSTALL_WINDOWS §2 documents copying `.env` or backing up and recreating the volume. |
| H2 | No database backup or restore tooling (local or production). | **Fixed:** `scripts/backup-db.ps1` (verified dump, rotation), `scripts/restore-db.ps1` (confirmation, stop/drop/restore/start), `infra/backup-db.sh` (cron, off-site hook). Round trip executed. |

### Medium
| # | Issue | Status |
| --- | --- | --- |
| M1 | Unhandled database errors are logged with tracebacks; SQLAlchemy includes bound values (names, e-mails, messages) in the message. | **Fixed:** `create_engine(..., hide_parameters=True)` + test. |
| M2 | Docker's json-file logs had no rotation (unbounded disk use locally and in production). | **Fixed:** 5 × 10 MB per container in `docker-compose.yml` (inherited by the production override); Caddy log rotation in the example. |
| M3 | Production validation accepted `SITE_URL` and `CORS_ORIGINS` on plain `http://`. | **Fixed:** refused in production + tests. |
| M4 | No way to recover a forgotten admin password or clear a lockout except deleting the database. | **Fixed:** `python -m app.cli set-password --email …` (hidden prompt, clears lockout, revokes sessions, audited `admin.password_reset`) + test; `create-admin` now asks twice. |
| M5 | Hot-reload mode did not reload web changes on Windows (Turbopack ignores `WATCHPACK_POLLING`). | **Fixed:** `watchOptions.pollIntervalMs` enabled only via `NEXT_DEV_POLL_MS` in `docker-compose.dev.yml`; verified. |
| M6 | Rate limiting trusts `X-Forwarded-For` and lives in memory: without the reverse proxy a client can rotate the header (global caps still apply); counters reset on restart; one API instance only. | Remaining — by design for V1; documented in SECURITY.md / DEPLOYMENT.md (Caddy replaces the header). Redis-backed limiter needed before scaling. |
| M7 | Web CSP allows `'unsafe-inline'` scripts (Next.js inline bootstrap without nonces). | Remaining — nonce-based CSP requires dynamic rendering of every page; trade-off documented. |
| M8 | Single administrator role: every admin can view all personal data, delete leads and run retention. | Remaining — acceptable for a small team; all actions audited. Roles are a roadmap item. |
| M9 | Legal texts are drafts; company and contact details are placeholders. | Remaining — owner action (legal review); pages are `noindex` meanwhile. |

### Low
| # | Issue | Status |
| --- | --- | --- |
| L1 | `ANTHROPIC_TIMEOUT_SECONDS` missing from `.env.example`. | Fixed |
| L2 | Caddy example used a redundant `header_up X-Forwarded-For` (Caddy ≥ 2.5 already replaces it) and had no access-log rotation. | Fixed; parsed with `caddy adapt` |
| L3 | Bootstrap admin password could stay in a production environment indefinitely. | Fixed: warning on start in production; docs recommend `create-admin` |
| L4 | E2E runs add test leads (`@example.com`) to the local development database. | Remaining — documented; delete via admin UI or reset the volume |
| L5 | Uvicorn runs with `--forwarded-allow-ips='*'`. | Remaining — API is reachable only from the web container in production; client IP logic does not rely on it |
| L6 | Rotating `SECRET_KEY` does not end admin sessions (token hashes are unkeyed). | Remaining — documented (use logout-all) |
| L7 | When the API container is stopped, the proxy needs ~5 s (Docker DNS) before answering 502. | Remaining — cosmetic |
| L8 | `create-admin`/`set-password` show "input may be echoed" when run with `exec -T`. | Remaining — documented: run without `-T` |

## 5. Not verified

* Real Anthropic API calls (no key) and real SMTP delivery (not configured) — only the mock/skip paths.
* The non-Docker workflow (no Node.js / Python 3.13 on the machine).
* Production deployment, DNS, certificates, Caddy at runtime, off-site backups, monitoring — prepared
  only ([DEPLOYMENT.md](DEPLOYMENT.md)).
* Browsers other than Chromium; screen readers (accessibility is covered by Lighthouse 100 and tests only).
* Load/performance under concurrency.

## 6. Files changed in this review

* Backend:
  * `apps/api/app/db.py` — `hide_parameters`
  * `apps/api/app/config.py` — https checks in production
  * `apps/api/app/cli.py` — `set-password`, confirmed prompts, production warning
* Backend tests:
  * `apps/api/tests/test_security.py` — https rules and `hide_parameters`
  * `apps/api/tests/test_production_features.py` — CLI password reset
* Frontend:
  * `apps/web/next.config.ts` — dev polling
  * `apps/web/src/lib/admin-labels.ts` — new audit action label
* Infrastructure:
  * `docker-compose.yml` — log rotation
  * `docker-compose.dev.yml` — `NEXT_DEV_POLL_MS`
  * `infra/reverse-proxy/Caddyfile.example`
  * `infra/backup-db.sh` (new)
* Scripts:
  * `scripts/start.ps1` — volume/password hint
  * `scripts/backup-db.ps1` (new)
  * `scripts/restore-db.ps1` (new)
* Configuration: `.env.example`, `.gitignore` (`backups/`)
* Documentation:
  * `docs/INSTALL_WINDOWS.md` (rewritten)
  * `docs/DEPLOYMENT.md` (new)
  * `docs/VERIFICATION_REPORT.md` (new)
  * `docs/SECURITY.md`, `docs/DATABASE_SCHEMA.md`, `docs/TESTING.md`, `docs/IMPLEMENTATION_STATUS.md`, `README.md`
