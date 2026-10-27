"use client";

import { ButtonLink, Container } from "@/components/ui/primitives";
import { defaultLocale, localizePath, splitLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { routes } from "@/lib/routes";
import { usePublicPathname } from "@/lib/use-public-pathname";

/** Localized 404: the locale comes from the URL (not-found boundaries receive no params). */
export default function NotFound() {
  const locale = splitLocale(usePublicPathname())?.locale ?? defaultLocale;
  const dict = getDictionary(locale);
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="font-display text-7xl font-semibold text-gradient">404</p>
      <h1 className="t-h1 mt-6">{dict.notFound.title}</h1>
      <p className="mt-3 max-w-md text-fg-muted">{dict.notFound.lead}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={localizePath(locale, routes.home)}>{dict.notFound.back}</ButtonLink>
        <ButtonLink href={localizePath(locale, routes.services)} variant="secondary">
          {dict.common.allServices}
        </ButtonLink>
      </div>
    </Container>
  );
}
