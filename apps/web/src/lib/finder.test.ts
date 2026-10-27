import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { locales } from "@/i18n/config";
import {
  CRITERIA,
  type Criterion,
  type Level,
  type ProcessInput,
  type Ratings,
  assessProcess,
  categorise,
  favourability,
  findBlockers,
  missingCriteria,
  nextSteps,
  rankOpportunities,
  recommendPattern,
  subscores,
  suggestAgents,
} from "@/lib/finder";

/** Ratings in CRITERIA order. */
function ratings(...levels: Level[]): Required<Ratings> {
  return Object.fromEntries(CRITERIA.map((c, i) => [c, levels[i]])) as Required<Ratings>;
}
const process = (name: string, levels: Level[], area: ProcessInput["area"] = "operations"): ProcessInput => ({ name, area, ratings: ratings(...levels) });

//                          freq rep rule data exc integ impact compl overs
const INVOICES = ratings(4, 4, 3, 2, 1, 2, 3, 2, 2);

describe("scoring", () => {
  it("turns levels into favourability by direction", () => {
    expect(favourability("frequency", 4)).toBe(1);
    expect(favourability("frequency", 0)).toBe(0);
    expect(favourability("exception_rate", 0)).toBe(1);
    expect(favourability("exception_rate", 4)).toBe(0);
    expect(favourability("integration_complexity", 1)).toBe(0.75);
  });

  it("matches a hand-checked example", () => {
    const s = subscores(INVOICES);
    expect(s.fit).toBe(75); // (1 + 0.75 + 0.5 + 0.75) / 4
    expect(s.value).toBe(87.5); // (1 + 0.75) / 2
    expect(s.effort).toBe(50); // (0.5 + 0.5 + 0.5) / 3
    expect(s.suitability).toBeCloseTo(72.5, 10); // 0.45 × 75 + 0.30 × 87.5 + 0.25 × 50
    expect(s.contributions.fit + s.contributions.value + s.contributions.ease).toBeCloseTo(s.suitability, 10);
    const o = assessProcess({ name: " Invoices ", area: "finance", ratings: INVOICES }, 0)!;
    expect(o).toMatchObject({ name: "Invoices", fit: 75, value: 88, effort: 50, suitability: 73, category: "quick_win", pattern: "ai_extraction" });
  });

  it("scores the extremes 0 and 100", () => {
    expect(subscores(ratings(4, 4, 4, 4, 0, 0, 4, 0, 0)).suitability).toBe(100);
    expect(subscores(ratings(0, 0, 0, 0, 4, 4, 0, 4, 4)).suitability).toBe(0);
  });

  it("refuses incomplete ratings", () => {
    const partial: Ratings = { frequency: 3 };
    expect(missingCriteria(partial)).toHaveLength(8);
    expect(assessProcess({ name: "x", area: "sales", ratings: partial }, 0)).toBeNull();
    expect(missingCriteria({ ...INVOICES, rule_clarity: 5 as Level })).toEqual(["rule_clarity"]);
  });
});

describe("categories and rules", () => {
  const r = INVOICES;
  it("applies the category boundaries in order", () => {
    expect(categorise(39.9, 100, 0, 90, r)).toBe("not_ready");
    expect(categorise(80, 100, 0, 90, { ...r, data_availability: 0 })).toBe("not_ready");
    expect(categorise(40, 50, 50, 60, r)).toBe("quick_win");
    expect(categorise(40, 50, 50.1, 60, r)).toBe("strategic");
    expect(categorise(40, 50, 40, 59, r)).toBe("strategic");
    expect(categorise(40, 49.9, 10, 80, r)).toBe("consider");
  });

  it("recommends the first matching automation pattern", () => {
    expect(recommendPattern(ratings(3, 4, 3, 3, 1, 2, 3, 1, 1), "quick_win")).toBe("workflow_automation");
    expect(recommendPattern(ratings(3, 4, 2, 2, 2, 2, 3, 1, 1), "quick_win")).toBe("ai_extraction");
    expect(recommendPattern(ratings(3, 4, 2, 3, 2, 3, 3, 1, 1), "strategic")).toBe("agent_workflow");
    expect(recommendPattern(ratings(3, 4, 1, 3, 3, 1, 3, 1, 1), "consider")).toBe("ai_assistant_review");
    expect(recommendPattern(r, "not_ready")).toBe("fix_first");
  });

  it("lists blockers and next steps without duplicates", () => {
    const hard = ratings(1, 1, 1, 1, 3, 4, 2, 3, 4);
    expect(findBlockers(hard)).toEqual(["data_not_digital", "unclear_rules", "many_exceptions", "compliance", "integration", "low_volume"]);
    expect(nextSteps("not_ready", findBlockers(hard))).toEqual(["digitise_data", "document_rules", "exception_review", "compliance_review"]);
    expect(findBlockers(r)).toEqual([]);
    expect(nextSteps("quick_win", [])).toEqual(["measure_roi", "pilot"]);
    expect(nextSteps("consider", ["low_volume"])).toEqual(["revisit_later", "measure_roi"]);
  });

  it("suggests agents from the AI team library", () => {
    expect(suggestAgents("finance", "workflow_automation", true)).toEqual([]);
    expect(suggestAgents("finance", "fix_first", true)).toEqual([]);
    expect(suggestAgents("finance", "ai_extraction", false)).toEqual(["document_processing"]);
    expect(suggestAgents("support", "ai_extraction", true)).toEqual(["customer_support", "approval_supervisor"]);
    expect(suggestAgents("sales", "agent_workflow", false)).toEqual(["lead_qualification", "workflow_coordinator"]);
  });

  it("asks for human approval only on processes that will be automated", () => {
    const sensitive = assessProcess(process("Payroll", [3, 4, 3, 3, 1, 1, 3, 4, 2], "hr"), 0)!;
    expect(sensitive.approvalRequired).toBe(true);
    const unready = assessProcess(process("Board pack", [1, 2, 1, 1, 3, 4, 2, 3, 4]), 0)!;
    expect(unready.category).toBe("not_ready");
    expect(unready.approvalRequired).toBe(false);
    expect(unready.agents).toEqual([]);
  });
});

describe("ranking", () => {
  it("ranks by suitability, then value, then entry order, skipping incomplete processes", () => {
    const ranked = rankOpportunities([
      process("Low", [1, 2, 1, 1, 3, 4, 2, 3, 4]),
      process("Best", [4, 4, 4, 4, 0, 0, 4, 0, 0]),
      { name: "Unrated", area: "sales", ratings: {} },
      process("Twin A", [2, 2, 2, 2, 2, 2, 2, 2, 2]),
      process("Twin B", [2, 2, 2, 2, 2, 2, 2, 2, 2]),
    ]);
    expect(ranked.map((o) => o.name)).toEqual(["Best", "Twin A", "Twin B", "Low"]);
    expect(ranked.map((o) => o.rank)).toEqual([1, 2, 3, 4]);
    expect(ranked[1].index).toBe(3);
  });

  it("breaks equal suitability by value", () => {
    // Both round to 61: 0.45×50 + 0.30×100 + 0.25×33.3 = 60.8 and 0.45×75 + 0.30×50 + 0.25×50 = 61.25.
    const a = process("Valuable", [4, 2, 2, 2, 2, 4, 4, 2, 2]);
    const b = process("Easy", [2, 4, 4, 2, 2, 2, 2, 2, 2]);
    const [first] = rankOpportunities([b, a]);
    expect(subscores(a.ratings as Required<Ratings>).value).toBeGreaterThan(subscores(b.ratings as Required<Ratings>).value);
    expect(Math.round(subscores(a.ratings as Required<Ratings>).suitability)).toBe(Math.round(subscores(b.ratings as Required<Ratings>).suitability));
    expect(first.name).toBe("Valuable");
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
    expect(t.methodology.length).toBeGreaterThanOrEqual(5);
  });
});
