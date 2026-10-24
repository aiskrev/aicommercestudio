import type { ServiceKey } from "@/content/types";

/**
 * AI Readiness Assessment — pure, deterministic logic (no network, no personal data).
 * Five dimensions, two questions each, every answer scored 0–3. Texts: content/{bg,en}/tool-readiness.ts.
 */
export const READINESS_DIMENSIONS = ["data", "processes", "systems", "people", "governance"] as const;
export type ReadinessDimension = (typeof READINESS_DIMENSIONS)[number];

export const READINESS_QUESTIONS: Record<ReadinessDimension, readonly [string, string]> = {
  data: ["data_location", "data_quality"],
  processes: ["process_definition", "process_volume"],
  systems: ["systems_access", "systems_landscape"],
  people: ["people_owner", "people_time"],
  governance: ["governance_privacy", "governance_approval"],
};

/** Question ids in a fixed order (used for validation and the share code). */
export const READINESS_QUESTION_ORDER: string[] = READINESS_DIMENSIONS.flatMap((d) => [...READINESS_QUESTIONS[d]]);

export const ANSWER_SCORES = [0, 1, 2, 3] as const;
export type AnswerScore = (typeof ANSWER_SCORES)[number];
export type ReadinessAnswers = Partial<Record<string, AnswerScore>>;

export type ReadinessLevel = "early" | "developing" | "ready";

export interface DimensionScore {
  dimension: ReadinessDimension;
  /** 0–100 */
  score: number;
}

export interface Recommendation {
  dimension: ReadinessDimension | "pilot";
  service: ServiceKey;
}

export interface ReadinessResult {
  overall: number;
  level: ReadinessLevel;
  dimensions: DimensionScore[];
  /** Weakest dimensions first; a pilot recommendation when nothing is weak. */
  recommendations: Recommendation[];
}

/** Below this a dimension gets a recommendation. */
export const WEAK_THRESHOLD = 60;

const RECOMMENDED_SERVICE: Record<ReadinessDimension, ServiceKey> = {
  data: "integrations",
  processes: "audit",
  systems: "integrations",
  people: "audit",
  governance: "ai_managed",
};

/** Ids of unanswered questions in one dimension (step validation). */
export function missingAnswers(dimension: ReadinessDimension, answers: ReadinessAnswers): string[] {
  return READINESS_QUESTIONS[dimension].filter((id) => answers[id] === undefined);
}

export function isComplete(answers: ReadinessAnswers): boolean {
  return READINESS_QUESTION_ORDER.every((id) => answers[id] !== undefined);
}

export function levelFor(overall: number): ReadinessLevel {
  if (overall >= 70) return "ready";
  if (overall >= 40) return "developing";
  return "early";
}

export function scoreReadiness(answers: ReadinessAnswers): ReadinessResult {
  if (!isComplete(answers)) throw new Error("Readiness assessment is incomplete");
  const dimensions = READINESS_DIMENSIONS.map((dimension) => {
    const total = READINESS_QUESTIONS[dimension].reduce((sum, id) => sum + (answers[id] ?? 0), 0);
    return { dimension, score: Math.round((total / 6) * 100) };
  });
  const overall = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);
  const weak = dimensions
    .filter((d) => d.score < WEAK_THRESHOLD)
    .sort((a, b) => a.score - b.score || READINESS_DIMENSIONS.indexOf(a.dimension) - READINESS_DIMENSIONS.indexOf(b.dimension));
  const recommendations: Recommendation[] =
    weak.length > 0
      ? weak.slice(0, 3).map((d) => ({ dimension: d.dimension, service: RECOMMENDED_SERVICE[d.dimension] }))
      : [{ dimension: "pilot", service: "ai_agents" }];
  return { overall, level: levelFor(overall), dimensions, recommendations };
}

/** Compact, non-personal share code: one digit per question in READINESS_QUESTION_ORDER. */
export function encodeAnswers(answers: ReadinessAnswers): string {
  return READINESS_QUESTION_ORDER.map((id) => answers[id] ?? "x").join("");
}

/** Inverse of `encodeAnswers`; returns null for anything that is not a complete, valid code. */
export function decodeAnswers(code: string | null | undefined): ReadinessAnswers | null {
  if (!code || code.length !== READINESS_QUESTION_ORDER.length || !/^[0-3]+$/.test(code)) return null;
  return Object.fromEntries(READINESS_QUESTION_ORDER.map((id, i) => [id, Number(code[i]) as AnswerScore]));
}
