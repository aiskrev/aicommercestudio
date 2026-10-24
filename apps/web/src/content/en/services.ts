import type { ServiceDepth } from "@/content/bg/services-depth";
import type { ServiceTemplate } from "@/content/bg/services-template";
import { serviceTemplate } from "@/content/en/services-template";
import { serviceDepth } from "@/content/en/services-depth";
import type { Service } from "@/content/types";

const baseServices: Omit<Service, keyof ServiceDepth | keyof ServiceTemplate>[] = [
  {
    key: "ai_agents",
    slug: "ai-agent-development",
    icon: "bot",
    title: "AI agent development for customer service, operations and internal work",
    shortTitle: "AI agent development",
    summary:
      "Agents that carry out multi-step tasks through your systems — with clear limits, defined tools and human approval for actions that matter.",
    metaTitle: "AI agent development with human oversight",
    metaDescription:
      "AI agent development for small and mid-sized companies: customer service, order handling and internal tasks — with rules, audit logs and human approval built in.",
    intro:
      "An AI agent is more than a chatbot: it reads data, plans the next step and uses tools such as your CRM, store or inbox. We design agents with a narrow, clearly described job, minimal permissions and human approval points — so they help without taking on uncontrolled risk.",
    signals: [
      "Your team repeats the same multi-step tasks across several systems.",
      "Your chatbot answers questions but cannot do anything about the order or request itself.",
      "You want AI to take on routine work, but not decisions with financial impact.",
      "You tried an agent that behaved unpredictably or left no trace of what it did.",
    ],
    capabilities: [
      {
        title: "Customer service agents",
        description: "Check order status, draft replies and hand over to a person when they are not sure.",
      },
      {
        title: "Operations agents",
        description: "Handle returns, stock mismatches and recurring requests according to defined rules.",
      },
      {
        title: "Internal knowledge agents",
        description: "Answer your team's questions from documents and policies, citing the sources.",
      },
      {
        title: "Tools and integrations",
        description: "Access to your CRM, store, inbox or ERP through narrow API functions — only the actions that are needed.",
      },
      {
        title: "Rules and human approval",
        description: "Actions that affect customers, money or data pass deterministic checks and an approval step.",
      },
      {
        title: "Evaluation and monitoring",
        description: "Test scenarios before release, a log of every step and alerts when behaviour drifts.",
      },
    ],
    deliverables: [
      "A description of the task, its limits and the approval points",
      "A working agent in a test environment, checked with real examples",
      "A test set and quality criteria",
      "Logs, documentation and a monitoring plan",
    ],
    engagement: ["Fixed-scope project", "Ongoing operation through AI Managed Services"],
    faqs: [
      {
        question: "What is the difference between an AI agent and a chatbot?",
        answer:
          "A chatbot answers questions. An agent carries out a multi-step task — for example checking an order, drafting a reply and proposing a refund — using only the tools it has been explicitly allowed to use.",
      },
      {
        question: "Can the agent act on its own?",
        answer:
          "Only within the limits you set. Reading, classifying and drafting are usually autonomous; messages to customers, changes to orders and payments require approval.",
      },
      {
        question: "What happens if the agent makes a mistake?",
        answer:
          "Every step is logged, actions with impact require approval, and when the agent is unsure it escalates to a person. Quality is checked against test scenarios before release.",
      },
    ],
    related: ["automation", "integrations", "ai_managed"],
  },
  {
    key: "maintenance",
    slug: "ecommerce-maintenance",
    icon: "wrench",
    title: "Technical maintenance for Shopify and WooCommerce stores",
    shortTitle: "E-commerce maintenance",
    summary:
      "Shopify and WooCommerce maintenance, monitoring, performance and security — so your store runs reliably every day.",
    metaTitle: "Online store maintenance for Shopify and WooCommerce",
    metaDescription:
      "Online store maintenance for Shopify and WooCommerce: safe updates, monitoring, speed, security and backups. A monthly plan or one-off help.",
    intro:
      "An online store is a living system: platform updates, new apps and plugins, integrations and catalog changes constantly create the risk of errors. We take care of the technical side so your team can focus on selling.",
    signals: [
      "The store slows down or throws errors after updates.",
      "Nobody is available to react quickly to a technical problem.",
      "Integrations with couriers, payments or the warehouse break from time to time.",
      "You are not sure whether there is a current backup and a recovery plan.",
    ],
    capabilities: [
      {
        title: "Shopify and WooCommerce maintenance",
        description: "Theme, app and plugin updates, compatibility checks and controlled rollout of changes.",
      },
      {
        title: "Technical troubleshooting",
        description: "Diagnosing cart, payment, form and template errors with a clear explanation of cause and fix.",
      },
      {
        title: "Website monitoring",
        description: "Monitoring availability, response times and critical pages, with alerts when something deviates.",
      },
      {
        title: "Performance optimization",
        description: "Page-speed analysis and optimization of images, scripts and caching.",
      },
      {
        title: "Product catalog upkeep",
        description: "Bulk corrections to products, attributes and categories; data import and export.",
      },
      {
        title: "Integration maintenance",
        description: "Monitoring and fixing connections to payment providers, couriers, ERP and marketing tools.",
      },
      {
        title: "Security reviews",
        description: "Checking access, roles, outdated components and risky settings.",
      },
      {
        title: "Backups and a recovery plan",
        description: "Verifying backups, test restores and a documented incident procedure.",
      },
      {
        title: "Monthly maintenance plans",
        description: "An agreed amount of work, priorities and response times.",
      },
    ],
    deliverables: [
      "An initial technical review of the store",
      "A list of identified risks and priorities",
      "A monthly report of the work done",
      "Documented backup and recovery procedures",
    ],
    engagement: ["Monthly maintenance subscription", "One-off diagnosis and fix"],
    faqs: [
      {
        question: "Do you work with stores built by another agency?",
        answer:
          "Yes. We start with a technical review to understand how the store is built, what the risks are and what stable maintenance requires.",
      },
      {
        question: "What does the monthly plan include?",
        answer:
          "The scope is agreed individually — usually a set number of hours or tasks, monitoring, updates and a monthly report. The exact terms are described in the quote.",
      },
      {
        question: "How quickly do you respond to a problem?",
        answer: "Response times depend on the chosen plan and are fixed in writing in the contract.",
      },
    ],
    related: ["integrations", "seo", "audit"],
  },
  {
    key: "seo",
    slug: "seo-optimization",
    icon: "trending",
    title: "SEO for online stores: technical SEO, categories and products",
    shortTitle: "SEO and organic growth",
    summary:
      "Technical SEO audits, category and product optimization, structured data and Core Web Vitals with measurable progress.",
    metaTitle: "E-commerce SEO and technical SEO for online stores",
    metaDescription:
      "E-commerce SEO for online stores: indexing, canonical URLs, category and product SEO, Core Web Vitals and monthly reporting — without ranking promises.",
    intro:
      "Organic traffic is one of the most durable sales channels, but online stores lose it easily — through duplicate content, slow pages, weak categories or technical errors. We treat SEO as an engineering task with clear priorities and measurement.",
    signals: [
      "Organic traffic is flat or declining.",
      "Categories and products do not rank for the searches that drive sales.",
      "Search Console reports errors that nobody addresses.",
      "There is no clear picture of which SEO actions actually work.",
    ],
    capabilities: [
      {
        title: "Technical SEO audit",
        description: "Indexing, crawling, canonical URLs, redirects, duplicate content and internal links.",
      },
      {
        title: "On-page optimization",
        description: "Titles, meta descriptions, heading structure and content that matches search intent.",
      },
      {
        title: "Category and product SEO",
        description: "Catalog structure, filters, descriptions and internal linking aimed at commercial-intent searches.",
      },
      {
        title: "Content strategy",
        description: "A plan for articles and guides that support key categories — without keyword stuffing.",
      },
      {
        title: "Structured data",
        description: "Product, BreadcrumbList, Organization and other schema.org markup that reflects the real content.",
      },
      {
        title: "Core Web Vitals optimization",
        description: "Improving LCP, INP and CLS through specific technical changes.",
      },
      {
        title: "Search Console and analytics",
        description: "Setting up and checking Google Search Console and GA4 so the organic channel is measured correctly.",
      },
      {
        title: "SEO monitoring and reporting",
        description: "Tracking indexing, rankings and traffic with clear monthly reports.",
      },
      {
        title: "Monthly SEO programs",
        description: "A prioritized monthly plan of technical tasks, content and impact measurement.",
      },
    ],
    deliverables: [
      "A technical SEO audit with a prioritized plan",
      "Recommendations for the category structure",
      "A monthly report with key metrics",
      "A list of completed and upcoming tasks",
    ],
    engagement: ["Monthly SEO retainer", "One-off technical SEO audit"],
    faqs: [
      {
        question: "Do you guarantee first place on Google?",
        answer:
          "No. Nobody can honestly guarantee specific rankings. What we commit to is a transparent process, prioritized actions and measured results.",
      },
      {
        question: "When do SEO results show?",
        answer:
          "Technical fixes can have an effect relatively quickly, but sustainable organic growth usually takes months of consistent work.",
      },
      {
        question: "Do you optimize multilingual stores?",
        answer:
          "Yes. For multilingual stores we plan hreflang, the URL structure and the content for each market separately.",
      },
    ],
    related: ["analytics", "maintenance", "audit"],
  },
  {
    key: "ai_tools",
    slug: "custom-ai-tools",
    icon: "sparkles",
    title: "Custom AI engineering: assistants, RAG and AI tools for your business",
    shortTitle: "Custom AI engineering",
    summary:
      "AI assistants, product description generation, internal knowledge bases and RAG solutions built into your workflows.",
    metaTitle: "Custom AI tools: assistants, RAG and document analysis",
    metaDescription:
      "Custom AI tools for small and mid-sized businesses: customer assistants, RAG over your documents, product descriptions and document analysis with quality control.",
    intro:
      "Language models can save many hours of work — but only when they are connected to your data, processes and rules. We build practical AI tools with a clearly defined task, quality control and data protection.",
    signals: [
      "The team answers the same questions over and over.",
      "Writing product descriptions takes weeks.",
      "Internal knowledge is scattered across documents and emails.",
      "You want to use AI without putting customer data at risk.",
    ],
    capabilities: [
      {
        title: "Customer service AI assistants",
        description:
          "Answers about products, delivery and policies based on your data, with hand-over to a person when needed.",
      },
      {
        title: "Product description generation",
        description: "Drafts in your brand voice that an editor reviews and approves before publishing.",
      },
      {
        title: "Internal knowledge assistants",
        description: "Fast access to procedures, terms and technical documentation for the team.",
      },
      {
        title: "Document analysis",
        description: "Extracting key information from contracts, offers, specifications and invoices.",
      },
      {
        title: "Custom RAG solutions",
        description: "Search and answers over your documents, with the source cited.",
      },
      {
        title: "Reporting AI assistants",
        description: "Summaries and explanations of sales, campaign and operations data.",
      },
      {
        title: "Integration with your existing systems",
        description: "Embedding AI features into an existing store, CRM or internal application via APIs.",
      },
    ],
    deliverables: [
      "A use-case description and success criteria",
      "A working prototype for early feedback",
      "A test set for evaluating answer quality",
      "Documentation and handover of the solution",
    ],
    engagement: ["Fixed-scope project", "Ongoing operation of the AI application"],
    faqs: [
      {
        question: "Which AI model do you use?",
        answer:
          "We choose the model based on the task, quality, cost and data requirements. The architecture allows the provider to be changed without rewriting the application.",
      },
      {
        question: "Can the AI give a wrong answer?",
        answer:
          "Yes. That is why we define test scenarios, restrict answers to verified sources and plan escalation to a person when the system is unsure.",
      },
      {
        question: "What happens to our data?",
        answer:
          "Only the necessary data is sent to the model, personal data is removed where possible, and we work with providers that offer a data processing agreement.",
      },
    ],
    related: ["automation", "ai_managed", "integrations"],
  },
  {
    key: "automation",
    slug: "business-process-automation",
    icon: "workflow",
    title: "AI business process automation — with human oversight where it matters",
    shortTitle: "AI workflow automation",
    summary:
      "Inquiry classification, CRM workflows, document processing and system integrations — with human approval where needed.",
    metaTitle: "AI business process automation with human oversight",
    metaDescription:
      "AI business process automation: inquiry classification, document processing, CRM workflows and reporting — with human approval for the sensitive steps.",
    intro:
      "Many small and mid-sized businesses lose hours every week copying data, sorting emails and building reports by hand. We automate the repetitive steps and leave higher-risk decisions to people.",
    signals: [
      "Incoming inquiries are sorted by hand.",
      "Data is moved manually between the store, CRM and accounting.",
      "Reports are assembled in spreadsheets every month.",
      "Errors from manual work cost time and money.",
    ],
    capabilities: [
      {
        title: "Automatic inquiry classification",
        description: "Routing emails and forms by topic, urgency and responsible person.",
      },
      {
        title: "CRM workflow automation",
        description: "Creating and updating contacts, deals and tasks when specific events occur.",
      },
      {
        title: "Invoice and document processing",
        description: "Extracting data from documents, checked by a person before it is written to your systems.",
      },
      {
        title: "Email and workflow orchestration",
        description: "Sequences of steps with conditions, deadlines and notifications.",
      },
      {
        title: "Report automation",
        description: "Periodic reports generated from real data and sent to the right people.",
      },
      {
        title: "Human-in-the-loop workflows",
        description: "Sensitive actions wait for approval, and every decision is recorded in a log.",
      },
      {
        title: "Scheduled business tasks",
        description: "Nightly syncs, data checks and reminders on a schedule.",
      },
      {
        title: "System integrations",
        description: "Connecting the store, CRM, ERP, warehouse and communication channels.",
      },
    ],
    deliverables: [
      "A map of the current process and automation opportunities",
      "Defined human approval points",
      "An implemented and tested automation",
      "An action log and documentation",
    ],
    engagement: ["Automation implementation project", "Monthly support and expansion"],
    faqs: [
      {
        question: "Will automation replace our staff?",
        answer:
          "The goal is to remove repetitive manual work so the team can spend more time on customers and decisions. Key decisions stay with people.",
      },
      {
        question: "What if the automation makes a mistake?",
        answer:
          "We design checks, an action log and the ability to intervene manually. Higher-risk actions require explicit approval.",
      },
      {
        question: "Which systems can you connect to?",
        answer:
          "Any system that offers an API, webhooks or another reliable way to exchange data. We assess the options during the technical review.",
      },
    ],
    related: ["ai_tools", "ai_managed", "integrations"],
  },
  {
    key: "analytics",
    slug: "analytics-and-conversion",
    icon: "chart",
    title: "E-commerce analytics and conversion rate optimization",
    shortTitle: "Analytics and conversion",
    summary:
      "Sales dashboards, funnel and abandoned-cart analysis, GA4 and recommendations for improving the customer journey.",
    metaTitle: "Conversion rate optimization and e-commerce analytics with GA4",
    metaDescription:
      "Conversion rate optimization for online stores: accurate GA4 measurement, funnel and abandoned-cart analysis, sales dashboards and prioritized tests.",
    intro:
      "Most online stores collect plenty of data, but little of it turns into decisions. We build clear reports and analyses that show where you lose customers and which changes have the greatest potential.",
    signals: [
      "It is unclear at which step customers leave.",
      "GA4 is only partly configured or shows inconsistent data.",
      "Product and stock decisions are made on gut feeling.",
      "You do not know which website changes to test first.",
    ],
    capabilities: [
      {
        title: "Sales dashboards",
        description: "Key metrics for revenue, orders, average order value and margins in one place.",
      },
      {
        title: "Conversion funnel analysis",
        description: "Tracking the path from visit to order and finding the largest losses.",
      },
      {
        title: "Abandoned cart analysis",
        description: "Causes, patterns and specific measures to reduce abandonment.",
      },
      {
        title: "Product performance reports",
        description: "Which products sell, which are viewed without being bought and which tie up stock.",
      },
      {
        title: "Inventory analytics",
        description: "Signals for stock-outs, slow-moving items and seasonality.",
      },
      {
        title: "GA4 integration",
        description: "Correct setup of e-commerce events and conversions, and verification of the data.",
      },
      {
        title: "A/B test recommendations",
        description: "Prioritized hypotheses with the expected effect and how it will be measured.",
      },
      {
        title: "Customer journey improvements",
        description: "Specific changes to navigation, product pages and the cart.",
      },
    ],
    deliverables: [
      "An audit of measurement and data quality",
      "A dashboard with the key metrics",
      "A funnel analysis with prioritized recommendations",
      "A testing and measurement plan",
    ],
    engagement: ["Analysis and dashboard project", "Monthly analytics support"],
    faqs: [
      {
        question: "Do we need GA4 to get started?",
        answer:
          "Not necessarily. We can start with the data from your store platform and gradually build reliable measurement.",
      },
      {
        question: "Is the tracking GDPR-compliant?",
        answer:
          "We design measurement so that analytics tools only activate after consent where consent is required, and we recommend collecting as little data as possible. Compliance as a whole remains your organization's responsibility.",
      },
      {
        question: "Can you combine data from several sources?",
        answer: "Yes — data from the store, GA4, ad platforms, ERP or spreadsheets can be combined in one dashboard.",
      },
    ],
    related: ["seo", "automation", "audit"],
  },
  {
    key: "integrations",
    slug: "api-integrations-cloud-security",
    icon: "plug",
    title: "AI integrations, data systems and cloud infrastructure",
    shortTitle: "AI integrations & data systems",
    summary:
      "REST API and webhook integrations, connecting Shopify and WooCommerce with CRM and ERP, cloud deployment, monitoring and protection.",
    metaTitle: "API integrations for online stores, CRM and ERP",
    metaDescription:
      "API integrations between your online store, CRM, ERP and warehouse: product, stock and order sync, webhooks, monitoring and secure access management.",
    intro:
      "When systems do not exchange data reliably, the team compensates with manual work and customers feel the errors. We design and build integrations and infrastructure that are observable, secure and easy to maintain.",
    signals: [
      "Stock and orders drift apart between systems.",
      "Integrations stop without anyone noticing in time.",
      "Access to systems is not organized or controlled.",
      "The infrastructure is hard to update and scale.",
    ],
    capabilities: [
      {
        title: "REST API integrations",
        description: "Reliable connections between systems with error handling, retries and logging.",
      },
      {
        title: "Shopify and WooCommerce integrations",
        description: "Syncing products, stock, orders and customers.",
      },
      {
        title: "CRM and ERP integration",
        description: "Data exchange between the store and business systems without manual entry.",
      },
      {
        title: "Webhooks and event-driven processes",
        description: "Real-time reactions to events such as a new order, a payment or a stock change.",
      },
      {
        title: "Cloud deployment",
        description: "Containerized applications, reproducible environments and automated deployment.",
      },
      {
        title: "Monitoring and observability",
        description: "Logs, metrics and alerts that surface problems before customers feel them.",
      },
      {
        title: "Identity and access management",
        description: "Roles, least privilege and secure key storage.",
      },
      {
        title: "Security hardening",
        description: "Reviewing configurations, dependencies and settings with a concrete remediation plan.",
      },
    ],
    deliverables: [
      "A diagram of integrations and data flows",
      "Implemented and tested integrations",
      "Monitoring and alerting",
      "Maintenance and access documentation",
    ],
    engagement: ["Integration project", "Monthly integration support"],
    faqs: [
      {
        question: "What happens if an external system is unavailable?",
        answer: "Integrations are designed with retries, queues and alerts so that data is not lost.",
      },
      {
        question: "Can you work with our existing infrastructure?",
        answer:
          "Yes. We start by reviewing the current environment and propose changes gradually, without stopping the processes that work.",
      },
      {
        question: "How are access keys and passwords stored?",
        answer:
          "Secrets are kept outside the code — in a secure vault or environment variables — with the minimum permissions required.",
      },
    ],
    related: ["maintenance", "automation", "audit"],
  },
  {
    key: "ai_managed",
    slug: "ai-managed-services",
    icon: "activity",
    title: "AI Managed Services — AI Agent Operations & Optimization",
    shortTitle: "AI Managed Services & optimisation",
    summary:
      "Monitoring, maintenance, quality evaluation, security and cost optimization for AI agents and automations that are already in production.",
    metaTitle: "AI Agent Monitoring & Managed Services",
    metaDescription:
      "AI Managed Services: monitoring, maintenance, quality evaluation, security and cost control for AI agents, RAG assistants and AI-driven automations — custom quotes.",
    intro:
      "Building an AI agent is only the beginning. We help keep your AI systems reliable, secure, observable and effective — with monitoring, controlled changes, quality evaluation and clear reporting.",
    signals: [
      "Your AI agent is live, but nobody checks whether its answers stay correct.",
      "Model costs keep rising and nobody can say why.",
      "A change to a third-party API or model broke a workflow, and you heard it from a customer.",
      "The team that built the solution is no longer available.",
    ],
    capabilities: [
      {
        title: "AI agent monitoring",
        description: "Availability, errors, latency, failed workflows, token consumption and costs — based on available instrumentation.",
      },
      {
        title: "Maintenance and controlled change",
        description: "Prompts, configuration, model and API integrations, versioning, regression tests and rollback plans.",
      },
      {
        title: "Quality evaluation",
        description: "Test sets, golden cases, groundedness checks for RAG and quality trends across releases.",
      },
      {
        title: "Cost optimization",
        description: "Model selection, prompt length, caching, budget alerts and a monthly cost report.",
      },
      {
        title: "Security and governance",
        description: "Key rotation, least privilege, prompt-injection risk assessment, audit logging and human approval gates.",
      },
      {
        title: "Incident response and recovery",
        description: "Classification, investigation, remediation, rollback where available and post-incident reviews.",
      },
    ],
    deliverables: [
      "An initial technical assessment of the AI system",
      "Agreed monitoring based on the integrations available",
      "A monthly summary: health, incidents, quality and costs",
      "A list of recommendations and controlled changes",
    ],
    engagement: ["Monthly AI Monitor, AI Care or AI Optimize plan", "One-off assessment of an existing AI agent"],
    faqs: [
      {
        question: "How is this different from building an AI tool?",
        answer:
          "Development is a project with a start and an end. AI Managed Services is an ongoing service after launch: monitoring, maintenance, quality evaluation, security and cost optimization.",
      },
      {
        question: "Can you take over an agent built by another team?",
        answer:
          "Yes. We start with a technical assessment of the architecture, integrations, access and available instrumentation, and only then propose a plan.",
      },
      {
        question: "Do you guarantee the agent will not make mistakes?",
        answer:
          "No. The quality of language model output cannot be guaranteed. What we can do is measure it, detect regressions early and limit the impact of mistakes.",
      },
    ],
    related: ["ai_tools", "automation", "integrations"],
    customPage: true,
  },
  {
    key: "audit",
    slug: "technical-audit",
    icon: "clipboard",
    title: "AI strategy & readiness: a technical audit of your processes, data and store",
    shortTitle: "AI strategy & readiness",
    summary: "A structured assessment of your store, data and processes that ends with a prioritized improvement plan.",
    metaTitle: "Technical audit of an online store and AI readiness",
    metaDescription:
      "A technical audit of your online store: performance, SEO basics, security, integrations, data and AI opportunities — with a prioritized plan and effort estimates.",
    intro:
      "An audit is a good first step when it is unclear where to start. Within an agreed scope we review your store, integrations, data and processes, and you receive a concrete, prioritized action plan.",
    signals: [
      "You have many ideas but it is unclear which should come first.",
      "You want an independent assessment of the current technical implementation.",
      "You are considering AI or automation but do not know whether the data is ready.",
      "A redesign, migration or platform change is coming up.",
    ],
    capabilities: [
      {
        title: "Performance and stability",
        description: "Page speed, errors, dependencies and update risks.",
      },
      {
        title: "SEO basics",
        description: "Indexing, structure, metadata and technical issues that limit organic traffic.",
      },
      {
        title: "Security and access",
        description: "Roles, passwords, outdated components and data protection.",
      },
      {
        title: "Integrations and data flows",
        description: "How systems exchange data and where discrepancies arise.",
      },
      {
        title: "Analytics and measurement",
        description: "Data quality in GA4 and in the store platform.",
      },
      {
        title: "AI and automation opportunities",
        description: "Processes where AI or automation can save time at an acceptable level of risk.",
      },
    ],
    deliverables: [
      "A written report of findings",
      "A prioritized action plan — quick wins and longer-term measures",
      "An effort estimate for each recommendation",
      "A meeting to present and discuss the results",
    ],
    engagement: ["Paid audit with a fixed scope", "Optional implementation of the recommendations"],
    faqs: [
      {
        question: "Is the audit free?",
        answer: "No. The audit is a paid service with a fixed scope, which we agree in advance based on your inquiry.",
      },
      {
        question: "What access do you need?",
        answer:
          "Usually temporary, limited access to the store admin, analytics and Search Console. Access is removed when the audit is complete.",
      },
      {
        question: "Do we have to hire you for the implementation?",
        answer: "No. The plan is yours and can be carried out by your own team or another provider.",
      },
    ],
    related: ["maintenance", "seo", "ai_tools"],
    isOffering: true,
  },
];

export const services: Service[] = baseServices.map((service) => ({
  ...service,
  ...serviceDepth[service.key],
  ...serviceTemplate[service.key],
}));

export const coreServices = services.filter((s) => !s.isOffering);
