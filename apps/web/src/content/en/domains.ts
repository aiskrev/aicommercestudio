import type { DomainContent } from "@/content/types";

/**
 * Texts of the ten service domains (docs/SERVICE_TAXONOMY.md §5). Statuses, links and tools live in
 * `lib/domains.ts`. No prices, client names, partnerships or promised outcomes.
 */
export const domains: DomainContent[] = [
  {
    key: "ai_strategy",
    slug: "ai-strategy-and-transformation",
    name: "AI Strategy & Transformation",
    summary: "Where AI is worth building, in what order and under which controls — before you invest in implementation.",
    positioning:
      "This domain decides where AI is worth building at all, in what order, and under which controls, before any money goes into implementation. The output is a plan that engineering can execute, not a slide deck.",
    idealCustomers: [
      "Owners and managers of SMEs and online retailers with several candidate AI use cases and no internal AI team.",
      "Operations or IT leads who need a defensible order of work and a budget envelope they can set themselves.",
    ],
    problems: [
      "Many ideas, no order of work.",
      "Pilots that never reached production.",
      "Unclear data ownership.",
      "Vendors proposing tools before the problem is defined.",
    ],
    families: {
      readiness: {
        title: "AI readiness assessment",
        capabilities:
          "Data, process, team, risk and infrastructure readiness. The online self-assessment (12 questions, 6 dimensions) is followed by an expert review.",
      },
      discovery: {
        title: "Use-case discovery and prioritisation",
        capabilities: "Process inventory, value and complexity scoring, human-approval points, build or buy.",
      },
      roadmap: {
        title: "AI roadmap and portfolio",
        capabilities: "Phased plan, dependencies, an owner per initiative, acceptance criteria, a decision log.",
      },
      operating_model: {
        title: "Operating model for AI",
        capabilities: "Roles, approval policy, change process, vendor and model selection criteria.",
      },
    },
    deliverables: [
      "A readiness report with blockers.",
      "A prioritised use-case register.",
      "A target architecture sketch per use case, with data flows and approval points.",
      "A phased roadmap with acceptance criteria.",
      "Model and provider selection criteria.",
    ],
    prerequisites: [
      "A named business owner.",
      "Access to the people who run the processes.",
      "Example data or documents for each candidate use case.",
    ],
    limitations: [
      "No change-management programme for large organisations.",
      "No savings forecasts: ROI is computed only from your own numbers.",
      "No vendor-neutral procurement tenders.",
    ],
    cta: "Request an AI readiness assessment",
    metaTitle: "AI strategy and an implementation roadmap for your business",
    metaDescription:
      "Readiness assessment, use-case prioritisation and a phased AI roadmap with acceptance criteria and human approval points — before you invest in implementation.",
  },
  {
    key: "ai_agents_automation",
    slug: "ai-agents-and-business-automation",
    name: "AI Agents & Business Automation",
    summary: "Agents and automated workflows inside your systems — with permission checks and human approval.",
    positioning:
      "This domain builds agents and automated workflows that act inside your systems. Every action with an external effect goes through a deterministic permission check and, where the rules require it, a human approval. It does not build autonomous systems with unbounded authority.",
    idealCustomers: [
      "Teams that move information between e-mail, CRM, helpdesk, documents and ERP by hand.",
      "Support, sales operations, back office and finance teams with repetitive, rule-bound work.",
    ],
    problems: [
      "Slow responses.",
      "Manual re-entry between systems.",
      "Errors from copy-paste.",
      "Work that depends on one person.",
      "Automation attempts that broke silently.",
    ],
    families: {
      task_agents: {
        title: "Task agents",
        capabilities:
          "Lead qualification, customer support drafts, document intake, scheduling, research briefs, reporting summaries — the ten roles of the AI Agent Library.",
      },
      workflow_automation: {
        title: "Workflow automation",
        capabilities: "Triggers, routing, data transformation, retries, error queues, idempotent writes.",
      },
      multi_agent: {
        title: "Multi-agent coordination",
        capabilities: "Coordinator and approval-supervisor roles, escalation paths. Scoped per project.",
      },
      human_in_the_loop: {
        title: "Human-in-the-loop design",
        capabilities: "Approval points by risk, sample review, approval UI, audit trail.",
      },
      agent_tools: {
        title: "Agent tools on your APIs",
        capabilities: "Tool definitions over your APIs with least-privilege credentials.",
      },
    },
    deliverables: [
      "An agent and workflow specification: roles, inputs and outputs, approval matrix.",
      "Implemented agents and workflows with evaluation cases.",
      "Least-privilege service accounts.",
      "An audit log of every action.",
      "A runbook and a rollback procedure.",
    ],
    prerequisites: [
      "API access, or a sanctioned integration path, to the systems involved.",
      "A process owner who defines the approval rules.",
      "Test accounts and a non-production environment where possible.",
    ],
    limitations: [
      "No actions in systems without an API or an approved integration — no screen-scraping of production systems without written approval.",
      "No guaranteed accuracy.",
      "Agents do not replace legally required human decisions.",
    ],
    cta: "Describe the process you want to automate",
    metaTitle: "AI agents and business automation with human approval",
    metaDescription:
      "Design and delivery of AI agents and automated workflows across CRM, e-mail, helpdesk and ERP — with permission checks, approval points and an audit trail.",
  },
  {
    key: "ai_applications",
    slug: "ai-applications-and-knowledge-systems",
    name: "AI Applications & Knowledge Systems",
    summary: "AI assistants and features on your own documents and data — with sources, permissions and measured quality.",
    positioning:
      "This domain builds AI applications that answer from your own documents and data, with sources, permissions and measured quality. It covers internal assistants, document analysis, and AI features inside existing products.",
    idealCustomers: [
      "Companies whose knowledge sits in documents, wikis and tickets.",
      "Teams that process contracts, invoices or forms.",
      "Product teams adding AI features to an existing application.",
    ],
    problems: [
      "Employees cannot find answers.",
      "Repetitive questions to the same experts.",
      "Manual reading of documents.",
      "AI demos that hallucinate or ignore permissions.",
    ],
    families: {
      rag: {
        title: "Retrieval-augmented assistants (RAG)",
        capabilities:
          "Ingestion, chunking, embeddings, hybrid search, access-aware retrieval, cited answers, “no source, no answer”.",
      },
      documents: {
        title: "Document analysis and extraction",
        capabilities: "Classification, field extraction with confidence, validation rules, human review queues.",
      },
      product_features: {
        title: "AI features in products",
        capabilities: "Summarisation, drafting, classification and search inside your application, behind feature flags.",
      },
      evaluation: {
        title: "Evaluation and quality engineering",
        capabilities: "Test sets, retrieval and answer metrics, regression gates in CI.",
      },
      adaptation: {
        title: "Model adaptation",
        capabilities: "Prompt and tool design first; fine-tuning only with a demonstrated need and sufficient data.",
      },
    },
    deliverables: [
      "An ingestion pipeline.",
      "Index design with permission filtering.",
      "An application or API.",
      "An evaluation set with baseline results.",
      "Monitoring of cost and latency.",
      "Data-handling documentation.",
    ],
    prerequisites: [
      "Access to the source documents and their permission model.",
      "A content owner who confirms what is authoritative.",
      "Agreed data-processing terms with the model provider.",
    ],
    limitations: [
      "Quality depends on the source documents.",
      "We do not train foundation models.",
      "No guarantees of factual accuracy; answers without a source are refused by design.",
      "Regulated or special-category data only after a data processing agreement and a risk assessment.",
    ],
    cta: "Discuss an AI application for your data",
    metaTitle: "AI applications and knowledge assistants on your documents",
    metaDescription:
      "Internal AI assistants, document analysis and AI product features built on your own data — with cited sources, access control and measured quality.",
  },
  {
    key: "commerce_engineering",
    slug: "commerce-engineering",
    name: "Commerce Engineering",
    summary: "Stability, speed, search visibility, measurement and integrations for Shopify and WooCommerce stores.",
    positioning:
      "This domain is the technical foundation of online stores: stability, speed, search visibility, measurement and integrations for Shopify and WooCommerce. It is the original core of the studio, and it is where AI features for commerce are applied.",
    idealCustomers: [
      "Small and mid-sized online stores without an in-house developer.",
      "Merchants with app or plugin sprawl.",
      "Stores with stagnant organic traffic or unreliable analytics.",
    ],
    problems: [
      "Slow or unstable stores.",
      "Broken updates.",
      "Lost rankings after changes.",
      "Unreliable conversion data.",
      "Manual order and stock handling.",
    ],
    families: {
      maintenance: {
        title: "Store maintenance and stability",
        capabilities: "Updates, backups, uptime and error monitoring, plugin and app hygiene, security patches.",
      },
      performance: {
        title: "Performance engineering",
        capabilities:
          "Core Web Vitals, image and script budgets, theme optimisation, caching — within maintenance and the audit.",
      },
      seo: {
        title: "Technical and e-commerce SEO",
        capabilities: "Crawlability, structured data, faceted navigation, internationalisation, migrations.",
      },
      analytics: {
        title: "Analytics and conversion",
        capabilities: "GA4 and server-side events, funnels, experiment design, data quality.",
      },
      integrations: {
        title: "Commerce integrations",
        capabilities: "ERP, inventory, accounting, couriers and marketplaces.",
      },
      replatforming: {
        title: "Replatforming and headless",
        capabilities: "Migration plans, redirects, data migration, headless storefront architecture.",
      },
      ai_for_commerce: {
        title: "AI for commerce",
        capabilities: "Product content drafts, search and recommendation assistants, support agents.",
      },
    },
    deliverables: [
      "A technical audit with a prioritised backlog.",
      "A maintenance log.",
      "Performance budgets and reports.",
      "A structured-data implementation.",
      "A tracking plan and an event specification.",
      "A migration plan with a redirect map.",
    ],
    prerequisites: [
      "Admin access to the store and its hosting.",
      "Access to analytics and Search Console.",
      "A staging environment, or approval to create one.",
    ],
    limitations: [
      "No guaranteed rankings or traffic.",
      "No marketplace or advertising account management.",
      "Platform limits (for example Shopify plan features) apply.",
      "Visual design work only within technical scope.",
    ],
    cta: "Request a technical store audit",
    metaTitle: "Commerce engineering for Shopify and WooCommerce stores",
    metaDescription:
      "Maintenance, performance, technical SEO, analytics and integrations for online stores — one technical partner for the store, its data and its AI features.",
  },
  {
    key: "cloud_platform",
    slug: "cloud-and-platform-engineering",
    name: "Cloud & Platform Engineering",
    summary: "Cloud infrastructure as code: environments, containers, databases, secrets, backups and cost control.",
    positioning:
      "This domain designs and builds the infrastructure that applications and AI workloads run on: containers, managed databases, networking, identity, secrets and cost control on your chosen cloud or an EU hosting provider, all described as code and handed over with documentation. It is a substantial engineering offering in its own right, not an accessory to AI.",
    idealCustomers: [
      "SMEs moving from a single server or shared hosting to a managed platform.",
      "Product teams that need a production-ready environment for a new application or AI workload.",
      "Companies with a cloud bill nobody can explain.",
    ],
    problems: [
      "Fragile single-server setups.",
      "No backups or untested restores.",
      "Manual deployments.",
      "Secrets in code.",
      "Unclear cloud costs.",
      "No environment for testing.",
    ],
    families: {
      landing_zone: {
        title: "Landing zone and environments",
        capabilities: "Accounts and projects, networks, identity and access, environment separation (dev, staging, prod).",
      },
      iac: {
        title: "Infrastructure as code",
        capabilities: "Terraform or the provider's IaC, modules, state handling, review workflow.",
      },
      containers: {
        title: "Containers and runtime",
        capabilities: "Docker images, Compose for small estates, managed container services or Kubernetes where justified.",
      },
      data_services: {
        title: "Data platform services",
        capabilities: "Managed PostgreSQL, object storage, backups and restore tests, encryption at rest.",
      },
      secrets: {
        title: "Secrets and identity",
        capabilities: "Secrets manager, rotation, workload identity, least-privilege roles.",
      },
      ai_hosting: {
        title: "AI workload hosting",
        capabilities:
          "Model API gateways, private networking to providers, GPU capacity only where required, EU data residency.",
      },
      cost: {
        title: "Cost management",
        capabilities: "Tagging, budgets and alerts, rightsizing reviews.",
      },
      migration: {
        title: "Migration",
        capabilities: "Lift-and-improve of existing applications, cut-over plans, rollback.",
      },
    },
    deliverables: [
      "An architecture and decision records.",
      "An IaC repository.",
      "Environment and network diagrams.",
      "Backup and restore runbooks with an executed restore test.",
      "An access model.",
      "Cost dashboards and budgets.",
      "A handover session.",
    ],
    prerequisites: [
      "You own the cloud accounts and billing, and grant delegated access.",
      "A decision on provider and region (EU by default).",
      "A named owner for access approvals.",
    ],
    limitations: [
      "No reselling of cloud capacity.",
      "We hold no cloud-provider partnerships or certifications and claim none.",
      "Large multi-region or regulated-industry landing zones only after an assessment.",
      "We do not run your on-premise hardware.",
    ],
    cta: "Discuss a cloud platform for your application",
    metaTitle: "Cloud and platform engineering with infrastructure as code",
    metaDescription:
      "Design and build of cloud environments: infrastructure as code, containers, managed databases, secrets, tested backups and cost control, EU-hosted by default.",
  },
  {
    key: "devops_sre",
    slug: "devops-sre-and-observability",
    name: "DevOps, SRE & Observability",
    summary: "Repeatable software delivery and visible production behaviour: pipelines, monitoring, incident practice.",
    positioning:
      "This domain makes software delivery repeatable and production behaviour visible: pipelines, release safety, monitoring, alerting and incident practice. SRE here means service-level objectives, error budgets and blameless reviews, applied at the scale of your team. It is not a 24/7 operations centre.",
    idealCustomers: [
      "Teams that deploy by hand or rarely.",
      "Applications whose failures are discovered by customers.",
      "Organisations introducing AI workloads that need tracing and cost visibility.",
    ],
    problems: [
      "Risky releases.",
      "No rollback.",
      "Outages noticed late.",
      "Alert noise.",
      "No shared view of what is slow or failing.",
      "AI costs that are only seen on the invoice.",
    ],
    families: {
      cicd: {
        title: "CI/CD pipelines",
        capabilities: "Build, test, security scanning, preview environments, promotion, rollback.",
      },
      release: {
        title: "Release engineering",
        capabilities: "Migrations as a gated step, feature flags, canary or blue-green where justified.",
      },
      observability: {
        title: "Observability",
        capabilities: "Structured logs, metrics, OpenTelemetry tracing, dashboards, synthetic checks.",
      },
      alerting: {
        title: "Alerting and on-call design",
        capabilities: "SLO-based alerts, routing, runbooks, escalation. On-call staffing is agreed separately.",
      },
      reliability: {
        title: "Reliability engineering",
        capabilities: "SLOs and error budgets, load and failure testing, capacity reviews.",
      },
      incidents: {
        title: "Incident practice",
        capabilities: "Incident procedure, post-incident reviews, preventive backlog.",
      },
      llm_observability: {
        title: "LLM observability",
        capabilities: "Tracing of model and tool calls, token and cost tracking, latency, redaction.",
      },
    },
    deliverables: [
      "Pipeline definitions in your repository.",
      "A release and rollback runbook.",
      "Dashboards and alert rules as code.",
      "Documented SLOs.",
      "An incident procedure and review template.",
      "Tracing instrumentation with redaction.",
    ],
    prerequisites: [
      "Access to the source repositories and the CI system.",
      "An environment where pipelines can deploy.",
      "A decision on which tools are acceptable (hosted SaaS or self-hosted).",
    ],
    limitations: [
      "No staffed 24/7 on-call unless agreed and staffed.",
      "No published response times.",
      "Tool licences are paid by you.",
      "SLOs are set with you and are not guaranteed by us.",
    ],
    cta: "Request a delivery and observability review",
    metaTitle: "DevOps, SRE and observability: CI/CD and monitoring",
    metaDescription:
      "CI/CD pipelines, safe releases, logs, metrics, OpenTelemetry tracing, SLOs and an incident practice — sized for your team and documented in your repository.",
  },
  {
    key: "data_integration",
    slug: "data-and-integration-engineering",
    name: "Data & Integration Engineering",
    summary: "Connected systems and usable data: API integrations, synchronisation, event flows and data models.",
    positioning:
      "This domain connects systems and makes their data usable: API integrations, sync jobs, event flows and analytical data models with clear ownership and error handling. Agents, assistants and reporting depend on it.",
    idealCustomers: [
      "Companies with a store, CRM, ERP, accounting and helpdesk that do not talk to each other.",
      "Teams preparing data for AI or reporting.",
    ],
    problems: [
      "Double data entry.",
      "Stock and order mismatches.",
      "Reports built by hand in spreadsheets.",
      "AI projects blocked by inaccessible data.",
    ],
    families: {
      api: {
        title: "API integrations",
        capabilities: "REST and GraphQL, webhooks, authentication, rate limits, retries, idempotency, error queues.",
      },
      sync: {
        title: "System synchronisation",
        capabilities: "Product, stock, order, customer and invoice sync between store, ERP, CRM and accounting.",
      },
      events: {
        title: "Event and workflow plumbing",
        capabilities: "Queues, scheduled jobs, change data capture where supported.",
      },
      pipelines: {
        title: "Data pipelines and models",
        capabilities: "Extraction, cleaning and modelling for reporting and AI; data-quality checks.",
      },
      analytical_stores: {
        title: "Analytical stores",
        capabilities: "A warehouse or PostgreSQL-based reporting store, BI connections.",
      },
      data_for_ai: {
        title: "Data for AI",
        capabilities: "Document and record preparation, permission metadata, embeddings pipelines.",
      },
    },
    deliverables: [
      "An integration specification with field mappings.",
      "Implemented connectors with monitoring and an error queue.",
      "Data-flow diagrams.",
      "A data dictionary.",
      "Data-quality checks.",
      "A runbook.",
    ],
    prerequisites: [
      "API documentation and credentials for each system, issued with least privilege.",
      "A data owner per system.",
      "Sandbox accounts where the vendors offer them.",
    ],
    limitations: [
      "Integrations are limited by vendor APIs and their terms.",
      "No certified-partner status with any vendor is claimed.",
      "Legacy systems without an API need an assessment first.",
    ],
    cta: "Describe the systems you need connected",
    metaTitle: "Data and integration engineering for business systems",
    metaDescription:
      "Connecting store, CRM, ERP and accounting, data synchronisation, pipelines and data models for reporting and AI — with retries, error queues and monitoring.",
  },
  {
    key: "ai_governance",
    slug: "ai-governance-security-and-assurance",
    name: "AI Governance, Security & Assurance",
    summary: "Controls around AI systems that can be checked: permissions, data, quality evaluation and incident handling.",
    positioning:
      "This domain puts controls around AI systems that a business, its customers and its auditors can check: who may do what, which data reaches which model, how quality is evaluated, and what happens when something goes wrong. It is engineering governance, not legal advice.",
    idealCustomers: [
      "Companies putting AI in front of customers or into decisions.",
      "Teams that must answer data-protection or customer security questionnaires.",
      "Organisations preparing for the obligations of the EU AI Act, together with their own legal counsel.",
    ],
    problems: [
      "AI deployed without clear accountability.",
      "Customer or auditor questions nobody can answer.",
      "Personal data sent to models without terms.",
      "Agents with broad permissions.",
      "No evidence of quality.",
    ],
    families: {
      risk_review: {
        title: "AI risk and use-case review",
        capabilities:
          "Classification of use cases by impact, approval requirements, documentation duties — with your legal counsel.",
      },
      approvals: {
        title: "Approval and permission design",
        capabilities:
          "Deterministic authorisation around model output, human approval matrices, audit trails. Part of delivery in AI agent projects.",
      },
      data_protection: {
        title: "Data protection engineering",
        capabilities: "Data minimisation, redaction, retention, residency, DPA requirements for providers.",
      },
      security: {
        title: "Security engineering for AI",
        capabilities: "Prompt-injection defences, tool permission boundaries, secret handling, threat models.",
      },
      evaluation: {
        title: "Evaluation and assurance",
        capabilities: "Test sets, red-team style probing within agreed scope, evaluation reports, regression gates.",
      },
      policy: {
        title: "Policy and documentation",
        capabilities: "AI usage policy, model and data inventory, incident procedure.",
      },
    },
    deliverables: [
      "A risk register per AI system.",
      "An approval matrix.",
      "A data-flow and processing inventory.",
      "A threat model.",
      "An evaluation report.",
      "Policy drafts for legal review.",
      "Implemented controls: redaction, permission checks, audit log.",
    ],
    prerequisites: [
      "An inventory of AI systems and data flows, or access to build one.",
      "Your legal or data-protection contact.",
      "Agreement on the scope of any adversarial testing, in writing.",
    ],
    limitations: [
      "No legal advice, no certification and no compliance guarantee. Regulatory interpretation stays with your lawyers.",
      "Penetration testing beyond agreed AI-specific probing is referred to specialised providers.",
    ],
    cta: "Request an AI system risk review",
    metaTitle: "AI governance and security: risk, data protection, controls",
    metaDescription:
      "Risk review, approval and permission design, data protection, prompt-injection defences and evaluation for AI systems — engineering controls, not legal advice.",
  },
  {
    key: "managed_operations",
    slug: "managed-ai-and-platform-operations",
    name: "Managed AI & Platform Operations",
    summary: "Ongoing operation of what has been built: monitoring, maintenance, evaluation, cost and incidents.",
    positioning:
      "This domain is the ongoing operation of what has been built, by us or by others: monitoring, maintenance, evaluation, cost control, incident response and continuous improvement, under a written scope. Data comes from your systems once access is agreed. Nothing is reported before it is actually connected.",
    idealCustomers: [
      "Companies with an AI assistant, agent or automation in daily use and no one responsible for it.",
      "Stores and applications without in-house operations.",
    ],
    problems: [
      "AI systems that degrade unnoticed.",
      "Rising model costs.",
      "No one owning incidents.",
      "Updates postponed until something breaks.",
    ],
    families: {
      managed_ai: {
        title: "Managed AI systems",
        capabilities:
          "The eight operating areas on the AI Managed Services page: reliability, execution visibility, cost and tokens, quality evaluation, human review, incident response, optimisation, governance.",
      },
      store_operations: {
        title: "Store operations",
        capabilities: "Maintenance, updates, monitoring and backups — the e-commerce maintenance service.",
      },
      platform_operations: {
        title: "Platform operations",
        capabilities: "Patching, backups and restore tests, capacity and cost reviews for cloud environments.",
      },
      integration_health: {
        title: "Integration health",
        capabilities: "Monitoring of connectors, error queues and data-quality checks.",
      },
      reporting: {
        title: "Reporting",
        capabilities: "Monthly reports from connected data and quarterly reviews.",
      },
      portal: {
        title: "Client operations portal",
        capabilities: "Organisations, system registry, incidents, reports, and later telemetry.",
        prerequisite: "Database-level tenant isolation (RLS), client accounts with MFA, and a data processing agreement.",
      },
    },
    deliverables: [
      "An onboarding assessment and baseline.",
      "A monitoring and alerting configuration.",
      "Evaluation runs.",
      "A change log.",
      "Incident reports.",
      "Monthly reports.",
      "An improvement backlog.",
    ],
    prerequisites: [
      "Access to logs and metrics, and to provider usage data.",
      "A notification channel.",
      "A named owner on your side.",
      "A data processing agreement before production data is processed.",
    ],
    limitations: [
      "No published SLA, no 24/7 and no “unlimited” work. Response times are agreed in the contract.",
      "Third-party costs are separate.",
      "The client portal is not available yet.",
    ],
    cta: "Request an AI assessment",
    metaTitle: "Managed AI systems and platform operations",
    metaDescription:
      "Ongoing operation of AI agents, applications, stores and cloud environments: monitoring, evaluation, cost, incidents and improvements — under an agreed scope.",
  },
  {
    key: "advisory_enablement",
    slug: "advisory-assessments-and-enablement",
    name: "Advisory, Assessments & Enablement",
    summary: "Short, fixed-scope work that produces decisions: audits, architecture reviews and hands-on enablement.",
    positioning:
      "This domain covers short, fixed-scope work that produces decisions and capability in your own team: audits, architecture reviews, second opinions and hands-on enablement. It is the recommended first step before most implementations.",
    idealCustomers: [
      "Decision makers who need an independent technical view before they commit.",
      "Teams that want to build in-house with expert review.",
    ],
    problems: [
      "Uncertainty before investment.",
      "Conflicting vendor advice.",
      "Internal teams without AI or DevOps experience.",
      "Projects that need an outside check.",
    ],
    families: {
      audits: {
        title: "Technical audits",
        capabilities: "E-commerce technical audit, AI readiness, integration and data review.",
      },
      reviews: {
        title: "Architecture and code reviews",
        capabilities: "Second opinion on designs, vendor proposals and code bases.",
      },
      self_service: {
        title: "Self-service assessments",
        capabilities:
          "AI readiness, Opportunity Finder, ROI calculator, Solution Builder, AI team and the Advisor — free and online.",
      },
      workshops: {
        title: "Workshops",
        capabilities: "Use-case discovery, approval design, architecture sessions.",
      },
      training: {
        title: "Enablement and training",
        capabilities:
          "Hands-on sessions for developers and operators: prompt and tool design, evaluation, RAG, CI/CD for AI.",
      },
      due_diligence: {
        title: "Technical due diligence",
        capabilities: "A review of a product or vendor before purchase or investment.",
      },
    },
    deliverables: [
      "Audit reports with a prioritised backlog.",
      "Review memos.",
      "Workshop summaries with decisions.",
      "Training material and exercises adapted to your stack.",
    ],
    prerequisites: [
      "A clear question to answer.",
      "Access to the systems or documents under review.",
      "Availability of the people concerned.",
    ],
    limitations: [
      "No accredited certification.",
      "Reviews state findings and recommendations, not guarantees.",
      "Training is not a substitute for production experience.",
    ],
    cta: "Request a technical audit",
    metaTitle: "Technical advisory, audits and enablement for AI and DevOps",
    metaDescription:
      "Technical audits, architecture and code reviews, workshops and hands-on team enablement for AI, integrations and DevOps — the first step before implementation.",
  },
];
