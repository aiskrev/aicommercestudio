import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { locales } from "@/i18n/config";
import {
  CRITERIA,
  type Criterion,
  FINDER_MODEL_VERSION,
  type Level,
  MAX_NAME_LENGTH,
  type ProcessInput,
  type Ratings,
  assessProcess,
  categorise,
  cleanProcessName,
  favourability,
  findBlockers,
  missingCriteria,
  nextSteps,
  rankOpportunities,
  recommendPattern,
  recommendServices,
  riskLevel,
  subscores,
  suggestAgents,
  suggestPilot,
} from "@/lib/finder";

/** Ratings in CRITERIA order. */
function ratings(...levels: Level[]): Required<Ratings> {
  return Object.fromEntries(CRITERIA.map((c, i) => [c, levels[i]])) as Required<Ratings>;
}
const process = (name: string, levels: Level[], area: ProcessInput["area"] = "operations"): ProcessInput => ({ name, area, ratings: ratings(...levels) });

//                       freq rep rule struct data exc integ impact compl overs
const INVOICES = ratings(4, 4, 3, 2, 2, 1, 2, 3, 2, 2);
const BEST: Level[] = [4, 4, 4, 4, 4, 0, 0, 4, 0, 0];
const WORST: Level[] = [0, 0, 0, 0, 0, 4, 4, 0, 4, 4];

describe("scoring", () => {
  it("uses ten criteria and model 2026-11.1", () => {
    expect(CRITERIA).toHaveLength(10);
    expect(CRITERIA).toContain("input_structure");
    expect(FINDER_MODEL_VERSION).toBe("2026-11.1");
  });

  it("turns levels into favourability by direction", () => {
    expect(favourability("frequency", 4)).toBe(1);
    expect(favourability("frequency", 0)).toBe(0);
    expect(favourability("input_structure", 3)).toBe(0.75);
    expect(favourability("exception_rate", 0)).toBe(1);
    expect(favourability("exception_rate", 4)).toBe(0);
    expect(favourability("integration_complexity", 1)).toBe(0.75);
  });

  it("matches a hand-checked example", () => {
    const s = subscores(INVOICES);
    expect(s.fit).toBe(70); // (1 + 0.75 + 0.5 + 0.5 + 0.75) / 5
    expect(s.value).toBe(87.5); // (1 + 0.75) / 2
    expect(s.effort).toBe(50); // (0.5 + 0.5 + 0.5) / 3
    expect(s.suitability).toBeCloseTo(70.25, 10); // 0.45 × 70 + 0.30 × 87.5 + 0.25 × 50
    expect(s.contributions.fit + s.contributions.value + s.contributions.ease).toBeCloseTo(s.suitability, 10);
    const o = assessProcess({ name: " Invoices ", area: "finance", ratings: INVOICES }, 0)!;
    expect(o).toMatchObject({
      name: "Invoices",
      fit: 70,
      value: 88,
      effort: 50,
      suitability: 70,
      category: "quick_win",
      risk: "medium",
      pattern: "ai_extraction",
      approvalRequired: false,
      services: ["ai_tools", "automation"],
    });
  });

  it("scores the extremes 0 and 100", () => {
    expect(subscores(ratings(...BEST)).suitability).toBe(100);
    expect(subscores(ratings(...WORST)).suitability).toBe(0);
  });

  it("refuses incomplete or invalid ratings", () => {
    const partial: Ratings = { frequency: 3 };
    expect(missingCriteria(partial)).toHaveLength(9);
    expect(assessProcess({ name: "x", area: "sales", ratings: partial }, 0)).toBeNull();
    expect(missingCriteria({ ...INVOICES, rule_clarity: 5 as Level })).toEqual(["rule_clarity"]);
    expect(missingCriteria({ ...INVOICES, input_structure: 1.5 as Level, data_availability: -1 as Level })).toEqual([
      "input_structure",
      "data_availability",
    ]);
  });
});

describe("categories, risk and rules", () => {
  const r = INVOICES;
  it("applies the category boundaries in order", () => {
    expect(categorise(39.9, 100, 0, 90, r)).toBe("not_ready");
    expect(categorise(80, 100, 0, 90, { ...r, data_availability: 0 })).toBe("not_ready");
    expect(categorise(40, 50, 50, 60, r)).toBe("quick_win");
    expect(categorise(40, 50, 50.1, 60, r)).toBe("strategic");
    expect(categorise(40, 50, 40, 59, r)).toBe("strategic");
    expect(categorise(40, 49.9, 10, 80, r)).toBe("consider");
  });

  it("rates risk from sensitivity, judgement, exceptions and integration", () => {
    expect(riskLevel(ratings(4, 4, 4, 4, 4, 1, 2, 3, 1, 1))).toBe("low");
    expect(riskLevel(ratings(4, 4, 4, 4, 4, 1, 3, 3, 1, 1))).toBe("medium"); // integration 3
    expect(riskLevel(ratings(4, 4, 4, 4, 4, 2, 2, 3, 1, 1))).toBe("medium"); // exceptions 2
    expect(riskLevel(ratings(4, 4, 4, 4, 4, 1, 2, 3, 3, 1))).toBe("high"); // sensitivity 3
    expect(riskLevel(ratings(4, 4, 4, 4, 4, 1, 2, 3, 1, 3))).toBe("high"); // judgement 3
    expect(riskLevel(ratings(4, 4, 4, 4, 4, 3, 2, 3, 1, 1))).toBe("high"); // impact 3 with exceptions 3
    expect(riskLevel(ratings(4, 4, 4, 4, 4, 3, 2, 2, 1, 1))).toBe("medium"); // impact 2 with exceptions 3
  });

  it("lets a high risk override a quick win and require approval", () => {
    const safe = assessProcess(process("Safe", [4, 4, 4, 4, 4, 0, 0, 3, 0, 2]), 0)!;
    expect([safe.category, safe.risk, safe.approvalRequired]).toEqual(["quick_win", "medium", false]);
    const judged = assessProcess(process("Judged", [4, 4, 4, 4, 4, 0, 0, 3, 0, 3]), 0)!;
    expect(judged.suitability).toBeGreaterThanOrEqual(60);
    expect([judged.category, judged.risk, judged.approvalRequired]).toEqual(["strategic", "high", true]);
    expect(categorise(90, 90, 10, 90, ratings(4, 4, 4, 4, 4, 0, 0, 3, 0, 3), "high")).toBe("strategic");
  });

  it("makes human approval mandatory for critical processes, even with standard automation", () => {
    const critical = assessProcess(process("Critical", BEST), 0)!;
    expect([critical.pattern, critical.approvalRequired]).toEqual(["workflow_automation", true]);
    const important = assessProcess(process("Important", [4, 4, 4, 4, 4, 0, 0, 3, 0, 0]), 0)!;
    expect([important.pattern, important.approvalRequired]).toEqual(["workflow_automation", false]);
  });

  it("recommends the first matching pattern and never prefers AI over clear rules", () => {
    expect(recommendPattern(ratings(3, 4, 3, 3, 3, 1, 2, 3, 1, 1), "quick_win")).toBe("workflow_automation");
    // The same process with unstructured inputs needs AI to read them.
    expect(recommendPattern(ratings(3, 4, 3, 2, 3, 1, 2, 3, 1, 1), "quick_win")).toBe("ai_extraction");
    expect(recommendPattern(ratings(3, 4, 2, 2, 2, 2, 2, 3, 1, 1), "quick_win")).toBe("ai_extraction");
    expect(recommendPattern(ratings(3, 4, 2, 3, 3, 2, 3, 3, 1, 1), "strategic")).toBe("agent_workflow");
    expect(recommendPattern(ratings(3, 4, 1, 3, 3, 3, 1, 3, 1, 1), "consider")).toBe("ai_assistant_review");
    expect(recommendPattern(r, "not_ready")).toBe("fix_first");
  });

  it("lists blockers and next steps without duplicates", () => {
    const hard = ratings(1, 1, 1, 1, 1, 3, 4, 2, 3, 4);
    expect(findBlockers(hard)).toEqual(["data_not_digital", "unclear_rules", "many_exceptions", "compliance", "integration", "low_volume"]);
    expect(nextSteps("not_ready", findBlockers(hard))).toEqual(["digitise_data", "document_rules", "exception_review", "compliance_review"]);
    expect(findBlockers(r)).toEqual([]);
    expect(nextSteps("quick_win", [])).toEqual(["measure_roi", "pilot"]);
    expect(nextSteps("consider", ["low_volume"])).toEqual(["revisit_later", "measure_roi"]);
  });

  it("recommends services by pattern and blockers", () => {
    expect(recommendServices("workflow_automation", [])).toEqual(["automation"]);
    expect(recommendServices("agent_workflow", ["integration", "compliance"])).toEqual(["ai_agents", "integrations", "audit"]);
    expect(recommendServices("fix_first", ["data_not_digital"])).toEqual(["audit"]);
  });

  it("suggests agents from the AI team library", () => {
    expect(suggestAgents("finance", "workflow_automation", true)).toEqual([]);
    expect(suggestAgents("finance", "fix_first", true)).toEqual([]);
    expect(suggestAgents("finance", "ai_extraction", false)).toEqual(["document_processing"]);
    expect(suggestAgents("support", "ai_extraction", true)).toEqual(["customer_support", "approval_supervisor"]);
    expect(suggestAgents("sales", "agent_workflow", false)).toEqual(["lead_qualification", "workflow_coordinator"]);
  });

  it("asks for no approval on processes that are not ready", () => {
    const unready = assessProcess(process("Board pack", [1, 2, 1, 1, 1, 3, 4, 2, 3, 4]), 0)!;
    expect(unready.category).toBe("not_ready");
    expect(unready.approvalRequired).toBe(false);
    expect(unready.agents).toEqual([]);
  });
});

describe("ranking, pilot and inputs", () => {
  it("ranks by suitability, then value, then entry order, skipping incomplete processes", () => {
    const ranked = rankOpportunities([
      process("Low", [1, 2, 1, 1, 1, 3, 4, 2, 3, 4]),
      process("Best", BEST),
      { name: "Unrated", area: "sales", ratings: {} },
      process("Twin A", [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
      process("Twin B", [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
    ]);
    expect(ranked.map((o) => o.name)).toEqual(["Best", "Twin A", "Twin B", "Low"]);
    expect(ranked.map((o) => o.rank)).toEqual([1, 2, 3, 4]);
    expect(ranked[1].index).toBe(3);
  });

  it("breaks equal suitability by value and orders identical input the same way every time", () => {
    // Both round to 61: 0.45×50 + 0.30×100 + 0.25×33.3 = 60.8 and 0.45×75 + 0.30×50 + 0.25×50 = 61.25.
    const a = process("Valuable", [4, 2, 2, 2, 2, 2, 4, 4, 2, 2]);
    const b = process("Easy", [2, 4, 4, 3, 2, 2, 2, 2, 2, 2]);
    expect(Math.round(subscores(a.ratings as Required<Ratings>).suitability)).toBe(Math.round(subscores(b.ratings as Required<Ratings>).suitability));
    expect(rankOpportunities([b, a])[0].name).toBe("Valuable");
    const runs = Array.from({ length: 5 }, () => rankOpportunities([b, a, b]).map((o) => `${o.index}:${o.rank}`).join(","));
    expect(new Set(runs).size).toBe(1);
  });

  it("handles zero processes", () => {
    expect(rankOpportunities([])).toEqual([]);
    expect(suggestPilot([])).toBeNull();
  });

  it("suggests a pilot for the best ready process only", () => {
    const ranked = rankOpportunities([process("Unready", [1, 2, 1, 1, 1, 3, 4, 2, 3, 4]), process("Invoices", [4, 4, 3, 2, 2, 1, 2, 3, 2, 2])]);
    expect(suggestPilot(ranked)).toEqual({ index: 1, pattern: "ai_extraction", approvalRequired: false, weeks: [4, 8] });
    expect(suggestPilot(rankOpportunities([process("Unready", [1, 2, 1, 1, 1, 3, 4, 2, 3, 4])]))).toBeNull();
  });

  it("neutralises malicious or oversized process names (they are only ever rendered as text)", () => {
    expect(cleanProcessName("  Invoices\u0000\u0007 and\n\tcredit notes  ")).toBe("Invoices and credit notes");
    expect(cleanProcessName("x".repeat(500))).toHaveLength(MAX_NAME_LENGTH);
    expect(cleanProcessName("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
    const o = assessProcess({ name: "<img src=x onerror=alert(1)>\u0000", area: "it_knowledge", ratings: INVOICES }, 0)!;
    expect(o.name).toBe("<img src=x onerror=alert(1)>");
  });
});

describe.each(locales)("finder texts (%s)", (locale) => {
  const t = getContent(locale).finderTool;
  it("has a question and five level descriptions for every criterion", () => {
    for (const criterion of CRITERIA as readonly Criterion[]) {
      expect(t.criteria[criterion].question).toBeTruthy();
      expect(t.criteria[criterion].levels).toHaveLength(5);
      expect(new Set(t.criteria[criterion].levels).size).toBe(5);
    }
    expect(Object.keys(t.categories)).toHaveLength(4);
    expect(Object.keys(t.patterns)).toHaveLength(5);
    expect(Object.keys(t.blockers)).toHaveLength(6);
    expect(Object.keys(t.nextSteps)).toHaveLength(10);
    expect(Object.keys(t.result.risks)).toEqual(["low", "medium", "high"]);
    expect(t.methodology.length).toBeGreaterThanOrEqual(6);
    expect(t.result.suitabilityNote.length).toBeGreaterThan(40);
  });
});
