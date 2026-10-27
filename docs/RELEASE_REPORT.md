# Release report: redesign and interactive tools

**Date:** 2026-10-27

**Reviewer roles:** quality engineering, accessibility, performance and release management.

**Code reviewed:** branch `release/final-review`. That is `feature/ai-operations-portal` (`c3ad89d`)
plus the fixes listed in §3. It is built on `main` (`b40975e`).

**Environment:** Windows 11, Docker Desktop. Every suite runs in the repository's own containers
(`scripts/test.ps1`, `scripts/lighthouse.ps1`).

> Everything marked as executed was run during this review, and nothing else is claimed. Nothing
> was deployed, pushed to production or migrated in production. No production environment exists
> yet (see `DEPLOYMENT.md`, "prepared, not executed").

## 1. Completed features (in scope)

| Area | Routes (BG ↔ EN) | Notes |
| --- | --- | --- |
| Brand, design system, buttons and motion | site-wide | `DESIGN_SYSTEM.md`. Logo unchanged. Motion only under `prefers-reduced-motion: no-preference`, with a global reduce reset. |
| Homepage, navigation, service pages | `/bg` ↔ `/en`, `/bg/uslugi/*` ↔ `/en/services/*` | Sticky in-page navigation on AI Managed Services |
| Tools hub | `/bg/instrumenti` ↔ `/en/tools` | 7 live tools; none remain "planned" |
| AI readiness assessment, lead capture and PDF report | `/bg/instrumenti/ai-gotovnost` ↔ `/en/tools/ai-readiness` | API `/api/public/readiness/*` |
| Build your AI team, cost model, PDF, saved links, consultation | `/bg/instrumenti/ai-ekip` ↔ `/en/tools/ai-team` | API `/api/public/team/*`, migration 0007 |
| AI ROI calculator | `/bg/instrumenti/roi-kalkulator` ↔ `/en/tools/roi-calculator` | client-only |
| Automation Opportunity Finder | `/bg/instrumenti/avtomatizatsii` ↔ `/en/tools/automation-finder` | client-only |
| AI Solution Builder | `/bg/instrumenti/ai-reshenie` ↔ `/en/tools/solution-builder` | client-only, rule-based |
| AI Agent Library (index + 10 pages) | `/bg/ai-agenti[/slug]` ↔ `/en/ai-agents[/slug]` | static (SSG) |
| AI Managed Services: operating areas and planned portal | `/bg/uslugi/ai-managed-services` ↔ `/en/services/ai-managed-services` | no telemetry claims |
| AI operations portal scaffold (staff only) | `/admin/operations`, API `/api/ops/*` | migration 0008; tenant-scoped; RBAC |
| Advisor and admin (regression scope) | `/bg/ai-automation-advisor`, `/admin/*` | unchanged behaviour, covered by tests |

## 2. Test results (executed)

| Gate | Command | Result |
| --- | --- | --- |
| API tests | `.\scripts\test.ps1 -Suite api` (pytest against real PostgreSQL, Alembic migrations, `alembic check`) | **369 passed** |
| API lint | ruff (same suite) | **clean** |
| Web typecheck, lint and unit/UI tests | `.\scripts\test.ps1 -Suite web` (`next typegen && tsc`, `eslint`, `vitest`) | **461 passed** after fixes (460 before the new SEO test) |
| Production build | `next build` (Next.js 16.4.2, Turbopack) in the web-tests image, plus `docker compose build web` | **success**: 113 static pages; admin and API routes dynamic. The `metadataBase` warnings are fixed (§3). |
| End-to-end | `.\scripts\test.ps1 -Suite e2e` (Playwright, desktop and mobile Chromium, production build) | **84 passed**, before and after the fixes |
| Dependency audit | `.\scripts\test.ps1 -Suite audit` (`pip-audit`, `npm audit --omit=dev`) | **0 known vulnerabilities** |
| Responsive and semantic scan | temporary Playwright scan: 89 sitemap pages + 5 result states × 360/390/768/1024/1440 px | after fixes: **0 horizontal overflows** and **0 heading skips**; one h1 per page; no unlabelled controls, images without `alt` or duplicate ids |
| Lighthouse (lab) | `.\scripts\lighthouse.ps1`, 10 routes × mobile and desktop | see §6 |

## 3. Bugs found and fixed in this review

| # | Severity | Issue | Fix | Verified by |
| --- | --- | --- | --- | --- |
| 1 | **High (SEO/social)** | **No `og:image` on any public page.** A page-level `openGraph` object replaced the inherited file-based image, so shared links had no preview image even though `twitter:card` was `summary_large_image`. | `lib/seo.ts` adds `OG_IMAGE` (`/opengraph-image`, 1200×630) to `openGraph.images` and `twitter.images`. | new unit test; e2e `seo.spec.ts` now checks `og:image` on every sitemap page |
| 2 | Medium (layout) | ROI calculator at 1024 px: the result panel overflowed the page by 22 px (a long BG sentence in a non-wrapping button). | The button may wrap (`RoiCalculator.tsx`). | 5-width scan: 0 overflows |
| 3 | Medium (a11y, 1.3.1) | `/bg/ai-resheniya` and `/en/ai-solutions` jumped from h1 to h3 (the capability list had no section heading). | Added the section heading "Какви AI решения изграждаме / What we build". | scan: 0 heading skips |
| 4 | Low (a11y, 2.5.8) | Breadcrumb links were 22 px tall; the "Insert an example" buttons (advisor, contact) were 16 px. | Minimum height of 24 px. | scan |
| 5 | Low (a11y, 2.3.3) | The advisor's smooth scroll to the consultation form ignored `prefers-reduced-motion`; CSS cannot override an explicit JS smooth scroll. | Checks `matchMedia` before scrolling. | unit tests |
| 6 | Low (build hygiene) | Build warnings: `metadataBase` was not set in the separate admin root layout, so OG URLs resolved to localhost. | `metadataBase` from `SITE_URL`. | build log |

## 4. Remaining known issues (not blocking)

- **Possible mobile homepage regression.**
  - **Measured:** Lighthouse mobile `/bg` median is **82** (runs 82, 79, 91) with 316 ms blocking time, against 91 and 136 ms on 2026-10-24 (`homepage-v3`).
  - **What stayed the same:** the CPU benchmark; transfer barely changed (451 → 460 KB); the DOM grew by 88 nodes.
  - **Why it's uncertain:** script time varies widely between runs (612–1133 ms), so this may be machine noise.
  - **Next step:** re-measure on the production host. Desktop is 100.
- **Admin bundle size.** `lib/admin-labels.ts` imports the whole content index, so the admin client chunk is 615 KB raw (165 KB gzip). It loads only in the admin area, never on public pages (verified), and is a candidate for optimisation.
- **Small text links.** Standalone text links ("Learn more", footer and menu lists) are 20 px tall. They meet WCAG 2.2 2.5.8 through the spacing exception: they are isolated, at least 24 px apart. The ROI chart segments are small pointer targets, but the same values are in the chart's table and reachable by keyboard.
- **Browser and screen-reader coverage.** Automated runs used Chromium (desktop and mobile emulation). Not run: Safari/WebKit, Firefox, real devices, and manual screen-reader passes (NVDA, VoiceOver).
- **Lighthouse "Best Practices" 74.** In the lab this comes only from local HTTP: no HTTPS, no HTTP→HTTPS redirect, and Chrome ignores the COOP header on an untrusted origin. Re-check on HTTPS in production.
- **Business and legal (unchanged):**
  - The legal texts are drafts and are `noindex`.
  - The footer still says "Working name. Company details will be published once registration is complete."
- **AI operations scaffold (by design):**
  - It is staff-only.
  - PostgreSQL row-level security is designed but not enabled; it needs a non-owner database role.
  - The pull request for `feature/ai-operations-portal` has not been created yet.

## 5. Security and privacy review

| Area | Finding |
| --- | --- |
| Input validation | Strict Pydantic models (`extra=forbid`), enumerated values for tool payloads, rejection of secret-like text in free text (contact, AI Managed Services form, ops registry), and control-character checks; mirrored client-side. Client-only tools (ROI, Finder, Solution Builder) have no free-text secret fields; share codes are versioned and strictly decoded. |
| Authentication | Admin: Argon2id passwords, opaque session token (only its hash is stored), HttpOnly SameSite cookie, CSRF header on writes, idle timeout, persistent lockout. No MFA yet (known; required before a client portal). |
| Authorization and tenant isolation | `/api/admin/*` requires an admin session. `/api/ops/*` adds membership resolution: a foreign tenant gets 404, the same as a missing one. It also enforces the permission matrix and a composite tenant foreign key. Covered by 18 dedicated tests. |
| Rate limiting | Every public POST is rate-limited (contact, advisor, readiness report and consultation, team estimate, save, lookup, report and consultation). Login is rate-limited and has a persistent lockout. The limiter is in memory, so only one API instance is supported (documented). |
| Secrets | `.env` exists only on the host. Production configuration refuses a placeholder or short `SECRET_KEY`, insecure CORS, a non-HTTPS `SITE_URL` and `COOKIE_SECURE=false`. No secrets in client code. |
| Consent and privacy | No third-party requests (checked in e2e). Fonts are self-hosted. Analytics emits only an in-page event with an allow-listed, non-personal payload, and no sink is attached. Marketing consent wording is versioned (migration 0006). Tools process data in the browser unless the visitor explicitly sends it. |
| Data retention | `python -m app.cli maintenance` purges expired leads, audit entries, advisor assessments, readiness and team configurations, and old sessions. Ops tenancy data follows the contract lifecycle (documented). |
| Logging | Logs carry only references, hashes and enumerated values; SQL parameters are hidden (`hide_parameters=True`). Reviewed: no request bodies or e-mail addresses in logs. |
| API errors | Uniform `{detail, code, request_id}` with BG/EN messages; no stack traces reach clients. |
| Dependencies | 0 known vulnerabilities (pip-audit; npm audit of production dependencies). |

No critical or high security issues were found.

## 6. Performance findings

Lighthouse 13.5 lab measurements of the production build on the Docker network: one run per route,
and the median of 3 for the homepage. These are lab values on a developer machine, not field data.

| Route | Mobile perf | A11y | SEO | LCP (mobile) | TBT (mobile) | CLS | Desktop perf |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/bg` (median of 3) | 82 (82, 79, 91) | 100 | 100 | 3.71 s | 316 ms | 0 | 100 |
| `/en/tools` | 86 | 100 | 100 | 3.61 s | 223 ms | 0 | 100 |
| `/bg/instrumenti/ai-gotovnost` | 85 | 100 | 100 | 3.49 s | 293 ms | 0 | 100 |
| `/en/tools/ai-team` | 88 | 100 | 100 | 3.21 s | 249 ms | 0 | 100 |
| `/bg/instrumenti/roi-kalkulator` | 86 | 100 | 100 | 3.48 s | 253 ms | 0 | 100 |
| `/en/tools/automation-finder` | 87 | 100 | 100 | 3.49 s | 220 ms | 0 | 100 |
| `/en/tools/solution-builder` | 85 | 100 | 100 | 3.49 s | 291 ms | 0 | 100 |
| `/bg/ai-agenti` | 91 | 100 | 100 | 2.88 s | 226 ms | 0 | 100 |
| `/en/ai-agents/document-processing-agent` | 90 | 100 | 100 | 2.88 s | 251 ms | 0 | 100 |
| `/en/services/ai-managed-services` | 86 | 100 | 100 | 3.48 s | 267 ms | 0 | 100 |

Other findings:

- **Rendering:** every public page is prerendered (SSG), and tools are client islands inside server pages.
- **JavaScript:** public pages share about 150 KB gzip of framework and runtime JavaScript. Tool pages add one 41 KB gzip logic chunk with no content strings, because content arrives as props.
- **Images and fonts:** images are SVG or generated (OG). Fonts are self-hosted through `next/font`, with `display: swap` and Latin + Cyrillic subsets.
- **Layout shift:** CLS is 0 on every measured route; 0.001 on the readiness page on desktop.
- **Animations:** only transform and opacity, enabled only under `prefers-reduced-motion: no-preference`, with a global reset under `reduce`.

## 7. Migration and deployment instructions

**Migrations.** The chain is linear (`0001 → 0008`) and every migration has a downgrade. The
upgrade/downgrade round trip and `alembic check` are tested.

| Revision | Change | In `main`? |
| --- | --- | --- |
| 0005 | `ai_agents` lead service | yes |
| 0006 | `leads.marketing_consent_version` (nullable) | yes |
| 0007 | `team_configurations` table | yes |
| 0008 | `ops_*` tables (scaffold) | no, only on `feature/ai-operations-portal` |

**Important:** the API container runs `alembic upgrade head` on start
(`RUN_MIGRATIONS_ON_START=true` in `docker-compose.yml`). **Starting a new API image applies every
pending migration.** In production that needs a database backup first and explicit approval.

**Environment variables:**

- No new required variables.
- Optional and not in `.env.example`: `TEAM_COST_ASSUMPTIONS_FILE`, which defaults to the built-in
  assumptions.
- `SITE_URL` must be the production `https://` origin at **web build time**. It is a build argument
  used for canonical, hreflang, sitemap and OG URLs.

**Breaking changes:**

- None for API clients: only new endpoints.
- The tools hub no longer renders an "in preparation" section, because every tool is live.
- The admin navigation gains "AI operations".

**Deployment** (when approved):

1. Merge the release branches into `main` with CI green (API, web plus production build, e2e).
2. Back up the database on the server: run `scripts/backup-db.ps1`, or
   `docker compose exec -T db pg_dump -U <user> <db> > backup.sql`.
3. Build with production values:
   `docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml build`, with
   `SITE_URL=https://<domain>`.
4. Start with `... up -d`. The API applies the pending migrations.
5. Check that `docker compose exec api alembic current` shows `0008` (or `0007` without the ops
   branch).
6. Run the manual checks below.

**Rollback:**

- **Application:** redeploy the previous image tags.
- **Database:**
  - For 0008, run `alembic downgrade 0007`. This drops only the ops tables, so registry data
    entered by staff is lost.
  - For 0007, the downgrade drops saved team links; leads keep their summary.
  - Otherwise, restore the backup from step 2. Downgrades never touch leads.

**Manual verification after deploy:**

- `/robots.txt` and `/sitemap.xml` use the `https://` domain. `og:image` resolves to
  `https://<domain>/opengraph-image`; check it with a link-preview debugger.
- The BG/EN language switch works on:
  - the homepage;
  - a service page;
  - `/bg/instrumenti/ai-ekip`;
  - `/bg/ai-agenti/obrabotka-na-dokumenti`.
- Every tool reaches a result on a phone, and each share link reopens it.
- One contact form and one readiness "send to team", both with test data, appear in `/admin`.
  Delete them afterwards.
- For a staff user without membership, `/admin/operations` shows "no organisation".
  `/api/ops/organizations` returns 401 when logged out.
- Security headers are present, HTTP redirects to HTTPS, and Lighthouse Best Practices is
  re-checked.

## 8. Release checklist

- [x] Every automated gate passes (API, web, build, e2e, audit).
- [x] The defects found in this review are fixed and covered by tests.
- [ ] The PR for `feature/ai-operations-portal` is created and merged, or the branch is explicitly excluded from the release.
- [ ] The fixes from this review (`release/final-review`) are reviewed and merged.
- [ ] Production `SITE_URL`, secrets and the DPA with the AI provider are confirmed **(owner)**.
- [ ] The legal texts are finalised (currently drafts, `noindex`) and the company details are published **(owner)**.
- [ ] A database backup is taken and running migrations is approved **(owner)**.
- [ ] The post-deploy manual checks are done and Lighthouse is re-run on the production host.

## Verdict: **READY WITH CONDITIONS**

The code meets the functional, responsive, accessibility (automated), SEO and security gates. No
critical or high-severity defects remain open.

**Conditions** before a public production release:

1. Merge the open branches with CI green.
2. Configure the production `SITE_URL` and secrets, take a backup, and explicitly approve the
   migrations that run on start.
3. Finalise the legal texts and company details (owner).
4. Run the post-deploy manual checks, including a mobile performance re-measurement over HTTPS.

**AI operations portal:** it may ship as a staff-only scaffold. It must not be opened to clients
until the MVP items are done: RLS with a restricted role, client accounts with MFA, and a
penetration test.
