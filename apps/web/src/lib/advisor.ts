/** AI automation advisor: types, client-side validation (mirrors the API) and the browser client. */

import {
  BUSINESS_TYPES,
  MONTHLY_VOLUMES,
  TEAM_SIZES,
  TOOLS,
  type AdvisorContent,
  type BusinessType,
  type MonthlyVolume,
  type TeamSize,
  type Tool,
} from "@/content/bg/advisor";
import type { DomainKey } from "@/lib/domains";

export const ADVISOR_LIMITS = { descriptionMin: 40, descriptionMax: 2000, otherToolsMax: 200, maxLinks: 3 } as const;

export type Level = "low" | "medium" | "high";

export interface AutomationAssessment {
  problem_summary: string;
  opportunities: {
    title: string;
    description: string;
    approach: "rules" | "ai_assisted" | "integration" | "reporting";
    priority: Level;
  }[];
  proposed_workflow: {
    title: string;
    description: string;
    actor: "system" | "ai" | "human";
    requires_human_approval: boolean;
  }[];
  integrations: { system: string; purpose: string; access: "read" | "write" | "read_write" }[];
  human_approvals: { decision: string; reason: string }[];
  data_protection: string[];
  risks: { risk: string; mitigation: string }[];
  complexity: { level: Level; rationale: string };
  phases: { name: string; description: string; deliverables: string[]; indicative_duration: string }[];
  clarification_questions: string[];
  next_steps: string[];
}

export interface Basis {
  source: "input" | "assessment" | "rule";
  key: string;
  label: string;
}

/** V2 insights: computed by fixed rules on the server; every item carries its basis. */
export interface AdvisorInsights {
  contract_version: "2";
  engine: string;
  opportunities: { title: string; category: "workflow_automation" | "ai_assisted" | "integration" | "reporting"; fit: Level; explanation: string; basis: Basis[] }[];
  feasibility: { level: Level; explanation: string; factors: { effect: "supports" | "limits"; text: string; basis: Basis[] }[] };
  risk: { level: Level; items: { title: string; explanation: string; basis: Basis[] }[] };
  domains: { domain: DomainKey; reason: string; basis: Basis[] }[];
  checkpoints: { step: string; reason: string; basis: Basis[] }[];
  prerequisites: { area: "integration" | "security"; text: string; basis: Basis[] }[];
  pilot: { scope: string; duration_weeks: [number, number]; success_criteria: string[]; human_in_the_loop: string; basis: Basis[] };
  roadmap: { horizon: 30 | 60 | 90; title: string; items: string[] }[] | null;
  provenance_note: string;
}

export const CONTEXT_OPTIONS = {
  goal: ["save_time", "reduce_errors", "faster_response", "handle_growth", "better_visibility"],
  data_sensitivity: ["none", "business", "personal", "financial", "special_category"],
  system_access: ["api", "exports", "manual_only", "unknown"],
  change_capacity: ["no_it", "external_it", "internal_it"],
} as const;

export interface AdvisorContextValues {
  goal: string;
  data_sensitivity: string;
  customer_facing: "" | "yes" | "no";
  system_access: string;
  change_capacity: string;
}

export interface AdvisorResponse {
  assessment_id: string | null;
  reference: string | null;
  mode: "demo" | "ai";
  provider: string;
  model: string;
  disclaimer: string;
  notices: string[];
  stored: boolean;
  expires_at: string | null;
  created_at: string;
  assessment: AutomationAssessment;
  /** Present only on the V2 contract. */
  contract_version?: "2";
  insights?: AdvisorInsights;
}

export interface AdvisorStatus {
  mode: "demo" | "ai";
  disclaimer: string;
  retention_days: number;
}

export interface AdvisorValues {
  business_type: BusinessType | "";
  process_description: string;
  monthly_volume: MonthlyVolume | "";
  team_size: TeamSize | "";
  tools: Tool[];
  other_tools: string;
  save_assessment: boolean;
  /** V2: the visitor chose to add context; the context fields then become required. */
  deeper: boolean;
  context: AdvisorContextValues;
  include_roadmap: boolean;
}

export type AdvisorField = Exclude<keyof AdvisorValues, "context" | "deeper" | "include_roadmap">;
export type ContextField = `context.${keyof AdvisorContextValues}`;
export type AdvisorErrors = Partial<Record<AdvisorField | ContextField, string>>;

export const emptyAdvisorValues = (): AdvisorValues => ({
  business_type: "",
  process_description: "",
  monthly_volume: "",
  team_size: "",
  tools: [],
  other_tools: "",
  save_assessment: true,
  deeper: false,
  context: { goal: "", data_sensitivity: "", customer_facing: "", system_access: "", change_capacity: "" },
  include_roadmap: false,
});

const URL_RE = /https?:\/\/|www\./gi;

export function validateAdvisor(values: AdvisorValues, messages: AdvisorContent["validation"]): AdvisorErrors {
  const errors: AdvisorErrors = {};
  if (!(BUSINESS_TYPES as readonly string[]).includes(values.business_type)) errors.business_type = messages.select;
  if (!(MONTHLY_VOLUMES as readonly string[]).includes(values.monthly_volume)) errors.monthly_volume = messages.select;
  if (!(TEAM_SIZES as readonly string[]).includes(values.team_size)) errors.team_size = messages.select;

  const description = values.process_description.trim();
  if (!description) errors.process_description = messages.required;
  else if (description.length < ADVISOR_LIMITS.descriptionMin)
    errors.process_description = messages.minLength.replace("{n}", String(ADVISOR_LIMITS.descriptionMin));
  else if (description.length > ADVISOR_LIMITS.descriptionMax)
    errors.process_description = messages.maxLength.replace("{n}", String(ADVISOR_LIMITS.descriptionMax));
  else if ((description.match(URL_RE) ?? []).length > ADVISOR_LIMITS.maxLinks) errors.process_description = messages.noLinks;

  if (values.tools.length === 0 || values.tools.some((t) => !(TOOLS as readonly string[]).includes(t))) {
    errors.tools = messages.tools;
  }
  const other = values.other_tools.trim();
  if (other.length > ADVISOR_LIMITS.otherToolsMax)
    errors.other_tools = messages.maxLength.replace("{n}", String(ADVISOR_LIMITS.otherToolsMax));
  else if (/https?:\/\/|www\.|[<>]/i.test(other)) errors.other_tools = messages.noLinks;

  if (values.deeper) {
    for (const [field, options] of Object.entries(CONTEXT_OPTIONS) as [keyof typeof CONTEXT_OPTIONS, readonly string[]][]) {
      if (!options.includes(values.context[field])) errors[`context.${field}`] = messages.select;
    }
    if (values.context.customer_facing !== "yes" && values.context.customer_facing !== "no") errors["context.customer_facing"] = messages.select;
  }
  return errors;
}

/** Selecting "none" clears the other tools, and selecting a tool clears "none". */
export function toggleTool(current: Tool[], tool: Tool): Tool[] {
  if (current.includes(tool)) return current.filter((t) => t !== tool);
  if (tool === "none") return ["none"];
  return [...current.filter((t) => t !== "none"), tool];
}

export function toAdvisorPayload(values: AdvisorValues, formToken: string, locale = "bg") {
  return {
    locale,
    business_type: values.business_type,
    process_description: values.process_description.trim(),
    monthly_volume: values.monthly_volume,
    team_size: values.team_size,
    tools: values.tools,
    other_tools: values.other_tools.trim(),
    save_assessment: values.save_assessment,
    form_token: formToken,
    // V1 stays the default contract; V2 only when the visitor added the context.
    ...(values.deeper
      ? {
          contract_version: "2" as const,
          context: {
            goal: values.context.goal,
            data_sensitivity: values.context.data_sensitivity,
            customer_facing: values.context.customer_facing === "yes",
            system_access: values.context.system_access,
            change_capacity: values.context.change_capacity,
          },
          include_roadmap: values.include_roadmap,
        }
      : {}),
  };
}

export type AdvisorResult =
  | { ok: true; data: AdvisorResponse }
  | { ok: false; kind: "validation"; message: string; fieldErrors: AdvisorErrors }
  | { ok: false; kind: "rate_limited" | "network" | "timeout" | "token" | "server"; message?: string };

/** Mode and disclaimer; the disclaimer comes back in the page language (Accept-Language). */
export async function fetchAdvisorStatus(locale = "bg"): Promise<AdvisorStatus | null> {
  try {
    const response = await fetch("/api/public/advisor/status", {
      cache: "no-store",
      headers: { "Accept-Language": locale },
    });
    return response.ok ? ((await response.json()) as AdvisorStatus) : null;
  } catch {
    return null;
  }
}

export async function requestAssessment(
  payload: ReturnType<typeof toAdvisorPayload>,
  locale = "bg",
): Promise<AdvisorResult> {
  let response: Response;
  try {
    response = await fetch("/api/public/advisor/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": locale },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, kind: "network" };
  }
  const data = (await response.json().catch(() => ({}))) as Partial<AdvisorResponse> & {
    detail?: string;
    code?: string;
    errors?: { field: string | null; message: string }[];
  };

  if (response.status === 201 && data.assessment) return { ok: true, data: data as AdvisorResponse };
  if (response.status === 422 && data.code === "validation_error") {
    const fieldErrors: AdvisorErrors = {};
    for (const error of data.errors ?? []) {
      const field = error.field as AdvisorField | ContextField | null;
      if (field && !fieldErrors[field]) fieldErrors[field] = error.message;
    }
    return { ok: false, kind: "validation", message: data.detail ?? "", fieldErrors };
  }
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  if (response.status === 504) return { ok: false, kind: "timeout", message: data.detail };
  if (response.status === 400 && data.code === "form_token_invalid") return { ok: false, kind: "token", message: data.detail };
  // advisor_declined / advisor_unavailable / advisor_busy / advisor_invalid_output carry a Bulgarian message.
  return { ok: false, kind: "server", message: typeof data.detail === "string" ? data.detail : undefined };
}
