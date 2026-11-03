import type { ServiceKey } from "@/content/types";
import {
  INTEGRATION_CATEGORIES,
  type IntegrationCategory,
  LIBRARY_KEYS,
  LIBRARY_WORKFLOWS,
  type LibraryKey,
  type LibraryWorkflowKey,
  archetype,
  libraryWorkflow,
  withDependencies,
} from "@/lib/agent-library";
import { CHECKPOINTS, type Checkpoint, type Complexity, DEPLOYMENTS, type Deployment, PHASE_WEEKS, type SecurityKey } from "@/lib/ai-team";

/**
 * AI Solution Builder — a design tool (pure, deterministic, no network, nothing deployed).
 * Agents come from the agent library (lib/agent-library.ts); every derived item carries a reason.
 * The composition rules (compositionIssues) reject incompatible or unsafe designs; the API ports them
 * (apps/api/app/solution/model.py) and both are tested against the same golden vectors
 * (solution.vectors.json). Change the rules in both places and bump SOLUTION_MODEL_VERSION together.
 * Method: docs/SOLUTION_BUILDER.md.
 */

/** Share code format. "1" codes (before business rules and the library-only workflows) still decode. */
export const SOLUTION_SCHEMA_VERSION = "2";
const ACCEPTED_SCHEMAS = ["1", "2"];
/** Must equal MODEL_VERSION in apps/api/app/solution/model.py. */
export const SOLUTION_MODEL_VERSION = "2026-11.1";

export const OBJECTIVES = ["reduce_handling_time", "faster_response", "grow_revenue", "fewer_errors", "scale_capacity", "knowledge_access"] as const;
export type Objective = (typeof OBJECTIVES)[number];

/** The team workflows plus the workflows of the library-only archetypes. */
export const SOLUTION_WORKFLOWS: LibraryWorkflowKey[] = LIBRARY_WORKFLOWS.map((w) => w.key);
export type SolutionWorkflow = LibraryWorkflowKey;

/** New values are appended: the share code stores their index. */
export const CAPABILITIES = ["rag", "extraction", "classification", "generation", "decision_support", "tool_execution", "orchestration", "business_rules"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const SENSITIVITIES = ["public", "internal", "personal", "regulated"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export { INTEGRATION_CATEGORIES, type IntegrationCategory };

/** A proposed system: enumerated values only (no free text, no credentials — never). */
export interface SolutionConfig {
  objective?: Objective;
  workflow?: SolutionWorkflow;
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

/** Starting points for a workflow; the visitor can change all of them. Every default is a valid composition. */
export const WORKFLOW_DEFAULTS: Record<SolutionWorkflow, { capabilities: Capability[]; integrations: IntegrationCategory[] }> = {
  lead_to_meeting: { capabilities: ["classification", "generation", "tool_execution"], integrations: ["crm", "email_calendar"] },
  support_resolution: { capabilities: ["rag", "classification", "generation"], integrations: ["helpdesk", "document_storage"] },
  document_intake: { capabilities: ["extraction", "classification", "tool_execution"], integrations: ["document_storage", "erp"] },
  content_pipeline: { capabilities: ["rag", "generation"], integrations: ["internal_apis", "document_storage"] },
  insight_reporting: { capabilities: ["decision_support", "generation"], integrations: ["databases", "crm"] },
  knowledge_answers: { capabilities: ["rag", "generation"], integrations: ["document_storage"] },
  proposal_drafting: { capabilities: ["rag", "generation", "business_rules"], integrations: ["crm", "document_storage"] },
  catalog_enrichment: { capabilities: ["classification", "generation", "tool_execution", "business_rules"], integrations: ["erp", "document_storage"] },
};

/** Workflows whose output reaches customers, partners or the public. */
export const EXTERNAL_WORKFLOWS: ReadonlySet<SolutionWorkflow> = new Set(["lead_to_meeting", "support_resolution", "content_pipeline", "proposal_drafting", "catalog_enrichment"]);

export const TRIGGERS = ["inbound_message", "new_record", "document_upload", "schedule", "user_question"] as const;
export type Trigger = (typeof TRIGGERS)[number];

/** What starts each workflow (texts in content: components "trigger:*"). */
export const WORKFLOW_TRIGGER: Record<SolutionWorkflow, Trigger> = {
  lead_to_meeting: "new_record",
  support_resolution: "inbound_message",
  document_intake: "document_upload",
  content_pipeline: "schedule",
  insight_reporting: "schedule",
  knowledge_answers: "user_question",
  proposal_drafting: "new_record",
  catalog_enrichment: "new_record",
};

/** The capability a workflow cannot work without (it is the job of its core agent). */
export const WORKFLOW_CAPABILITY: Record<SolutionWorkflow, Capability> = {
  lead_to_meeting: "classification",
  support_resolution: "rag",
  document_intake: "extraction",
  content_pipeline: "generation",
  insight_reporting: "decision_support",
  knowledge_answers: "rag",
  proposal_drafting: "generation",
  catalog_enrichment: "generation",
};

/** Categories that can receive writes from a tool-executing agent (databases stay read-only). */
export const WRITABLE: ReadonlySet<IntegrationCategory> = new Set(["crm", "erp", "email_calendar", "helpdesk", "document_storage", "internal_apis"]);
/** Sources a knowledge index can be built from. */
const KNOWLEDGE_SOURCES: ReadonlySet<IntegrationCategory> = new Set(["document_storage", "databases", "internal_apis"]);
/** Where documents arrive from. */
const DOCUMENT_SOURCES: ReadonlySet<IntegrationCategory> = new Set(["document_storage", "email_calendar", "helpdesk"]);
/** Records a recommendation can be based on. */
const DATA_SOURCES: ReadonlySet<IntegrationCategory> = new Set(["databases", "crm", "erp"]);

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

const CAPABILITY_AGENT: Partial<Record<Capability, LibraryKey>> = {
  rag: "knowledge_assistant",
  extraction: "document_processing",
  decision_support: "reporting_insights",
  orchestration: "workflow_coordinator",
};

/** Agents of the proposed system with the reason each is there (library order). */
export function proposedAgents(config: SolutionConfig): { agent: LibraryKey; reason: AgentReason }[] {
  const reasons = new Map<LibraryKey, AgentReason>();
  const add = (agent: LibraryKey, reason: AgentReason) => {
    if (!reasons.has(agent)) reasons.set(agent, reason);
  };
  if (config.workflow) for (const agent of libraryWorkflow(config.workflow).chain) add(agent, "workflow");
  for (const capability of CAPABILITIES) {
    const agent = config.capabilities.includes(capability) ? CAPABILITY_AGENT[capability] : undefined;
    if (agent) add(agent, "capability");
  }
  for (const agent of [...reasons.keys()]) for (const dep of withDependencies([], agent)) add(dep, "dependency");
  const workers = [...reasons.keys()].filter((a) => archetype(a).role === "task");
  if ((config.approval === "before_external" || config.approval === "every_action") && workers.length >= 2) add("approval_supervisor", "approval");
  return LIBRARY_KEYS.filter((a) => reasons.has(a)).map((agent) => ({ agent, reason: reasons.get(agent)! }));
}

/** Task agents of a design (what a coordinator would coordinate). */
const taskAgents = (config: SolutionConfig) => proposedAgents(config).filter(({ agent }) => archetype(agent).role === "task");

// ------------------------------------------------------------------------------- composition rules

/**
 * Rules a composition must pass before a plan is generated. Each one rejects a design that cannot
 * work (a capability with nothing to work on) or that is unsafe (approval below the floor, regulated
 * data without EU/EEA residency). They never change the design; the visitor fixes it.
 */
export const COMPOSITION_RULES = [
  "workflow_capability",
  "orchestration_needs_agents",
  "rag_needs_source",
  "extraction_needs_documents",
  "decision_support_needs_data",
  "tool_execution_needs_target",
  "regulated_needs_residency",
  "approval_below_minimum",
] as const;
export type CompositionRule = (typeof COMPOSITION_RULES)[number];

export type SolutionStep = "objective" | "workflow" | "capabilities" | "integrations" | "security";
export const SOLUTION_STEPS: SolutionStep[] = ["objective", "workflow", "capabilities", "integrations", "security"];

/** The step where the visitor fixes each rule. */
export const RULE_STEP: Record<CompositionRule, SolutionStep> = {
  workflow_capability: "capabilities",
  orchestration_needs_agents: "capabilities",
  rag_needs_source: "integrations",
  extraction_needs_documents: "integrations",
  decision_support_needs_data: "integrations",
  tool_execution_needs_target: "integrations",
  regulated_needs_residency: "security",
  approval_below_minimum: "security",
};

/** Broken composition rules (rule order). Works on the raw configuration, so a tampered approval is reported, not raised. */
export function compositionIssues(config: SolutionConfig): CompositionRule[] {
  const caps = new Set(config.capabilities);
  const ints = config.integrations;
  const any = (set: ReadonlySet<IntegrationCategory>) => ints.some((i) => set.has(i));
  const broken: Record<CompositionRule, boolean> = {
    workflow_capability: Boolean(config.workflow) && !caps.has(WORKFLOW_CAPABILITY[config.workflow!]),
    orchestration_needs_agents: caps.has("orchestration") && taskAgents(config).length < 2,
    rag_needs_source: caps.has("rag") && !any(KNOWLEDGE_SOURCES),
    extraction_needs_documents: caps.has("extraction") && !any(DOCUMENT_SOURCES),
    decision_support_needs_data: caps.has("decision_support") && !any(DATA_SOURCES),
    tool_execution_needs_target: caps.has("tool_execution") && !any(WRITABLE),
    regulated_needs_residency: config.sensitivity === "regulated" && !config.residency,
    approval_below_minimum: Boolean(config.approval) && CHECKPOINTS.indexOf(config.approval!) < CHECKPOINTS.indexOf(minimumApproval(config).checkpoint),
  };
  return COMPOSITION_RULES.filter((rule) => broken[rule]);
}

/** Required inputs and composition rules of one step (keys map to content errors / composition texts). */
export function stepIssues(config: SolutionConfig, step: SolutionStep): string[] {
  const required = (() => {
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
  })();
  return [...required, ...compositionIssues(config).filter((rule) => RULE_STEP[rule] === step)];
}

export function isComplete(config: SolutionConfig): boolean {
  return SOLUTION_STEPS.every((step) => stepIssues(config, step).length === 0);
}

// ------------------------------------------------------------------------------- architecture

/** The reference flow: trigger → input → orchestration → AI and rules → human review → output, with monitoring across it. */
export const STAGES = ["trigger", "input", "orchestration", "ai_rules", "review", "output", "monitoring"] as const;
export type Stage = (typeof STAGES)[number];

export type ComponentKey =
  | `trigger:${Trigger}`
  | "input:vector_index"
  | "input:data_access"
  | `input:${IntegrationCategory}`
  | "orchestration:coordinator"
  | "orchestration:workflow_engine"
  | `agent:${LibraryKey}`
  | "rules:output_validation"
  | "rules:business_rules"
  | "rules:redaction"
  | "review:gate"
  | "review:sample_review"
  | `output:${SolutionWorkflow}`
  | `action:${IntegrationCategory}`
  | "monitoring:audit_log"
  | "monitoring:quality"
  | "monitoring:cost";

/** Where a person is involved: "before" = approves before it takes effect, "sample" = reviews a sample afterwards. */
export type HumanApproval = "before" | "sample";

export interface ArchitectureComponent {
  key: ComponentKey;
  stage: Stage;
  /** For connectors and actions: read or read and write. */
  access?: "read" | "read_write";
  approval?: HumanApproval;
}

const gated = (c: SolutionConfig) => c.approval === "before_external" || c.approval === "every_action";

/** A reference architecture — a description of components, never a running system. */
export function architecture(config: SolutionConfig): ArchitectureComponent[] {
  const c = normaliseSolution(config);
  const out: ArchitectureComponent[] = [];
  const writes = c.capabilities.includes("tool_execution");
  const human: HumanApproval | undefined = gated(c) ? "before" : c.approval === "sample_review" ? "sample" : undefined;

  if (c.workflow) out.push({ key: `trigger:${WORKFLOW_TRIGGER[c.workflow]}`, stage: "trigger" });
  if (c.capabilities.includes("rag")) out.push({ key: "input:vector_index", stage: "input" });
  if (c.integrations.some((i) => i === "databases" || i === "document_storage")) out.push({ key: "input:data_access", stage: "input" });
  for (const integration of c.integrations) {
    out.push({ key: `input:${integration}`, stage: "input", access: writes && WRITABLE.has(integration) ? "read_write" : "read" });
  }
  out.push({ key: c.capabilities.includes("orchestration") ? "orchestration:coordinator" : "orchestration:workflow_engine", stage: "orchestration" });
  for (const { agent } of proposedAgents(c)) {
    if (agent !== "workflow_coordinator") out.push({ key: `agent:${agent}`, stage: "ai_rules" });
  }
  if (c.redaction) out.push({ key: "rules:redaction", stage: "ai_rules" });
  if (c.capabilities.includes("business_rules")) out.push({ key: "rules:business_rules", stage: "ai_rules" });
  out.push({ key: "rules:output_validation", stage: "ai_rules" });
  if (gated(c)) out.push({ key: "review:gate", stage: "review", approval: "before" });
  else if (c.approval === "sample_review") out.push({ key: "review:sample_review", stage: "review", approval: "sample" });
  if (c.workflow) {
    // Output for people outside the company waits for approval at the gate; with "every action" all output does.
    const external = EXTERNAL_WORKFLOWS.has(c.workflow);
    const approval = c.approval === "every_action" || (gated(c) && external) ? "before" : c.approval === "sample_review" ? "sample" : undefined;
    out.push({ key: `output:${c.workflow}`, stage: "output", approval });
  }
  if (writes) {
    for (const integration of c.integrations.filter((i) => WRITABLE.has(i))) {
      out.push({ key: `action:${integration}`, stage: "output", access: "read_write", approval: human });
    }
  }
  out.push({ key: "monitoring:audit_log", stage: "monitoring" }, { key: "monitoring:quality", stage: "monitoring" }, { key: "monitoring:cost", stage: "monitoring" });
  return out;
}

/** Every component a person approves or reviews, in flow order. */
export function humanApprovalPoints(config: SolutionConfig): ArchitectureComponent[] {
  return architecture(config).filter((c) => c.approval);
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
  business_rules: 1,
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

/** Workflows that read content written by people outside the company. */
const UNTRUSTED_INPUT: ReadonlySet<SolutionWorkflow> = new Set(["support_resolution", "document_intake", "lead_to_meeting", "catalog_enrichment"]);

/** Security considerations (keys and texts shared with the AI team plan). */
export function securityConsiderations(config: SolutionConfig): SecurityKey[] {
  const c = normaliseSolution(config);
  const out: SecurityKey[] = ["least_privilege", "secrets", "audit_log", "provider_terms"];
  if (c.sensitivity === "personal" || c.sensitivity === "regulated") out.push("personal_data");
  if (c.workflow && UNTRUSTED_INPUT.has(c.workflow)) out.push("untrusted_input");
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
    .filter((comp) => comp.stage === "input" && comp.access)
    .map((comp) => {
      const category = comp.key.slice("input:".length) as IntegrationCategory;
      return {
        category,
        access: comp.access!,
        auth: OAUTH.has(category) ? "oauth" : "service_account",
        gated: comp.access === "read_write" && gated(c),
      };
    });
}

export type PhaseKey = "discovery" | "pilot" | "integrate" | "operate";

export interface SolutionPhase {
  key: PhaseKey;
  /** Indicative weeks; null for the ongoing operate phase. */
  weeks: [number, number] | null;
  agents: LibraryKey[];
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
  const core = c.workflow ? libraryWorkflow(c.workflow).core : agents[0];
  const pilotAgents = core ? withDependencies([], core) : [];
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
  if (c.capabilities.includes("tool_execution") || c.capabilities.includes("business_rules")) out.push("automation");
  if (c.capabilities.includes("rag") || c.capabilities.includes("generation")) out.push("ai_tools");
  out.push("ai_managed");
  if (c.sensitivity === "regulated" || assessComplexity(c).band === "high") out.push("audit");
  return out;
}

// ------------------------------------------------------------------------------- share code

const pick = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;

/** Versioned, enumerated share code (`?s=`): `2.<objective>.<workflow>.<caps>.<integrations>.<sensitivity>.<approval>.<deployment>.<flags>`. */
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

/** The configuration a code describes, before any rule is applied (null when it is malformed). */
export function parseSolutionCode(code: string | null | undefined): SolutionConfig | null {
  if (!code || code.length > 200) return null;
  const parts = code.split(".");
  if (parts.length !== 9 || !ACCEPTED_SCHEMAS.includes(parts[0]) || !/^[01]{2}$/.test(parts[8])) return null;
  const fromIdx = <T extends string>(list: readonly T[], raw: string): T[] | null => {
    if (raw === "-") return [];
    if (!/^\d+$/.test(raw)) return null;
    const values = [...raw].map((d) => list[Number(d)]);
    return values.every(Boolean) && new Set(values).size === values.length ? values : null;
  };
  const capabilities = fromIdx(CAPABILITIES, parts[3]);
  const integrations = fromIdx(INTEGRATION_CATEGORIES, parts[4]);
  if (!capabilities || !integrations) return null;
  const fields: [string, readonly string[]][] = [
    [parts[1], OBJECTIVES],
    [parts[2], SOLUTION_WORKFLOWS],
    [parts[5], SENSITIVITIES],
    [parts[6], CHECKPOINTS],
    [parts[7], DEPLOYMENTS],
  ];
  if (fields.some(([value, list]) => value !== "" && !list.includes(value))) return null;
  return {
    objective: pick(OBJECTIVES, parts[1]),
    workflow: pick(SOLUTION_WORKFLOWS, parts[2]),
    capabilities,
    integrations,
    sensitivity: pick(SENSITIVITIES, parts[5]),
    approval: pick(CHECKPOINTS, parts[6]),
    deployment: pick(DEPLOYMENTS, parts[7]),
    residency: parts[8][0] === "1",
    redaction: parts[8][1] === "1",
  };
}

/** A complete design that passes every composition rule, or null (malformed, incomplete, incompatible or unsafe). */
export function decodeSolution(code: string | null | undefined): SolutionConfig | null {
  const raw = parseSolutionCode(code);
  if (!raw || compositionIssues(raw).length > 0) return null;
  const config = normaliseSolution(raw);
  return isComplete(config) ? config : null;
}
