/**
 * Browser client of the assessment engine API (`/api/public/assessments`, docs/ASSESSMENT_PLATFORM_ARCHITECTURE.md).
 *
 * Results are always computed on the server; the browser only sends option keys, booleans and
 * numbers. A saved result's secret token stays in memory and travels only in POST bodies.
 */

import type { DomainKey } from "@/lib/domains";

export type AssessmentKey = "cloud_platform" | "devops_delivery";
export type Evidence = "practice" | "metric" | "context";
export type FindingKind = "recommendation" | "risk" | "quick_win" | "target_state" | "pattern" | "context";
export type AnswerValue = string | string[] | number | boolean;

export interface QuestionDef {
  key: string;
  type: "single_choice" | "multi_choice" | "scale" | "boolean" | "number";
  dimension: string;
  required: boolean;
  text: string;
  help: string | null;
  unit: string | null;
  evidence: Evidence;
  options?: { key: string; label: string }[] | null;
  max_selections?: number | null;
  min?: number | null;
  max?: number | null;
  integer?: boolean | null;
}

export interface AssessmentDefinitionView {
  key: string;
  version: string;
  locale: string;
  title: string;
  intro: string;
  disclaimer: string;
  dimensions: { key: string; title: string; description: string }[];
  questions: QuestionDef[];
}

export interface Finding {
  key: string;
  title: string;
  description: string;
  kind: FindingKind;
  horizon: 30 | 60 | 90 | null;
  domains: DomainKey[];
  because: string[];
}

export interface AssessmentResultView {
  assessment: string;
  definition_version: string;
  algorithm: string;
  title: string;
  overall: number;
  band: { key: string; title: string; description: string };
  dimensions: { key: string; title: string; description: string; score: number; level: { key: string; title: string } }[];
  recommendations: Finding[];
  roadmap: { horizon: 30 | 60 | 90; items: string[] }[];
  domains: DomainKey[];
  inputs: { question: string; dimension: string; evidence: Evidence; text: string; answer: string }[];
  extras: Record<string, unknown>;
  disclaimer: string;
  saved: { reference: string; token: string | null; expires_at: string } | null;
}

export type ReportBlock =
  | { type: "paragraph"; text: string; tone: "normal" | "muted" | "notice" }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "scores"; rows: { label: string; score: number; level: string }[] }
  | {
      type: "findings";
      because_label: string;
      items: { title: string; description: string; label: string; because: string[] }[];
    };

export interface ReportDocument {
  schema_version: "1";
  locale: string;
  brand: string;
  title: string;
  subtitle: string;
  meta: { label: string; value: string }[];
  sections: { heading: string; blocks: ReportBlock[] }[];
  footer: string;
}

type Failure = { ok: false; kind: "outdated" | "invalid" | "rate_limited" | "not_found" | "conflict" | "token" | "failed"; errors?: { field: string; type: string }[] };

const BASE = "/api/public/assessments";

async function post(path: string, body: unknown, locale: string): Promise<Response | null> {
  try {
    return await fetch(`${BASE}${path}?locale=${locale}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": locale },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

async function failure(response: Response | null): Promise<Failure> {
  if (!response) return { ok: false, kind: "failed" };
  const data = (await response.json().catch(() => ({}))) as { code?: string; errors?: { field: string; type: string }[] };
  if (response.status === 409 && data.code === "assessment_version_outdated") return { ok: false, kind: "outdated" };
  if (response.status === 409) return { ok: false, kind: "conflict" };
  if (response.status === 422) return { ok: false, kind: "invalid", errors: data.errors };
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  if (response.status === 404) return { ok: false, kind: "not_found" };
  if (response.status === 400 && data.code === "form_token_invalid") return { ok: false, kind: "token" };
  return { ok: false, kind: "failed" };
}

export async function fetchDefinition(key: AssessmentKey, locale: string): Promise<AssessmentDefinitionView | null> {
  try {
    const response = await fetch(`${BASE}/${key}?locale=${locale}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as AssessmentDefinitionView) : null;
  } catch {
    return null;
  }
}

export async function scoreAssessment(
  key: AssessmentKey,
  version: string,
  answers: Record<string, AnswerValue>,
  locale: string,
  save = false,
): Promise<{ ok: true; data: AssessmentResultView } | Failure> {
  const response = await post(`/${key}/score`, { schema_version: "1", definition_version: version, locale, answers, save }, locale);
  if (response?.ok) return { ok: true, data: (await response.json()) as AssessmentResultView };
  return failure(response);
}

export async function fetchReportDocument(token: string, locale: string): Promise<{ ok: true; data: ReportDocument } | Failure> {
  const response = await post("/results/report", { token, format: "json" }, locale);
  if (response?.ok) return { ok: true, data: (await response.json()) as ReportDocument };
  return failure(response);
}

export async function fetchReportPdf(token: string, locale: string): Promise<{ ok: true; blob: Blob } | Failure> {
  const response = await post("/results/report", { token, format: "pdf" }, locale);
  if (response?.ok) return { ok: true, blob: await response.blob() };
  return failure(response);
}

export async function deleteSavedResult(token: string, locale: string): Promise<boolean> {
  const response = await post("/results/delete", { token }, locale);
  return Boolean(response && response.status === 204);
}

export interface ConsultationInput {
  name: string;
  email: string;
  company: string;
  message: string;
  privacy_acknowledged: boolean;
  marketing_consent: boolean;
  website: string;
}

export async function requestConsultation(
  token: string,
  input: ConsultationInput,
  formToken: string,
  locale: string,
): Promise<{ ok: true; reference: string } | Failure> {
  const response = await post("/results/consultation", { token, locale, form_token: formToken, ...input }, locale);
  if (response?.status === 201) return { ok: true, reference: ((await response.json()) as { reference: string }).reference };
  return failure(response);
}

/** Client-side check of one step; the server validates everything again. */
export function missingRequired(questions: QuestionDef[], answers: Record<string, AnswerValue | undefined>): string[] {
  return questions
    .filter((q) => q.required)
    .filter((q) => {
      const value = answers[q.key];
      if (value === undefined || value === "") return true;
      return Array.isArray(value) && value.length === 0;
    })
    .map((q) => q.key);
}

/** Number fields with text that is not a number in range (optional fields may stay empty). */
export function invalidNumbers(questions: QuestionDef[], answers: Record<string, AnswerValue | undefined>): string[] {
  return questions
    .filter((q) => q.type === "number")
    .filter((q) => {
      const value = answers[q.key];
      if (value === undefined || value === "") return false;
      const parsed = Number(String(value).replace(",", "."));
      if (!Number.isFinite(parsed)) return true;
      if (q.integer && !Number.isInteger(parsed)) return true;
      return (q.min != null && parsed < q.min) || (q.max != null && parsed > q.max);
    })
    .map((q) => q.key);
}

/** Answers ready for the API: empty optional fields dropped, numbers parsed. */
export function toPayload(questions: QuestionDef[], draft: Record<string, AnswerValue | undefined>): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const q of questions) {
    const value = draft[q.key];
    if (value === undefined || value === "") continue;
    if (q.type === "number" && typeof value === "string") {
      const parsed = Number(value.replace(",", "."));
      if (!Number.isFinite(parsed)) continue;
      out[q.key] = parsed;
      continue;
    }
    out[q.key] = value;
  }
  return out;
}
