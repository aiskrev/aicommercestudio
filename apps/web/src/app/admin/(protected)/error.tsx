"use client";

import { useEffect } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Alert, Button, ButtonLink } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";

/** Error boundary inside the admin shell: navigation stays usable while the page fails. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useAdminI18n().t.errorPage;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-10">
      <Alert tone="error" role="alert" title={t.title}>
        <p>{t.body}</p>
        {error.digest && <p className="mt-1 font-mono text-xs">{fmt(t.code, { code: error.digest })}</p>}
      </Alert>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button icon="refresh" onClick={reset}>
          {t.retry}
        </Button>
        <ButtonLink href="/admin" variant="secondary">
          {t.toDashboard}
        </ButtonLink>
      </div>
    </div>
  );
}
