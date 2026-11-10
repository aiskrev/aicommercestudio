"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import type { Locale } from "@/i18n/config";
import { billingTexts } from "@/i18n/billing";
import { AccountError, accountFetch, billingFetch, type Profile } from "@/lib/account-api";
import { company } from "@/lib/company";

type Preview = {
  offer: string;
  kind: "subscription" | "purchase";
  customer_kind: "consumer" | "business";
  concluded_at: string | null;
  period_ends_at: string | null;
  eligibility: "within_period" | "period_expired" | "business_customer" | "unknown_contract_date";
  early_start_requested: boolean;
  existing_reference: string | null;
};
type Contract = Preview & { ref: string };
type Request = { reference: string; offer: string; status: string; created_at: string };
type Done = { reference: string; created: boolean };

function day(value: string | null, locale: Locale): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { dateStyle: "long" }).format(new Date(value));
}

/**
 * "Withdraw from contract here": a separate action from cancelling a subscription. Two steps (summary and
 * statement, then confirmation). The server records the statement and sends the confirmation e-mail; the page
 * reports the reference it was given and never says that anything was refunded.
 */
export function Withdrawal({ locale }: { locale: Locale }) {
  const t = billingTexts[locale].withdrawal;
  const network = billingTexts[locale].network;
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [open, setOpen] = useState<Contract | null>(null);
  const [step, setStep] = useState<"statement" | "confirm">("statement");
  const [statement, setStatement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loadError, setLoadError] = useState<{ retryAfter: number | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, mine] = await Promise.all([
        billingFetch<Contract[]>("/contracts", locale, network),
        billingFetch<Request[]>("/withdrawals", locale, network),
      ]);
      setContracts(list);
      setRequests(mine);
      setLoadError(null);
    } catch (reason) {
      setContracts(null);
      // 404: billing (and so this function) is switched off. Anything else must not hide the function.
      if (reason instanceof AccountError && reason.status === 404) setLoadError(null);
      else setLoadError({ retryAfter: reason instanceof AccountError ? reason.retryAfter : null });
    }
  }, [locale, network]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loadError) {
    const retry = loadError.retryAfter ? t.retryIn.replace("{seconds}", String(loadError.retryAfter)) : "";
    return (
      <section aria-labelledby="withdrawal-title" className="space-y-3" data-testid="withdrawal">
        <h3 id="withdrawal-title" className="text-lg font-semibold">
          {t.title}
        </h3>
        <p className="text-sm">{t.lead}</p>
        <Alert tone="warning" role="status">
          <p data-testid="withdrawal-unavailable">
            {t.unavailable.replace("{retry}", retry).replace("{email}", company.contactEmail)}
          </p>
        </Alert>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          {t.retry}
        </Button>
      </section>
    );
  }
  if (contracts === null || (contracts.length === 0 && requests.length === 0)) return null;

  function begin(contract: Contract) {
    // Shown in the confirmation step: who the acknowledgement goes to (Directive 2011/83/EU Art. 11a(2)).
    void accountFetch<Profile>("/me", locale, network).then(setProfile, () => setProfile(null));
    setOpen(contract);
    setStep("statement");
    setStatement(t.statementDefault);
    setError(null);
    setDone(null);
  }

  async function submit() {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      const result = await billingFetch<Done>("/withdrawals", locale, network, {
        method: "POST",
        body: { ref: open.ref, statement: statement.trim(), locale, confirmed: true },
      });
      setDone(result);
      setOpen(null);
      void load();
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  const tooShort = statement.trim().length < 10;
  return (
    <section aria-labelledby="withdrawal-title" className="space-y-3" data-testid="withdrawal">
      <h3 id="withdrawal-title" className="text-lg font-semibold">
        {t.title}
      </h3>
      <p className="text-sm">{t.lead}</p>

      {done && (
        <Alert tone="success" role="status">
          <p>{t.done}</p>
          <p>
            {t.reference}: <strong data-testid="withdrawal-reference">{done.reference}</strong>
          </p>
          <p>{t.emailNote}</p>
        </Alert>
      )}

      {!open && (
        <ul className="space-y-2">
          {contracts.map((contract) => (
            <li key={contract.ref} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                {t.kinds[contract.kind]} · {contract.offer}
                {contract.existing_reference ? ` · ${t.existing} ${contract.existing_reference}` : ""}
              </span>
              {!contract.existing_reference && (
                <Button type="button" variant="secondary" size="sm" onClick={() => begin(contract)}>
                  {t.action}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && step === "statement" && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-fg-muted">{t.purchase}</dt>
            <dd>
              {t.kinds[open.kind]} · {open.offer}
            </dd>
            <dt className="text-fg-muted">{t.concluded}</dt>
            <dd>{day(open.concluded_at, locale)}</dd>
            <dt className="text-fg-muted">{t.periodEnds}</dt>
            <dd>{day(open.period_ends_at, locale)}</dd>
          </dl>
          <p className="text-sm">{t.eligibility[open.eligibility]}</p>
          <p className="text-xs text-fg-muted">{t.reviewNote}</p>
          <label className="block text-sm font-semibold" htmlFor="withdrawal-statement">
            {t.statementLabel}
          </label>
          <textarea
            id="withdrawal-statement"
            className="input min-h-24 w-full"
            maxLength={2000}
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
            aria-describedby="withdrawal-statement-hint"
          />
          <p id="withdrawal-statement-hint" className="text-xs text-fg-muted">
            {t.statementHint}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={tooShort} onClick={() => setStep("confirm")}>
              {t.continue}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(null)}>
              {t.back}
            </Button>
          </div>
        </div>
      )}

      {open && step === "confirm" && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h4 className="font-semibold">{t.confirmTitle}</h4>
          <p className="text-sm">{t.confirmLead}</p>
          {profile && (
            <p className="text-sm" data-testid="withdrawal-recipient">
              {profile.display_name ? `${t.confirmName}: ${profile.display_name}. ` : ""}
              {t.confirmTo} <strong>{profile.email}</strong>
            </p>
          )}
          <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-3 text-sm">{statement.trim()}</blockquote>
          {error && (
            <Alert tone="error" role="alert">
              {error}
            </Alert>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" loading={busy} loadingLabel={billingTexts[locale].wait} onClick={() => void submit()}>
              {t.confirm}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep("statement")}>
              {t.back}
            </Button>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-1 text-sm">
          <h4 className="font-semibold">{t.mine}</h4>
          <ul className="space-y-1">
            {requests.map((item) => (
              <li key={item.reference}>
                {item.reference} · {item.offer} · {t.status[item.status as keyof typeof t.status] ?? item.status} ·{" "}
                {day(item.created_at, locale)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
