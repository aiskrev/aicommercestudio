import type { ConsultationInput } from "@/lib/assessment-api";
import { SOLUTION_MODEL_VERSION, type SolutionConfig, encodeSolution } from "@/lib/solution";

/**
 * Optional enquiry with a solution design attached (POST /api/public/solution/enquiries). Only the
 * enumerated share code is sent; the API decodes it and checks the same composition rules
 * (apps/api/app/solution/model.py) before it creates a lead.
 */
export type EnquiryResult = { ok: true; reference: string } | { ok: false; kind: "rejected" | "rate_limited" | "token" | "failed" };

export async function submitSolutionEnquiry(config: SolutionConfig, input: ConsultationInput, formToken: string, locale: string): Promise<EnquiryResult> {
  let response: Response;
  try {
    response = await fetch("/api/public/solution/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": locale },
      body: JSON.stringify({ model_version: SOLUTION_MODEL_VERSION, code: encodeSolution(config), locale, form_token: formToken, ...input }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, kind: "failed" };
  }
  const data = (await response.json().catch(() => ({}))) as { reference?: string; code?: string };
  if (response.status === 201 && data.reference) return { ok: true, reference: data.reference };
  if (response.status === 422 && data.code === "solution_invalid") return { ok: false, kind: "rejected" };
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  if (response.status === 400 && data.code === "form_token_invalid") return { ok: false, kind: "token" };
  return { ok: false, kind: "failed" };
}
