/**
 * Customer-facing quotation (POST /api/public/quotations/*). The holder of a secret link reads the approved
 * version of a proposal and answers once.
 *
 * The secret lives in the URL *fragment* of the page (`#t=<token>`): browsers never send a fragment to a server, so
 * it reaches neither the web server's nor the API's access logs, and the page asks for `Referrer-Policy:
 * no-referrer`. It is sent to the API in a request body. Nothing is written to browser storage.
 */
export const QUOTATION_FRAGMENT = "t";

export type QuotationStatus = "published" | "accepted" | "declined" | "withdrawn" | "expired";

export interface QuotationContent {
  scope: string;
  deliverables: string[];
  assumptions: string[];
  exclusions: string[];
  dependencies: string[];
  responsibilities: { party: "client" | "provider" | "shared"; item: string }[];
  acceptance_criteria: string[];
  milestones: { title: string; description: string; indicative_timing: string }[];
  risks: { risk: string; mitigation: string }[];
  commercial: { pricing_basis: string; payment_terms: string; validity: string; notes: string };
}

export interface QuotationView {
  reference: string;
  status: QuotationStatus;
  kind: "proposal" | "sow";
  title: string;
  company: string;
  locale: string;
  published_at: string;
  valid_until: string | null;
  version: number;
  content: QuotationContent | null;
  decision: { decided_at: string; name: string } | null;
  open: boolean;
}

export type QuotationResult =
  | { ok: true; quotation: QuotationView }
  | { ok: false; kind: "not_found" | "closed" | "validation" | "rate_limited" | "unavailable" | "failed" };

/** The token in the page address, or null. */
export function tokenFromFragment(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get(QUOTATION_FRAGMENT);
  return value && /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : null;
}

async function post(path: string, body: object): Promise<QuotationResult> {
  let response: Response;
  try {
    response = await fetch(`/api/public/quotations/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    return { ok: false, kind: "failed" };
  }
  const data = (await response.json().catch(() => ({}))) as Partial<QuotationView> & { code?: string };
  if (response.ok && data.reference) return { ok: true, quotation: data as QuotationView };
  if (response.status === 404 && data.code === "quotation_not_found") return { ok: false, kind: "not_found" };
  if (response.status === 404) return { ok: false, kind: "unavailable" };
  if (response.status === 409) return { ok: false, kind: "closed" };
  if (response.status === 422) return { ok: false, kind: "validation" };
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  return { ok: false, kind: "failed" };
}

export const viewQuotation = (token: string) => post("view", { token });

export const answerQuotation = (token: string, decision: "accept" | "decline", name: string, note: string) =>
  post("decision", { token, decision, name, note, confirmed: true });
