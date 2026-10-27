import type { IconName } from "@/components/ui/Icon";
import type { ServiceKey } from "@/content/types";
import type { ToolKey } from "@/lib/tools";

/**
 * The ten service domains (docs/SERVICE_TAXONOMY.md). A domain groups existing services; it never
 * replaces them. This file holds the language-independent registry (ids, bands, statuses, links);
 * the texts live in `content/{bg,en}/domains.ts`.
 */
export type DomainKey =
  | "ai_strategy"
  | "ai_agents_automation"
  | "ai_applications"
  | "commerce_engineering"
  | "cloud_platform"
  | "devops_sre"
  | "data_integration"
  | "ai_governance"
  | "managed_operations"
  | "advisory_enablement";

export type DomainBand = "ai" | "engineering" | "operations";

/** available = live page + intake + documented delivery; custom = scoped project after an assessment; planned = not offered yet. */
export type DeliveryStatus = "available" | "custom" | "planned";

export type EngagementModel = "assessment" | "workshop" | "architecture" | "implementation" | "managed";

export interface FamilyDefinition {
  /** Stable key; the texts in content/{bg,en}/domains.ts are keyed by it. */
  key: string;
  status: DeliveryStatus;
  /** Existing service pages that implement this family. */
  services?: ServiceKey[];
  /** Other domains this family is delivered through. */
  via?: DomainKey[];
}

export interface DomainDefinition {
  key: DomainKey;
  id: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";
  band: DomainBand;
  icon: IconName;
  families: FamilyDefinition[];
  /** Engagement models that apply; `via` = delivered through another domain. */
  engagement: { model: EngagementModel; via?: DomainKey[] }[];
  /** Cross-sell (SERVICE_TAXONOMY §5 and §6), 2–4 domains. */
  related: DomainKey[];
  /** Live tools that feed this domain (SERVICE_TAXONOMY §3); unavailable tools are filtered at render time. */
  tools: ToolKey[];
  /** Existing services whose primary domain this is (each service has exactly one). */
  primaryServices: ServiceKey[];
  /** Existing services that are also listed here ("Also listed in", SERVICE_TAXONOMY §3). */
  alsoListed: ServiceKey[];
  /** Service the contact form pre-selects from this hub (closest existing key until decision D4). */
  contactService: ServiceKey;
  /** Hubs are linked and listed in the sitemap only when published. */
  published: boolean;
}

export const BANDS: readonly DomainBand[] = ["ai", "engineering", "operations"];

const DIRECT_FOUR: DomainDefinition["engagement"] = [
  { model: "assessment" },
  { model: "workshop" },
  { model: "architecture" },
  { model: "implementation" },
];

export const DOMAINS: readonly DomainDefinition[] = [
  {
    key: "ai_strategy",
    id: "A",
    band: "ai",
    icon: "target",
    families: [
      { key: "readiness", status: "available", services: ["audit"] },
      { key: "discovery", status: "available", services: ["audit"] },
      { key: "roadmap", status: "custom" },
      { key: "operating_model", status: "custom" },
    ],
    engagement: [
      { model: "assessment" },
      { model: "workshop" },
      { model: "architecture" },
      { model: "implementation", via: ["ai_agents_automation", "ai_applications", "data_integration"] },
      { model: "managed", via: ["managed_operations"] },
    ],
    related: ["advisory_enablement", "ai_agents_automation", "ai_applications", "ai_governance"],
    tools: ["advisor", "readiness", "roi", "finder"],
    primaryServices: [],
    alsoListed: ["audit"],
    contactService: "audit",
    published: true,
  },
  {
    key: "ai_agents_automation",
    id: "B",
    band: "ai",
    icon: "bot",
    families: [
      { key: "task_agents", status: "available", services: ["ai_agents"] },
      { key: "workflow_automation", status: "available", services: ["automation"] },
      { key: "multi_agent", status: "available", services: ["ai_agents"] },
      { key: "human_in_the_loop", status: "available", services: ["automation"] },
      { key: "agent_tools", status: "available", via: ["data_integration"] },
    ],
    engagement: [...DIRECT_FOUR, { model: "managed", via: ["managed_operations"] }],
    related: ["data_integration", "ai_applications", "ai_governance", "managed_operations"],
    tools: ["advisor", "team", "roi", "finder", "solution", "agents"],
    primaryServices: ["ai_agents", "automation"],
    alsoListed: [],
    contactService: "automation",
    published: true,
  },
  {
    key: "ai_applications",
    id: "C",
    band: "ai",
    icon: "sparkles",
    families: [
      { key: "rag", status: "available", services: ["ai_tools"] },
      { key: "documents", status: "available", services: ["ai_tools"] },
      { key: "product_features", status: "available", services: ["ai_tools"] },
      { key: "evaluation", status: "custom" },
      { key: "adaptation", status: "custom" },
    ],
    engagement: [...DIRECT_FOUR, { model: "managed", via: ["managed_operations"] }],
    related: ["data_integration", "ai_governance", "cloud_platform", "managed_operations"],
    tools: ["solution"],
    primaryServices: ["ai_tools"],
    alsoListed: [],
    contactService: "ai_tools",
    published: true,
  },
  {
    key: "commerce_engineering",
    id: "D",
    band: "engineering",
    icon: "store",
    families: [
      { key: "maintenance", status: "available", services: ["maintenance"] },
      { key: "performance", status: "available", services: ["maintenance", "audit"] },
      { key: "seo", status: "available", services: ["seo"] },
      { key: "analytics", status: "available", services: ["analytics"] },
      { key: "integrations", status: "available", services: ["integrations"], via: ["data_integration"] },
      { key: "replatforming", status: "custom" },
      { key: "ai_for_commerce", status: "available", via: ["ai_agents_automation", "ai_applications"] },
    ],
    engagement: [...DIRECT_FOUR, { model: "managed" }],
    related: ["data_integration", "ai_agents_automation", "managed_operations", "advisory_enablement"],
    tools: [],
    primaryServices: ["maintenance", "seo", "analytics"],
    alsoListed: ["audit"],
    contactService: "audit",
    published: true,
  },
  {
    key: "cloud_platform",
    id: "E",
    band: "engineering",
    icon: "layers",
    families: [
      { key: "landing_zone", status: "custom" },
      { key: "iac", status: "custom" },
      { key: "containers", status: "custom" },
      { key: "data_services", status: "custom" },
      { key: "secrets", status: "custom" },
      { key: "ai_hosting", status: "custom" },
      { key: "cost", status: "custom" },
      { key: "migration", status: "custom" },
    ],
    engagement: [...DIRECT_FOUR, { model: "managed", via: ["managed_operations"] }],
    related: ["devops_sre", "ai_governance", "managed_operations", "data_integration"],
    tools: [],
    primaryServices: [],
    alsoListed: ["integrations"],
    contactService: "integrations",
    published: true,
  },
  {
    key: "devops_sre",
    id: "F",
    band: "engineering",
    icon: "activity",
    families: [
      { key: "cicd", status: "custom" },
      { key: "release", status: "custom" },
      { key: "observability", status: "custom" },
      { key: "alerting", status: "custom" },
      { key: "reliability", status: "custom" },
      { key: "incidents", status: "custom" },
      { key: "llm_observability", status: "custom" },
    ],
    engagement: [...DIRECT_FOUR, { model: "managed", via: ["managed_operations"] }],
    related: ["cloud_platform", "managed_operations", "ai_governance", "ai_applications"],
    tools: [],
    primaryServices: [],
    alsoListed: [],
    contactService: "integrations",
    published: true,
  },
  {
    key: "data_integration",
    id: "G",
    band: "engineering",
    icon: "database",
    families: [
      { key: "api", status: "available", services: ["integrations"] },
      { key: "sync", status: "available", services: ["integrations"] },
      { key: "events", status: "custom" },
      { key: "pipelines", status: "custom" },
      { key: "analytical_stores", status: "custom" },
      { key: "data_for_ai", status: "available", via: ["ai_applications"] },
    ],
    engagement: [...DIRECT_FOUR, { model: "managed", via: ["managed_operations"] }],
    related: ["ai_agents_automation", "ai_applications", "commerce_engineering", "managed_operations"],
    tools: ["solution"],
    primaryServices: ["integrations"],
    alsoListed: ["automation", "analytics"],
    contactService: "integrations",
    published: true,
  },
  {
    key: "ai_governance",
    id: "H",
    band: "ai",
    icon: "shield",
    families: [
      { key: "risk_review", status: "custom" },
      { key: "approvals", status: "custom" },
      { key: "data_protection", status: "custom" },
      { key: "security", status: "custom" },
      { key: "evaluation", status: "custom" },
      { key: "policy", status: "custom" },
    ],
    engagement: [...DIRECT_FOUR, { model: "managed", via: ["managed_operations"] }],
    related: ["ai_agents_automation", "ai_applications", "managed_operations", "ai_strategy"],
    tools: ["solution"],
    primaryServices: [],
    alsoListed: ["integrations", "ai_managed"],
    contactService: "audit",
    published: true,
  },
  {
    key: "managed_operations",
    id: "I",
    band: "operations",
    icon: "gauge",
    families: [
      { key: "managed_ai", status: "available", services: ["ai_managed"] },
      { key: "store_operations", status: "available", services: ["maintenance"] },
      { key: "platform_operations", status: "custom" },
      { key: "integration_health", status: "custom" },
      { key: "reporting", status: "available", services: ["ai_managed"] },
      { key: "portal", status: "planned" },
    ],
    engagement: [...DIRECT_FOUR, { model: "managed" }],
    related: ["devops_sre", "ai_governance", "ai_agents_automation", "commerce_engineering"],
    tools: ["team"],
    primaryServices: ["ai_managed"],
    alsoListed: ["maintenance"],
    contactService: "ai_managed",
    published: true,
  },
  {
    key: "advisory_enablement",
    id: "J",
    band: "operations",
    icon: "clipboard",
    families: [
      { key: "audits", status: "available", services: ["audit"] },
      { key: "reviews", status: "custom" },
      { key: "self_service", status: "available" },
      { key: "workshops", status: "custom" },
      { key: "training", status: "custom" },
      { key: "due_diligence", status: "custom" },
    ],
    engagement: [
      { model: "assessment" },
      { model: "workshop" },
      { model: "architecture" },
      { model: "implementation", via: ["ai_agents_automation", "ai_applications", "commerce_engineering", "data_integration"] },
      { model: "managed", via: ["managed_operations"] },
    ],
    related: ["ai_strategy", "commerce_engineering", "ai_agents_automation", "ai_governance"],
    tools: ["readiness", "finder", "roi", "solution"],
    primaryServices: ["audit"],
    alsoListed: [],
    contactService: "audit",
    published: true,
  },
];

export const DOMAIN_KEYS: readonly DomainKey[] = DOMAINS.map((domain) => domain.key);

export function domainDefinition(key: DomainKey): DomainDefinition {
  const domain = DOMAINS.find((d) => d.key === key);
  if (!domain) throw new Error(`Unknown domain key: ${key}`);
  return domain;
}

export function isDomainPublished(key: DomainKey): boolean {
  return domainDefinition(key).published;
}

const STATUS_RANK: Record<DeliveryStatus, number> = { available: 2, custom: 1, planned: 0 };

/** A domain shows the highest status of its families (SERVICE_TAXONOMY §1). */
export function domainStatus(key: DomainKey): DeliveryStatus {
  return domainDefinition(key).families.reduce<DeliveryStatus>(
    (best, family) => (STATUS_RANK[family.status] > STATUS_RANK[best] ? family.status : best),
    "planned",
  );
}

/** The one domain an existing service belongs to primarily (breadcrumbs, "part of" links). */
export function primaryDomainOf(service: ServiceKey): DomainDefinition | undefined {
  return DOMAINS.find((domain) => domain.primaryServices.includes(service));
}

export function domainsInBand(band: DomainBand): DomainDefinition[] {
  return DOMAINS.filter((domain) => domain.band === band);
}
