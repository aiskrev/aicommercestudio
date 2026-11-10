"use client";

import { useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import type { Locale } from "@/i18n/config";
import { marketingTexts } from "@/i18n/marketing";
import { takeTokenFromUrl } from "@/lib/account-api";

type State = "checking" | "ready" | "invalid" | "working" | "withdrawn" | "already" | "error" | "tooMany";

/**
 * Self-service withdrawal of marketing consent for an inquiry. The opaque token is in the URL fragment (never sent to
 * a server by opening the page, never in logs or Referer); it is removed from the address bar when read. One click
 * posts it, so a mail scanner that only opens the link changes nothing. The page asks for no personal data.
 */
export function MarketingWithdrawal({ locale }: { locale: Locale }) {
  const t = marketingTexts[locale];
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const found = takeTokenFromUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(found);
    setState(found && /^[0-9a-f]{64}$/i.test(found) ? "ready" : "invalid");
  }, []);

  async function confirm() {
    if (!token) return;
    setState("working");
    try {
      const response = await fetch("/api/public/marketing/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": locale },
        body: JSON.stringify({ token, locale }),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 429) return setState("tooMany");
      if (response.status === 404) return setState("invalid");
      if (!response.ok) return setState("error");
      const data = (await response.json()) as { status?: string };
      setState(data.status === "already_withdrawn" ? "already" : "withdrawn");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="max-w-2xl space-y-4" data-testid="marketing-withdrawal">
      {state === "checking" && <p>{t.working}</p>}
      {(state === "ready" || state === "working" || state === "error" || state === "tooMany") && (
        <>
          {state === "error" && (
            <Alert tone="error" role="alert">
              {t.error}
            </Alert>
          )}
          {state === "tooMany" && (
            <Alert tone="error" role="alert">
              {t.tooMany}
            </Alert>
          )}
          <Button type="button" loading={state === "working"} loadingLabel={t.working} onClick={() => void confirm()}>
            {t.confirm}
          </Button>
          <p className="text-sm text-fg-muted">{t.note}</p>
        </>
      )}
      {state === "withdrawn" && (
        <Alert tone="success" role="status">
          <strong>{t.doneTitle}</strong>
          <p>{t.done}</p>
        </Alert>
      )}
      {state === "already" && (
        <Alert tone="info" role="status">
          <strong>{t.alreadyTitle}</strong>
          <p>{t.already}</p>
        </Alert>
      )}
      {state === "invalid" && (
        <Alert tone="error" role="alert">
          <strong>{t.invalidTitle}</strong>
          <p>{t.invalid}</p>
        </Alert>
      )}
    </div>
  );
}
