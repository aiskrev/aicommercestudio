# Platform expansion plan — audit and phased implementation

Date: 2026-10-24. Type: audit + plan only (no source code, dependency, migration or deployment
changes were made). Evidence: the checked-out repository at `68436d0`
(`design/premium-editorial-redesign`), whose tree is **identical to `origin/main` @ `831fe81`**
(`git diff 68436d0 origin/main` is empty). No production URL exists, so no live-site observations are
included.

---

## 1. Current-state architecture

### Repository and branches

| Item | State (evidence) |
| --- | --- |
| `origin/main` | `831fe81` — contains the bilingual platform, AI Managed Services, both UI redesigns (PR #1 merged `redesign/premium-ui`; `831fe81` = editorial redesign) |
| Local `main` | `40b03e0` — **stale**, 3 commits behind `origin/main`; update with `git switch main && git pull --ff-only` before new work |
| Feature branches | `redesign/premium-ui` (merged), `design/premium-editorial-redesign` (content merged as `831fe81`) — candidates for deletion after confirmation |
| CI | **None** — no `.github/` directory. All checks run locally through Docker (`scripts/test.ps1`) |
| Package managers | Web: **npm** (`apps/web/package-lock.json`, `apps/web/e2e/package-lock.json`, `npm ci` in Dockerfiles). API: **pip** (`requirements.txt`, `requirements-dev.txt`, `pyproject.toml` for ruff/pytest config). Node 24 images (`engines.node >= 20.9`), Python 3.13 image (`requires-python >= 3.12`) |

### Web (`apps/web`) — Next.js 16.4.2, React 19.3, TypeScript 6, Tailwind CSS 4

* **Routing:** `src/proxy.ts` + `src/lib/locale-routing.ts`. All public pages under `src/app/[locale]/`
  with Bulgarian folder names; English URLs are rewritten via `EN_SEGMENTS` in `src/i18n/config.ts`
  (`/en/services` → `/en/uslugi`). `/` → 307 to cookie preference or `/bg`; legacy unprefixed → 308.
* **Public routes:** home, `uslugi` (+ `[slug]`, `ai-managed-services`), `ai-resheniya`,
  `ai-automation-advisor`, `za-kogo`, `proces`, `za-nas`, `kontakti`, `statii` (+ `[slug]`,
  `tema/[category]`), `proekti` (404 until verified case studies), 3 legal pages, `[...rest]` 404.
* **Admin:** `src/app/admin/` (no locale in URL; language from `acs_locale` cookie), login, dashboard,
  leads, lead detail, AI approvals, activity, account. `src/app/api/[...path]/route.ts` proxies to the
  API (same-origin cookies).
* **SEO:** `src/lib/seo.ts` (canonical, hreflang bg/en + x-default, OG locale, JSON-LD),
  `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, keyword maps `content/{bg,en}/seo.ts`.
* **Content/i18n:** typed content `src/content/{bg,en}/*.ts` (`en` typed against `bg`), dictionaries
  `src/i18n/dictionaries/{bg,en}.ts`, admin dictionaries `src/i18n/admin/{bg,en}.ts`; parity tests in
  `src/lib/i18n.test.ts`.
* **Styling:** single `src/app/globals.css` (452 lines): semantic tokens in `@theme`, brand-tuned
  Tailwind scales, component classes (`btn-*`, `card`, `panel`, `field`, `surface-light`, `t-*`).
  Fonts via `next/font`: Inter, Manrope, JetBrains Mono (Latin + Cyrillic).
* **Component hierarchy:** `components/ui` (primitives: Container, Section tones/densities,
  SectionHeading, Button/ButtonLink, FeatureIndex/FeatureMatrix, Alert, CheckList, PageHero; Icon),
  `components/layout` (Header with mega-menu/mobile panel, LanguageSwitcher, Logo, Footer, Breadcrumbs),
  `components/home` (HeroWorkflow, CredibilityStrip, ProblemIndex, AiPipeline, ManagedFeature,
  ProcessSteps, AdvisorShowcase, CapabilityMatrix*), `components/sections` (ServiceShowcase,
  ServiceConcept, ServiceMotif, ServiceCard, AiOpsDiagram, CtaBand, Faq, ProcessTimeline, LegalPage),
  `components/contact`, `components/advisor`, `components/editorial`, `components/admin`.
  (*`CapabilityMatrix` is currently unused.)
* **Client components** (only where interactive): Header, LanguageSwitcher, ContactForm (+ AI Managed
  fields, params wrapper), AdvisorTool, StickyQuoteBar, error/not-found boundaries, all admin UI.
  All homepage and service sections are server components.
* **Security headers** (`next.config.ts`): strict CSP (self only; `'unsafe-inline'` scripts),
  X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP; admin `noindex` +
  `no-store`; `output: "standalone"`.

### API (`apps/api`) — FastAPI 0.161, SQLAlchemy 2.1, Alembic 1.20, PostgreSQL 17, Pydantic 2.14

| Router | Endpoints |
| --- | --- |
| `health` | `GET /api/health`, `GET /api/health/ready` |
| `public` | `GET /api/public/form-token`, `POST /api/public/leads`, `POST /api/public/quote-requests` |
| `advisor` | `GET /api/public/advisor/status`, `POST /api/public/advisor/assessments` |
| `admin-auth` | `POST login/logout/logout-all`, `GET sessions`, `GET me` (`/api/admin/auth/*`) |
| `admin` | dashboard stats, audit search, system status, retention preview/run, leads list/detail/update/notes/delete/audit/AI triage, AI actions list/decision |

* **Models** (`app/models.py`): `admin_users`, `admin_sessions`, `leads` (incl. `locale`,
  `service_details` JSONB), `lead_notes`, `audit_logs`,
  `ai_action_requests`, `advisor_assessments` (optional `lead_id` link, expiry). **Migrations:** `0001`–`0004`.
* **Cross-cutting:** localized errors (`app/i18n.py`, `Accept-Language`), Argon2 passwords, hashed
  session tokens, CSRF header, persistent login lockout, origin check, body-size limit, form tokens
  (anti-bot timing), **in-memory** sliding-window rate limiter (`app/rate_limit.py`, single instance),
  audit log, retention jobs (`app.cli maintenance`), AI provider abstraction (mock default; Anthropic
  adapter `claude-opus-5-5`, never called live — no key), advisor safety pipeline (input screening,
  prompt isolation, schema validation, claim/link scrubbing, forced human approval).

### Tests (inventory)

* API: 14 pytest modules, 245 collected tests (parametrised); ruff.
* Web: 9 Vitest files, 135 tests; `tsc` via `next typegen`; ESLint.
* E2E: 8 Playwright specs (public, links crawl, contact, admin, mobile, SEO crawl, advisor, i18n),
  44 tests (desktop Chromium + Pixel 7). Visual capture tool: `e2e/visual/screenshots.spec.ts`
  (`playwright.screens.config.ts`, not part of the test run).
* Last recorded runs (2026-10-24, local Docker): all passing — not re-run for this audit.

---

## 2. Redesign improvements already in the code (verified in source)

Token system + light editorial surface; new monogram/wordmark (`Logo.tsx`); compact header with
underline active state; homepage IA (hero workflow demo, credibility strip, curated service
showcase, problem index, AI pipeline, AI Managed feature, horizontal process, Advisor showcase,
editorial insights, full-bleed CTA); discipline-specific service concepts; restructured AI Managed
Services page with sticky sub-navigation; editorial footer; grouped contact form; measured 0 px
horizontal overflow at 360–1440 px on 16 routes (screenshot tool).

**Not yet aligned with the redesign:** `app/icon.svg` (old cyan→violet gradient mark),
`app/opengraph-image.tsx` (old palette, English-only text served for BG pages too), advisor page
layout (token-level only), docs `UI_IMPLEMENTATION_REPORT.md` / `UI_REDESIGN_REPORT.md` still say
"not committed".

---

## 3. Features and contracts that must be preserved

* Locale routing, URL map and slug maps (`i18n/config.ts`, `locale-routing.ts`, `buildSlugMap`),
  hreflang/canonical/sitemap behaviour and their tests.
* Lead pipeline: `POST /leads`, `/quote-requests` (schemas, form token, honeypot, rate limits,
  secret screening, `locale`, `ai_managed` details), admin CRUD, audit trail, GDPR retention/erasure.
* Advisor: anonymous flow, demo labelling, safety pipeline, opt-in storage with expiry, linking to a
  lead (`advisor_assessment_id`), bilingual output.
* AI Managed Services: content honesty rules (no prices, SLA, unlimited, live telemetry), intake form.
* Admin i18n, session/CSRF model, admin-only endpoints.
* Accessibility patterns: skip link, focus rings, header Escape/focus/scroll-lock logic, stretched-link
  cards with heading names, reduced-motion rule, `aria-live` form feedback.
* No third-party requests from public pages (e2e-enforced), CSP.
* Content rules enforced by tests: no invented guarantees/metrics, legal pages `noindex` while drafts.

---

## 4. Prioritised issues

| # | Priority | Area | Issue (evidence) | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | **P0** | Delivery | No CI (`.github/` absent); quality gates depend on someone running `test.ps1` | GitHub Actions: web (typecheck, lint, vitest, build), api (ruff, pytest with Postgres service), e2e on PRs (compose) |
| 2 | **P0** | Product policy | Planned **ROI Calculator** conflicts with existing rules: advisor scrubs ROI/savings/% from AI output (`advisor/safety.py`), content tests forbid invented guarantees | Decide: calculator computes only from **user-entered** values, shows the formula, no default figures implying savings, no AI-generated numbers; document as an exception to the advisor rule |
| 3 | **P1** | Brand | Favicon and OG image use the old palette/mark; OG text English on BG pages | Regenerate from the new logo; per-locale OG (`[locale]/opengraph-image.tsx`) |
| 4 | **P1** | Security/scale | In-memory rate limiter (per process); new public tools add abuse surface | Per-tool limits now; Redis-backed limiter before multi-instance or AI-backed tools |
| 5 | **P1** | Legal | Legal texts are drafts, company details placeholders (`site.ts`, `legal.ts`); new tools that store data need privacy-policy updates | Business input required before launching data-storing tools |
| 6 | **P1** | Repo hygiene | Local `main` stale; two merged feature branches | Fast-forward `main`; delete merged branches after confirmation |
| 7 | **P2** | Performance | No Lighthouse/CWV measurement for the current design; Next 16 build output shows no bundle sizes | Add Lighthouse CI (lab) on key routes; record budgets |
| 8 | **P2** | UX | Mobile homepage ≈ 18,000 px at 390 px; advisor page only token-styled; BG/EN homepage H1 differ in meaning | Phone-specific condensation; advisor redesign within tools hub; align H1 copy (business decision) |
| 9 | **P2** | Docs | Two UI reports state "not committed"; `CapabilityMatrix` unused | Update docs; remove unused component |
| 10 | **P3** | Admin | No password change UI, single admin, no 2FA (ROADMAP V1.1) | Required before the client portal |
| 11 | **P3** | AI | Anthropic adapter never exercised live | Staged key + smoke test before AI-backed tools |
| 12 | **P3** | Typography | Manrope Cyrillic kerning uneven at mid sizes | Evaluate a display face with strong Cyrillic before the logo work |

**Unknowns (need owner input):** production hosting/URL; legal entity and contact data; whether the
logo redesign is a refresh or a new identity (name/wordmark constraints); budget for an AI provider;
whether tool results may be stored and for how long; the target client segments for the portal.

---

## 5. Proposed routes and component structure

URL segments follow the existing pattern (Bulgarian folder names; English via `EN_SEGMENTS`/slug maps).

| Feature | BG URL | EN URL | Rendering |
| --- | --- | --- | --- |
| Tools hub | `/bg/instrumenti` | `/en/tools` | server page, cards from a tool registry |
| AI Readiness Assessment | `/bg/instrumenti/ai-gotovnost` | `/en/tools/ai-readiness` | client stepper, deterministic scoring |
| Build Your AI Team | `/bg/instrumenti/ai-ekip` | `/en/tools/ai-team` | client configurator over an agent/role catalogue |
| AI ROI Calculator | `/bg/instrumenti/roi-kalkulator` | `/en/tools/roi-calculator` | client, user-input arithmetic only |
| Automation Opportunity Finder | `/bg/instrumenti/avtomatizatsii` | `/en/tools/automation-finder` | client questionnaire → ranked opportunities from a rubric |
| AI Automation Advisor (existing) | `/bg/ai-automation-advisor` (unchanged) | `/en/ai-automation-advisor` | listed in the hub; URL kept for SEO |
| AI agent library | `/bg/ai-agenti`, `/bg/ai-agenti/[slug]` | `/en/ai-agents/[slug]` | static content pages (SSG) |
| AI Solution Builder | `/bg/instrumenti/ai-reshenie` | `/en/tools/solution-builder` | client builder composing agents + integrations + approvals |
| Client portal (future) | `/portal/*` (cookie-based language like admin) | — | dynamic, authenticated, separate from `/admin` |

Implementation shape (keeps the current architecture):

```
src/content/{bg,en}/tools.ts          tool registry: key, slug, title, summary, meta, questions/rubrics
src/content/{bg,en}/agents.ts         agent library: key, slug, role, capabilities, required approvals, integrations
src/app/[locale]/instrumenti/page.tsx             hub (server)
src/app/[locale]/instrumenti/[slug]/page.tsx      generateStaticParams from registry; renders <ToolRunner tool=key/>
src/app/[locale]/ai-agenti/page.tsx, [slug]/page.tsx
src/components/tools/ToolShell.tsx     stepper, progress, back/next, keyboard + aria-live, reduced motion
src/components/tools/{Readiness,AiTeam,RoiCalculator,OpportunityFinder,SolutionBuilder}.tsx  (client)
src/components/tools/ResultPanel.tsx   result layout, print, "request consultation" handoff
src/lib/tools/{readiness,roi,finder,team,builder}.ts  pure functions (unit-tested), versioned rubrics
src/components/brand/{LogoMark,Wordmark,BrandLockup}.tsx  logo variants; app/icon.svg + OG generated from them
src/components/ui/primitives.tsx       Button motion variants (hover/press/focus, loading), no new dependency
```

Route mapping changes: add `instrumenti → tools`, `ai-agenti → ai-agents` to `EN_SEGMENTS`; extend
`SlugMap`/`alternateLocalePath`/`buildSlugMap` with `tools` and `agents`; add tool/agent paths to
`sitemap.ts`, both keyword maps and the routing tests.

---

## 6. Database / API change plan

**Principle:** every tool works fully in the browser without storing anything. Data is stored only
when the visitor opts in (save a result or attach it to a consultation request) — the same model as
the advisor.

| Change | Phase | Detail |
| --- | --- | --- |
| Migration `0005_tool_results` | Tools v1 | table `tool_results`: `id uuid`, `tool` (CHECK: readiness, ai_team, roi, finder, solution), `rubric_version`, `locale`, `input jsonb` (validated per tool, no personal data), `result jsonb`, `created_at`, `expires_at`, `lead_id` FK → leads `ON DELETE CASCADE`, `linked_at`; indexes on `tool`, `expires_at`, `lead_id`. Retention via existing maintenance job |
| `POST /api/public/tools/{tool}/results` | Tools v1 | strict per-tool Pydantic schema, form token, per-IP + global rate limit, secret/PII screening reuse, returns `{id, reference, expires_at}`; no public GET |
| `LeadCreate.tool_result_id` | Tools v1 | optional, linked like `advisor_assessment_id` (unknown/expired ignored) |
| Admin: lead detail shows linked tool result; `GET /api/admin/tools/stats` (counts by tool/locale, no PII) | Tools v1 | admin-only, audited views |
| Optional AI step (Solution Builder/Finder) | Tools v2 | reuse `AIProvider` + advisor safety pipeline; mock/demo labelling; no numeric claims |
| Portal: `tenants`, `client_users`, `client_sessions`, `ai_systems`, `incidents`, `changes`, `evaluation_runs`, `cost_records`, `reports` | Portal | per `AI_OPERATIONS_ARCHITECTURE.md`; tenant column + Postgres RLS; separate auth/cookie from admin; DPA prerequisite |
| Redis (rate limits, job queue) | before Tools v2 / Portal | new infrastructure dependency |

No changes are required to existing tables for Tools v1 except the optional `tool_result_id` handling
in the lead service (a nullable FK lives on `tool_results`, not on `leads`).

---

## 7. Phased roadmap

| Phase | Scope | Depends on | Exit criteria |
| --- | --- | --- | --- |
| **0. Foundations** | Fast-forward `main`, prune merged branches; GitHub Actions CI (web/api/e2e); Lighthouse baseline on 6 routes; fix stale docs; remove unused component | — | CI green on a PR; baseline report committed |
| **1. Brand & interactive buttons** | New logo system (mark, lockup, mono), favicon/app icons, per-locale OG images; button motion variants (hover/press/focus/loading, reduced-motion safe); brand section in `DESIGN_SYSTEM.md` | 0; owner decision on identity scope | Visual QA 5 widths × BG/EN; contrast ≥ 4.5:1; no layout shift (CLS) regressions |
| **2. Homepage & services refinement** | Mobile condensation, H1 alignment, tools entry points on home/services, advisor page redesign | 1 | Mobile homepage height budget met; e2e updated |
| **3. Tools hub + Readiness + ROI** | Registry, hub, ToolShell, Readiness Assessment, ROI Calculator (policy from issue #2), result → consultation handoff (client-only, no DB) | 0, policy decision | Unit tests for scoring/arithmetic; e2e per tool BG/EN; i18n parity |
| **4. Persistence for tools** | Migration `0005`, tools API, lead linking, admin display, retention, privacy-policy update | 3, legal input | API tests, migration round-trip, admin e2e |
| **5. Opportunity Finder + Build Your AI Team** | Rubric-based finder, agent/role catalogue, team configurator | 3 (4 for saving) | Same as 3 |
| **6. Agent library + Solution Builder** | Static agent pages (SEO), builder composing agents/integrations/approval gates; optional AI step behind safety pipeline | 5; AI key + Redis for the AI step | Content honesty tests; safety tests reused |
| **7. AI Operations client portal** | Auth (client users, 2FA), tenants + RLS, read-only views first | Admin 2FA, Redis, DPA, hosting decision | Tenant-isolation tests, security review |

---

## 8. Test coverage per phase

* **Pure logic** (`src/lib/tools/*`): Vitest table tests for scoring/arithmetic, edge values, rubric
  version, no NaN/negative outputs, rounding; ROI: formula equals displayed breakdown.
* **Components:** Testing Library — stepper keyboard navigation, focus management between steps,
  validation messages in both languages, `aria-live` result announcement, reduced-motion behaviour.
* **i18n/SEO:** existing parity and routing tests extended (`tools`, `agents` slugs, sitemap entries,
  reciprocal hreflang); no-Cyrillic-in-English test covers new content automatically.
* **Content honesty:** extend `content.test.ts` — no guaranteed outcomes, no default ROI figures, no
  invented benchmarks/industry averages in tool content.
* **API (Phase 4+):** schema validation per tool, unknown fields rejected, PII/secret screening, form
  token, rate limit, retention purge, lead linking (unknown/expired ignored), admin-only access,
  migration 0004→0005 upgrade/downgrade.
* **E2E:** complete each tool in BG and EN, mobile (Pixel 7), handoff to contact with reference,
  admin sees linked result (Phase 4), crawl/SEO specs include new pages.
* **Visual:** screenshot tool at 1440/1024/768/390/360; overflow must stay 0.
* **Performance:** Lighthouse CI budgets (LCP, CLS, TBT) on home, services, one tool, advisor.

---

## 9. Validation commands (existing, verified in repository files)

Run from `D:\Projects\Site` (PowerShell, Docker Desktop running):

| Purpose | Command |
| --- | --- |
| Everything (API, web, e2e) | `.\scripts\test.ps1` |
| API tests + lint | `.\scripts\test.ps1 -Suite api` (`pytest -q` and `ruff check` in `api-tests`) |
| Web typecheck + lint + unit | `.\scripts\test.ps1 -Suite web` (`npm run typecheck && npm run lint && npm test` in `web-tests`) |
| E2E | `.\scripts\test.ps1 -Suite e2e` (rebuilds and starts the stack, runs Playwright) |
| Dependency audit | `.\scripts\test.ps1 -Suite audit` (pip-audit, `npm audit --omit=dev`) |
| Production web build | `docker compose build web` (runs `npm run build` in the `builder` stage) |
| Start / stop | `.\scripts\start.ps1` · `.\scripts\stop.ps1` |
| Visual capture | `docker compose --profile test build e2e` then `docker compose --profile test run --rm -e SHOT_LABEL=<name> -e SHOT_FULL=all -v ${PWD}/apps/web/e2e/screenshots:/e2e/screenshots e2e npx playwright test -c playwright.screens.config.ts` |
| Migrations state | `docker compose exec api alembic current` |
| Without Docker (if Node ≥ 20.9 locally) | `cd apps/web; npm ci; npm run typecheck; npm run lint; npm test; npm run build` |

Note: `docker compose --profile test run --build e2e` also rebuilds the `web` service as a production
container; when iterating against the dev server, pass both compose files
(`-f docker-compose.yml -f docker-compose.dev.yml`) and build only `e2e`.

---

## 10. Implementation checklist (for subsequent prompts)

- [x] **P0** `git switch main && git pull --ff-only`; branch per phase from `main` (done 2026-10-24: `main` = `831fe81`, branch `ci/phase-0-foundations`).
- [x] **P0** Add GitHub Actions mirroring `scripts/test.ps1` (`.github/workflows/ci.yml`, weekly `audit.yml`; actionlint clean; first GitHub run pending a push).
- [x] **P0** Record a Lighthouse baseline for `/bg`, `/en`, `/bg/uslugi`, AI Managed, contact, advisor ([PERFORMANCE_BASELINE.md](PERFORMANCE_BASELINE.md); found and fixed an SVG console error).
- [ ] **P0** Owner decisions: ROI calculator policy; logo scope; tool-data storage/retention; legal data.
- [ ] Fix stale UI report statements; remove unused `CapabilityMatrix`.
- [ ] Phase 1: logo system + favicon + per-locale OG; button interaction variants; update `DESIGN_SYSTEM.md`.
- [ ] Phase 2: mobile homepage condensation; H1 alignment; advisor page layout; tools entry points.
- [ ] Phase 3: `EN_SEGMENTS`/slug-map extension; tool registry; hub; ToolShell; Readiness; ROI (client-only).
- [ ] Phase 4: migration `0005_tool_results`; tools API; lead linking; admin view; privacy policy update.
- [ ] Phase 5: Opportunity Finder; Build Your AI Team.
- [ ] Phase 6: agent library (SSG + SEO); Solution Builder; optional AI step via the advisor safety pipeline.
- [ ] Phase 7: client portal (after 2FA, Redis, DPA, hosting).
- [ ] Every phase: unit + component + e2e (BG/EN, mobile) + screenshots at 5 widths + `.\scripts\test.ps1`.
