import { CONFIGURATOR_MODEL_VERSION, type ConfiguratorAnswers, type ConfiguratorReview } from "@/lib/configurator";

/**
 * Browser client of the project configurator (same-origin, proxied to FastAPI). Only enumerated answers are sent
 * for a review; the server computes everything, including every amount. Contact details are sent only with an
 * explicit quote request.
 */
export type ReviewResult =
  | { ok: true; review: ConfiguratorReview }
  | { ok: false; kind: "unsupported"; rules: string[] }
  | { ok: false; kind: "stale" | "rate_limited" | "unavailable" | "failed" };

export async function reviewConfiguration(answers: ConfiguratorAnswers): Promise<ReviewResult> {
  let response: Response;
  try {
    response = await fetch("/api/public/configurator/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_version: CONFIGURATOR_MODEL_VERSION, answers }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, kind: "failed" };
  }
  const data = (await response.json().catch(() => ({}))) as { code?: string; errors?: { type?: string }[] } & Partial<ConfiguratorReview>;
  if (response.ok && data.package) return { ok: true, review: data as ConfiguratorReview };
  if (response.status === 422 && data.code === "unsupported_combination") {
    return { ok: false, kind: "unsupported", rules: (data.errors ?? []).map((error) => error.type ?? "").filter(Boolean) };
  }
  if (response.status === 422 && (data.errors ?? []).some((error) => error.type === "configurator_model")) return { ok: false, kind: "stale" };
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  if (response.status === 404) return { ok: false, kind: "unavailable" };
  return { ok: false, kind: "failed" };
}

export interface QuoteContact {
  name: string;
  email: string;
  company: string;
  phone: string;
  goals: string;
  special_requirements: string;
  privacy_acknowledged: boolean;
  marketing_consent: boolean;
  website: string;
}

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; kind: "validation"; fieldErrors: Record<string, string> }
  | { ok: false; kind: "unsupported" | "rate_limited" | "token" | "spam" | "failed" };

/** `submissionId` is created once per review, so a repeated click or a retry returns the same lead. */
export async function submitConfiguration(
  answers: ConfiguratorAnswers,
  contact: QuoteContact,
  submissionId: string,
  formToken: string,
  locale: string,
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch("/api/public/configurator/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": locale },
      body: JSON.stringify({ model_version: CONFIGURATOR_MODEL_VERSION, answers, submission_id: submissionId, locale, form_token: formToken, ...contact }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, kind: "failed" };
  }
  const data = (await response.json().catch(() => ({}))) as { reference?: string; code?: string; errors?: { field: string | null; message: string }[] };
  if ((response.status === 201 || response.status === 200) && data.reference) return { ok: true, reference: data.reference };
  if (response.status === 422 && data.code === "unsupported_combination") return { ok: false, kind: "unsupported" };
  if (response.status === 422) {
    const fieldErrors: Record<string, string> = {};
    for (const error of data.errors ?? []) if (error.field && !fieldErrors[error.field]) fieldErrors[error.field] = error.message;
    return { ok: false, kind: "validation", fieldErrors };
  }
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  if (response.status === 400 && data.code === "form_token_invalid") return { ok: false, kind: "token" };
  if (response.status === 400 && data.code === "spam_suspected") return { ok: false, kind: "spam" };
  return { ok: false, kind: "failed" };
}
