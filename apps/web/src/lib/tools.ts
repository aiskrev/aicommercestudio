import type { IconName } from "@/components/ui/Icon";
import type { ServiceKey } from "@/content/types";
import { type Locale, localizePath } from "@/i18n/config";
import { type FeatureFlag, isFlagEnabled } from "@/lib/feature-flags";
import { routes } from "@/lib/routes";

/** Interactive tools. Texts live in content/{bg,en}/tools.ts; this file is the typed registry. */
export type ToolKey = "advisor" | "readiness" | "team" | "roi" | "finder" | "solution" | "agents";

/** `live`: implemented and tested. `planned`: shown as "in preparation", never linked or routed. */
export type ToolStatus = "live" | "planned";

export interface ToolDefinition {
  key: ToolKey;
  status: ToolStatus;
  flag: FeatureFlag;
  icon: IconName;
  /** Canonical route (Bulgarian segments). Planned tools have none. */
  path?: string;
  /** Typical completion time in minutes — only where it can be stated honestly. */
  minutes?: number;
  /** Services the tool leads to; drives cross-links on service pages. */
  services: ServiceKey[];
}

/** Bulgarian slugs of tools hosted under /instrumenti (English slugs: EN_SUBSEGMENTS in i18n/config). */
export const TOOL_SLUGS = {
  readiness: "ai-gotovnost",
  team: "ai-ekip",
  roi: "roi-kalkulator",
  finder: "avtomatizatsii",
} as const;

export const TOOLS: readonly ToolDefinition[] = [
  {
    key: "advisor",
    status: "live",
    flag: "tool_advisor",
    icon: "sparkles",
    path: routes.advisor,
    minutes: 3,
    services: ["automation", "ai_agents", "ai_tools", "integrations", "audit"],
  },
  {
    key: "readiness",
    status: "live",
    flag: "tool_readiness",
    icon: "gauge",
    path: routes.tool(TOOL_SLUGS.readiness),
    minutes: 5,
    services: ["audit", "ai_tools", "ai_managed"],
  },
  {
    key: "team",
    status: "live",
    flag: "tool_team",
    icon: "users",
    path: routes.tool(TOOL_SLUGS.team),
    minutes: 6,
    services: ["ai_agents", "integrations", "ai_managed"],
  },
  {
    key: "roi",
    status: "live",
    flag: "tool_roi",
    icon: "chart",
    path: routes.tool(TOOL_SLUGS.roi),
    minutes: 4,
    services: ["automation", "analytics"],
  },
  {
    key: "finder",
    status: "live",
    flag: "tool_finder",
    icon: "search",
    path: routes.tool(TOOL_SLUGS.finder),
    minutes: 8,
    services: ["automation", "ai_agents", "audit"],
  },
  { key: "solution", status: "planned", flag: "tool_solution", icon: "layers", services: ["ai_agents", "integrations"] },
  { key: "agents", status: "planned", flag: "tool_agents", icon: "bot", services: ["ai_agents"] },
];

export function toolByKey(key: ToolKey): ToolDefinition {
  const tool = TOOLS.find((t) => t.key === key);
  if (!tool) throw new Error(`Unknown tool: ${key}`);
  return tool;
}

/** Reachable = implemented, has a route and its feature flag is on. */
export function isToolAvailable(tool: ToolDefinition): tool is ToolDefinition & { path: string } {
  return tool.status === "live" && Boolean(tool.path) && isFlagEnabled(tool.flag);
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
  ai_agents: ["advisor", "team", "agents"],
  automation: ["finder", "roi", "advisor"],
  ai_tools: ["advisor", "readiness"],
  integrations: ["advisor", "solution"],
  ai_managed: ["readiness"],
  audit: ["readiness", "finder", "advisor"],
  maintenance: [],
  seo: [],
  analytics: ["roi"],
};
