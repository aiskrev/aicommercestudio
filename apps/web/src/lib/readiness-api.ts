/**
 * Browser client for /api/public/readiness/* (same-origin, proxied to FastAPI).
 *
 * Only answer levels (0–4), the locale and the model version are sent for a report; the server
 * re-scores them, renders the PDF and stores nothing. A submission adds contact details and is sent
 * only when the visitor submits the "send to the team" form.
 */
import type { Locale } from "@/i18n/config";
import { type SubmitResult, submitLead } from "@/lib/public-api";
import { READINESS_MODEL_VERSION, READINESS_SCHEMA_VERSION, type ReadinessAnswers } from "@/lib/readiness";

export type ReportResult =
  | { ok: true; blob: Blob; fileName: string }
  | {
      ok: false;
      /** stale: the page was built with another scoring model version (reload needed). */
      kind: "validation" | "stale" | "rejected" | "rate_limited" | "unavailable" | "network" | "server";
      message?: string;
      fieldErrors?: Record<string, string>;
    };

export interface ReadinessMeta {
  model_version: string;
  privacy_notice_version: string;
  marketing_consent_version: string;
  retention_days: number;
  /** Whether the server sends e-mails to visitors. Today always false: nothing is promised by e-mail. */
  email_delivery: boolean;
}

export function readinessRequestBase(answers: ReadinessAnswers, locale: Locale, clientOverall?: number) {
  return {
    schema_version: READINESS_SCHEMA_VERSION,
    model_version: READINESS_MODEL_VERSION,
    locale,
    answers,
    client_overall: clientOverall,
  };
}

function fileNameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export async function requestReadinessReport(input: {
  answers: ReadinessAnswers;
  locale: Locale;
  company?: string;
  formToken: string;
  clientOverall?: number;
}): Promise<ReportResult> {
  let response: Response;
  try {
    response = await fetch("/api/public/readiness/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": input.locale },
      body: JSON.stringify({
        ...readinessRequestBase(input.answers, input.locale, input.clientOverall),
        company: input.company?.trim() || undefined,
        form_token: input.formToken,
      }),
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (response.ok && response.headers.get("content-type")?.startsWith("application/pdf")) {
    const fallback = input.locale === "en" ? "ai-readiness-report.pdf" : "ai-gotovnost-otchet.pdf";
    return { ok: true, blob: await response.blob(), fileName: fileNameFrom(response.headers.get("content-disposition"), fallback) };
  }

  const data = (await response.json().catch(() => ({}))) as {
    detail?: string;
    errors?: { field: string | null; message: string; type?: string }[];
  };
  if (response.status === 422) {
    const errors = data.errors ?? [];
    const stale = errors.find((e) => e.type === "readiness_model" || e.field === "schema_version");
    if (stale) return { ok: false, kind: "stale", message: stale.message };
    const fieldErrors: Record<string, string> = {};
    for (const error of errors) if (error.field && !fieldErrors[error.field]) fieldErrors[error.field] = error.message;
    return { ok: false, kind: "validation", message: data.detail, fieldErrors };
  }
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  if (response.status === 400) return { ok: false, kind: "rejected", message: data.detail };
  if (response.status === 503) return { ok: false, kind: "unavailable", message: data.detail };
  return { ok: false, kind: "server" };
}

export async function fetchReadinessMeta(): Promise<ReadinessMeta | null> {
  try {
    const response = await fetch("/api/public/readiness/meta", { cache: "no-store" });
    return response.ok ? ((await response.json()) as ReadinessMeta) : null;
  } catch {
    return null;
  }
}

export interface ReadinessContact {
  name: string;
  email: string;
  company: string;
  role: string;
  message: string;
  consultation_requested: boolean;
  privacy_acknowledged: boolean;
  marketing_consent: boolean;
  /** Honeypot: stays empty for people. */
  website: string;
}

export function submitReadiness(input: {
  answers: ReadinessAnswers;
  locale: Locale;
  contact: ReadinessContact;
  formToken: string;
  clientOverall?: number;
}): Promise<SubmitResult> {
  return submitLead(
    {
      ...readinessRequestBase(input.answers, input.locale, input.clientOverall),
      ...input.contact,
      form_token: input.formToken,
    },
    "/api/public/readiness/submissions",
    input.locale,
  );
}

/** Saves a Blob through a temporary object URL (no new window, nothing kept in memory afterwards). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
