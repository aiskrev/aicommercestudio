/**
 * Feature flags for interactive tools. A tool is reachable only when it is implemented (`status:
 * "live"` in lib/tools.ts) AND its flag is on, so an incomplete tool can never be routed to.
 *
 * Defaults live here; an environment override is read on the server at build/render time:
 *   TOOL_FLAGS="tool_readiness=off,tool_team=on"
 * Turning on the flag of a tool that is not implemented has no effect (the registry still treats
 * it as planned).
 */
export type FeatureFlag =
  | "tool_advisor"
  | "tool_readiness"
  | "tool_team"
  | "tool_roi"
  | "tool_finder"
  | "tool_solution"
  | "tool_agents"
  | "tool_cloud"
  | "tool_devops"
  | "tool_observability";

export const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  tool_advisor: true,
  tool_readiness: true,
  tool_team: true,
  tool_roi: true,
  tool_finder: true,
  tool_solution: true,
  tool_agents: true,
  tool_cloud: true,
  tool_devops: true,
  tool_observability: true,
};

/** Parses `name=on|off` pairs; unknown names and malformed parts are ignored. */
export function parseFlagOverrides(raw: string | undefined): Partial<Record<FeatureFlag, boolean>> {
  const out: Partial<Record<FeatureFlag, boolean>> = {};
  for (const part of (raw ?? "").split(",")) {
    const [name, value] = part.split("=").map((s) => s.trim().toLowerCase());
    if (!(name in FLAG_DEFAULTS)) continue;
    if (value === "on" || value === "1" || value === "true") out[name as FeatureFlag] = true;
    if (value === "off" || value === "0" || value === "false") out[name as FeatureFlag] = false;
  }
  return out;
}

export function isFlagEnabled(flag: FeatureFlag, overrides = parseFlagOverrides(process.env.TOOL_FLAGS)): boolean {
  return overrides[flag] ?? FLAG_DEFAULTS[flag];
}
