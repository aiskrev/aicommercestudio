"use client";

import { useEffect } from "react";

import { Button, ButtonLink, Container } from "@/components/ui/primitives";
import { defaultLocale, localizePath, splitLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { usePublicPathname } from "@/lib/use-public-pathname";

/** Error boundary for public pages: friendly message, retry and a way home. */
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = splitLocale(usePublicPathname())?.locale ?? defaultLocale;
  const t = getDictionary(locale).error;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="badge badge-accent">{t.badge}</span>
      <h1 className="t-h1 mt-6">{t.title}</h1>
      <p className="t-lead mt-4 max-w-md">{t.lead}</p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-fg-muted">
          {t.code}: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button icon="refresh" onClick={reset}>
          {t.retry}
        </Button>
        <ButtonLink href={localizePath(locale, "/")} variant="secondary">
          {t.home}
        </ButtonLink>
      </div>
    </Container>
  );
}
