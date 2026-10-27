import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { AGENT_SLUGS, CATEGORY_OF, INTEGRATION_CATEGORIES, LIBRARY, agentBySlug, filterLibrary, libraryEntry, riskLevel } from "@/lib/agent-library";
import { AGENTS, AGENT_KEYS, INTEGRATIONS, minimumCheckpoint } from "@/lib/ai-team";
import { routes } from "@/lib/routes";

const anyText = () => "";

describe("agent library catalogue", () => {
  it("has one entry per agent of the team model, in the same order", () => {
    expect(LIBRARY.map((e) => e.key)).toEqual(AGENT_KEYS);
  });

  it("derives catalogue attributes from the team definitions instead of redefining them", () => {
    for (const entry of LIBRARY) {
      const def = AGENTS[entry.key];
      expect(entry.departments).toBe(def.departments);
      expect(entry.complexity).toBe(def.complexity);
      expect(entry.requires).toBe(def.requires);
      expect(entry.approval).toBe(minimumCheckpoint(entry.key).checkpoint);
      expect(entry.requiredCategories.every((c) => entry.categories.includes(c))).toBe(true);
    }
  });

  it("maps every system type to exactly one integration category", () => {
    for (const integration of INTEGRATIONS) expect(INTEGRATION_CATEGORIES).toContain(CATEGORY_OF[integration]);
  });

  it("separates data sources from systems and lists categories in a fixed order", () => {
    const support = libraryEntry("customer_support");
    expect(support.dataSources).toEqual(["knowledge_base"]);
    expect(support.systems).not.toContain("knowledge_base");
    expect(new Set(support.systems)).toEqual(new Set(["helpdesk", "email", "chat", "ecommerce_platform", "crm"]));
    expect(support.categories).toEqual(["crm", "erp", "email_calendar", "helpdesk", "document_storage"]);
    expect(support.requiredCategories).toEqual(["helpdesk", "document_storage"]);
  });

  it("rates the risk of the role by data sensitivity and external action", () => {
    expect(riskLevel("customer_support")).toBe("high");
    expect(riskLevel("document_processing")).toBe("high");
    expect(riskLevel("content_operations")).toBe("medium"); // low sensitivity, but acts externally
    expect(riskLevel("lead_qualification")).toBe("medium");
    expect(riskLevel("sales_research")).toBe("low");
  });

  it("requires approval before external actions for agents that act outside the company", () => {
    expect(libraryEntry("customer_support").approval).toBe("before_external");
    expect(libraryEntry("scheduling").approval).toBe("before_external");
    expect(libraryEntry("approval_supervisor").approval).toBe("every_action");
    expect(libraryEntry("reporting_insights").approval).toBe("sample_review");
  });

  it("lists example workflows: task agents by chain, coordination roles for multi-agent workflows", () => {
    expect(libraryEntry("reporting_insights").workflows).toEqual(["document_intake", "insight_reporting"]);
    expect(libraryEntry("workflow_coordinator").workflows).toEqual(["lead_to_meeting", "support_resolution", "document_intake"]);
    for (const entry of LIBRARY) expect(entry.workflows.length).toBeGreaterThan(0);
  });

  it("filters deterministically by department, risk, complexity, category and text", () => {
    expect(filterLibrary({}, anyText)).toEqual(LIBRARY);
    expect(filterLibrary({ risk: "high" }, anyText).map((e) => e.key)).toEqual(["customer_support", "document_processing"]);
    expect(filterLibrary({ category: "databases" }, anyText).map((e) => e.key)).toEqual(["content_operations", "reporting_insights"]);
    expect(filterLibrary({ department: "finance", complexity: "high" }, anyText).map((e) => e.key)).toEqual(["document_processing"]);
    const names = getContent("en").teamTool.agents;
    expect(filterLibrary({ query: "  INVOICE " }, (key) => `${names[key].name} ${names[key].purpose} ${names[key].short}`).map((e) => e.key)).toEqual([
      "document_processing",
    ]);
    expect(filterLibrary({ risk: "low", department: "support" }, anyText)).toEqual([]);
  });
});

describe("agent library pages", () => {
  it("has unique, URL-safe slugs per locale and resolves them back", () => {
    for (const locale of ["bg", "en"] as const) {
      const slugs = AGENT_KEYS.map((key) => AGENT_SLUGS[key][locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    for (const key of AGENT_KEYS) expect(agentBySlug(AGENT_SLUGS[key].bg)).toBe(key);
    expect(agentBySlug("unknown")).toBeNull();
  });

  it("localizes the library and detail URLs", () => {
    expect(localizePath("bg", routes.agentLibrary)).toBe("/bg/ai-agenti");
    expect(localizePath("en", routes.agentLibrary)).toBe("/en/ai-agents");
    expect(localizePath("en", routes.agent(AGENT_SLUGS.document_processing.bg))).toBe("/en/ai-agents/document-processing-agent");
    expect(localizePath("bg", routes.agent(AGENT_SLUGS.document_processing.bg))).toBe("/bg/ai-agenti/obrabotka-na-dokumenti");
  });

  it("has library texts for every risk level and category in both languages", () => {
    for (const locale of ["bg", "en"] as const) {
      const t = getContent(locale).agentLibrary;
      for (const risk of ["low", "medium", "high"] as const) {
        expect(t.risk[risk]).toBeTruthy();
        expect(t.riskText[risk]).toBeTruthy();
      }
      for (const category of INTEGRATION_CATEGORIES) expect(t.categories[category].title).toBeTruthy();
    }
  });
});
