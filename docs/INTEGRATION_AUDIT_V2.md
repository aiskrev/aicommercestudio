# Integration and quality audit of the V2 platform

Date: 2026-11-03.

Scope:

* `main` @ `0b33ea9` (after PR #39);
* branch `feature/workshops-opportunities-audit`, which adds:
  * the Workshops & Advisory catalogue;
  * the opportunity, proposal and SOW workflow (migration `0014`);
  * the portal browser e2e;
  * the fixes listed below.

Environment:

* Windows 11 Pro with Docker Desktop;
* images `python:3.13-slim`, `node:24-alpine`, `postgres:17-alpine` and
  `mcr.microsoft.com/playwright:v1.64.1-noble`.

Every result below was produced by a command that was **actually run** during this audit (§4).
Anything not run is marked as such.

**Release posture.**

* Nothing was deployed and no production migration was applied.
* The audit brief said not to push. The owner's own instruction in the same message ("test, commit,
  push and PR") overrides that, so the branch is pushed and a pull request is opened. Nothing is
  merged.

## 1. Implemented capability matrix

| # | Area | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every public route in BG and EN | ✅ | `links.spec.ts` crawls every sitemap URL and every internal link; `seo.spec.ts` checks every sitemap URL (200, one H1, canonical); `i18n.spec.ts`; production build generated 257 static pages |
| 2 | Navigation, canonical URLs, sitemap, hreflang | ✅ | `routing-and-seo.test.ts`, `seo.spec.ts`, `i18n.spec.ts`, `ia.spec.ts`; workshops added to "Start here", the footer and the sitemap with reciprocal hreflang (`workshops.spec.ts`) |
| 3 | Ten service domains and the service pages | ✅ | `domains.test.ts`, `domains.spec.ts`, `public.spec.ts`; every hub and the service pages now list their workshops |
| 4 | Service catalogue publishing and administration | ✅ | `test_catalogue*.py`, `catalogue.spec.ts`, `catalogue-roles.spec.ts` |
| 5 | Advisor and Managed Services workflows | ✅ | `test_advisor*.py`, `test_ai_managed*.py`, `advisor.spec.ts`, `managed-services-v2.spec.ts` |
| 6 | Interactive tools and deterministic scoring | ✅ | golden vectors shared API = web (checked byte for byte by `scripts/test.ps1`), `readiness*.test.ts`, `roi.test.ts`, `finder.test.ts`, `tools.spec.ts`, `roi-finder.spec.ts` |
| 7 | All ten specialised assessments | ✅ | `test_assessments*.py`, `engine.test.tsx`, `assessment-consistency.spec.ts` (all eight engine flows end to end, now also checking the workshop links) |
| 8 | ROI formula correctness and methodology notes | ✅ | `roi.test.ts` (formulas, no double counting, worked steps, version), `roi-finder.spec.ts` |
| 9 | Report generation and access restrictions | ✅ | `test_readiness.py`, `test_team.py`, `test_assessments_v2.py` (token ownership, expiry, 401/404), `readiness-reports.spec.ts` |
| 10 | AI Team and Solution Builder | ✅ | `test_team.py`, `test_solution.py` (120 vectors), `team*.spec.ts`, `solution.spec.ts` |
| 11 | Reference scenarios and factual status labels | ✅ | `reference.test.ts` (fictional labels, none "configured"), `reference.spec.ts` |
| 12 | Lead qualification and proposal approval | ✅ new | `test_opportunities.py` (31 tests), `opportunity.test.tsx`, lead regression suites unchanged |
| 13 | Ops portal authorization and tenant isolation | ✅ | `test_ops_portal.py`, `test_ops_security.py`, `test_ops_*`, `ops-platform.spec.ts` |
| 14 | PostgreSQL RLS with a restricted role | ✅ with residual risk | `test_ops_security.py` runs as `acs_app_runtime` (NOLOGIN, NOBYPASSRLS). New: the runtime role has no privileges on lead tables (`test_runtime_role_cannot_read_lead_tables`). Residual: the app connects as the owner (§3, H-1) |
| 15 | Evaluation, versioning, incident and audit flows | ✅ | `test_ops_registry_evals.py`, `test_ops_observability_workflows.py`; append-only proposal versions (trigger test) |
| 16 | Client login isolation | ✅ off by default | `test_portal.py` (16 tests); **new browser e2e** `portal.spec.ts` passed on a portal-on stack (§4) |
| 17 | Data validation, privacy, retention | ✅ | strict schemas (`extra=forbid`) everywhere; secret detection; retention and erasure tests incl. the new cascade (`test_erasure_and_retention_remove_opportunity_data`) |
| 18 | Accessibility, keyboard, reduced motion | 🟡 | keyboard menus and focus (`ia.spec.ts`, `Header.test.tsx`), labelled controls in the new admin panels (tests query by label), one H1 per page. Reduced motion: CSS gates every animation behind `prefers-reduced-motion: no-preference` and has a `reduce` block, but **no automated test** checks it. Lighthouse was **not** run in this audit |
| 19 | Mobile layouts and horizontal overflow | ✅ | `mobile.spec.ts` (31 pages BG/EN at phone width), overflow checks in `domains`, `reference`, `workshops`, `founder` and `assessment-consistency` specs |
| 20 | Security and dependency audits | see §4 | `pip-audit` and `npm audit --omit=dev` (§4); security review in §3 |

## 2. Missing or incomplete features

| Item | State | Note |
| --- | --- | --- |
| Separate runtime **login** role for the API | missing | RLS applies inside `require()`-bound transactions only; prerequisite for any client release |
| Staff MFA | missing | staff sign-in is password + lockout + rate limits |
| Transactional e-mail | missing by decision | no invitation or notification e-mail; portal recovery is staff-assisted; no automated sending anywhere |
| CRM synchronisation | missing by decision | needs a separate approved integration task |
| LLM-backed proposal drafting | not built | drafts are deterministic; an LLM drafter must keep the same rules (ADR-44) |
| Four-eyes approval of proposals | not enforced | single administrator today; documented in OPPORTUNITY_WORKFLOW.md |
| Engineering articles | none yet | four topics exist, empty and `noindex` (C-5) |
| Telemetry ingestion (OpenTelemetry) | design only | AI_OBSERVABILITY.md |
| Real evaluation runner | not built | evaluations are simulated and labelled |
| Redis rate limiter, job queue | not built | single API instance only |
| Production deployment, backups, uptime monitoring | not done | DEPLOYMENT.md, owner decisions |
| Portal browser e2e in CI | not in CI | CI keeps the portal off, so `portal.spec.ts` is skipped there. It was run locally on a portal-on stack |

## 3. Security findings by severity

No **critical** finding was found.

| ID | Severity | Finding | State |
| --- | --- | --- | --- |
| H-1 | High (blocks a client release) | The API connects to PostgreSQL as the schema owner and switches to `acs_app_runtime` per tenant-bound transaction. Code that reads tenant tables outside `require()` would not be under RLS. Composite tenant foreign keys and the route-level tests are the second barrier. | open; portal off; prerequisite in CLIENT_PORTAL.md |
| H-2 | High (blocks a production launch) | No MFA for staff accounts (admin sessions reach all personal data). | open (P2) |
| M-1 | Medium | Migration `0013` granted `acs_app_runtime` full DML on **every** table, including `leads` and other personal-data tables (blanket GRANT and default privileges). The role is only used inside tenant-bound Ops transactions, but a bug there could have read enquiries. | **fixed** in `0014`: REVOKE ALL on the eight lead tables, covered by a test |
| M-2 | Medium | The rate limiter is in memory per process: limits multiply with more API instances. The account lockout itself is persistent. | open; single-instance deployment documented |
| M-3 | Medium | Proposal approval by the same person who wrote the latest version is allowed (one administrator). | accepted for now; documented, easy to tighten |
| M-4 | Medium (operational) | Migration `0013` needs `CREATEROLE` for the migrating user the first time. A misconfigured production role could also have BYPASSRLS. | documented in SECURITY.md → Production checklist |
| L-1 | Low | Documentation drift: DATABASE_SCHEMA.md lacked migration `0013`; API_ARCHITECTURE_V2 said no route exists; PRODUCT_MODULES and SECURITY.md (the threat model said RLS was not enabled) were behind the code. | **fixed** |
| L-2 | Low | `ruff format` is not enforced repo-wide. Formatting the whole tree rewrites 38 files (Ruff *lint* is clean). | open (backlog) |
| L-3 | Low | No automated test for `prefers-reduced-motion`. | open (backlog) |
| I-1 | Info | Opportunity audit entries carry field names and statuses only (no names, no free text), verified by a test. | — |

**Areas reviewed with no finding:**

* CSRF on every admin and portal write;
* origin checks and CSP;
* SQL parameter binding;
* strict request schemas;
* secret detection in free text;
* separation of the portal and staff sessions;
* tenant taken only from the session;
* immutable versions and timelines (database triggers);
* no third-party requests from the public site;
* the protected founder portrait and contact details (tests green, files untouched).

## 4. Tests and checks executed (with results)

| Check | Command | Result |
| --- | --- | --- |
| Backend tests | `.\scripts\test.ps1 -Suite api` (pytest in Docker against PostgreSQL) | **847 passed** in 295.6 s |
| Backend lint | same suite, `ruff check` | **All checks passed** |
| Docs sync (OpenAPI, API reference routes, README links) | same suite, `scripts/docs_sync.py` | first run **failed** (new docs not yet linked from README, expected mid-work); re-run after the README update: see the last row |
| OpenAPI regeneration | `docs_sync.py --write` | 123 paths (117 before; 6 new path templates) |
| Parity checks (vectors, texts, catalogue seed, workshop keys API = web) | `.\scripts\test.ps1 -Suite web` | passed |
| Web typecheck, ESLint, Vitest | `.\scripts\test.ps1 -Suite web` | tsc and ESLint clean; **779 passed** (49 files) |
| Production Next.js build | `docker compose build web` | **succeeded**, 257 static pages |
| Alembic consistency | `test_migrations_and_retention.py` (models = migrations, upgrade/downgrade round trip incl. `0014`) | passed (part of the 847) |
| Portal browser e2e (portal on, local test stack) | Compose override `CLIENT_PORTAL_ENABLED=true`, `ops-create-org e2e-portal`, `npx playwright test tests/portal.spec.ts tests/ops-platform.spec.ts` | first run: the portal test **failed** on its own invalid demo-refusal payload (422 for a 1-character name instead of the expected 409), fixed; re-run **1 passed**. `ops-platform` staff flow **passed**; the portal-off test **skipped** (correct on that stack) |
| Full e2e (portal off, default) | the `test.ps1 -Suite e2e` steps (stack, staff role accounts, demo organisation, Playwright, desktop Chromium + mobile) | **176 passed, 2 failed, 1 skipped** (9.2 min). Skipped: `portal.spec.ts` (portal off, as designed). Failed, both test defects: `links.spec.ts` exceeded its 45 s timeout because the crawl now covers ≈ 300 pages (no broken link was reported); `workshops.spec.ts` expected three band links where the catalogue correctly shows two. Both fixed, and a hub/catalogue change was made (no "nothing published" next to workshops) |
| e2e re-run of the affected specs | rebuilt stack; `links`, `workshops`, `service-discovery`, `catalogue`, `domains` | **24 passed** |
| Dependency audit | `.\scripts\test.ps1 -Suite audit` (`pip-audit`, `npm audit --omit=dev`) | pip-audit: **no known vulnerabilities**; npm (production dependencies): **0 vulnerabilities** |
| Compose health and Alembic | `docker compose ps` after `up --wait`; `alembic heads` / `alembic current` in the API container | api, web and db **healthy**; single head **`0014`**, database at `0014` |
| Docs sync re-run | `python scripts/docs_sync.py` in `api-tests` (after the README update) | **docs in sync**: openapi.json, API_REFERENCE.md routes, README links |
| Lighthouse | — | **not run** in this audit |

## 5. Changed files (this branch)

* **API.**
  * New: migration `20261103_0014_opportunity_workflow.py`; `app/opportunities/{__init__,models,schemas,drafts,service}.py`; `app/routers/admin_opportunities.py`; `app/workshops.py`, `app/workshop_keys.json`; `tests/test_opportunities.py`.
  * Changed: `app/models.py` (`WorkshopKey`, `leads.workshop_key`); `app/schemas.py` (`workshop` on enquiries, `workshop_key` in admin output); `app/services/leads.py`; `app/main.py`; `tests/conftest.py`.
* **Web.**
  * Workshops: `lib/workshop-slugs.ts`, `lib/workshops.ts`, `lib/workshop-links.ts`, `lib/workshop-keys.json`, `lib/insight-topics.ts`, `content/{bg,en}/workshops.ts`, `components/workshops/WorkshopCards.tsx`, `app/[locale]/rabotni-sreshti/{page,[workshop]/page}.tsx`.
  * Integration: `DomainHub.tsx`, the service, tool, topic, scenario and industries pages, `sitemap.ts`, `Footer.tsx` (a link; `ContactDetails` untouched), `site-nav.ts`, `routes.ts`, `i18n/config.ts`, `content/index.ts`, `content/{bg,en}/{editorial,pages,tool-*}.ts`.
  * Contact: `ContactForm.tsx`, `ContactFormWithParams.tsx`, `contact-form-props.ts`, `kontakti/page.tsx`.
  * Admin: `components/admin/Opportunity.tsx`, `LeadDetail.tsx`, `lib/opportunity-types.ts`, `lib/admin-types.ts`, `i18n/admin/{bg,en}.ts`.
  * Tests: `lib/workshops.test.ts`, `components/admin/opportunity.test.tsx`, `ContactForm.test.tsx`; e2e `workshops.spec.ts`, `portal.spec.ts`, updated `assessment-consistency`, `tools` and `ops-platform` specs.
* **Scripts.** `scripts/test.ps1` (workshop-key parity).
* **Docs.**
  * New: OPPORTUNITY_WORKFLOW, ADR_INDEX, CLAUDE_IMPLEMENTATION_PROMPTS, this audit.
  * Updated: CONTENT_STRATEGY_BG_EN (§5.5, §5.6, C-5, C-6), INFORMATION_ARCHITECTURE_V2 (IA-D3), PRODUCT_MODULES, API_ARCHITECTURE_V2, DATABASE_SCHEMA, DATABASE_SCHEMA_V2, API_REFERENCE, openapi.json, SECURITY, TESTING, CLIENT_PORTAL, ROADMAP, README.

**Not touched:**

* the founder portrait;
* `lib/company.ts`;
* the founder profile content;
* the logo.

## 6. Database migration status

* **Single head: `0014`** (`0013` → `0014`). It is additive:
  * one nullable column (`leads.workshop_key`);
  * three tables;
  * one trigger function;
  * REVOKEs for the runtime role.
* `models = migrations` and the upgrade/downgrade round trip pass in the test database.
* Applied only to the local and test databases. **Not applied to production.**
* **Before production:**
  * apply `0013` first (it needs `CREATEROLE` once);
  * then `0014`, which takes an `ACCESS EXCLUSIVE` lock on `leads` only for the `ADD COLUMN` and the
    CHECK.

## 7. Rollback recommendations

* **Application.** Redeploy the previous images. The new web routes and the admin panels go away.
  Leads with a `workshop_key` keep working: older code ignores the column.
* **Database.**
  * `alembic downgrade 0013` drops the three opportunity tables (**their data is lost**: export
    `lead_opportunities`, `lead_proposals` and `lead_proposal_versions` first if any are in use),
    drops `leads.workshop_key` and restores the runtime role's earlier grants.
  * Leads themselves are untouched.
* **Content.** The workshop pages are static. Removing them needs a 410 or a redirect only if they
  were indexed. The engineering topics are `noindex`.
* **Portal.** It stays `CLIENT_PORTAL_ENABLED=false`; nothing to roll back.

## 8. V2 document map

Each requested document either exists, or the authoritative existing document is named. No
conflicting copy was created.

| Requested | Authoritative document | Audit result |
| --- | --- | --- |
| PLATFORM_VISION | PLATFORM_VISION.md | current (strategy; decisions D1–D7 open) |
| SERVICE_TAXONOMY | SERVICE_TAXONOMY.md | current |
| INFORMATION_ARCHITECTURE_V2 | INFORMATION_ARCHITECTURE_V2.md | updated: workshops route live, IA-D3 decided |
| PRODUCT_MODULES | PRODUCT_MODULES.md | updated: reference library, workshops, opportunities, Ops platform, staff roles, portal status |
| SERVICE_CATALOGUE_ARCHITECTURE | SERVICE_CATALOGUE_ARCHITECTURE.md | current |
| ASSESSMENT_PLATFORM_ARCHITECTURE | ASSESSMENT_PLATFORM_ARCHITECTURE.md | current |
| AI_ADVISOR_V2 | AI_ADVISOR_V2.md | current |
| AI_MANAGED_SERVICES_V2 | AI_MANAGED_SERVICES_V2.md | current |
| AI_OPERATIONS_CONSOLE_V2 | **AI_OPERATIONS_PORTAL.md** (with AI_OBSERVABILITY.md, AI_OPERATIONS_RUNBOOK.md, CLIENT_PORTAL.md; AI_OPERATIONS_ARCHITECTURE.md is the superseded earlier target) | mapped, no copy |
| REFERENCE_SCENARIOS | **REFERENCE_CONTENT.md** | mapped, no copy |
| TARGET_ARCHITECTURE_V2 | **ARCHITECTURE.md** (current architecture and key decisions), **AI_OPERATIONS_PORTAL.md** (target Ops architecture), IMPLEMENTATION_DEPENDENCIES_V2.md (target phases) | mapped, no copy |
| DATABASE_SCHEMA_V2 | DATABASE_SCHEMA_V2.md (catalogue design), DATABASE_SCHEMA.md (authoritative, all migrations) | updated: status; `0013` and `0014` added to DATABASE_SCHEMA.md |
| API_ARCHITECTURE_V2 | API_ARCHITECTURE_V2.md (design), API_REFERENCE.md and openapi.json (authoritative) | updated: stale "no route exists" status corrected |
| SECURITY_THREAT_MODEL_V2 | **SECURITY.md** → Threat model (and §3 here) | updated for RLS, the portal and the opportunity workflow |
| OBSERVABILITY_STRATEGY | **DEPLOYMENT.md** → Monitoring (platform: health checks, JSON logs with request ids, uptime) and **AI_OBSERVABILITY.md** (AI systems) | mapped, no copy |
| TEST_STRATEGY_V2 | **TESTING.md** (layers, suites, CI, every test file) | updated with the new tests |
| CONTENT_STRATEGY_BG_EN | CONTENT_STRATEGY_BG_EN.md | updated: §5.5 workshops, §5.6 insights taxonomy, C-5, C-6 |
| IMPLEMENTATION_ROADMAP_V2 | **ROADMAP.md** and **IMPLEMENTATION_DEPENDENCIES_V2.md** | ROADMAP updated (V2 increments; P1–P4 status) |
| ADR_INDEX | ADR_INDEX.md | **new** (an index of the existing decisions) |
| CLAUDE_IMPLEMENTATION_PROMPTS | CLAUDE_IMPLEMENTATION_PROMPTS.md (with CLAUDE.md and docs/prompts/) | **new** |

## 9. Accessibility and SEO findings

* **Fixed.**
  * The workshop meta title was over 60 characters, and several descriptions were outside 120–160.
    They now meet the limits, and a test enforces them.
  * The engineering topic pages were created `noindex` and out of the sitemap from the start.
* **Verified.**
  * One H1 per page.
  * Self-canonical, reciprocal hreflang and JSON-LD without offers or ratings (`workshops.spec.ts`,
    `seo.spec.ts`).
  * The language switch keeps the page.
  * No overflow at 360 px.
  * The admin form controls are labelled, and the tests query them by label.
* **Open.**
  * No reduced-motion test (L-3).
  * Lighthouse not re-run.
  * Native-speaker review of the new BG/EN copy (C-1).
  * Keyword verification (C-4).

## 10. Launch-blocking issues

**For the public website:**

* the production deployment, backups and uptime monitoring;
* legal texts (drafts today);
* the company details;
* staff MFA (H-2).

**For the client portal (in addition):**

* a separate runtime login role (H-1);
* an external penetration test;
* transactional e-mail;
* a DPA and the privacy notice;
* explicit approval.

**Unresolved critical issues:** none.

## 11. Optional post-launch backlog

* Enforce `ruff format` in CI after a one-time formatting commit (L-2).
* Add a reduced-motion e2e check (L-3).
* Run the portal browser e2e in CI as a separate job with the portal on in an isolated stack.
* Four-eyes approval for proposals once there are two administrators.
* An LLM drafter for proposals behind the same rules, with an evaluation set.
* The first engineering articles (C-5).
* A Redis rate limiter.
* An OpenTelemetry gateway following the ingestion contract.
* A real evaluation runner.
