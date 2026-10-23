/**
 * Locale configuration. Bulgarian is the default locale and is served without a URL prefix.
 * To add English: add "en" to `locales`, create `dictionaries/en.ts` and `content/en/*`,
 * and register them in `src/i18n/index.ts` / `src/content/index.ts`. Pages already live
 * under `app/[locale]`, so no routes have to be moved.
 */
export const locales = ["bg"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "bg";

export const localeMeta: Record<Locale, { htmlLang: string; ogLocale: string; label: string }> = {
  bg: { htmlLang: "bg", ogLocale: "bg_BG", label: "Български" },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Builds a public URL path for a locale. The default locale has no prefix. */
export function localizePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/**
 * Client components see the internally rewritten path (`/bg/uslugi`) from `usePathname()`.
 * Map it back to the public URL (`/uslugi`) so it can be compared with localized hrefs.
 */
export function toPublicPath(pathname: string): string {
  const prefix = `/${defaultLocale}`;
  if (pathname === prefix) return "/";
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}
