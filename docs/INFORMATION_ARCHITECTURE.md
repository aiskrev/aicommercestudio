# Information architecture

> Describes the **current** IA (implemented). The next IA for the ten service domains — new page types,
> indexability rules and a route-by-route matrix — is designed in [INFORMATION_ARCHITECTURE_V2.md](INFORMATION_ARCHITECTURE_V2.md).
> Implemented from it: IA-2 (domain hubs) and the header part of IA-1 (mega-menu, Solutions ▾, Company ▾,
> mobile accordion); the IA-1 footer columns are not done yet.

Routes live under `apps/web/src/app/[locale]/`; Bulgarian path segments are canonical and English
URLs are produced by `EN_SEGMENTS` in `src/i18n/config.ts` (`localizePath`). Header navigation data
is built by `src/lib/site-nav.ts` (`buildNavigation`) from the domain registry and the content; the
footer and the AI solutions page still use the service grouping in `src/lib/navigation.ts`.

## Main navigation

Every destination appears once per navigation area (header, mobile sheet, footer).

| Entry | BG | EN | Destination |
| --- | --- | --- | --- |
| Services ▾ | Услуги | Services | **mega-menu**: three band columns (AI systems · Engineering and platforms · Operations and advisory) with every published domain hub (name + one-line summary) and, under each, the existing services whose primary domain it is; a fourth column **Start here**: Technical audit, AI readiness assessment, Opportunity Finder (each only while available) and "All services" (`/uslugi` ↔ `/en/services`) |
| Solutions ▾ | Решения | Solutions | AI solutions (`/ai-resheniya`), AI agent library (`/ai-agenti`, while the tool is available) |
| Tools | Инструменти | Tools | hub `/bg/instrumenti` ↔ `/en/tools` |
| Industries | За кого | Industries | `/bg/za-kogo` ↔ `/en/industries` |
| Insights | Статии | Insights | `/bg/statii` ↔ `/en/insights` |
| Company ▾ | Компания | Company | Who we are (`/za-nas`), Founder (`/za-nas/osnovatel`), How we work (`/proces`), Contact (`/kontakti`) — replaces "About ▾"; URLs unchanged |
| CTA | Заяви консултация | Book a consultation | `/bg/kontakti` ↔ `/en/contact` |

Every destination of the previous header (nine services, all services, AI solutions, tools,
industries, insights, about, process, contact) is still reachable from the desktop header and the
mobile sheet (migration test in `Header.test.tsx`).

**Desktop behaviour:** one open panel at a time; outside click and Escape close it, and Escape
returns focus to the trigger; ArrowUp/ArrowDown move within a menu column (wrapping), Home/End
jump to the first/last link, Tab keeps the normal order. The mega-menu spans the width below the
sticky header and scrolls when the viewport is short; every link is ≥ 44 px tall.

**Active states:** a link is `aria-current="page"` only when it is the most specific match for the
current URL (the founder page does not also mark "Who we are"); a menu trigger shows the active
style (`data-active`) when its section contains the current page (Services: every `/uslugi` page).

**Mobile:** one sheet with accordion groups in the header order (Services → three bands with
domains and their services, Start here, All services; Solutions; the plain links; Company), the
language switch and the CTA pinned at the bottom. Only one group is open at a time, and the group
of the current page opens first. While open: page scroll locked, the rest of the page is `inert`,
focus starts on the first control, Escape closes and returns focus to the toggle; every link is
≥ 44 px tall.

Footer: AI services · E-commerce foundation (+ all services) · Company (AI solutions, Tools,
Industries, How we work, About, Insights, Contact) · Legal.

## Services

| Service (nav label BG / EN) | Key | BG slug | EN slug | Status |
| --- | --- | --- | --- | --- |
| AI стратегия и готовност / AI strategy & readiness | `audit` | `tehnicheski-odit` | `technical-audit` | existing page, retitled (offering: "recommended first step") |
| Разработка на AI агенти / AI agent development | `ai_agents` | `razrabotka-na-ai-agenti` | `ai-agent-development` | **new** service page |
| AI автоматизация на процеси / AI workflow automation | `automation` | `avtomatizatsiya-na-procesi` | unchanged | existing page, retitled |
| AI разработка по поръчка / Custom AI engineering | `ai_tools` | `ai-instrumenti-za-biznesa` | unchanged | existing page, retitled |
| AI интеграции и данни / AI integrations & data systems | `integrations` | `api-integratsii-oblak-i-sigurnost` | unchanged | existing page, retitled |
| AI Managed Services и оптимизация / AI Managed Services & optimisation | `ai_managed` | `ai-managed-services` | `ai-managed-services` | existing dedicated page |
| Поддръжка, SEO, анализи / Maintenance, SEO, analytics | `maintenance`, `seo`, `analytics` | unchanged | unchanged | e-commerce foundation group |

Only titles changed for existing services; every SEO primary keyword stays in its `metaTitle`
(enforced by `content/seo-map.test.ts`).

### Service-page template (`uslugi/[slug]/page.tsx`)

Hero (title, intro, quote CTA, concept diagram, summary strip) → **business problem** (`signals`) →
**solution approach** (`approach`, 3 steps) → **technical capabilities** (`capabilities`) →
**use cases** (`useCases`, scenarios only) → technical checks (`checks`) → deliverables and
engagement → **delivery process** (`workflow`, inputs) → FAQ + **related tools** (`SERVICE_TOOLS`) →
related articles → related services → **CTA** (contact with the service preselected). Between
deliverables and the delivery process: the published **assessments and workshops** of the
service's primary domain (only when there are any) and, for build services, the **managed
operation** panel linking AI Managed Services.

Content: `content/{bg,en}/services.ts` (base), `services-depth.ts` (headings, checks, workflow,
inputs, articles), `services-template.ts` (approach, use cases). EN is typed against BG.

### Service domains (hubs)

The ten domains of [SERVICE_TAXONOMY.md](SERVICE_TAXONOMY.md) group the services. Hubs share the
`uslugi` namespace with the service pages: `/bg/uslugi/<bg-domain-slug>` ↔
`/en/services/<en-domain-slug>`. Domain slugs never equal a service slug (tested).

* **Registry:** `src/lib/domains.ts` holds ids A–J, bands, family statuses and links, related
  domains, tools, primary and also-listed services, the contact pre-selection and a `published`
  flag. The texts are in `content/{bg,en}/domains.ts`.
* **Route:** `uslugi/[slug]/page.tsx` renders a published hub with `components/sections/DomainHub.tsx`.
  Unpublished hubs are not generated, linked or listed in the sitemap.
* **Hub sections:**
  1. Hero: band, positioning, status, CTA to the contact form with the closest service
     pre-selected.
  2. Who it is for.
  3. Problems.
  4. Service families with status chips and links to the existing service pages or to the domain
     that delivers them.
  5. Assessments and workshops of the domain from the published catalogue; with none published,
     a plain statement and a contact link (no invented offers).
  6. Deliverables.
  7. Engagement models.
  8. Prerequisites and limitations.
  9. Related domains.
  10. Live tools.
  11. CTA band.

  There is no FAQ yet.
* **Services index:** a "Ten service domains" section shows three bands: AI systems,
  Engineering and platforms, Operations and advisory. It sits above the existing service showcase.
* **Breadcrumbs:** a service page shows Home → Services → its primary domain → service. This
  includes AI Managed Services under "Managed AI & Platform Operations".
* **Navigation:** the header, mobile and footer navigation are unchanged, with two service groups.
  The move to bands is phase IA-1.

### Service catalogue on the website (route coverage)

All service routes share `/bg/uslugi/<slug>` ↔ `/en/services/<slug>`. Data: `src/lib/catalogue.ts`.

| Page | Route | Source | Rendering |
| --- | --- | --- | --- |
| Services index (domain bands, showcase, **full catalogue** with type and domain filters) | `uslugi/page.tsx` | TypeScript content + published catalogue | prerendered at build, regenerated every 300 s |
| Ten domain hubs | `uslugi/[slug]` | TypeScript content (`domains.ts`); the assessments-and-workshops block from the catalogue | prerendered, 300 s |
| Eight existing service pages | `uslugi/[slug]` | TypeScript content (unchanged template) | prerendered, 300 s |
| AI Managed Services | `uslugi/ai-managed-services` | TypeScript content | static (dedicated route) |
| Assessments, workshops and services that exist only in the catalogue | `uslugi/[slug]` → `OfferingPage` | public catalogue API | rendered on first request, cached, 300 s |
| Unknown or malformed slug | `uslugi/[slug]` | — | 404 (no API call for malformed slugs or slugs missing from the cached list) |

Rules:

* **Source of truth.** The TypeScript content stays authoritative for the ten domains and the nine
  existing services (phase S5 of SERVICE_CATALOGUE_ARCHITECTURE.md is still open). A catalogue
  entry with the same key never overrides them. Catalogue-only entries are shown when their
  primary domain is a published hub and their slugs are valid and do not collide with an
  existing service or hub slug in either language.
* **Build without the API.** `next build` never needs the API: the fetch fails fast and the pages
  are built from the TypeScript content. At runtime the catalogue is fetched with a 300 s cache
  (tag `catalogue`). If the API is down, the pages keep showing the TypeScript content.
* **On-demand refresh.** `POST /api/catalogue-revalidate` with `X-Revalidate-Secret`
  (`CATALOGUE_REVALIDATE_SECRET`) regenerates the catalogue pages at once. Without the variable
  the endpoint answers 404 and pages refresh every 300 s. The API does not call it yet.
* **Entry page.** Type, status (when not available), name, summary, format, domain and duration;
  body; capabilities; deliverables; engagement format with the pricing note; related services and
  other assessments and workshops (published only); the managed-operation panel when the domain
  continues as a managed service; CTA to the contact form with the domain's lead category.
* **Language switch.** Catalogue-only slugs are not in the static slug map; the switcher uses the
  page's own hreflang alternate instead of the other language's homepage.
* **Legacy URLs and redirects** are unchanged: no existing route was removed or renamed.

## Interactive tools

`src/lib/tools.ts` is the registry (`TOOLS`, `TOOL_SLUGS`). A tool is linked and routed only when
`isToolAvailable` holds: status `live`, a path, and its flag on (`src/lib/feature-flags.ts`,
overridable with `TOOL_FLAGS`). Hosted tools under `/instrumenti/[tool]` use `dynamicParams = false`,
so unbuilt slugs return 404. Texts: `content/{bg,en}/tools.ts` and `content/{bg,en}/tool-*.ts`.
Details: [TOOLS_PLATFORM.md](TOOLS_PLATFORM.md).

| Tool | BG | EN |
| --- | --- | --- |
| AI Automation Advisor | `/bg/ai-automation-advisor` | `/en/ai-automation-advisor` |
| AI readiness assessment | `/bg/instrumenti/ai-gotovnost` | `/en/tools/ai-readiness` |
| Build your AI team | `/bg/instrumenti/ai-ekip` | `/en/tools/ai-team` |
| AI ROI calculator | `/bg/instrumenti/roi-kalkulator` | `/en/tools/roi-calculator` |
| Automation Opportunity Finder | `/bg/instrumenti/avtomatizatsii` | `/en/tools/automation-finder` |
| AI Solution Builder | `/bg/instrumenti/ai-reshenie` | `/en/tools/solution-builder` |
| AI Agent Library (index + 10 agent pages) | `/bg/ai-agenti[/slug]` | `/en/ai-agents[/slug]` |

All seven are live, so the hub's "in preparation" section is not rendered.

`SERVICE_TOOLS` lists the tools offered on each service page, most relevant first:

* `ai_agents`: advisor, team, solution, agents
* `automation`: finder, roi, advisor
* `ai_tools`: advisor, readiness
* `integrations`: advisor, solution
* `ai_managed`: readiness
* `audit`: readiness, finder, advisor
* `analytics`: roi
* `maintenance`, `seo`: none

## Conversion flows

* Header/footer CTA → contact (consultation).
* Service pages → `contactWithService` / `quoteWithService` (service preselected, quote mode).
* Tools → consultation:
  * the Advisor (assessment → consultation hand-off);
  * readiness and AI team (optional submission → lead);
  * ROI, Finder and Solution Builder (contact CTA; the visitor's inputs are not sent).
* Tool → tool:
  * Finder → ROI (process name through `sessionStorage`) and → AI team;
  * AI team → ROI (cost fields only);
  * Agent Library → Solution Builder (`?w=<workflow>`) and → AI team.
* AI Managed Services page → its own inquiry form (unchanged).

## Route changes

Routes added after the revision below (2026-10-24 → 2026-10-27), with no renames or removals:

* `/instrumenti/{ai-gotovnost,ai-ekip,roi-kalkulator,avtomatizatsii,ai-reshenie}` ↔
  `/tools/{ai-readiness,ai-team,roi-calculator,automation-finder,solution-builder}`;
* `/ai-agenti[/slug]` ↔ `/ai-agents[/slug]`;
* the staff-only `/admin/operations`;
* the ten domain hubs `/uslugi/<domain-slug>` ↔ `/services/<domain-slug>` (generated by
  `uslugi/[slug]`).

All of them are in the sitemap with reciprocal hreflang, except the admin page.

### Revision 2026-10-24

| Change | BG | EN | Notes |
| --- | --- | --- | --- |
| Added | `/bg/instrumenti` | `/en/tools` | tools hub; `EN_SEGMENTS.instrumenti = "tools"`; in sitemap and keyword map |
| Added | `/bg/uslugi/razrabotka-na-ai-agenti` | `/en/services/ai-agent-development` | new service; generated by `uslugi/[slug]` |
| Changed | — | — | none: no existing URL was renamed or removed, so no redirects are needed |

The Advisor's breadcrumb parent moved from "AI solutions" to "Tools" (URL unchanged).

API: lead service `ai_agents` added (`ServiceKey`, Alembic migration `0005`, notification label,
mock next step), so inquiries from the new service page are stored with the right category.
