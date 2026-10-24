import type { home as bgHome } from "@/content/bg/home";

export const home: typeof bgHome = {
  metaTitle: "AI solutions for online stores, SEO and automation",
  metaDescription:
    "A technical partner for online stores in Bulgaria and the EU: Shopify and WooCommerce maintenance, SEO, business process automation and AI solutions with human oversight.",
  hero: {
    eyebrow: "E-commerce engineering · AI · Automation",
    title: "Technology that moves",
    titleHighlight: "your online business forward",
    lead:
      "One technical partner for your store, your data and AI. We keep your online store stable, grow organic traffic and introduce AI where it delivers measurable value — with a clear process and human oversight.",
    primaryCta: "Book a consultation",
    secondaryCta: "Explore our services",
    highlights: ["Shopify and WooCommerce", "AI with human approval", "GDPR by default"],
    context: "Shopify · WooCommerce · Next.js · FastAPI · LLM integrations",
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
  },
  servicesIntro: {
    eyebrow: "Services",
    title: "Seven disciplines, one technical partner",
    lead: "From day-to-day maintenance to custom AI tools and AI operations — use each service on its own or as part of a complete plan.",
    groups: {
      ai: {
        title: "AI & automation",
        lead: "Solutions that add intelligence to your processes — and keep them reliable after launch.",
      },
      core: {
        title: "Core operations",
        lead: "The technical foundation of an online business: stability, visibility, data and integrations.",
      },
    },
  },
  problems: {
    eyebrow: "Problems we solve",
    title: "When technology holds growth back instead of driving it",
    lead: "Every problem has a specific technical cause — and a specific service that addresses it.",
    solutionLabel: "Solution",
    items: [
      {
        icon: "gauge",
        title: "The store is slow or unstable",
        description: "Slow pages, errors after updates and broken integrations cost orders every day.",
        service: "maintenance",
      },
      {
        icon: "trending",
        title: "Organic traffic is not growing",
        description: "Categories and products do not rank, and technical issues go unnoticed.",
        service: "seo",
      },
      {
        icon: "clock",
        title: "The team loses time on manual work",
        description: "Copying data between systems, sorting inquiries by hand and rebuilding the same reports.",
        service: "automation",
      },
      {
        icon: "chart",
        title: "Data does not lead to decisions",
        description: "You have reports and GA4, but it is unclear where you lose customers and what to change first.",
        service: "analytics",
      },
      {
        icon: "sparkles",
        title: "AI looks promising but vague",
        description: "It is unclear which processes are worth automating and how to do it safely.",
        service: "ai_tools",
      },
      {
        icon: "plug",
        title: "Your systems do not talk to each other",
        description: "The store, CRM, ERP and warehouse work in isolation and the data drifts apart.",
        service: "integrations",
      },
      {
        icon: "activity",
        title: "The AI solution runs, but nobody maintains it",
        description: "Answers degrade after changes, costs creep up and nobody watches how the system behaves.",
        service: "ai_managed",
      },
    ],
  },
  aiControl: {
    eyebrow: "AI with human control",
    title: "AI suggests. People decide.",
    lead: "We design AI solutions so routine work runs automatically, while actions with real impact on customers, prices or orders pass through business rules and approval.",
    stages: [
      { kind: "input", title: "Input", description: "An inquiry, document, order or event from your systems." },
      { kind: "ai", title: "AI processing", description: "Classification, data extraction and drafts — suggestions only." },
      { kind: "rules", title: "Business rules", description: "Deterministic checks: permissions, limits, stock, statuses." },
      { kind: "human", title: "Human approval", description: "Actions with real impact require an explicit decision." },
      { kind: "output", title: "Output & record", description: "Executed through the integration and logged — who, when and why." },
    ],
    allowedTitle: "AI may do on its own",
    allowed: ["read and summarise", "classify and extract data", "prepare drafts"],
    approvalTitle: "Requires approval",
    approval: ["messages to customers", "changes to prices, products and orders", "payments and refunds"],
  },
  process: {
    eyebrow: "How we work",
    title: "A clear process from the first conversation to stable operation",
    lead: "Each stage ends with a concrete result you can see and approve before we move on.",
    steps: [
      { title: "Discovery", description: "We clarify goals, constraints and the current state of your systems and data.", outputs: ["Short problem statement", "Success criteria"] },
      { title: "Architecture & planning", description: "We propose the solution, priorities, scope and timeline in a written quote.", outputs: ["Technical outline", "Written quote"] },
      { title: "Development & validation", description: "We work in short iterations, test with real examples and measure the result.", outputs: ["Working solution", "Tests and documentation"] },
      { title: "Support & optimization", description: "We watch how the solution performs and plan the next improvements.", outputs: ["Monthly review", "Improvement plan"] },
    ],
  },
  faq: {
    eyebrow: "Frequently asked questions",
    title: "Answers to the most common questions",
    items: [
      {
        question: "Which platforms do you work with?",
        answer:
          "Mainly Shopify and WooCommerce, as well as custom-built solutions. For other platforms we run a technical assessment before committing.",
      },
      {
        question: "Do we need AI to work with you?",
        answer:
          "No. Many projects start with maintenance, SEO or integrations. We only propose AI when there is a clear benefit and an acceptable level of risk.",
      },
      {
        question: "How is the price determined?",
        answer:
          "Once the scope is clear. Well-defined projects get a fixed price; maintenance and SEO run as a monthly subscription. Everything is set out in a written quote.",
      },
      {
        question: "Is it safe to use AI with customer data?",
        answer:
          "It can be, if it is designed properly: minimal data sent to the model, personal data removed, a data processing agreement with the provider and human approval for sensitive actions.",
      },
      {
        question: "How long does a project take?",
        answer: "It depends on the scope. The quote lists concrete milestones and timelines agreed with you.",
      },
      {
        question: "Can you take over maintenance of an existing store?",
        answer:
          "Yes. We start with a technical review to assess the state of the store and the risks, and then propose a suitable plan.",
      },
      {
        question: "Do you maintain AI agents built by another team?",
        answer:
          "Yes. With AI Managed Services we take over monitoring, maintenance, quality evaluation and security of AI systems already in production — after a technical assessment of the architecture and access.",
      },
      {
        question: "Who owns the code and the data?",
        answer:
          "Ownership is set out in the contract. Our approach is that your data stays yours and solutions are documented so that you can maintain them without us.",
      },
      {
        question: "Do you work with clients outside Bulgaria?",
        answer: "Yes, our services are aimed at businesses in Bulgaria and across the European Union.",
      },
    ],
  },
  finalCta: {
    title: "Have a technical challenge or an automation idea?",
    lead: "Let's build the right solution. Describe the task briefly — we will review your inquiry and suggest a suitable approach.",
    primary: "Discuss your project",
    secondary: "Technical audit",
  },
  capabilities: {
    eyebrow: "Technical capabilities",
    title: "Expertise you can verify",
    lead: "No invented logos or results. These are the technologies and practices we work with every day.",
    groups: [
      { icon: "cart", title: "Shopify & WooCommerce", items: ["Themes and apps", "Performance", "Updates and migrations"] },
      { icon: "layers", title: "Next.js & FastAPI", items: ["Web applications", "Admin dashboards", "REST APIs"] },
      { icon: "plug", title: "API integrations", items: ["Webhooks", "CRM, ERP, couriers", "Data synchronisation"] },
      { icon: "database", title: "Cloud infrastructure", items: ["Docker", "PostgreSQL", "Backups"] },
      { icon: "sparkles", title: "AI & LLM applications", items: ["Assistants and RAG", "Structured output", "Quality evaluation"] },
      { icon: "shield", title: "Observability & security", items: ["Logging and alerts", "Least privilege", "GDPR practices"] },
    ],
  },
};
