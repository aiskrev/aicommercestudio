# Service taxonomy: ten service domains

**Status:** specification. Nothing on the website has changed yet. Baseline: `main` @ `c7fa4d6`
([PLATFORM_BASELINE_AUDIT.md](PLATFORM_BASELINE_AUDIT.md)).

**Companion documents:**

* [PLATFORM_VISION.md](PLATFORM_VISION.md): positioning and product architecture.
* [CONTENT_STRATEGY_BG_EN.md](CONTENT_STRATEGY_BG_EN.md): voice, claims policy, keywords, page
  templates and roll-out.

This document is the single source for domain names, slugs, scope, status and SEO texts. The
website content (`content/{bg,en}/*.ts`) will be generated from it in a later phase.

## 1. Conventions

**Domain keys.** Domain keys are `snake_case`, and they deliberately differ from the existing
`ServiceKey` values (`ai_agents`, `automation`, `ai_tools`, `integrations`, `ai_managed`, `audit`,
`maintenance`, `seo`, `analytics`). A domain groups services; it does not replace them.

**Slugs.**

* Lowercase ASCII, with words separated by hyphens.
* Bulgarian slugs use the transliteration already used by the site: ж → zh, ш → sh, щ → sht,
  ц → ts, ч → ch, ъ → a, ю → yu, я → ya, й → y.
* English slugs are written for English searches, not transliterated.
* All domain slugs and existing service slugs share one namespace (`/uslugi/<slug>` ↔
  `/services/<slug>`), so a domain slug must never equal a service slug (§4).

**Delivery status.** Applies per service family, and the domain shows its highest status.

| Status | Meaning (what the website may say) |
| --- | --- |
| **available** | There is a live service page, an intake path, and a documented way of delivering it today. |
| **custom engagement** | We take it on as a scoped project after an assessment. There is no dedicated page or package yet, and every engagement is quoted individually. |
| **planned** | Not offered yet. The prerequisite is named, and the website may mention the family only as "planned" with that prerequisite. |

**Engagement models.** These are used in every domain. Each domain states which ones apply.

| Model | BG | What the client receives |
| --- | --- | --- |
| Assessment | Оценка | A fixed-scope review with written findings, risks and a prioritised plan |
| Workshop | Работна среща | 0.5–2 days with the client's team; decisions and a written summary |
| Architecture | Архитектура | Target design, decision records, interfaces, security model, estimate of the work |
| Implementation | Изпълнение | Built and tested increments with acceptance criteria, handover documentation |
| Managed service | Управлявана услуга | Ongoing operation under a written scope (no published SLA; response times are agreed per contract) |

**Prices.** No prices, ranges or guaranteed outcomes appear on the website or in this document. All
engagements are quoted individually.

## 2. Domain registry

| ID | Key | BG name | EN name | BG slug | EN slug | Status |
| --- | --- | --- | --- | --- | --- | --- |
| A | `ai_strategy` | AI стратегия и трансформация | AI Strategy & Transformation | `ai-strategiya-i-transformatsiya` | `ai-strategy-and-transformation` | available |
| B | `ai_agents_automation` | AI агенти и бизнес автоматизация | AI Agents & Business Automation | `ai-agenti-i-biznes-avtomatizatsiya` | `ai-agents-and-business-automation` | available |
| C | `ai_applications` | AI приложения и системи за знания | AI Applications & Knowledge Systems | `ai-prilozheniya-i-sistemi-za-znaniya` | `ai-applications-and-knowledge-systems` | available |
| D | `commerce_engineering` | Инженеринг за електронна търговия | Commerce Engineering | `inzhenering-za-elektronna-targoviya` | `commerce-engineering` | available |
| E | `cloud_platform` | Облачен и платформен инженеринг | Cloud & Platform Engineering | `oblachen-i-platformen-inzhenering` | `cloud-and-platform-engineering` | custom engagement |
| F | `devops_sre` | DevOps, SRE и наблюдаемост | DevOps, SRE & Observability | `devops-sre-i-nablyudaemost` | `devops-sre-and-observability` | custom engagement |
| G | `data_integration` | Инженеринг на данни и интеграции | Data & Integration Engineering | `inzhenering-na-danni-i-integratsii` | `data-and-integration-engineering` | available |
| H | `ai_governance` | AI управление, сигурност и надеждност | AI Governance, Security & Assurance | `ai-upravlenie-sigurnost-i-nadezhdnost` | `ai-governance-security-and-assurance` | custom engagement |
| I | `managed_operations` | Управлявани AI и платформени операции | Managed AI & Platform Operations | `upravlyavani-ai-i-platformeni-operatsii` | `managed-ai-and-platform-operations` | available |
| J | `advisory_enablement` | Консултации, оценки и обучение | Advisory, Assessments & Enablement | `konsultatsii-otsenki-i-obuchenie` | `advisory-assessments-and-enablement` | available |

"Assurance" in H is translated as **надеждност** (reliability and trustworthiness), not as
"осигуряване". The independent-verification sense of assurance is spelled out in the family names
(§5.H).

## 3. Existing services and tools (preserved)

Every existing service keeps its key, slugs, content, SEO keyword and URL. Domains only add a
grouping layer and hub pages.

| Existing service (key) | BG / EN slug (unchanged) | Primary domain | Also listed in |
| --- | --- | --- | --- |
| AI стратегия и готовност / AI strategy & readiness (`audit`) | `tehnicheski-odit` / `technical-audit` | **J** | A, D |
| Разработка на AI агенти / AI agent development (`ai_agents`) | `razrabotka-na-ai-agenti` / `ai-agent-development` | **B** | — |
| AI автоматизация на процеси / AI workflow automation (`automation`) | `avtomatizatsiya-na-procesi` / `business-process-automation` | **B** | G |
| AI разработка по поръчка / Custom AI engineering (`ai_tools`) | `ai-instrumenti-za-biznesa` / `custom-ai-tools` | **C** | — |
| AI интеграции и данни / AI integrations & data systems (`integrations`) | `api-integratsii-oblak-i-sigurnost` / `api-integrations-cloud-security` | **G** | E, H |
| AI Managed Services и оптимизация (`ai_managed`) | `ai-managed-services` / `ai-managed-services` | **I** | H |
| Поддръжка на онлайн магазини / E-commerce maintenance (`maintenance`) | `poddrazhka-na-online-magazini` / `ecommerce-maintenance` | **D** | I |
| SEO и органичен растеж / SEO and organic growth (`seo`) | `seo-optimizatsiya` / `seo-optimization` | **D** | — |
| Анализи и конверсии / Analytics and conversion (`analytics`) | `analizi-i-konversii` / `analytics-and-conversion` | **D** | G |

| Tool (live) | Domain(s) it feeds |
| --- | --- |
| AI Automation Advisor | B, A |
| AI readiness assessment | A, J |
| Build your AI team | B, I |
| AI ROI calculator | A, B |
| Automation Opportunity Finder | B, A |
| AI Solution Builder | B, C, G, H |
| AI Agent Library | B |

**The `audit` service (decision D1).** Its navigation label is "AI strategy & readiness", but its
slug and primary keyword are "technical audit of an online store". Its primary domain is **J**,
because it is a fixed-scope assessment. A presents it as the entry point to strategy, and D presents
it as the store audit. Splitting it into two services ("AI readiness assessment" and "E-commerce
technical audit") is an outstanding decision (D1). It would need new slugs and must keep the current
URL for whichever service retains the existing keyword.

**The `integrations` service.** The slug `api-integratsii-oblak-i-sigurnost` ("API integrations,
cloud and security") is kept unchanged. The cloud scope now belongs to E and the security scope to
H. The service page should point to both once they exist; the URL and the keyword "API интеграции"
do not change.

## 4. Slug uniqueness

Checked against the existing service slugs and top-level routes:

* No domain slug equals a service slug in either language.
* The BG domain slug `ai-agenti-i-biznes-avtomatizatsiya` lives under `/uslugi/` and does not
  collide with the top-level agent library `/ai-agenti`.
* Domain hub pages are proposed under the same `uslugi` segment: `/bg/uslugi/<domain-slug>` ↔
  `/en/services/<domain-slug>`. This needs `EN_SUBSEGMENTS.uslugi` entries and an extension of
  `uslugi/[slug]` (or a separate route). See CONTENT_STRATEGY §6.

## 5. Domains

The order of the fields is the same for every domain. "Prerequisites" are what the client must
provide. "Limitations" are what we do not do, or cannot promise.

---

### A. AI Strategy & Transformation · AI стратегия и трансформация

* **Slugs:** `ai-strategiya-i-transformatsiya` · `ai-strategy-and-transformation`
* **Status:** available. Entry through `audit` and the AI readiness assessment. Roadmaps and
  portfolio work are custom engagements.

**Positioning.** This domain decides where AI is worth building at all, in what order, and under
which controls, before any money goes into implementation. The output is a plan that engineering
can execute, not a slide deck.

**Ideal customers.**

* Owners and managers of SMEs and online retailers with several candidate AI use cases and no
  internal AI team.
* Operations or IT leads who need a defensible order of work and a budget envelope they can set
  themselves.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| AI readiness assessment | data, process, team, risk and infrastructure readiness. The online self-assessment (12 questions, 6 dimensions) is followed by an expert review. | available |
| Use-case discovery and prioritisation | process inventory; value and complexity scoring; human-approval points; build-or-buy | available (via audit) / custom engagement |
| AI roadmap and portfolio | phased plan, dependencies, owner per initiative, acceptance criteria, decision log | custom engagement |
| Operating model for AI | roles, approval policy, change process, vendor and model selection criteria | custom engagement |

**Business problems addressed.**

* Many ideas, no order of work.
* Pilots that never reached production.
* Unclear data ownership.
* Vendors proposing tools before the problem is defined.

**Engineering deliverables.**

* A readiness report with blockers.
* A prioritised use-case register.
* A target architecture sketch per use case, with data flows and approval points.
* A phased roadmap with acceptance criteria.
* Model and provider selection criteria.

**Engagement models.** Assessment ✓ · Workshop ✓ · Architecture ✓ · Implementation → via B, C, G ·
Managed service → via I.

**Prerequisites.**

* A named business owner.
* Access to the people who run the processes.
* Example data or documents for each candidate use case.

**Limitations.**

* No change-management programme for large organisations.
* No savings forecasts: ROI is computed only from the client's own numbers (the ROI calculator
  policy).
* No vendor-neutral procurement tenders.

**CTA.** BG: „Заявете оценка на AI готовността“ · EN: "Request an AI readiness assessment"

**Related domains and cross-sell.**

* **J:** the assessment format.
* **B / C:** implementation of the top use cases.
* **H:** the approval policy.
* **I:** operating what gets built.

**SEO.**

* **BG title:** AI стратегия и план за внедряване на изкуствен интелект
* **BG meta:** Оценка на готовността, приоритизиране на случаи на употреба и поетапен план за
  внедряване на AI — с ясни критерии за приемане и човешки контрол.
* **EN title:** AI strategy and an implementation roadmap for your business
* **EN meta:** Readiness assessment, use-case prioritisation and a phased AI roadmap with acceptance
  criteria and human approval points — before you invest in implementation.

---

### B. AI Agents & Business Automation · AI агенти и бизнес автоматизация

* **Slugs:** `ai-agenti-i-biznes-avtomatizatsiya` · `ai-agents-and-business-automation`
* **Status:** available. Services `ai_agents` and `automation`; tools Advisor, AI team, Agent
  Library, Solution Builder, Finder.

**Positioning.** This domain builds agents and automated workflows that act inside the client's
systems. Every action with an external effect goes through a deterministic permission check and,
where the rules require it, a human approval. It does not build autonomous systems with unbounded
authority.

**Ideal customers.**

* Teams that move information between e-mail, CRM, helpdesk, documents and ERP by hand.
* Support, sales operations, back office and finance teams with repetitive, rule-bound work.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| Task agents | lead qualification, customer support drafts, document intake, scheduling, research briefs, reporting summaries (the 10 roles of the Agent Library) | available |
| Workflow automation | triggers, routing, data transformation, retries, error queues, idempotent writes | available |
| Multi-agent coordination | coordinator and approval-supervisor roles, escalation paths | available (scoped per project) |
| Human-in-the-loop design | approval points by risk, sample review, approval UI, audit trail | available |
| Agent tool integration | tool definitions over the client's APIs with least-privilege credentials | available (through G) |

**Business problems addressed.**

* Slow responses.
* Manual re-entry between systems.
* Errors from copy-paste.
* Work that depends on one person.
* Automation attempts that broke silently.

**Engineering deliverables.**

* An agent and workflow specification: roles, inputs and outputs, approval matrix.
* Implemented agents and workflows with evaluation cases.
* Least-privilege service accounts.
* An audit log of every action.
* A runbook and a rollback procedure.

**Engagement models.** Assessment ✓ (Advisor, Finder) · Workshop ✓ · Architecture ✓ (Solution
Builder, AI team) · Implementation ✓ · Managed service → I.

**Prerequisites.**

* API access, or a sanctioned integration path, to the systems involved.
* A process owner who defines the approval rules.
* Test accounts and a non-production environment where possible.

**Limitations.**

* No actions in systems without an API or an approved integration (no screen-scraping of
  production systems without written approval).
* No guaranteed accuracy.
* Agents do not replace legally required human decisions.

**CTA.** BG: „Опишете процеса за автоматизация“ · EN: "Describe the process you want to automate"

**Related domains and cross-sell.**

* **G:** integrations.
* **C:** knowledge retrieval for agents.
* **H:** approval policy and risk review.
* **I:** monitoring and evaluation after launch.
* **A:** prioritisation when there are several processes.

**SEO.**

* **BG title:** AI агенти и бизнес автоматизация с човешки контрол
* **BG meta:** Проектиране и внедряване на AI агенти и автоматизирани работни процеси в CRM, имейл,
  helpdesk и ERP — с одобрение на действията и журнал.
* **EN title:** AI agents and business automation with human approval
* **EN meta:** Design and delivery of AI agents and automated workflows across CRM, e-mail, helpdesk
  and ERP — with permission checks, approval points and an audit trail.

---

### C. AI Applications & Knowledge Systems · AI приложения и системи за знания

* **Slugs:** `ai-prilozheniya-i-sistemi-za-znaniya` · `ai-applications-and-knowledge-systems`
* **Status:** available. Service `ai_tools`. Evaluation-heavy and fine-tuning work is custom
  engagement.

**Positioning.** This domain builds AI applications that answer from the client's own documents
and data, with sources, permissions and measured quality. It covers internal assistants, document
analysis, and AI features inside existing products.

**Ideal customers.**

* Companies whose knowledge sits in documents, wikis and tickets.
* Teams that process contracts, invoices or forms.
* Product teams adding AI features to an existing application.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| Retrieval-augmented assistants (RAG) | ingestion, chunking, embeddings, hybrid search, access-aware retrieval, cited answers, "no source → no answer" | available |
| Document analysis and extraction | classification, field extraction with confidence, validation rules, human review queues | available |
| AI features in products | summarisation, drafting, classification and search inside the client's application, behind feature flags | available |
| Evaluation and quality engineering | test sets, retrieval and answer metrics, regression gates in CI | custom engagement |
| Model adaptation | prompt and tool design first; fine-tuning only with a demonstrated need and sufficient data | custom engagement |

**Business problems addressed.**

* Employees cannot find answers.
* Repetitive questions to the same experts.
* Manual reading of documents.
* AI demos that hallucinate or ignore permissions.

**Engineering deliverables.**

* An ingestion pipeline.
* Index design with permission filtering.
* An application or API.
* An evaluation set with baseline results.
* Monitoring of cost and latency.
* Data-handling documentation.

**Engagement models.** Assessment ✓ · Workshop ✓ · Architecture ✓ · Implementation ✓ · Managed
service → I.

**Prerequisites.**

* Access to the source documents and their permission model.
* A content owner who confirms what is authoritative.
* Agreed data-processing terms with the model provider.

**Limitations.**

* Quality depends on the source documents.
* We do not train foundation models.
* No guarantees of factual accuracy; answers without a source are refused by design.
* Regulated or special-category data only after a DPA and an assessment (H).

**CTA.** BG: „Обсъдете AI приложение за вашите данни“ · EN: "Discuss an AI application for your
data"

**Related domains and cross-sell.**

* **G:** data pipelines.
* **H:** data protection and evaluations.
* **E:** hosting.
* **I:** quality monitoring.
* **B:** agents that use the knowledge base.

**SEO.**

* **BG title:** AI приложения и асистенти върху вашите документи (RAG)
* **BG meta:** Вътрешни AI асистенти, анализ на документи и AI функции в продукти — с отговори
  с източник, контрол на достъпа и измерено качество.
* **EN title:** AI applications and knowledge assistants on your documents
* **EN meta:** Internal AI assistants, document analysis and AI product features built on your own
  data — with cited sources, access control and measured quality.

---

### D. Commerce Engineering · Инженеринг за електронна търговия

* **Slugs:** `inzhenering-za-elektronna-targoviya` · `commerce-engineering`
* **Status:** available. Services `maintenance`, `seo`, `analytics`, and `audit` as the store
  audit. Headless and replatforming are custom engagements.

**Positioning.** This domain is the technical foundation of online stores: stability, speed,
search visibility, measurement and integrations for Shopify and WooCommerce. It is the original
core of the studio, and it is where AI features for commerce are applied.

**Ideal customers.**

* Small and mid-sized online stores without an in-house developer.
* Merchants with app or plugin sprawl.
* Stores with stagnant organic traffic or unreliable analytics.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| Store maintenance and stability | updates, backups, uptime and error monitoring, plugin and app hygiene, security patches | available |
| Performance engineering | Core Web Vitals, image and script budgets, theme optimisation, caching | available (within maintenance and audit) |
| Technical and e-commerce SEO | crawlability, structured data, faceted navigation, internationalisation, migrations | available |
| Analytics and conversion | GA4 and server-side events, funnels, experiment design, data quality | available |
| Commerce integrations | ERP, inventory, accounting, couriers, marketplaces (through G) | available |
| Replatforming and headless | migration plans, redirects, data migration, headless storefront architecture | custom engagement |
| AI for commerce | product content drafts, search and recommendation assistants, support agents (through B and C) | available |

**Business problems addressed.**

* Slow or unstable stores.
* Broken updates.
* Lost rankings after changes.
* Unreliable conversion data.
* Manual order and stock handling.

**Engineering deliverables.**

* A technical audit with a prioritised backlog.
* A maintenance log.
* Performance budgets and reports.
* A structured-data implementation.
* A tracking plan and an event specification.
* A migration plan with a redirect map.

**Engagement models.** Assessment ✓ (technical audit) · Workshop ✓ · Architecture ✓ ·
Implementation ✓ · Managed service ✓ (maintenance and SEO retainers).

**Prerequisites.**

* Admin access to the store and its hosting.
* Access to analytics and Search Console.
* A staging environment, or approval to create one.

**Limitations.**

* No guaranteed rankings or traffic.
* No marketplace or advertising account management.
* Platform limits (e.g. Shopify plan features) apply.
* Visual design work only within technical scope.

**CTA.** BG: „Заявете технически одит на магазина“ · EN: "Request a technical store audit"

**Related domains and cross-sell.**

* **G:** integrations.
* **B / C:** AI features for the store.
* **F:** monitoring.
* **I:** managed operations.
* **J:** audit.

**SEO.**

* **BG title:** Инженеринг за онлайн магазини: стабилност, скорост и растеж
* **BG meta:** Поддръжка, производителност, техническо SEO, анализи и интеграции за Shopify и
  WooCommerce — един технически партньор за магазина и данните.
* **EN title:** Commerce engineering for Shopify and WooCommerce stores
* **EN meta:** Maintenance, performance, technical SEO, analytics and integrations for online stores
  — one technical partner for the store, its data and its AI features.

---

### E. Cloud & Platform Engineering · Облачен и платформен инженеринг

* **Slugs:** `oblachen-i-platformen-inzhenering` · `cloud-and-platform-engineering`
* **Status:** custom engagement. There is no dedicated page yet. The scope was previously folded
  into `integrations` ("cloud and security").

**Positioning.** This domain designs and builds the infrastructure that applications and AI
workloads run on. That means containers, managed databases, networking, identity, secrets and cost
control on the client's chosen cloud or an EU hosting provider, all described as code and handed
over with documentation. It is a substantial engineering offering in its own right, not an
accessory to AI.

**Ideal customers.**

* SMEs moving from a single server or shared hosting to a managed platform.
* Product teams that need a production-ready environment for a new application or AI workload.
* Companies with a cloud bill nobody can explain.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| Landing zone and environments | accounts and projects, networks, identity and access, environment separation (dev / staging / prod) | custom engagement |
| Infrastructure as code | Terraform or the provider's IaC, modules, state handling, review workflow | custom engagement |
| Containers and runtime | Docker images, Compose for small estates, managed container services or Kubernetes where justified | custom engagement |
| Data platform services | managed PostgreSQL, object storage, backups and restore tests, encryption at rest | custom engagement |
| Secrets and identity | secrets manager, rotation, workload identity, least-privilege roles | custom engagement |
| AI workload hosting | model API gateways, private networking to providers, GPU capacity only where required, EU data residency | custom engagement |
| Cost management | tagging, budgets and alerts, rightsizing reviews | custom engagement |
| Migration | lift-and-improve of existing applications, cut-over plans, rollback | custom engagement |

**Business problems addressed.**

* Fragile single-server setups.
* No backups or untested restores.
* Manual deployments.
* Secrets in code.
* Unclear cloud costs.
* No environment for testing.

**Engineering deliverables.**

* An architecture and decision records.
* An IaC repository.
* Environment and network diagrams.
* Backup and restore runbooks with an executed restore test.
* An access model.
* Cost dashboards and budgets.
* A handover session.

**Engagement models.** Assessment ✓ · Workshop ✓ · Architecture ✓ · Implementation ✓ · Managed
service → I (platform operations).

**Prerequisites.**

* The client owns the cloud accounts and billing, and grants delegated access.
* A decision on provider and region (EU by default).
* A named owner for access approvals.

**Limitations.**

* No reselling of cloud capacity.
* No claims of provider partnerships or certifications unless they are actually held (none at
  present).
* Large multi-region or regulated-industry landing zones only after an assessment.
* We do not run the client's on-premise hardware.

**CTA.** BG: „Обсъдете облачна среда за вашето приложение“ · EN: "Discuss a cloud platform for your
application"

**Related domains and cross-sell.**

* **F:** CI/CD and observability on the new platform.
* **H:** security baseline.
* **I:** platform operations.
* **C / B:** AI workloads.
* **G:** data services.

**SEO.**

* **BG title:** Облачна инфраструктура и платформен инженеринг (IaC)
* **BG meta:** Проектиране и изграждане на облачни среди: инфраструктура като код, контейнери,
  управлявани бази данни, тайни, архиви и контрол на разходите в ЕС.
* **EN title:** Cloud and platform engineering with infrastructure as code
* **EN meta:** Design and build of cloud environments: infrastructure as code, containers, managed
  databases, secrets, tested backups and cost control, EU-hosted by default.

---

### F. DevOps, SRE & Observability · DevOps, SRE и наблюдаемост

* **Slugs:** `devops-sre-i-nablyudaemost` · `devops-sre-and-observability`
* **Status:** custom engagement. The practices are demonstrable in this repository: CI with
  containerised test suites, migration checks, Lighthouse baselines and an e2e suite. They have not
  yet been sold as a service.

**Positioning.** This domain makes software delivery repeatable and production behaviour visible:
pipelines, release safety, monitoring, alerting and incident practice. SRE here means
service-level objectives, error budgets and blameless reviews, applied at the scale of the client.
It is not a 24/7 operations centre.

**Ideal customers.**

* Teams that deploy by hand or rarely.
* Applications whose failures are discovered by customers.
* Organisations introducing AI workloads that need tracing and cost visibility.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| CI/CD pipelines | build, test, security scanning, preview environments, promotion, rollback | custom engagement |
| Release engineering | migrations as a gated step, feature flags, canary or blue-green where justified | custom engagement |
| Observability | structured logs, metrics, OpenTelemetry tracing, dashboards, synthetic checks | custom engagement |
| Alerting and on-call design | SLO-based alerts, routing, runbooks, escalation (staffing is agreed separately) | custom engagement |
| Reliability engineering | SLOs and error budgets, load and failure testing, capacity reviews | custom engagement |
| Incident practice | incident procedure, post-incident reviews, preventive backlog | custom engagement |
| LLM observability | tracing of model and tool calls, token and cost tracking, latency, redaction (the design in AI_OPERATIONS_PORTAL.md §7) | custom engagement (portal: planned) |

**Business problems addressed.**

* Risky releases.
* No rollback.
* Outages noticed late.
* Alert noise.
* No shared view of what is slow or failing.
* AI costs that are only seen on the invoice.

**Engineering deliverables.**

* Pipeline definitions in the client's repository.
* A release and rollback runbook.
* Dashboards and alert rules as code.
* Documented SLOs.
* An incident procedure and review template.
* Tracing instrumentation with redaction.

**Engagement models.** Assessment ✓ (delivery and observability review) · Workshop ✓ · Architecture
✓ · Implementation ✓ · Managed service → I.

**Prerequisites.**

* Access to the source repositories and the CI system.
* An environment where pipelines can deploy.
* A decision on which tools are acceptable (hosted SaaS or self-hosted).

**Limitations.**

* No staffed 24/7 on-call unless agreed and staffed.
* No published response times.
* Tool licences are paid by the client.
* SLOs are set with the client and are not guaranteed by us.

**CTA.** BG: „Заявете преглед на доставката и наблюдаемостта“ · EN: "Request a delivery and
observability review"

**Related domains and cross-sell.**

* **E:** platform.
* **I:** ongoing operations.
* **H:** security scanning and audit trails.
* **C / B:** evaluation gates for AI changes.

**SEO.**

* **BG title:** DevOps, SRE и наблюдаемост: CI/CD, мониторинг и надеждност
* **BG meta:** CI/CD конвейери, безопасни версии, логове, метрики и трасиране с OpenTelemetry,
  SLO и процедура при инциденти — приложени в мащаба на вашия екип.
* **EN title:** DevOps, SRE and observability: CI/CD and monitoring
* **EN meta:** CI/CD pipelines, safe releases, logs, metrics, OpenTelemetry tracing, SLOs and an
  incident practice — sized for your team and documented in your repository.

---

### G. Data & Integration Engineering · Инженеринг на данни и интеграции

* **Slugs:** `inzhenering-na-danni-i-integratsii` · `data-and-integration-engineering`
* **Status:** available. Service `integrations`. Warehouses and pipelines beyond integration scope
  are custom engagements.

**Positioning.** This domain connects systems and makes their data usable: API integrations, sync
jobs, event flows and analytical data models with clear ownership and error handling. Agents,
assistants and reporting depend on it.

**Ideal customers.**

* Companies with a store, CRM, ERP, accounting and helpdesk that do not talk to each other.
* Teams preparing data for AI or reporting.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| API integrations | REST and GraphQL, webhooks, authentication, rate limits, retries, idempotency, error queues | available |
| System synchronisation | product, stock, order, customer and invoice sync between store, ERP, CRM and accounting | available |
| Event and workflow plumbing | queues, scheduled jobs, change data capture where supported | custom engagement |
| Data pipelines and models | extraction, cleaning, modelling for reporting and AI; data-quality checks | custom engagement |
| Analytical stores | a warehouse or PostgreSQL-based reporting store, BI connections | custom engagement |
| Data for AI | document and record preparation, permission metadata, embeddings pipelines (with C) | available (with C) |

**Business problems addressed.**

* Double data entry.
* Stock and order mismatches.
* Reports built by hand in spreadsheets.
* AI projects blocked by inaccessible data.

**Engineering deliverables.**

* An integration specification with field mappings.
* Implemented connectors with monitoring and an error queue.
* Data-flow diagrams.
* A data dictionary.
* Data-quality checks.
* A runbook.

**Engagement models.** Assessment ✓ · Workshop ✓ · Architecture ✓ · Implementation ✓ · Managed
service → I.

**Prerequisites.**

* API documentation and credentials for each system, issued with least privilege.
* A data owner per system.
* Sandbox accounts where the vendors offer them.

**Limitations.**

* Integrations are limited by vendor APIs and their terms.
* No certified-partner status with any vendor is claimed.
* Legacy systems without an API need an assessment first.

**CTA.** BG: „Опишете системите, които трябва да се свържат“ · EN: "Describe the systems you need
connected"

**Related domains and cross-sell.**

* **B:** automation on top of the integrations.
* **C:** knowledge systems.
* **D:** commerce data.
* **E:** hosting.
* **I:** integration health monitoring.

**SEO.**

* **BG title:** Инженеринг на данни и системни интеграции за бизнеса
* **BG meta:** Свързване на онлайн магазин, CRM, ERP и счетоводство, синхронизация на данни,
  конвейери и модели на данни за отчети и AI — с обработка на грешки.
* **EN title:** Data and integration engineering for business systems
* **EN meta:** Connecting store, CRM, ERP and accounting, data synchronisation, pipelines and data
  models for reporting and AI — with retries, error queues and monitoring.

---

### H. AI Governance, Security & Assurance · AI управление, сигурност и надеждност

* **Slugs:** `ai-upravlenie-sigurnost-i-nadezhdnost` · `ai-governance-security-and-assurance`
* **Status:** custom engagement. The building blocks exist in the platform: the approval policy,
  the audit log, secret detection and the tenant isolation design. There is no dedicated service
  page.

**Positioning.** This domain puts controls around AI systems that a business, its customers and its
auditors can check: who may do what, which data reaches which model, how quality is evaluated, and
what happens when something goes wrong. It is engineering governance, not legal advice.

**Ideal customers.**

* Companies putting AI in front of customers or into decisions.
* Teams that must answer data-protection or customer security questionnaires.
* Organisations preparing for the obligations of the EU AI Act, together with their own legal
  counsel.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| AI risk and use-case review | classification of use cases by impact, approval requirements, documentation duties (with the client's legal counsel) | custom engagement |
| Approval and permission design | deterministic authorisation around model output, human approval matrices, audit trails | available (within B) / custom engagement |
| Data protection engineering | data minimisation, redaction, retention, residency, DPA requirements for providers | custom engagement |
| Security engineering for AI | prompt-injection defences, tool permission boundaries, secret handling, threat models | custom engagement |
| Evaluation and assurance | test sets, red-team style probing within agreed scope, evaluation reports, regression gates | custom engagement |
| Policy and documentation | AI usage policy, model and data inventory, incident procedure | custom engagement |

**Business problems addressed.**

* AI deployed without clear accountability.
* Customer or auditor questions nobody can answer.
* Personal data sent to models without terms.
* Agents with broad permissions.
* No evidence of quality.

**Engineering deliverables.**

* A risk register per AI system.
* An approval matrix.
* A data-flow and processing inventory.
* A threat model.
* An evaluation report.
* Policy drafts for legal review.
* Implemented controls: redaction, permission checks, audit log.

**Engagement models.** Assessment ✓ · Workshop ✓ · Architecture ✓ · Implementation ✓ · Managed
service → I (periodic reviews).

**Prerequisites.**

* An inventory of AI systems and data flows, or access to build one.
* The client's legal or data-protection contact.
* Agreement on the scope of any adversarial testing, in writing.

**Limitations.**

* **No legal advice, no certification and no compliance guarantee.** Regulatory interpretation
  stays with the client's lawyers.
* Penetration testing beyond agreed AI-specific probing is referred to specialised providers.

**CTA.** BG: „Заявете преглед на риска на AI система“ · EN: "Request an AI system risk review"

**Related domains and cross-sell.**

* **B / C:** controls inside what we build.
* **I:** periodic reviews.
* **E / F:** security baseline and audit logging.
* **A:** operating model.

**SEO.**

* **BG title:** Управление и сигурност на AI системи: риск, данни, контрол
* **BG meta:** Преглед на риска, одобрения и права, защита на данните, защита от инжектиране на
  инструкции и оценка на качеството на AI системи — без правни обещания.
* **EN title:** AI governance and security: risk, data protection, controls
* **EN meta:** Risk review, approval and permission design, data protection, prompt-injection
  defences and evaluation for AI systems — engineering controls, not legal advice.

---

### I. Managed AI & Platform Operations · Управлявани AI и платформени операции

* **Slugs:** `upravlyavani-ai-i-platformeni-operatsii` · `managed-ai-and-platform-operations`
* **Status:** available for AI systems (service `ai_managed`: AI Monitor, AI Care, AI Optimize,
  custom quote) and for stores (`maintenance`). Platform operations for cloud and applications are
  custom engagements. The client portal is **planned** (IMPLEMENTATION_DEPENDENCIES_V2 P3–P5).

**Positioning.** This domain is the ongoing operation of what has been built, by us or by others:
monitoring, maintenance, evaluation, cost control, incident response and continuous improvement,
under a written scope. Data comes from the client's systems once access is agreed. Nothing is
reported before it is actually connected.

**Ideal customers.**

* Companies with an AI assistant, agent or automation in daily use and no one responsible for it.
* Stores and applications without in-house operations.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| Managed AI systems | the eight operating areas on the AMS page: reliability, execution visibility, cost and tokens, quality evaluation, human review, incident response, optimisation, governance | available |
| Store operations | maintenance, updates, monitoring, backups (the `maintenance` service) | available |
| Platform operations | patching, backups and restore tests, capacity and cost reviews for cloud environments (E) | custom engagement |
| Integration health | monitoring of connectors, error queues and data-quality checks (G) | custom engagement |
| Reporting | monthly reports from connected data; quarterly reviews | available (AMS) |
| Client operations portal | organisations, registry, incidents, reports, later telemetry (AI_OPERATIONS_PORTAL.md) | **planned** (prerequisites: RLS, client accounts with MFA, DPA) |

**Business problems addressed.**

* AI systems that degrade unnoticed.
* Rising model costs.
* No one owning incidents.
* Updates postponed until something breaks.

**Engineering deliverables.**

* An onboarding assessment and baseline.
* A monitoring and alerting configuration.
* Evaluation runs.
* A change log.
* Incident reports.
* Monthly reports.
* An improvement backlog.

**Engagement models.** Assessment ✓ (onboarding) · Workshop optional · Architecture as needed ·
Implementation of improvements ✓ · Managed service ✓.

**Prerequisites.**

* Access to logs and metrics, and to provider usage data.
* A notification channel.
* A named owner on the client side.
* A DPA before production data is processed.

**Limitations.**

* **No published SLA, no 24/7 and no "unlimited" work.** Response times are agreed in the contract.
* Third-party costs are separate.
* The portal is not available yet.

**CTA.** BG: „Заявете AI оценка“ (as on the AMS page) · EN: "Request an AI assessment"

**Related domains and cross-sell.**

* **F:** observability.
* **H:** periodic reviews.
* **B / C:** improvements.
* **D:** store operations.
* **E:** platform.

**SEO.**

* **BG title:** Управлявани AI системи и платформени операции
* **BG meta:** Текуща работа на AI агенти, приложения, магазини и облачни среди: наблюдение,
  оценка, разходи, инциденти и подобрения — по договорен обхват.
* **EN title:** Managed AI systems and platform operations
* **EN meta:** Ongoing operation of AI agents, applications, stores and cloud environments:
  monitoring, evaluation, cost, incidents and improvements — under an agreed scope.

---

### J. Advisory, Assessments & Enablement · Консултации, оценки и обучение

* **Slugs:** `konsultatsii-otsenki-i-obuchenie` · `advisory-assessments-and-enablement`
* **Status:** available. Service `audit` (technical audit / AI readiness) and the self-service
  tools. Training programmes are custom engagements; certification-style courses are not offered.

**Positioning.** This domain covers short, fixed-scope work that produces decisions and capability
in the client's own team: audits, architecture reviews, second opinions and hands-on enablement. It
is the recommended first step before most implementations.

**Ideal customers.**

* Decision makers who need an independent technical view before they commit.
* Teams that want to build in-house with expert review.

**Service families and capabilities.**

| Family | Capabilities | Status |
| --- | --- | --- |
| Technical audits | e-commerce technical audit, AI readiness, integration and data review | available |
| Architecture and code reviews | second opinion on designs, vendor proposals and code bases | custom engagement |
| Self-service assessments | AI readiness, Opportunity Finder, ROI calculator, Solution Builder, AI team, Advisor (free, online) | available |
| Workshops | use-case discovery, approval design, architecture sessions | custom engagement |
| Enablement and training | hands-on sessions for developers and operators: prompt and tool design, evaluation, RAG, CI/CD for AI | custom engagement |
| Technical due diligence | a review of a product or vendor before purchase or investment | custom engagement |

**Business problems addressed.**

* Uncertainty before investment.
* Conflicting vendor advice.
* Internal teams without AI or DevOps experience.
* Projects that need an outside check.

**Engineering deliverables.**

* Audit reports with a prioritised backlog.
* Review memos.
* Workshop summaries with decisions.
* Training material and exercises adapted to the client's stack.

**Engagement models.** Assessment ✓ · Workshop ✓ · Architecture (reviews) ✓ · Implementation → other
domains · Managed service → I.

**Prerequisites.**

* A clear question to answer.
* Access to the systems or documents under review.
* Availability of the people concerned.

**Limitations.**

* No accredited certification.
* Reviews state findings and recommendations, not guarantees.
* Training is not a substitute for production experience.

**CTA.** BG: „Заявете технически одит“ · EN: "Request a technical audit"

**Related domains and cross-sell.** Every domain: J is the entry point. Typical paths:

* J → A (roadmap);
* J → D (store fixes);
* J → B / C (first implementation);
* J → H (risk review).

**SEO.**

* **BG title:** Технически консултации, одити и обучение за AI и DevOps
* **BG meta:** Технически одити, преглед на архитектура и код, работни срещи и практическо обучение
  на екипи за AI, интеграции и DevOps — като първа стъпка преди внедряване.
* **EN title:** Technical advisory, audits and enablement for AI and DevOps
* **EN meta:** Technical audits, architecture and code reviews, workshops and hands-on team
  enablement for AI, integrations and DevOps — the first step before implementation.

## 6. Cross-sell matrix (primary paths)

| From → To | Why the next step follows |
| --- | --- |
| J → A | an audit reveals several use cases that need an order of work |
| A → B / C / G | prioritised use cases need implementation |
| B → G | agents act through integrations |
| B / C → H | customer-facing or data-sensitive AI needs controls |
| B / C / D → I | what is built needs operation |
| C → E | AI applications need a hosting platform |
| E → F | a new platform needs pipelines and observability |
| F → I | observability enables managed operations |
| D → G | store data must reach ERP and accounting |
| I → A | operating data shows where the next investment pays off |

## 7. Consistency rules

The `verify` step of the content roll-out turns these into tests:

1. Ten domains, unique keys, and unique BG and EN slugs that do not collide with any service slug.
2. Every existing `ServiceKey` has exactly one primary domain (§3).
3. Every family has a status from {available, custom engagement, planned}. A domain marked
   "available" has at least one available family. Pages show "planned" families only with their
   prerequisite.
4. SEO titles are at most 60 characters before the site suffix. Meta descriptions are 120–160
   characters, within the test limits of 70–175.
5. No domain title contains another page's primary keyword (CONTENT_STRATEGY §4).
6. No prices, client names, partner or certification claims, or numeric outcome claims.
