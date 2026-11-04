"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import type { Locale } from "@/i18n/config";
import { billingTexts } from "@/i18n/billing";
import { billingFetch } from "@/lib/account-api";

type Offer = {
  key: string;
  kind: "one_time" | "subscription";
  plan: string | null;
  interval: "month" | "year" | null;
  currency: string;
  amount_minor: number;
  requires_scope: boolean;
};
type Subscription = {
  offer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  action_required: boolean;
};
type Status = { subscriptions: Subscription[]; has_customer: boolean };

function money(offer: Offer, locale: Locale): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    style: "currency",
    currency: offer.currency.toUpperCase(),
  }).format(offer.amount_minor / 100);
}

/**
 * Plans for sale and the state of the subscription. Payment happens on Stripe's page, which shows the
 * methods really available, so none are named here. Hidden entirely while billing is off (404).
 */
export function AdvisorBilling({ locale }: { locale: Locale }) {
  const t = billingTexts[locale];
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [state, setState] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, current] = await Promise.all([
        billingFetch<Offer[]>("/offers", locale, t.network),
        billingFetch<Status>("/status", locale, t.network),
      ]);
      setOffers(list);
      setState(current);
    } catch {
      setOffers(null);
    }
  }, [locale, t.network]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function go(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const { url } = await billingFetch<{ url: string }>(path, locale, t.network, { method: "POST", body });
      window.location.assign(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.network);
      setBusy(false);
    }
  }

  if (offers === null || state === null) return null;
  const subscription = state.subscriptions.find((item) => !["canceled", "incomplete_expired"].includes(item.status));

  return (
    <section aria-labelledby="billing-title" className="space-y-4" data-testid="workspace-billing">
      <h2 id="billing-title" className="text-xl font-semibold">
        {t.title}
      </h2>
      {error && (
        <Alert tone="error" role="alert">
          {error}
        </Alert>
      )}
      {subscription && (
        <div className="space-y-2 text-sm">
          <p>
            {t.status}: {t.statuses[subscription.status as keyof typeof t.statuses] ?? subscription.status}
          </p>
          {subscription.action_required && <Alert tone="warning">{t.actionRequired}</Alert>}
          {subscription.cancel_at_period_end && <p>{t.endsAtPeriodEnd}</p>}
        </div>
      )}
      {!subscription && offers.length === 0 && <p className="text-sm">{t.noOffers}</p>}
      {!subscription && (
        <ul className="space-y-2">
          {offers.map((offer) => (
            <li key={offer.key} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                {offer.plan ? t.plans[offer.plan as keyof typeof t.plans] : t.oneTime} · {money(offer, locale)}
                {offer.interval ? ` / ${t.intervals[offer.interval]}` : ""}
                {offer.requires_scope ? ` · ${t.scopeFirst}` : ""}
              </span>
              <Button
                type="button"
                size="sm"
                loading={busy}
                loadingLabel={t.wait}
                onClick={() => void go("/checkout", { offer: offer.key, locale })}
              >
                {t.buy}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {state.has_customer && (
        <Button type="button" variant="secondary" size="sm" onClick={() => void go("/portal", { locale })}>
          {t.manage}
        </Button>
      )}
      <p className="text-sm">{t.methodsNote}</p>
    </section>
  );
}

/** After returning from Stripe. It only reports; the plan changes when the server confirms the payment. */
export function PaymentResult({ locale }: { locale: Locale }) {
  const t = billingTexts[locale];
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let tries = 0;
    const check = async () => {
      tries += 1;
      try {
        const state = await billingFetch<Status>("/status", locale, t.network);
        if (state.subscriptions.some((item) => item.status === "active" || item.status === "trialing")) {
          setConfirmed(true);
          clearInterval(timer);
        }
      } catch {
        // Keep the waiting message: this page never decides what was paid.
      }
      if (tries >= 10) clearInterval(timer);
    };
    const timer = setInterval(() => void check(), 3000);
    void check();
    return () => clearInterval(timer);
  }, [locale, t.network]);

  return (
    <Alert tone={confirmed ? "success" : "info"} role="status">
      {confirmed ? t.confirmed : t.processing}
    </Alert>
  );
}
