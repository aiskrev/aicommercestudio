/** Browser-side client for the public API (same-origin, proxied to FastAPI by app/api/[...path]). */

export type SubmitResult =
  | { ok: true; reference: string; message: string }
  | { ok: false; kind: "validation"; message: string; fieldErrors: Record<string, string> }
  | { ok: false; kind: "rejected" | "rate_limited" | "network" | "server"; message?: string };

export async function fetchFormToken(): Promise<string> {
  try {
    const response = await fetch("/api/public/form-token", { cache: "no-store" });
    if (!response.ok) return "";
    const data = (await response.json()) as { token?: string };
    return data.token ?? "";
  } catch {
    return "";
  }
}

export async function submitLead(
  payload: Record<string, unknown>,
  endpoint = "/api/public/leads",
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  const data = (await response.json().catch(() => ({}))) as {
    reference?: string;
    message?: string;
    detail?: string;
    errors?: { field: string | null; message: string }[];
  };

  if (response.status === 201 && data.reference) {
    return { ok: true, reference: data.reference, message: data.message ?? "" };
  }
  if (response.status === 422) {
    const fieldErrors: Record<string, string> = {};
    for (const error of data.errors ?? []) {
      if (error.field && !fieldErrors[error.field]) fieldErrors[error.field] = error.message;
    }
    return { ok: false, kind: "validation", message: data.detail ?? "", fieldErrors };
  }
  if (response.status === 429) return { ok: false, kind: "rate_limited" };
  if (response.status === 400 || response.status === 403) {
    return { ok: false, kind: "rejected", message: data.detail };
  }
  return { ok: false, kind: "server" };
}
