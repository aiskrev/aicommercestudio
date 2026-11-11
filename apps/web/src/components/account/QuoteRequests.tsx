"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/primitives";
import { accountTexts } from "@/i18n/account";
import type { Locale } from "@/i18n/config";
import { accountFetch, type QuoteRequestRow } from "@/lib/account-api";

/**
 * The signed-in customer's own quote and contact requests: the ones sent from this account's verified address. It is
 * read-only and shows nothing but the reference, the date, the kind and the state of a quotation (never its link or
 * content). Sending a request still needs no account (docs/ACCOUNTS_HARDENING.md).
 */
export function QuoteRequests({ locale }: { locale: Locale }) {
  const t = accountTexts[locale];
  const [rows, setRows] = useState<QuoteRequestRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    accountFetch<QuoteRequestRow[]>("/quote-requests", locale, t.network)
      .then((list) => active && setRows(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [locale, t.network]);

  const date = (value: string) => new Date(value).toLocaleDateString(locale === "bg" ? "bg-BG" : "en-GB");

  return (
    <section aria-labelledby="account-quotes" className="space-y-4" data-testid="account-quote-requests">
      <h2 id="account-quotes" className="text-xl font-semibold">
        {t.quotes.title}
      </h2>
      <p className="text-sm text-fg-muted">{t.quotes.lead}</p>
      {failed && <Alert tone="error">{t.quotes.failed}</Alert>}
      {rows && rows.length === 0 && <p className="text-sm">{t.quotes.empty}</p>}
      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.reference} className="text-sm" data-reference={row.reference}>
              <strong>{t.quotes.kinds[row.kind]}</strong> · {t.quotes.reference}: {row.reference} · {t.quotes.sent} {date(row.created_at)}
              {row.quotation_status && <span className="block text-fg-muted">{t.quotes.quotation[row.quotation_status]}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
