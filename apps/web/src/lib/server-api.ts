import { cookies } from "next/headers";

import type { AdminSession } from "@/lib/admin-types";
import { site } from "@/lib/site";

export type SessionCheck = { state: "ok"; session: AdminSession } | { state: "anonymous" } | { state: "unavailable" };

function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");
}

/** Server-side session verification for admin pages (the API remains the authority). */
export async function checkAdminSession(): Promise<SessionCheck> {
  const token = (await cookies()).get(site.sessionCookieName)?.value;
  if (!token) return { state: "anonymous" };
  try {
    const response = await fetch(`${apiBaseUrl()}/api/admin/auth/me`, {
      headers: { cookie: `${site.sessionCookieName}=${encodeURIComponent(token)}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 200) return { state: "ok", session: (await response.json()) as AdminSession };
    if (response.status === 401) return { state: "anonymous" };
    return { state: "unavailable" };
  } catch {
    return { state: "unavailable" };
  }
}
