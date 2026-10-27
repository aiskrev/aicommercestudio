# Platform vision: next-generation positioning

**Status:** strategy document. It changes nothing on the website, in the API or in the database.
**Baseline:** `main` @ `c7fa4d6` ([PLATFORM_BASELINE_AUDIT.md](PLATFORM_BASELINE_AUDIT.md)).

**Related documents:**

* [SERVICE_TAXONOMY.md](SERVICE_TAXONOMY.md): the ten domains in detail.
* [CONTENT_STRATEGY_BG_EN.md](CONTENT_STRATEGY_BG_EN.md): how the domains become content.
* [IMPLEMENTATION_DEPENDENCIES_V2.md](IMPLEMENTATION_DEPENDENCIES_V2.md): the platform work this
  vision depends on.

## 1. Where we start

The current product is an e-commerce engineering studio that has grown an applied-AI practice.

| Asset | State (verified 2026-10-27) |
| --- | --- |
| Services | 9 service pages in BG/EN, in two navigation groups: **AI services** (`audit`, `ai_agents`, `automation`, `ai_tools`, `integrations`, `ai_managed`) and **E-commerce foundation** (`maintenance`, `seo`, `analytics`) |
| Self-service tools | 7 live tools: AI Automation Advisor, AI readiness assessment, Build your AI team, ROI calculator, Opportunity Finder, Solution Builder, AI Agent Library |
| Lead pipeline | contact, quote, tool submissions and consultations → admin with audit log, retention and AI approval policy |
| Operations | AI Managed Services offering (AI Monitor / AI Care / AI Optimize, custom quote), and a staff-only AI operations scaffold (tenancy, RBAC, agent registry) |
| Evidence base | the repository itself: CI with containerised suites, migrations checked against models, e2e and Lighthouse baselines, tenancy and isolation tests |
| Not present | client references, case studies, certifications, partnerships, prices, a production deployment |

Two things in the current positioning no longer fit:

1. **"AI решения за онлайн магазини"** describes the origin, not the offer. Agents, knowledge
   systems, integrations and operations apply to any SME, not only to stores.
2. **Cloud, DevOps and SRE work is invisible.** It is only half-mentioned in one slug
   ("…-oblak-i-sigurnost"), although the studio practises it in its own platform and it is what
   makes AI systems run reliably.

## 2. Positioning

**One sentence (EN).** An engineering studio that designs, builds and operates AI systems, commerce
platforms and the cloud infrastructure they run on, with human control over every action that has
consequences.

**One sentence (BG).** Инженерно студио, което проектира, изгражда и поддържа AI системи,
платформи за онлайн търговия и облачната инфраструктура, върху която работят — с човешки контрол
над всяко действие с последствия.

**What makes it distinct.** These are facts we can show, not adjectives:

* **Engineering first.** Every engagement ends in artefacts the client owns: code, IaC, runbooks,
  evaluation sets and decision records.
* **Control by design.** Deterministic permission checks around model output, approval matrices and
  audit logs. These already exist in our own platform (AI approval policy, audit log, tenant
  isolation).
* **Build and operate.** The same team that builds also offers to run it (domain I). A system is
  not "done" at launch.
* **Honest scope.** There are no published prices, SLAs or guaranteed outcomes. Statuses of
  "available", "custom engagement" and "planned" are stated per service family.
* **Bilingual and EU-based.** Bulgarian and English throughout, with EU data residency as the
  default.

**What we are not.**

* We are not a reseller of AI tools or cloud capacity.
* We are not a legal or compliance advisor.
* We are not a 24/7 operations centre.
* We are not an advertising agency.
* We are not a model-training lab.

## 3. Who we serve

| Segment | Typical situation | Entry domains |
| --- | --- | --- |
| SMEs with manual back-office work | information moves by hand between e-mail, CRM, ERP and documents | J → B, G |
| Online stores (Shopify, WooCommerce) | instability, performance, SEO, data and integrations | J → D, G |
| Companies with an AI pilot that stalled | demo works, production does not | J → A, C, H |
| Companies already running AI | nobody owns quality, cost or incidents | I, H |
| Product teams | need a platform, pipelines and observability for a new or AI-enabled application | E, F |

**Not a fit today:**

* large enterprise transformations that need many concurrent teams;
* regulated certifications;
* hardware or on-premise data-centre work;
* projects whose only goal is a demo.

## 4. Product architecture

The offer has three layers. They share one lead pipeline and, later, one client portal.

```
 Self-service tools (free)          Advisory & assessments (J)            Engagements (A–H)          Operations (I)
 readiness · finder · ROI ·  ──►    technical audit · reviews ·   ──►    architecture → implementation  ──►  managed AI, store,
 solution builder · AI team ·       workshops                             per domain                         platform operations
 agent library · advisor                                                                                      (+ planned portal)
```

* **Tools qualify and educate.** Each tool links to the domains it feeds (SERVICE_TAXONOMY §3) and
  hands over to a consultation with the visitor's explicit consent. The tools stay as they are.
* **J is the default first step.** A fixed-scope assessment turns an inquiry into a decision and a
  plan.
* **Domains A–H are delivered as scoped engagements:** workshop → architecture →
  implementation, with acceptance criteria.
* **I is the recurring layer.** Its client portal is the long-term product, delivered in the
  phases of IMPLEMENTATION_DEPENDENCIES_V2 (P3–P7). It is not promised before then.

## 5. The ten domains

| ID | Domain (EN / BG) | Role in the offer | Status |
| --- | --- | --- | --- |
| A | AI Strategy & Transformation / AI стратегия и трансформация | decides what to build and in what order | available |
| B | AI Agents & Business Automation / AI агенти и бизнес автоматизация | agents and workflows that act in client systems | available |
| C | AI Applications & Knowledge Systems / AI приложения и системи за знания | assistants and features over the client's data | available |
| D | Commerce Engineering / Инженеринг за електронна търговия | technical foundation of online stores | available |
| E | Cloud & Platform Engineering / Облачен и платформен инженеринг | infrastructure that applications and AI run on | custom engagement |
| F | DevOps, SRE & Observability / DevOps, SRE и наблюдаемост | delivery pipelines, reliability and visibility | custom engagement |
| G | Data & Integration Engineering / Инженеринг на данни и интеграции | connecting systems and making data usable | available |
| H | AI Governance, Security & Assurance / AI управление, сигурност и надеждност | controls that customers and auditors can check | custom engagement |
| I | Managed AI & Platform Operations / Управлявани AI и платформени операции | running what has been built | available (portal planned) |
| J | Advisory, Assessments & Enablement / Консултации, оценки и обучение | the entry point and team capability | available |

**Why E and F are real offerings.** The studio's own platform is built the way these domains
describe:

* containerised services and environment separation;
* migrations verified against the models in CI;
* end-to-end and performance baselines;
* security headers and secrets handling;
* a designed observability and telemetry model.

These are verifiable capabilities. They are not client references, so the website must present
them as "how we work", never as past client results.

## 6. Commercial model

The service shapes follow BUSINESS_PLAN §4, extended to the domains. Every price is `[to define]`
and nothing is published.

| Shape | Typical domains | Notes |
| --- | --- | --- |
| Paid fixed-scope assessment | J, A, H, F | recommended first step; findings and a plan |
| Workshop | A, B, C, H, J | 0.5–2 days with a written summary |
| Architecture engagement | B, C, E, F, G, H | design, decision records and an estimate of the work |
| Fixed-scope implementation or milestones | B, C, D, E, F, G | acceptance criteria per milestone |
| Retainer / managed service | D, I (and E/F through I) | written scope; response times only where staffed; third-party costs separate |

## 7. Principles every domain follows

1. **No invented evidence.** No clients, logos, testimonials, certifications, partnerships or
   numeric outcomes until they exist and are approved for publication.
2. **Status is explicit.** Only "available" families are sold as ready offerings. "Custom
   engagement" means scoped on request. "Planned" names its prerequisite.
3. **Human approval for consequential actions.** This applies to AI systems we build and to our own
   AI features.
4. **The client owns the artefacts.** Code, IaC, documentation and evaluation sets live in the
   client's accounts and repositories.
5. **Data minimisation and EU residency by default.** A DPA comes before any production personal
   data.
6. **Provider independence.** Model and cloud choices are documented decisions; the code keeps a
   provider abstraction.

## 8. Consequences for the website (later phase)

Specified in CONTENT_STRATEGY_BG_EN.md, summarised here:

* **Services index:** grouped by the ten domains.
* **Domain hub pages:** at `/bg/uslugi/<domain>` ↔ `/en/services/<domain>`.
* **No URL changes:** every existing service page keeps its URL, content and SEO keyword.
* **New pages, after content review:** domains E, F and H get hub pages first, because their scope
  has no page today.
* **Homepage and AI solutions page:** move from "AI for online stores" to the broader positioning
  in §2. The store audience stays a named segment, so existing BG keywords keep their pages.
* **Contact form:** the service selector gains the domains (or their families) only when the API
  enum is extended. That needs an Alembic migration, as for 0004 and 0005, and is out of scope here.

## 9. Dependencies and sequencing

| Vision element | Depends on |
| --- | --- |
| Domain hub pages and new navigation | content review (CONTENT_STRATEGY §8); no platform dependency |
| New contact-form categories for E, F, H | API `ServiceKey` extension and a migration (a later implementation phase) |
| Managed operations at scale | P1 (Redis, queue, RLS) |
| Client portal | P3–P5 (client identity with MFA, portal MVP, telemetry) and a DPA |
| Public launch of any page | T1 (production deployment), T2 (legal texts incl. the privacy-policy gap for tool data) |

## 10. Outstanding decisions

| # | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| D1 | Split `audit` into "AI readiness assessment" and "E-commerce technical audit"? Which keeps the current URL and keyword? | business | J and A pages |
| D2 | Final brand name: does "Commerce" stay in the name once the offer is broader? | business | positioning copy, OG image |
| D3 | Which of E, F and H are actively sold now (capacity), and which stay "custom engagement" | business | navigation prominence |
| D4 | Contact-form taxonomy: keep the 9 service keys, or add domain-level categories (API migration) | business + engineering | lead reporting |
| D5 | Delivery partners for capacity peaks (none claimed today) | business | E, F, I scaling |
| D6 | Training format and language for J enablement | business | J content |
| D7 | Whether the homepage primary keyword moves away from "AI решения за онлайн магазини" | business + SEO | homepage SEO |
