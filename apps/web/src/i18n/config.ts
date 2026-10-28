/**
 * Locales and localized routing.
 *
 * Public URLs always carry the locale: `/bg/uslugi/...`, `/en/services/...`. Internally there is one
 * route tree under `app/[locale]/` whose folders use the Bulgarian segment names; `src/proxy.ts`
 * rewrites English public paths to that tree (`/en/services/x` → `/en/uslugi/x`) using the explicit
 * segment table below. Slugs of services, articles and topics are localized in the content files.
 *
 * Code builds links from canonical (Bulgarian-segment) route paths in `lib/routes.ts` and passes them
 * through `localizePath(locale, path)`. See docs/INTERNATIONALIZATION.md.
 */

import { AGENT_SLUGS } from "@/lib/agent-slugs";

export const locales = ["bg", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "bg";

/** Explicit language choice made with the language switcher (functional cookie, 1 year). */
export const LOCALE_COOKIE = "acs_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const localeMeta: Record<
  Locale,
  { htmlLang: string; ogLocale: string; label: string; short: string; dateLocale: string }
> = {
  bg: { htmlLang: "bg", ogLocale: "bg_BG", label: "Български", short: "BG", dateLocale: "bg-BG" },
  en: { htmlLang: "en", ogLocale: "en_US", label: "English", short: "EN", dateLocale: "en-GB" },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Bulgarian route segment (= folder name) → English public segment. Identical segments are omitted. */
const EN_SEGMENTS: Record<string, string> = {
  uslugi: "services",
  "ai-resheniya": "ai-solutions",
  "za-kogo": "industries",
  proces: "process",
  "za-nas": "about",
  kontakti: "contact",
  statii: "insights",
  proekti: "case-studies",
  instrumenti: "tools",
  poveritelnost: "privacy",
  biskvitki: "cookies",
  "obshti-usloviya": "terms",
  "ai-agenti": "ai-agents",
};
/** Second-level segments (e.g. `/statii/tema/<topic>`). */
const EN_SUBSEGMENTS: Record<string, Record<string, string>> = {
  statii: { tema: "topic" },
  "za-nas": { osnovatel: "founder" },
  // Tool slugs (lib/tools.ts → TOOL_SLUGS). Only implemented tools have pages.
  instrumenti: { "ai-gotovnost": "ai-readiness", "ai-ekip": "ai-team", "roi-kalkulator": "roi-calculator", "avtomatizatsii": "automation-finder", "ai-reshenie": "solution-builder" },
  // Agent library pages (lib/agent-library.ts → AGENT_SLUGS).
  "ai-agenti": Object.fromEntries(Object.values(AGENT_SLUGS).map(({ bg, en }) => [bg, en])),
};

const BG_SEGMENTS = Object.fromEntries(Object.entries(EN_SEGMENTS).map(([bg, en]) => [en, bg]));
const BG_SUBSEGMENTS: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(EN_SUBSEGMENTS).map(([parent, map]) => [
    EN_SEGMENTS[parent] ?? parent,
    Object.fromEntries(Object.entries(map).map(([bg, en]) => [en, bg])),
  ]),
);

/** Query parameter names used by internal links; English URLs use English names. */
const EN_QUERY: Record<string, string> = { usluga: "service", tip: "type" };
const EN_QUERY_VALUES: Record<string, Record<string, string>> = { tip: { oferta: "quote" } };
const BG_QUERY = Object.fromEntries(Object.entries(EN_QUERY).map(([bg, en]) => [en, bg]));
const BG_QUERY_VALUES: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(EN_QUERY_VALUES).map(([bgName, map]) => [
    EN_QUERY[bgName],
    Object.fromEntries(Object.entries(map).map(([bg, en]) => [en, bg])),
  ]),
);

function mapSegments(segments: string[], top: Record<string, string>, sub: Record<string, Record<string, string>>) {
  if (segments.length === 0) return segments;
  const [first, second, ...rest] = segments;
  const mappedFirst = top[first] ?? first;
  if (second === undefined) return [mappedFirst];
  const mappedSecond = sub[first]?.[second] ?? second;
  return [mappedFirst, mappedSecond, ...rest];
}

/** Translate query parameter names/values between the canonical (bg) and English forms. */
export function localizeSearch(search: string, locale: Locale): string {
  if (!search || search === "?") return "";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out = new URLSearchParams();
  for (const [name, value] of params) {
    if (locale === "en") {
      out.append(EN_QUERY[name] ?? name, EN_QUERY_VALUES[name]?.[value] ?? value);
    } else {
      out.append(BG_QUERY[name] ?? name, BG_QUERY_VALUES[name]?.[value] ?? value);
    }
  }
  const text = out.toString();
  return text ? `?${text}` : "";
}

/**
 * Public URL for a canonical route path (Bulgarian segments, as built by `lib/routes.ts`).
 *   localizePath("bg", "/uslugi/seo")            → "/bg/uslugi/seo"
 *   localizePath("en", "/kontakti?usluga=seo")    → "/en/contact?service=seo"
 */
export function localizePath(locale: Locale, path: string): string {
  const [rawPath, ...queryParts] = (path.startsWith("/") ? path : `/${path}`).split("?");
  const search = queryParts.length ? `?${queryParts.join("?")}` : "";
  const segments = rawPath.split("/").filter(Boolean);
  const mapped = locale === "en" ? mapSegments(segments, EN_SEGMENTS, EN_SUBSEGMENTS) : segments;
  const body = mapped.length ? `/${mapped.join("/")}` : "";
  return `/${locale}${body}${localizeSearch(search, locale)}`;
}

/** Split `/en/services/x` into locale + remaining segments; `null` when there is no locale prefix. */
export function splitLocale(pathname: string): { locale: Locale; segments: string[] } | null {
  const segments = pathname.split("/").filter(Boolean);
  if (!isLocale(segments[0])) return null;
  return { locale: segments[0], segments: segments.slice(1) };
}

/** Public URL path → internal route path (`/en/services/x` → `/en/uslugi/x`). Bulgarian paths are unchanged. */
export function toInternalPath(pathname: string): string {
  const parsed = splitLocale(pathname);
  if (!parsed || parsed.locale !== "en") return pathname;
  const mapped = mapSegments(parsed.segments, BG_SEGMENTS, BG_SUBSEGMENTS);
  return `/en${mapped.length ? `/${mapped.join("/")}` : ""}`;
}

/** Whether an English public path uses a Bulgarian segment name (e.g. `/en/uslugi`) — not a public URL. */
export function usesInternalSegments(pathname: string): boolean {
  const parsed = splitLocale(pathname);
  if (!parsed || parsed.locale !== "en" || parsed.segments.length === 0) return false;
  const [first, second] = parsed.segments;
  if (first in EN_SEGMENTS) return true;
  return second !== undefined && second in (EN_SUBSEGMENTS[BG_SEGMENTS[first] ?? ""] ?? {});
}

/**
 * Internal route path (what `usePathname()` returns after the proxy rewrite) → public URL path.
 * `/en/uslugi/x` → `/en/services/x`; Bulgarian and already-public paths are unchanged.
 */
export function toPublicPath(pathname: string): string {
  const parsed = splitLocale(pathname);
  if (!parsed) return pathname;
  if (parsed.locale === "bg") return pathname === "/bg/" ? "/bg" : pathname;
  return localizePath("en", `/${parsed.segments.join("/")}`);
}

/** Canonical (Bulgarian-segment, locale-free) route path of a public URL path. */
export function toCanonicalPath(pathname: string): string {
  const internal = toInternalPath(pathname);
  const parsed = splitLocale(internal);
  if (!parsed) return pathname;
  return `/${parsed.segments.join("/")}`;
}

/** Cross-locale slug tables passed to the language switcher (bgSlug → enSlug per section). */
export interface SlugMap {
  services: Record<string, string>;
  articles: Record<string, string>;
  topics: Record<string, string>;
}

function translateSlug(table: Record<string, string>, slug: string, from: Locale, to: Locale): string | null {
  if (from === to) return slug;
  if (from === "bg") return table[slug] ?? null;
  const entry = Object.entries(table).find(([, en]) => en === slug);
  return entry ? entry[0] : null;
}

/**
 * Equivalent public URL in another locale. Unknown or untranslated pages fall back to the target
 * locale's homepage. Only internal query parameters (service, quote) are carried over.
 */
export function alternateLocalePath(publicPath: string, search: string, target: Locale, slugs: SlugMap): string {
  const parsed = splitLocale(publicPath);
  if (!parsed) return localizePath(target, "/");
  const from = parsed.locale;
  const canonical = toCanonicalPath(publicPath).split("/").filter(Boolean);
  const [section, second, third] = canonical;

  let path: string | null = `/${canonical.join("/")}`;
  if (section === "uslugi" && second) {
    const slug = translateSlug(slugs.services, second, from, target);
    path = slug ? `/uslugi/${slug}` : null;
  } else if (section === "statii" && second === "tema" && third) {
    const slug = translateSlug(slugs.topics, third, from, target);
    path = slug ? `/statii/tema/${slug}` : null;
  } else if (section === "statii" && second) {
    const slug = translateSlug(slugs.articles, second, from, target);
    path = slug ? `/statii/${slug}` : null;
  } else if (section === "proekti" && second) {
    path = null;
  }
  if (path === null) return localizePath(target, "/");

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const kept = new URLSearchParams();
  for (const [name, value] of params) {
    if (["usluga", "service", "tip", "type"].includes(name)) kept.append(name, value);
  }
  // Normalise to canonical names first, then localize for the target.
  const canonicalSearch = localizeSearch(kept.toString(), "bg");
  return localizePath(target, `${path}${canonicalSearch}`);
}
