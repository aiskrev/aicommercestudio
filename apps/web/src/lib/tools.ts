import type { IconName } from "@/components/ui/Icon";
import type { ServiceKey } from "@/content/types";
import { type Locale, localizePath } from "@/i18n/config";
import type { DomainKey } from "@/lib/domains";
import { type FeatureFlag, isFlagEnabled } from "@/lib/feature-flags";
import { routes } from "@/lib/routes";
import { type HostedToolKey, TOOL_PAGE_SLUGS } from "@/lib/tool-slugs";

/** Interactive tools. Texts live in content/{bg,en}/tools.ts; this file is the typed registry. */
export type ToolKey =
  | "advisor"
  | "readiness"
  | "team"
  | "roi"
  | "finder"
  | "solution"
  | "agents"
  | "cloud_maturity"
  | "devops_maturity"
  | "observability"
  | "ecommerce_architecture"
  | "data_integration"
  | "ai_governance"
  | "ai_ops_readiness"
  | "finops";

/**
 * `live`: implemented and tested. `planned`: shown as "Coming soon" with an intro page that states
 * the purpose, audience and expected output — never a start button, a form or a wizard.
 */
export type ToolStatus = "live" | "planned";

/** Hub categories (filters on /instrumenti), in display order. */
export const TOOL_CATEGORIES = ["ai_planning", "readiness", "business", "engineering"] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export interface ToolDefinition {
  key: ToolKey;
  status: ToolStatus;
  /** Feature flag of a live tool; planned tools have none (a flag can never make them reachable). */
  flag?: FeatureFlag;
  icon: IconName;
  category: ToolCategory;
  /** Shown in the "Start here" row of the hub. Only live tools are featured. */
  featured?: boolean;
  /** Canonical route of a live tool (Bulgarian segments). */
  path?: string;
  /** Typical completion time in minutes — only where it can be stated honestly (live tools). */
  minutes?: number;
  /** Services the tool leads to; drives cross-links on service pages. */
  services: ServiceKey[];
  /** Domain hub the tool belongs to (intro pages link it and pre-select its contact category). */
  domain?: DomainKey;
}

/** Bulgarian slugs of the tools hosted under /instrumenti (both languages: lib/tool-slugs.ts). */
export const TOOL_SLUGS = Object.fromEntries(
  Object.entries(TOOL_PAGE_SLUGS).map(([key, slugs]) => [key, slugs.bg]),
) as { [K in HostedToolKey]: (typeof TOOL_PAGE_SLUGS)[K]["bg"] };

export const TOOLS: readonly ToolDefinition[] = [
  {
    key: "advisor",
    status: "live",
    flag: "tool_advisor",
    icon: "sparkles",
    category: "ai_planning",
    featured: true,
    path: routes.advisor,
    minutes: 3,
    services: ["automation", "ai_agents", "ai_tools", "integrations", "audit"],
  },
  {
    key: "readiness",
    status: "live",
    flag: "tool_readiness",
    icon: "gauge",
    category: "readiness",
    featured: true,
    domain: "ai_strategy",
    path: routes.tool(TOOL_SLUGS.readiness),
    minutes: 5,
    services: ["audit", "ai_tools", "ai_managed"],
  },
  {
    key: "team",
    status: "live",
    flag: "tool_team",
    icon: "users",
    category: "ai_planning",
    domain: "ai_agents_automation",
    path: routes.tool(TOOL_SLUGS.team),
    minutes: 6,
    services: ["ai_agents", "integrations", "ai_managed"],
  },
  {
    key: "roi",
    status: "live",
    flag: "tool_roi",
    icon: "chart",
    category: "business",
    featured: true,
    path: routes.tool(TOOL_SLUGS.roi),
    minutes: 4,
    services: ["automation", "analytics"],
  },
  {
    key: "finder",
    status: "live",
    flag: "tool_finder",
    icon: "search",
    category: "business",
    domain: "ai_agents_automation",
    path: routes.tool(TOOL_SLUGS.finder),
    minutes: 8,
    services: ["automation", "ai_agents", "audit"],
  },
  {
    key: "solution",
    status: "live",
    flag: "tool_solution",
    icon: "layers",
    category: "ai_planning",
    domain: "ai_applications",
    path: routes.tool(TOOL_SLUGS.solution),
    minutes: 5,
    services: ["ai_agents", "integrations"],
  },
  { key: "agents", status: "live", flag: "tool_agents", icon: "bot", category: "ai_planning", path: routes.agentLibrary, services: ["ai_agents"] },
  // Engineering assessments on the assessment engine (questions and scoring come from the API).
  {
    key: "cloud_maturity",
    status: "live",
    flag: "tool_cloud",
    icon: "globe",
    category: "engineering",
    domain: "cloud_platform",
    path: routes.tool(TOOL_SLUGS.cloud_maturity),
    minutes: 10,
    services: ["audit"],
  },
  {
    key: "devops_maturity",
    status: "live",
    flag: "tool_devops",
    icon: "refresh",
    category: "engineering",
    domain: "devops_sre",
    path: routes.tool(TOOL_SLUGS.devops_maturity),
    minutes: 12,
    services: ["audit"],
  },
  // Planned engineering and operations assessments: intro pages only, no start button.
  { key: "observability", status: "planned", icon: "eye", category: "engineering", services: [], domain: "devops_sre" },
  { key: "ecommerce_architecture", status: "planned", icon: "store", category: "engineering", services: ["maintenance"], domain: "commerce_engineering" },
  { key: "data_integration", status: "planned", icon: "plug", category: "engineering", services: ["integrations"], domain: "data_integration" },
  { key: "ai_governance", status: "planned", icon: "shield", category: "readiness", services: [], domain: "ai_governance" },
  { key: "ai_ops_readiness", status: "planned", icon: "activity", category: "readiness", services: ["ai_managed"], domain: "managed_operations" },
  { key: "finops", status: "planned", icon: "trending", category: "business", services: [], domain: "cloud_platform" },
];

export function toolByKey(key: ToolKey): ToolDefinition {
  const tool = TOOLS.find((t) => t.key === key);
  if (!tool) throw new Error(`Unknown tool: ${key}`);
  return tool;
}

/** Reachable = implemented, has a route and its feature flag is on. */
export function isToolAvailable(tool: ToolDefinition): tool is ToolDefinition & { path: string } {
  return tool.status === "live" && Boolean(tool.path) && tool.flag !== undefined && isFlagEnabled(tool.flag);
}

/** Planned tools with an intro page under /instrumenti (never a functional page). */
export function isToolPlanned(tool: ToolDefinition): tool is ToolDefinition & { key: HostedToolKey } {
  return tool.status === "planned" && tool.key in TOOL_PAGE_SLUGS;
}

/** Localized intro-page URLs of the planned tools. */
export function toolIntroHrefs(locale: Locale): Partial<Record<ToolKey, string>> {
  return Object.fromEntries(
    TOOLS.filter(isToolPlanned).map((tool) => [tool.key, localizePath(locale, routes.tool(TOOL_PAGE_SLUGS[tool.key].bg))]),
  ) as Partial<Record<ToolKey, string>>;
}

/** Localized URLs of the reachable tools; a tool without an entry must not be linked. */
export function toolHrefs(locale: Locale): Partial<Record<ToolKey, string>> {
  return Object.fromEntries(
    TOOLS.filter(isToolAvailable).map((tool) => [tool.key, localizePath(locale, tool.path)]),
  ) as Partial<Record<ToolKey, string>>;
}

/** Estimated minutes per tool, only where the registry states it. */
export function toolMinutes(): Partial<Record<ToolKey, number>> {
  return Object.fromEntries(TOOLS.filter((t) => t.minutes !== undefined).map((t) => [t.key, t.minutes])) as Partial<Record<ToolKey, number>>;
}

/** Tools offered on each service page, most relevant first (derived from the registry). */
export const SERVICE_TOOLS: Record<ServiceKey, ToolKey[]> = {
  ai_agents: ["advisor", "team", "solution", "agents"],
  automation: ["finder", "roi", "advisor"],
  ai_tools: ["advisor", "readiness"],
  integrations: ["advisor", "solution"],
  ai_managed: ["readiness"],
  audit: ["readiness", "finder", "advisor"],
  maintenance: [],
  seo: [],
  analytics: ["roi"],
};
