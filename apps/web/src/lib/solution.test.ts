import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { CHECKPOINTS } from "@/lib/ai-team";
import {
  CAPABILITIES,
  EMPTY_SOLUTION,
  INTEGRATION_CATEGORIES,
  LAYERS,
  OBJECTIVES,
  SENSITIVITIES,
  SOLUTION_STEPS,
  SOLUTION_WORKFLOWS,
  type SolutionConfig,
  WORKFLOW_DEFAULTS,
  WORKFLOW_TRIGGER,
  allowedApprovals,
  architecture,
  assessComplexity,
  decodeSolution,
  encodeSolution,
  integrationRequirements,
  isComplete,
  minimumApproval,
  normaliseSolution,
  proposedAgents,
  relatedServices,
  roadmap,
  securityConsiderations,
  stepIssues,
} from "@/lib/solution";

/** Customer support with retrieval, personal data, sample review requested. */
const SUPPORT: SolutionConfig = {
  ...EMPTY_SOLUTION,
  objective: "faster_response",
  workflow: "support_resolution",
  ...WORKFLOW_DEFAULTS.support_resolution,
  sensitivity: "personal",
  approval: "sample_review",
  deployment: "managed_cloud",
};

/** Regulated document intake that writes to systems, on premises. */
const INTAKE: SolutionConfig = {
  ...EMPTY_SOLUTION,
  objective: "fewer_errors",
  workflow: "document_intake",
  ...WORKFLOW_DEFAULTS.document_intake,
  sensitivity: "regulated",
  approval: "sample_review",
  deployment: "on_premise",
  residency: true,
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
    expect(stepIssues({ ...SUPPORT, integrations: [] }, "integrations")).toEqual([]); // integrations are optional
    expect(isComplete(SUPPORT)).toBe(true);
    expect(isComplete({ ...SUPPORT, capabilities: [] })).toBe(false);
  });

  it("offers suggested capabilities and integrations for every workflow", () => {
    for (const workflow of SOLUTION_WORKFLOWS) {
      expect(WORKFLOW_DEFAULTS[workflow].capabilities.length).toBeGreaterThan(0);
      expect(WORKFLOW_TRIGGER[workflow]).toBeTruthy();
    }
  });

  it("raises the approval floor for external output, tool execution and regulated actions", () => {
    expect(minimumApproval({ ...EMPTY_SOLUTION, workflow: "knowledge_answers", capabilities: ["rag", "generation"], sensitivity: "internal" })).toEqual({
      checkpoint: "sample_review",
      reasons: ["default"],
    });
    expect(minimumApproval(SUPPORT)).toEqual({ checkpoint: "before_external", reasons: ["default", "personal_data", "external_output"] });
    expect(minimumApproval(INTAKE)).toEqual({ checkpoint: "every_action", reasons: ["default", "personal_data", "tool_execution", "regulated_actions"] });
    expect(allowedApprovals(SUPPORT)).toEqual(["before_external", "every_action"]);
    for (const config of [SUPPORT, INTAKE, EMPTY_SOLUTION]) expect(allowedApprovals(config)).not.toContain("none");
  });

  it("normalises: approval floor, forced redaction, known values in a fixed order", () => {
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

describe("proposed architecture", () => {
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
  });

  it("builds every layer in order, with the coordinator as orchestration rather than an agent", () => {
    const keys = architecture(SUPPORT).map((c) => c.key);
    expect(keys).toEqual([
      "trigger:inbound_message",
      "orchestration:workflow_engine",
      "agent:customer_support",
      "agent:knowledge_assistant",
      "agent:approval_supervisor",
      "retrieval:vector_index",
      "retrieval:data_access",
      "tool:helpdesk",
      "tool:document_storage",
      "approval:gate",
      "output:support_resolution",
      "monitoring:audit_log",
      "monitoring:quality",
      "monitoring:cost",
    ]);
    const layers = architecture(SUPPORT).map((c) => LAYERS.indexOf(c.layer));
    expect(layers).toEqual([...layers].sort((a, b) => a - b));
    const orchestrated = architecture({ ...SUPPORT, capabilities: [...SUPPORT.capabilities, "orchestration"] }).map((c) => c.key);
    expect(orchestrated).toContain("orchestration:coordinator");
    expect(orchestrated).not.toContain("agent:workflow_coordinator");
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
    const simple = roadmap({ ...EMPTY_SOLUTION, workflow: "knowledge_answers", capabilities: ["rag"], integrations: ["document_storage"], sensitivity: "internal", approval: "sample_review", deployment: "managed_cloud" });
    expect(simple.map((p) => p.key)).toEqual(["discovery", "pilot", "operate"]);
  });

  it("links related services by rule", () => {
    expect(relatedServices(SUPPORT)).toEqual(["ai_agents", "integrations", "ai_tools", "ai_managed"]);
    expect(relatedServices(INTAKE)).toEqual(["ai_agents", "integrations", "automation", "ai_managed", "audit"]);
  });

  it("is deterministic: the same choices in any order give the same result", () => {
    const shuffled = { ...SUPPORT, capabilities: [...SUPPORT.capabilities].reverse(), integrations: [...SUPPORT.integrations].reverse() };
    for (const fn of [architecture, proposedAgents, assessComplexity, roadmap, relatedServices, integrationRequirements, securityConsiderations] as const) {
      expect(fn(shuffled as SolutionConfig)).toEqual(fn(SUPPORT));
    }
  });
});

describe("share code", () => {
  it("encodes only enumerated values, versioned", () => {
    const code = encodeSolution(SUPPORT);
    expect(code).toBe("1.faster_response.support_resolution.023.35.personal.before_external.managed_cloud.01");
    expect(encodeSolution(INTAKE)).toMatch(/^[a-z0-9_.-]+$/);
  });

  it("round-trips complete configurations", () => {
    for (const config of [SUPPORT, INTAKE, { ...SUPPORT, integrations: [] }]) {
      expect(decodeSolution(encodeSolution(config))).toEqual(normaliseSolution(config));
    }
  });

  it("rejects malformed, incomplete or foreign codes", () => {
    const valid = encodeSolution(SUPPORT);
    for (const bad of [
      null,
      "",
      valid.replace(/^1\./, "2."),
      valid.replace(".023.", ".09."),
      valid.replace(".023.", ".-."),
      valid.replace(".faster_response.", ".unknown."),
      valid.replace(/\.01$/, ".2"),
      `${valid}.extra`,
      "x".repeat(300),
    ]) {
      expect(decodeSolution(bad)).toBeNull();
    }
  });

  it("re-applies the rules to a hand-edited code (approval below the floor is raised)", () => {
    const edited = encodeSolution(SUPPORT).replace(".before_external.", ".none.");
    expect(decodeSolution(edited)?.approval).toBe("before_external");
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

  it("names every option and every fixed component", () => {
    for (const locale of ["bg", "en"] as const) {
      const t = getContent(locale).solutionTool;
      for (const o of OBJECTIVES) expect(t.objectives[o].kpi).toBeTruthy();
      for (const c of CAPABILITIES) expect(t.capabilities[c].title).toBeTruthy();
      for (const s of SENSITIVITIES) expect(t.security.sensitivity.options[s].title).toBeTruthy();
      for (const l of LAYERS) expect(t.layers[l]).toBeTruthy();
      const fixed = SOLUTION_WORKFLOWS.flatMap((workflow) =>
        CHECKPOINTS.flatMap((approval) => architecture({ ...SUPPORT, workflow, approval, capabilities: [...CAPABILITIES], integrations: [...INTEGRATION_CATEGORIES] })),
      )
        .map((c) => c.key)
        .filter((key) => !/^(agent|tool|output):/.test(key));
      for (const key of new Set(fixed)) expect(t.components[key as keyof typeof t.components]?.title, key).toBeTruthy();
    }
  });
});
