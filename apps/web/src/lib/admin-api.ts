/** Browser-side client for the protected admin API. Sends the CSRF token on state-changing calls. */

import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

/** Error from the admin API, carrying the server's machine-readable `code` and `requestId`. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
    public code: string = "error",
    public requestId: string | null = null,
  ) {
    super(message);
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (UNSAFE.has(method)) {
    const csrf = readCookie(site.csrfCookieName);
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, method, headers, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "Няма връзка със сървъра.", {}, "network_error");
  }

  if (response.status === 401 && !path.endsWith("/auth/login")) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    // A full page load is intentional: it discards all client state of the expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${routes.adminLogin}?next=${next}`);
    throw new ApiError(401, "Сесията е изтекла.", {}, "unauthorized");
  }
  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const body = data as {
      detail?: unknown;
      code?: string;
      request_id?: string | null;
      errors?: { field: string | null; message: string }[];
    };
    const fieldErrors: Record<string, string> = {};
    for (const error of body.errors ?? []) {
      if (error.field) fieldErrors[error.field] = error.message;
    }
    const message = typeof body.detail === "string" ? body.detail : "Възникна грешка.";
    throw new ApiError(
      response.status,
      message,
      fieldErrors,
      body.code ?? "error",
      body.request_id ?? response.headers.get("x-request-id"),
    );
  }
  return data as T;
}

/** Only allow redirects back into the admin area (prevents open redirects via ?next=). */
export function safeAdminRedirect(next: string | null | undefined): string {
  if (next && next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/admin/login")) return next;
  return routes.admin;
}
