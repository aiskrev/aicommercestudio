import { AGENTS, type AgentKey, type Department, recommendAgents } from "@/lib/ai-team";

/**
 * Automation Opportunity Finder — rubric scoring (pure, deterministic, no network).
 * Method: docs/ROI_AND_FINDER.md. Texts: content/{bg,en}/tool-finder.ts.
 *
 * Each process is rated on nine criteria, levels 0–4 (the meaning of each level is in the content).
 * Favourability f = level / 4 for "more is better" criteria and (4 − level) / 4 for "more is harder".
 *
 *   fit    = mean f(repetitiveness, rule clarity, data availability, exception rate)   × 100
 *   value  = mean f(frequency, business impact)                                         × 100
 *   effort = mean (1 − f)(integration complexity, compliance risk, oversight needs)     × 100
 *   suitability = 0.45 × fit + 0.30 × value + 0.25 × (100 − effort), rounded
 *
 * Categories (first rule that matches):
 *   not_ready   fit < 40, or no digital data (data availability = 0)
 *   quick_win   suitability ≥ 60, value ≥ 50, effort ≤ 50
 *   strategic   value ≥ 50 (worth doing, but a larger project)
 *   consider    everything else (low value today)
 * Ranking: suitability desc, then value desc, then the order the processes were entered.
 */

export const FINDER_MODEL_VERSION = "2026-10.1";

export const CRITERIA = [
  "frequency",
  "repetitiveness",
  "rule_clarity",
  "data_availability",
  "exception_rate",
  "integration_complexity",
  "business_impact",
  "compliance_risk",
  "oversight_needs",
] as const;
export type Criterion = (typeof CRITERIA)[number];

/** true = a higher level makes the process a better automation candidate. */
export const CRITERION_DIRECTION: Record<Criterion, "positive" | "negative"> = {
  frequency: "positive",
  repetitiveness: "positive",
  rule_clarity: "positive",
  data_availability: "positive",
  exception_rate: "negative",
  integration_complexity: "negative",
  business_impact: "positive",
  compliance_risk: "negative",
  oversight_needs: "negative",
};

export const SUBSCORES = {
  fit: ["repetitiveness", "rule_clarity", "data_availability", "exception_rate"],
  value: ["frequency", "business_impact"],
  effort: ["integration_complexity", "compliance_risk", "oversight_needs"],
} as const satisfies Record<string, readonly Criterion[]>;
export type Subscore = keyof typeof SUBSCORES;

export const SUITABILITY_WEIGHTS = { fit: 0.45, value: 0.3, ease: 0.25 } as const;
export const MAX_LEVEL = 4;
export const MAX_PROCESSES = 5;
export const PROCESS_AREAS: Department[] = ["sales", "marketing", "support", "operations", "finance", "hr", "it_knowledge"];

export type Level = 0 | 1 | 2 | 3 | 4;
export type Ratings = Partial<Record<Criterion, Level>>;

export interface ProcessInput {
  /** Free text shown on the page only; never part of a link or a request. */
  name: string;
  area: Department;
  ratings: Ratings;
}

export type Category = "quick_win" | "strategic" | "consider" | "not_ready";
export type Pattern = "workflow_automation" | "ai_extraction" | "ai_assistant_review" | "agent_workflow" | "fix_first";
export type Blocker = "data_not_digital" | "unclear_rules" | "many_exceptions" | "compliance" | "integration" | "low_volume";
export type NextStep =
  | "pilot"
  | "measure_roi"
  | "discovery"
  | "design_team"
  | "document_rules"
  | "digitise_data"
  | "exception_review"
  | "compliance_review"
  | "integration_check"
  | "revisit_later";

export interface Opportunity {
  index: number;
  name: string;
  area: Department;
  fit: number;
  value: number;
  effort: number;
  suitability: number;
  /** Each criterion's favourability (0–100), for the breakdown chart. */
  breakdown: Record<Criterion, number>;
  /** Points each part contributes to the suitability (sums to the unrounded score). */
  contributions: { fit: number; value: number; ease: number };
  category: Category;
  pattern: Pattern;
  approvalRequired: boolean;
  agents: AgentKey[];
  blockers: Blocker[];
  nextSteps: NextStep[];
  rank: number;
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_LEVEL;
}

export function missingCriteria(ratings: Ratings): Criterion[] {
  return CRITERIA.filter((c) => !isLevel(ratings[c]));
}

export function favourability(criterion: Criterion, level: Level): number {
  return CRITERION_DIRECTION[criterion] === "positive" ? level / MAX_LEVEL : (MAX_LEVEL - level) / MAX_LEVEL;
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

export function subscores(ratings: Required<Ratings>) {
  const f = (c: Criterion) => favourability(c, ratings[c]);
  const fit = mean(SUBSCORES.fit.map(f)) * 100;
  const value = mean(SUBSCORES.value.map(f)) * 100;
  // Effort is the inverse of favourability: higher = harder.
  const effort = mean(SUBSCORES.effort.map((c) => 1 - f(c))) * 100;
  const contributions = {
    fit: SUITABILITY_WEIGHTS.fit * fit,
    value: SUITABILITY_WEIGHTS.value * value,
    ease: SUITABILITY_WEIGHTS.ease * (100 - effort),
  };
  return { fit, value, effort, contributions, suitability: contributions.fit + contributions.value + contributions.ease };
}

export function categorise(fit: number, value: number, effort: number, suitability: number, ratings: Required<Ratings>): Category {
  if (fit < 40 || ratings.data_availability === 0) return "not_ready";
  if (suitability >= 60 && value >= 50 && effort <= 50) return "quick_win";
  if (value >= 50) return "strategic";
  return "consider";
}

/** Rule order matters: the first matching pattern is recommended. */
export function recommendPattern(ratings: Required<Ratings>, category: Category): Pattern {
  if (category === "not_ready") return "fix_first";
  if (ratings.rule_clarity >= 3 && ratings.exception_rate <= 1 && ratings.data_availability >= 3) return "workflow_automation";
  if (ratings.data_availability <= 2 && ratings.rule_clarity >= 2) return "ai_extraction";
  if (ratings.integration_complexity >= 3 && ratings.frequency >= 3 && ratings.rule_clarity >= 2) return "agent_workflow";
  return "ai_assistant_review";
}

export function findBlockers(ratings: Required<Ratings>): Blocker[] {
  const out: Blocker[] = [];
  if (ratings.data_availability <= 1) out.push("data_not_digital");
  if (ratings.rule_clarity <= 1) out.push("unclear_rules");
  if (ratings.exception_rate >= 3) out.push("many_exceptions");
  if (ratings.compliance_risk >= 3) out.push("compliance");
  if (ratings.integration_complexity >= 3) out.push("integration");
  if (ratings.frequency <= 1) out.push("low_volume");
  return out;
}

const BLOCKER_STEP: Record<Blocker, NextStep> = {
  data_not_digital: "digitise_data",
  unclear_rules: "document_rules",
  many_exceptions: "exception_review",
  compliance: "compliance_review",
  integration: "integration_check",
  low_volume: "revisit_later",
};

const CATEGORY_STEPS: Record<Category, NextStep[]> = {
  quick_win: ["measure_roi", "pilot"],
  strategic: ["discovery", "design_team", "measure_roi"],
  consider: ["measure_roi", "revisit_later"],
  not_ready: [],
};

/** Up to four steps: what unblocks the process first, then what the category suggests. */
export function nextSteps(category: Category, blockers: Blocker[]): NextStep[] {
  const steps = [...blockers.map((b) => BLOCKER_STEP[b]), ...CATEGORY_STEPS[category]];
  return [...new Set(steps)].slice(0, 4);
}

/** AI agent roles from the "Build your AI team" library that fit the process (none for plain workflows). */
export function suggestAgents(area: Department, pattern: Pattern, approvalRequired: boolean): AgentKey[] {
  if (pattern === "workflow_automation" || pattern === "fix_first") return [];
  const byArea = recommendAgents({}, [area]).map((r) => r.agent).filter((a) => AGENTS[a].role === "task");
  const agents: AgentKey[] = [];
  if (pattern === "ai_extraction") agents.push(area === "support" ? "customer_support" : area === "sales" || area === "marketing" ? "lead_qualification" : "document_processing");
  agents.push(...byArea.slice(0, 1));
  if (pattern === "agent_workflow") agents.push("workflow_coordinator");
  if (approvalRequired) agents.push("approval_supervisor");
  return [...new Set(agents)];
}

export function assessProcess(process: ProcessInput, index: number): Omit<Opportunity, "rank"> | null {
  if (missingCriteria(process.ratings).length > 0) return null;
  const ratings = process.ratings as Required<Ratings>;
  const { fit, value, effort, contributions, suitability } = subscores(ratings);
  const rounded = Math.round(suitability);
  const category = categorise(fit, value, effort, rounded, ratings);
  const pattern = recommendPattern(ratings, category);
  // Approval is a property of an automation; a process that is not ready yet gets none.
  const approvalRequired = pattern !== "fix_first" && (ratings.compliance_risk >= 3 || ratings.oversight_needs >= 3);
  const blockers = findBlockers(ratings);
  return {
    index,
    name: process.name.trim(),
    area: process.area,
    fit: Math.round(fit),
    value: Math.round(value),
    effort: Math.round(effort),
    suitability: rounded,
    breakdown: Object.fromEntries(CRITERIA.map((c) => [c, Math.round(favourability(c, ratings[c]) * 100)])) as Record<Criterion, number>,
    contributions,
    category,
    pattern,
    approvalRequired,
    agents: suggestAgents(process.area, pattern, approvalRequired),
    blockers,
    nextSteps: nextSteps(category, blockers),
  };
}

/** Assesses every complete process and ranks them. */
export function rankOpportunities(processes: ProcessInput[]): Opportunity[] {
  return processes
    .map((process, index) => assessProcess(process, index))
    .filter((o): o is Omit<Opportunity, "rank"> => o !== null)
    .sort((a, b) => b.suitability - a.suitability || b.value - a.value || a.index - b.index)
    .map((o, i) => ({ ...o, rank: i + 1 }));
}
