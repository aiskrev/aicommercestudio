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
  },
  technologies: {
    label: "Platforms and technologies we work with",
    items: [
      "Shopify",
      "WooCommerce",
      "Google Analytics 4",
      "Search Console",
      "REST APIs and webhooks",
      "PostgreSQL",
      "Docker",
      "Anthropic Claude",
    ],
  },
  servicesIntro: {
    eyebrow: "Services",
    title: "Seven disciplines, one technical partner",
    lead: "From day-to-day maintenance to custom AI tools and AI operations — use each service on its own or as part of a complete plan.",
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
    ],
  },
  industriesIntro: {
    eyebrow: "Who we work with",
    title: "For businesses that sell online and want technology to work for them",
    lead: "Small and mid-sized merchants without an in-house technical team — or with a need for extra expertise in SEO, data and AI.",
    cta: "See all profiles",
  },
  aiControl: {
    eyebrow: "AI with human oversight",
    title: "AI proposes. People decide.",
    lead: "We design AI solutions so that routine work runs automatically, while actions with a real effect on customers, prices or orders go through approval.",
    steps: [
      {
        icon: "sparkles",
        title: "AI analyzes",
        description: "Classifies inquiries, prepares drafts and spots anomalies in the data.",
      },
      {
        icon: "shield",
        title: "Risk policy",
        description: "Every action is assessed: reading and drafting are allowed, changes are not.",
      },
      {
        icon: "users",
        title: "Human approval",
        description: "Messages and changes to products, prices or orders require explicit approval.",
      },
      {
        icon: "fileText",
        title: "Decision log",
        description: "Every proposal and decision is recorded — who, when and why.",
      },
    ],
  },
  process: {
    eyebrow: "How we work",
    title: "A clear process from the first call to a measurable result",
    steps: [
      { title: "Conversation", description: "We clarify goals, constraints and the current state." },
      { title: "Analysis", description: "We review the systems, data and processes involved in the task." },
      { title: "Plan and quote", description: "We propose priorities, scope, timelines and an engagement model." },
      { title: "Delivery", description: "We work in short iterations with visible progress and regular feedback." },
      { title: "Measurement", description: "We compare the result with the agreed success criteria." },
      { title: "Evolution", description: "We maintain the solution and plan the next improvements." },
    ],
  },
  useCases: {
    eyebrow: "Use cases",
    title: "Where AI and automation create real value in e-commerce",
    lead: "Typical scenarios we design and implement. Each one starts with a clear goal and success criteria.",
    items: [
      {
        icon: "message",
        title: "Customer question assistant",
        description:
          "Answers questions about stock, delivery and returns from your own data and hands complex cases over to a person.",
      },
      {
        icon: "fileText",
        title: "Product description drafts",
        description: "Generates descriptions in your brand voice that an editor reviews before publishing.",
      },
      {
        icon: "inbox",
        title: "Inbound inquiry classification",
        description: "Routes emails and form submissions by topic and urgency to the right person.",
      },
      {
        icon: "refresh",
        title: "Inventory synchronization",
        description: "Keeps stock levels aligned between the store, warehouse and ERP without manual work.",
      },
      {
        icon: "chart",
        title: "Automated weekly report",
        description: "Summarizes sales, top products and anomalies and sends it to the team.",
      },
      {
        icon: "search",
        title: "Early detection of SEO issues",
        description: "Monitors indexing and technical errors before they affect traffic.",
      },
    ],
  },
  advantages: {
    eyebrow: "Why an integrated approach",
    title: "Engineering and AI expertise in one team",
    items: [
      {
        icon: "layers",
        title: "One partner for the store, data and AI",
        description: "No hand-offs of responsibility between a web agency, an SEO consultant and an AI vendor.",
      },
      {
        icon: "workflow",
        title: "Solutions built into real processes",
        description: "AI is not a separate gadget but part of the systems and workflows you already use.",
      },
      {
        icon: "shield",
        title: "Security and control by default",
        description: "Human approval for sensitive actions, an operations log and minimal data collection.",
      },
      {
        icon: "target",
        title: "Measurable goals",
        description: "Before we start, we define what we will measure and how we will know the solution works.",
      },
      {
        icon: "eye",
        title: "Transparency",
        description: "Documentation, access lists and clear reporting for every piece of work.",
      },
    ],
  },
  engagement: {
    eyebrow: "Engagement models",
    title: "Choose the format that fits your needs",
    lead: "Pricing is set once the scope is clear and is provided in a written quote.",
    items: [
      {
        icon: "wrench",
        title: "Monthly maintenance",
        description: "A subscription with an agreed amount of work, monitoring and response times.",
      },
      {
        icon: "trending",
        title: "SEO retainer",
        description: "A monthly program of technical tasks, content and reporting.",
      },
      {
        icon: "sparkles",
        title: "Fixed-price AI project",
        description: "Development of an AI tool with a clear specification and acceptance criteria.",
      },
      {
        icon: "workflow",
        title: "Automation project",
        description: "Analysis, implementation and testing of a specific automated process.",
      },
      {
        icon: "clipboard",
        title: "Paid technical audit",
        description: "A structured assessment with a prioritized action plan.",
      },
      {
        icon: "refresh",
        title: "AI Managed Services",
        description: "Monitoring, maintenance, quality evaluation and cost control for AI agents after launch.",
      },
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
    title: "Let's discuss the next step for your online business",
    lead: "Briefly describe the task or problem. We will review your inquiry and suggest a suitable approach.",
    primary: "Book a consultation",
    secondary: "Technical audit",
  },
};
