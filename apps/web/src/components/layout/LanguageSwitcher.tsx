"use client";

import type { MouseEvent } from "react";

import { cx } from "@/components/ui/primitives";
import {
  alternateLocalePath,
  type Locale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  localeMeta,
  locales,
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

  function onSelect(event: MouseEvent<HTMLAnchorElement>, target: Locale) {
    if (target === locale) {
      event.preventDefault();
      return;
    }
    rememberLocale(target);
    // Query parameters are only known in the browser; carry over the safe ones.
    const withQuery = alternateLocalePath(pathname, window.location.search, target, slugs);
    if (withQuery !== event.currentTarget.getAttribute("href")) {
      event.preventDefault();
      window.location.assign(withQuery);
    }
  }

  return (
    <nav aria-label={labels.label} className={className}>
      <ul className="flex items-center gap-0.5 rounded-full border border-white/10 p-0.5 text-xs font-semibold">
        {locales.map((target) => {
          const active = target === locale;
          return (
            <li key={target}>
              <a
                href={alternateLocalePath(pathname, "", target, slugs)}
                hrefLang={localeMeta[target].htmlLang}
                lang={localeMeta[target].htmlLang}
                aria-current={active ? "true" : undefined}
                aria-label={active ? `${labels.current}: ${localeMeta[target].label}` : labels.switchTo[target]}
                onClick={(event) => onSelect(event, target)}
                data-testid={`lang-${target}`}
                className={cx(
                  "inline-flex h-8 min-w-9 items-center justify-center rounded-full px-2.5 transition-colors",
                  active ? "bg-white/[0.1] text-white" : "text-slate-400 hover:text-white",
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
