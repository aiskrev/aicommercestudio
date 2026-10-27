import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { locales } from "@/i18n/config";
import {
  AGENTS,
  AGENT_KEYS,
  type AgentKey,
  CHALLENGES,
  CHECKPOINTS,
  DATA_SOURCES,
  DEPARTMENTS,
  INTEGRATIONS,
  type TeamConfig,
  addAgent,
  addedAsDependency,
  agentConfigs,
  allowedCheckpoints,
  buildArchitecture,
  complexity,
  connectedNodes,
  decodeTeam,
  encodeTeam,
  isComplete,
  minimumCheckpoint,
  normaliseAgentConfig,
  prerequisites,
  recommendAgents,
  relatedServices,
  removeAgent,
  requiredBy,
  risks,
  rolloutPlan,
  selectedAgents,
  selectionIssues,
  suggestedWorkflows,
  teamSuggestions,
} from "@/lib/ai-team";

function team(chosen: AgentKey[], overrides: Partial<TeamConfig> = {}): TeamConfig {
  return {
    context: { industry: "ecommerce", size: "s11_50", leadDepartment: "support", challenge: "slow_response", volume: "v100_1k" },
    departments: ["support"],
    chosen,
    agents: {},
    deployment: "managed_cloud",
    operations: "shared",
    ...overrides,
  };
}

describe("agent library", () => {
  it("is consistent: dependencies exist, no agent requires itself, no cycles", () => {
    for (const key of AGENT_KEYS) {
      const agent = AGENTS[key];
      expect(agent.key).toBe(key);
      for (const dep of [...agent.requires, ...agent.pairsWith]) {
        expect(AGENT_KEYS).toContain(dep);
        expect(dep).not.toBe(key);
      }
      for (const integration of [...agent.integrations, ...agent.optionalIntegrations]) expect(INTEGRATIONS).toContain(integration);
      // Transitive closure never comes back to the agent.
      expect(addAgent([], key).filter((k) => AGENTS[k].requires.includes(key))).toEqual([]);
    }
  });

  it.each(locales)("has complete texts in %s for every agent, integration and option", (locale) => {
    const { teamTool } = getContent(locale);
    for (const key of AGENT_KEYS) {
      const text = teamTool.agents[key];
      for (const field of [text.name, text.short, text.purpose, text.oversight, text.sensitivityNote]) expect(field.trim()).not.toBe("");
      expect(text.inputs.length).toBeGreaterThan(0);
      expect(text.outputs.length).toBeGreaterThan(0);
    }
    for (const integration of INTEGRATIONS) expect(teamTool.integrations[integration]).toBeTruthy();
    for (const challenge of CHALLENGES) expect(teamTool.context.challenge.options[challenge]).toBeTruthy();
    for (const department of DEPARTMENTS) expect(teamTool.departments.options[department].title).toBeTruthy();
    for (const checkpoint of CHECKPOINTS) expect(teamTool.checkpoints[checkpoint].title).toBeTruthy();
  });

  it("uses distinct agent names per locale", () => {
    for (const locale of locales) {
      const names = AGENT_KEYS.map((k) => getContent(locale).teamTool.agents[k].name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("recommendations", () => {
  it("puts the challenge's agents first and explains every recommendation", () => {
    const result = recommendAgents({ challenge: "lead_followup" }, ["sales", "support"]);
    expect(result.slice(0, 2).map((r) => r.agent)).toEqual(["lead_qualification", "scheduling"]);
    expect(result[0].reasons).toEqual([
      { kind: "challenge", challenge: "lead_followup" },
      { kind: "department", department: "sales" },
    ]);
    expect(result.map((r) => r.agent)).toContain("customer_support");
    for (const r of result) expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("recommends nothing for an unknown custom department without a challenge", () => {
    expect(recommendAgents({}, ["custom"])).toEqual([]);
  });

  it("suggests coordination and oversight only when the team needs them", () => {
    expect(teamSuggestions(["lead_qualification"])).toEqual([]);
    expect(teamSuggestions(["customer_support", "knowledge_assistant"])).toEqual([
      { agent: "approval_supervisor", reasons: [{ kind: "sensitive_external" }] },
    ]);
    const big = teamSuggestions(["lead_qualification", "sales_research", "scheduling"]).map((s) => s.agent);
    expect(big).toEqual(["workflow_coordinator", "approval_supervisor"]);
    expect(teamSuggestions(["lead_qualification", "sales_research", "scheduling", "workflow_coordinator", "approval_supervisor"])).toEqual([]);
  });
});

describe("selection and dependency rules", () => {
  it("adds required agents automatically, in library order", () => {
    expect(addAgent([], "customer_support")).toEqual(["customer_support", "knowledge_assistant"]);
    expect(addAgent(["scheduling"], "customer_support")).toEqual(["customer_support", "knowledge_assistant", "scheduling"]);
    expect(addAgent(["knowledge_assistant"], "knowledge_assistant")).toEqual(["knowledge_assistant"]);
  });

  it("blocks removing an agent another selected agent requires", () => {
    const selected = addAgent([], "customer_support");
    expect(requiredBy(selected, "knowledge_assistant")).toEqual(["customer_support"]);
    expect(removeAgent(selected, "knowledge_assistant")).toBe(selected);
    expect(removeAgent(selected, "customer_support")).toEqual(["knowledge_assistant"]);
  });

  it("derives the team from the chosen agents and marks automatic additions", () => {
    expect(selectedAgents({ chosen: ["customer_support"] })).toEqual(["customer_support", "knowledge_assistant"]);
    expect(addedAsDependency(["customer_support", "knowledge_assistant"], ["customer_support"])).toEqual(["knowledge_assistant"]);
    expect(addedAsDependency(["customer_support", "knowledge_assistant"], ["customer_support", "knowledge_assistant"])).toEqual([]);
    // Dropping the dependent drops the automatic dependency with it.
    expect(selectedAgents({ chosen: [] })).toEqual([]);
  });

  it("requires a task agent and enough work for a coordinator", () => {
    expect(selectionIssues([])).toEqual([{ kind: "no_task_agent" }]);
    expect(selectionIssues(["workflow_coordinator"])).toEqual([
      { kind: "no_task_agent" },
      { kind: "coordinator_needs_agents", have: 0, need: 2 },
    ]);
    expect(selectionIssues(["workflow_coordinator", "scheduling"])).toEqual([{ kind: "coordinator_needs_agents", have: 1, need: 2 }]);
    expect(selectionIssues(["workflow_coordinator", "scheduling", "sales_research"])).toEqual([]);
    expect(selectionIssues(["approval_supervisor"])).toEqual([{ kind: "no_task_agent" }]);
  });
});

describe("human approval rules", () => {
  it("raises the minimum for external actions and keeps the role minimum otherwise", () => {
    expect(minimumCheckpoint("customer_support")).toEqual({ checkpoint: "before_external", reason: "external" });
    expect(minimumCheckpoint("content_operations")).toEqual({ checkpoint: "before_external", reason: "external" });
    expect(minimumCheckpoint("scheduling")).toEqual({ checkpoint: "before_external", reason: "external" });
    expect(minimumCheckpoint("document_processing")).toEqual({ checkpoint: "sample_review", reason: "role" });
    expect(minimumCheckpoint("approval_supervisor")).toEqual({ checkpoint: "every_action", reason: "role" });
    expect(allowedCheckpoints("customer_support")).toEqual(["before_external", "every_action"]);
    expect(allowedCheckpoints("sales_research")).toEqual(["sample_review", "before_external", "every_action"]);
  });

  it("normalises a configuration: checkpoint floor, required integrations kept, unknown ones dropped", () => {
    const config = normaliseAgentConfig("customer_support", { volume: "v_gt10k", checkpoint: "none", integrations: ["email", "erp"] });
    expect(config).toEqual({ volume: "v_gt10k", checkpoint: "before_external", integrations: ["email", "helpdesk", "knowledge_base"] });
  });

  it("defaults every selected agent to the context volume and its minimum checkpoint", () => {
    const configs = agentConfigs(team(["customer_support"]));
    expect(Object.keys(configs)).toEqual(["customer_support", "knowledge_assistant"]);
    expect(configs.customer_support).toEqual({ volume: "v100_1k", checkpoint: "before_external", integrations: ["helpdesk", "knowledge_base"] });
  });
});

describe("results", () => {
  it("adds up complexity points with every factor listed", () => {
    const result = complexity(team(["customer_support"]));
    // support 2 + knowledge 2, helpdesk + knowledge base 2, volume 1, sensitive 2, external 1.
    expect(result.points).toBe(10);
    expect(result.band).toBe("medium");
    expect(result.factors.map((f) => f.kind)).toEqual(["agents", "integrations", "volume", "sensitive_data", "external_actions"]);

    expect(complexity(team(["sales_research"], { context: { volume: "v_lt100" } })).band).toBe("low");
    const large = complexity(
      team(["lead_qualification", "sales_research", "customer_support", "document_processing", "workflow_coordinator"], {
        deployment: "on_premise",
      }),
    );
    expect(large.band).toBe("high");
    expect(large.factors).toContainEqual({ kind: "deployment", deployment: "on_premise", points: 3 });
    expect(large.factors).toContainEqual({ kind: "coordination", points: 2 });
  });

  it("lists risks and prerequisites from explicit conditions", () => {
    expect(risks(team(["sales_research"]))).toEqual([]);
    expect(risks(team(["customer_support"]))).toEqual(["personal_data", "customer_facing_errors", "knowledge_quality"]);
    const busy = team(["document_processing"], { agents: { document_processing: { volume: "v1k_10k", checkpoint: "every_action", integrations: [] } } });
    expect(risks(busy)).toContain("approval_bottleneck");
    const small = team(["lead_qualification", "sales_research", "scheduling", "reporting_insights"], {
      context: { size: "s1_10" },
      departments: ["finance"],
      deployment: "on_premise",
    });
    expect(risks(small)).toEqual(expect.arrayContaining(["coordination_gap", "ownership_capacity", "regulated_department", "infrastructure_effort"]));

    expect(prerequisites(team(["sales_research"]))).toEqual(["process_owner", "system_access", "approval_owners", "test_cases"]);
    expect(prerequisites(team(["customer_support"], { deployment: "customer_cloud" }))).toEqual([
      "process_owner",
      "system_access",
      "knowledge_curation",
      "approval_owners",
      "test_cases",
      "data_processing_terms",
      "infrastructure",
    ]);
  });

  it("builds workflows from the selected agents with human steps where approval applies", () => {
    const flows = suggestedWorkflows(team(["customer_support"]));
    expect(flows.map((f) => f.key)).toEqual(["support_resolution"]);
    expect(flows[0].steps).toEqual([
      { kind: "trigger" },
      { kind: "agent", agent: "knowledge_assistant" },
      { kind: "agent", agent: "customer_support" },
      { kind: "human", checkpoint: "before_external" },
      { kind: "outcome" },
    ]);
    const coordinated = suggestedWorkflows(team(["lead_qualification", "scheduling", "workflow_coordinator"]));
    expect(coordinated[0].key).toBe("lead_to_meeting");
    expect(coordinated[0].steps.slice(0, 3)).toEqual([
      { kind: "trigger" },
      { kind: "agent", agent: "workflow_coordinator" },
      { kind: "agent", agent: "lead_qualification" },
    ]);
    expect(suggestedWorkflows(team(["knowledge_assistant"])).map((f) => f.key)).toEqual(["knowledge_answers"]);
    expect(suggestedWorkflows(team(["document_processing", "reporting_insights"])).map((f) => f.key)).toEqual(["document_intake"]);
  });

  it("plans a pilot with the most relevant simple agent and coordination last", () => {
    const plan = rolloutPlan(
      team(["customer_support", "lead_qualification", "scheduling", "reporting_insights", "workflow_coordinator", "approval_supervisor"]),
    );
    expect(plan.map((p) => p.key)).toEqual(["pilot", "expand", "scale"]);
    // slow_response → customer support is the most relevant; it brings its dependency.
    expect(plan[0].agents).toEqual(["customer_support", "knowledge_assistant"]);
    expect(plan[2].agents).toEqual(expect.arrayContaining(["workflow_coordinator", "approval_supervisor"]));
    const all = plan.flatMap((p) => p.agents);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(selectedAgents(team(["customer_support", "lead_qualification", "scheduling", "reporting_insights", "workflow_coordinator", "approval_supervisor"])).sort());
    for (const phase of plan) expect(phase.weeks[0]).toBeLessThan(phase.weeks[1]);
    expect(rolloutPlan(team([]))).toEqual([]);
  });

  it("links the services that match the team", () => {
    expect(relatedServices(team(["sales_research"], { operations: "internal" }))).toEqual(["ai_agents", "integrations"]);
    expect(relatedServices(team(["knowledge_assistant"], { operations: "studio_managed" }))).toEqual(["ai_agents", "ai_managed"]);
  });
});

describe("architecture graph", () => {
  it("routes users through orchestration to agents, approvals, data and systems", () => {
    const { nodes, edges } = buildArchitecture(team(["customer_support", "sales_research"]));
    const ids = nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(["users:team", "users:customers", "orchestration", "agent:customer_support", "approval:customer_support", "data:knowledge_base", "systems:helpdesk"]));
    expect(nodes.find((n) => n.id === "orchestration")).toMatchObject({ kind: "router" });
    // Sample review needs no approval node; the agent acts directly.
    expect(ids).not.toContain("approval:sales_research");
    expect(edges).toContainEqual({ from: "agent:sales_research", to: "systems:crm", kind: "act" });
    // External actions of the support agent go through the approval point.
    expect(edges).toContainEqual({ from: "approval:customer_support", to: "systems:helpdesk", kind: "act" });
    expect(edges).toContainEqual({ from: "agent:customer_support", to: "data:knowledge_base", kind: "read" });
    for (const node of nodes.filter((n) => n.kind === "integration")) {
      expect(node.lane).toBe(DATA_SOURCES.has((node as { integration: (typeof INTEGRATIONS)[number] }).integration) ? "data" : "systems");
    }
  });

  it("uses the coordinator as orchestration and connects the supervisor to every approval point", () => {
    const { nodes, edges } = buildArchitecture(team(["customer_support", "scheduling", "workflow_coordinator", "approval_supervisor"]));
    expect(nodes.find((n) => n.id === "orchestration")).toMatchObject({ kind: "coordinator" });
    expect(nodes.some((n) => n.id === "agent:workflow_coordinator" || n.id === "agent:approval_supervisor")).toBe(false);
    expect(edges.filter((e) => e.kind === "supervise").map((e) => e.to)).toEqual(["approval:customer_support", "approval:scheduling"]);
    expect([...connectedNodes(edges, "approval:scheduling")].sort()).toEqual(["agent:scheduling", "approval:scheduling", "approvals:supervisor", "systems:calendar"].sort());
  });

  it("has no customers node when no agent acts externally", () => {
    expect(buildArchitecture(team(["reporting_insights"])).nodes.some((n) => n.id === "users:customers")).toBe(false);
  });
});

describe("share code", () => {
  it("round-trips a complete configuration without free text", () => {
    const config = team(["customer_support", "lead_qualification"], {
      departments: ["support", "sales", "custom"],
      agents: { lead_qualification: { volume: "v1k_10k", checkpoint: "every_action", integrations: ["crm", "email"] } },
    });
    const code = encodeTeam(config);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = decodeTeam(code)!;
    expect(decoded.chosen).toEqual(["lead_qualification", "customer_support"]); // library order
    expect(decoded.departments).toEqual(["sales", "support", "custom"]);
    expect(agentConfigs(decoded)).toEqual(agentConfigs(config));
    expect(isComplete(decoded)).toBe(true);
  });

  it("rejects malformed codes and re-applies the rules to tampered values", () => {
    for (const bad of [null, "", "%%%", "bm90IGpzb24", "x".repeat(5000)]) expect(decodeTeam(bad)).toBeNull();
    const tampered = btoa(
      JSON.stringify({
        c: ["ecommerce", "s11_50", "support", "slow_response", "v100_1k"],
        d: ["support", "evil"],
        a: ["customer_support", "hacker_agent"],
        g: { customer_support: ["v100_1k", "none", ["helpdesk", "erp"]] },
        p: ["managed_cloud", "shared"],
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const decoded = decodeTeam(tampered)!;
    expect(decoded.departments).toEqual(["support"]);
    expect(decoded.chosen).toEqual(["customer_support"]);
    expect(decoded.agents.customer_support).toEqual({ volume: "v100_1k", checkpoint: "before_external", integrations: ["helpdesk", "knowledge_base"] });
  });

  it("does not restore an incomplete configuration", () => {
    expect(decodeTeam(encodeTeam(team(["workflow_coordinator"])))).toBeNull();
    expect(decodeTeam(encodeTeam(team(["sales_research"], { deployment: undefined })))).toBeNull();
  });
});
