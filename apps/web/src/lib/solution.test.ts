import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { CHECKPOINTS } from "@/lib/ai-team";
import {
  CAPABILITIES,
  COMPOSITION_RULES,
  EMPTY_SOLUTION,
  INTEGRATION_CATEGORIES,
  OBJECTIVES,
  RULE_STEP,
  SENSITIVITIES,
  SOLUTION_STEPS,
  SOLUTION_WORKFLOWS,
  STAGES,
  type SolutionConfig,
  WORKFLOW_CAPABILITY,
  WORKFLOW_DEFAULTS,
  WORKFLOW_TRIGGER,
  allowedApprovals,
  architecture,
  assessComplexity,
  compositionIssues,
  decodeSolution,
  encodeSolution,
  humanApprovalPoints,
  integrationRequirements,
  isComplete,
  minimumApproval,
  normaliseSolution,
  parseSolutionCode,
  proposedAgents,
  relatedServices,
  roadmap,
  securityConsiderations,
  stepIssues,
} from "@/lib/solution";

/** Customer support with retrieval and personal data, approved before replies go out. */
const SUPPORT: SolutionConfig = {
  ...EMPTY_SOLUTION,
  objective: "faster_response",
  workflow: "support_resolution",
  ...WORKFLOW_DEFAULTS.support_resolution,
  sensitivity: "personal",
  approval: "before_external",
  deployment: "managed_cloud",
};

/** Regulated document intake that writes to systems, on premises. */
const INTAKE: SolutionConfig = {
  ...EMPTY_SOLUTION,
  objective: "fewer_errors",
  workflow: "document_intake",
  ...WORKFLOW_DEFAULTS.document_intake,
  sensitivity: "regulated",
  approval: "every_action",
  deployment: "on_premise",
  residency: true,
};

/** Internal knowledge answers, sample review. */
const KNOWLEDGE: SolutionConfig = {
  ...EMPTY_SOLUTION,
  objective: "knowledge_access",
  workflow: "knowledge_answers",
  capabilities: ["rag"],
  integrations: ["document_storage"],
  sensitivity: "internal",
  approval: "sample_review",
  deployment: "managed_cloud",
};

describe("solution configuration", () => {
  it("validates every input step", () => {
    expect(SOLUTION_STEPS.flatMap((step) => stepIssues(EMPTY_SOLUTION, step))).toEqual([
      "objective",
      "workflow",
      "capabilities",
      "sensitivity",
      "approval",
      "deployment",
    ]);
    expect(stepIssues({ ...KNOWLEDGE, capabilities: ["generation"], workflow: "content_pipeline", integrations: [] }, "integrations")).toEqual([]); // integrations are optional
    expect(isComplete(SUPPORT)).toBe(true);
    expect(isComplete({ ...SUPPORT, capabilities: [] })).toBe(false);
  });

  it("offers suggested capabilities and integrations for every workflow, each a valid composition", () => {
    expect(SOLUTION_WORKFLOWS).toEqual([
      "lead_to_meeting",
      "support_resolution",
      "document_intake",
      "content_pipeline",
      "insight_reporting",
      "knowledge_answers",
      "proposal_drafting",
      "catalog_enrichment",
    ]);
    for (const workflow of SOLUTION_WORKFLOWS) {
      expect(WORKFLOW_DEFAULTS[workflow].capabilities).toContain(WORKFLOW_CAPABILITY[workflow]);
      expect(WORKFLOW_TRIGGER[workflow]).toBeTruthy();
      const config = { ...KNOWLEDGE, workflow, ...WORKFLOW_DEFAULTS[workflow], approval: "every_action" as const };
      expect(compositionIssues(config), workflow).toEqual([]);
    }
  });

  it("raises the approval floor for external output, tool execution and regulated actions", () => {
    expect(minimumApproval({ ...EMPTY_SOLUTION, workflow: "knowledge_answers", capabilities: ["rag", "generation"], sensitivity: "internal" })).toEqual({
      checkpoint: "sample_review",
      reasons: ["default"],
    });
    expect(minimumApproval(SUPPORT)).toEqual({ checkpoint: "before_external", reasons: ["default", "personal_data", "external_output"] });
    expect(minimumApproval(INTAKE)).toEqual({ checkpoint: "every_action", reasons: ["default", "personal_data", "tool_execution", "regulated_actions"] });
    expect(minimumApproval({ ...KNOWLEDGE, workflow: "proposal_drafting", ...WORKFLOW_DEFAULTS.proposal_drafting }).checkpoint).toBe("before_external");
    expect(allowedApprovals(SUPPORT)).toEqual(["before_external", "every_action"]);
    for (const config of [SUPPORT, INTAKE, EMPTY_SOLUTION]) expect(allowedApprovals(config)).not.toContain("none");
  });

  it("normalises: approval floor, forced redaction, known values in a fixed order", () => {
    expect(normaliseSolution({ ...SUPPORT, approval: "sample_review" }).approval).toBe("before_external");
    const n = normaliseSolution({ ...SUPPORT, capabilities: ["generation", "rag", "classification"], integrations: ["document_storage", "helpdesk"] });
    expect(n.approval).toBe("before_external");
    expect(n.redaction).toBe(true);
    expect(n.capabilities).toEqual(["rag", "classification", "generation"]);
    expect(n.integrations).toEqual(["helpdesk", "document_storage"]);
    expect(normaliseSolution({ ...SUPPORT, approval: "every_action" }).approval).toBe("every_action");
    expect(normaliseSolution({ ...SUPPORT, approval: undefined }).approval).toBeUndefined();
    expect(normaliseSolution({ ...SUPPORT, sensitivity: "internal" }).redaction).toBe(false);
  });
});

describe("composition rules", () => {
  const broken: [SolutionConfig, string][] = [
    [{ ...KNOWLEDGE, capabilities: ["generation"] }, "workflow_capability"],
    [{ ...KNOWLEDGE, capabilities: ["rag", "orchestration"] }, "orchestration_needs_agents"],
    [{ ...KNOWLEDGE, integrations: ["crm"] }, "rag_needs_source"],
    [{ ...INTAKE, integrations: ["erp"] }, "extraction_needs_documents"],
    [{ ...KNOWLEDGE, workflow: "insight_reporting", capabilities: ["decision_support"], integrations: ["document_storage"] }, "decision_support_needs_data"],
    [{ ...KNOWLEDGE, workflow: "insight_reporting", capabilities: ["decision_support", "tool_execution"], integrations: ["databases"], approval: "before_external" }, "tool_execution_needs_target"],
    [{ ...INTAKE, residency: false }, "regulated_needs_residency"],
    [{ ...SUPPORT, approval: "sample_review" }, "approval_below_minimum"],
  ];

  it("rejects each incompatible or unsafe composition with its own rule", () => {
    expect(broken.map(([, rule]) => rule)).toEqual([...COMPOSITION_RULES]);
    for (const [config, rule] of broken) expect(compositionIssues(config), rule).toEqual([rule]);
  });

  it("databases are not a writable target, but any other system is", () => {
    expect(compositionIssues({ ...INTAKE, integrations: ["document_storage"] })).toEqual([]);
    expect(compositionIssues({ ...INTAKE, integrations: ["document_storage", "databases"] })).toEqual([]);
  });

  it("orchestration is accepted once there are two task agents to coordinate", () => {
    expect(compositionIssues({ ...SUPPORT, approval: "before_external", capabilities: [...SUPPORT.capabilities, "orchestration"] })).toEqual([]);
  });

  it("reports each rule on the step where the visitor fixes it, and blocks completion", () => {
    for (const [config, rule] of broken) {
      expect(stepIssues(config, RULE_STEP[rule as (typeof COMPOSITION_RULES)[number]])).toContain(rule);
      expect(isComplete(config)).toBe(false);
    }
    expect(stepIssues({ ...KNOWLEDGE, integrations: ["crm"] }, "capabilities")).toEqual([]);
  });

  it("reports several broken rules in rule order", () => {
    const config: SolutionConfig = { ...KNOWLEDGE, sensitivity: "regulated", capabilities: ["tool_execution", "orchestration"], integrations: ["databases"], approval: "every_action" };
    expect(compositionIssues(config)).toEqual([
      "workflow_capability",
      "orchestration_needs_agents",
      "tool_execution_needs_target",
      "regulated_needs_residency",
    ]);
  });
});

describe("reference architecture", () => {
  it("proposes agents from the workflow, capabilities, dependencies and approval, with reasons", () => {
    expect(proposedAgents(normaliseSolution(SUPPORT))).toEqual([
      { agent: "customer_support", reason: "workflow" },
      { agent: "knowledge_assistant", reason: "workflow" },
      { agent: "approval_supervisor", reason: "approval" },
    ]);
    expect(proposedAgents({ ...EMPTY_SOLUTION, workflow: "content_pipeline", capabilities: ["rag", "generation", "orchestration"], approval: "sample_review" })).toEqual([
      { agent: "content_operations", reason: "workflow" },
      { agent: "knowledge_assistant", reason: "capability" },
      { agent: "workflow_coordinator", reason: "capability" },
    ]);
    expect(proposedAgents({ ...KNOWLEDGE, workflow: "proposal_drafting", ...WORKFLOW_DEFAULTS.proposal_drafting, approval: "before_external" })).toEqual([
      { agent: "sales_research", reason: "workflow" },
      { agent: "proposal_generation", reason: "workflow" },
      { agent: "knowledge_assistant", reason: "capability" },
      { agent: "approval_supervisor", reason: "approval" },
    ]);
  });

  it("builds trigger → input → orchestration → AI and rules → review → output, with monitoring", () => {
    const components = architecture(SUPPORT);
    expect(components.map((c) => c.key)).toEqual([
      "trigger:inbound_message",
      "input:vector_index",
      "input:data_access",
      "input:helpdesk",
      "input:document_storage",
      "orchestration:workflow_engine",
      "agent:customer_support",
      "agent:knowledge_assistant",
      "agent:approval_supervisor",
      "rules:redaction",
      "rules:output_validation",
      "review:gate",
      "output:support_resolution",
      "monitoring:audit_log",
      "monitoring:quality",
      "monitoring:cost",
    ]);
    const stages = components.map((c) => STAGES.indexOf(c.stage));
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
    expect(STAGES).toEqual(["trigger", "input", "orchestration", "ai_rules", "review", "output", "monitoring"]);
    const orchestrated = architecture({ ...SUPPORT, capabilities: [...SUPPORT.capabilities, "orchestration"] }).map((c) => c.key);
    expect(orchestrated).toContain("orchestration:coordinator");
    expect(orchestrated).not.toContain("agent:workflow_coordinator");
    expect(architecture({ ...KNOWLEDGE, workflow: "proposal_drafting", ...WORKFLOW_DEFAULTS.proposal_drafting }).map((c) => c.key)).toContain("rules:business_rules");
  });

  it("always validates model output with deterministic rules", () => {
    for (const workflow of SOLUTION_WORKFLOWS) {
      expect(architecture({ ...KNOWLEDGE, workflow, ...WORKFLOW_DEFAULTS[workflow] }).map((c) => c.key)).toContain("rules:output_validation");
    }
  });

  it("shows where a person approves: the gate, external output and every write action", () => {
    expect(humanApprovalPoints(SUPPORT).map((c) => [c.key, c.approval])).toEqual([
      ["review:gate", "before"],
      ["output:support_resolution", "before"],
    ]);
    expect(humanApprovalPoints(INTAKE).map((c) => [c.key, c.approval])).toEqual([
      ["review:gate", "before"],
      ["output:document_intake", "before"],
      ["action:erp", "before"],
      ["action:document_storage", "before"],
    ]);
    // Internal output behind an "approve before external actions" gate: only the writes wait for a person.
    const internal = humanApprovalPoints({ ...INTAKE, sensitivity: "internal", approval: "before_external" }).map((c) => c.key);
    expect(internal).toEqual(["review:gate", "action:erp", "action:document_storage"]);
    expect(humanApprovalPoints(KNOWLEDGE).map((c) => [c.key, c.approval])).toEqual([
      ["review:sample_review", "sample"],
      ["output:knowledge_answers", "sample"],
    ]);
  });

  it("grants write access only with tool execution, never to databases, and gates it behind approval", () => {
    expect(integrationRequirements(SUPPORT)).toEqual([
      { category: "helpdesk", access: "read", auth: "oauth", gated: false },
      { category: "document_storage", access: "read", auth: "service_account", gated: false },
    ]);
    expect(integrationRequirements({ ...INTAKE, integrations: ["erp", "databases", "document_storage"] })).toEqual([
      { category: "erp", access: "read_write", auth: "service_account", gated: true },
      { category: "databases", access: "read", auth: "service_account", gated: false },
      { category: "document_storage", access: "read_write", auth: "service_account", gated: true },
    ]);
    expect(architecture({ ...INTAKE, integrations: ["erp", "databases"] }).map((c) => c.key)).not.toContain("action:databases");
  });

  it("lists security considerations from the shared team texts", () => {
    expect(securityConsiderations(SUPPORT)).toEqual([
      "least_privilege",
      "secrets",
      "audit_log",
      "provider_terms",
      "personal_data",
      "untrusted_input",
      "external_actions",
      "document_permissions",
      "data_location",
    ]);
    expect(securityConsiderations(INTAKE)).toContain("regulated_data");
    const texts = getContent("en").teamTool.security.items;
    for (const key of [...securityConsiderations(SUPPORT), ...securityConsiderations(INTAKE)]) expect(texts[key].title).toBeTruthy();
  });
});

describe("complexity, roadmap and services", () => {
  it("adds up explainable points with fixed band boundaries (8 → medium, 15 → high)", () => {
    expect(assessComplexity(SUPPORT)).toMatchObject({ band: "medium", points: 8 });
    expect(assessComplexity({ ...SUPPORT, capabilities: ["rag", "generation"] })).toMatchObject({ band: "low", points: 7 });
    const intake = assessComplexity(INTAKE);
    expect(intake).toMatchObject({ band: "high", points: 17 });
    expect(intake.factors.reduce((sum, f) => sum + f.points, 0)).toBe(17);
    expect(intake.factors.map((f) => f.kind)).toEqual(["capability", "capability", "capability", "integration", "integration", "sensitivity", "approval", "deployment"]);
    expect(assessComplexity({ ...INTAKE, deployment: "customer_cloud" })).toMatchObject({ band: "high", points: 15 });
    expect(assessComplexity({ ...INTAKE, deployment: "managed_cloud" })).toMatchObject({ band: "medium", points: 14 });
    expect(assessComplexity({ ...KNOWLEDGE, capabilities: ["rag", "business_rules"] }).points).toBe(4);
  });

  it("phases the work: discovery, a read-only pilot of the core agent, integration, operation", () => {
    expect(roadmap(SUPPORT)).toEqual([
      { key: "discovery", weeks: [1, 2], agents: [], integrations: [] },
      { key: "pilot", weeks: [5, 8], agents: ["customer_support", "knowledge_assistant"], integrations: ["helpdesk", "document_storage"] },
      { key: "integrate", weeks: [5, 8], agents: ["approval_supervisor"], integrations: [] },
      { key: "operate", weeks: null, agents: [], integrations: [] },
    ]);
    const intake = roadmap(INTAKE);
    expect(intake.find((p) => p.key === "pilot")!.weeks).toEqual([5, 8]); // pilots are capped at the medium range
    expect(intake.find((p) => p.key === "integrate")!.weeks).toEqual([8, 12]);
    expect(roadmap(KNOWLEDGE).map((p) => p.key)).toEqual(["discovery", "pilot", "operate"]);
    expect(roadmap({ ...KNOWLEDGE, workflow: "catalog_enrichment", ...WORKFLOW_DEFAULTS.catalog_enrichment, approval: "before_external" })[1].agents).toEqual(["catalog_assistant"]);
  });

  it("links related services by rule", () => {
    expect(relatedServices(SUPPORT)).toEqual(["ai_agents", "integrations", "ai_tools", "ai_managed"]);
    expect(relatedServices(INTAKE)).toEqual(["ai_agents", "integrations", "automation", "ai_managed", "audit"]);
  });

  it("is deterministic: the same choices in any order give the same result", () => {
    const shuffled = { ...SUPPORT, capabilities: [...SUPPORT.capabilities].reverse(), integrations: [...SUPPORT.integrations].reverse() };
    for (const fn of [architecture, proposedAgents, assessComplexity, roadmap, relatedServices, integrationRequirements, securityConsiderations, compositionIssues, humanApprovalPoints] as const) {
      expect(fn(shuffled as SolutionConfig)).toEqual(fn(SUPPORT));
    }
  });
});

describe("share code", () => {
  it("encodes only enumerated values, versioned", () => {
    const code = encodeSolution(SUPPORT);
    expect(code).toBe("2.faster_response.support_resolution.023.35.personal.before_external.managed_cloud.01");
    expect(encodeSolution(INTAKE)).toMatch(/^[a-z0-9_.-]+$/);
  });

  it("round-trips complete, valid configurations", () => {
    for (const config of [SUPPORT, INTAKE, KNOWLEDGE, { ...KNOWLEDGE, workflow: "catalog_enrichment" as const, ...WORKFLOW_DEFAULTS.catalog_enrichment, approval: "before_external" as const }]) {
      expect(decodeSolution(encodeSolution(config))).toEqual(normaliseSolution(config));
    }
  });

  it("still opens links shared before schema 2", () => {
    expect(decodeSolution("1.faster_response.support_resolution.023.35.personal.before_external.managed_cloud.01")).toEqual(normaliseSolution(SUPPORT));
  });

  it("rejects malformed, incomplete or foreign codes", () => {
    const valid = encodeSolution(SUPPORT);
    for (const bad of [
      null,
      "",
      valid.replace(/^2\./, "3."),
      valid.replace(".023.", ".09."),
      valid.replace(".023.", ".0023."),
      valid.replace(".023.", ".-."),
      valid.replace(".faster_response.", ".unknown."),
      valid.replace(".managed_cloud.", ".somewhere."),
      valid.replace(/\.01$/, ".2"),
      `${valid}.extra`,
      "x".repeat(300),
    ]) {
      expect(decodeSolution(bad)).toBeNull();
    }
  });

  it("rejects incompatible or unsafe designs instead of repairing them", () => {
    const tampered = encodeSolution(SUPPORT).replace(".before_external.", ".none.");
    expect(parseSolutionCode(tampered)?.approval).toBe("none");
    expect(compositionIssues(parseSolutionCode(tampered)!)).toEqual(["approval_below_minimum"]);
    expect(decodeSolution(tampered)).toBeNull();
    expect(decodeSolution(encodeSolution({ ...INTAKE, residency: false }))).toBeNull();
    expect(decodeSolution(encodeSolution({ ...KNOWLEDGE, integrations: [] }))).toBeNull();
  });
});

describe("solution builder texts", () => {
  const keysOf = (value: unknown, prefix = ""): string[] =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value).flatMap(([k, v]) => [`${prefix}${k}`, ...keysOf(v, `${prefix}${k}.`)])
      : [];

  it("has the same structure in Bulgarian and English", () => {
    expect(keysOf(getContent("en").solutionTool)).toEqual(keysOf(getContent("bg").solutionTool));
    expect(keysOf(getContent("en").agentLibrary)).toEqual(keysOf(getContent("bg").agentLibrary));
  });

  it("names every option, stage, rule and fixed component", () => {
    const dynamic = new RegExp(`^(agent|output|action):|^input:(${INTEGRATION_CATEGORIES.join("|")})$`);
    for (const locale of ["bg", "en"] as const) {
      const t = getContent(locale).solutionTool;
      for (const o of OBJECTIVES) expect(t.objectives[o].kpi).toBeTruthy();
      for (const c of CAPABILITIES) expect(t.capabilities[c].title).toBeTruthy();
      for (const s of SENSITIVITIES) expect(t.security.sensitivity.options[s].title).toBeTruthy();
      for (const s of STAGES) expect(t.stages[s]).toBeTruthy();
      for (const rule of COMPOSITION_RULES) expect(t.composition[rule]).toBeTruthy();
      const fixed = SOLUTION_WORKFLOWS.flatMap((workflow) =>
        CHECKPOINTS.flatMap((approval) => architecture({ ...SUPPORT, workflow, approval, capabilities: [...CAPABILITIES], integrations: [...INTEGRATION_CATEGORIES] })),
      )
        .map((c) => c.key)
        .filter((key) => !dynamic.test(key));
      for (const key of new Set(fixed)) expect(t.components[key as keyof typeof t.components]?.title, key).toBeTruthy();
    }
  });
});
