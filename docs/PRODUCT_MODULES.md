# Product modules

**Status:** reference document. It describes the modules that exist (verified on `main` @ `52bf6e1`)
and the ones that [INFORMATION_ARCHITECTURE_V2.md](INFORMATION_ARCHITECTURE_V2.md) and
[IMPLEMENTATION_DEPENDENCIES_V2.md](IMPLEMENTATION_DEPENDENCIES_V2.md) plan. One module = one
coherent capability with its own routes, code, data and tests. New work should extend a module
listed here rather than create a parallel one.

**Status legend:**

* **live:** in `main`, tested.
* **extend:** live, with v2 additions planned.
* **new:** to build.
* **planned:** blocked by a platform phase.

**Access legend:**

* **public:** anyone.
* **staff:** admin session.
* **client:** portal session (planned).

## 1. Module map

```
                    ┌──────────────── Platform foundation (cross-cutting) ────────────────┐
                    │ i18n & routing · SEO · design system · analytics · lead pipeline ·  │
                    │ AI layer & approval policy · audit & retention · security headers  │
                    └──────────────────────────────────────────────────────────────────────┘
 Public experience                                  Staff                     Client (planned)
 ├─ Marketing pages (home, about, process, legal)   ├─ Admin: leads           └─ Client portal
 ├─ Service catalogue (services + domain hubs*)     ├─ Admin: AI approvals       (org overview, registry,
 ├─ Interactive tools (7) + Advisor                 ├─ Admin: activity/audit      incidents, reports,
 ├─ Agent library                                   ├─ Admin: retention           telemetry later)
 ├─ Editorial (insights, topics, case-study gate)   └─ AI operations scaffold
 ├─ Reference library* (architectures, scenarios)
 ├─ Segments* (industries, problems)
 └─ Contact & quotes                                * = new in IA v2
```

## 2. Platform foundation

| Module | Responsibility | Code | Status |
| --- | --- | --- | --- |
| **i18n & routing** | BG/EN URLs, segment and slug maps, the proxy (rewrites and redirects), language switcher, preference cookie, dictionaries (site + admin) | `src/proxy.ts`, `lib/locale-routing.ts`, `i18n/config.ts`, `i18n/dictionaries/*`, `i18n/admin/*`, `components/layout/LanguageSwitcher.tsx` | live → extend (slug maps for domains, architectures, scenarios, industries, problems; `/portal` proxy rule) |
| **SEO** | metadata, canonical, hreflang, OG image, JSON-LD, sitemap, robots, keyword map | `lib/seo.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `content/*/seo.ts` | live → extend (new page types, `Disallow: /portal`) |
| **Design system** | tokens, primitives, patterns, interaction and motion, token guards | `app/globals.css`, `components/ui/*`, `docs/DESIGN_SYSTEM.md` | live (v2.1 on `design/ui-consolidation`) |
| **Product analytics** | allow-listed, non-personal tool events; no sink attached | `lib/analytics.ts` | live (a sink depends on consent tooling) |
| **Lead pipeline** | contact and quote leads, tool submissions, consents, spam and secret checks, rate limits, notifications | `components/contact/*`, `apps/api/app/routers/public.py`, `services/leads.py`, `notifications.py` | live |
| **AI layer & approval policy** | provider abstraction (mock / Anthropic), action risk policy, approval queue (no executor yet) | `apps/api/app/ai/*`, `services/ai_actions.py` | live (executor: track T3) |
| **Audit & retention** | append-only audit log, retention job and preview | `apps/api/app/audit.py`, `cli.py maintenance`, admin retention panel | live |
| **Feature registry** | tool availability (status + flag); planned: domain and content-type availability | `lib/tools.ts`, `lib/feature-flags.ts` | live → extend (`domainAvailable`, content thresholds) |

## 3. Public experience

### 3.1 Marketing pages

**Routes:**

* `/bg` ↔ `/en`
* `/za-nas` ↔ `/about`
* `/proces` ↔ `/process` (becomes the engineering methodology)
* `/sigurnost` ↔ `/security` (new)
* legal pages
* 404

**Code and access:**

* **Code:** `app/[locale]/{page,za-nas,proces,poveritelnost,biskvitki,obshti-usloviya}`,
  `content/*/{home,pages,legal}.ts`, `components/home/*`, `components/sections/LegalPage.tsx`.
* **Access:** public. Legal pages are `noindex` while `legal.isDraft`.

**Status:**

* **extend:** the homepage gets domain bands (decision D7 for its keyword); `/proces` covers
  methodology.
* **new:** the security page.
* **Tests:** `home.test.tsx`, `public.spec.ts`, `seo.spec.ts`, `content.test.ts`.

### 3.2 Service catalogue

**Routes:**

* `/uslugi` ↔ `/services`
* 9 service pages: `/uslugi/<service>`, including the dedicated AI Managed Services page
* 10 domain hubs: `/uslugi/<domain>` (new)

**Code:** `app/[locale]/uslugi/**`, `content/*/services*.ts`, `content/*/ai-managed.ts`,
`lib/navigation.ts`, `components/sections/*`. Planned: `lib/domains.ts`,
`content/*/domains.ts`, a hub template, discovery filters.

**Data:** service keys match the API `ServiceKey` enum (contact pre-selection). Domain keys are
web-only until decision D4.

**Status:**

* **extend:** services gain a domain breadcrumb and links.
* **new:** domain hubs and filters (IA-2).
* **Docs:** SERVICE_TAXONOMY.md, CONTENT_STRATEGY_BG_EN.md.

### 3.3 Interactive tools

**Routes:**

* `/instrumenti` ↔ `/tools`
* 5 hosted tools: `/instrumenti/<tool>`
* the Advisor at `/ai-automation-advisor`

**Code:** `lib/tools.ts` (registry), `components/tools/*`, `components/advisor/*`,
`lib/{readiness,ai-team,roi,finder,solution}.ts`.

**API:**

* `/api/public/readiness/*`
* `/api/public/team/*`
* `/api/public/advisor/*`
* the ROI calculator, Finder and Solution Builder are client-only

**Data:**

* readiness submissions → leads;
* `team_configurations`;
* `advisor_assessments`.

**Status:** live. Planned: each tool links to the domain hubs it feeds. Optional AI step for the
Solution Builder (Phase 6b). **Docs:** TOOLS_PLATFORM, READINESS_REPORTS, TEAM_CONFIGURATOR,
ROI_AND_FINDER, SOLUTION_BUILDER, AI_ADVISOR.

### 3.4 Agent library

| Item | Detail |
| --- | --- |
| Routes | `/ai-agenti` ↔ `/ai-agents`, 10 `/ai-agenti/<agent>` |
| Code | `lib/agent-library.ts`, `lib/agent-slugs.ts`, `components/agents/*`, `content/*/agent-library.ts` |
| Status | live. v2 moves it under "Solutions" in the navigation and breadcrumb (no URL change). |

### 3.5 Editorial

| Item | Detail |
| --- | --- |
| Routes | `/statii` ↔ `/insights`, articles, topics, `/proekti` ↔ `/case-studies` (404 until published) |
| Code | `content/*/{articles,articles-new,editorial}.ts`, `components/editorial/*` |
| Rules | thin topics are `noindex`; the case-study publish guard (`publishableCaseStudies`); hreflang only for available locales |
| Status | live. v2 adds domain tags for recommendations. |

### 3.6 Reference library (new)

**Routes:**

* `/arhitekturi[/<slug>]` ↔ `/architectures[/<slug>]`
* `/stsenarii[/<slug>]` ↔ `/scenarios[/<slug>]`

**Purpose.** Technical reference architectures and **illustrative** scenarios, which are explicitly
not client projects. They show how domains combine (e.g. agent + approval gates + integration).

**Code and data (planned):**

* `content/*/{architectures,scenarios}.ts`, with domain tags and agent/tool links;
* rendered with `DiagramFrame` and the Solution Builder's layered diagram.

**Status:** new, conditional (§7 thresholds in IA v2).

### 3.7 Segments (new)

**Routes:**

* `/za-kogo/<slug>` ↔ `/industries/<slug>`
* `/problemi[/<slug>]` ↔ `/problems[/<slug>]`

**Purpose.** Entry pages by industry or business problem that route visitors to domains and tools.

**Code and data (planned):** `content/*/{industries,problems}.ts`. The existing
`pages.ts → industries.segments` remains the hub content.

**Status:** new, conditional.

### 3.8 Contact & quotes

**Routes:** `/kontakti` ↔ `/contact` (`?usluga=`/`?service=`, `&tip=oferta`/`&type=quote`), plus
`#ams-inquiry` on the AMS page.

**Code:** `components/contact/*`, API `/api/public/leads`, `/api/public/quote-requests`.

**Status:** live. Planned: domain-level pre-selection only after decision D4 (an API enum and a
migration).

## 4. Staff (admin)

All admin modules use the staff session with CSRF on writes. Pages are `noindex, nofollow` and
robots-disallowed. The admin language comes from a cookie; there is no locale in the URL.

| Module | Routes | API | Status |
| --- | --- | --- | --- |
| Dashboard and leads | `/admin`, `/admin/leads`, `/admin/leads/<id>` | `/api/admin/dashboard/stats`, `/leads*`, reports | live |
| AI approvals | `/admin/ai` | `/api/admin/ai/actions*` | live (Tabs on `design/ui-consolidation`) |
| Activity / audit | `/admin/activity` | `/api/admin/audit` | live |
| Retention | dashboard panel | `/api/admin/retention*` | live |
| Account and sessions | `/admin/account` | `/api/admin/auth/*` | live |
| AI operations scaffold | `/admin/operations` | `/api/ops/*` (organisation-scoped, RBAC) | live, staff only. Docs: AI_OPERATIONS_PORTAL.md. |
| Staff roles and MFA | — | — | planned (P2) |

## 5. Client portal (planned)

**Routes:** `/portal/*`. There is no locale segment; the language comes from a preference, as in
the admin.

**Access:** client sessions only, with MFA and invitations (P3). Pages are `noindex, nofollow` and
`Disallow: /portal`. The proxy rule is added before the first link is published (IA-6).

**Modules, in phase order:**

| Phase | Modules | Data available at that point |
| --- | --- | --- |
| P4 (manual data) | organisation overview, agent registry with versions, incidents (staff-entered), reports (PDF) | from the scaffold |
| P5 | runs, traces, usage and costs | telemetry ingestion |
| P6 | evaluations and review queues | quality data |
| P7 | alerts, budgets, scheduled reports | alerting |

**Reuses:** `app/ops/*` (tenancy, RBAC) and the design system. It needs no public-site module.

## 6. Cross-module relations (recommendation data)

| Relation | Source of truth | Used by |
| --- | --- | --- |
| service → tools | `lib/tools.ts::SERVICE_TOOLS` | service pages, domain hubs |
| service → related services / articles | `content/*/services-depth.ts`, article `relatedServices` | service pages, articles |
| service → primary domain | SERVICE_TAXONOMY §3 → `lib/domains.ts` (planned) | breadcrumbs, mega-menu, hubs |
| domain → related domains | SERVICE_TAXONOMY §6 (cross-sell) | domain hubs |
| tool → domains | SERVICE_TAXONOMY §3 | tool results, hubs |
| content item → domains | `domains: DomainKey[]` on articles, architectures, scenarios, industries, problems (planned) | hubs, segment pages |
| agent → workflows / tools | `lib/agent-library.ts`, `?w=` Solution Builder link | agent pages, architectures |

Relations are static data checked by tests: every referenced key exists, and every link target is
an available page. There is no runtime personalisation and no tracking-based recommendation.

## 7. Ownership rules

* **A page belongs to exactly one module.** It may consume relation data from others.
* **New routes are added through their module's registry** (tools, domains, content types), so
  availability, the sitemap and hreflang stay consistent.
* **Module documentation lives in the existing per-module docs listed above.** This file only maps
  them.
