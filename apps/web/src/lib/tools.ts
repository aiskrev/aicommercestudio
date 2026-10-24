import type { ServiceKey } from "@/content/types";
import { type Locale, localizePath } from "@/i18n/config";
import { routes } from "@/lib/routes";

/** Interactive tools. Texts live in content/{bg,en}/tools.ts. */
export type ToolKey = "advisor" | "readiness" | "team" | "roi";

/**
 * Canonical routes of tools that exist. A tool without a route is "in preparation" and must never
 * be linked (see docs/PLATFORM_EXPANSION_PLAN.md for the planned routes).
 */
export const TOOL_ROUTES: Partial<Record<ToolKey, string>> = {
  advisor: routes.advisor,
};

export function isToolLive(key: ToolKey): boolean {
  return key in TOOL_ROUTES;
}

/** Localized URLs of the live tools. */
export function toolHrefs(locale: Locale): Partial<Record<ToolKey, string>> {
  return Object.fromEntries(
    Object.entries(TOOL_ROUTES).map(([key, path]) => [key, localizePath(locale, path)]),
  ) as Partial<Record<ToolKey, string>>;
}

/** Tools offered on each service page, most relevant first. */
export const SERVICE_TOOLS: Record<ServiceKey, ToolKey[]> = {
  ai_agents: ["advisor", "team"],
  automation: ["advisor", "roi"],
  ai_tools: ["advisor", "readiness"],
  integrations: ["advisor"],
  ai_managed: ["readiness"],
  audit: ["advisor", "readiness"],
  maintenance: [],
  seo: [],
  analytics: ["roi"],
};
