import {
  defaultLocale,
  isLocale,
  type Locale,
  localizePath,
  splitLocale,
  toCanonicalPath,
  toInternalPath,
  usesInternalSegments,
} from "@/i18n/config";

export type RoutingDecision =
  | { type: "next" }
  | { type: "redirect"; location: string; permanent: boolean }
  | { type: "rewrite"; pathname: string };

/**
 * Pure routing decision used by `src/proxy.ts` (kept separate so it can be unit-tested).
 * - `/admin/*`: requires a session cookie, otherwise redirect to the login page
 *   (the API still validates the session on every request — this is only a UX guard).
 * - `/`: temporary redirect to the explicitly chosen language (cookie) or Bulgarian. No IP or
 *   location based detection is used.
 * - `/bg/...`: served as-is (internal folders use Bulgarian segment names).
 * - `/en/...`: English public segments are rewritten to the internal tree; Bulgarian segment
 *   names under `/en` redirect to the canonical English URL (no duplicate URLs).
 * - anything else: legacy unprefixed Bulgarian URL → permanent redirect to `/bg/...`.
 * `search` (including the leading "?") is preserved on redirects.
 */
export function decideRoute(
  pathname: string,
  hasSessionCookie: boolean,
  preferredLocale?: string | null,
  search = "",
  /**
   * This locale's slug of a service (or service hub) whose slug in the other language is `slug`, or `null`
   * (lib/service-slugs.ts). A service URL with the other language's slug is sent, in one permanent redirect, to
   * the right page instead of a 404 (Search Console reported /uslugi/technical-audit, 2026-11-12).
   */
  serviceSlugFor?: (locale: Locale, slug: string) => string | null,
): RoutingDecision {
  const wrongLanguageService = (locale: Locale, canonical: string): string | null => {
    const [section, slug, ...rest] = canonical.split("/").filter(Boolean);
    if (section !== "uslugi" || !slug || rest.length > 0 || !serviceSlugFor) return null;
    const translated = serviceSlugFor(locale, slug);
    return translated && translated !== slug ? `${localizePath(locale, `/uslugi/${translated}`)}${search}` : null;
  };

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return { type: "next" };
    if (!hasSessionCookie) {
      return { type: "redirect", location: `/admin/login?next=${encodeURIComponent(pathname)}`, permanent: false };
    }
    return { type: "next" };
  }

  // Client portal: its own root layout and language handling; the API checks the portal session.
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return { type: "next" };

  if (pathname === "/") {
    const locale: Locale = isLocale(preferredLocale) ? preferredLocale : defaultLocale;
    return { type: "redirect", location: `/${locale}${search}`, permanent: false };
  }

  const parsed = splitLocale(pathname);
  if (!parsed) {
    const service = wrongLanguageService(defaultLocale, pathname);
    if (service) return { type: "redirect", location: service, permanent: true };
    return { type: "redirect", location: `${localizePath(defaultLocale, pathname)}${search}`, permanent: true };
  }
  const service = wrongLanguageService(parsed.locale, toCanonicalPath(pathname));
  if (service) return { type: "redirect", location: service, permanent: true };
  if (parsed.locale === "bg") return { type: "next" };

  if (usesInternalSegments(pathname)) {
    return {
      type: "redirect",
      location: localizePath("en", `${toCanonicalPath(pathname)}${search}`),
      permanent: true,
    };
  }
  const internal = toInternalPath(pathname);
  return internal === pathname ? { type: "next" } : { type: "rewrite", pathname: internal };
}
