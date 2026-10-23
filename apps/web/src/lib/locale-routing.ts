import { defaultLocale, locales } from "@/i18n/config";

export type RoutingDecision =
  | { type: "next" }
  | { type: "redirect"; location: string }
  | { type: "rewrite"; pathname: string };

/**
 * Pure routing decision used by `src/proxy.ts` (kept separate so it can be unit-tested).
 * - `/admin/*`: requires a session cookie, otherwise redirect to the login page
 *   (the API still validates the session on every request — this is only a UX guard).
 * - `/bg/...` (default locale prefix): redirect to the unprefixed canonical URL.
 * - other locale prefixes: served as-is.
 * - everything else: rewritten internally to the default locale.
 */
export function decideRoute(pathname: string, hasSessionCookie: boolean): RoutingDecision {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return { type: "next" };
    if (!hasSessionCookie) {
      return { type: "redirect", location: `/admin/login?next=${encodeURIComponent(pathname)}` };
    }
    return { type: "next" };
  }

  const prefix = `/${defaultLocale}`;
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return { type: "redirect", location: pathname.slice(prefix.length) || "/" };
  }

  const first = pathname.split("/")[1] ?? "";
  if ((locales as readonly string[]).includes(first)) return { type: "next" };

  return { type: "rewrite", pathname: `${prefix}${pathname === "/" ? "" : pathname}` };
}
