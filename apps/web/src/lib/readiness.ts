import type { ServiceKey } from "@/content/types";

/**
 * AI Readiness Assessment — scoring model (pure, deterministic, no network, no personal data).
 * Texts: content/{bg,en}/tool-readiness.ts. Method: docs/TOOLS_PLATFORM.md → "Readiness model".
 *
 * Six weighted dimensions, two questions each, every answer scored 0–4.
 *   dimension score = (sum of its answers / 8) × 100            → 0–100
 *   overall score   = Σ dimension score × normalised weight      → clamped to 0–100, rounded
 *   band            = from the rounded overall score (0–24 / 25–49 / 50–74 / 75–100)
 * The result is a self-assessment, never a certification.
 *
 * The API scores the same answers again (apps/api/app/readiness/scoring.py) for the PDF report and
 * submissions. Both are tested against the same golden vectors (readiness.vectors.json); change the
 * model in both places, regenerate the vectors and bump READINESS_MODEL_VERSION together.
 */

/** Must equal MODEL_VERSION in the API; the API rejects answers made with another model version. */
export const READINESS_MODEL_VERSION = "2026-11.1";
/** Version of the request shape sent to /api/public/readiness/*. */
export const READINESS_SCHEMA_VERSION = "1";

export const READINESS_DIMENSIONS = ["strategy", "infrastructure", "data", "governance", "talent", "organization"] as const;
export type ReadinessDimension = (typeof READINESS_DIMENSIONS)[number];

/** Relative weights (percent). Normalised at run time, so they always sum to 1. */
export const DIMENSION_WEIGHTS: Record<ReadinessDimension, number> = {
  strategy: 15,
  infrastructure: 15,
  data: 20,
  governance: 20,
  talent: 15,
  organization: 15,
};

export const READINESS_QUESTIONS = {
  strategy: ["strategy_goals", "strategy_use_cases"],
  infrastructure: ["tech_integration", "tech_environment"],
  data: ["data_access", "data_quality"],
  governance: ["gov_data_protection", "gov_oversight"],
  talent: ["talent_skills", "talent_support"],
  organization: ["people_ownership", "people_change"],
} as const satisfies Record<ReadinessDimension, readonly [string, string]>;

export type ReadinessQuestionId = (typeof READINESS_QUESTIONS)[ReadinessDimension][number];

/** Question ids in a fixed order (validation, share code). */
export const READINESS_QUESTION_ORDER: ReadinessQuestionId[] = READINESS_DIMENSIONS.flatMap((d) => [...READINESS_QUESTIONS[d]]);

export const MAX_ANSWER = 4;
export type AnswerScore = 0 | 1 | 2 | 3 | 4;
export type ReadinessAnswers = Partial<Record<ReadinessQuestionId, AnswerScore>>;

export type ReadinessBand = "exploration" | "foundation" | "pilot_ready" | "scaling";

/** Lower bound (inclusive) of each band on the rounded overall score. */
export const BAND_THRESHOLDS: { band: ReadinessBand; min: number }[] = [
  { band: "scaling", min: 75 },
  { band: "pilot_ready", min: 50 },
  { band: "foundation", min: 25 },
  { band: "exploration", min: 0 },
];

export type ReadinessBlocker = "governance" | "data_quality" | "integration" | "expertise" | "organisation";

export type ReadinessAction =
  | "governance_first"
  | "data_quality_first"
  | "integration_path"
  | "expertise_first"
  | "ownership_first"
  | "strategy_definition"
  | "tech_foundation"
  | "data_foundation"
  | "governance_framework"
  | "talent_enablement"
  | "people_enablement"
  | "discovery_workshop"
  | "foundation_plan"
  | "scoped_pilot"
  | "scale_operations";

export type ReadinessUseCase =
  | "knowledge_assistant"
  | "document_extraction"
  | "inquiry_triage"
  | "reply_drafting"
  | "reporting_summary"
  | "process_discovery";

export type RoadmapItem = ReadinessAction | `${ReadinessBand}_${"d30" | "d60" | "d90"}`;

export interface DimensionScore {
  dimension: ReadinessDimension;
  /** 0–100, rounded */
  score: number;
  weight: number;
}

export interface ReadinessResult {
  complete: true;
  overall: number;
  band: ReadinessBand;
  dimensions: DimensionScore[];
  blockers: ReadinessBlocker[];
  /** Dimensions scoring ≥ 75 (or the best one ≥ 50 when none reaches 75). */
  strengths: ReadinessDimension[];
  /** Dimensions scoring < 50, weakest first. */
  gaps: ReadinessDimension[];
  /** Exactly three actions, highest priority first. */
  actions: ReadinessAction[];
  useCases: ReadinessUseCase[];
  roadmap: { d30: RoadmapItem[]; d60: RoadmapItem[]; d90: RoadmapItem[] };
}

export interface IncompleteResult {
  complete: false;
  /** Unanswered question ids, in questionnaire order. */
  missing: ReadinessQuestionId[];
}

/** Service each action points to. */
export const ACTION_SERVICE: Record<ReadinessAction, ServiceKey> = {
  governance_first: "audit",
  data_quality_first: "integrations",
  integration_path: "integrations",
  expertise_first: "ai_managed",
  ownership_first: "audit",
  strategy_definition: "audit",
  tech_foundation: "integrations",
  data_foundation: "integrations",
  governance_framework: "audit",
  talent_enablement: "audit",
  people_enablement: "audit",
  discovery_workshop: "audit",
  foundation_plan: "audit",
  scoped_pilot: "ai_agents",
  scale_operations: "ai_managed",
};

const BLOCKER_ACTION: Record<ReadinessBlocker, { action: ReadinessAction; dimension: ReadinessDimension }> = {
  governance: { action: "governance_first", dimension: "governance" },
  data_quality: { action: "data_quality_first", dimension: "data" },
  integration: { action: "integration_path", dimension: "infrastructure" },
  expertise: { action: "expertise_first", dimension: "talent" },
  organisation: { action: "ownership_first", dimension: "organization" },
};

const GAP_ACTION: Record<ReadinessDimension, ReadinessAction> = {
  strategy: "strategy_definition",
  infrastructure: "tech_foundation",
  data: "data_foundation",
  governance: "governance_framework",
  talent: "talent_enablement",
  organization: "people_enablement",
};

const BAND_ACTION: Record<ReadinessBand, ReadinessAction> = {
  exploration: "discovery_workshop",
  foundation: "foundation_plan",
  pilot_ready: "scoped_pilot",
  scaling: "scale_operations",
};

/** Use cases in priority order with the minimum dimension scores they need. */
const USE_CASE_RULES: { useCase: ReadinessUseCase; requires: Partial<Record<ReadinessDimension, number>> }[] = [
  { useCase: "inquiry_triage", requires: { infrastructure: 50, organization: 50 } },
  { useCase: "document_extraction", requires: { data: 25, infrastructure: 50 } },
  { useCase: "knowledge_assistant", requires: { data: 50, governance: 50 } },
  { useCase: "reply_drafting", requires: { organization: 50, governance: 50 } },
  { useCase: "reporting_summary", requires: { data: 50 } },
];

/** Normalised weights (sum = 1), independent of how DIMENSION_WEIGHTS is expressed. */
export function normalisedWeights(weights: Record<ReadinessDimension, number> = DIMENSION_WEIGHTS): Record<ReadinessDimension, number> {
  const total = READINESS_DIMENSIONS.reduce((sum, d) => sum + Math.max(0, weights[d]), 0);
  if (total <= 0) throw new Error("Dimension weights must have a positive sum");
  return Object.fromEntries(READINESS_DIMENSIONS.map((d) => [d, Math.max(0, weights[d]) / total])) as Record<ReadinessDimension, number>;
}

export function isAnswerScore(value: unknown): value is AnswerScore {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_ANSWER;
}

/** Unanswered (or invalid) question ids, optionally limited to one dimension (step validation). */
export function missingAnswers(answers: ReadinessAnswers, dimension?: ReadinessDimension): ReadinessQuestionId[] {
  const ids = dimension ? [...READINESS_QUESTIONS[dimension]] : READINESS_QUESTION_ORDER;
  return ids.filter((id) => !isAnswerScore(answers[id]));
}

export function bandFor(score: number): ReadinessBand {
  const rounded = Math.round(clamp(score));
  return BAND_THRESHOLDS.find((t) => rounded >= t.min)!.band;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function dimensionScores(answers: Required<ReadinessAnswers>, weights = normalisedWeights()): DimensionScore[] {
  return READINESS_DIMENSIONS.map((dimension) => {
    const total = READINESS_QUESTIONS[dimension].reduce((sum, id) => sum + answers[id], 0);
    return { dimension, score: Math.round((total / (READINESS_QUESTIONS[dimension].length * MAX_ANSWER)) * 100), weight: weights[dimension] };
  });
}

/** Overall 0–100 from exact (unrounded) dimension ratios, so rounding never accumulates. */
export function overallScore(answers: Required<ReadinessAnswers>, weights = normalisedWeights()): number {
  const exact = READINESS_DIMENSIONS.reduce((sum, dimension) => {
    const total = READINESS_QUESTIONS[dimension].reduce((s, id) => s + answers[id], 0);
    return sum + (total / (READINESS_QUESTIONS[dimension].length * MAX_ANSWER)) * 100 * weights[dimension];
  }, 0);
  return Math.round(clamp(exact));
}

/**
 * Blocking conditions, in priority order — raised from specific answers regardless of the overall score:
 *   governance:   personal data not documented (≤ 1) or no decision on AI oversight (0)
 *   data_quality: data quality unknown or poor (≤ 1)
 *   integration:  systems cannot be connected or it is unknown (≤ 1)
 *   expertise:    no access to technical expertise at all (0)
 *   organisation: no real owner (≤ 1) or undiscussed resistance to change (0)
 */
export function findBlockers(answers: Required<ReadinessAnswers>): ReadinessBlocker[] {
  const blockers: ReadinessBlocker[] = [];
  if (answers.gov_data_protection <= 1 || answers.gov_oversight === 0) blockers.push("governance");
  if (answers.data_quality <= 1) blockers.push("data_quality");
  if (answers.tech_integration <= 1) blockers.push("integration");
  if (answers.talent_support === 0) blockers.push("expertise");
  if (answers.people_ownership <= 1 || answers.people_change === 0) blockers.push("organisation");
  return blockers;
}

/**
 * Top three actions. Positions 1–2: the most urgent items — blockers in priority order
 * (governance → data quality → integration → expertise → organisation), then gaps weakest-first, skipping
 * dimensions a blocker already covers; when fewer than two exist, the remaining dimensions fill in,
 * lowest score first. Position 3: always the band's next step.
 */
export function rankActions(
  band: ReadinessBand,
  blockers: ReadinessBlocker[],
  gaps: ReadinessDimension[],
  dimensionsByScore: ReadinessDimension[] = [...READINESS_DIMENSIONS],
): ReadinessAction[] {
  const covered = new Set<ReadinessDimension>();
  const urgent: ReadinessAction[] = [];
  for (const blocker of blockers) {
    urgent.push(BLOCKER_ACTION[blocker].action);
    covered.add(BLOCKER_ACTION[blocker].dimension);
  }
  for (const gap of gaps) if (!covered.has(gap)) urgent.push(GAP_ACTION[gap]);
  for (const dimension of dimensionsByScore) if (!covered.has(dimension)) urgent.push(GAP_ACTION[dimension]);
  const bandAction = BAND_ACTION[band];
  const top = urgent.filter((action, i) => action !== bandAction && urgent.indexOf(action) === i).slice(0, 2);
  return [...top, bandAction];
}

export function suitableUseCases(scores: Record<ReadinessDimension, number>): ReadinessUseCase[] {
  const eligible = USE_CASE_RULES.filter((rule) =>
    Object.entries(rule.requires).every(([dimension, min]) => scores[dimension as ReadinessDimension] >= (min ?? 0)),
  ).map((rule) => rule.useCase);
  return eligible.length > 0 ? eligible.slice(0, 3) : ["process_discovery"];
}

export function buildRoadmap(band: ReadinessBand, blockers: ReadinessBlocker[]): ReadinessResult["roadmap"] {
  const blockerItems = blockers.map((b) => BLOCKER_ACTION[b].action);
  return {
    d30: [...blockerItems.slice(0, 2), `${band}_d30`],
    d60: [...blockerItems.slice(2), `${band}_d60`],
    d90: [`${band}_d90`],
  };
}

export function scoreReadiness(answers: ReadinessAnswers): ReadinessResult | IncompleteResult {
  const missing = missingAnswers(answers);
  if (missing.length > 0) return { complete: false, missing };
  const full = answers as Required<ReadinessAnswers>;
  const weights = normalisedWeights();
  const dimensions = dimensionScores(full, weights);
  const scores = Object.fromEntries(dimensions.map((d) => [d.dimension, d.score])) as Record<ReadinessDimension, number>;
  const overall = overallScore(full, weights);
  const band = bandFor(overall);
  const blockers = findBlockers(full);
  const byScore = [...dimensions].sort(
    (a, b) => a.score - b.score || READINESS_DIMENSIONS.indexOf(a.dimension) - READINESS_DIMENSIONS.indexOf(b.dimension),
  );
  const gaps = byScore.filter((d) => d.score < 50).map((d) => d.dimension);
  const strong = [...byScore].reverse().filter((d) => d.score >= 75).map((d) => d.dimension);
  const best = byScore.at(-1)!;
  const strengths = strong.length > 0 ? strong : best.score >= 50 ? [best.dimension] : [];
  return {
    complete: true,
    overall,
    band,
    dimensions,
    blockers,
    strengths,
    gaps,
    actions: rankActions(band, blockers, gaps, byScore.map((d) => d.dimension)),
    useCases: suitableUseCases(scores),
    roadmap: buildRoadmap(band, blockers),
  };
}

/**
 * Prefix of the share code for this question set. Codes of an earlier model (12 digits without a
 * prefix) are not decoded, so an old link never maps its answers onto different questions.
 */
export const SHARE_CODE_PREFIX = "b";

/** Non-personal share code: the prefix, then one digit (0–4) per question in READINESS_QUESTION_ORDER. */
export function encodeAnswers(answers: ReadinessAnswers): string {
  return SHARE_CODE_PREFIX + READINESS_QUESTION_ORDER.map((id) => answers[id] ?? "x").join("");
}

/** Inverse of `encodeAnswers`; null for anything that is not a complete, valid code of this model. */
export function decodeAnswers(code: string | null | undefined): ReadinessAnswers | null {
  if (!code?.startsWith(SHARE_CODE_PREFIX)) return null;
  const digits = code.slice(SHARE_CODE_PREFIX.length);
  if (digits.length !== READINESS_QUESTION_ORDER.length || !/^[0-4]+$/.test(digits)) return null;
  return Object.fromEntries(READINESS_QUESTION_ORDER.map((id, i) => [id, Number(digits[i]) as AnswerScore])) as ReadinessAnswers;
}

/** The result in the API's JSON shape (`ReadinessResult.summary()`), used for the parity vectors. */
export function toApiSummary(result: ReadinessResult) {
  return {
    overall: result.overall,
    band: result.band,
    dimensions: Object.fromEntries(result.dimensions.map((d) => [d.dimension, d.score])),
    blockers: result.blockers,
    strengths: result.strengths,
    gaps: result.gaps,
    actions: result.actions,
    use_cases: result.useCases,
    roadmap: result.roadmap,
  };
}
