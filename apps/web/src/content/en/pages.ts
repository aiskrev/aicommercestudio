import type {
  about as bgAbout,
  aiSolutions as bgAiSolutions,
  industries as bgIndustries,
  processPage as bgProcessPage,
  servicesPage as bgServicesPage,
  toolsPage as bgToolsPage,
} from "@/content/bg/pages";

export const toolsPage: typeof bgToolsPage = {
  metaTitle: "Interactive AI tools to assess your processes",
  metaDescription:
    "Interactive AI tools with no sign-up: the AI Automation Advisor that assesses a manual process, plus tools in preparation for readiness, AI teams and impact.",
  eyebrow: "Tools",
  title: "Interactive tools for a first assessment",
  lead:
    "Assess for yourself where AI and automation can help — no sign-up and no personal data. We only show tools that already work and clearly mark what is coming.",
};

export const servicesPage: typeof bgServicesPage = {
  metaTitle: "Services for online stores: maintenance, SEO and AI",
  metaDescription:
    "A.I. Commerce Studio services: AI strategy, AI agent development, workflow automation, custom AI engineering, integrations, managed AI, maintenance, SEO, analytics.",
  eyebrow: "Services",
  title: "Engineering services for online commerce and AI",
  lead:
    "AI services from strategy and agent development to operation after launch — and the engineering foundation of an online business: maintenance, SEO and analytics.",
  offeringTitle: "Not sure where to start?",
  offeringLead:
    "The technical audit is a structured, paid assessment of your store, data and processes. It ends with a prioritized plan that you can carry out with us or on your own.",
  groups: {
    ai: {
      title: "AI services",
      lead: "Agents, automation, custom engineering, integrations and the operation of AI systems in production.",
    },
    core: {
      title: "E-commerce foundation",
      lead: "The technical base AI runs on: a stable store, visibility in search and correct data.",
    },
  },
};

export const industries: typeof bgIndustries = {
  metaTitle: "A technical partner for online merchants — who we work with",
  metaDescription:
    "We help online stores, Shopify and WooCommerce merchants, local retailers moving online and small businesses looking for automation, AI solutions and AI operations.",
  eyebrow: "Who we work with",
  title: "A partner for businesses that want technology to work for them",
  lead:
    "We work with small and mid-sized businesses for which the online channel matters but which have no in-house technical team — or need extra expertise in SEO, data and AI.",
  segments: [
    {
      icon: "store",
      title: "Small and mid-sized online stores",
      description: "Growing stores that need stable technology, better visibility and less manual work.",
      needs: ["Reliable maintenance", "Category and product SEO", "Clear sales reporting"],
      services: ["maintenance", "seo", "analytics"],
    },
    {
      icon: "cart",
      title: "Shopify merchants",
      description: "Merchants who rely on apps and themes and want control over performance and integrations.",
      needs: ["Theme and app optimization", "Warehouse and ERP integrations", "Order automation"],
      services: ["maintenance", "integrations", "automation"],
    },
    {
      icon: "layers",
      title: "WooCommerce merchants",
      description: "WordPress-based stores where updates, plugins and security need constant attention.",
      needs: ["Safe updates", "Security hardening", "Speed and Core Web Vitals"],
      services: ["maintenance", "integrations", "seo"],
    },
    {
      icon: "building",
      title: "Local retailers going online",
      description: "Brick-and-mortar shops and distributors building or expanding their online sales.",
      needs: ["Technical audit and plan", "Connecting in-store inventory", "SEO and measurement basics"],
      services: ["audit", "integrations", "seo"],
    },
    {
      icon: "workflow",
      title: "Companies looking for automation",
      description: "Teams that lose hours on repetitive tasks between email, spreadsheets, CRM and accounting.",
      needs: ["Process mapping", "Automation with human approval", "System integrations"],
      services: ["automation", "integrations", "ai_tools"],
    },
    {
      icon: "sparkles",
      title: "Small businesses seeking custom AI software",
      description: "Businesses with a concrete idea for an AI assistant, document analysis or an internal knowledge base.",
      needs: ["Prototype and quality evaluation", "Data protection", "Integration with existing systems"],
      services: ["ai_tools", "automation", "audit"],
    },
    {
      icon: "shield",
      title: "Businesses that need maintenance and SEO",
      description: "Companies with an existing website or store that want predictable technical care and organic growth.",
      needs: ["Monthly maintenance", "Monitoring and security", "SEO retainer"],
      services: ["maintenance", "seo", "analytics"],
    },
    {
      icon: "activity",
      title: "Companies already running an AI agent",
      description: "Businesses that use an AI assistant or automation but lack the expertise to monitor and maintain it.",
      needs: ["Monitoring and early problem detection", "Quality evaluation", "Cost control"],
      services: ["ai_managed", "ai_tools", "integrations"],
    },
  ],
  sectorsTitle: "Typical sectors",
  sectorsLead: "The approach applies across many areas of online retail, for example:",
  sectors: [
    "Fashion and accessories",
    "Home and garden",
    "Beauty and health",
    "Electronics and appliances",
    "Food and beverages",
    "Sports and leisure",
    "B2B distribution",
    "Spare parts and consumables",
  ],
};

export const about: typeof bgAbout = {
  metaTitle: "About us — an e-commerce engineering and AI studio",
  metaDescription:
    "A.I. Commerce Studio is an e-commerce engineering and AI studio for small and mid-sized businesses in Bulgaria and the EU. These are the principles we work by.",
  eyebrow: "About",
  title: "An engineering approach to online commerce",
  lead:
    "A.I. Commerce Studio is an e-commerce engineering and growth studio that combines online store maintenance, SEO, data, integrations and artificial intelligence.",
  mission: {
    title: "Our mission",
    paragraphs: [
      "Small and mid-sized businesses can rarely afford separate specialists for the platform, SEO, data, integrations and AI. As a result, decisions are made piecemeal and responsibility gets spread across several vendors.",
      "We want to be a technical partner that sees the whole picture: how the store works, where customers come from, how data flows, and where automation and AI can save time without creating new risks.",
    ],
  },
  principles: [
    {
      icon: "target",
      title: "The business problem comes first",
      description: "We start from the goal and how it will be measured, and choose the technology after that.",
    },
    {
      icon: "eye",
      title: "Honest expectations",
      description: "We do not promise Google rankings, guaranteed growth or \"fully autonomous\" AI.",
    },
    {
      icon: "shield",
      title: "Security and privacy",
      description: "Minimal data collection, controlled access and protection by default.",
    },
    {
      icon: "users",
      title: "Human oversight",
      description: "Actions with a real effect on customers, prices or orders require approval by a person.",
    },
    {
      icon: "fileText",
      title: "Documentation",
      description: "Every solution is handed over with documentation that allows another team to maintain it.",
    },
    {
      icon: "refresh",
      title: "Incremental improvement",
      description: "Short iterations with visible results instead of long projects without feedback.",
    },
  ],
  companyTitle: "Company information",
  companyNote:
    "This website is in a preparatory stage. \"A.I. Commerce Studio\" is a working name; details of the legal entity, registration and team will be published once they are finalized.",
};

export const processPage: typeof bgProcessPage = {
  metaTitle: "Our process: from consultation to results",
  metaDescription:
    "How we work: from the first conversation and technical analysis to the plan, iterative delivery, measuring results and ongoing support.",
  eyebrow: "Process",
  title: "How working with us runs",
  lead:
    "The process is predictable and transparent: at every stage you know what is happening, what you receive and what we need from you.",
  steps: [
    {
      title: "Initial conversation",
      summary: "We understand the business, the goal and the constraints.",
      details: [
        "We discuss the problem or opportunity you want to address.",
        "We clarify the platforms, systems and people involved.",
        "We decide whether and how we can help.",
      ],
      outcome: "A clear understanding of the task and the next step.",
    },
    {
      title: "Technical analysis",
      summary: "We review the current state.",
      details: [
        "We analyze the store, integrations, data or process — depending on the task.",
        "For larger scopes we propose a paid technical audit.",
        "We identify risks and dependencies.",
      ],
      outcome: "Findings and priorities based on facts.",
    },
    {
      title: "Plan and quote",
      summary: "We propose the scope, milestones and engagement model.",
      details: [
        "We describe what will be done and what is out of scope.",
        "We define success criteria and how they will be measured.",
        "We provide a written quote with timelines and pricing.",
      ],
      outcome: "A written quote you can compare and discuss.",
    },
    {
      title: "Iterative delivery",
      summary: "We work in short cycles with visible progress.",
      details: [
        "Every iteration ends with a working result to review.",
        "Changes are tested before they reach production.",
        "We communicate status and risks regularly.",
      ],
      outcome: "A working solution built with your feedback.",
    },
    {
      title: "Measurement and handover",
      summary: "We check the result against the agreed criteria.",
      details: [
        "We compare the metrics before and after the change.",
        "We hand over documentation, access and instructions.",
        "We train your team if needed.",
      ],
      outcome: "A documented solution and an objective assessment of the result.",
    },
    {
      title: "Support and evolution",
      summary: "We make sure the solution keeps working.",
      details: [
        "Monitoring, updates and fixes under an agreed model.",
        "Periodic review of results and new priorities.",
        "Planning of the next improvements.",
      ],
      outcome: "Stable operation and a clear roadmap.",
    },
  ],
  needsTitle: "What we need from you",
  needs: [
    "A clear description of the goal or problem",
    "A contact person who can make decisions",
    "Temporary, limited access to the systems involved",
    "Feedback within the agreed timeframes",
  ],
};

export const aiSolutions: typeof bgAiSolutions = {
  metaTitle: "AI for business: AI solutions with human oversight",
  metaDescription:
    "Artificial intelligence for business without unnecessary risk: assistants, RAG, document analysis and automation with human approval, an action log and data protection.",
  eyebrow: "AI solutions",
  title: "AI that works with your data and your rules",
  lead:
    "We design AI solutions as part of your business processes — with a clear task, verifiable quality, data protection and human oversight wherever decisions have consequences.",
  typesTitle: "What we build",
  types: [
    {
      icon: "message",
      title: "Customer assistants",
      description: "Answer frequent questions from verified sources and escalate to a person when unsure.",
    },
    {
      icon: "database",
      title: "RAG over your documents",
      description: "Search and answers over internal documents, catalogs and policies, with sources cited.",
    },
    {
      icon: "fileText",
      title: "Document analysis",
      description: "Data extraction from invoices, contracts and specifications, checked before it is saved.",
    },
    {
      icon: "inbox",
      title: "Classification and routing",
      description: "Automatic routing of inquiries, emails and requests by topic and urgency.",
    },
    {
      icon: "pen",
      title: "Content generation with editing",
      description: "Drafts of product descriptions, replies and summaries that a person reviews.",
    },
    {
      icon: "chart",
      title: "Reporting assistants",
      description: "Plain-language explanations and summaries of sales and operations data.",
    },
  ],
  principlesTitle: "Principles we apply in every AI project",
  principles: [
    {
      icon: "target",
      title: "A specific task and success criteria",
      description: "We define what the solution must do and how quality will be measured before we start.",
    },
    {
      icon: "lock",
      title: "Minimal data",
      description: "Only the necessary data is sent to the model, and personal data is removed wherever possible.",
    },
    {
      icon: "users",
      title: "Human approval",
      description: "Actions that send messages or change products, prices or orders require explicit approval.",
    },
    {
      icon: "fileText",
      title: "Logging and traceability",
      description: "Every proposed and approved action is recorded — who, when and why.",
    },
    {
      icon: "layers",
      title: "Provider independence",
      description: "The AI layer is abstracted so the model and provider (e.g. Anthropic Claude) can be replaced.",
    },
    {
      icon: "gauge",
      title: "Evaluation and monitoring",
      description: "Test scenarios before deployment, and monitoring of quality and cost afterwards.",
    },
  ],
  approvalTitle: "Approval policy for AI actions",
  approvalHeaders: { action: "Action", risk: "Risk", control: "Control" },
  approvalLead:
    "AI agents can propose actions, but they do not carry them out on their own when the action has a real effect. This is how we classify actions:",
  approvalRows: [
    { action: "Reading public content", level: "low", risk: "Low", control: "Allowed automatically" },
    { action: "Drafts and classification", level: "low", risk: "Low", control: "Allowed; the result is reviewed" },
    { action: "Sending messages to customers", level: "high", risk: "High", control: "Explicit human approval" },
    { action: "Changing products", level: "high", risk: "High", control: "Explicit human approval" },
    { action: "Changing prices or orders", level: "critical", risk: "Critical", control: "Explicit approval and audit log" },
    { action: "Access to sensitive data", level: "critical", risk: "Critical", control: "Explicit approval and audit log" },
  ],
  managed: {
    title: "After launch: AI Managed Services",
    lead: "An AI agent can stop working correctly even while the website and server are up. Monitoring, quality evaluation, security and cost control after deployment.",
    cta: "Explore AI Managed Services",
  },
  lifecycleTitle: "AI project lifecycle",
  lifecycle: [
    { title: "Discovery", description: "Choosing a process with clear value and acceptable risk." },
    { title: "Prototype", description: "A quick check with real examples from your data." },
    { title: "Evaluation", description: "A test set and criteria for quality, security and cost." },
    { title: "Deployment", description: "Integration into your systems, access, logging and approvals." },
    { title: "Monitoring", description: "Tracking quality, cost and user feedback." },
  ],
  notForTitle: "When AI is not the right answer",
  notFor: [
    "When a simple automation or rule solves the task more reliably.",
    "When there is not enough good-quality data to work with.",
    "When a mistake would have serious consequences and cannot be checked by a person.",
    "When the expected benefit does not justify the cost of maintaining it.",
  ],
};
