import type { ServiceKey } from "@/content/types";
import scenarios from "@/lib/demo-scenarios.json";

/**
 * The choices of each demonstration scenario, the service page it leads to and whether the project packages fit. All of
 * it comes from `demo-scenarios.json`, a copy of what `app/demos/engine.py` defines (a hash check in scripts/test.ps1 and
 * a test in the API keep the two equal), so the page and the API cannot disagree.
 */
type Entry = { fields: { key: string; options: string[] }[]; service: string; packages: boolean };
const manifest = scenarios as Record<string, Entry>;

export const DEMO_FIELDS: Record<string, { key: string; options: string[] }[]> = Object.fromEntries(Object.entries(manifest).map(([key, value]) => [key, value.fields]));
export const DEMO_SERVICE = Object.fromEntries(Object.entries(manifest).map(([key, value]) => [key, value.service as ServiceKey])) as Record<string, ServiceKey>;
export const DEMO_WITH_PACKAGES = new Set(Object.entries(manifest).filter(([, value]) => value.packages).map(([key]) => key));
