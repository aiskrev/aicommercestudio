/**
 * Browser client for /api/public/team/* (same-origin, proxied to FastAPI).
 *
 * Only enumerated configuration values (and optional rate overrides) are sent for an estimate, a
 * PDF or a saved link; contact details travel only with an explicit consultation request.
 */
import type { Locale } from "@/i18n/config";
import { type SubmitResult, submitLead } from "@/lib/public-api";
import { type CostScenario, type SecurityKey, TEAM_MODEL_VERSION, TEAM_SCHEMA_VERSION, type TeamConfig, toApiConfig } from "@/lib/ai-team";

export type RateKey = "day_rate" | "internal_hourly_rate" | "price_per_million_input" | "price_per_million_output";
export type Overrides = Partial<Record<RateKey, number>>;

export interface TeamMeta {
  model_version: string;
  retention_days: number;
  submission_retention_days: number;
  email_delivery: boolean;
  assumptions: { version: string; currency: string; editable: Record<RateKey, { min: number; max: number; default: number }> };
}

export interface ScenarioEstimate {
  one_time: Record<"discovery" | "agents" | "integrations" | "approvals" | "deployment" | "testing" | "total", number>;
  one_time_days: Record<string, number>;
  integrations: { integration: string; complexity: "low" | "medium" | "high"; days: number }[];
  monthly: Record<"infrastructure" | "model_usage" | "monitoring" | "oversight" | "total", number>;
  usage: { tasks_per_month: number; input_tokens: number; output_tokens: number };
  oversight: { reviews_per_month: number; hours_per_month: number };
  monitoring_hours: { studio: number; internal: number };
}

export interface TeamEstimate {
  assumptions_version: string;
  currency: string;
  rates: Record<RateKey, number>;
  overrides: Overrides;
  scenarios: Record<CostScenario, ScenarioEstimate>;
  ranges: { one_time: [number, number]; monthly: [number, number] };
}

export interface DataFlow {
  kind: "read" | "act";
  agent: string | null;
  via: "orchestration" | "supervisor" | null;
  integration: string;
  approval: string | null;
}

export interface TeamPlan {
  model_version: string;
  security: SecurityKey[];
  data_flows: DataFlow[];
  estimate: TeamEstimate;
}

export type ApiFailure = {
  ok: false;
  kind: "validation" | "stale" | "rejected" | "rate_limited" | "unavailable" | "not_found" | "network" | "server";
  message?: string;
  fieldErrors?: Record<string, string>;
};
type Result<T> = { ok: true; data: T } | ApiFailure;

function base(config: TeamConfig, locale: Locale, overrides?: Overrides) {
  const clean = Object.fromEntries(Object.entries(overrides ?? {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v)));
  return {
    schema_version: TEAM_SCHEMA_VERSION,
    model_version: TEAM_MODEL_VERSION,
    locale,
    config: toApiConfig(config),
    overrides: Object.keys(clean).length > 0 ? clean : undefined,
  };
}

async function failure(response: Response): Promise<ApiFailure> {
  const data = (await response.json().catch(() => ({}))) as { detail?: string; errors?: { field: string | null; message: string; type?: string }[] };
  if (response.status === 422) {
    const errors = data.errors ?? [];
    const stale = errors.find((e) => e.type === "team_model" || e.field === "schema_version");
    if (stale) return { ok: false, kind: "stale", message: stale.message };
    const fieldErrors: Record<string, string> = {};
    for (const error of errors) if (error.field && !fieldErrors[error.field]) fieldErrors[error.field] = error.message;
    return { ok: false, kind: "validation", message: data.detail, fieldErrors };
  }
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  if (response.status === 400) return { ok: false, kind: "rejected", message: data.detail };
  if (response.status === 404) return { ok: false, kind: "not_found", message: data.detail };
  if (response.status === 503) return { ok: false, kind: "unavailable", message: data.detail };
  return { ok: false, kind: "server" };
}

async function postJson<T>(path: string, body: unknown, locale: Locale): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": locale },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, kind: "network" };
  }
  if (response.ok) return { ok: true, data: (await response.json()) as T };
  return failure(response);
}

export async function fetchTeamMeta(): Promise<TeamMeta | null> {
  try {
    const response = await fetch("/api/public/team/meta", { cache: "no-store" });
    return response.ok ? ((await response.json()) as TeamMeta) : null;
  } catch {
    return null;
  }
}

export function estimateTeam(config: TeamConfig, locale: Locale, overrides?: Overrides) {
  return postJson<TeamPlan>("/api/public/team/estimate", base(config, locale, overrides), locale);
}

export async function requestTeamReport(input: {
  config: TeamConfig;
  locale: Locale;
  overrides?: Overrides;
  company?: string;
  formToken: string;
}): Promise<{ ok: true; blob: Blob; fileName: string } | ApiFailure> {
  let response: Response;
  try {
    response = await fetch("/api/public/team/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": input.locale },
      body: JSON.stringify({ ...base(input.config, input.locale, input.overrides), company: input.company?.trim() || undefined, form_token: input.formToken }),
    });
  } catch {
    return { ok: false, kind: "network" };
  }
  if (response.ok && response.headers.get("content-type")?.startsWith("application/pdf")) {
    const name = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1];
    return { ok: true, blob: await response.blob(), fileName: name ?? (input.locale === "en" ? "ai-team-plan.pdf" : "ai-ekip-plan.pdf") };
  }
  return failure(response);
}

export function saveTeamConfiguration(config: TeamConfig, locale: Locale, overrides: Overrides | undefined, formToken: string) {
  return postJson<{ reference: string; token: string; expires_at: string }>(
    "/api/public/team/configurations",
    // Saving is an explicit, consented action: the UI sends it only after the consent box is ticked.
    { ...base(config, locale, overrides), form_token: formToken, storage_consent: true },
    locale,
  );
}

export function lookupTeamConfiguration(token: string, locale: Locale) {
  return postJson<{ reference: string; expires_at: string; model_version: string; config: unknown; overrides: Overrides }>(
    "/api/public/team/configurations/lookup",
    { token },
    locale,
  );
}

export interface TeamContact {
  name: string;
  email: string;
  company: string;
  role: string;
  message: string;
  privacy_acknowledged: boolean;
  marketing_consent: boolean;
  /** Honeypot: stays empty for people. */
  website: string;
}

export function submitTeam(input: { config: TeamConfig; locale: Locale; overrides?: Overrides; contact: TeamContact; formToken: string }): Promise<SubmitResult> {
  return submitLead(
    { ...base(input.config, input.locale, input.overrides), ...input.contact, form_token: input.formToken },
    "/api/public/team/submissions",
    input.locale,
  );
}
