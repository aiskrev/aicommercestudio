import type { home as bgHome } from "@/content/bg/home";

export const home: typeof bgHome = {
  metaTitle: "AI solutions for online stores and SMEs: agents and automation",
  metaDescription:
    "We design, build and operate AI agents, automations and integrations for SMEs and online stores in Bulgaria and the EU — with human oversight built in.",
  hero: {
    eyebrow: "AI · Cloud · Platforms · Commerce",
    title: "We turn AI and the cloud",
    titleHighlight: "into systems your business can rely on",
    lead:
      "We help small and mid-sized companies with AI and business automation, online commerce, data and integrations, cloud platforms and ongoing support. We work to a written scope, and a person approves the actions that matter.",
    primaryCta: "Book a consultation",
    secondaryCta: "Assess your AI readiness",
    highlights: ["Ten service areas, from AI strategy to ongoing support", "A written scope and quote before we start", "A person approves the actions that matter"],
    systemMap: {
      label: "Architecture of an AI system",
      badge: "Concept",
      caption: "Illustrative architecture. Components are chosen per project.",
      layers: [
        { key: "data", title: "Your data and systems", items: ["Online store", "CRM / ERP", "Documents", "Email"] },
        { key: "intelligence", title: "AI processing", items: ["Language models", "Your documents (RAG)", "Business rules"] },
        { key: "agents", title: "Agents and automation", items: ["Support agent", "Operations agent", "Workflows"] },
      ],
      gate: { title: "Human approval", description: "Actions with real impact wait for a person to decide." },
      actions: { title: "Actions in your systems", items: ["Reply sent", "Order updated", "Report delivered"] },
      operations: "We track quality, cost and incidents for as long as the system runs",
    },
  },
  capabilities: {
    eyebrow: "Technology",
    title: "What we work with every day",
    lead: "These are the technologies and practices we use. We don't show invented logos or results.",
    groups: [
      { icon: "sparkles", title: "AI & LLM applications", items: ["Agents and assistants", "RAG over your documents", "Structured output and quality checks"] },
      { icon: "plug", title: "API integrations", items: ["Webhooks", "CRM, ERP, couriers", "Data synchronisation"] },
      { icon: "layers", title: "Next.js & FastAPI", items: ["Web applications", "Admin dashboards", "REST APIs"] },
      { icon: "cart", title: "Shopify & WooCommerce", items: ["Themes and apps", "Performance", "Updates and migrations"] },
      { icon: "database", title: "Cloud infrastructure", items: ["Docker", "PostgreSQL", "Backups"] },
      { icon: "shield", title: "Observability & security", items: ["Logging and alerts", "Least privilege", "GDPR practices"] },
    ],
  },
  offer: {
    eyebrow: "What we do",
    title: "How we can help",
    lead: "We work in three areas. Each one leads to service pages that say what we offer today and what we take on as a custom project after an assessment.",
    labels: { problem: "The problem", approach: "How we approach it", capabilities: "What it includes", outcome: "What you get", domains: "Service areas" },
    areas: [
      {
        key: "automation",
        icon: "bot",
        title: "AI Business Automation",
        problem: "Your team loses time on repetitive manual work, hunts for information in several places and replies slowly.",
        approach:
          "We map the process, decide which steps are worth automating and build agents, workflows and AI applications that use your documents and data. A person approves the actions that matter.",
        capabilities: ["AI strategy and readiness assessment", "AI agents and process automation", "AI applications that use your documents and data (RAG)", "Risk management and quality evaluation"],
        outcome: "A working automation with a written scope and tests, where it is clear what a person approves.",
        domains: ["ai_strategy", "ai_agents_automation", "ai_applications", "ai_governance", "advisory_enablement"],
      },
      {
        key: "engineering",
        icon: "layers",
        title: "Online commerce, data and cloud platforms",
        problem: "The store is slow or unstable, systems don't share data, every release feels risky and nobody fully controls the infrastructure.",
        approach: "We connect your systems through APIs, describe the infrastructure as code, run every change through automated checks (CI/CD) and monitor it from day one.",
        capabilities: ["Online store maintenance, SEO and analytics", "Integrations and data pipelines", "Cloud foundations (landing zones) and Kubernetes", "CI/CD, GitOps and monitoring"],
        outcome: "Documented, tested and monitored systems your team can run.",
        domains: ["commerce_engineering", "data_integration", "cloud_platform", "devops_sre"],
      },
      {
        key: "managed",
        icon: "gauge",
        title: "AI Managed Services",
        problem: "A live AI system doesn't stay the same: providers update their models, quality and costs drift, and often nobody is watching.",
        approach: "We monitor the system, check quality, respond to incidents and make controlled changes within a scope agreed in writing.",
        capabilities: ["Monitoring and incident response", "Quality evaluation and human review", "Cost control", "Security and governance"],
        outcome: "An AI system that is monitored and improved, whoever built it.",
        domains: ["managed_operations"],
      },
    ],
  },
  process: {
    eyebrow: "How we work",
    title: "Five stages, each ending in something you can check",
    lead: "We don't move on to the next stage until you have seen and approved the result of the previous one.",
    linkLabel: "Our process in detail",
    steps: [
      { title: "Discover", description: "We map the process, the data, the systems and where exactly time or money is lost.", outputs: ["Problem statement", "Success criteria"] },
      { title: "Design", description: "We settle the architecture, the risks and what a person approves. You get a written quote with milestones.", outputs: ["Technical outline", "Written quote"] },
      { title: "Build", description: "We build in short stages, test with real examples and check the quality of the answers.", outputs: ["Working solution", "Tests"] },
      { title: "Deploy", description: "We go live with limited permissions, logging and a rollback plan.", outputs: ["Go-live", "Documentation"] },
      { title: "Monitor & improve", description: "We watch quality, cost and incidents and plan the next improvements.", outputs: ["Monthly review", "Improvement plan"] },
    ],
  },
  tools: {
    startBadge: "Start here",
    eyebrow: "AI Business Automation Advisor",
    title: "Assess a process before we talk",
    lead: "The Advisor is a working tool on this site. Describe a manual process and get a first assessment, with no sign-up. You'll find the other tools in the Tools section.",
    allTools: "All tools",
    facts: [
      { title: "What you provide", text: "Your type of business, volume, team size, the systems you use and a short description of the process." },
      { title: "What you get", text: "Automation opportunities, complexity, the integrations needed and clarifying questions." },
      { title: "Where a person decides", text: "The assessment names the actions that need approval. It is indicative and contains no savings forecasts." },
      { title: "Your data", text: "Do not enter personal data; e-mail addresses and phone numbers are removed automatically. Saving the assessment is your choice." },
    ],
  },
  orchestration: {
    eyebrow: "Solution architecture",
    title: "AI suggests. People decide.",
    lead:
      "Every request follows a clear path: an event from your systems, AI processing, a check against fixed rules, approval by a person when an action has real impact, and a record of every action.",
    workflow: {
      label: "Example workflow",
      demo: "Demo · sample data",
      title: "Product return request",
      caption: "An illustration of how we design automations. The data is sample data, not from a real client.",
      steps: [
        { kind: "event", label: "Online store", detail: "New return request for order DEMO-1042" },
        { kind: "api", label: "Event / API", detail: "Webhook to the processing service", code: "returns.created · order: DEMO-1042" },
        { kind: "ai", label: "AI assistant", detail: "Classifies the reason and drafts a reply", output: [["category", "damaged item"], ["language", "English"], ["suggestion", "refund"]] },
        { kind: "approval", label: "Validation & approval", detail: "Business rules pass. A team member confirms the decision.", status: "Awaiting approval" },
        { kind: "action", label: "Business action", detail: "Refund and email to the customer", status: "Runs only after approval" },
      ],
    },
    allowedTitle: "AI may do on its own",
    allowed: ["read and summarise", "classify and extract data", "prepare drafts"],
    approvalTitle: "Requires approval",
    approval: ["messages to customers", "changes to prices, products and orders", "payments and refunds"],
    auditTitle: "Always recorded",
    audit: ["who approved", "when and why", "what exactly was executed"],
    linkLabel: "How we design approvals and control",
  },
  managed: {
    eyebrow: "After launch",
    title: "AI Managed Services: your system is monitored, maintained and improved",
    lead: "A monthly service that monitors and maintains AI systems, whether we built them or another team did. We have no published SLA: scope and response times are agreed in writing.",
    primaryCta: "Explore AI Managed Services",
    secondaryCta: "Request an assessment",
    contrast: [
      { title: "Build", text: "The solution works on the day it goes live." },
      { title: "Operate", text: "It stays reliable as providers, data and load change." },
      { title: "Improve", text: "Quality and cost are reviewed and improved with every version." },
      { title: "Govern", text: "Access, cost, risk and quality have an owner and a record." },
    ],
    lifecycle: {
      label: "Service lifecycle",
      caption: "An illustration of how we work. The scope is agreed in writing for each system.",
      center: "Your AI system",
      stages: [
        { key: "discover", title: "Discover", text: "Goals, architecture and risks of the system.", anchor: "ams-onboarding" },
        { key: "onboard", title: "Onboard", text: "Baseline, monitoring, test set and procedures.", anchor: "ams-onboarding" },
        { key: "observe", title: "Observe", text: "Runs, errors, response times, tokens and cost.", anchor: "ams-monitoring" },
        { key: "evaluate", title: "Evaluate", text: "Test cases, regressions and human review.", anchor: "ams-quality" },
        { key: "optimize", title: "Optimise", text: "Quality, speed and cost, checked before any change.", anchor: "ams-cost" },
        { key: "govern", title: "Govern", text: "Access, keys and passwords, approvals and a record of changes.", anchor: "ams-security" },
      ],
    },
  },
  proof: {
    eyebrow: "Example solution patterns",
    title: "How we approach typical problems",
    lead: "We have no published client projects, so we show no logos or results. Instead: fictional, clearly labelled scenarios and the patterns we apply.",
    scenarios: ["ai_invoice_workflow", "commerce_erp_sync", "ai_operations"],
    links: { scenarios: "All reference scenarios", patterns: "Integration patterns", workshops: "Workshops and assessments" },
  },
  faq: {
    eyebrow: "Frequently asked questions",
    title: "Answers to the most common questions",
    items: [
      {
        question: "What is an AI agent, and when do we need one?",
        answer:
          "An AI agent is a system that carries out a multi-step task — it reads data, decides what comes next and uses tools such as your CRM or store. It makes sense when the process repeats, the data is accessible and actions with impact pass through rules and approval. Often a simple automation is the better fit — and we will say so.",
      },
      {
        question: "Do we need AI to work with you?",
        answer:
          "No. Many projects start with maintenance, SEO or integrations. We only propose AI when there is a clear benefit and an acceptable risk.",
      },
      {
        question: "Where do we start if we don't know whether we're ready for AI?",
        answer:
          "With the AI Automation Advisor for a quick first assessment, or with the technical audit, which ends in a prioritised plan. Either way, processes and data are assessed first — not the technology.",
      },
      {
        question: "Is it safe to use AI with customer data?",
        answer:
          "It can be, if it is designed properly: minimal data sent to the model, personal data removed, a data processing agreement with the provider and human approval for sensitive actions.",
      },
      {
        question: "How is the price determined?",
        answer:
          "Once the scope is clear. For well-defined projects we offer a fixed price; maintenance and AI Managed Services are monthly subscriptions. Everything is set out in a written quote.",
      },
      {
        question: "Do you maintain AI agents built by another team?",
        answer:
          "Yes. Through AI Managed Services we take over monitoring, maintenance, quality evaluation and security of AI systems in production — after a technical review of the architecture and access.",
      },
      {
        question: "Which platforms do you work with?",
        answer:
          "Shopify and WooCommerce, CRM and ERP systems through their APIs, and custom builds on Next.js and FastAPI. For other platforms we do a technical assessment before committing.",
      },
      {
        question: "Who owns the code and the data?",
        answer:
          "Ownership is set out in the contract. Our approach is that your data stays yours and that solutions are documented so you can maintain them without us.",
      },
      {
        question: "Do you work with clients outside Bulgaria?",
        answer: "Yes, our services are aimed at businesses in Bulgaria and the European Union.",
      },
    ],
  },
  finalCta: {
    title: "Is a task taking up too much of your team's time?",
    lead: "Describe the task briefly. We'll review it and propose an approach — including when AI isn't needed.",
    primary: "Discuss your project",
    secondary: "Try the AI Advisor",
  },
};
