import type { ServiceDepth } from "@/content/bg/services-depth";
import type { ServiceKey } from "@/content/types";

/**
 * English service depth content. `relatedArticles` holds article keys (shared across locales).
 * Written as practical technical knowledge — it makes no claims about past results.
 */
export const serviceDepth: Record<ServiceKey, ServiceDepth> = {
  maintenance: {
    headings: {
      problems: "When an online store needs technical maintenance",
      capabilities: "What online store maintenance includes",
      checks: "What we check when we take over maintenance",
      workflow: "How store maintenance gets started",
      deliverables: "What you receive every month",
    },
    checks: [
      {
        title: "Platform, theme and extension versions",
        description:
          "Outdated WooCommerce, PHP, theme and plugin versions, or unsupported Shopify apps, are the most common source of incompatibilities and vulnerabilities.",
      },
      {
        title: "Staging and the update process",
        description: "Whether there is a staging environment where changes are checked before they reach customers.",
      },
      {
        title: "Backups and recovery",
        description: "How often backups are taken, where they are stored and when a real restore was last tested.",
      },
      {
        title: "The critical order path",
        description:
          "Cart, payment, shipping calculation and confirmation emails — the steps where every error costs orders.",
      },
      {
        title: "Speed and heavy scripts",
        description: "Unoptimized images, scripts left behind by unused apps and slow hosting.",
      },
      {
        title: "Access and roles",
        description: "Who has administrator access, whether accounts are shared and whether two-factor authentication is on.",
      },
    ],
    workflow: [
      {
        title: "Technical review",
        description: "With limited access, we document the current state: versions, integrations, risks and missing backups.",
      },
      {
        title: "Stabilization",
        description: "We fix critical issues and prepare an environment in which updates are safe.",
      },
      {
        title: "Monitoring",
        description: "We set up availability and critical-page monitoring with alerts when something deviates.",
      },
      {
        title: "Monthly rhythm",
        description: "Planned updates, tasks on request and a monthly report of the work done.",
      },
    ],
    inputs: [
      "Administrator access with limited permissions to the store",
      "Access to hosting, or a Shopify collaborator account",
      "A list of integrations: payments, couriers, ERP, invoicing",
      "A contact person for urgent cases",
    ],
    relatedArticles: ["tehnicheski-problemi-pri-online-magazinite", "shopify-ili-woocommerce"],
  },
  seo: {
    headings: {
      problems: "Signs that an online store has an SEO problem",
      capabilities: "What SEO for an online store includes",
      checks: "Technical SEO checks we start with",
      workflow: "How SEO work runs month by month",
      deliverables: "What you receive from the SEO work",
    },
    checks: [
      {
        title: "Indexing of filters and parameters",
        description: "Filters, sorting and parameters that create thousands of indexable URLs with no value of their own.",
      },
      {
        title: "Canonical URLs and variants",
        description: "Products reachable through several categories, and variants that compete with each other in search.",
      },
      {
        title: "Category structure",
        description: "Whether categories match real searches and carry unique copy above or below the products.",
      },
      {
        title: "Out-of-stock and discontinued products",
        description: "Redirects and status codes for products that are no longer sold, so accumulated value is not lost.",
      },
      {
        title: "Core Web Vitals by template",
        description: "Measuring by page type — home, category, product, cart — because problems usually live in the template.",
      },
      {
        title: "Structured data",
        description: "Product, Offer and BreadcrumbList markup that matches the visible price and availability.",
      },
    ],
    workflow: [
      {
        title: "Audit and baseline",
        description: "A technical audit and a record of current Search Console and analytics metrics — for an honest comparison later.",
      },
      {
        title: "Technical fixes",
        description: "First the issues that block indexing, then speed and structure.",
      },
      {
        title: "Categories and content",
        description: "Optimizing priority categories and a content plan that follows search intent.",
      },
      {
        title: "Measurement and reporting",
        description: "A monthly report: what was done, what changed in the data and what the next priorities are.",
      },
    ],
    inputs: [
      "Access to Google Search Console",
      "Access to GA4 or another analytics tool",
      "A list of priority categories and products",
      "Information about seasonality and stock",
    ],
    relatedArticles: ["tehnicheski-seo-odit-na-online-magazin", "tehnicheski-problemi-pri-online-magazinite"],
  },
  ai_tools: {
    headings: {
      problems: "When a custom AI tool makes sense",
      capabilities: "The AI tools we build",
      checks: "What we assess before development",
      workflow: "How we build an AI tool",
      deliverables: "What you receive from an AI project",
    },
    checks: [
      {
        title: "Data quality and freshness",
        description: "AI answers only as well as the documents, catalog and policies it works from.",
      },
      {
        title: "Volume and repetition of the task",
        description: "How often the task occurs and how long it takes today — that shows whether the investment makes sense.",
      },
      {
        title: "Cost of a mistake",
        description: "What happens if an answer is wrong, and where a human check is required.",
      },
      {
        title: "Personal data and the provider",
        description: "Which data will be processed, where, and under which contractual terms with the model provider.",
      },
      {
        title: "How it will be measured",
        description: "A test set of real examples and the criteria by which the solution is accepted or rejected.",
      },
    ],
    workflow: [
      {
        title: "Use case",
        description: "We describe the task, the users, the data and the success criteria.",
      },
      {
        title: "Prototype",
        description: "A working prototype on real examples within a short iteration.",
      },
      {
        title: "Evaluation",
        description: "Checking against the test set and adjusting sources, instructions and rules.",
      },
      {
        title: "Deployment",
        description: "Integration into your systems, access control, an action log and monitoring after launch.",
      },
    ],
    inputs: [
      "Examples of the real task — questions, documents, descriptions",
      "Access to the data sources",
      "A person who assesses the quality of the results",
      "Privacy and data retention requirements",
    ],
    relatedArticles: ["ai-asistent-za-klienti", "ai-avtomatizatsiya-v-malkiya-biznes"],
  },
  automation: {
    headings: {
      problems: "Signs that a process is ready for automation",
      capabilities: "What we automate in business processes",
      checks: "What we analyze before automating",
      workflow: "How we introduce automation step by step",
      deliverables: "What you receive from an automation project",
    },
    checks: [
      {
        title: "Frequency and duration",
        description: "How often the process repeats, how long it takes and how many people are involved today.",
      },
      {
        title: "Stability of the rules",
        description: "Processes with clear rules automate reliably; those with many exceptions need human judgment.",
      },
      {
        title: "Input data",
        description: "How the data arrives — email, PDF, form, spreadsheet — and how varied the formats are.",
      },
      {
        title: "Approval points",
        description: "Which steps have consequences outside the company and must go through a person.",
      },
      {
        title: "Error handling",
        description: "What happens with missing data, an unavailable system or an unrecognized document.",
      },
    ],
    workflow: [
      {
        title: "Process map",
        description: "We describe the steps, systems and people involved today.",
      },
      {
        title: "Pilot",
        description: "We automate one clearly bounded part and run it in parallel with the manual work.",
      },
      {
        title: "Expansion",
        description: "We add the next steps once the pilot runs reliably.",
      },
      {
        title: "Monitoring",
        description: "An action log, error alerts and periodic review of the rules.",
      },
    ],
    inputs: [
      "A description of the process and sample data",
      "Access to the systems involved — CRM, ERP, email",
      "An owner who approves the sensitive steps",
      "A list of the exceptions that happen in practice",
    ],
    relatedArticles: ["ai-avtomatizatsiya-v-malkiya-biznes", "avtomatizatsiya-s-choveshko-odobrenie"],
  },
  analytics: {
    headings: {
      problems: "Signs that your data is not helping decisions",
      capabilities: "What conversion optimization includes",
      checks: "What we check in your measurement setup",
      workflow: "How the analysis runs",
      deliverables: "What you receive from the analysis",
    },
    checks: [
      {
        title: "E-commerce events in GA4",
        description: "Whether view_item, add_to_cart, begin_checkout and purchase are sent correctly and with values.",
      },
      {
        title: "Missing and duplicate orders",
        description: "Comparing orders in analytics with the real orders in the platform for the same period.",
      },
      {
        title: "Consent and measurement",
        description: "How the cookie banner affects the data and whether consent mode is configured correctly.",
      },
      {
        title: "Funnel by device",
        description: "Where customers drop off on mobile compared with desktop.",
      },
      {
        title: "Speed of key steps",
        description: "A slow cart or checkout often explains drop-off better than the design does.",
      },
    ],
    workflow: [
      {
        title: "Measurement audit",
        description: "Checking events, conversions and how they match real orders.",
      },
      {
        title: "Fixes",
        description: "Closing the gaps so that the data can be relied upon.",
      },
      {
        title: "Funnel analysis",
        description: "Finding the steps with the largest losses and their likely causes.",
      },
      {
        title: "Hypotheses and tests",
        description: "A prioritized list of changes and how the effect of each one will be measured.",
      },
    ],
    inputs: [
      "Access to GA4 and Google Tag Manager",
      "Access to the platform's reports",
      "Information about campaigns and seasonality",
      "The business questions the data needs to answer",
    ],
    relatedArticles: ["tehnicheski-problemi-pri-online-magazinite", "tehnicheski-seo-odit-na-online-magazin"],
  },
  integrations: {
    headings: {
      problems: "Signs that your system integrations need attention",
      capabilities: "What API integrations and cloud infrastructure include",
      checks: "What we check in an integration",
      workflow: "How we build an integration",
      deliverables: "What you receive from an integration project",
    },
    checks: [
      {
        title: "Source of truth",
        description: "Which system leads for products, prices, stock and customers.",
      },
      {
        title: "Direction and frequency of sync",
        description: "Which data is exchanged, in which direction and how quickly it must reach the other system.",
      },
      {
        title: "API limits",
        description: "Rate limits, pagination and error behavior of each system.",
      },
      {
        title: "Retries without duplicates",
        description: "One event must not create two orders when a request is sent again.",
      },
      {
        title: "Observability",
        description: "Logs and alerts that reveal a stalled sync before customers notice it.",
      },
      {
        title: "Keys and access",
        description: "Keys are stored outside the code, with minimal permissions and the ability to rotate them quickly.",
      },
    ],
    workflow: [
      {
        title: "Data flow map",
        description: "We describe the systems, the data and the direction of exchange.",
      },
      {
        title: "Connection check",
        description: "We test API limits with real data in a test environment.",
      },
      {
        title: "Build and test",
        description: "Error handling, retries and tests of edge cases.",
      },
      {
        title: "Launch and monitoring",
        description: "Gradual rollout, monitoring and maintenance documentation.",
      },
    ],
    inputs: [
      "API documentation or access for the systems involved",
      "Test accounts or sandbox environments",
      "Sample product and order data",
      "A technical contact at the ERP or CRM vendor",
    ],
    relatedArticles: ["shopify-ili-woocommerce", "tehnicheski-problemi-pri-online-magazinite"],
  },
  ai_managed: {
    headings: {
      problems: "When an AI agent needs professional operations support",
      capabilities: "What AI agent operations include",
      checks: "What we assess when we take over an AI system",
      workflow: "How managing an AI system gets started",
      deliverables: "What you receive each month from AI Managed Services",
    },
    checks: [
      {
        title: "Architecture and dependencies",
        description: "Models, providers, external APIs, knowledge bases and tools the agent depends on.",
      },
      {
        title: "Available instrumentation",
        description: "Which logs, metrics and traces already exist, and what can be monitored without extra integrations.",
      },
      {
        title: "Access and secrets",
        description: "Where API keys are stored, who has access and whether a rotation procedure exists.",
      },
      {
        title: "Tool permissions",
        description: "Which actions the agent can take and which of them require human approval.",
      },
      {
        title: "How quality is measured",
        description: "Whether a test set exists and how anyone notices today that answers have degraded.",
      },
      {
        title: "Costs and limits",
        description: "Token consumption, rate limits and budgets with the providers.",
      },
    ],
    workflow: [
      {
        title: "Technical assessment",
        description: "We review the architecture, access and risks, and describe what can be monitored.",
      },
      {
        title: "Baseline",
        description: "We record current behavior — errors, latency, costs and test-set results.",
      },
      {
        title: "Monitoring and procedures",
        description: "We set up the agreed monitoring, alerts and incident procedure.",
      },
      {
        title: "Monthly rhythm",
        description: "Reviews, controlled changes and a monthly summary of health, quality and costs.",
      },
    ],
    inputs: [
      "A description of the AI system and the business process it supports",
      "Least-privilege access agreed after the assessment — never through the inquiry form",
      "Examples of real tasks and expected results for the test set",
      "An owner on your side who approves changes",
    ],
    relatedArticles: ["ai-asistent-za-klienti", "avtomatizatsiya-s-choveshko-odobrenie"],
  },
  audit: {
    headings: {
      problems: "When to commission a technical audit of your store",
      capabilities: "What the technical audit covers",
      checks: "How we prioritize the findings",
      workflow: "How the audit runs",
      deliverables: "What you receive after the audit",
    },
    checks: [
      {
        title: "Impact on sales",
        description: "Cart and checkout problems are prioritized over cosmetic ones.",
      },
      {
        title: "Risk",
        description: "Security, backups and outdated components with known vulnerabilities.",
      },
      {
        title: "Effort",
        description: "An estimate of the time and complexity of each recommendation.",
      },
      {
        title: "Quick wins",
        description: "Low-effort changes with a clear benefit that can start right away.",
      },
      {
        title: "Dependencies",
        description: "Which improvements require others to be done first.",
      },
    ],
    workflow: [
      {
        title: "Scoping",
        description: "We define which systems and questions the audit covers and agree on the price.",
      },
      {
        title: "Access and review",
        description: "A technical review with temporary, limited access.",
      },
      {
        title: "Report",
        description: "Written findings, each with a priority, effort estimate and recommendation.",
      },
      {
        title: "Presentation",
        description: "A meeting to discuss the results and possible next steps.",
      },
    ],
    inputs: [
      "Temporary access to the admin panel and analytics",
      "A short description of goals and known problems",
      "Information about the integrations in use",
      "A contact person for questions during the audit",
    ],
    relatedArticles: ["tehnicheski-problemi-pri-online-magazinite", "tehnicheski-seo-odit-na-online-magazin"],
  },
};
