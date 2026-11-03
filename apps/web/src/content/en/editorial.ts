import type { EditorialCategory } from "@/content/types";

export { caseStudies, isPublishable, publishableCaseStudies } from "@/content/bg/editorial";

/** English topics. `key` matches the Bulgarian category; `slug` is the English URL segment (/en/insights/topic/<slug>). */
export const editorialCategories: EditorialCategory[] = [
  {
    key: "tehnicheska-poddrazhka",
    slug: "technical-maintenance",
    name: "Technical maintenance",
    title: "Articles on technical maintenance of online stores",
    description:
      "Practical guidance for running a stable online store: updates, speed, cart, integrations, backups and security.",
    relatedService: "maintenance",
  },
  {
    key: "seo",
    slug: "seo",
    name: "SEO",
    title: "Articles on SEO for online stores",
    description: "Technical SEO, indexing, category structure and measuring organic traffic for online stores.",
    relatedService: "seo",
  },
  {
    key: "ai",
    slug: "ai",
    name: "Artificial intelligence",
    title: "Articles on AI in e-commerce and customer service",
    description: "When AI assistants and tools make sense, how their quality is evaluated and how data is protected.",
    relatedService: "ai_tools",
  },
  {
    key: "avtomatizatsiya",
    slug: "automation",
    name: "Automation",
    title: "Articles on business process automation",
    description: "How to reduce manual work with automation and AI without losing control over important decisions.",
    relatedService: "automation",
  },
  {
    key: "platformi",
    slug: "platforms",
    name: "Platforms",
    title: "Articles on choosing and evolving an online store platform",
    description: "Comparisons and advice on Shopify, WooCommerce and custom solutions — costs, flexibility and maintenance.",
    relatedService: "integrations",
  },
  // Engineering topics (lib/insight-topics.ts). No articles yet: the pages say so and stay noindex.
  {
    key: "oblak-i-platformi",
    slug: "cloud-and-platform",
    name: "Cloud and platform",
    title: "Articles on cloud landing zones, Kubernetes and platform engineering",
    description: "Cloud account structure, network, identity, infrastructure as code and Kubernetes platforms.",
    relatedService: "integrations",
  },
  {
    key: "devops-i-sre",
    slug: "devops-and-sre",
    name: "DevOps and SRE",
    title: "Articles on CI/CD, GitOps, observability and reliability",
    description: "Software delivery, change control, observability with OpenTelemetry, SLOs and incident management.",
    relatedService: "integrations",
  },
  {
    key: "danni-i-integratsii",
    slug: "data-and-integration",
    name: "Data and integration",
    title: "Articles on integration, data pipelines and preparing data for AI",
    description: "APIs, events, synchronisation between systems, data pipelines and preparing documents for RAG.",
    relatedService: "integrations",
  },
  {
    key: "upravlenie-na-ai",
    slug: "ai-governance",
    name: "AI governance",
    title: "Articles on responsible AI, risk, human approval and security",
    description: "Rules, roles and controls for AI systems: evaluation, documentation, monitoring and data protection.",
    relatedService: "audit",
  },
];
