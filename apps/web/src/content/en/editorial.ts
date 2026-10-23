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
];
