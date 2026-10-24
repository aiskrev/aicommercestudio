import type { home as bgHome } from "@/content/bg/home";

export const home: typeof bgHome = {
  metaTitle: "AI solutions for online stores and SMEs: agents and automation",
  metaDescription:
    "We design, build and operate AI agents, automations and integrations for SMEs and online stores in Bulgaria and the EU — with human oversight built in.",
  hero: {
    eyebrow: "AI consulting · Engineering · Automation · Managed AI",
    title: "AI systems that do",
    titleHighlight: "real work in your business",
    lead:
      "We design, build and operate AI agents, automations and integrations for small and mid-sized companies — connected to your store, CRM and documents, with human approval wherever a decision matters.",
    primaryCta: "Explore AI solutions",
    secondaryCta: "Assess your AI readiness",
    highlights: ["Agents, automation, integrations", "Human approval by design", "GDPR-conscious from day one"],
    systemMap: {
      label: "Architecture of an AI system",
      badge: "Concept",
      caption: "Illustrative architecture. Components are chosen per project.",
      layers: [
        { key: "data", title: "Your data and systems", items: ["Online store", "CRM / ERP", "Documents", "Email"] },
        { key: "intelligence", title: "Intelligence layer", items: ["Language models", "Knowledge (RAG)", "Business rules"] },
        { key: "agents", title: "Agents and automation", items: ["Support agent", "Operations agent", "Workflows"] },
      ],
      gate: { title: "Human approval", description: "Actions with real impact wait for a person to decide." },
      actions: { title: "Actions in your systems", items: ["Reply sent", "Order updated", "Report delivered"] },
      operations: "Monitoring, quality evaluation, cost and incidents — for the whole life of the system",
    },
  },
  capabilities: {
    eyebrow: "Technical capabilities",
    title: "Expertise you can verify",
    lead: "We don't show invented logos or results. These are the technologies and practices we work with every day.",
    groups: [
      { icon: "sparkles", title: "AI & LLM applications", items: ["Agents and assistants", "RAG over your knowledge", "Structured output and evaluation"] },
      { icon: "plug", title: "API integrations", items: ["Webhooks", "CRM, ERP, couriers", "Data synchronisation"] },
      { icon: "layers", title: "Next.js & FastAPI", items: ["Web applications", "Admin dashboards", "REST APIs"] },
      { icon: "cart", title: "Shopify & WooCommerce", items: ["Themes and apps", "Performance", "Updates and migrations"] },
      { icon: "database", title: "Cloud infrastructure", items: ["Docker", "PostgreSQL", "Backups"] },
      { icon: "shield", title: "Observability & security", items: ["Logging and alerts", "Least privilege", "GDPR practices"] },
    ],
  },
  build: {
    eyebrow: "What we build",
    title: "From the first assessment to AI that works every day",
    lead: "Six practices that fit together: start with one and add the next when it makes sense.",
    items: [
      {
        key: "agents",
        icon: "bot",
        title: "AI agents",
        description:
          "Assistants that read, classify, draft and act through your systems — within the limits you set.",
        examples: ["Customer service agent", "Internal knowledge assistant", "Order and returns handling"],
        linkLabel: "AI agent development",
        link: { service: "ai_agents" },
      },
      {
        key: "automation",
        icon: "workflow",
        title: "Business process automation",
        description:
          "Repetitive work between systems runs on its own — inquiry triage, document processing, CRM workflows.",
        examples: ["Inquiry triage", "Documents into the ERP", "Scheduled reports"],
        linkLabel: "AI workflow automation",
        link: { service: "automation" },
      },
      {
        key: "integrations",
        icon: "plug",
        title: "AI integrations",
        description:
          "We connect models to your store, CRM, ERP, inbox and documents through APIs and webhooks — with logging, retries and least-privilege access.",
        examples: ["Store ↔ CRM", "Couriers and warehouse", "Shared inbox"],
        linkLabel: "AI integrations & data systems",
        link: { service: "integrations" },
      },
      {
        key: "custom",
        icon: "layers",
        title: "Custom AI systems",
        description:
          "Tools built for your case: search over your own knowledge, product content generation, data extraction from documents.",
        examples: ["RAG over internal documents", "Product descriptions", "Invoice extraction"],
        linkLabel: "Custom AI engineering",
        link: { service: "ai_tools" },
      },
      {
        key: "consulting",
        icon: "clipboard",
        title: "AI consulting & readiness",
        description:
          "Where AI pays off, what data you need and what the risks are — before anything is built. Ends with a prioritised plan.",
        examples: ["Process assessment", "Data readiness", "Prioritised roadmap"],
        linkLabel: "AI strategy & readiness",
        link: { service: "audit" },
      },
      {
        key: "managed",
        icon: "activity",
        title: "AI Managed Services",
        description:
          "Monitoring, quality evaluation, incident response, security and cost control for AI agents already in production — ours or another team's.",
        examples: ["Monitoring and alerts", "Quality evaluation", "Controlled changes"],
        linkLabel: "AI Managed Services",
        link: { service: "ai_managed" },
      },
    ],
    foundation: {
      title: "The engineering foundation",
      lead: "AI only works well on a stable system, so we look after the online business itself too:",
      services: ["maintenance", "seo", "analytics"],
    },
  },
  process: {
    eyebrow: "How we work",
    title: "Five stages, each ending in something you can check",
    lead: "We don't move on to the next stage until you have seen and approved the result of the previous one.",
    linkLabel: "Our process in detail",
    steps: [
      { title: "Discover", description: "We map the process, the data, the systems and where exactly time or money is lost.", outputs: ["Problem statement", "Success criteria"] },
      { title: "Design", description: "Architecture, human approval points, risks and a written quote with milestones.", outputs: ["Technical outline", "Written quote"] },
      { title: "Build", description: "Short iterations, tests with real examples and checks on the quality of the answers.", outputs: ["Working solution", "Tests"] },
      { title: "Deploy", description: "Release into the real environment with limited permissions, logging and a rollback plan.", outputs: ["Go-live", "Documentation"] },
      { title: "Monitor & improve", description: "We watch quality, cost and incidents and plan the next improvements.", outputs: ["Monthly review", "Improvement plan"] },
    ],
  },
  tools: {
    eyebrow: "Interactive tools",
    title: "Try it before we talk",
    lead: "Tools you can use to assess the opportunity yourself — no sign-up. We only show what already works and clearly mark what is coming.",
    allTools: "All tools",
  },
  orchestration: {
    eyebrow: "Solution architecture",
    title: "AI suggests. People decide.",
    lead:
      "Every request follows a clear path: an event from your systems, AI processing, deterministic rules, human approval wherever there is real impact, and a record of every action.",
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
    linkLabel: "How we design control",
  },
  useCases: {
    eyebrow: "Use cases",
    title: "Where AI helps, function by function",
    lead: "Realistic scenarios with no promised percentages. Each one is clear about what the system does and where a person decides.",
    labels: { ai: "What AI does", human: "Where a person decides" },
    items: [
      {
        icon: "message",
        area: "Customer service",
        title: "Answering and routing inquiries",
        ai: "Classifies the inquiry and drafts a reply in the customer's language using the order data.",
        human: "Approves refunds, exceptions and sensitive replies.",
      },
      {
        icon: "trending",
        area: "Sales & marketing",
        title: "Product content and campaigns",
        ai: "Drafts product descriptions, SEO metadata and segment emails from your catalogue.",
        human: "Approves everything before it is published.",
      },
      {
        icon: "store",
        area: "Operations & logistics",
        title: "Order, return and stock exceptions",
        ai: "Spots mismatches between the store, warehouse and courier and proposes the fix.",
        human: "Confirms changes to orders and stock.",
      },
      {
        icon: "fileText",
        area: "Finance & administration",
        title: "Invoices and documents",
        ai: "Extracts fields from invoices and contracts and prepares them for accounting or the ERP.",
        human: "Approves payments and postings.",
      },
      {
        icon: "chart",
        area: "Management & reporting",
        title: "A weekly business summary",
        ai: "Summarises sales, traffic and inquiries with links back to the source data.",
        human: "Decisions stay entirely yours — the summary never takes action.",
      },
      {
        icon: "search",
        area: "Internal knowledge",
        title: "An assistant for your team",
        ai: "Answers staff questions about policies and product documentation, citing its sources.",
        human: "Document owners keep the sources up to date.",
      },
    ],
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
    title: "Have a process that should run on its own?",
    lead: "Describe the task briefly. We'll review it and propose an approach — including when AI isn't needed.",
    primary: "Discuss your project",
    secondary: "Try the AI Advisor",
  },
};
