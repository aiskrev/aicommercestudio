import {
  AGENTS,
  AGENT_KEYS,
  type AgentDefinition,
  type AgentKey,
  type Checkpoint,
  type Complexity,
  DATA_SOURCES,
  type Department,
  INTEGRATIONS,
  type Integration,
  WORKFLOWS,
  type WorkflowKey,
  checkpointFor,
} from "@/lib/ai-team";
import { AGENT_SLUGS as SLUGS } from "@/lib/agent-slugs";

/**
 * AI agent library — a catalogue of agent archetypes. Ten are the roles of "Build your AI team"
 * (lib/ai-team.ts: AGENTS, texts in content/{bg,en}/tool-team.ts); two are library-only archetypes
 * defined below (texts in content/{bg,en}/agent-library.ts → agents), so the team configurator, its
 * API port and its cost model stay unchanged. This module derives the catalogue attributes (risk
 * level, integration categories, data sources, example workflows) and the slugs of the library pages.
 * Method: docs/SOLUTION_BUILDER.md.
 */

export const LIBRARY_VERSION = "2026-11.1";

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

// ---------------------------------------------------------------------------------- archetypes

/** Archetypes that exist only in the library and the solution builder (not in the team configurator). */
export const LIBRARY_ONLY_KEYS = ["proposal_generation", "catalog_assistant"] as const;
export type LibraryOnlyKey = (typeof LIBRARY_ONLY_KEYS)[number];
export type LibraryKey = AgentKey | LibraryOnlyKey;

export interface ArchetypeDefinition extends Omit<AgentDefinition, "key" | "requires" | "pairsWith"> {
  key: LibraryKey;
  requires: LibraryKey[];
  pairsWith: LibraryKey[];
}

export const LIBRARY_ONLY: Record<LibraryOnlyKey, ArchetypeDefinition> = {
  proposal_generation: {
    key: "proposal_generation",
    role: "task",
    departments: ["sales"],
    integrations: ["crm", "document_storage"],
    optionalIntegrations: ["knowledge_base", "email"],
    // A proposal goes to a customer: a person approves it before it is sent.
    external: true,
    sensitivity: "medium",
    minCheckpoint: "before_external",
    requires: [],
    pairsWith: ["sales_research", "approval_supervisor"],
    complexity: "medium",
  },
  catalog_assistant: {
    key: "catalog_assistant",
    role: "task",
    departments: ["marketing", "operations"],
    integrations: ["ecommerce_platform"],
    optionalIntegrations: ["cms", "document_storage", "analytics_warehouse"],
    // Product data is published in the store: changes are approved before they go live.
    external: true,
    sensitivity: "low",
    minCheckpoint: "before_external",
    requires: [],
    pairsWith: ["content_operations", "approval_supervisor"],
    complexity: "medium",
  },
};

/** Library order: each library-only archetype sits next to the team role it is closest to. */
export const LIBRARY_KEYS: LibraryKey[] = AGENT_KEYS.flatMap((key): LibraryKey[] =>
  key === "sales_research" ? [key, "proposal_generation"] : key === "content_operations" ? [key, "catalog_assistant"] : [key],
);

export const isTeamAgent = (key: LibraryKey): key is AgentKey => (AGENT_KEYS as readonly string[]).includes(key);

export function archetype(key: LibraryKey): ArchetypeDefinition {
  return isTeamAgent(key) ? AGENTS[key] : LIBRARY_ONLY[key];
}

/** Adds an archetype together with everything it requires (transitively), keeping library order. */
export function withDependencies(selected: LibraryKey[], key: LibraryKey): LibraryKey[] {
  const next = new Set(selected);
  const visit = (k: LibraryKey) => {
    next.add(k);
    for (const required of archetype(k).requires) if (!next.has(required)) visit(required);
  };
  visit(key);
  return LIBRARY_KEYS.filter((k) => next.has(k));
}

// ---------------------------------------------------------------------------------- workflows

/** Workflows of the library-only archetypes (texts: content agent-library.ts → workflows). */
export const LIBRARY_ONLY_WORKFLOW_KEYS = ["proposal_drafting", "catalog_enrichment"] as const;
export type LibraryWorkflowKey = WorkflowKey | (typeof LIBRARY_ONLY_WORKFLOW_KEYS)[number];

export const LIBRARY_WORKFLOWS: { key: LibraryWorkflowKey; core: LibraryKey; chain: LibraryKey[] }[] = [
  ...WORKFLOWS,
  { key: "proposal_drafting", core: "proposal_generation", chain: ["sales_research", "proposal_generation"] },
  { key: "catalog_enrichment", core: "catalog_assistant", chain: ["catalog_assistant"] },
];

export const isTeamWorkflow = (key: LibraryWorkflowKey): key is WorkflowKey => WORKFLOWS.some((w) => w.key === key);

export const libraryWorkflow = (key: LibraryWorkflowKey) => LIBRARY_WORKFLOWS.find((w) => w.key === key)!;

// ---------------------------------------------------------------------------------- catalogue

export type RiskLevel = "low" | "medium" | "high";

/**
 * Risk of the role itself (before any mitigation): high when it handles highly sensitive data,
 * medium when it handles personal data or acts outside the company, low otherwise.
 */
export function riskLevel(key: LibraryKey): RiskLevel {
  const def = archetype(key);
  if (def.sensitivity === "high") return "high";
  if (def.sensitivity === "medium" || def.external) return "medium";
  return "low";
}

/** Bulgarian and English page slugs (defined in lib/agent-slugs.ts for the locale routing). */
export const AGENT_SLUGS: Record<LibraryKey, { bg: string; en: string }> = SLUGS;

export function agentBySlug(slug: string): LibraryKey | null {
  return LIBRARY_KEYS.find((key) => AGENT_SLUGS[key].bg === slug) ?? null;
}

export interface LibraryEntry {
  key: LibraryKey;
  /** Part of "Build your AI team" (false for library-only archetypes). */
  inTeam: boolean;
  departments: Department[];
  role: AgentDefinition["role"];
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
  requires: LibraryKey[];
  /** Workflow templates it takes part in; coordination roles fit any multi-agent workflow. */
  workflows: LibraryWorkflowKey[];
}

const inOrder = <T extends string>(order: readonly T[], values: Iterable<T>): T[] => {
  const set = new Set(values);
  return order.filter((v) => set.has(v));
};

export function libraryEntry(key: LibraryKey): LibraryEntry {
  const def = archetype(key);
  const all = [...def.integrations, ...def.optionalIntegrations];
  return {
    key,
    inTeam: isTeamAgent(key),
    departments: def.departments,
    role: def.role,
    dataSources: [...def.integrations, ...def.optionalIntegrations.filter((i) => !def.integrations.includes(i))].filter((i) => DATA_SOURCES.has(i)),
    systems: inOrder(INTEGRATIONS, all.filter((i) => !DATA_SOURCES.has(i))),
    categories: inOrder(INTEGRATION_CATEGORIES, all.map((i) => CATEGORY_OF[i])),
    requiredCategories: inOrder(INTEGRATION_CATEGORIES, def.integrations.map((i) => CATEGORY_OF[i])),
    approval: checkpointFor(def).checkpoint,
    external: def.external,
    risk: riskLevel(key),
    complexity: def.complexity,
    requires: def.requires,
    workflows:
      def.role === "task"
        ? LIBRARY_WORKFLOWS.filter((w) => w.chain.includes(key)).map((w) => w.key)
        : LIBRARY_WORKFLOWS.filter((w) => w.chain.length > 1).map((w) => w.key),
  };
}

export const LIBRARY: LibraryEntry[] = LIBRARY_KEYS.map(libraryEntry);

export interface LibraryFilter {
  department?: Department;
  risk?: RiskLevel;
  complexity?: Complexity;
  category?: IntegrationCategory;
  /** Free text matched against the localized name and purpose (case-insensitive). */
  query?: string;
}

/** Deterministic filtering in library order. */
export function filterLibrary(filter: LibraryFilter, text: (key: LibraryKey) => string): LibraryEntry[] {
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

// ---------------------------------------------------------------------------------- texts

export interface AgentText {
  name: string;
  short: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  oversight: string;
  sensitivityNote: string;
}

export interface WorkflowText {
  title: string;
  trigger: string;
  outcome: string;
}

/** Texts of any archetype: team roles from the team content, library-only ones from the library content. */
export function agentText(
  content: { teamTool: { agents: Record<AgentKey, AgentText> }; agentLibrary: { agents: Record<LibraryOnlyKey, AgentText> } },
  key: LibraryKey,
): AgentText {
  return isTeamAgent(key) ? content.teamTool.agents[key] : content.agentLibrary.agents[key];
}

export function workflowText(
  content: { teamTool: { result: { workflows: Record<WorkflowKey, WorkflowText> } }; agentLibrary: { workflows: Record<(typeof LIBRARY_ONLY_WORKFLOW_KEYS)[number], WorkflowText> } },
  key: LibraryWorkflowKey,
): WorkflowText {
  return isTeamWorkflow(key) ? content.teamTool.result.workflows[key] : content.agentLibrary.workflows[key];
}
