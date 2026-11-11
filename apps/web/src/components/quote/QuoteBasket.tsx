"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { QuoteContactForm, type QuoteSendOutcome } from "@/components/configurator/QuoteContactForm";
import { Alert, Button, buttonClass, cx } from "@/components/ui/primitives";
import type { SiteContent } from "@/content";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { FeatureKey } from "@/lib/configurator";
import type { QuoteContact } from "@/lib/configurator-api";
import { formatEuro } from "@/lib/prices";
import { addExtra, type BasketFailure, type BasketItem, type BasketResult, type BasketView, discardBasket, type ExtraGroup, fetchBasket, removeItem, submitBasket } from "@/lib/quote-basket";

export interface BasketNames {
  packages: Record<string, string>;
  /** Offers that can be added as extras, by group, in display order. */
  offers: Record<ExtraGroup, { key: string; name: string }[]>;
}

type Texts = SiteContent["quoteBasket"];
type ResultTexts = SiteContent["configurator"]["review"];

/**
 * The quote basket page: the visitor's draft request for a written quote. Everything shown comes from the server
 * (GET /api/public/quote-basket), which recomputes each line from the published schedule; the browser holds only
 * the basket's token. Not a shop cart: the only way out is "send the request", and a person reviews it.
 */
export function QuoteBasket({
  locale,
  texts: t,
  results,
  fields,
  featureLabels,
  form,
  validation,
  names,
  privacyHref,
  configuratorHref,
  packagesHref,
}: {
  locale: Locale;
  texts: Texts;
  results: ResultTexts;
  /** Labels of the two optional text fields of the quote form (the configurator's wording). */
  fields: { goals: { label: string; hint: string }; special: { label: string; hint: string } };
  featureLabels: Record<FeatureKey, string>;
  form: Dictionary["form"];
  validation: Dictionary["validation"];
  names: BasketNames;
  privacyHref: string;
  /** `null` while the project configurator is switched off. */
  configuratorHref: string | null;
  packagesHref: string;
}) {
  const [basket, setBasket] = useState<BasketView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "sent">("loading");
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState("");
  const live = useRef<HTMLDivElement>(null);

  const message = useCallback(
    (kind: BasketFailure): string =>
      ({ changed: t.errors.changed, full: t.errors.full, duplicate: t.errors.duplicate, needs_update: t.errors.needsUpdate, rate_limited: t.errors.rateLimited } as Partial<Record<BasketFailure, string>>)[kind] ??
      t.errors.failed,
    [t.errors],
  );

  const refresh = useCallback(async () => {
    const result = await fetchBasket();
    setBasket(result.ok ? result.basket : null);
    return result;
  }, []);

  useEffect(() => {
    let active = true;
    void fetchBasket().then((result) => {
      if (!active) return;
      setBasket(result.ok ? result.basket : null);
      if (!result.ok && result.kind !== "none") setNotice({ tone: "error", text: message(result.kind) });
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [message]);

  /** Applies a change; on a concurrent change elsewhere it shows the current state and says so. */
  async function apply(action: () => Promise<BasketResult>) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await action();
    if (result.ok) setBasket(result.basket);
    else {
      if (result.kind === "changed" || result.kind === "none") await refresh();
      setNotice({ tone: result.kind === "changed" ? "info" : "error", text: message(result.kind) });
    }
    setBusy(false);
    live.current?.focus();
  }

  async function send(contact: QuoteContact, formToken: string): Promise<QuoteSendOutcome> {
    if (!basket) return { ok: false, message: t.errors.failed };
    const result = await submitBasket(contact, basket.version, formToken, locale);
    if (result.ok) {
      setState("sent");
      return result;
    }
    if (result.kind === "validation") return { ok: false, message: t.errors.summary, fieldErrors: result.fieldErrors };
    if (result.kind === "changed" || result.kind === "none") await refresh();
    const text = result.kind === "token" ? t.errors.token : result.kind === "spam" ? t.errors.spam : message(result.kind);
    return { ok: false, message: text };
  }

  async function discard() {
    if (busy || !window.confirm(t.actions.discardConfirm)) return;
    setBusy(true);
    const done = await discardBasket();
    setBusy(false);
    if (done) setBasket(null);
    else setNotice({ tone: "error", text: t.errors.failed });
  }

  const money = (value: number) => formatEuro(locale, value);
  const price = (band: { unit: string; from: number; typical: [number, number] } | null) =>
    band ? (
      <div className="sm:text-right">
        <p className="font-display font-semibold text-fg" data-price="from">
          {t.items.from} {money(band.from)}
          {band.unit === "month" ? ` ${t.items.perMonth}` : ""}
        </p>
        <p className="text-body-sm text-fg-muted">
          {t.items.typical} {money(band.typical[0])}–{money(band.typical[1])}
          {band.unit === "month" ? ` ${t.items.perMonth}` : ""}
        </p>
      </div>
    ) : (
      <p className="font-semibold text-fg sm:text-right" data-price="assessment">
        {t.items.requiresAssessment}
      </p>
    );

  const offerName = (group: string, key: string) => names.offers[group as ExtraGroup]?.find((offer) => offer.key === key)?.name ?? key;
  const lineName = (kind: string, key: string) => (kind === "package" ? names.packages[key] : kind === "care_plan" ? offerName("care_plan", key) : offerName("service", key)) ?? key;
  const itemName = (item: BasketItem) => (item.review ? (names.packages[item.review.package] ?? item.review.package) : item.extra ? offerName(item.extra.group, item.extra.key) : t.items.configuration);
  const unpricedLabel = (key: string) => (key.startsWith("feature:") ? featureLabels[key.slice(8) as FeatureKey] : results.unpricedLabels[key]) ?? key;

  if (state === "loading") {
    return (
      <p role="status" aria-live="polite" className="text-fg-muted" data-testid="basket-loading">
        {t.loading}
      </p>
    );
  }

  const empty = !basket || (basket.items.length === 0 && basket.status === "open");
  const inBasket = new Set((basket?.items ?? []).filter((item) => item.extra).map((item) => `${item.extra!.group}:${item.extra!.key}`));
  const list = (title: string, items: string[], label: (key: string) => string, testId: string, lead?: string) =>
    items.length > 0 && (
      <section className="grid gap-2" data-testid={testId}>
        <h3 className="t-h3">{title}</h3>
        {lead && <p className="text-body-sm text-fg-muted">{lead}</p>}
        <ul className="grid list-disc gap-1 pl-5 text-body-sm text-fg-secondary">
          {items.map((item) => (
            <li key={item}>{label(item)}</li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="tool-frame grid gap-8 p-5 sm:p-8" data-testid="quote-basket" data-ready="true" data-version={basket?.version}>
      <Alert tone="info" role="note">
        {t.notice}
      </Alert>
      <div ref={live} tabIndex={-1} className="outline-none" aria-live="polite">
        {notice && (
          <Alert tone={notice.tone === "info" ? "info" : "error"} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.text}
          </Alert>
        )}
      </div>

      {state === "sent" || basket?.status === "submitted" ? null : empty ? (
        <section className="grid gap-3" data-testid="basket-empty">
          <h2 className="t-h3-lg">{t.empty.title}</h2>
          <p className="text-fg-muted">{t.empty.text}</p>
          <div className="flex flex-wrap gap-3">
            {configuratorHref && (
              <Link href={configuratorHref} className={buttonClass("primary")}>
                {t.empty.configure}
              </Link>
            )}
            <Link href={packagesHref} className={buttonClass("secondary")}>
              {t.empty.packages}
            </Link>
          </div>
        </section>
      ) : (
        basket && (
          <>
            <section className="grid gap-3" aria-labelledby="basket-items-title">
              <h2 id="basket-items-title" className="t-h3-lg">
                {t.items.title}
              </h2>
              <ul className="grid gap-4" data-testid="basket-items">
                {basket.items.map((item) => {
                  const name = itemName(item);
                  return (
                    <li key={item.id} className="rounded-[var(--radius-lg)] border border-line-subtle bg-surface-1 p-4 sm:p-5" data-item={item.id} data-kind={item.kind}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="t-label">{item.kind === "configuration" ? t.items.configuration : t.items.extra}</p>
                          <p className="mt-1 font-semibold text-fg">{name}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.kind === "configuration" && configuratorHref && (
                            <Link href={`${configuratorHref}?item=${item.id}`} className={cx(buttonClass("secondary", "sm"))} aria-label={t.items.editLabel.replace("{name}", name)}>
                              {t.items.edit}
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            aria-label={t.items.removeLabel.replace("{name}", name)}
                            onClick={() => void apply(() => removeItem(item.id, basket.version))}
                          >
                            {t.items.remove}
                          </Button>
                        </div>
                      </div>
                      {item.needs_update && (
                        <Alert tone="warning" role="note" className="mt-3">
                          {t.items.needsUpdate}
                        </Alert>
                      )}
                      {item.review && (
                        <ul className="mt-4 divide-y divide-line-subtle border-t border-line-subtle">
                          {item.review.items.map((line) => (
                            <li key={`${line.kind}-${line.key}`} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4" data-line={`${line.kind}:${line.key}`}>
                              <p className="text-body-sm text-fg-secondary">{lineName(line.kind, line.key)}</p>
                              {price(line.band)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.extra && <div className="mt-3 border-t border-line-subtle pt-3">{price(item.extra.band)}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="grid gap-3 border-t border-line-subtle pt-6" aria-labelledby="basket-extras-title" data-testid="basket-extras">
              <h2 id="basket-extras-title" className="t-h3">
                {t.extras.title}
              </h2>
              <p className="text-body-sm text-fg-muted">{t.extras.lead}</p>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const [group, key] = choice.split(":");
                  if (!group || !key) return;
                  void apply(() => addExtra(group as ExtraGroup, key, locale)).then(() => setChoice(""));
                }}
              >
                <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-md">
                  <label htmlFor="basket-extra" className="field-label">
                    {t.extras.label}
                  </label>
                  <select id="basket-extra" className="field" value={choice} onChange={(event) => setChoice(event.target.value)}>
                    <option value="">{t.extras.placeholder}</option>
                    {(Object.keys(t.extras.groups) as ExtraGroup[]).map((group) => (
                      <optgroup key={group} label={t.extras.groups[group]}>
                        {names.offers[group].map((offer) => (
                          <option key={offer.key} value={`${group}:${offer.key}`} disabled={inBasket.has(`${group}:${offer.key}`)}>
                            {offer.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="secondary" disabled={busy || !choice || basket.items.length >= basket.max_items}>
                  {t.extras.add}
                </Button>
              </form>
              {configuratorHref && (
                <Link href={configuratorHref} className="link text-body-sm">
                  {t.actions.addProject}
                </Link>
              )}
            </section>

            <section className="grid gap-2 border-t border-line-subtle pt-6" data-testid="basket-totals">
              <h2 className="t-h3">{t.totals.title}</h2>
              <dl className="grid gap-1 text-body-sm">
                {basket.totals.one_time_from > 0 && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-fg-secondary">{t.totals.oneTime}</dt>
                    <dd className="font-semibold text-fg" data-total="one-time">
                      {money(basket.totals.one_time_from)}
                    </dd>
                  </div>
                )}
                {basket.totals.monthly_from > 0 && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-fg-secondary">{t.totals.monthly}</dt>
                    <dd className="font-semibold text-fg" data-total="monthly">
                      {money(basket.totals.monthly_from)} {t.items.perMonth}
                    </dd>
                  </div>
                )}
              </dl>
              {basket.totals.unpriced_lines > 0 && (
                <p className="text-body-sm text-fg-secondary" data-testid="basket-unpriced-count">
                  {t.totals.unpricedCount.replace("{n}", String(basket.totals.unpriced_lines))}
                </p>
              )}
              <p className="text-xs leading-relaxed text-fg-subtle">{t.totals.note}</p>
            </section>

            {list(t.sections.unpriced, [...new Set(basket.unpriced.map((entry) => entry.key))], unpricedLabel, "basket-unpriced", t.sections.unpricedLead)}
            {list(t.sections.assumptions, basket.assumptions, (key) => results.assumptionLabels[key] ?? key, "basket-assumptions")}
            {list(t.sections.exclusions, basket.exclusions, (key) => results.exclusionLabels[key] ?? key, "basket-exclusions")}
            {list(t.sections.humanReview, basket.human_review.reasons, (key) => results.reasonLabels[key] ?? key, "basket-reasons")}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-6">
              <p className="text-xs text-fg-subtle">
                {t.actions.expires.replace("{date}", new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { dateStyle: "long" }).format(new Date(basket.expires_at)))}
              </p>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void discard()}>
                {t.actions.discard}
              </Button>
            </div>
          </>
        )
      )}

      {basket?.status === "submitted" && state !== "sent" && (
        <div role="status" data-testid="basket-already-sent">
          <Alert tone="success">{t.send.sent.replace("{ref}", basket.reference ?? "")}</Alert>
        </div>
      )}

      {basket && !empty && !(basket.status === "submitted" && state !== "sent") && (
        <section aria-labelledby="basket-send-title" className="grid gap-4 border-t border-line-subtle pt-8" data-testid="basket-send">
          <h2 id="basket-send-title" className="t-h3-lg">
            {t.send.title}
          </h2>
          <QuoteContactForm
            testId="basket-quote-form"
            form={form}
            validation={validation}
            privacyHref={privacyHref}
            texts={{ lead: t.send.lead, goals: fields.goals, special: fields.special, sent: t.send.sent, sentNext: t.send.sentNext, summary: t.errors.summary }}
            send={send}
          />
        </section>
      )}
    </div>
  );
}
