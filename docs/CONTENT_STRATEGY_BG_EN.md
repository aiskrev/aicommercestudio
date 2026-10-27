# Content strategy (BG / EN)

**Status:** specification for a later implementation phase. No website content has changed yet.

**Inputs:**

* [PLATFORM_VISION.md](PLATFORM_VISION.md): positioning.
* [SERVICE_TAXONOMY.md](SERVICE_TAXONOMY.md): domains, slugs, SEO texts, statuses.
* [SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md): the current keyword map and indexation rules.
* [INTERNATIONALIZATION.md](INTERNATIONALIZATION.md): URL and locale mechanics.

## 1. Goals

1. Present the ten domains so a buyer understands, within one page:
   * what we build or run;
   * what they receive;
   * what they must provide;
   * what we will not promise.
2. Make cloud, DevOps, SRE and data engineering visible as full offerings, with the same depth as
   the AI domains.
3. Keep every existing page, URL and keyword. Add content; do not move it.
4. Keep the existing quality bar: BG and EN parity, no invented claims, tests that enforce both.

## 2. Voice

| Rule | Bulgarian | English |
| --- | --- | --- |
| Concrete over abstract | name the system, artefact or step („журнал на действията“, „конвейер за CI/CD“) | same ("audit log", "CI/CD pipeline") |
| Address | „вие“, lower case, plain and direct | "you", plain and direct |
| Sentences | short; one claim per sentence; active voice | same |
| Numbers | only facts we control (e.g. "12 въпроса", "3 сценария на разходите"); never outcomes | same |
| Technical terms | Bulgarian where an established term exists; keep RAG, DevOps, SRE, CI/CD, API, SLO in Latin script | standard industry terms |
| English text | written for English searches and readers, not translated word by word from BG | — |

### Terms to avoid

These terms promise without evidence. Content review rejects them (§9).

| BG | EN |
| --- | --- |
| революционен, иновативен, водещ, най-добрият | revolutionary, cutting-edge, leading, best-in-class |
| безпроблемен, безупречен, мигновено | seamless, flawless, instant |
| гарантиран ръст / ROI / позиции | guaranteed growth / ROI / rankings |
| напълно автономни агенти | fully autonomous agents |
| 24/7, неограничен, SLA (except in a disclaimer) | 24/7, unlimited, SLA (except in a disclaimer) |
| „отключете потенциала“, „трансформирайте бизнеса си“ | "unlock", "supercharge", "transform your business" |
| доверени от …, партньор на … (without proof) | trusted by …, partner of … (without proof) |

## 3. Claims policy

| Level | Allowed wording | Example |
| --- | --- | --- |
| **Fact we can show** | present tense, specific | "The readiness assessment has 12 questions in six dimensions." |
| **Capability** (we can do it; no client evidence) | "we design / build / set up …", in the context of a scoped engagement | "We describe the infrastructure as code and hand over the repository." |
| **Practice we use ourselves** | "how we work", "in our own platform" | "Our own platform runs its test suites in containers in CI." Never "our clients …". |
| **Planned** | "planned", plus the prerequisite | "Client portal: planned — after client accounts with MFA." |
| **Forbidden** | invented clients, results, partnerships, certifications, prices, response times | — |

Case studies stay behind the existing publish guard (`content/bg/editorial.ts`,
`publishableCaseStudies`). They appear only when a real, approved project exists.

## 4. Keywords and cannibalisation

**Rules** (already enforced for existing pages by `content/seo-map.test.ts`, and to be extended to
domains):

* Each primary keyword belongs to exactly one page.
* No page uses another page's primary keyword as a secondary keyword.
* The `<title>` contains the page's own primary keyword.
* Every mapped path is in the sitemap.

**Domain hubs target the broader, category-level query. Existing service pages keep their specific
queries.** All proposals are **unverified** (`volumeStatus: "unverified"`) until they are checked in
Keyword Planner or Search Console. The EN keywords are chosen for English searches.

| Domain | BG primary (proposed) | EN primary (proposed) | Existing pages it must not take over |
| --- | --- | --- | --- |
| A | AI стратегия | AI strategy | `/ai-resheniya` (изкуствен интелект за бизнеса / AI for business); `audit` |
| B | AI агенти и бизнес автоматизация | AI agents and business automation | `ai_agents` (разработка на AI агенти / AI agent development), `automation` (автоматизация на бизнес процеси / business process automation) |
| C | AI приложения | AI applications | `ai_tools` (AI инструменти по поръчка / custom AI tools); article „AI асистент за клиенти“ |
| D | инженеринг за онлайн магазини | commerce engineering | `maintenance`, `seo`, `analytics`, `/uslugi` (услуги за онлайн магазини) |
| E | облачна инфраструктура | cloud and platform engineering | `integrations` (API интеграции) |
| F | DevOps, SRE и наблюдаемост | DevOps, SRE and observability | — (new topic) |
| G | инженеринг на данни | data and integration engineering | `integrations` (API интеграции / API integrations) |
| H | сигурност на AI системи | AI governance | — (new topic) |
| I | управлявани AI системи | managed AI systems | `ai_managed` (поддръжка и мониторинг на AI агенти / AI agent monitoring) |
| J | технически консултации | technical advisory | `audit` (технически одит на онлайн магазин / technical audit of an online store) |

**Overlap to watch.**

* **I ↔ `ai_managed`:** the I hub describes all operations and links to the AMS page as the owner
  of "AI agent monitoring" queries.
* **B ↔ `ai_agents` / `automation`:** the B hub summarises; the service pages hold the depth.

**Homepage (decision D7).** The homepage keyword „AI решения за онлайн магазини“ / "AI solutions
for online stores" stays until the owner decides otherwise. Changing it means re-mapping the
keyword and is not part of this specification.

## 5. Page specifications

### 5.1 Domain hub page (new template)

| # | Section | Content source | Notes |
| --- | --- | --- | --- |
| 1 | Hero | BG/EN name, one-paragraph positioning, primary CTA | CTA text from SERVICE_TAXONOMY |
| 2 | Who it is for | ideal customers (2–4 items) | concrete situations, not industries in general |
| 3 | Problems | business problems | 4–6 items |
| 4 | Service families | table → cards with capabilities and a **status chip** (available / custom engagement / planned + prerequisite) | existing services are linked from their family |
| 5 | Deliverables | engineering deliverables | artefacts the client keeps |
| 6 | How we engage | the five engagement models, those that apply | links to J for assessments |
| 7 | Prerequisites and limitations | both lists, verbatim | builds trust; required on every hub |
| 8 | Related domains | 2–4 cross-sell links | from the cross-sell matrix |
| 9 | Related tools | from SERVICE_TAXONOMY §3 | only live tools |
| 10 | FAQ | 4–6 questions per locale | no claims beyond §3 |
| 11 | CTA band | domain CTA + contact | contact link pre-selects the closest service key until D4 is decided |

**Structured data.**

* `Service` JSON-LD with `provider` = the Organization (`organizationJsonLd`), `areaServed` and
  `serviceType`.
* `BreadcrumbList`.
* `FAQPage` for the FAQ.
* **No** `offers`, `aggregateRating` or `review`.

### 5.2 Existing service pages (unchanged template)

The template stays as is (`uslugi/[slug]/page.tsx`). Additions:

* A breadcrumb level for the domain: Home → Services → *Domain* → Service.
* A "Part of: <domain>" link.
* For `integrations`, links to E and H, since the slug mentions cloud and security.

### 5.3 Services index (`/uslugi` ↔ `/services`)

The page is grouped into three bands. Each domain card shows the name, a one-line positioning, the
highest status, and the existing services inside it:

| Band | BG | EN | Domains |
| --- | --- | --- | --- |
| 1 | AI системи | AI systems | A, B, C, H |
| 2 | Инженеринг и платформи | Engineering and platforms | D, E, F, G |
| 3 | Операции и консултации | Operations and advisory | I, J |

The page keeps its primary keyword „услуги за онлайн магазини“ / "services for online stores" until
D7 is decided.

### 5.4 Navigation

* **Header "Services" panel:** the three bands, each listing its domains (10 links) and "All
  services". This replaces the current two-group list (`lib/navigation.ts`).
* **Mobile sheet:** the same bands as collapsible groups. Every link is at least 44 px tall (the
  existing rule).
* **Footer:** the three bands with domain links. The service pages stay reachable from domain hubs
  and the index.
* **No item is linked to an unpublished hub.** The tool registry's "available-only" principle
  applies to domain pages too (a `domainAvailable` flag).

## 6. URLs and routing

| Item | BG | EN | Mechanism |
| --- | --- | --- | --- |
| Domain hub | `/bg/uslugi/<bg-domain-slug>` | `/en/services/<en-domain-slug>` | new content type in `content/{bg,en}/domains.ts` + the services route (or a sibling route) + `EN_SUBSEGMENTS.uslugi` entries |
| Existing services | unchanged | unchanged | no redirects needed |
| Sitemap | hubs with reciprocal hreflang | — | `app/sitemap.ts`, as for services |

* **One namespace.** Domain and service slugs share `uslugi`, and the uniqueness rule in
  SERVICE_TAXONOMY §4 is enforced by a test.
* **No renames.** Removing or renaming an existing slug requires a 308 redirect and a keyword
  re-map. This specification does neither.

## 7. Structured content model (for the implementation phase)

```ts
// content/types.ts (proposed)
export type DomainKey =
  | "ai_strategy" | "ai_agents_automation" | "ai_applications" | "commerce_engineering"
  | "cloud_platform" | "devops_sre" | "data_integration" | "ai_governance"
  | "managed_operations" | "advisory_enablement";

export type DeliveryStatus = "available" | "custom" | "planned";
export type EngagementModel = "assessment" | "workshop" | "architecture" | "implementation" | "managed";

export interface ServiceFamily {
  key: string;                       // stable, snake_case
  title: string;
  capabilities: string[];
  status: DeliveryStatus;
  prerequisite?: string;             // required when status === "planned"
  services?: ServiceKey[];           // existing service pages that implement this family
}

export interface Domain {
  key: DomainKey;
  id: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";
  band: "ai" | "engineering" | "operations";
  slug: string;                      // locale-specific
  name: string;
  positioning: string;
  idealCustomers: string[];
  problems: string[];
  families: ServiceFamily[];
  deliverables: string[];
  engagement: { model: EngagementModel; via?: DomainKey }[];  // "via" = delivered through another domain
  prerequisites: string[];
  limitations: string[];
  cta: string;
  related: DomainKey[];
  tools: ToolKey[];
  primaryService?: ServiceKey[];     // existing services whose primary domain this is
  seo: { title: string; description: string; primaryKeyword: string; secondaryKeywords: string[] };
  faqs: { question: string; answer: string }[];
}
```

BG is the reference shape and EN is typed against it, as everywhere else in `content/`. The domain
registry (keys, ids, bands, statuses, related, tools, primaryService) lives once in
`lib/domains.ts`. Only texts live in `content/{bg,en}/domains.ts`.

## 8. Roll-out phases

| Phase | Scope | Acceptance criteria |
| --- | --- | --- |
| C0 (this document set) | positioning, taxonomy and content specification | consistency checks in SERVICE_TAXONOMY §7 pass; outstanding decisions listed |
| C1 Content drafting | BG and EN texts for all 10 hubs (positioning, families, FAQ), reviewed against §2–§3 | native-speaker review for BG and EN; claims review sign-off; no terms from §2 |
| C2 Model and tests | `lib/domains.ts`, `content/{bg,en}/domains.ts`, types | tests: 10 domains; unique keys and slugs; no collision with service slugs; each `ServiceKey` has one primary domain; planned families carry a prerequisite; SEO length limits; keyword map extended and `seo-map.test.ts` green |
| C3 Pages and navigation | hub template, services index bands, header, mobile and footer, breadcrumbs on service pages | e2e: every hub 200 in BG/EN, reciprocal hreflang, in the sitemap, one H1, JSON-LD valid; no horizontal overflow at 360/390/768/1024/1440; links check green; Lighthouse accessibility 100 on a sample of hubs |
| C4 Lead categories (optional, D4) | API `ServiceKey` or domain category + Alembic migration + admin filters | migration round trip; existing leads unaffected; BG/EN labels |
| C5 Homepage repositioning (D7) | homepage copy and keyword re-map | keyword map updated; no orphaned keyword; e2e homepage tests updated |

Phases C1–C3 need no database change and can ship independently of the platform phases (P1–P7).

## 9. Review checklist (every page, both locales)

- [ ] Every capability is phrased as a capability or a practice, never as a client result.
- [ ] No prices, client names, logos, partnerships, certifications or numeric outcomes.
- [ ] Status chips match SERVICE_TAXONOMY. Planned items name their prerequisite.
- [ ] The prerequisites and limitations sections are present.
- [ ] No terms from the avoid list (§2).
- [ ] Title ≤ 60 characters before the site suffix; description 120–160 characters.
- [ ] The primary keyword is in the title and unique across the site.
- [ ] BG and EN carry the same facts. EN reads naturally in English.
- [ ] CTAs point to an existing route, with a service preselected where one applies.

## 10. Outstanding decisions (content)

Business decisions D1–D7 are listed in PLATFORM_VISION §10. Content-specific:

| # | Decision | Default until decided |
| --- | --- | --- |
| C-1 | Who reviews BG and EN copy (native speakers) | no hub is published without review |
| C-2 | Which hubs launch first | E, F, H first (no page today), then A, B, C, D, G, I, J as group pages over existing services |
| C-3 | Whether domain hubs get their own articles (informational content per domain) | none until the hubs exist |
| C-4 | Verification of the proposed keywords (Keyword Planner BG/EN) | all `unverified` |
