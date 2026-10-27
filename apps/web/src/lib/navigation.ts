import type { ServiceKey } from "@/content/types";

/**
 * Service grouping used by the header menu, the mobile menu, the footer and the AI solutions page
 * (docs/INFORMATION_ARCHITECTURE.md). Every service appears exactly once.
 */
export const AI_SERVICE_NAV: ServiceKey[] = ["audit", "ai_agents", "automation", "ai_tools", "integrations", "ai_managed"];
export const FOUNDATION_SERVICE_NAV: ServiceKey[] = ["maintenance", "seo", "analytics"];
