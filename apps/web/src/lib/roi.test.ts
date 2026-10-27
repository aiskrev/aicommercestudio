import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { locales } from "@/i18n/config";
import {
  REALIZATION_OPTIONS,
  ROI_BOUNDS,
  ROI_FIELDS,
  type RoiDraft,
  type RoiInputs,
  SCENARIOS,
  SCENARIO_KEYS,
  applyScenario,
  calculateRoi,
  calculateScenarios,
  decodeRoi,
  encodeRoi,
  parseNumber,
  validateRoi,
} from "@/lib/roi";

const BASE: RoiInputs = {
  volume: 2000,
  minutes: 12,
  hourlyCost: 25,
  coverage: 60,
  timeReduction: 70,
  reviewMinutes: 2,
  implementationCost: 15000,
  runCost: 300,
  maintenanceCost: 200,
  horizon: 12,
  realization: 75,
};
const draft = (inputs: RoiInputs): RoiDraft => Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, String(v)]));

describe("input parsing and validation", () => {
  it("parses decimal commas, grouping and spaces", () => {
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("1 234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber(" 600 ")).toBe(600);
    for (const bad of ["", "abc", "1e5", "12€", "--1", undefined]) expect(parseNumber(bad)).toBeNaN();
  });

  it("requires every field — nothing is preset", () => {
    const { inputs, errors } = validateRoi({});
    expect(inputs).toBeNull();
    expect(Object.keys(errors).sort()).toEqual([...ROI_FIELDS].sort());
    expect(new Set(Object.values(errors))).toEqual(new Set(["required"]));
  });

  it("enforces bounds, integers and numbers", () => {
    expect(validateRoi({ ...draft(BASE), volume: "0" }).errors.volume).toBe("range");
    expect(validateRoi({ ...draft(BASE), volume: "10.5" }).errors.volume).toBe("integer");
    expect(validateRoi({ ...draft(BASE), coverage: "101" }).errors.coverage).toBe("range");
    expect(validateRoi({ ...draft(BASE), hourlyCost: "-5" }).errors.hourlyCost).toBe("range");
    expect(validateRoi({ ...draft(BASE), minutes: "0" }).errors.minutes).toBe("range");
    expect(validateRoi({ ...draft(BASE), runCost: "lots" }).errors.runCost).toBe("number");
    expect(validateRoi(draft(BASE)).inputs).toEqual(BASE);
  });

  it("accepts every bound exactly and never yields NaN or Infinity there", () => {
    for (const edge of ["min", "max"] as const) {
      const inputs = Object.fromEntries(ROI_FIELDS.map((f) => [f, ROI_BOUNDS[f][edge]])) as RoiInputs;
      expect(validateRoi(draft(inputs)).inputs).not.toBeNull();
      const result = calculateRoi(inputs);
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === "number") expect(Number.isFinite(value), key).toBe(true);
      }
      for (const value of result.cumulative) expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("calculation", () => {
  it("matches a hand-checked example", () => {
    const r = calculateRoi(BASE);
    // H₀ = 2000 × 12 / 60 = 400 h → 10 000 EUR
    expect(r.currentHours).toBe(400);
    expect(r.currentCost).toBe(10000);
    // H₁ = 800 × 12 / 60 + 1200 × (12 × 0.3 + 2) / 60 = 160 + 112 = 272 h
    expect(r.automatedTasks).toBe(1200);
    expect(r.futureHours).toBeCloseTo(272, 10);
    expect(r.hoursReleased).toBeCloseTo(128, 10);
    expect(r.capacityValue).toBeCloseTo(3200, 8);
    expect(r.realizedSavings).toBeCloseTo(2400, 8); // 75% of 3 200
    expect(r.runningCosts).toBe(500);
    expect(r.futureCost).toBeCloseTo(8100, 8); // 10 000 − 2 400 + 500
    expect(r.netMonthly).toBeCloseTo(1900, 8);
    expect(r.paybackMonths).toBeCloseTo(15000 / 1900, 10);
    expect(r.net12).toBeCloseTo(7800, 8); // 12 × 1 900 − 15 000
    // (12 × 2 400 − 15 000 − 12 × 500) / (15 000 + 12 × 500) = 7 800 / 21 000
    expect(r.roiPercent).toBeCloseTo((7800 / 21000) * 100, 8);
    expect(r.cumulative).toHaveLength(13);
    expect(r.cumulative[0]).toBe(-15000);
    expect(r.cumulative[12]).toBeCloseTo(r.netHorizon, 8);
  });

  it("separates released capacity from realised savings", () => {
    const none = calculateRoi({ ...BASE, realization: 0 });
    expect(none.hoursReleased).toBeCloseTo(128, 10);
    expect(none.capacityValue).toBeCloseTo(3200, 8);
    expect(none.realizedSavings).toBe(0);
    expect(none.netMonthly).toBe(-500);
    expect(none.paybackMonths).toBeNull();
    expect(none.futureCost).toBe(10500); // the process now costs more
    expect(none.roiPercent).toBeLessThan(0);
    const all = calculateRoi({ ...BASE, realization: 100 });
    expect(all.capacityValue).toBe(none.capacityValue);
    expect(all.realizedSavings).toBeCloseTo(3200, 8);
  });

  it("counts extra review time in full, whatever the realisation share", () => {
    const slow = calculateRoi({ ...BASE, timeReduction: 10, reviewMinutes: 20, realization: 25 });
    expect(slow.hoursReleased).toBeLessThan(0);
    expect(slow.realizedSavings).toBeCloseTo(slow.capacityValue, 8);
    expect(slow.realizedSavings).toBeLessThan(0);
    expect(slow.paybackMonths).toBeNull();
  });

  it("handles zero investment and zero cost without dividing by zero", () => {
    expect(calculateRoi({ ...BASE, implementationCost: 0 }).paybackMonths).toBe(0);
    const free = calculateRoi({ ...BASE, implementationCost: 0, runCost: 0, maintenanceCost: 0 });
    expect(free.roiPercent).toBeNull();
    expect(free.paybackMonths).toBe(0);
    const nothing = calculateRoi({ ...BASE, coverage: 0, implementationCost: 0, runCost: 0, maintenanceCost: 0 });
    expect(nothing.hoursReleased).toBe(0);
    expect(nothing.netMonthly).toBe(0);
    expect(nothing.paybackMonths).toBeNull();
  });

  it("uses the chosen horizon for net benefit and ROI but always reports 12 months", () => {
    const r = calculateRoi({ ...BASE, horizon: 24 });
    expect(r.netHorizon).toBeCloseTo(24 * 1900 - 15000, 8);
    expect(r.net12).toBeCloseTo(7800, 8);
    expect(r.cumulative).toHaveLength(25);
  });
});

describe("scenarios", () => {
  it("leaves the base scenario at the visitor's values and caps percentages at 100", () => {
    expect(calculateScenarios(BASE).base).toEqual(calculateRoi(BASE));
    const high = applyScenario({ ...BASE, coverage: 95, timeReduction: 90 }, "optimistic");
    expect(high.coverage).toBe(100);
    expect(high.timeReduction).toBe(100);
    expect(applyScenario(BASE, "conservative")).toMatchObject({ coverage: 45, timeReduction: 52.5, reviewMinutes: 2.5, runCost: 360, maintenanceCost: 240, implementationCost: 18000 });
  });

  it("orders conservative ≤ base ≤ optimistic for a typical process", () => {
    const s = calculateScenarios(BASE);
    expect(s.conservative.netMonthly).toBeLessThan(s.base.netMonthly);
    expect(s.base.netMonthly).toBeLessThan(s.optimistic.netMonthly);
    expect(s.conservative.realizedSavings).toBeCloseTo(1068.75, 8);
  });

  it("documents every multiplier", () => {
    for (const key of SCENARIO_KEYS) expect(Object.keys(SCENARIOS[key]).sort()).toEqual(["costs", "coverage", "implementation", "reviewMinutes", "timeReduction"]);
  });
});

describe("share code", () => {
  it("round-trips the numbers only", () => {
    const code = encodeRoi(BASE);
    expect(code).toBe("2000~12~25~60~70~2~15000~300~200~12~75");
    expect(validateRoi(decodeRoi(code)!).inputs).toEqual(BASE);
  });

  it("rejects malformed or out-of-range codes", () => {
    for (const bad of [null, "", "1~2~3", "2000~12~25~60~70~2~15000~300~200~12~175", "x".repeat(400)]) expect(decodeRoi(bad)).toBeNull();
  });
});

describe.each(locales)("ROI texts (%s)", (locale) => {
  const t = getContent(locale).roiTool;
  it("labels every field and realisation option and states the policy", () => {
    for (const field of ROI_FIELDS) expect(t.fields[field].label && t.fields[field].hint && t.fields[field].unit).toBeTruthy();
    for (const option of REALIZATION_OPTIONS) expect(t.realizationOptions[option]).toBeTruthy();
    for (const key of SCENARIO_KEYS) expect(t.scenarios[key].text).toBeTruthy();
    expect(t.formulas.length).toBeGreaterThanOrEqual(7);
    expect(t.disclaimer).toMatch(locale === "bg" ? /не е прогноза или гаранция/ : /not a forecast or a guarantee/);
  });
});
