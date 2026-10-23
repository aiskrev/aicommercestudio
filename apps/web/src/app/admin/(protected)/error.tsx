"use client";

import { useEffect } from "react";

import { Alert, Button, ButtonLink } from "@/components/ui/primitives";

/** Error boundary inside the admin shell: navigation stays usable while the page fails. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-10">
      <Alert tone="error" role="alert" title="Страницата не можа да се зареди">
        <p>Възникна неочаквана грешка. Данните ви не са засегнати.</p>
        {error.digest && <p className="mt-1 font-mono text-xs">Код: {error.digest}</p>}
      </Alert>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button icon="refresh" onClick={reset}>
          Опитай отново
        </Button>
        <ButtonLink href="/admin" variant="secondary">
          Към таблото
        </ButtonLink>
      </div>
    </div>
  );
}
