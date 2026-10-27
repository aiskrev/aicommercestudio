# Platform baseline audit

**Audited state:** `origin/main` @ **`565d0b1`** ("Release report: AI operations work is now in main"),
2026-10-27. The working tree was byte-identical to that commit: no untracked files, no stashes.

**Method:** evidence from code first; documentation was treated as a claim to verify, not as a fact.
Everything under "Executed verification" was run during this audit, against this commit, in the
repository's own containers. No application code was changed. Nothing was merged, committed, pushed
or deployed.

## 1. Executed verification (this audit)

| Check | Command | Result |
| --- | --- | --- |
| Alembic heads | `docker compose --profile test run --rm --no-deps api-tests alembic heads` | single head **`0008`** |
| Alembic history | `... alembic history` | linear `<base> → 0001 → … → 0008` |
| Local dev database | `docker compose exec api alembic current` | `0008 (head)` |
| API tests and lint | `.\scripts\test.ps1 -Suite api` | **369 passed**, ruff clean |
| Web typecheck, lint and unit/UI tests | `.\scripts\test.ps1 -Suite web` | **461 passed** (27 files), tsc and ESLint clean |
| End-to-end | `.\scripts\test.ps1 -Suite e2e` (production build, desktop and mobile Chromium) | **84 passed** |
| Dependency audit | `.\scripts\test.ps1 -Suite audit` | pip-audit: no known vulnerabilities; npm audit (production deps): 0 |
| Branch integration | `git merge-tree --write-tree origin/main <branch>` for every remote branch | see §2 |

Not executed in this audit:

* GitHub Actions runs: the logs need a GitHub login.
* Lighthouse: last run 2026-10-27, recorded in `RELEASE_REPORT.md`.
* Production deployment: none exists.

## 2. Repository and branch state

| Branch (remote) | Ahead / behind `main` | Trial merge into `main` | Assessment |
| --- | --- | --- | --- |
| `feature/*` (ai-team-builder, readiness-reports, readiness-v2, roi-opportunities, solution-builder, team-costs, tools-hub, ai-operations-portal), `design/homepage-v3`, `design/interactions`, `design/system-v2`, `redesign/premium-ui`, `fix/team-test-focus-race`, `release/final-review` | 0–4 ahead | merged tree **identical** to `main` | content fully in `main` (merge or squash) |
| `design/premium-editorial-redesign` | 1 / 36 | 13 conflicts | **superseded:** its commit `68436d0` has a tree identical to `831fe81`, which is in `main`. Later work (design system v2, homepage v3) changed the same files. |
| `ci/phase-0-foundations` | 1 / 34 | 1 conflict (`docs/PLATFORM_EXPANSION_PLAN.md`) | **superseded:** `c28f47b` ≡ `2d3ed70` (in `main`) |
| `fix/restore-v1-logo` | 1 / 33 | 1 conflict (`docs/DESIGN_SYSTEM.md`) | **superseded:** `d8b166e` ≡ `3cb1dce` (in `main`) |

**No remote branch contains work that is missing from `main`.** The three conflicting branches must
not be merged: they would reintroduce older versions of files. They are candidates for deletion
(owner decision). Pull requests #1–#16 are closed.

Repository structure as found:

```
apps/api/                     FastAPI 3.13 service
  app/main.py                 app factory, routers, exception handlers
  app/config.py               pydantic-settings; production guards
  app/deps.py                 client IP, rate limit, admin session + CSRF (require_admin)
  app/middleware.py           request id, access log, security headers, origin check, body limit
  app/security.py             Argon2id, tokens, keyed IP hash
  app/audit.py                audit trail helper
  app/models.py               12 tables (SQLAlchemy 2)
  app/schemas.py              Pydantic models, secret/PII validators
  app/i18n.py                 BG/EN error and validation messages
  app/routers/                health, public, advisor, readiness, team, admin_auth, admin, ops
  app/services/               leads (search, retention), ai_actions (approval queue)
  app/advisor/                AI Business Automation Advisor: prompt, safety, service
  app/ai/                     provider abstraction (mock / Anthropic), approval policy
  app/readiness/              scoring (shared vectors), PDF report, texts
  app/team/                   team model, costs, pricing assumptions, plan, PDF report
  app/ops/                    tenancy, RBAC, schemas, CLI service (AI operations scaffold)
  app/integrations.py         connector protocols + "configured?" status only
  app/notifications.py        optional SMTP notification
  app/cli.py                  seed, create-admin, set-password, maintenance, purge-synthetic, ops-*
  alembic/versions/           0001 … 0008
  tests/                      16 pytest modules (real PostgreSQL)
apps/web/                     Next.js 16.4 (App Router, Turbopack), React 19.3, TS 6, Tailwind 4
  src/proxy.ts                locale routing (decideRoute)
  src/app/[locale]/…          public site, 23 page files
  src/app/admin/…             admin (separate root layout, noindex)
  src/app/api/[...path]/      same-origin proxy to the API
  src/app/{sitemap,robots,opengraph-image}.ts(x)
  src/i18n/                   locales, segment maps, UI dictionaries (site + admin)
  src/content/{bg,en}/        all page content (typed; EN typed as BG)
  src/lib/                    domain logic (ai-team, readiness, roi, finder, solution, agent-library, seo, tools …)
  src/components/             ui, layout, home, sections, editorial, tools/*, agents, advisor, contact, admin, seo
  e2e/                        Playwright (16 specs), Lighthouse harness (perf/)
infra/                        prod compose override, Caddyfile example, backup script
scripts/                      setup, start, stop, test, lighthouse, backup/restore, demos (PowerShell)
.github/workflows/            ci.yml (api, web + build, e2e), audit.yml (weekly)
docs/                         33 documents + prompts/
```

## 3. Capability inventory

Legend:

* **IMPLEMENTED:** code and tests exist and pass.
* **PARTIAL:** usable, but part of the stated scope is missing.
* **DOCUMENTED ONLY:** a design or plan exists, with no code.
* **NOT IMPLEMENTED:** neither code nor design.

### 3.1 Platform, infrastructure, quality

| Capability | Status | Evidence |
| --- | --- | --- |
| Docker Compose (db, api, web; test profile: api-tests, web-tests, e2e) | IMPLEMENTED | `docker-compose.yml`, `docker-compose.dev.yml` |
| Production override + Caddy TLS example | IMPLEMENTED (not deployed) | `infra/docker-compose.prod.yml`, `infra/reverse-proxy/Caddyfile.example`, `docs/DEPLOYMENT.md` |
| Migrations on start | IMPLEMENTED | `apps/api/Dockerfile` CMD (`RUN_MIGRATIONS_ON_START` → `alembic upgrade head` + seed) |
| CI (API, web + production build, e2e) and weekly audit | IMPLEMENTED (GitHub run results not verified here) | `.github/workflows/ci.yml`, `audit.yml` |
| Lighthouse lab harness | IMPLEMENTED | `scripts/lighthouse.ps1`, `apps/web/e2e/perf/lighthouse.mjs` (results git-ignored) |
| Backup and restore | IMPLEMENTED (scripts) | `scripts/backup-db.ps1`, `restore-db.ps1`, `infra/backup-db.sh` |
| Production hosting | NOT IMPLEMENTED | `DEPLOYMENT.md`: "prepared, not executed" |
| Shared rate limiter (Redis) and background queue | NOT IMPLEMENTED | `app/rate_limit.py` is in-memory, so a single API instance only |

### 3.2 Public website, localisation, design, SEO

| Capability | Status | Evidence |
| --- | --- | --- |
| BG/EN routing with localised slugs, 308 redirects, preference cookie | IMPLEMENTED | `src/proxy.ts`, `src/lib/locale-routing.ts`, `src/i18n/config.ts` (`EN_SEGMENTS`, `EN_SUBSEGMENTS` incl. `instrumenti`, `ai-agenti`), `LOCALE_COOKIE=acs_locale` |
| Content parity BG/EN | IMPLEMENTED | `content/en/*` typed as `typeof bg…`; `content/content.test.ts`, `lib/i18n.test.ts` |
| Services: 9 keys (`ai_agents`, `maintenance`, `seo`, `ai_tools`, `automation`, `analytics`, `integrations`, `ai_managed`, `audit`) | IMPLEMENTED | `content/bg/services.ts`; template `app/[locale]/uslugi/[slug]/page.tsx`; dedicated AMS page |
| Articles (6 per locale) and topic pages | IMPLEMENTED | `content/{bg,en}/articles*.ts`, `app/[locale]/statii/**` |
| Case studies | PARTIAL (framework only; no published studies) | `content/bg/editorial.ts` (`caseStudies = []`, `publishableCaseStudies`) |
| Premium-editorial redesign | IMPLEMENTED (in `main` as `831fe81`, evolved by `efb4759` design system v2, `4871b05` interactions, `29c06e1` homepage v3) | `app/globals.css` (`@theme` tokens: 61 `--color-*`), `components/ui/{primitives,patterns}.tsx`, `components/home/*` |
| Visual direction v3 "Signal" | PARTIAL | `docs/VISUAL_DIRECTION_V3.md`. Homepage v3 components exist (`SystemMap`, `ControlLanes`, `BuildBento`, `UseCaseLedger`, `HeroWorkflow`). Operational status tiles and "live" dashboard visuals were not built (correctly: there is no telemetry). |
| Logo (V1 monogram + gradient wordmark) | IMPLEMENTED (frozen by owner) | `components/layout/Logo.tsx`, `app/icon.svg` |
| Reduced motion | IMPLEMENTED | `app/globals.css` (`prefers-reduced-motion` gates and global reset) |
| SEO: metadata, canonical, reciprocal hreflang, x-default, sitemap with alternates, robots, OG image, JSON-LD (Organization, WebSite, Breadcrumb, Service, FAQ, Article) | IMPLEMENTED | `lib/seo.ts` (`buildMetadata`, `OG_IMAGE`), `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`; `e2e/tests/seo.spec.ts` |
| Security headers (CSP, XFO, COOP, Permissions-Policy, HSTS on API in prod) | IMPLEMENTED | `apps/web/next.config.ts`, `apps/api/app/middleware.py` |
| Legal pages | PARTIAL (drafts, `noindex`) | `content/{bg,en}/legal.ts`, `legal.isDraft` |
| Company details | NOT IMPLEMENTED (placeholders) | footer "Working name…"; `PUBLIC_CONTACT_*` env |

### 3.3 Interactive tools

| Tool | Status | Evidence |
| --- | --- | --- |
| Tool registry, feature flags, hub, service links | IMPLEMENTED | `lib/tools.ts` (7 tools, all `live`), `lib/feature-flags.ts` (all on, `TOOL_FLAGS` override), `app/[locale]/instrumenti/page.tsx` |
| AI readiness assessment (12 questions, 6 dimensions) | IMPLEMENTED | `lib/readiness.ts` + `readiness.vectors.json` (shared with API) |
| Readiness PDF report, optional submission → lead | IMPLEMENTED | `app/routers/readiness.py` (`/meta`, `/report`, `/submissions`), `app/readiness/report.py`. Lead `service=audit`, details in `leads.service_details`. |
| Build your AI team (configurator, architecture, costs, PDF, saved links, consultation) | IMPLEMENTED | `lib/ai-team.ts`, `app/routers/team.py` (`/meta`, `/estimate`, `/report`, `/configurations`, `/configurations/lookup`, `/submissions`), `app/team/*`, table `team_configurations` (0007) |
| AI ROI calculator | IMPLEMENTED (client-only) | `lib/roi.ts`, `components/tools/roi/RoiCalculator.tsx` |
| Automation Opportunity Finder | IMPLEMENTED (client-only) | `lib/finder.ts`, `components/tools/finder/OpportunityFinder.tsx` |
| AI Solution Builder | IMPLEMENTED (client-only, rule-based) | `lib/solution.ts`, `components/tools/solution/*` |
| AI Agent Library (index + 10 SSG pages) | IMPLEMENTED | `lib/agent-library.ts`, `lib/agent-slugs.ts`, `app/[locale]/ai-agenti/**` |
| Generic stored tool results (`tool_results` table, as planned) | DOCUMENTED ONLY (superseded) | `PLATFORM_EXPANSION_PLAN.md` §migrations. The implementation uses `leads.service_details` and `team_configurations` instead. |
| Optional AI step in the Solution Builder | DOCUMENTED ONLY | `PLATFORM_EXPANSION_PLAN.md` Phase 6b |
| Product analytics sink | PARTIAL | `lib/analytics.ts` emits allow-listed DOM events; no sink is registered (by design until consent tooling exists) |

### 3.4 AI Business Automation Advisor

| Capability | Status | Evidence |
| --- | --- | --- |
| Anonymous assessment, demo mode default, Anthropic optional | IMPLEMENTED | `app/routers/advisor.py` (`/status`, `/assessments`), `app/ai/factory.py` (mock unless `AI_PROVIDER=anthropic` + key; default model `claude-opus-5-5`) |
| Safety pipeline (injection patterns, PII redaction, link stripping, output validation) | IMPLEMENTED | `app/advisor/safety.py`, `app/ai/base.py::redact_personal_data`, `app/advisor/schemas.py` |
| Retention and lead linking | IMPLEMENTED | `advisor_assessments` (0003), `advisor.purge_expired` |

### 3.5 Leads, admin, security, audit, AI approvals

| Capability | Status | Evidence |
| --- | --- | --- |
| Contact and quote leads with form token, spam and secret checks, rate limit | IMPLEMENTED | `app/routers/public.py`, `app/spam.py`, `app/schemas.py::looks_like_secret` |
| Admin auth: Argon2id, opaque session (hash stored), CSRF, idle timeout, persistent lockout, logout-all | IMPLEMENTED | `app/deps.py::require_admin`, `app/routers/admin_auth.py`, `app/security.py` |
| Admin roles or MFA | NOT IMPLEMENTED | `admin_users` has no role or MFA columns. Every admin is equal. |
| Lead management (list, filter, detail, status with optimistic check, notes, delete, reports) | IMPLEMENTED | `app/routers/admin.py`, `components/admin/*` |
| Audit log (append-only, searchable, retention) | IMPLEMENTED | `app/audit.py`, `audit_logs`, `GET /api/admin/audit`, `components/admin/ActivityList.tsx` |
| AI lead triage (read-only suggestion) | IMPLEMENTED | `POST /api/admin/leads/{id}/ai/triage`, `app/ai/policy.py` (`CLASSIFY_LEAD` = low risk) |
| AI action approval queue | **PARTIAL** | `app/ai/policy.py` (9 action types, risk, `requires_approval`), `app/services/ai_actions.py` (`propose_action`, `decide`), `/api/admin/ai/actions`. Only the synthetic seed proposes actions. Nothing executes approved actions (`EXECUTED` is never set). No producer exists in production code. |
| GDPR retention (leads, audit, assessments, readiness, team configurations, sessions) | IMPLEMENTED | `python -m app.cli maintenance`, `app/services/leads.py::purge_expired`, admin retention panel |
| Seed data | IMPLEMENTED | `cli.py seed` (bootstrap admin; synthetic leads + 1 synthetic AI action only when `SEED_SAMPLE_DATA=true` and not production), `purge-synthetic`, `ops-seed-demo` (refused in production) |
| E-commerce / CRM integrations (Shopify, WooCommerce, CRM) | DOCUMENTED ONLY (protocols + "configured?" status) | `app/integrations.py` |
| E-mail notifications | PARTIAL (SMTP optional, no PII in e-mail) | `app/notifications.py` |

### 3.6 AI Managed Services and the AI Operations Portal

| Capability | Status | Evidence |
| --- | --- | --- |
| AMS public page, BG/EN, 8 operating areas, portal shown as *Planned* | IMPLEMENTED | `app/[locale]/uslugi/ai-managed-services/page.tsx`, `content/{bg,en}/ai-managed.ts` |
| AMS intake form → lead with `ai_managed` details | IMPLEMENTED | `components/contact/AiManagedFields.tsx`, `schemas.py::AiManagedDetails` |
| Tenancy: organisations, workspaces, memberships, roles | IMPLEMENTED (staff principals only) | `models.py` (`Ops*`), migration `0008` |
| Tenant isolation, application layer (membership resolution, foreign → 404, scoped queries) | IMPLEMENTED | `app/ops/tenancy.py` (`require`, `scoped`, `get_scoped`) |
| Tenant isolation, database layer: composite FK workspace ↔ organisation | IMPLEMENTED | `OpsAgent.__table_args__` (`fk_ops_agents_workspace_org`) |
| Tenant isolation, database layer: PostgreSQL RLS | DOCUMENTED ONLY | `AI_OPERATIONS_PORTAL.md` §3. It needs a non-owner DB role; today the app connects as the schema owner. |
| RBAC (owner, admin, operator, reviewer, viewer; 8 permissions; rank rules; last owner) | IMPLEMENTED | `app/ops/rbac.py`, `tests/test_ops_portal.py` |
| Agent registry (metadata), audited writes, org-scoped audit view | IMPLEMENTED | `app/routers/ops.py` (12 endpoints) |
| Staff UI (read-only) | IMPLEMENTED | `app/admin/(protected)/operations`, `components/admin/Operations.tsx` |
| Client accounts, invitations, MFA, client portal routes | DOCUMENTED ONLY | `AI_OPERATIONS_PORTAL.md` §9 MVP |
| Telemetry ingestion, runs and spans, costs, budgets, alerts, incidents, evaluations, review queues, reports | DOCUMENTED ONLY | `AI_OPERATIONS_PORTAL.md` §4–§8 |
| Secrets manager integration and ingestion keys | DOCUMENTED ONLY | same |

## 4. Reusable implementation patterns (copy these)

1. **Rule model in `lib/*.ts`, UI in `components/tools/*`, texts in `content/{bg,en}`.** The logic is
   pure, deterministic and versioned (`*_MODEL_VERSION`). Examples: `lib/solution.ts`,
   `lib/ai-team.ts`, `lib/roi.ts`.
2. **Shared golden vectors when the API and the web compute the same thing.**
   `readiness.vectors.json` and `team.vectors.json` are byte-compared in `scripts/test.ps1`.
3. **Versioned, enumerated share codes** (`encodeSolution`, `encodeTeam`) instead of free text in
   URLs. Saved links store only a SHA-256 token hash (`team_configurations.token_hash`).
4. **Typed BG content as the reference shape;** EN is `typeof bg…`, so a missing key is a type
   error. Errors use stable codes with BG/EN messages (`app/i18n.py`).
5. **Registry + feature flag + `dynamicParams=false`,** so unbuilt routes return 404
   (`lib/tools.ts`, `isToolAvailable`).
6. **API conventions.**
   * `StrictModel` (`extra=forbid`) and secret-like text rejection.
   * Rate limiting on every public POST.
   * `{detail, code, request_id}` errors.
   * `no-store` on sensitive GETs.
   * `audit.record(...)` in the same transaction as the change.
7. **Tenant access only through `require(permission)` and `scoped()`.** Foreign tenants get 404.
   Child tables use a composite FK to `(id, organization_id)`.
8. **Migrations.**
   * Hand-written and named by the naming convention.
   * Mirrored 1:1 by the models; `alembic check` and an upgrade/downgrade round trip run in the
     tests.
   * New tables only where possible.
9. **Tests per feature.**
   * Unit tests for the model.
   * Component tests with mocked `next/navigation`.
   * A Playwright spec for BG and EN, plus mobile and no-overflow checks.
   * Isolation and authorisation tests for anything tenant-scoped.

## 5. Architecture and integration risks

| # | Risk | Impact | Evidence |
| --- | --- | --- | --- |
| R1 | **The app connects to PostgreSQL as the schema owner,** so RLS cannot be enforced | Tenant isolation rests on application code alone | `docker-compose.yml` `DATABASE_URL` uses `POSTGRES_USER` |
| R2 | **Migrations run automatically on API start** | Deploying an image changes the production schema without a separate approval step | `apps/api/Dockerfile` CMD |
| R3 | In-memory rate limiter and lockout counters (partly), with no queue | No horizontal scaling and no background jobs (ingestion, alerts, scheduled reports) | `app/rate_limit.py` |
| R4 | Staff accounts are flat (no roles, no MFA) | The admin area cannot be split by duty. The ops RBAC applies only inside `/api/ops`. | `models.AdminUser` |
| R5 | `ops_memberships.user_id` → `admin_users` | Client principals need a schema change (principal type) before any client login | `models.OpsMembership` |
| R6 | Lead pipeline and operational data share one database and role | A breach or bug in one area reaches the other | single `DATABASE_URL` |
| R7 | The admin client bundle includes all public content (615 KB raw / 165 KB gzip) | Admin load time only | `lib/admin-labels.ts` imports `@/content` |
| R8 | Superseded branches with conflicting histories still exist on the remote | Accidental merge would revert newer work | §2 |
| R9 | Documentation drift (§6) | Future work planned against stale facts | §6 |
| R10 | `SITE_URL` is a **build-time** argument of the web image | A wrong value bakes wrong canonical, hreflang, OG and sitemap URLs into the build | `apps/web/Dockerfile` |

## 6. Contradictions between documentation and code

| Document | Claim | Code / fact |
| --- | --- | --- |
| `README.md` | Documentation table and CLI list are complete; "AI Operations Console (not implemented)" | Omits 13 documents (e.g. `TOOLS_PLATFORM`, `AI_OPERATIONS_PORTAL`, `RELEASE_REPORT`). CLI also has `set-password`, `purge-synthetic`, `ops-*`. A staff-only scaffold exists. |
| `IMPLEMENTATION_STATUS.md` (2026-10-24) | "Latest executed results": 245 API / 135 web / 44 e2e | This audit: 369 / 461 / 84 |
| `ARCHITECTURE.md` | Routers: `health`, `public`, `admin_auth`, `admin`; CLI: `seed`, `create-admin`, `maintenance` | 8 routers (adds `advisor`, `readiness`, `team`, `ops`); packages `advisor`, `readiness`, `team`, `ops`; more CLI commands |
| `INFORMATION_ARCHITECTURE.md` | Only the advisor exists; others "in preparation"; symbol `TOOL_ROUTES` | 7 live tools; the registry is `TOOLS` / `isToolAvailable`; `TOOL_ROUTES` does not exist |
| `PLATFORM_EXPANSION_PLAN.md` | Phases 1–5 unchecked; `0005_tool_results`, `ToolShell`, `content/*/agents.ts` | Phases 2–5 shipped. Migration 0005 is `ai_agents` service. `tool_results`, `ToolShell` and `content/*/agents.ts` do not exist (the design changed). `CapabilityMatrix` is already removed. |
| `ROADMAP.md` (2026-10-24) | "Next iteration — AI Operations Console" | Scaffold shipped; the tools are not mentioned |
| `SECURITY.md` (2026-10-24) | Threat model and controls | No mention of the tools APIs, tenancy, RBAC or `/api/ops` |
| `TESTING.md` (2026-10-24) | Test inventory and results | Omits `test_ops_portal.py`, `solution.spec.ts`, `operations.spec.ts`, `team*.spec.ts`, `roi-finder.spec.ts`; results outdated |
| `API_REFERENCE.md` | "All endpoints" | No `/api/ops/*` (12 endpoints) |
| `DATABASE_SCHEMA.md` | Per-table sections | No sections for `ops_*` (only the migration row) |
| `UI_REDESIGN_REPORT.md` | Editorial redesign "not committed… main still has the original design" | In `main` as `831fe81` since 2026-10-24 |
| `VISUAL_DIRECTION_V3.md` | "Status: proposal (no code changed)" | Partly implemented (interactions, homepage v3) |
| `AI_OPERATIONS_ARCHITECTURE.md` | Title "(not implemented)"; intro "Nothing here exists in the codebase yet" | A scaffold exists. A pointer to `AI_OPERATIONS_PORTAL.md` was added, but the title and intro still say "not implemented". |
| `docs/openapi.json` (found during P0) | "generated from the code" | **Not valid JSON:** 78 lines of Docker build output preceded the spec, and it predated the ops routes. The documented export command captured the build log. |
| `content/{bg,en}/legal.ts`, privacy policy draft (found during P0) | describes the data the site processes | Mentions the advisor, but not readiness submissions or saved AI team configurations, which both store data |

Documents verified as consistent with the code:

* `AI_OPERATIONS_PORTAL.md`
* `SOLUTION_BUILDER.md`
* `TOOLS_PLATFORM.md` (tool table)
* `TEAM_CONFIGURATOR.md`
* `ROI_AND_FINDER.md`
* `RELEASE_REPORT.md`, except that its LH numbers are from a separate run

These were spot-checked against routes, endpoints and tables.

### Resolution (P0 documentation sync, 2026-10-27)

**Resolved in the documents:**

* `README` (complete document index), `IMPLEMENTATION_STATUS`, `ROADMAP`, `ARCHITECTURE`,
  `INFORMATION_ARCHITECTURE`, `INTERNATIONALIZATION` (tool and agent URLs).
* `PLATFORM_EXPANSION_PLAN`: status note and checklist.
* `SECURITY` (tools, tenancy, retention settings), `TESTING` (every test module and spec),
  `API_REFERENCE` (every route), `DATABASE_SCHEMA` (`ops_*` tables, `ops.*` audit actions).
* Status notes on `UI_REDESIGN_REPORT`, `UI_IMPLEMENTATION_REPORT`, `UI_AUDIT`,
  `IMPLEMENTATION_REPORT`, `VISUAL_DIRECTION_V3` and `AI_OPERATIONS_ARCHITECTURE`.
* `docs/openapi.json` regenerated as valid JSON.

**Enforced by `scripts/test.ps1 -Suite api`** (and CI): `apps/api/scripts/docs_sync.py` fails when
`openapi.json` differs from the code, when `API_REFERENCE.md` is missing a route, or when the README
does not link a document.

**Still open:**

* The privacy-policy gap is a content and legal task, tracked in `SECURITY.md` and track T2.
* Deleting the superseded branches (owner).

## 7. Summary

The platform is a working, well-tested monolith. The public BG/EN site, seven interactive tools,
advisor, lead and admin pipeline, audit and retention, and a staff-only tenancy/RBAC scaffold are
**IMPLEMENTED**. The AI action approval queue and case studies are **PARTIAL**. Client access,
telemetry, alerting, integrations and RLS are **DOCUMENTED ONLY**.

All branch work is in `main`. The next generation is blocked by architecture prerequisites (R1–R5),
not by code debt. See [IMPLEMENTATION_DEPENDENCIES_V2.md](IMPLEMENTATION_DEPENDENCIES_V2.md).
