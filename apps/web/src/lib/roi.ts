/**
 * AI ROI calculator — pure arithmetic on the visitor's own numbers (no network, no defaults that imply
 * savings). Policy: docs/PLATFORM_EXPANSION_PLAN.md issue #2; method: docs/ROI_AND_FINDER.md.
 *
 * Time is in hours per month, money in EUR. With V tasks/month, M minutes per task, R hourly cost,
 * coverage c, time reduction r, review minutes q, realisation share p:
 *
 *   current hours        H₀ = V × M / 60
 *   current cost         C₀ = H₀ × R
 *   automated tasks      A  = V × c
 *   future hours         H₁ = (V − A) × M / 60 + A × (M × (1 − r) + q) / 60
 *   capacity released    ΔH = H₀ − H₁              (may be negative: review takes longer than it saves)
 *   value of that time   ΔH × R                    (capacity, not cash)
 *   realised savings     S  = ΔH × R × p   if ΔH ≥ 0,   ΔH × R   if ΔH < 0 (extra time always costs)
 *   running costs        K  = AI/API/infrastructure + maintenance
 *   future process cost  C₁ = C₀ − S + K
 *   net monthly benefit  N  = S − K  (= C₀ − C₁)
 *   payback (months)     I / N when N > 0; 0 when I = 0 and N > 0; not reached when N ≤ 0
 *   net over T months    T × N − I       (12-month net benefit: T = 12)
 *   ROI over T months    (T × S − I − T × K) / (I + T × K) × 100; undefined when I + T × K = 0
 *
 * Scenarios scale the visitor's coverage, time reduction, review time and costs by SCENARIOS; base = inputs.
 */

export const ROI_MODEL_VERSION = "2026-10.1";

export const ROI_FIELDS = [
  "volume",
  "minutes",
  "hourlyCost",
  "coverage",
  "timeReduction",
  "reviewMinutes",
  "implementationCost",
  "runCost",
  "maintenanceCost",
  "horizon",
  "realization",
] as const;
export type RoiField = (typeof ROI_FIELDS)[number];

/** Inclusive bounds. Percentages are entered as 0–100. */
export const ROI_BOUNDS: Record<RoiField, { min: number; max: number; integer?: boolean }> = {
  volume: { min: 1, max: 1_000_000, integer: true },
  minutes: { min: 0.1, max: 600 },
  hourlyCost: { min: 1, max: 500 },
  coverage: { min: 0, max: 100 },
  timeReduction: { min: 0, max: 100 },
  reviewMinutes: { min: 0, max: 600 },
  implementationCost: { min: 0, max: 10_000_000 },
  runCost: { min: 0, max: 1_000_000 },
  maintenanceCost: { min: 0, max: 1_000_000 },
  horizon: { min: 1, max: 60, integer: true },
  realization: { min: 0, max: 100 },
};

export const HORIZONS = [6, 12, 24, 36] as const;
/** Share of released time that becomes a cash saving — always an explicit choice, never a default. */
export const REALIZATION_OPTIONS = [0, 25, 50, 75, 100] as const;

export type RoiInputs = Record<RoiField, number>;
export type RoiDraft = Partial<Record<RoiField, string>>;
export type RoiErrors = Partial<Record<RoiField, "required" | "number" | "range" | "integer">>;

/** Accepts "1 234,5", "1,234.5" and "1234.5"; returns NaN for anything else. */
export function parseNumber(raw: string | undefined): number {
  if (raw === undefined) return Number.NaN;
  const text = raw.trim().replace(/[\s ]/g, "");
  if (!text) return Number.NaN;
  // A single comma followed by 1–2 digits at the end is a decimal comma (bg); other commas group thousands.
  const normalised = /^-?\d+,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(normalised) ? Number(normalised) : Number.NaN;
}

export function validateRoi(draft: RoiDraft): { inputs: RoiInputs | null; errors: RoiErrors } {
  const errors: RoiErrors = {};
  const values = {} as RoiInputs;
  for (const field of ROI_FIELDS) {
    const raw = draft[field];
    if (raw === undefined || raw.trim() === "") {
      errors[field] = "required";
      continue;
    }
    const value = parseNumber(raw);
    const { min, max, integer } = ROI_BOUNDS[field];
    if (!Number.isFinite(value)) errors[field] = "number";
    else if (value < min || value > max) errors[field] = "range";
    else if (integer && !Number.isInteger(value)) errors[field] = "integer";
    else values[field] = value;
  }
  return { inputs: Object.keys(errors).length === 0 ? values : null, errors };
}

export const SCENARIO_KEYS = ["conservative", "base", "optimistic"] as const;
export type RoiScenario = (typeof SCENARIO_KEYS)[number];

/** Multipliers applied to the visitor's own inputs (shown in the UI). Percentages are capped at 100. */
export const SCENARIOS: Record<RoiScenario, { coverage: number; timeReduction: number; reviewMinutes: number; costs: number; implementation: number }> = {
  conservative: { coverage: 0.75, timeReduction: 0.75, reviewMinutes: 1.25, costs: 1.2, implementation: 1.2 },
  base: { coverage: 1, timeReduction: 1, reviewMinutes: 1, costs: 1, implementation: 1 },
  optimistic: { coverage: 1.15, timeReduction: 1.15, reviewMinutes: 0.85, costs: 1, implementation: 1 },
};

export interface RoiResult {
  currentHours: number;
  currentCost: number;
  futureHours: number;
  automatedTasks: number;
  /** Capacity released (hours/month); negative when review takes longer than the automation saves. */
  hoursReleased: number;
  /** Value of the released time at the hourly cost — capacity, not cash. */
  capacityValue: number;
  /** Realised monthly saving after the realisation share. */
  realizedSavings: number;
  /** AI/API/infrastructure + maintenance (K), and its two parts. */
  runningCosts: number;
  runCost: number;
  maintenanceCost: number;
  futureCost: number;
  netMonthly: number;
  investment: number;
  /** Months to recover the investment; null when the monthly benefit is not positive. */
  paybackMonths: number | null;
  net12: number;
  netHorizon: number;
  /** ROI over the horizon in %; null when there is no cost to compare with. */
  roiPercent: number | null;
  horizon: number;
  /** Cumulative net position at the end of month 0…horizon (month 0 = − investment). */
  cumulative: number[];
}

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

export function applyScenario(inputs: RoiInputs, scenario: RoiScenario): RoiInputs {
  const s = SCENARIOS[scenario];
  return {
    ...inputs,
    coverage: clampPct(inputs.coverage * s.coverage),
    timeReduction: clampPct(inputs.timeReduction * s.timeReduction),
    reviewMinutes: inputs.reviewMinutes * s.reviewMinutes,
    runCost: inputs.runCost * s.costs,
    maintenanceCost: inputs.maintenanceCost * s.costs,
    implementationCost: inputs.implementationCost * s.implementation,
  };
}

export function calculateRoi(inputs: RoiInputs): RoiResult {
  const { volume: V, minutes: M, hourlyCost: R, horizon: T } = inputs;
  const c = inputs.coverage / 100;
  const r = inputs.timeReduction / 100;
  const p = inputs.realization / 100;
  const q = inputs.reviewMinutes;

  const currentHours = (V * M) / 60;
  const currentCost = currentHours * R;
  const automatedTasks = V * c;
  const futureHours = ((V - automatedTasks) * M) / 60 + (automatedTasks * (M * (1 - r) + q)) / 60;
  const hoursReleased = currentHours - futureHours;
  const capacityValue = hoursReleased * R;
  const realizedSavings = hoursReleased >= 0 ? capacityValue * p : capacityValue;
  const runningCosts = inputs.runCost + inputs.maintenanceCost;
  const futureCost = currentCost - realizedSavings + runningCosts;
  const netMonthly = realizedSavings - runningCosts;
  const investment = inputs.implementationCost;

  let paybackMonths: number | null = null;
  if (netMonthly > 0) paybackMonths = investment === 0 ? 0 : investment / netMonthly;

  const totalCost = investment + T * runningCosts;
  const roiPercent = totalCost > 0 ? ((T * realizedSavings - totalCost) / totalCost) * 100 : null;
  const cumulative = Array.from({ length: T + 1 }, (_, month) => month * netMonthly - investment);

  return {
    currentHours,
    currentCost,
    futureHours,
    automatedTasks,
    hoursReleased,
    capacityValue,
    realizedSavings,
    runningCosts,
    runCost: inputs.runCost,
    maintenanceCost: inputs.maintenanceCost,
    futureCost,
    netMonthly,
    investment,
    paybackMonths,
    net12: 12 * netMonthly - investment,
    netHorizon: T * netMonthly - investment,
    roiPercent,
    horizon: T,
    cumulative,
  };
}

export function calculateScenarios(inputs: RoiInputs): Record<RoiScenario, RoiResult> {
  return Object.fromEntries(SCENARIO_KEYS.map((key) => [key, calculateRoi(applyScenario(inputs, key))])) as Record<RoiScenario, RoiResult>;
}

/** Non-personal share code: the numbers only (the process description is never included). */
export function encodeRoi(inputs: RoiInputs): string {
  return ROI_FIELDS.map((field) => String(inputs[field])).join("~");
}

export function decodeRoi(code: string | null | undefined): RoiDraft | null {
  if (!code || code.length > 300) return null;
  const parts = code.split("~");
  if (parts.length !== ROI_FIELDS.length) return null;
  const draft = Object.fromEntries(ROI_FIELDS.map((field, i) => [field, parts[i]])) as RoiDraft;
  return validateRoi(draft).inputs ? draft : null;
}
