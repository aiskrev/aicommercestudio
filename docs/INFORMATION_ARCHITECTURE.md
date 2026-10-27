# Information architecture

> Describes the **current** IA (implemented). The next IA for the ten service domains — mega-menu, new page types,
> indexability rules and a route-by-route matrix — is designed in [INFORMATION_ARCHITECTURE_V2.md](INFORMATION_ARCHITECTURE_V2.md)
> (not implemented yet).

Routes live under `apps/web/src/app/[locale]/`; Bulgarian path segments are canonical and English
URLs are produced by `EN_SEGMENTS` in `src/i18n/config.ts` (`localizePath`). Navigation data is
assembled in `app/[locale]/layout.tsx`; the service grouping is shared in `src/lib/navigation.ts`.

## Main navigation

Every destination appears once per navigation area (header, mobile sheet, footer).

| Entry | BG | EN | Destination |
| --- | --- | --- | --- |
| Services ▾ | Услуги | Services | panel: **AI services** · **E-commerce foundation** · "All services" (`/uslugi` ↔ `/en/services`) |
| Solutions | AI решения | AI solutions | `/bg/ai-resheniya` ↔ `/en/ai-solutions` — how we design AI systems (agents, control, lifecycle) and the AI services index |
| Tools | Инструменти | Tools | **new** hub `/bg/instrumenti` ↔ `/en/tools` |
| Industries | За кого | Industries | `/bg/za-kogo` ↔ `/en/industries` — kept: segments include businesses already running an AI agent |
| Insights | Статии | Insights | `/bg/statii` ↔ `/en/insights` |
| About ▾ | За нас | About | panel: Who we are (`/za-nas`), How we work (`/proces`) |
| CTA | Заяви консултация | Book a consultation | `/bg/kontakti` ↔ `/en/contact` |

Mobile: one sheet with the same groups (AI services, E-commerce foundation, All services, the
links, About), language switch and the CTA. While open: page scroll locked, the rest of the page is
`inert`, focus starts on the first link, Escape closes and returns focus to the toggle; every link
is ≥ 44 px tall. Desktop panels: one open at a time, outside click and Escape close, Escape
returns focus to the trigger.

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
related articles → related services → **CTA** (contact with the service preselected).

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
  5. Deliverables.
  6. Engagement models.
  7. Prerequisites and limitations.
  8. Related domains.
  9. Live tools.
  10. CTA band.

  There is no FAQ yet.
* **Services index:** a "Ten service domains" section shows three bands: AI systems,
  Engineering and platforms, Operations and advisory. It sits above the existing service showcase.
* **Breadcrumbs:** a service page shows Home → Services → its primary domain → service. This
  includes AI Managed Services under "Managed AI & Platform Operations".
* **Navigation:** the header, mobile and footer navigation are unchanged, with two service groups.
  The move to bands is phase IA-1.

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
