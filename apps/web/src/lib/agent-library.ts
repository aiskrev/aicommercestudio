import {
  AGENTS,
  AGENT_KEYS,
  type AgentKey,
  type Checkpoint,
  type Complexity,
  DATA_SOURCES,
  type Department,
  INTEGRATIONS,
  type Integration,
  WORKFLOWS,
  type WorkflowKey,
  minimumCheckpoint,
} from "@/lib/ai-team";
import { AGENT_SLUGS as SLUGS } from "@/lib/agent-slugs";

/**
 * AI agent library — a catalogue view over the agent definitions of "Build your AI team"
 * (lib/ai-team.ts: AGENTS). Nothing about an agent is defined twice: purpose, inputs, outputs and
 * oversight texts come from content/{bg,en}/tool-team.ts; this module only derives catalogue
 * attributes (risk level, integration categories, data sources, example workflows) and the slugs of
 * the library pages. Method: docs/SOLUTION_BUILDER.md.
 */

export const LIBRARY_VERSION = "2026-10.1";

/** Integration categories used by the library and the solution builder. */
export const INTEGRATION_CATEGORIES = ["crm", "erp", "email_calendar", "helpdesk", "databases", "document_storage", "internal_apis"] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

/** Each concrete system type of the team model belongs to exactly one category. */
export const CATEGORY_OF: Record<Integration, IntegrationCategory> = {
  crm: "crm",
  email: "email_calendar",
  calendar: "email_calendar",
  chat: "email_calendar",
  helpdesk: "helpdesk",
  erp: "erp",
  accounting: "erp",
  hris: "erp",
  ecommerce_platform: "erp",
  analytics_warehouse: "databases",
  knowledge_base: "document_storage",
  document_storage: "document_storage",
  cms: "internal_apis",
};

export type RiskLevel = "low" | "medium" | "high";

/**
 * Risk of the role itself (before any mitigation): high when it handles highly sensitive data,
 * medium when it handles personal data or acts outside the company, low otherwise.
 */
export function riskLevel(agent: AgentKey): RiskLevel {
  const def = AGENTS[agent];
  if (def.sensitivity === "high") return "high";
  if (def.sensitivity === "medium" || def.external) return "medium";
  return "low";
}

/** Bulgarian and English page slugs (defined in lib/agent-slugs.ts for the locale routing). */
export const AGENT_SLUGS: Record<AgentKey, { bg: string; en: string }> = SLUGS;

export function agentBySlug(slug: string): AgentKey | null {
  return AGENT_KEYS.find((key) => AGENT_SLUGS[key].bg === slug) ?? null;
}

export interface LibraryEntry {
  key: AgentKey;
  departments: Department[];
  role: (typeof AGENTS)[AgentKey]["role"];
  /** Shared knowledge and data the agent reads (required first, then optional). */
  dataSources: Integration[];
  /** Systems it works in (required + optional), excluding data sources. */
  systems: Integration[];
  categories: IntegrationCategory[];
  requiredCategories: IntegrationCategory[];
  approval: Checkpoint;
  external: boolean;
  risk: RiskLevel;
  complexity: Complexity;
  requires: AgentKey[];
  /** Workflow templates it takes part in; coordination roles fit any multi-agent workflow. */
  workflows: WorkflowKey[];
}

const inOrder = <T extends string>(order: readonly T[], values: Iterable<T>): T[] => {
  const set = new Set(values);
  return order.filter((v) => set.has(v));
};

export function libraryEntry(key: AgentKey): LibraryEntry {
  const def = AGENTS[key];
  const all = [...def.integrations, ...def.optionalIntegrations];
  return {
    key,
    departments: def.departments,
    role: def.role,
    dataSources: [...def.integrations, ...def.optionalIntegrations.filter((i) => !def.integrations.includes(i))].filter((i) => DATA_SOURCES.has(i)),
    systems: inOrder(INTEGRATIONS, all.filter((i) => !DATA_SOURCES.has(i))),
    categories: inOrder(INTEGRATION_CATEGORIES, all.map((i) => CATEGORY_OF[i])),
    requiredCategories: inOrder(INTEGRATION_CATEGORIES, def.integrations.map((i) => CATEGORY_OF[i])),
    approval: minimumCheckpoint(key).checkpoint,
    external: def.external,
    risk: riskLevel(key),
    complexity: def.complexity,
    requires: def.requires,
    workflows:
      def.role === "task"
        ? WORKFLOWS.filter((w) => w.chain.includes(key)).map((w) => w.key)
        : WORKFLOWS.filter((w) => w.chain.length > 1).map((w) => w.key),
  };
}

export const LIBRARY: LibraryEntry[] = AGENT_KEYS.map(libraryEntry);

export interface LibraryFilter {
  department?: Department;
  risk?: RiskLevel;
  complexity?: Complexity;
  category?: IntegrationCategory;
  /** Free text matched against the localized name and purpose (case-insensitive). */
  query?: string;
}

/** Deterministic filtering in library order. */
export function filterLibrary(filter: LibraryFilter, text: (key: AgentKey) => string): LibraryEntry[] {
  const query = filter.query?.trim().toLocaleLowerCase();
  return LIBRARY.filter(
    (entry) =>
      (!filter.department || entry.departments.includes(filter.department)) &&
      (!filter.risk || entry.risk === filter.risk) &&
      (!filter.complexity || entry.complexity === filter.complexity) &&
      (!filter.category || entry.categories.includes(filter.category)) &&
      (!query || text(entry.key).toLocaleLowerCase().includes(query)),
  );
}
