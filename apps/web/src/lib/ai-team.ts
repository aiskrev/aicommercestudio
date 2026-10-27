import type { ServiceKey } from "@/content/types";

/**
 * "Build your AI team" — configuration model (pure, deterministic, no network, no personal data).
 * Texts: content/{bg,en}/tool-team.ts. Method: docs/TOOLS_PLATFORM.md → "AI team model".
 *
 * Every recommendation is a rule with a reason key the UI can show ("why"):
 *   recommended agents ← main challenge + departments in scope
 *   dependencies       ← AGENTS[*].requires (added automatically, cannot be removed while needed)
 *   approval minimum   ← agent oversight floor, raised for external actions and sensitive data
 *   complexity         ← additive points (agents, integrations, volume, sensitivity, deployment)
 *   risks / prereqs    ← conditions over the configuration
 *   rollout            ← pilot with the simplest relevant agent, then the rest, coordination last
 * Nothing here is deployed or measured; effort ranges are labelled estimates with stated assumptions.
 *
 * The API ports these rules (apps/api/app/team/model.py) for cost estimates, saved configurations and
 * the PDF plan; both are tested against the same golden vectors (team.vectors.json). Change the rules
 * in both places, regenerate the vectors and bump TEAM_MODEL_VERSION together.
 */

/** Must equal MODEL_VERSION in apps/api/app/team/model.py. */
export const TEAM_MODEL_VERSION = "2026-10.1";
/** Version of the request shape sent to /api/public/team/*. */
export const TEAM_SCHEMA_VERSION = "1";

/** Security considerations the API derives for a team (texts: content tool-team.ts → security). */
export const SECURITY_KEYS = [
  "least_privilege",
  "secrets",
  "audit_log",
  "provider_terms",
  "personal_data",
  "untrusted_input",
  "external_actions",
  "document_permissions",
  "regulated_data",
  "data_location",
] as const;
export type SecurityKey = (typeof SECURITY_KEYS)[number];

/** Cost scenarios: conservative = lower usage and a lean scope. */
export const COST_SCENARIOS = ["conservative", "expected", "higher"] as const;
export type CostScenario = (typeof COST_SCENARIOS)[number];

// ---------------------------------------------------------------------------------------- context

export const INDUSTRIES = ["ecommerce", "professional_services", "manufacturing", "logistics", "saas", "financial_services", "healthcare", "other"] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const COMPANY_SIZES = ["s1_10", "s11_50", "s51_250", "s251_1000", "s1000_plus"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const DEPARTMENTS = ["sales", "marketing", "support", "operations", "finance", "hr", "it_knowledge", "custom"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const CHALLENGES = [
  "slow_response",
  "lead_followup",
  "manual_documents",
  "scattered_knowledge",
  "content_volume",
  "reporting_effort",
  "scheduling_overhead",
  "handoffs",
] as const;
export type Challenge = (typeof CHALLENGES)[number];

/** Tasks per month across the workflow (bands, so nobody has to invent an exact number). */
export const VOLUMES = ["v_lt100", "v100_1k", "v1k_10k", "v_gt10k"] as const;
export type Volume = (typeof VOLUMES)[number];

export interface BusinessContext {
  industry?: Industry;
  size?: CompanySize;
  /** Department that owns the initiative; preselected in step 2. */
  leadDepartment?: Department;
  challenge?: Challenge;
  volume?: Volume;
}

// ---------------------------------------------------------------------------------- integrations

export const INTEGRATIONS = [
  "crm",
  "email",
  "helpdesk",
  "chat",
  "calendar",
  "cms",
  "ecommerce_platform",
  "erp",
  "accounting",
  "hris",
  "knowledge_base",
  "document_storage",
  "analytics_warehouse",
] as const;
export type Integration = (typeof INTEGRATIONS)[number];

/** Shared knowledge and data that agents read; everything else is an external system they act in. */
export const DATA_SOURCES: ReadonlySet<Integration> = new Set(["knowledge_base", "document_storage", "analytics_warehouse"]);

// ---------------------------------------------------------------------------------------- agents

export const AGENT_KEYS = [
  "lead_qualification",
  "sales_research",
  "customer_support",
  "content_operations",
  "document_processing",
  "knowledge_assistant",
  "scheduling",
  "reporting_insights",
  "workflow_coordinator",
  "approval_supervisor",
] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

/** task: does the work · coordination: routes work between agents · oversight: routes work to people. */
export type AgentRole = "task" | "coordination" | "oversight";
export type Sensitivity = "low" | "medium" | "high";
export type Complexity = "low" | "medium" | "high";

/** Ordered from least to most human involvement. */
export const CHECKPOINTS = ["none", "sample_review", "before_external", "every_action"] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number];

export interface AgentDefinition {
  key: AgentKey;
  role: AgentRole;
  departments: Department[];
  /** Systems the agent cannot work without (always selected for it). */
  integrations: Integration[];
  /** Systems it can additionally use if the company has them. */
  optionalIntegrations: Integration[];
  /** Acts outside the company (customers, partners, public channels). */
  external: boolean;
  /** Personal, financial or confidential data it typically handles. */
  sensitivity: Sensitivity;
  /** Lowest approval checkpoint we would configure for this role. */
  minCheckpoint: Checkpoint;
  /** Other agents it needs (added automatically). */
  requires: AgentKey[];
  /** Agents that work well with it (suggested, never forced). */
  pairsWith: AgentKey[];
  complexity: Complexity;
}

export const AGENTS: Record<AgentKey, AgentDefinition> = {
  lead_qualification: {
    key: "lead_qualification",
    role: "task",
    departments: ["sales", "marketing"],
    integrations: ["crm"],
    optionalIntegrations: ["email", "chat", "ecommerce_platform"],
    external: false,
    sensitivity: "medium",
    minCheckpoint: "sample_review",
    requires: [],
    pairsWith: ["sales_research", "scheduling"],
    complexity: "low",
  },
  sales_research: {
    key: "sales_research",
    role: "task",
    departments: ["sales"],
    integrations: ["crm"],
    optionalIntegrations: ["knowledge_base"],
    external: false,
    sensitivity: "low",
    minCheckpoint: "sample_review",
    requires: [],
    pairsWith: ["lead_qualification"],
    complexity: "low",
  },
  customer_support: {
    key: "customer_support",
    role: "task",
    departments: ["support"],
    integrations: ["helpdesk", "knowledge_base"],
    optionalIntegrations: ["email", "chat", "ecommerce_platform", "crm"],
    external: true,
    sensitivity: "high",
    minCheckpoint: "sample_review",
    // Answers must come from approved company knowledge, maintained by the knowledge assistant.
    requires: ["knowledge_assistant"],
    pairsWith: ["approval_supervisor"],
    complexity: "medium",
  },
  content_operations: {
    key: "content_operations",
    role: "task",
    departments: ["marketing"],
    integrations: ["cms"],
    optionalIntegrations: ["ecommerce_platform", "document_storage", "analytics_warehouse"],
    external: true,
    sensitivity: "low",
    minCheckpoint: "sample_review",
    requires: [],
    pairsWith: ["approval_supervisor", "reporting_insights"],
    complexity: "medium",
  },
  document_processing: {
    key: "document_processing",
    role: "task",
    departments: ["operations", "finance", "hr"],
    integrations: ["document_storage"],
    optionalIntegrations: ["erp", "accounting", "hris", "email"],
    external: false,
    sensitivity: "high",
    minCheckpoint: "sample_review",
    requires: [],
    pairsWith: ["approval_supervisor"],
    complexity: "high",
  },
  knowledge_assistant: {
    key: "knowledge_assistant",
    role: "task",
    departments: ["it_knowledge", "support", "hr", "operations"],
    integrations: ["knowledge_base"],
    optionalIntegrations: ["document_storage", "chat"],
    external: false,
    sensitivity: "medium",
    minCheckpoint: "sample_review",
    requires: [],
    pairsWith: ["customer_support"],
    complexity: "medium",
  },
  scheduling: {
    key: "scheduling",
    role: "task",
    departments: ["sales", "support", "hr", "operations"],
    integrations: ["calendar"],
    optionalIntegrations: ["email", "crm", "hris"],
    external: true,
    sensitivity: "medium",
    minCheckpoint: "sample_review",
    requires: [],
    pairsWith: ["lead_qualification"],
    complexity: "low",
  },
  reporting_insights: {
    key: "reporting_insights",
    role: "task",
    departments: ["operations", "finance", "sales", "marketing"],
    integrations: ["analytics_warehouse"],
    optionalIntegrations: ["crm", "erp", "accounting", "ecommerce_platform"],
    external: false,
    sensitivity: "medium",
    minCheckpoint: "sample_review",
    requires: [],
    pairsWith: [],
    complexity: "medium",
  },
  workflow_coordinator: {
    key: "workflow_coordinator",
    role: "coordination",
    departments: ["operations", "it_knowledge"],
    integrations: [],
    optionalIntegrations: ["email", "chat"],
    external: false,
    sensitivity: "medium",
    minCheckpoint: "sample_review",
    requires: [],
    pairsWith: [],
    complexity: "high",
  },
  approval_supervisor: {
    key: "approval_supervisor",
    role: "oversight",
    departments: ["operations", "it_knowledge"],
    integrations: [],
    optionalIntegrations: ["email", "chat"],
    external: false,
    sensitivity: "medium",
    // It is the human checkpoint: every decision it routes is made by a person.
    minCheckpoint: "every_action",
    requires: [],
    pairsWith: [],
    complexity: "medium",
  },
};

/** A coordinator only makes sense when it has something to coordinate. */
export const COORDINATOR_MIN_TASK_AGENTS = 2;

// --------------------------------------------------------------------------------- recommendations

const CHALLENGE_AGENTS: Record<Challenge, AgentKey[]> = {
  slow_response: ["customer_support", "knowledge_assistant"],
  lead_followup: ["lead_qualification", "scheduling"],
  manual_documents: ["document_processing"],
  scattered_knowledge: ["knowledge_assistant"],
  content_volume: ["content_operations"],
  reporting_effort: ["reporting_insights"],
  scheduling_overhead: ["scheduling"],
  handoffs: ["workflow_coordinator"],
};

const DEPARTMENT_AGENTS: Record<Department, AgentKey[]> = {
  sales: ["lead_qualification", "sales_research"],
  marketing: ["content_operations", "lead_qualification"],
  support: ["customer_support", "knowledge_assistant"],
  operations: ["document_processing", "reporting_insights"],
  finance: ["document_processing", "reporting_insights"],
  hr: ["knowledge_assistant", "scheduling"],
  it_knowledge: ["knowledge_assistant"],
  custom: [],
};

export type RecommendationReason =
  | { kind: "challenge"; challenge: Challenge }
  | { kind: "department"; department: Department }
  | { kind: "team_size" }
  | { kind: "sensitive_external" };

export interface AgentRecommendation {
  agent: AgentKey;
  reasons: RecommendationReason[];
}

/** Agents recommended for the context, strongest first (challenge before department), with reasons. */
export function recommendAgents(context: BusinessContext, departments: Department[]): AgentRecommendation[] {
  const byAgent = new Map<AgentKey, RecommendationReason[]>();
  const add = (agent: AgentKey, reason: RecommendationReason) => byAgent.set(agent, [...(byAgent.get(agent) ?? []), reason]);
  if (context.challenge) for (const agent of CHALLENGE_AGENTS[context.challenge]) add(agent, { kind: "challenge", challenge: context.challenge });
  for (const department of DEPARTMENTS) {
    if (!departments.includes(department)) continue;
    for (const agent of DEPARTMENT_AGENTS[department]) add(agent, { kind: "department", department });
  }
  const weight = (reasons: RecommendationReason[]) => reasons.reduce((sum, r) => sum + (r.kind === "challenge" ? 10 : 1), 0);
  return [...byAgent.entries()]
    .map(([agent, reasons]) => ({ agent, reasons }))
    .sort((a, b) => weight(b.reasons) - weight(a.reasons) || AGENT_KEYS.indexOf(a.agent) - AGENT_KEYS.indexOf(b.agent));
}

/** Team-level suggestions that depend on what is already selected (coordination and oversight). */
export function teamSuggestions(selected: AgentKey[]): AgentRecommendation[] {
  const suggestions: AgentRecommendation[] = [];
  const tasks = selected.filter((a) => AGENTS[a].role === "task");
  if (tasks.length >= 3 && !selected.includes("workflow_coordinator")) {
    suggestions.push({ agent: "workflow_coordinator", reasons: [{ kind: "team_size" }] });
  }
  const sensitiveExternal = tasks.some((a) => AGENTS[a].external && AGENTS[a].sensitivity === "high");
  if ((sensitiveExternal || tasks.length >= 3) && !selected.includes("approval_supervisor")) {
    suggestions.push({ agent: "approval_supervisor", reasons: [{ kind: sensitiveExternal ? "sensitive_external" : "team_size" }] });
  }
  return suggestions;
}

// ------------------------------------------------------------------------------------ selection

/** Adds an agent together with everything it requires (transitively), keeping library order. */
export function addAgent(selected: AgentKey[], agent: AgentKey): AgentKey[] {
  const next = new Set(selected);
  const visit = (key: AgentKey) => {
    if (next.has(key) && key !== agent) return;
    next.add(key);
    for (const required of AGENTS[key].requires) visit(required);
  };
  visit(agent);
  return AGENT_KEYS.filter((key) => next.has(key));
}

/** Selected agents that need `agent`; it cannot be removed while this is non-empty. */
export function requiredBy(selected: AgentKey[], agent: AgentKey): AgentKey[] {
  return selected.filter((key) => key !== agent && AGENTS[key].requires.includes(agent));
}

/** Removes an agent unless another selected agent requires it (then the selection is unchanged). */
export function removeAgent(selected: AgentKey[], agent: AgentKey): AgentKey[] {
  if (requiredBy(selected, agent).length > 0) return selected;
  return selected.filter((key) => key !== agent);
}

/** Agents that were added only because another one requires them. */
export function addedAsDependency(selected: AgentKey[], chosen: AgentKey[]): AgentKey[] {
  return selected.filter((key) => !chosen.includes(key) && requiredBy(selected, key).length > 0);
}

export type SelectionIssue = { kind: "no_task_agent" } | { kind: "coordinator_needs_agents"; have: number; need: number };

export function selectionIssues(selected: AgentKey[]): SelectionIssue[] {
  const tasks = selected.filter((a) => AGENTS[a].role === "task").length;
  const issues: SelectionIssue[] = [];
  if (tasks === 0) issues.push({ kind: "no_task_agent" });
  if (selected.includes("workflow_coordinator") && tasks < COORDINATOR_MIN_TASK_AGENTS) {
    issues.push({ kind: "coordinator_needs_agents", have: tasks, need: COORDINATOR_MIN_TASK_AGENTS });
  }
  return issues;
}

// ---------------------------------------------------------------------------------- configuration

export interface AgentConfig {
  volume: Volume;
  integrations: Integration[];
  checkpoint: Checkpoint;
}

export const DEPLOYMENTS = ["managed_cloud", "customer_cloud", "on_premise"] as const;
export type Deployment = (typeof DEPLOYMENTS)[number];
export const OPERATIONS = ["studio_managed", "shared", "internal"] as const;
export type Operations = (typeof OPERATIONS)[number];

export interface TeamConfig {
  context: BusinessContext;
  departments: Department[];
  /** Agents the visitor picked (dependencies are added on top of these). */
  chosen: AgentKey[];
  agents: Partial<Record<AgentKey, AgentConfig>>;
  deployment?: Deployment;
  operations?: Operations;
}

export type CheckpointReason = "role" | "external" | "sensitive";

/** Lowest allowed checkpoint for an agent and why (external actions and sensitive data raise it). */
export function minimumCheckpoint(agent: AgentKey): { checkpoint: Checkpoint; reason: CheckpointReason } {
  const def = AGENTS[agent];
  let checkpoint = def.minCheckpoint;
  let reason: CheckpointReason = "role";
  const raise = (to: Checkpoint, why: CheckpointReason) => {
    if (CHECKPOINTS.indexOf(to) > CHECKPOINTS.indexOf(checkpoint)) {
      checkpoint = to;
      reason = why;
    }
  };
  if (def.external) raise("before_external", "external");
  if (def.sensitivity === "high") raise("sample_review", "sensitive");
  return { checkpoint, reason };
}

export function allowedCheckpoints(agent: AgentKey): Checkpoint[] {
  return CHECKPOINTS.slice(CHECKPOINTS.indexOf(minimumCheckpoint(agent).checkpoint));
}

/** Starting configuration: context volume, required integrations, the minimum checkpoint. */
export function defaultAgentConfig(agent: AgentKey, context: BusinessContext): AgentConfig {
  return {
    volume: context.volume ?? "v100_1k",
    integrations: [...AGENTS[agent].integrations],
    checkpoint: minimumCheckpoint(agent).checkpoint,
  };
}

/** Configuration of one agent with the rules applied (required integrations kept, checkpoint floor). */
export function normaliseAgentConfig(agent: AgentKey, config: AgentConfig): AgentConfig {
  const def = AGENTS[agent];
  const allowed = new Set<Integration>([...def.integrations, ...def.optionalIntegrations]);
  const integrations = INTEGRATIONS.filter((i) => def.integrations.includes(i) || (allowed.has(i) && config.integrations.includes(i)));
  const floor = CHECKPOINTS.indexOf(minimumCheckpoint(agent).checkpoint);
  const checkpoint = CHECKPOINTS[Math.max(floor, CHECKPOINTS.indexOf(config.checkpoint))];
  return { volume: config.volume, integrations, checkpoint };
}

/** All selected agents (chosen + dependencies) in library order. */
export function selectedAgents(config: Pick<TeamConfig, "chosen">): AgentKey[] {
  return config.chosen.reduce<AgentKey[]>((acc, agent) => addAgent(acc, agent), []);
}

/** Effective, rule-checked configuration for every selected agent. */
export function agentConfigs(config: TeamConfig): Record<AgentKey, AgentConfig> {
  return Object.fromEntries(
    selectedAgents(config).map((agent) => [agent, normaliseAgentConfig(agent, config.agents[agent] ?? defaultAgentConfig(agent, config.context))]),
  ) as Record<AgentKey, AgentConfig>;
}

// --------------------------------------------------------------------------------------- results

export type ComplexityFactor =
  | { kind: "agents"; points: number; count: number }
  | { kind: "integrations"; points: number; count: number }
  | { kind: "volume"; points: number; volume: Volume }
  | { kind: "sensitive_data"; points: number }
  | { kind: "external_actions"; points: number }
  | { kind: "coordination"; points: number }
  | { kind: "deployment"; points: number; deployment: Deployment };

const AGENT_POINTS: Record<Complexity, number> = { low: 1, medium: 2, high: 3 };
const VOLUME_POINTS: Record<Volume, number> = { v_lt100: 0, v100_1k: 1, v1k_10k: 2, v_gt10k: 3 };
const DEPLOYMENT_POINTS: Record<Deployment, number> = { managed_cloud: 0, customer_cloud: 1, on_premise: 3 };
/** Thresholds on the total points (inclusive lower bounds). */
export const COMPLEXITY_BANDS: { band: Complexity; min: number }[] = [
  { band: "high", min: 14 },
  { band: "medium", min: 7 },
  { band: "low", min: 0 },
];

function highestVolume(configs: Record<AgentKey, AgentConfig>): Volume {
  const volumes = Object.values(configs).map((c) => VOLUMES.indexOf(c.volume));
  return VOLUMES[Math.max(0, ...volumes)];
}

/** Distinct systems the team connects to, in catalogue order. */
export function teamIntegrations(configs: Record<AgentKey, AgentConfig>): Integration[] {
  const used = new Set(Object.values(configs).flatMap((c) => c.integrations));
  return INTEGRATIONS.filter((i) => used.has(i));
}

export function complexity(config: TeamConfig): { band: Complexity; points: number; factors: ComplexityFactor[] } {
  const configs = agentConfigs(config);
  const agents = Object.keys(configs) as AgentKey[];
  const integrations = teamIntegrations(configs);
  const factors: ComplexityFactor[] = [
    { kind: "agents", count: agents.length, points: agents.reduce((sum, a) => sum + AGENT_POINTS[AGENTS[a].complexity], 0) },
    { kind: "integrations", count: integrations.length, points: integrations.length },
  ];
  if (agents.length > 0) {
    const volume = highestVolume(configs);
    if (VOLUME_POINTS[volume] > 0) factors.push({ kind: "volume", volume, points: VOLUME_POINTS[volume] });
  }
  if (agents.some((a) => AGENTS[a].sensitivity === "high")) factors.push({ kind: "sensitive_data", points: 2 });
  if (agents.some((a) => AGENTS[a].external)) factors.push({ kind: "external_actions", points: 1 });
  if (agents.includes("workflow_coordinator")) factors.push({ kind: "coordination", points: 2 });
  if (config.deployment && DEPLOYMENT_POINTS[config.deployment] > 0) {
    factors.push({ kind: "deployment", deployment: config.deployment, points: DEPLOYMENT_POINTS[config.deployment] });
  }
  const points = factors.reduce((sum, f) => sum + f.points, 0);
  const band = COMPLEXITY_BANDS.find((b) => points >= b.min)!.band;
  return { band, points, factors };
}

export type RiskKey =
  | "personal_data"
  | "customer_facing_errors"
  | "integration_fragility"
  | "approval_bottleneck"
  | "coordination_gap"
  | "ownership_capacity"
  | "knowledge_quality"
  | "regulated_department"
  | "infrastructure_effort";

export type PrerequisiteKey =
  | "process_owner"
  | "system_access"
  | "knowledge_curation"
  | "approval_owners"
  | "test_cases"
  | "data_processing_terms"
  | "infrastructure";

export function risks(config: TeamConfig): RiskKey[] {
  const configs = agentConfigs(config);
  const agents = Object.keys(configs) as AgentKey[];
  const tasks = agents.filter((a) => AGENTS[a].role === "task");
  const out: RiskKey[] = [];
  if (agents.some((a) => AGENTS[a].sensitivity === "high")) out.push("personal_data");
  if (agents.some((a) => AGENTS[a].external)) out.push("customer_facing_errors");
  if (teamIntegrations(configs).length >= 4) out.push("integration_fragility");
  if (agents.some((a) => configs[a].checkpoint === "every_action" && VOLUMES.indexOf(configs[a].volume) >= VOLUMES.indexOf("v1k_10k"))) {
    out.push("approval_bottleneck");
  }
  if (tasks.length >= 3 && !agents.includes("workflow_coordinator")) out.push("coordination_gap");
  if (config.context.size === "s1_10" && agents.length >= 4) out.push("ownership_capacity");
  if (agents.includes("knowledge_assistant")) out.push("knowledge_quality");
  if (config.departments.includes("finance") || config.departments.includes("hr")) out.push("regulated_department");
  if (config.deployment === "on_premise") out.push("infrastructure_effort");
  return out;
}

export function prerequisites(config: TeamConfig): PrerequisiteKey[] {
  const configs = agentConfigs(config);
  const agents = Object.keys(configs) as AgentKey[];
  const out: PrerequisiteKey[] = ["process_owner"];
  if (teamIntegrations(configs).some((i) => !DATA_SOURCES.has(i))) out.push("system_access");
  if (agents.some((a) => configs[a].integrations.includes("knowledge_base"))) out.push("knowledge_curation");
  if (agents.some((a) => configs[a].checkpoint !== "none")) out.push("approval_owners");
  out.push("test_cases");
  if (agents.some((a) => AGENTS[a].sensitivity !== "low")) out.push("data_processing_terms");
  if (config.deployment === "customer_cloud" || config.deployment === "on_premise") out.push("infrastructure");
  return out;
}

/** A suggested workflow: an ordered chain of agents, with a human step where approval applies. */
export type WorkflowKey = "lead_to_meeting" | "support_resolution" | "document_intake" | "content_pipeline" | "insight_reporting" | "knowledge_answers";
export type WorkflowStep = { kind: "trigger" } | { kind: "agent"; agent: AgentKey } | { kind: "human"; checkpoint: Checkpoint } | { kind: "outcome" };

/** Workflow templates: the agent that anchors each and the chain it runs (also used by the solution builder). */
export const WORKFLOWS: { key: WorkflowKey; core: AgentKey; chain: AgentKey[] }[] = [
  { key: "lead_to_meeting", core: "lead_qualification", chain: ["lead_qualification", "sales_research", "scheduling"] },
  { key: "support_resolution", core: "customer_support", chain: ["knowledge_assistant", "customer_support"] },
  { key: "document_intake", core: "document_processing", chain: ["document_processing", "reporting_insights"] },
  { key: "content_pipeline", core: "content_operations", chain: ["content_operations"] },
  { key: "insight_reporting", core: "reporting_insights", chain: ["reporting_insights"] },
  { key: "knowledge_answers", core: "knowledge_assistant", chain: ["knowledge_assistant"] },
];

export function suggestedWorkflows(config: TeamConfig): { key: WorkflowKey; steps: WorkflowStep[] }[] {
  const configs = agentConfigs(config);
  const agents = Object.keys(configs) as AgentKey[];
  const has = (a: AgentKey) => agents.includes(a);
  const coordinated = has("workflow_coordinator");
  return WORKFLOWS.filter((w) => has(w.core))
    // Knowledge answers on their own only when they are not already part of support resolution.
    .filter((w) => !(w.key === "knowledge_answers" && has("customer_support")))
    // Reporting on its own only when it is not already the end of document intake.
    .filter((w) => !(w.key === "insight_reporting" && has("document_processing")))
    .map((w) => {
      const steps: WorkflowStep[] = [{ kind: "trigger" }];
      if (coordinated) steps.push({ kind: "agent", agent: "workflow_coordinator" });
      for (const agent of w.chain.filter(has)) {
        steps.push({ kind: "agent", agent });
        const checkpoint = configs[agent].checkpoint;
        if (checkpoint === "before_external" || checkpoint === "every_action") steps.push({ kind: "human", checkpoint });
      }
      steps.push({ kind: "outcome" });
      return { key: w.key, steps };
    });
}

export type PhaseKey = "pilot" | "expand" | "scale";

export interface RolloutPhase {
  key: PhaseKey;
  agents: AgentKey[];
  complexity: Complexity;
  /** Indicative build effort in weeks for this phase (estimate; see EFFORT_ASSUMPTIONS in content). */
  weeks: [number, number];
}

export const PHASE_WEEKS: Record<Complexity, [number, number]> = { low: [3, 5], medium: [5, 8], high: [8, 12] };

/**
 * Pilot: the most relevant task agent with the lowest complexity, plus what it requires.
 * Expand: up to two further task agents. Scale: the rest, coordination and oversight agents.
 */
export function rolloutPlan(config: TeamConfig): RolloutPhase[] {
  const agents = selectedAgents(config);
  if (agents.length === 0) return [];
  const recommended = recommendAgents(config.context, config.departments).map((r) => r.agent);
  const rank = (a: AgentKey) => {
    const index = recommended.indexOf(a);
    return index === -1 ? recommended.length : index;
  };
  const tasks = agents
    .filter((a) => AGENTS[a].role === "task")
    .sort((a, b) => AGENT_POINTS[AGENTS[a].complexity] - AGENT_POINTS[AGENTS[b].complexity] || rank(a) - rank(b) || AGENT_KEYS.indexOf(a) - AGENT_KEYS.indexOf(b));
  // Prefer a recommended agent for the pilot when one is selected; otherwise the simplest one.
  const pilotCore = [...tasks].sort((a, b) => rank(a) - rank(b) || AGENT_POINTS[AGENTS[a].complexity] - AGENT_POINTS[AGENTS[b].complexity])[0];
  const assigned = new Set<AgentKey>();
  const take = (list: AgentKey[]) => {
    const out = list.flatMap((a) => addAgent([], a)).filter((a) => agents.includes(a) && !assigned.has(a));
    for (const a of out) assigned.add(a);
    return AGENT_KEYS.filter((k) => out.includes(k));
  };
  const pilot = take(pilotCore ? [pilotCore] : []);
  const expand = take(tasks.filter((a) => !assigned.has(a)).slice(0, 2));
  const scale = take(agents.filter((a) => !assigned.has(a)));
  const phaseComplexity = (list: AgentKey[]): Complexity => {
    const points = list.reduce((sum, a) => sum + AGENT_POINTS[AGENTS[a].complexity], 0);
    return points >= 5 ? "high" : points >= 3 ? "medium" : "low";
  };
  return (
    [
      ["pilot", pilot],
      ["expand", expand],
      ["scale", scale],
    ] as const
  )
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => {
      const band = phaseComplexity(list);
      return { key, agents: list, complexity: band, weeks: PHASE_WEEKS[band] };
    });
}

/** Services the result points to. */
export function relatedServices(config: TeamConfig): ServiceKey[] {
  const configs = agentConfigs(config);
  const out: ServiceKey[] = ["ai_agents"];
  if (teamIntegrations(configs).some((i) => !DATA_SOURCES.has(i))) out.push("integrations");
  if (config.operations === "studio_managed" || config.operations === "shared") out.push("ai_managed");
  return out;
}

// ---------------------------------------------------------------------------------- architecture

export type NodeLane = "users" | "orchestration" | "agents" | "approvals" | "data" | "systems";
export const LANES: NodeLane[] = ["users", "orchestration", "agents", "approvals", "data", "systems"];

export type ArchitectureNode =
  | { id: string; lane: "users"; kind: "team" | "customers" }
  | { id: string; lane: "orchestration"; kind: "coordinator" | "router" }
  | { id: string; lane: "agents"; kind: "agent"; agent: AgentKey }
  | { id: string; lane: "approvals"; kind: "supervisor" }
  | { id: string; lane: "approvals"; kind: "approval"; agent: AgentKey; checkpoint: Checkpoint }
  | { id: string; lane: "data" | "systems"; kind: "integration"; integration: Integration };

export interface ArchitectureEdge {
  from: string;
  to: string;
  kind: "request" | "route" | "read" | "act" | "review" | "supervise";
}

/**
 * The team as a graph. Users trigger work through orchestration (the coordinator agent, or a plain
 * trigger/router when there is none); agents read shared data, and act in external systems either
 * directly or through a human approval point. The approval supervisor is not a worker: it routes the
 * approval points to the right people, so it sits with them.
 */
export function buildArchitecture(config: TeamConfig): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } {
  const configs = agentConfigs(config);
  const selected = selectedAgents(config);
  const workers = selected.filter((a) => AGENTS[a].role === "task");
  const nodes: ArchitectureNode[] = [{ id: "users:team", lane: "users", kind: "team" }];
  const edges: ArchitectureEdge[] = [];
  if (workers.some((a) => AGENTS[a].external)) nodes.push({ id: "users:customers", lane: "users", kind: "customers" });
  nodes.push({ id: "orchestration", lane: "orchestration", kind: selected.includes("workflow_coordinator") ? "coordinator" : "router" });
  for (const user of nodes.filter((n) => n.lane === "users")) edges.push({ from: user.id, to: "orchestration", kind: "request" });
  const supervised = selected.includes("approval_supervisor");
  if (supervised) nodes.push({ id: "approvals:supervisor", lane: "approvals", kind: "supervisor" });

  const integrationIds = new Set<Integration>();
  for (const agent of workers) {
    const id = `agent:${agent}`;
    nodes.push({ id, lane: "agents", kind: "agent", agent });
    edges.push({ from: "orchestration", to: id, kind: "route" });
    const checkpoint = configs[agent].checkpoint;
    let actor = id;
    if (checkpoint === "before_external" || checkpoint === "every_action") {
      const approval = `approval:${agent}`;
      nodes.push({ id: approval, lane: "approvals", kind: "approval", agent, checkpoint });
      edges.push({ from: id, to: approval, kind: "review" });
      if (supervised) edges.push({ from: "approvals:supervisor", to: approval, kind: "supervise" });
      actor = approval;
    }
    for (const integration of configs[agent].integrations) {
      integrationIds.add(integration);
      const target = `${DATA_SOURCES.has(integration) ? "data" : "systems"}:${integration}`;
      edges.push(DATA_SOURCES.has(integration) ? { from: id, to: target, kind: "read" } : { from: actor, to: target, kind: "act" });
    }
  }
  // Coordinator and supervisor notify people through their own channels (e-mail, chat), if chosen.
  for (const agent of ["workflow_coordinator", "approval_supervisor"] as const) {
    if (!selected.includes(agent)) continue;
    const from = agent === "workflow_coordinator" ? "orchestration" : "approvals:supervisor";
    for (const integration of configs[agent].integrations) {
      integrationIds.add(integration);
      edges.push({ from, to: `systems:${integration}`, kind: "act" });
    }
  }
  for (const integration of INTEGRATIONS.filter((i) => integrationIds.has(i))) {
    const lane = DATA_SOURCES.has(integration) ? "data" : "systems";
    nodes.push({ id: `${lane}:${integration}`, lane, kind: "integration", integration });
  }
  return { nodes, edges };
}

/** Ids of the nodes directly connected to `id` (for highlighting in the diagram). */
export function connectedNodes(edges: ArchitectureEdge[], id: string): Set<string> {
  const out = new Set<string>([id]);
  for (const edge of edges) {
    if (edge.from === id) out.add(edge.to);
    if (edge.to === id) out.add(edge.from);
  }
  return out;
}

// ------------------------------------------------------------------------------------- share code

/**
 * Non-personal share code for the configuration (`?t=`): enumerated values only, so it can be
 * validated strictly. The name typed for a custom department is never included.
 */
export function encodeTeam(config: TeamConfig): string {
  const configs = agentConfigs(config);
  const payload = {
    c: [config.context.industry, config.context.size, config.context.leadDepartment, config.context.challenge, config.context.volume],
    d: config.departments,
    a: config.chosen,
    g: Object.fromEntries(Object.entries(configs).map(([agent, c]) => [agent, [c.volume, c.checkpoint, c.integrations]])),
    p: [config.deployment, config.operations],
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function oneOf<T extends string>(list: readonly T[], value: unknown): T | undefined {
  return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Inverse of `encodeTeam`; null for anything malformed. Unknown values are dropped, rules re-applied. */
export function decodeTeam(code: string | null | undefined): TeamConfig | null {
  if (!code || code.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)))) as Record<string, unknown>;
    const c = Array.isArray(raw.c) ? raw.c : [];
    const context: BusinessContext = {
      industry: oneOf(INDUSTRIES, c[0]),
      size: oneOf(COMPANY_SIZES, c[1]),
      leadDepartment: oneOf(DEPARTMENTS, c[2]),
      challenge: oneOf(CHALLENGES, c[3]),
      volume: oneOf(VOLUMES, c[4]),
    };
    const departments = DEPARTMENTS.filter((d) => Array.isArray(raw.d) && raw.d.includes(d));
    const chosen = AGENT_KEYS.filter((a) => Array.isArray(raw.a) && raw.a.includes(a));
    const agents: Partial<Record<AgentKey, AgentConfig>> = {};
    const g = (raw.g && typeof raw.g === "object" ? raw.g : {}) as Record<string, unknown>;
    for (const agent of AGENT_KEYS) {
      const entry = g[agent];
      if (!Array.isArray(entry)) continue;
      const integrations = INTEGRATIONS.filter((i) => Array.isArray(entry[2]) && entry[2].includes(i));
      agents[agent] = normaliseAgentConfig(agent, {
        volume: oneOf(VOLUMES, entry[0]) ?? context.volume ?? "v100_1k",
        checkpoint: oneOf(CHECKPOINTS, entry[1]) ?? "none",
        integrations,
      });
    }
    const p = Array.isArray(raw.p) ? raw.p : [];
    const config: TeamConfig = { context, departments, chosen, agents, deployment: oneOf(DEPLOYMENTS, p[0]), operations: oneOf(OPERATIONS, p[1]) };
    return isComplete(config) ? config : null;
  } catch {
    return null;
  }
}

/** Every step answered: what the result needs. */
export function isComplete(config: TeamConfig): boolean {
  const { context } = config;
  return Boolean(
    context.industry &&
      context.size &&
      context.leadDepartment &&
      context.challenge &&
      context.volume &&
      config.departments.length > 0 &&
      selectionIssues(selectedAgents(config)).length === 0 &&
      config.deployment &&
      config.operations,
  );
}

// ------------------------------------------------------------------------------------ API shape

/** The configuration as the API expects it (snake_case context, settings only for selected agents). */
export function toApiConfig(config: TeamConfig) {
  const configs = agentConfigs(config);
  const { industry, size, leadDepartment, challenge, volume } = config.context;
  return {
    context: { industry, size, lead_department: leadDepartment, challenge, volume },
    departments: config.departments,
    chosen: config.chosen,
    agents: configs,
    deployment: config.deployment,
    operations: config.operations,
  };
}

/** Inverse of toApiConfig for a configuration loaded from the API; null when it is not complete. */
export function fromApiConfig(data: unknown): TeamConfig | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const context = (raw.context ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(list: readonly T[], value: unknown) =>
    typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;
  const agents: Partial<Record<AgentKey, AgentConfig>> = {};
  const rawAgents = (raw.agents ?? {}) as Record<string, Record<string, unknown>>;
  for (const agent of AGENT_KEYS) {
    const entry = rawAgents[agent];
    if (!entry) continue;
    agents[agent] = normaliseAgentConfig(agent, {
      volume: pick(VOLUMES, entry.volume) ?? "v100_1k",
      checkpoint: pick(CHECKPOINTS, entry.checkpoint) ?? "none",
      integrations: INTEGRATIONS.filter((i) => Array.isArray(entry.integrations) && entry.integrations.includes(i)),
    });
  }
  const config: TeamConfig = {
    context: {
      industry: pick(INDUSTRIES, context.industry),
      size: pick(COMPANY_SIZES, context.size),
      leadDepartment: pick(DEPARTMENTS, context.lead_department),
      challenge: pick(CHALLENGES, context.challenge),
      volume: pick(VOLUMES, context.volume),
    },
    departments: DEPARTMENTS.filter((d) => Array.isArray(raw.departments) && raw.departments.includes(d)),
    chosen: AGENT_KEYS.filter((a) => Array.isArray(raw.chosen) && raw.chosen.includes(a)),
    agents,
    deployment: pick(DEPLOYMENTS, raw.deployment),
    operations: pick(OPERATIONS, raw.operations),
  };
  return isComplete(config) ? config : null;
}

/** Everything derived from a configuration, in the API's shape (team.vectors.json parity). */
export function toApiTeamSummary(config: TeamConfig) {
  return {
    selected: selectedAgents(config),
    configs: agentConfigs(config),
    complexity: complexity(config),
    risks: risks(config),
    prerequisites: prerequisites(config),
    workflows: suggestedWorkflows(config),
    rollout: rolloutPlan(config).map((phase) => ({ ...phase, weeks: [...phase.weeks] })),
    services: relatedServices(config),
    architecture: buildArchitecture(config),
  };
}
