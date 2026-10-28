"use client";

import { type MouseEvent, useSyncExternalStore } from "react";

import { cx } from "@/components/ui/primitives";
import {
  alternateLocalePath,
  type Locale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  localeMeta,
  locales,
  localizePath,
  type SlugMap,
} from "@/i18n/config";
import { usePublicPathname } from "@/lib/use-public-pathname";

export interface LanguageSwitcherLabels {
  label: string;
  switchTo: Record<Locale, string>;
  current: string;
}

/** Remember an explicit language choice (functional cookie; no tracking, no location detection). */
export function rememberLocale(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/** The page's own hreflang alternate for `target` (pathname), from the metadata in <head>. */
function headAlternate(target: Locale): string {
  const link = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${localeMeta[target].htmlLang}"]`);
  return link?.href ? new URL(link.href).pathname : "";
}

const noSubscription = () => () => {};

/**
 * Pages whose slugs are not in the static slug map (entries that exist only in the published service
 * catalogue) still declare reciprocal hreflang alternates. When the map has no translation, the
 * switcher uses that alternate instead of falling back to the other language's homepage.
 */
function withHeadFallback(mapped: string, target: Locale, pathname: string, alternate: string): string {
  const isFallback = mapped.split("?")[0] === localizePath(target, "/");
  const onHomepage = pathname === localizePath("bg", "/") || pathname === localizePath("en", "/");
  return isFallback && !onHomepage && alternate ? alternate : mapped;
}

/**
 * BG | EN switcher. Links point to the equivalent page in the other language (or that language's
 * homepage when no translation exists). Switching locale changes the root layout (`<html lang>`),
 * so it is a regular navigation that keeps browser history; the service/quote query is preserved.
 */
export function LanguageSwitcher({
  locale,
  slugs,
  labels,
  className,
}: {
  locale: Locale;
  slugs: SlugMap;
  labels: LanguageSwitcherLabels;
  className?: string;
}) {
  const pathname = usePublicPathname();
  // Read once per render on the client; the server renders without it (no <head> access there).
  const alternates = useSyncExternalStore(
    noSubscription,
    () => locales.map((target) => headAlternate(target)).join("|"),
    () => "",
  ).split("|");
  const alternateFor = (target: Locale) => alternates[locales.indexOf(target)] ?? "";

  function onSelect(event: MouseEvent<HTMLAnchorElement>, target: Locale) {
    if (target === locale) {
      event.preventDefault();
      return;
    }
    rememberLocale(target);
    // Query parameters are only known in the browser; carry over the safe ones.
    const withQuery = withHeadFallback(
      alternateLocalePath(pathname, window.location.search, target, slugs),
      target,
      pathname,
      headAlternate(target),
    );
    if (withQuery !== event.currentTarget.getAttribute("href")) {
      event.preventDefault();
      window.location.assign(withQuery);
    }
  }

  return (
    <nav aria-label={labels.label} className={className}>
      <ul className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-line-default p-0.5 font-mono text-xs font-medium">
        {locales.map((target) => {
          const active = target === locale;
          return (
            <li key={target}>
              <a
                href={withHeadFallback(alternateLocalePath(pathname, "", target, slugs), target, pathname, alternateFor(target))}
                hrefLang={localeMeta[target].htmlLang}
                lang={localeMeta[target].htmlLang}
                aria-current={active ? "true" : undefined}
                aria-label={active ? `${labels.current}: ${localeMeta[target].label}` : labels.switchTo[target]}
                onClick={(event) => onSelect(event, target)}
                data-testid={`lang-${target}`}
                className={cx(
                  "inline-flex h-9 min-w-10 items-center justify-center rounded-[7px] px-2.5 transition-colors",
                  active ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {localeMeta[target].short}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
