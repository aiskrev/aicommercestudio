# Information architecture v2

**Status:** design specification. **No route is implemented by this document.**

**Baseline:** `main` @ `52bf6e1`. Current IA: [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md).
URL mechanics: [INTERNATIONALIZATION.md](INTERNATIONALIZATION.md). Domains:
[SERVICE_TAXONOMY.md](SERVICE_TAXONOMY.md). Modules: [PRODUCT_MODULES.md](PRODUCT_MODULES.md).

## 1. Principles

1. **No historical URL changes.** Every route that exists today keeps its BG and EN URL, its
   canonical and its hreflang pair. v2 only adds routes, navigation and links.
2. **One canonical per page and language.** Bulgarian segments are the internal route tree. English
   URLs come from `EN_SEGMENTS` / `EN_SUBSEGMENTS` and per-content slug maps (`i18n/config.ts`,
   `lib/locale-routing.ts`).
3. **Nothing is published before it has substance.** New page types follow the existing guards:
   the tool registry's "available only" rule, the case-study publish guard, and the thin-topic
   `noindex` rule.
4. **Illustrative is labelled as illustrative.** Reference scenarios and architectures are never
   presented as client work. Case studies stay behind `publishableCaseStudies`.
5. **Reuse before adding.** Domain hubs reuse the service-page building blocks. Discovery reuses
   the agent-library filter pattern. Recommendations reuse `SERVICE_TOOLS`, related services and
   related articles.

## 2. Verified current state (what v2 builds on)

| Mechanism | Where | Behaviour |
| --- | --- | --- |
| Locale proxy | `src/proxy.ts` → `lib/locale-routing.ts::decideRoute` | `/` → `/{cookie or bg}` (307). Unprefixed legacy URLs → `/bg/...` (308). Bulgarian segments under `/en` → English URL (308). `/en/*` is rewritten to the internal BG tree. `/admin/*` requires the session cookie, otherwise login. |
| Segment maps | `i18n/config.ts` | 13 top-level segments. Sub-segments for `statii/tema`, `instrumenti/<tool>` and `ai-agenti/<agent>`. Service, article and topic slugs come from content (`SlugMap`). |
| Metadata | `lib/seo.ts::buildMetadata` | self-canonical; hreflang for `availableIn` locales + `x-default` → BG; OG/Twitter incl. image; optional `noindex` |
| Sitemap / robots | `app/sitemap.ts`, `app/robots.ts` | Static paths, available tools, agent library, services, articles, indexable topics, published case studies. Robots disallows `/admin` and `/api/`. |
| `noindex` today | legal pages (`legal.isDraft`), topic pages with fewer than 2 articles, admin (`index:false, follow:false`) | omitted from the sitemap |
| 404 by design | `/proekti` (no published case study), unknown tool or agent slugs (`dynamicParams = false`), catch-all `[...rest]` | — |
| Navigation | `app/[locale]/layout.tsx`, `lib/navigation.ts`, `components/layout/{Header,Footer}.tsx` | Services ▾ (AI services: 6; e-commerce foundation: 3), AI solutions, Tools, Industries, Insights, About ▾ (About, Process), CTA "Book a consultation" |

## 3. Site map (v2)

Legend:

* **Live:** exists today.
* **Extend:** same URL, more content or links.
* **New:** to build.
* **Conditional:** built only when the stated content threshold is met.

```
Home  /bg ↔ /en                                                            [live → extend]
├─ Services  /uslugi ↔ /services                                           [live → extend: grouped by domain, filters]
│  ├─ 10 domain hubs  /uslugi/<domain> ↔ /services/<domain>                [new]
│  └─ 9 service pages  /uslugi/<service> ↔ /services/<service>             [live → extend: domain breadcrumb]
│     └─ AI Managed Services  /uslugi/ai-managed-services                  [live]
├─ Solutions
│  ├─ AI solutions  /ai-resheniya ↔ /ai-solutions                          [live]
│  ├─ AI Agent Library  /ai-agenti[/<agent>] ↔ /ai-agents[/<agent>]        [live]
│  ├─ Reference architectures  /arhitekturi[/<slug>] ↔ /architectures[/<slug>]   [new, conditional]
│  └─ Illustrative scenarios  /stsenarii[/<slug>] ↔ /scenarios[/<slug>]    [new, conditional]
├─ Tools & assessments  /instrumenti ↔ /tools                              [live → extend: assessment entry]
│  ├─ 5 hosted tools  /instrumenti/<tool> ↔ /tools/<tool>                  [live]
│  └─ AI Automation Advisor  /ai-automation-advisor                        [live]
├─ Industries  /za-kogo ↔ /industries                                      [live → extend]
│  ├─ Industry pages  /za-kogo/<slug> ↔ /industries/<slug>                 [new, conditional]
│  └─ Business problems  /problemi[/<slug>] ↔ /problems[/<slug>]           [new, conditional]
├─ Insights  /statii ↔ /insights  (+ articles, topics)                     [live]
├─ Case studies  /proekti ↔ /case-studies                                  [live gate: 404 until verified]
├─ Company
│  ├─ About  /za-nas ↔ /about                                              [live]
│  ├─ Engineering methodology  /proces ↔ /process                          [live → extend]
│  ├─ Security & trust  /sigurnost ↔ /security                             [new]
│  └─ Workshops  /rabotni-sreshti ↔ /workshops                             [conditional; until then a section of domain J]
├─ Contact  /kontakti ↔ /contact (?usluga= / ?service=, &tip=oferta / &type=quote)   [live]
└─ Legal  /poveritelnost, /biskvitki, /obshti-usloviya ↔ /privacy, /cookies, /terms  [live, noindex while draft]

Not public:  /admin/*  (staff, noindex, robots-disallowed)          [live]
             /portal/* (clients, noindex, robots-disallowed)        [planned: IMPLEMENTATION_DEPENDENCIES_V2 P3–P4]
```

## 4. Navigation

### 4.1 Desktop header

The header has six items plus the CTA, down from 7 + CTA, so it fits at 1024 px in Bulgarian:

| # | BG | EN | Type | Content |
| --- | --- | --- | --- | --- |
| 1 | Услуги ▾ | Services ▾ | mega-menu | §4.2 |
| 2 | Решения ▾ | Solutions ▾ | menu | AI solutions · Agent library · Reference architectures · Illustrative scenarios (the last two only once published) |
| 3 | Инструменти | Tools | link | the hub (assessments are reachable from it and from domain J) |
| 4 | За кого ▾ | Industries ▾ | menu | Industries · Business problems (once published) |
| 5 | Статии | Insights | link | — |
| 6 | Компания ▾ | Company ▾ | menu | About · Engineering methodology · Security & trust · Contact |
| CTA | Заявете консултация | Book a consultation | primary button | `/kontakti` ↔ `/contact` |

The current "About ▾" (About, Process) becomes "Company ▾". The URLs are unchanged.

### 4.2 Services mega-menu

* **Three columns:** one per band (SERVICE_TAXONOMY / CONTENT_STRATEGY §5.3). Each domain is a link
  with a one-line description; its existing services appear under it as secondary links.
* **Fourth column, "Start here":**
  * Technical audit (J);
  * AI readiness assessment (tool);
  * Opportunity Finder (tool);
  * "All services".

| Band | BG | EN | Domains (existing services under them) |
| --- | --- | --- | --- |
| AI systems | AI системи | AI systems | A (audit*), B (ai_agents, automation), C (ai_tools), H |
| Engineering and platforms | Инженеринг и платформи | Engineering and platforms | D (maintenance, seo, analytics), E, F, G (integrations) |
| Operations and advisory | Операции и консултации | Operations and advisory | I (ai_managed), J (audit*) |

\* `audit` appears once, under J, and A links to it from its hub (decision D1 pending).

**Behaviour** (reusing the current menu implementation):

* one open panel at a time;
* opens on click; hover intent is optional;
* Escape closes it and returns focus to the trigger;
* arrow keys move within a column;
* outside click closes it;
* `.menu-enter` animation with a reduced-motion fallback;
* links ≥ 44 px tall;
* domains whose hub is not published are not rendered (a `domainAvailable` flag, the same principle
  as `isToolAvailable`).

### 4.3 Mobile navigation

The mobile menu is a full-height sheet (the existing `inert` + focus-trap implementation) with
accordion groups in the same order as the header. Services expands into the three bands. The
language switch and the CTA are pinned at the bottom of the sheet. The sticky quote bar on content
pages is unchanged.

### 4.4 Footer

Four columns:

1. AI systems
2. Engineering and platforms
3. Operations and advisory (+ Tools, AI solutions, Agent library)
4. Company and legal: About, Methodology, Security, Insights, Contact, Privacy, Cookies, Terms,
   plus the draft note while `legal.isDraft`.

### 4.5 Breadcrumbs (BreadcrumbList JSON-LD = the visible trail)

| Page type | Trail |
| --- | --- |
| Domain hub | Home → Services → *Domain* |
| Service page | Home → Services → *Domain* → *Service* (domain level added; the URL is unchanged) |
| AI Managed Services | Home → Services → Managed AI & Platform Operations → AI Managed Services |
| Tool | Home → Tools → *Tool* (unchanged) |
| Advisor | Home → Tools → AI Automation Advisor (unchanged) |
| Agent library / agent | Home → Solutions *(no link; label only)* → Agent library → *Agent*. Today the trail is Home → Tools → …; the change affects JSON-LD only. |
| Reference architecture / scenario | Home → Solutions → Reference architectures / Illustrative scenarios → *Item* |
| Industry / problem | Home → Industries → *Industry*; Home → Industries → Business problems → *Problem* |
| Article / topic | unchanged |
| Methodology / security | Home → Company → *Page* (the Company level is a label) |

## 5. Discovery and recommendations

### 5.1 Contextual recommendations

Rules are deterministic and computed at build time from tags; there are no tracking-based
recommendations. Each content type carries `domains: DomainKey[]`. Articles keep their existing
`relatedServices`.

| On page | Show | Source |
| --- | --- | --- |
| Domain hub | its families → existing services; 2–4 related domains; live tools of the domain; reference architectures and scenarios tagged with it; up to 3 articles | `lib/domains.ts` (planned), `SERVICE_TOOLS`, tags |
| Service page | its domain hub; related services (existing); tools (`SERVICE_TOOLS`, existing); articles (existing) | existing + domain |
| Tool result | the domain hubs the tool feeds (SERVICE_TAXONOMY §3) and the closest service CTA | tool registry |
| Agent page | the Solution Builder with `?w=` (existing); domain B; architectures that use the agent | existing + tags |
| Industry / problem page | 2–4 domains; tools; scenarios with the same tags | tags |
| Article | related services (existing) + the domain hub of the first related service | existing + derived |

### 5.2 Service discovery (`/uslugi` ↔ `/services`)

* The page lists domain cards in three bands, with each domain's services as rows.
* **Client-side filters** reuse the `AgentLibraryBrowser` pattern:
  * band;
  * engagement model (assessment, workshop, architecture, implementation, managed service);
  * status (available, custom engagement);
  * free-text search over names and positioning.
* **Filters do not create indexable URLs.** State is kept in the component, or in query parameters
  that the canonical ignores. The canonical stays `/uslugi` ↔ `/services`, and the sitemap lists
  only the unfiltered page.
* **Empty state:** "No services match these filters" plus a reset, as in the agent library.

## 6. CTAs

| Page type | Primary CTA | Secondary CTA |
| --- | --- | --- |
| Home | Book a consultation | Try the AI Automation Advisor / Start the readiness assessment |
| Domain hub | domain CTA from SERVICE_TAXONOMY (e.g. "Request a technical store audit") → contact with the closest `usluga` | "Request a quote" (`tip=oferta`) or the domain's tool |
| Service page | Request a quote (existing) | Book a consultation (existing) |
| AI Managed Services | Request an AI assessment (existing `#ams-inquiry`) | Explore services (existing) |
| Tools hub / tool result | run the tool / hand the result to the team (existing consent flows) | the related domain hub |
| Agent library / agent | Use it in the Solution Builder (existing) | Book a consultation |
| Reference architecture / scenario | Discuss a similar system → contact with the domain's service | the related tool (Solution Builder, ROI) |
| Industry / problem | Book a consultation | the most relevant tool |
| Article | inline CTA (existing) | related service |
| Methodology / security | Book a consultation | Request a technical audit |
| Contact | submit (existing) | — |

Contact pre-selection uses the existing `usluga` / `service` parameter. Domain-level categories
wait for decision D4 (an API enum and a migration). Until then each domain maps to its primary
existing service key; E, F and H map to `integrations` / `ai_managed` / `audit`, as listed in the
matrix.

## 7. Canonical, hreflang and indexability

**Canonical.** Every page is self-canonical in its own language. Query parameters are never part
of the canonical, and that includes the tool share codes `?s=`, `?t=`, `?r=` and `?w=`.

**Hreflang.**

* `bg`, `en` and `x-default` → BG, emitted only for locales in which the page exists
  (`availableIn`, as articles do today).
* New content types must register their slugs in a `SlugMap`-style map, so the language switcher
  (`alternateLocalePath`) and the sitemap alternates resolve.

**Indexability.**

| Rule | Pages |
| --- | --- |
| index, in the sitemap | home; services index; domain hubs (once published); service pages; AI solutions; agent library + agents; tools hub + hosted tools + Advisor; industries hub; insights + articles; indexable topics; process; about; security; contact; published architectures, scenarios, industry and problem pages |
| `noindex, follow`, not in the sitemap | draft legal pages; topic pages with fewer than 2 articles; any new conditional page type below its content threshold (§9) |
| 404 (not rendered) | `/proekti` and `/proekti/<slug>` until a verified, approved case study exists; unpublished domain hubs; unknown slugs (`dynamicParams = false`) |
| `noindex, nofollow`, robots `Disallow` | `/admin/*`; `/portal/*` (to add to `robots.ts`); `/api/` |

**Content thresholds** for conditional pages are enforced by tests, like the thin-topic rule:

* Industry page: at least 3 named problems, 3 linked domains and an FAQ.
* Problem page: at least 400 words of specific guidance, 2 linked domains and 1 tool.
* Architecture: a diagram with a caption, at least 5 components with responsibilities, a security
  section and an "illustrative" label.
* Scenario: the "illustrative scenario — not a client project" label, assumptions, steps, and the
  approvals and risks involved.

## 8. Route matrix

**Access:**

* **public:** indexable as in §7.
* **public-noindex:** reachable but excluded.
* **staff:** admin session.
* **client:** portal session (planned).

**Status:**

* **live:** exists unchanged.
* **extend:** same URL, more content or links.
* **new:** to build.
* **conditional:** new, published only above the threshold.
* **planned:** depends on platform phases.

Slugs marked "(proposed)" are subject to content review. All existing slugs are verified against
the code.

### 8.1 Core pages

| BG URL | EN URL | Purpose | Content source | Access | Status | Primary CTA |
| --- | --- | --- | --- | --- | --- | --- |
| `/bg` | `/en` | positioning, domain entry points, tools, trust | `content/*/home.ts` | public | extend (domain bands, D7) | Book a consultation |
| `/bg/uslugi` | `/en/services` | all domains and services, filters | `content/*/services.ts` + `domains.ts` (planned) | public | extend | Book a consultation |
| `/bg/ai-resheniya` | `/en/ai-solutions` | how we design AI systems; AI domain index | `content/*/pages.ts` (`aiSolutions`) | public | extend (links to A, B, C, H) | Book a consultation |
| `/bg/ai-agenti` | `/en/ai-agents` | agent role catalogue with filters | `lib/agent-library.ts`, `content/*/agent-library.ts` | public | live | Use it in the Solution Builder |
| `/bg/ai-agenti/<agent>` (e.g. `obrabotka-na-dokumenti`) | `/en/ai-agents/<agent>` (`document-processing-agent`) | one agent role (10) | same + `tool-team.ts` | public | live | Use it in the Solution Builder |
| `/bg/instrumenti` | `/en/tools` | tools and assessments hub | `lib/tools.ts`, `content/*/tools.ts` | public | extend (assessment entry, domain links) | run a tool |
| `/bg/instrumenti/ai-gotovnost` | `/en/tools/ai-readiness` | AI readiness assessment | `tool-readiness.ts`, API `/api/public/readiness` | public | live | Send the result to the team |
| `/bg/instrumenti/ai-ekip` | `/en/tools/ai-team` | Build your AI team | `tool-team.ts`, API `/api/public/team` | public | live | Request a consultation |
| `/bg/instrumenti/roi-kalkulator` | `/en/tools/roi-calculator` | ROI calculator | `tool-roi.ts` | public | live | Book a consultation |
| `/bg/instrumenti/avtomatizatsii` | `/en/tools/automation-finder` | Opportunity Finder | `tool-finder.ts` | public | live | Calculate the effect (ROI) |
| `/bg/instrumenti/ai-reshenie` | `/en/tools/solution-builder` | AI Solution Builder | `tool-solution.ts` | public | live | Book a consultation |
| `/bg/ai-automation-advisor` | `/en/ai-automation-advisor` | AI Automation Advisor | `advisor.ts`, API `/api/public/advisor` | public | live | Request a consultation |
| `/bg/za-kogo` | `/en/industries` | segments we serve | `pages.ts` (`industries`) | public | extend (links to industry and problem pages) | Book a consultation |
| `/bg/statii` | `/en/insights` | article index | `articles*.ts`, `editorial.ts` | public | live | — |
| `/bg/statii/<slug>` (6) | `/en/insights/<slug>` | article | `articles*.ts` | public | live | inline CTA |
| `/bg/statii/tema/<topic>` (5) | `/en/insights/topic/<topic>` | topic | `editorial.ts` | public / public-noindex (< 2 articles) | live | — |
| `/bg/proekti`, `/bg/proekti/<slug>` | `/en/case-studies[/<slug>]` | verified case studies only | `editorial.ts` (`publishableCaseStudies`) | 404 until published | live gate | Discuss a similar project |
| `/bg/proces` | `/en/process` | engineering methodology: delivery, quality gates, approvals, handover | `pages.ts` (`process`) | public | extend | Request a technical audit |
| `/bg/za-nas` | `/en/about` | who we are | `pages.ts` (`about`) | public | live | Book a consultation |
| `/bg/kontakti` | `/en/contact` | inquiry and quote form (`?usluga=`/`?service=`, `&tip=oferta`/`&type=quote`) | `ContactForm`, API `/api/public/leads`, `/quote-requests` | public | live | Submit |
| `/bg/poveritelnost`, `/bg/biskvitki`, `/bg/obshti-usloviya` | `/en/privacy`, `/en/cookies`, `/en/terms` | legal | `legal.ts` | public-noindex while draft | live (T2) | — |
| `/bg/sigurnost` (proposed) | `/en/security` | security and trust: data handling, approval policy, secrets, tenancy, retention, disclosure contact | new `content/*/security.ts` from `SECURITY.md` | public | new | Book a consultation |
| `/bg/rabotni-sreshti` (proposed) | `/en/workshops` | workshop formats (discovery, approval design, architecture) | new content; until then a section on hub J | public | conditional (≥ 3 formats with their own agenda and outputs) | Book a workshop |
| `/admin/*` | same (no locale; admin language cookie) | staff: leads, AI approvals, activity, AI operations scaffold, account | `components/admin/*`, `/api/admin`, `/api/ops` | staff | live | — |
| `/portal/*` | same (no locale; language preference) | clients: organisations, registry, incidents, reports | AI_OPERATIONS_PORTAL.md | client | planned (P3–P4) | — |

### 8.2 Services: domain hubs and existing service pages

Domain slugs are from SERVICE_TAXONOMY §2. Contact pre-selection for a domain uses its primary
existing service until D4.

| BG URL | EN URL | Purpose | Content source | Access | Status | Primary CTA → contact `usluga` |
| --- | --- | --- | --- | --- | --- | --- |
| `/bg/uslugi/ai-strategiya-i-transformatsiya` | `/en/services/ai-strategy-and-transformation` | domain A hub | `domains.ts` (planned) | public | new | Request an AI readiness assessment → `audit` |
| `/bg/uslugi/ai-agenti-i-biznes-avtomatizatsiya` | `/en/services/ai-agents-and-business-automation` | domain B hub | same | public | new | Describe the process → `automation` |
| `/bg/uslugi/ai-prilozheniya-i-sistemi-za-znaniya` | `/en/services/ai-applications-and-knowledge-systems` | domain C hub | same | public | new | Discuss an AI application → `ai_tools` |
| `/bg/uslugi/inzhenering-za-elektronna-targoviya` | `/en/services/commerce-engineering` | domain D hub | same | public | new | Request a technical store audit → `audit` |
| `/bg/uslugi/oblachen-i-platformen-inzhenering` | `/en/services/cloud-and-platform-engineering` | domain E hub | same | public | new | Discuss a cloud platform → `integrations` |
| `/bg/uslugi/devops-sre-i-nablyudaemost` | `/en/services/devops-sre-and-observability` | domain F hub | same | public | new | Request a delivery and observability review → `integrations` |
| `/bg/uslugi/inzhenering-na-danni-i-integratsii` | `/en/services/data-and-integration-engineering` | domain G hub | same | public | new | Describe the systems → `integrations` |
| `/bg/uslugi/ai-upravlenie-sigurnost-i-nadezhdnost` | `/en/services/ai-governance-security-and-assurance` | domain H hub | same | public | new | Request an AI system risk review → `audit` |
| `/bg/uslugi/upravlyavani-ai-i-platformeni-operatsii` | `/en/services/managed-ai-and-platform-operations` | domain I hub | same | public | new | Request an AI assessment → `ai_managed` |
| `/bg/uslugi/konsultatsii-otsenki-i-obuchenie` | `/en/services/advisory-assessments-and-enablement` | domain J hub | same | public | new | Request a technical audit → `audit` |
| `/bg/uslugi/tehnicheski-odit` | `/en/services/technical-audit` | service `audit` | `services*.ts` | public | extend (domain breadcrumb) | Request a quote → `audit` |
| `/bg/uslugi/razrabotka-na-ai-agenti` | `/en/services/ai-agent-development` | service `ai_agents` | same | public | extend | → `ai_agents` |
| `/bg/uslugi/avtomatizatsiya-na-procesi` | `/en/services/business-process-automation` | service `automation` | same | public | extend | → `automation` |
| `/bg/uslugi/ai-instrumenti-za-biznesa` | `/en/services/custom-ai-tools` | service `ai_tools` | same | public | extend | → `ai_tools` |
| `/bg/uslugi/api-integratsii-oblak-i-sigurnost` | `/en/services/api-integrations-cloud-security` | service `integrations` | same | public | extend (+ links to E, H) | → `integrations` |
| `/bg/uslugi/ai-managed-services` | `/en/services/ai-managed-services` | service `ai_managed` (dedicated page) | `ai-managed.ts` | public | extend (domain breadcrumb) | Request an AI assessment (`#ams-inquiry`) |
| `/bg/uslugi/poddrazhka-na-online-magazini` | `/en/services/ecommerce-maintenance` | service `maintenance` | `services*.ts` | public | extend | → `maintenance` |
| `/bg/uslugi/seo-optimizatsiya` | `/en/services/seo-optimization` | service `seo` | same | public | extend | → `seo` |
| `/bg/uslugi/analizi-i-konversii` | `/en/services/analytics-and-conversion` | service `analytics` | same | public | extend | → `analytics` |

### 8.3 Conditional content types (slugs proposed)

| BG URL | EN URL | Purpose | Content source | Access | Status | Primary CTA |
| --- | --- | --- | --- | --- | --- | --- |
| `/bg/arhitekturi` | `/en/architectures` | index of reference architectures | new `content/*/architectures.ts` | public | conditional (≥ 3 published) | Discuss a similar system |
| `/bg/arhitekturi/rag-asistent-s-kontrol-na-dostapa` | `/en/architectures/rag-assistant-with-access-control` | illustrative architecture (C, H) | same | public | conditional | → `ai_tools` |
| `/bg/arhitekturi/agent-s-tochki-za-odobrenie` | `/en/architectures/agent-with-approval-gates` | (B, H) | same | public | conditional | → `ai_agents` |
| `/bg/arhitekturi/integratsiya-magazin-erp-schetovodstvo` | `/en/architectures/store-erp-accounting-integration` | (D, G) | same | public | conditional | → `integrations` |
| `/bg/arhitekturi/nablyudaemost-na-llm-prilozheniya` | `/en/architectures/llm-application-observability` | (F, I) | same | public | conditional | → `ai_managed` |
| `/bg/arhitekturi/platforma-za-malak-produktov-ekip` | `/en/architectures/platform-for-a-small-product-team` | (E, F) | same | public | conditional | → `integrations` |
| `/bg/stsenarii` | `/en/scenarios` | index of illustrative scenarios | new `content/*/scenarios.ts` | public | conditional (≥ 3 published) | Discuss a similar process |
| `/bg/stsenarii/priemane-na-faktury` | `/en/scenarios/invoice-intake` | illustrative: document intake with approval (B, C, G) | same | public | conditional | → `automation` |
| `/bg/stsenarii/obsluzhvane-na-zapitvaniya` | `/en/scenarios/customer-inquiry-handling` | illustrative: support with knowledge retrieval (B, C) | same | public | conditional | → `ai_agents` |
| `/bg/za-kogo/online-magazini` | `/en/industries/online-stores` | industry: online stores (D, G, B) | new `content/*/industries.ts` | public | conditional | Request a technical store audit |
| `/bg/za-kogo/lokalni-targovtsi` | `/en/industries/local-retailers` | industry: local retailers going online | same | public | conditional | Book a consultation |
| `/bg/za-kogo/biznesi-s-mnogo-ruchna-rabota` | `/en/industries/back-office-heavy-businesses` | segment: SMEs with manual back office (B, G) | same | public | conditional | Describe the process |
| `/bg/za-kogo/kompanii-s-ai-sistemi` | `/en/industries/companies-running-ai` | segment: companies already running AI (I, H) | same | public | conditional | Request an AI assessment |
| `/bg/problemi` | `/en/problems` | index of business problems | new `content/*/problems.ts` | public | conditional (≥ 4 published) | — |
| `/bg/problemi/ruchno-vavezhdane-mezhdu-sistemi` | `/en/problems/manual-data-entry-between-systems` | problem (B, G) | same | public | conditional | Describe the systems |
| `/bg/problemi/ai-pilot-bez-produktsiya` | `/en/problems/ai-pilot-not-in-production` | problem (A, C, H) | same | public | conditional | Request an AI readiness assessment |
| `/bg/problemi/baven-ili-nestabilen-magazin` | `/en/problems/slow-or-unstable-online-store` | problem (D, F) | same | public | conditional | Request a technical store audit |
| `/bg/problemi/riskovi-izdaniya-na-softuer` | `/en/problems/risky-software-releases` | problem (F, E) | same | public | conditional | Request a delivery review |
| `/bg/problemi/nevidimi-razhodi-za-ai` | `/en/problems/untracked-ai-costs` | problem (I, F) | same | public | conditional | Request an AI assessment |

## 9. Implementation phases and acceptance criteria

| Phase | Scope | Acceptance criteria |
| --- | --- | --- |
| IA-1 Navigation | Services mega-menu (three bands; domains hidden until published), Company ▾, Solutions ▾, mobile accordion, footer columns | Header and mobile tests updated. Keyboard: Escape returns focus, arrows within a column, one open panel. No horizontal overflow at 360/390/768/1024/1440 (BG strings). Every link resolves (links e2e). Existing `ia.spec.ts` expectations updated, not deleted. |
| IA-2 Domain hubs | `lib/domains.ts` + `content/{bg,en}/domains.ts`, hub template, services index bands and filters, domain breadcrumb on service pages | 10 hubs return 200 in BG/EN with reciprocal hreflang and self-canonical. Domain slugs never collide with service slugs (test). Language switcher maps hub ↔ hub. Hubs are in the sitemap; unpublished hubs return 404 and are absent. Keyword map extended and `seo-map.test.ts` green. Filtered states keep the base canonical. |
| IA-3 Methodology and security | extend `/proces`; new `/sigurnost` ↔ `/security` (`EN_SEGMENTS` entry) | Every claim traces to SECURITY.md or code. No certifications, SLAs or uptime claims (content test). Linked from the footer and the domain H hub. |
| IA-4 References | `/arhitekturi`, `/stsenarii` (+ EN segments, slug maps, sitemap, robots unchanged) | Every scenario page shows the illustrative label above the fold, and a test asserts it. No `Review`, `CaseStudy` or rating JSON-LD. Content thresholds (§7) enforced; below-threshold items return 404 or `noindex`. `/proekti` gate unchanged. |
| IA-5 Industries and problems | `/za-kogo/<slug>`, `/problemi[/<slug>]` | Thresholds enforced by tests. Every page links ≥ 2 domains and ≥ 1 tool. The industries hub links only published items. |
| IA-6 Portal entry | proxy rule for `/portal` (like `/admin`), robots `Disallow: /portal`, login link in the footer only after P3 | `/portal` without a session redirects to the portal login. It is never in the sitemap. `noindex, nofollow` (test). |

Each phase runs the full suite: typecheck, lint, Vitest, production build, e2e and the 5-width
overflow scan.

## 10. Migration and redirect risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A domain slug collides with a future service slug in the shared `/uslugi` namespace | wrong page or a build error | uniqueness test over services + domains in both locales (SERVICE_TAXONOMY §7) |
| The language switcher does not know the new content types | the switcher falls back to the section index | extend `SlugMap` / `alternateLocalePath` with domains, architectures, scenarios, industries, problems; unit tests per type (as for services today) |
| New top-level BG segments vs the legacy rule (unprefixed → `/bg/...`) | `/security` (EN word, unprefixed) → 308 `/bg/security` → 404 | acceptable (no historical URL). Optionally add explicit 308s from unprefixed EN words to `/en/...` if logs show traffic. |
| `/portal` today falls under the legacy rule (308 → `/bg/portal` → 404) | none today; wrong behaviour once the portal exists | IA-6 adds the proxy rule before any portal link is published |
| Splitting `audit` (D1) | keyword or URL loss | the service that keeps "технически одит на онлайн магазин" keeps `/uslugi/tehnicheski-odit`; the other gets a new slug. A 308 is needed only if the existing page's content moves. |
| Breadcrumb parent changes (agent library → Solutions; service → domain) | BreadcrumbList JSON-LD changes; URLs do not | no redirect needed; update the e2e and JSON-LD tests |
| Navigation restructure | existing e2e (`ia.spec`, `mobile.spec`, `Header.test`) assert the current menu | update the tests in the same PR; keep the assertions on keyboard behaviour |
| Thin new pages | index bloat, cannibalisation | conditional publication + `noindex` below thresholds + keyword map per page |
| Illustrative content mistaken for client work | trust and legal risk | label, no client names, no metrics, separate URL namespace from `/proekti`, content test |
| Filter query parameters on `/uslugi` | duplicate URLs | canonical ignores the query; parameters are not in the sitemap |

## 11. Outstanding decisions

| # | Decision | Default |
| --- | --- | --- |
| IA-D1 | Header label "Tools" vs "Tools & assessments" | "Tools" (shorter; assessments reachable from J) |
| IA-D2 | Show unpublished domains in the mega-menu as "planned" or hide them | hide (consistent with tools) |
| IA-D3 | Publish workshops as a page or keep them on hub J | keep on J until ≥ 3 formats |
| IA-D4 | Industry and problem pages: which ones first | online stores; manual data entry between systems |
| (D1, D4, D7) | from PLATFORM_VISION §10 | — |
