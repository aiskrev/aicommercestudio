import type { ServiceKey } from "@/content/types";
import { INTEGRATION_CATEGORIES, type IntegrationCategory } from "@/lib/agent-library";
import {
  AGENTS,
  AGENT_KEYS,
  type AgentKey,
  CHECKPOINTS,
  type Checkpoint,
  type Complexity,
  DEPLOYMENTS,
  type Deployment,
  PHASE_WEEKS,
  type SecurityKey,
  WORKFLOWS,
  type WorkflowKey,
  addAgent,
} from "@/lib/ai-team";

/**
 * AI Solution Builder — a design tool (pure, deterministic, no network, nothing deployed).
 * Agents come from the shared library (lib/ai-team.ts → lib/agent-library.ts); every derived item
 * carries a reason. Method: docs/SOLUTION_BUILDER.md.
 */

export const SOLUTION_SCHEMA_VERSION = "1";
export const SOLUTION_MODEL_VERSION = "2026-10.1";

export const OBJECTIVES = ["reduce_handling_time", "faster_response", "grow_revenue", "fewer_errors", "scale_capacity", "knowledge_access"] as const;
export type Objective = (typeof OBJECTIVES)[number];

/** The workflow templates of the team model. */
export const SOLUTION_WORKFLOWS: WorkflowKey[] = WORKFLOWS.map((w) => w.key);

export const CAPABILITIES = ["rag", "extraction", "classification", "generation", "decision_support", "tool_execution", "orchestration"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const SENSITIVITIES = ["public", "internal", "personal", "regulated"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export { INTEGRATION_CATEGORIES, type IntegrationCategory };

/** A proposed system: enumerated values only (no free text, no credentials — never). */
export interface SolutionConfig {
  objective?: Objective;
  workflow?: WorkflowKey;
  capabilities: Capability[];
  integrations: IntegrationCategory[];
  sensitivity?: Sensitivity;
  approval?: Checkpoint;
  deployment?: Deployment;
  /** Data must stay in the EU/EEA. */
  residency: boolean;
  /** Mask personal data before it reaches a model (forced on for personal/regulated data). */
  redaction: boolean;
}

export const EMPTY_SOLUTION: SolutionConfig = { capabilities: [], integrations: [], residency: false, redaction: false };

// ------------------------------------------------------------------------------- suggestions

/** Starting points for a workflow; the visitor can change all of them. */
export const WORKFLOW_DEFAULTS: Record<WorkflowKey, { capabilities: Capability[]; integrations: IntegrationCategory[] }> = {
  lead_to_meeting: { capabilities: ["classification", "generation", "tool_execution"], integrations: ["crm", "email_calendar"] },
  support_resolution: { capabilities: ["rag", "classification", "generation"], integrations: ["helpdesk", "document_storage"] },
  document_intake: { capabilities: ["extraction", "classification", "tool_execution"], integrations: ["document_storage", "erp"] },
  content_pipeline: { capabilities: ["rag", "generation"], integrations: ["internal_apis", "document_storage"] },
  insight_reporting: { capabilities: ["decision_support", "generation"], integrations: ["databases", "crm"] },
  knowledge_answers: { capabilities: ["rag", "generation"], integrations: ["document_storage"] },
};

/** Workflows whose output reaches customers or partners. */
export const EXTERNAL_WORKFLOWS: ReadonlySet<WorkflowKey> = new Set(["lead_to_meeting", "support_resolution", "content_pipeline"]);

/** What starts each workflow and what it produces (texts in content: triggers / outputs). */
export const WORKFLOW_TRIGGER: Record<WorkflowKey, "inbound_message" | "new_record" | "document_upload" | "schedule" | "user_question"> = {
  lead_to_meeting: "new_record",
  support_resolution: "inbound_message",
  document_intake: "document_upload",
  content_pipeline: "schedule",
  insight_reporting: "schedule",
  knowledge_answers: "user_question",
};

// ------------------------------------------------------------------------------- validation

export type SolutionStep = "objective" | "workflow" | "capabilities" | "integrations" | "security";
export const SOLUTION_STEPS: SolutionStep[] = ["objective", "workflow", "capabilities", "integrations", "security"];

export function stepIssues(config: SolutionConfig, step: SolutionStep): string[] {
  switch (step) {
    case "objective":
      return config.objective ? [] : ["objective"];
    case "workflow":
      return config.workflow ? [] : ["workflow"];
    case "capabilities":
      return config.capabilities.length > 0 ? [] : ["capabilities"];
    case "integrations":
      return [];
    case "security":
      return [!config.sensitivity && "sensitivity", !config.approval && "approval", !config.deployment && "deployment"].filter(Boolean) as string[];
  }
}

export function isComplete(config: SolutionConfig): boolean {
  return SOLUTION_STEPS.every((step) => stepIssues(config, step).length === 0);
}

// ------------------------------------------------------------------------------- approval

export type ApprovalReason = "default" | "personal_data" | "external_output" | "tool_execution" | "regulated_actions";

/** Lowest approval checkpoint the design allows, and why. */
export function minimumApproval(config: SolutionConfig): { checkpoint: Checkpoint; reasons: ApprovalReason[] } {
  let checkpoint: Checkpoint = "none";
  const reasons: ApprovalReason[] = [];
  const raise = (to: Checkpoint, reason: ApprovalReason) => {
    if (CHECKPOINTS.indexOf(to) > CHECKPOINTS.indexOf(checkpoint)) checkpoint = to;
    reasons.push(reason);
  };
  raise("sample_review", "default");
  if (config.sensitivity === "personal" || config.sensitivity === "regulated") raise("sample_review", "personal_data");
  if (config.workflow && EXTERNAL_WORKFLOWS.has(config.workflow) && config.capabilities.includes("generation")) raise("before_external", "external_output");
  if (config.capabilities.includes("tool_execution")) raise("before_external", "tool_execution");
  if (config.sensitivity === "regulated" && config.capabilities.includes("tool_execution")) raise("every_action", "regulated_actions");
  return { checkpoint, reasons };
}

export function allowedApprovals(config: SolutionConfig): Checkpoint[] {
  return CHECKPOINTS.slice(CHECKPOINTS.indexOf(minimumApproval(config).checkpoint));
}

/** Personal or regulated data must be masked before it reaches a model. */
export const redactionRequired = (config: SolutionConfig) => config.sensitivity === "personal" || config.sensitivity === "regulated";

/** The configuration with the rules applied (approval floor, forced redaction, known values only, fixed order). */
export function normaliseSolution(config: SolutionConfig): SolutionConfig {
  const capabilities = CAPABILITIES.filter((c) => config.capabilities.includes(c));
  const integrations = INTEGRATION_CATEGORIES.filter((i) => config.integrations.includes(i));
  const base = { ...config, capabilities, integrations };
  const floor = minimumApproval(base).checkpoint;
  const approval = config.approval && CHECKPOINTS.indexOf(config.approval) >= CHECKPOINTS.indexOf(floor) ? config.approval : config.approval ? floor : undefined;
  return { ...base, approval, redaction: config.redaction || redactionRequired(base) };
}

// ------------------------------------------------------------------------------- agents

export type AgentReason = "workflow" | "capability" | "dependency" | "approval";

const CAPABILITY_AGENT: Partial<Record<Capability, AgentKey>> = {
  rag: "knowledge_assistant",
  extraction: "document_processing",
  decision_support: "reporting_insights",
  orchestration: "workflow_coordinator",
};

/** Agents of the proposed system with the reason each is there (library order). */
export function proposedAgents(config: SolutionConfig): { agent: AgentKey; reason: AgentReason }[] {
  const reasons = new Map<AgentKey, AgentReason>();
  const add = (agent: AgentKey, reason: AgentReason) => {
    if (!reasons.has(agent)) reasons.set(agent, reason);
  };
  if (config.workflow) for (const agent of WORKFLOWS.find((w) => w.key === config.workflow)!.chain) add(agent, "workflow");
  for (const capability of config.capabilities) {
    const agent = CAPABILITY_AGENT[capability];
    if (agent) add(agent, "capability");
  }
  for (const agent of [...reasons.keys()]) for (const dep of addAgent([], agent)) add(dep, "dependency");
  const workers = [...reasons.keys()].filter((a) => AGENTS[a].role === "task");
  if ((config.approval === "before_external" || config.approval === "every_action") && workers.length >= 2) add("approval_supervisor", "approval");
  return AGENT_KEYS.filter((a) => reasons.has(a)).map((agent) => ({ agent, reason: reasons.get(agent)! }));
}

// ------------------------------------------------------------------------------- architecture

export const LAYERS = ["trigger", "orchestration", "agents", "retrieval", "tools", "approval", "outputs", "monitoring"] as const;
export type Layer = (typeof LAYERS)[number];

export type ComponentKey =
  | `trigger:${(typeof WORKFLOW_TRIGGER)[WorkflowKey]}`
  | "orchestration:coordinator"
  | "orchestration:workflow_engine"
  | `agent:${AgentKey}`
  | "retrieval:vector_index"
  | "retrieval:data_access"
  | `tool:${IntegrationCategory}`
  | "approval:gate"
  | "approval:sample_review"
  | `output:${WorkflowKey}`
  | "monitoring:audit_log"
  | "monitoring:quality"
  | "monitoring:cost";

export interface ArchitectureComponent {
  key: ComponentKey;
  layer: Layer;
  /** For tools: read or read and write. */
  access?: "read" | "read_write";
}

/** Categories that can receive writes from a tool-executing agent (databases stay read-only). */
export const WRITABLE: ReadonlySet<IntegrationCategory> = new Set(["crm", "erp", "email_calendar", "helpdesk", "document_storage", "internal_apis"]);

export function architecture(config: SolutionConfig): ArchitectureComponent[] {
  const c = normaliseSolution(config);
  const out: ArchitectureComponent[] = [];
  if (c.workflow) out.push({ key: `trigger:${WORKFLOW_TRIGGER[c.workflow]}`, layer: "trigger" });
  out.push({ key: c.capabilities.includes("orchestration") ? "orchestration:coordinator" : "orchestration:workflow_engine", layer: "orchestration" });
  for (const { agent } of proposedAgents(c)) {
    if (agent !== "workflow_coordinator") out.push({ key: `agent:${agent}`, layer: "agents" });
  }
  if (c.capabilities.includes("rag")) out.push({ key: "retrieval:vector_index", layer: "retrieval" });
  if (c.integrations.some((i) => i === "databases" || i === "document_storage")) out.push({ key: "retrieval:data_access", layer: "retrieval" });
  const writes = c.capabilities.includes("tool_execution");
  for (const integration of c.integrations) {
    out.push({ key: `tool:${integration}`, layer: "tools", access: writes && WRITABLE.has(integration) ? "read_write" : "read" });
  }
  if (c.approval === "before_external" || c.approval === "every_action") out.push({ key: "approval:gate", layer: "approval" });
  else if (c.approval === "sample_review") out.push({ key: "approval:sample_review", layer: "approval" });
  if (c.workflow) out.push({ key: `output:${c.workflow}`, layer: "outputs" });
  out.push({ key: "monitoring:audit_log", layer: "monitoring" }, { key: "monitoring:quality", layer: "monitoring" }, { key: "monitoring:cost", layer: "monitoring" });
  return out;
}

// ------------------------------------------------------------------------------- assessment

export type ComplexityFactor =
  | { kind: "capability"; capability: Capability; points: number }
  | { kind: "integration"; integration: IntegrationCategory; points: number }
  | { kind: "sensitivity"; sensitivity: Sensitivity; points: number }
  | { kind: "approval"; points: number }
  | { kind: "deployment"; deployment: Deployment; points: number };

export const CAPABILITY_POINTS: Record<Capability, number> = {
  rag: 2,
  extraction: 2,
  classification: 1,
  generation: 1,
  decision_support: 2,
  tool_execution: 3,
  orchestration: 3,
};
export const INTEGRATION_POINTS: Record<IntegrationCategory, number> = {
  crm: 1,
  erp: 3,
  email_calendar: 1,
  helpdesk: 1,
  databases: 2,
  document_storage: 1,
  internal_apis: 3,
};
const SENSITIVITY_POINTS: Record<Sensitivity, number> = { public: 0, internal: 0, personal: 2, regulated: 3 };
const DEPLOYMENT_POINTS: Record<Deployment, number> = { managed_cloud: 0, customer_cloud: 1, on_premise: 3 };
/** Inclusive lower bounds on the total points. */
export const SOLUTION_BANDS: { band: Complexity; min: number }[] = [
  { band: "high", min: 15 },
  { band: "medium", min: 8 },
  { band: "low", min: 0 },
];

export function assessComplexity(config: SolutionConfig): { band: Complexity; points: number; factors: ComplexityFactor[] } {
  const c = normaliseSolution(config);
  const factors: ComplexityFactor[] = [
    ...c.capabilities.map((capability) => ({ kind: "capability" as const, capability, points: CAPABILITY_POINTS[capability] })),
    ...c.integrations.map((integration) => ({ kind: "integration" as const, integration, points: INTEGRATION_POINTS[integration] })),
  ];
  if (c.sensitivity && SENSITIVITY_POINTS[c.sensitivity] > 0) factors.push({ kind: "sensitivity", sensitivity: c.sensitivity, points: SENSITIVITY_POINTS[c.sensitivity] });
  if (c.approval === "every_action") factors.push({ kind: "approval", points: 1 });
  if (c.deployment && DEPLOYMENT_POINTS[c.deployment] > 0) factors.push({ kind: "deployment", deployment: c.deployment, points: DEPLOYMENT_POINTS[c.deployment] });
  const points = factors.reduce((sum, f) => sum + f.points, 0);
  return { band: SOLUTION_BANDS.find((b) => points >= b.min)!.band, points, factors };
}

/** Security considerations (keys and texts shared with the AI team plan). */
export function securityConsiderations(config: SolutionConfig): SecurityKey[] {
  const c = normaliseSolution(config);
  const out: SecurityKey[] = ["least_privilege", "secrets", "audit_log", "provider_terms"];
  if (c.sensitivity === "personal" || c.sensitivity === "regulated") out.push("personal_data");
  if (c.workflow && ["support_resolution", "document_intake", "lead_to_meeting"].includes(c.workflow)) out.push("untrusted_input");
  if (c.capabilities.includes("tool_execution") || (c.workflow && EXTERNAL_WORKFLOWS.has(c.workflow))) out.push("external_actions");
  if (c.capabilities.includes("rag")) out.push("document_permissions");
  if (c.sensitivity === "regulated") out.push("regulated_data");
  out.push("data_location");
  return out;
}

export interface IntegrationRequirement {
  category: IntegrationCategory;
  access: "read" | "read_write";
  auth: "oauth" | "service_account";
  /** Writes go through the approval gate. */
  gated: boolean;
}

const OAUTH: ReadonlySet<IntegrationCategory> = new Set(["crm", "email_calendar", "helpdesk"]);

export function integrationRequirements(config: SolutionConfig): IntegrationRequirement[] {
  const c = normaliseSolution(config);
  return architecture(c)
    .filter((comp) => comp.layer === "tools")
    .map((comp) => {
      const category = comp.key.slice("tool:".length) as IntegrationCategory;
      return {
        category,
        access: comp.access!,
        auth: OAUTH.has(category) ? "oauth" : "service_account",
        gated: comp.access === "read_write" && (c.approval === "before_external" || c.approval === "every_action"),
      };
    });
}

export type PhaseKey = "discovery" | "pilot" | "integrate" | "operate";

export interface SolutionPhase {
  key: PhaseKey;
  /** Indicative weeks; null for the ongoing operate phase. */
  weeks: [number, number] | null;
  agents: AgentKey[];
  integrations: IntegrationCategory[];
}

/**
 * Discovery (1–2 weeks); a read-only pilot of the workflow's core agent with every action approved;
 * integration of write access and the remaining systems (only when there is something to add);
 * then ongoing operation with monitoring.
 */
export function roadmap(config: SolutionConfig): SolutionPhase[] {
  const c = normaliseSolution(config);
  const agents = proposedAgents(c).map((a) => a.agent);
  const band = assessComplexity(c).band;
  const core = c.workflow ? WORKFLOWS.find((w) => w.key === c.workflow)!.core : agents[0];
  const pilotAgents = core ? addAgent([], core) : [];
  const readIntegrations = c.integrations.slice(0, 2);
  const rest = agents.filter((a) => !pilotAgents.includes(a));
  const restIntegrations = c.integrations.filter((i) => !readIntegrations.includes(i));
  const phases: SolutionPhase[] = [
    { key: "discovery", weeks: [1, 2], agents: [], integrations: [] },
    { key: "pilot", weeks: PHASE_WEEKS[band === "high" ? "medium" : band], agents: pilotAgents, integrations: readIntegrations },
  ];
  if (rest.length > 0 || restIntegrations.length > 0 || c.capabilities.includes("tool_execution")) {
    phases.push({ key: "integrate", weeks: PHASE_WEEKS[band], agents: rest, integrations: restIntegrations });
  }
  phases.push({ key: "operate", weeks: null, agents: [], integrations: [] });
  return phases;
}

export function relatedServices(config: SolutionConfig): ServiceKey[] {
  const c = normaliseSolution(config);
  const out: ServiceKey[] = ["ai_agents"];
  if (c.integrations.length > 0) out.push("integrations");
  if (c.capabilities.includes("tool_execution")) out.push("automation");
  if (c.capabilities.includes("rag") || c.capabilities.includes("generation")) out.push("ai_tools");
  out.push("ai_managed");
  if (c.sensitivity === "regulated" || assessComplexity(c).band === "high") out.push("audit");
  return out;
}

// ------------------------------------------------------------------------------- share code

const pick = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;

/** Versioned, enumerated share code (`?s=`): `1.<objective>.<workflow>.<caps>.<integrations>.<sensitivity>.<approval>.<deployment>.<flags>`. */
export function encodeSolution(config: SolutionConfig): string {
  const c = normaliseSolution(config);
  const idx = <T extends string>(list: readonly T[], values: T[]) => values.map((v) => list.indexOf(v)).join("") || "-";
  return [
    SOLUTION_SCHEMA_VERSION,
    c.objective ?? "",
    c.workflow ?? "",
    idx(CAPABILITIES, c.capabilities),
    idx(INTEGRATION_CATEGORIES, c.integrations),
    c.sensitivity ?? "",
    c.approval ?? "",
    c.deployment ?? "",
    `${c.residency ? 1 : 0}${c.redaction ? 1 : 0}`,
  ].join(".");
}

export function decodeSolution(code: string | null | undefined): SolutionConfig | null {
  if (!code || code.length > 200) return null;
  const parts = code.split(".");
  if (parts.length !== 9 || parts[0] !== SOLUTION_SCHEMA_VERSION || !/^[01]{2}$/.test(parts[8])) return null;
  const fromIdx = <T extends string>(list: readonly T[], raw: string): T[] | null => {
    if (raw === "-") return [];
    if (!/^\d+$/.test(raw)) return null;
    const values = [...raw].map((d) => list[Number(d)]);
    return values.every(Boolean) ? values : null;
  };
  const capabilities = fromIdx(CAPABILITIES, parts[3]);
  const integrations = fromIdx(INTEGRATION_CATEGORIES, parts[4]);
  if (!capabilities || !integrations) return null;
  const config = normaliseSolution({
    objective: pick(OBJECTIVES, parts[1]),
    workflow: pick(SOLUTION_WORKFLOWS, parts[2]),
    capabilities,
    integrations,
    sensitivity: pick(SENSITIVITIES, parts[5]),
    approval: pick(CHECKPOINTS, parts[6]),
    deployment: pick(DEPLOYMENTS, parts[7]),
    residency: parts[8][0] === "1",
    redaction: parts[8][1] === "1",
  });
  return isComplete(config) ? config : null;
}
