import type { DomainKey } from "@/lib/domains";
import { SCENARIOS, type ScenarioKey } from "@/lib/reference";
import { workshopsForDomains, type WorkshopKey } from "@/lib/workshops";

/**
 * Insights taxonomy → service domains (docs/CONTENT_STRATEGY_BG_EN.md §5.6). The key is the stable
 * topic key (the Bulgarian slug) of content/{bg,en}/editorial.ts. Topic pages use it to point to the
 * matching workshops and reference scenarios; workshop pages use it to list related articles.
 *
 * The engineering topics (cloud, DevOps/SRE, data, AI governance) have no articles yet. That is
 * deliberate: nothing is published to fill them. Their pages say so, stay out of the sitemap and
 * are `noindex` until at least two real articles exist (MIN_ARTICLES_FOR_INDEXED_CATEGORY).
 */
export const TOPIC_DOMAINS: Record<string, DomainKey[]> = {
  "tehnicheska-poddrazhka": ["commerce_engineering"],
  seo: ["commerce_engineering"],
  ai: ["ai_applications", "ai_strategy"],
  avtomatizatsiya: ["ai_agents_automation"],
  platformi: ["commerce_engineering", "data_integration"],
  "oblak-i-platformi": ["cloud_platform"],
  "devops-i-sre": ["devops_sre", "managed_operations"],
  "danni-i-integratsii": ["data_integration"],
  "upravlenie-na-ai": ["ai_governance"],
};

export const topicDomains = (topicKey: string): DomainKey[] => TOPIC_DOMAINS[topicKey] ?? [];

export const topicWorkshops = (topicKey: string): WorkshopKey[] => workshopsForDomains(topicDomains(topicKey));

export function topicScenarios(topicKey: string): ScenarioKey[] {
  const domains = topicDomains(topicKey);
  return SCENARIOS.filter((s) => s.domains.some((d) => domains.includes(d))).map((s) => s.key);
}

/** Topics that share a domain with any of the given domains (workshop → related insights). */
export function topicsForDomains(domains: readonly DomainKey[]): string[] {
  return Object.entries(TOPIC_DOMAINS)
    .filter(([, list]) => list.some((d) => domains.includes(d)))
    .map(([key]) => key);
}
