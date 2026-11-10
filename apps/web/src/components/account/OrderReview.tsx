"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import { localizePath, type Locale } from "@/i18n/config";
import { billingTexts } from "@/i18n/billing";
import { company } from "@/lib/company";
import { legalVersion } from "@/lib/legal-versions";
import { routes } from "@/lib/routes";

export type Acceptance = {
  terms: string;
  subscription_terms: string;
  order_acceptance: string;
  privacy: string;
  customer_kind: "consumer" | "business";
  early_start: boolean;
  early_start_version: string | null;
};

type Props = {
  locale: Locale;
  productLabel: string;
  priceLabel: string;
  intervalLabel: string | null;
  requiresScope: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: (acceptance: Acceptance) => void;
  onBack: () => void;
};

/**
 * The order-review step before Stripe: what is being bought, the price, whether it renews, how to cancel, the
 * terms the customer accepts, and a button that says the order carries a payment obligation. The server checks
 * every version again (`acceptance` on /checkout); a tick in the browser proves nothing on its own.
 */
export function OrderReview({ locale, productLabel, priceLabel, intervalLabel, requiresScope, busy, error, onConfirm, onBack }: Props) {
  const t = billingTexts[locale].review;
  const [kind, setKind] = useState<"consumer" | "business" | null>(null);
  const [terms, setTerms] = useState(false);
  const [earlyStart, setEarlyStart] = useState(false);
  const [problems, setProblems] = useState<{ kind?: string; terms?: string }>({});

  function submit() {
    const next: { kind?: string; terms?: string } = {};
    if (!kind) next.kind = t.errors.kind;
    if (!terms) next.terms = t.errors.terms;
    setProblems(next);
    if (next.kind || next.terms || !kind) return;
    const early = kind === "consumer" && earlyStart;
    onConfirm({
      terms: legalVersion("terms"),
      subscription_terms: legalVersion("subscription_terms"),
      order_acceptance: legalVersion("order_acceptance"),
      privacy: legalVersion("privacy"),
      customer_kind: kind,
      early_start: early,
      early_start_version: early ? legalVersion("early_start") : null,
    });
  }

  const link = "font-medium text-brand underline underline-offset-4";
  return (
    <div className="space-y-4 rounded-lg border border-border p-4" data-testid="order-review">
      <h3 className="text-lg font-semibold">{t.title}</h3>
      <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-fg-muted">{t.product}</dt>
        <dd>{productLabel}</dd>
        <dt className="text-fg-muted">{t.price}</dt>
        <dd>
          {priceLabel}
          {intervalLabel ? ` / ${intervalLabel}` : ""}
        </dd>
      </dl>
      <p className="text-sm">{t.currency}</p>
      <p className="text-sm">{intervalLabel ? t.recurring.replace("{interval}", intervalLabel) : t.onceOnly}</p>
      {requiresScope && <p className="text-sm">{t.scope}</p>}
      {requiresScope && <p className="text-sm">{t.thirdParty}</p>}
      <p className="text-sm">{t.taxNote}</p>

      <section aria-labelledby="order-seller" className="rounded-md bg-surface-2 p-3" data-testid="order-seller">
        <h4 id="order-seller" className="text-sm font-semibold">
          {t.seller.title}
        </h4>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="text-fg-muted">{t.seller.name}</dt>
          <dd>{locale === "bg" ? company.legalNameBg : company.legalNameEn}</dd>
          <dt className="text-fg-muted">{t.seller.tradeName}</dt>
          <dd>{t.seller.tradeNameValue}</dd>
          <dt className="text-fg-muted">{t.seller.uic}</dt>
          <dd>{company.uic}</dd>
          <dt className="text-fg-muted">{t.seller.office}</dt>
          <dd>{locale === "bg" ? company.registeredOfficeBg : company.registeredOfficeEn}</dd>
          <dt className="text-fg-muted">{t.seller.phone}</dt>
          <dd>
            <a href={company.phoneUri} className="underline underline-offset-4">
              {company.phoneDisplay}
            </a>
          </dd>
          <dt className="text-fg-muted">{t.seller.email}</dt>
          <dd>
            <a href={company.contactEmailUri} className="underline underline-offset-4">
              {company.contactEmail}
            </a>
          </dd>
        </dl>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t.kindLegend}</legend>
        {(["consumer", "business"] as const).map((value) => (
          <label key={value} className="flex items-start gap-3 text-sm">
            <input
              type="radio"
              name="customer-kind"
              className="checkbox mt-0.5"
              checked={kind === value}
              onChange={() => {
                setKind(value);
                if (value === "business") setEarlyStart(false);
              }}
            />
            <span>{t[value]}</span>
          </label>
        ))}
        <p className="text-xs text-fg-muted">{t.kindHint}</p>
        {problems.kind && (
          <p className="field-error" role="alert">
            {problems.kind}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm">
          <input
            id="order-terms"
            type="checkbox"
            className="checkbox mt-0.5"
            checked={terms}
            aria-invalid={Boolean(problems.terms)}
            onChange={(event) => setTerms(event.target.checked)}
          />
          <span>
            {t.termsPrefix}{" "}
            <Link href={localizePath(locale, routes.terms)} className={link} target="_blank">
              {t.termsLink}
            </Link>{" "}
            {t.termsMiddle}{" "}
            <Link href={localizePath(locale, routes.subscriptionTerms)} className={link} target="_blank">
              {t.subscriptionLink}
            </Link>
            {t.termsSuffix} <span className="field-required">*</span>
          </span>
        </label>
        {problems.terms && (
          <p className="field-error" role="alert">
            {problems.terms}
          </p>
        )}
      </div>

      {kind === "consumer" && (
        <div className="space-y-1">
          <label className="flex items-start gap-3 text-sm">
            <input
              id="order-early-start"
              type="checkbox"
              className="checkbox mt-0.5"
              checked={earlyStart}
              onChange={(event) => setEarlyStart(event.target.checked)}
            />
            <span>{t.earlyStart}</span>
          </label>
          <p className="text-xs text-fg-muted">{t.earlyStartHint}</p>
        </div>
      )}

      <p className="text-sm">
        {t.privacyPrefix}{" "}
        <Link href={localizePath(locale, routes.privacy)} className={link} target="_blank">
          {t.privacyLink}
        </Link>
        . {t.withdrawalPrefix}{" "}
        <Link href={localizePath(locale, routes.withdrawalInfo)} className={link} target="_blank">
          {t.withdrawalLink}
        </Link>
        .
      </p>

      {error && (
        <Alert tone="error" role="alert">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" loading={busy} loadingLabel={billingTexts[locale].wait} onClick={submit}>
          {t.submit}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onBack}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}
