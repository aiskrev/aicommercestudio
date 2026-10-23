import type { AiManagedContent } from "@/content/bg/ai-managed";

/**
 * AI Managed Services landing page (English). Same commercial rules as the Bulgarian page:
 * no public prices, no SLA, response-time or uptime promises, no claims of live monitoring.
 */
export const aiManaged: AiManagedContent = {
  hero: {
    eyebrow: "AI Managed Services",
    title: "Keep your AI agents running at their best.",
    subtitle: "Monitoring, maintenance, security and continuous optimization for the AI systems your business relies on.",
    primaryCta: "Request an AI Assessment",
    secondaryCta: "Explore Our Services",
    positioning:
      "Building an AI agent is only the beginning. We help keep your AI systems reliable, secure, observable and effective.",
  },
  value: {
    title: "Ongoing care for AI systems after they go live",
    lead: "AI Managed Services is a recurring service for the technical operation and improvement of business AI systems — whether we built them or another team did.",
    items: [
      {
        icon: "activity",
        title: "Business continuity",
        description: "Catch errors, slowdowns and failed workflows early, before customers feel them.",
      },
      {
        icon: "refresh",
        title: "Controlled change",
        description: "Every change to prompts, models or integrations goes through testing, approval and a rollback plan.",
      },
      {
        icon: "gauge",
        title: "Measurable quality",
        description: "Test sets and regression checks show whether answers are getting better or worse.",
      },
      {
        icon: "shield",
        title: "Security and cost control",
        description: "Permissions, keys, audit logs and budgets under watch — not a surprise at the end of the month.",
      },
    ],
    differentiationTitle: "How it differs from other services",
    differentiation: [
      {
        other: "One-time AI development",
        difference: "Development ends at launch. We take over from there: monitoring, quality, security and change.",
      },
      {
        other: "Ordinary website maintenance",
        difference: "A website can run perfectly while the agent gives wrong answers. We watch AI behavior, not just the server.",
      },
      {
        other: "SEO retainers",
        difference: "The focus is not search visibility but the reliability, quality and cost of your AI systems.",
      },
      {
        other: "Chatbot installation",
        difference: "We do not add yet another tool — we look after the ones you already run, with clear procedures and reporting.",
      },
    ],
  },
  audience: {
    title: "Who this service is for",
    lead: "Businesses that already rely on AI in their daily operations.",
    segments: [
      { icon: "store", title: "E-commerce merchants running AI support agents", description: "Assistants that answer questions about orders, delivery and products." },
      { icon: "workflow", title: "Small businesses automating operations with LLMs", description: "Repetitive operations handled by language models." },
      { icon: "users", title: "Agencies operating customer-facing AI tools", description: "Teams that deliver AI solutions to clients and need to keep them running." },
      { icon: "fileText", title: "Companies using AI document processing", description: "Invoices, contracts and requests recognized and processed by AI." },
      { icon: "database", title: "Internal knowledge assistants and RAG systems", description: "Knowledge bases where source quality determines answer quality." },
      { icon: "plug", title: "Workflows connected to CRM, ERP or helpdesk", description: "Automations wired into business systems, where mistakes have consequences." },
      { icon: "activity", title: "Companies with an agent but no in-house expertise", description: "The solution runs, but nobody is there to monitor, maintain and improve it." },
    ],
  },
  problems: {
    title: "Problems we solve",
    keyMessage: "An AI agent can stop working correctly even while your website and servers are still up.",
    lead: "These problems rarely look like an outage. They usually show up as slower, more expensive or less accurate answers. The most common causes:",
    causes: [
      { title: "Third-party API changes", description: "A provider changes a format, limit or version, and the workflow stops." },
      { title: "Authentication and tokens", description: "An expired key or revoked access breaks an integration without a visible error." },
      { title: "Model changes", description: "A new model version responds differently to the same instructions." },
      { title: "Prompt and workflow regressions", description: "A small change to a prompt or configuration degrades the results." },
      { title: "Tool invocation errors", description: "The agent passes wrong parameters or calls an unsuitable tool." },
      { title: "Knowledge base changes", description: "Outdated or moved documents lead to incomplete or wrong answers." },
      { title: "Unexpected cost increases", description: "More requests, longer prompts or an unsuitable model drive up the bill." },
      { title: "Slow responses", description: "Latency in the model, the tools or the retrieval step." },
      { title: "Retrieval quality degradation", description: "The RAG system finds less relevant sources than it used to." },
      { title: "Incorrect generated output", description: "Confident but wrong answers that reach customers or staff." },
      { title: "Security issues", description: "Prompt-injection attempts, overly broad permissions or data leakage." },
      { title: "Infrastructure failures", description: "Problems in hosting, queues or the application's dependencies." },
      { title: "Configuration drift", description: "Environments diverge over time and changes are no longer traceable." },
    ],
    disclaimer:
      "Not every AI failure can be prevented. The goal is to detect problems earlier, limit their impact and resolve them through a clear procedure.",
  },
  diagram: {
    title: "What managing an AI system looks like",
    caption: "A conceptual diagram of the service. It does not represent a live monitoring system.",
    steps: [
      { title: "AI application", description: "Agent, assistant or automation" },
      { title: "Monitoring & evaluation", description: "Metrics, tests and quality" },
      { title: "Incident management", description: "Investigate, fix, roll back" },
      { title: "Optimization", description: "Quality, speed and cost" },
      { title: "Reliable operations", description: "Predictable business processes" },
    ],
  },
  monitoring: {
    title: "What we monitor",
    lead: "What can be monitored depends on the data and integrations available in your system. We confirm the scope during the assessment.",
    availableTitle: "Usually possible from the start",
    available: [
      "Availability of the service and its public endpoints",
      "Request volume and error rates from existing logs",
      "Failed workflow executions",
      "Health of the external APIs the agent depends on",
      "Token consumption and estimated inference costs from provider reports",
      "Rate-limit errors",
    ],
    integrationsTitle: "Requires an additional integration on your side",
    integrations: [
      "Model and tool latency (tracing)",
      "Repeated failures by request type or tool",
      "Unexpected usage patterns",
      "Answer quality on real conversations, where agreed",
      "Budget alerts with providers",
    ],
    note: "We do not show invented dashboards, and we do not claim monitoring is running before it has actually been set up and agreed.",
  },
  maintenance: {
    title: "AI agent maintenance",
    lead: "Ongoing technical care for the components the system depends on:",
    items: [
      "Prompt configuration maintenance",
      "Model integration maintenance and version upgrades",
      "API compatibility checks",
      "Workflow dependency updates",
      "Knowledge source connection maintenance",
      "Configuration management and version control",
      "Deployment support",
      "Regression testing before every change",
      "Rollback planning",
    ],
    boundary:
      "Ordinary maintenance does not include unlimited new feature development. New capabilities are assessed and agreed separately as a change request or a project.",
  },
  quality: {
    title: "AI quality and reliability",
    lead: "Quality is measured, not assumed:",
    items: [
      { title: "Test datasets", description: "Real examples that reflect the system's tasks." },
      { title: "Golden test cases", description: "Selected cases with an approved expected result." },
      { title: "Regression evaluation", description: "Checks before and after every change to models, prompts or data." },
      { title: "Correctness and task completion", description: "Whether the answer is right and the task gets finished." },
      { title: "Human review", description: "A sample of results reviewed by a person." },
      { title: "Groundedness checks for RAG", description: "Whether the answer is supported by the retrieved sources." },
      { title: "Tool call validation", description: "The right tools with the right parameters." },
      { title: "Failure categorization", description: "Why the system failed — for targeted improvements." },
      { title: "Quality trends across releases", description: "How quality changes with each new version." },
    ],
    disclaimer:
      "The quality of language model output cannot be guaranteed. Evaluation reveals trends and regressions; it does not rule out mistakes.",
    examplesTitle: "Example evaluation criteria",
    examplesNote: "Illustrative examples. Real criteria are defined with you for the specific system.",
    examples: [
      {
        system: "Customer support AI agent",
        criteria: [
          "The answer matches the current delivery and returns policy.",
          "The agent hands over to a person for payment questions or complaints.",
          "It does not promise discounts, delivery dates or refunds.",
        ],
      },
      {
        system: "Product description generator",
        criteria: [
          "Technical specifications match the data provided.",
          "The tone follows the brand guidelines.",
          "There are no claims unsupported by the product data.",
        ],
      },
      {
        system: "Document processing assistant",
        criteria: [
          "Key fields (number, date, amount, counterparty) are extracted correctly.",
          "Uncertain fields are flagged for review.",
          "Documents in an unrecognized format are never saved automatically.",
        ],
      },
      {
        system: "Internal business knowledge assistant",
        criteria: [
          "The answer cites the source it is based on.",
          "When information is missing, the assistant says so instead of guessing.",
          "Staff only see documents they are authorized to access.",
        ],
      },
    ],
  },
  cost: {
    title: "AI cost optimization",
    lead: "We review where model spend goes and how to reduce it without hurting quality:",
    items: [
      "Model selection analysis for each task",
      "Token consumption review",
      "Prompt length optimization",
      "Caching feasibility",
      "Cheaper models where quality allows",
      "Usage and budget alerts",
      "Latency versus cost trade-off evaluation",
      "Monthly cost reporting",
    ],
    note:
      "We do not promise a specific percentage of savings. The effect depends on the system and is measured against a baseline. Model API costs, third-party subscriptions and infrastructure are billed separately unless explicitly included in an approved quote.",
  },
  security: {
    title: "Security and governance",
    lead: "AI security is a process, not a one-time setting:",
    items: [
      "API key and secret rotation procedures",
      "Least-privilege access",
      "Prompt-injection risk assessment",
      "Sensitive data handling",
      "Tool permission restrictions",
      "Audit logging",
      "Human approval gates",
      "Data retention policies",
      "Third-party provider dependency review",
      "Incident handling procedures",
      "Periodic access reviews",
    ],
    principle:
      "Model output never bypasses deterministic authorization or business rules. AI may propose; the system checks whether an action is permitted, and actions with consequences require human approval.",
  },
  improvement: {
    title: "Continuous improvement",
    items: [
      "Periodic operational reviews",
      "Evaluation-driven prompt improvements",
      "Workflow optimization recommendations",
      "Knowledge base quality reviews",
      "A monthly improvement backlog",
      "Performance reporting",
      "Change requests",
      "Controlled deployment and rollback",
    ],
  },
  incidents: {
    title: "Incident response and recovery",
    lead: "When something goes wrong, we follow a procedure agreed in advance:",
    steps: [
      { title: "Classification", description: "We determine the severity and the affected processes." },
      { title: "Detection and triage", description: "We confirm the problem and collect the data." },
      { title: "Customer notification", description: "We inform the contact you have designated." },
      { title: "Technical investigation", description: "We look for the cause — model, data, integration or infrastructure." },
      { title: "Remediation", description: "We apply the fix in a controlled way." },
      { title: "Rollback", description: "When available and safer than a fix." },
      { title: "Post-incident review", description: "What happened, why, and what we learned." },
      { title: "Preventive follow-up", description: "Tests or monitoring that will catch the problem next time." },
    ],
    note: "Response times and support hours are agreed in writing in the contract. We do not publish binding response times or availability guarantees on this website.",
  },
  onboarding: {
    title: "How we get started",
    lead: "Onboarding is a separate, clearly bounded phase before the monthly service:",
    steps: [
      { title: "Inquiry", description: "You describe the system through the form — no passwords, keys or confidential data." },
      { title: "Call and clarification", description: "We clarify the goals, architecture and risks." },
      { title: "Technical assessment", description: "With agreed, minimal access we review the system and its instrumentation." },
      { title: "Proposal", description: "We recommend a plan and scope in a written quote." },
      { title: "Onboarding", description: "Baseline, monitoring, test set and procedures — after a signed contract." },
    ],
  },
  packages: {
    title: "Monthly support plans",
    lead: "The plans describe a typical scope. Exact terms, volume and pricing are agreed for each system.",
    priceLabel: "Custom quote",
    cta: "Request an assessment",
    contactCta: "Contact us",
    items: [
      {
        key: "monitor",
        name: "AI Monitor",
        audience: "For small businesses operating one relatively simple AI assistant.",
        summary: "Visibility into health, usage and cost.",
        includes: [
          "Initial technical assessment",
          "Basic health monitoring where supported",
          "Periodic health review",
          "Usage and cost visibility",
          "Basic issue reporting",
          "Monthly service summary",
        ],
      },
      {
        key: "care",
        name: "AI Care",
        audience: "For businesses using AI in daily operations.",
        summary: "Monitoring plus maintenance, quality evaluation and incident triage.",
        includes: [
          "Everything in AI Monitor",
          "More detailed monitoring",
          "Scheduled evaluation and regression review",
          "Prompt and configuration maintenance",
          "Incident triage",
          "Change recommendations",
          "Monthly optimization review",
        ],
      },
      {
        key: "optimize",
        name: "AI Optimize",
        audience: "For businesses running business-critical AI workflows.",
        summary: "Comprehensive observability, custom evaluations and change management.",
        includes: [
          "Everything in AI Care",
          "More comprehensive observability",
          "Custom evaluations",
          "Extended workflow monitoring",
          "Cost optimization reviews",
          "Change management",
          "Integration health checks",
          "Dedicated improvement planning",
          "Custom support arrangements subject to contract",
        ],
      },
    ],
    comparisonTitle: "Plan comparison",
    comparisonFeature: "Capability",
    comparison: [
      { feature: "Initial technical assessment", values: ["yes", "yes", "yes"] },
      { feature: "Health monitoring", values: ["Basic", "Detailed", "Comprehensive"] },
      { feature: "Usage and cost visibility", values: ["yes", "yes", "yes"] },
      { feature: "Monthly summary", values: ["yes", "yes", "yes"] },
      { feature: "Quality regression evaluation", values: ["no", "Scheduled", "Custom"] },
      { feature: "Prompt and configuration maintenance", values: ["no", "yes", "yes"] },
      { feature: "Incident handling", values: ["Reporting", "Triage", "Agreed procedure"] },
      { feature: "Cost optimization reviews", values: ["no", "Monthly review", "In-depth"] },
      { feature: "Change management", values: ["no", "Recommendations", "yes"] },
      { feature: "Integration health checks", values: ["no", "no", "yes"] },
    ],
    included: "Included",
    notIncluded: "Not included",
    thirdPartyNote:
      "Model API costs, third-party subscriptions and infrastructure are billed separately unless explicitly included in an approved quote.",
    noSlaNote:
      "No plan includes unlimited usage, unlimited incidents, 24/7 support or a guaranteed service level (SLA) unless explicitly agreed in writing.",
  },
  scope: {
    title: "Service scope",
    includedTitle: "What is included",
    included: [
      "Agreed monitoring based on the integrations available",
      "Maintenance of configuration, prompts and integrations",
      "Quality evaluation against an agreed test set",
      "Incident response under an agreed procedure",
      "A monthly summary and recommendations",
    ],
    excludedTitle: "What is excluded",
    excluded: [
      "Unlimited new feature development",
      "Third-party model, subscription and infrastructure costs",
      "Guaranteed correctness of every model answer",
      "Guaranteed response times or availability without a signed contract",
      "Access to your systems without a contract and explicit permission",
    ],
  },
  faq: [
    {
      question: "Does the AI system have to be built by you?",
      answer: "No. We also take over systems built by other teams, after a technical assessment of the architecture, integrations and access.",
    },
    {
      question: "What access do you need?",
      answer:
        "The minimum required, agreed after the assessment — for example read access to logs and usage reports. We never ask for passwords or keys through the inquiry form.",
    },
    {
      question: "Can you monitor the system without changing it?",
      answer:
        "Partly. Availability, errors and costs can often be tracked from existing logs and reports. More detailed monitoring requires an additional integration that we agree on together.",
    },
    {
      question: "Do you guarantee a response time?",
      answer: "Response times and support hours are agreed in writing for each system. This website contains no binding guarantees.",
    },
    {
      question: "Will you reduce our AI costs?",
      answer:
        "There are often opportunities — a more suitable model, shorter prompts, caching. We do not promise a specific percentage; we measure the effect against a baseline.",
    },
    {
      question: "How do you handle personal data in the AI system?",
      answer:
        "As a processor under a separate data processing agreement: minimal access, technical metrics where that is sufficient, and access to content only where agreed.",
    },
    {
      question: "How do we start?",
      answer: "With a short inquiry and a call. We then propose a technical assessment and a suitable plan in a written quote.",
    },
  ],
  cta: {
    title: "Let's review your AI system",
    lead: "Briefly describe the system and its problems. We will propose a technical assessment and a suitable scope.",
    primary: "Request an AI Assessment",
    secondary: "Contact us",
  },
  form: {
    title: "AI assessment request",
    lead: "Answer a few questions about the AI system. Do not enter passwords, keys or confidential data.",
  },
  sectionNav: [
    { id: "ams-problems", label: "Problems" },
    { id: "ams-monitoring", label: "Monitoring" },
    { id: "ams-quality", label: "Quality" },
    { id: "ams-security", label: "Security" },
    { id: "ams-packages", label: "Plans" },
    { id: "ams-inquiry", label: "Inquiry" },
  ],
};
