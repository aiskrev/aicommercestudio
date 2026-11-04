/** Browser client for the customer account API. Sends the CSRF token on state-changing calls. */

import type { Locale } from "@/i18n/config";

const CSRF_COOKIE = "acs_account_csrf";

export class AccountError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type Profile = { email: string; display_name: string | null; locale: Locale; marketing_consent: boolean };
export type AccountSession = {
  id: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string | null;
  current: boolean;
};

function csrfToken(): string | null {
  const part = document.cookie.split("; ").find((item) => item.startsWith(`${CSRF_COOKIE}=`));
  return part ? decodeURIComponent(part.slice(CSRF_COOKIE.length + 1)) : null;
}

export async function accountFetch<T>(
  path: string,
  locale: Locale,
  networkMessage: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ "Accept-Language": locale });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (method !== "GET") {
    const csrf = csrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  let response: Response;
  try {
    response = await fetch(`/api/accounts${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new AccountError(0, "network_error", networkMessage);
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, detail } = (data ?? {}) as { code?: string; detail?: unknown };
    throw new AccountError(response.status, code ?? "error", typeof detail === "string" ? detail : networkMessage);
  }
  return data as T;
}

/**
 * Takes the one-time token from the URL fragment and removes it from the address bar. A fragment
 * never reaches a server, so the token stays out of access logs and Referer headers.
 */
export function takeTokenFromUrl(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  if (token) window.history.replaceState(null, "", window.location.pathname);
  return token;
}
