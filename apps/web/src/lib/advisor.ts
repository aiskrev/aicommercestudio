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
}

export type AdvisorField = keyof AdvisorValues;
export type AdvisorErrors = Partial<Record<AdvisorField, string>>;

export const emptyAdvisorValues = (): AdvisorValues => ({
  business_type: "",
  process_description: "",
  monthly_volume: "",
  team_size: "",
  tools: [],
  other_tools: "",
  save_assessment: true,
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
  return errors;
}

/** Selecting "none" clears the other tools, and selecting a tool clears "none". */
export function toggleTool(current: Tool[], tool: Tool): Tool[] {
  if (current.includes(tool)) return current.filter((t) => t !== tool);
  if (tool === "none") return ["none"];
  return [...current.filter((t) => t !== "none"), tool];
}

export function toAdvisorPayload(values: AdvisorValues, formToken: string) {
  return {
    business_type: values.business_type,
    process_description: values.process_description.trim(),
    monthly_volume: values.monthly_volume,
    team_size: values.team_size,
    tools: values.tools,
    other_tools: values.other_tools.trim(),
    save_assessment: values.save_assessment,
    form_token: formToken,
  };
}

export type AdvisorResult =
  | { ok: true; data: AdvisorResponse }
  | { ok: false; kind: "validation"; message: string; fieldErrors: AdvisorErrors }
  | { ok: false; kind: "rate_limited" | "network" | "timeout" | "token" | "server"; message?: string };

export async function fetchAdvisorStatus(): Promise<AdvisorStatus | null> {
  try {
    const response = await fetch("/api/public/advisor/status", { cache: "no-store" });
    return response.ok ? ((await response.json()) as AdvisorStatus) : null;
  } catch {
    return null;
  }
}

export async function requestAssessment(payload: ReturnType<typeof toAdvisorPayload>): Promise<AdvisorResult> {
  let response: Response;
  try {
    response = await fetch("/api/public/advisor/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      const field = error.field as AdvisorField | null;
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
