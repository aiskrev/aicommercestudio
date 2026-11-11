"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { QuoteContactForm, type QuoteSendOutcome } from "@/components/configurator/QuoteContactForm";
import { StepProgress } from "@/components/tools/ToolUi";
import { Alert, Button, cx } from "@/components/ui/primitives";
import type { SiteContent } from "@/content";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import {
  type ConfiguratorAnswers,
  type ConfiguratorDraft,
  type ConfiguratorReview,
  CONFIGURATOR_MODEL_VERSION,
  EMPTY_DRAFT,
  type FeatureKey,
  isComplete,
  isFeatureAvailable,
  missingInStep,
  normaliseDraft,
  OPTIONS,
  type OperationKey,
  sellsProducts,
  type StepKey,
  STEPS,
} from "@/lib/configurator";
import { type QuoteContact, reviewConfiguration, submitConfiguration } from "@/lib/configurator-api";
import { fetchBasket, saveConfiguration } from "@/lib/quote-basket";
import { formatEuro } from "@/lib/prices";

export interface ConfiguratorBasketTexts {
  title: string;
  lead: string;
  add: string;
  update: string;
  saving: string;
  open: string;
  full: string;
  failed: string;
}

export interface ConfiguratorNames {
  packages: Record<string, string>;
  services: Record<string, string>;
  carePlans: Record<string, string>;
}

type Texts = SiteContent["configurator"];
type FieldErrors = Partial<Record<string, string>>;

const STORAGE_KEY = `acs.configurator.${CONFIGURATOR_MODEL_VERSION}`;

/** The draft holds enumerated answers only (never contact details) and lives in this tab's session storage. */
function loadDraft(): ConfiguratorDraft {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as ConfiguratorDraft;
    return normaliseDraft({ ...EMPTY_DRAFT, ...parsed, features: parsed.features ?? [], operations: parsed.operations ?? [] });
  } catch {
    return EMPTY_DRAFT;
  }
}

function saveDraft(draft: ConfiguratorDraft | null) {
  try {
    if (draft) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be blocked: the form still works, it just does not survive a reload.
  }
}

/** A UUID v4 for one quote request. `crypto.randomUUID` exists only in secure contexts, `getRandomValues` everywhere. */
function newSubmissionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stepFromHash(): number {
  const key = window.location.hash.replace("#", "");
  const index = STEPS.indexOf(key as StepKey);
  return index >= 0 ? index : 0;
}

/** Single choice as native radios in a fieldset. */
function Choice<T extends string>({
  name,
  legend,
  options,
  value,
  error,
  note,
  onChange,
}: {
  name: string;
  legend: string;
  options: { value: T; label: string; hint?: string; disabled?: boolean }[];
  value: T | undefined;
  error?: string;
  note?: string;
  onChange: (value: T) => void;
}) {
  const errorId = `${name}-error`;
  const noteId = `${name}-note`;
  return (
    <fieldset aria-describedby={cx(error && errorId, note && noteId) || undefined} data-testid={`q-${name}`}>
      <legend className="field-label mb-3 text-base">
        {legend} <span className="field-required" aria-hidden="true">*</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cx(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 text-body-sm leading-snug transition-colors focus-within:border-brand",
                value === option.value ? "border-brand bg-brand/[0.08] text-fg" : "border-line-default bg-surface-page text-fg-secondary hover:border-line-strong",
                option.disabled && "cursor-not-allowed opacity-50",
                error && value === undefined && "border-danger/60",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                required
                onChange={() => onChange(option.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
              />
              <span className="min-w-0">
                <span className="block font-medium">{option.label}</span>
                {option.hint && <span className="mt-0.5 block text-fg-muted">{option.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {note && (
        <p id={noteId} className="field-hint">
          {note}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function Tick({ id, label, checked, disabled, onChange }: { id: string; label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label htmlFor={id} className={cx("flex min-h-11 cursor-pointer items-start gap-3 py-2 text-body-sm text-fg-secondary", disabled && "cursor-not-allowed opacity-50")}>
      <input id={id} type="checkbox" className="checkbox mt-0.5" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Multi-step project configurator. The browser only collects enumerated answers; the review — package, published
 * indicative prices, what needs an assessment — is computed by the server (POST /api/public/configurator/review).
 * Steps are real history entries, so the browser's back and forward buttons move between them.
 */
export function ProjectConfigurator({
  locale,
  texts: t,
  form,
  validation,
  inquiry,
  names,
  privacyHref,
  basket,
}: {
  locale: Locale;
  texts: Texts;
  form: Dictionary["form"];
  validation: Dictionary["validation"];
  inquiry: Dictionary["inquiry"];
  names: ConfiguratorNames;
  privacyHref: string;
  /** Set while the quote basket is switched on: the review then ends in "add to the request" instead of the form. */
  basket?: { href: string; texts: ConfiguratorBasketTexts };
}) {
  const [draft, setDraft] = useState<ConfiguratorDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [review, setReview] = useState<ConfiguratorReview | null>(null);
  const [reviewError, setReviewError] = useState<{ text: string; rules: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState("");
  // Quote basket: the item being edited (from ?item=<id>), and the state of "add to the request".
  const [editing, setEditing] = useState<string | null>(null);
  const [basketBusy, setBasketBusy] = useState(false);
  const [basketError, setBasketError] = useState<string | null>(null);
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const current = STEPS[step];
  const q = t.questions;

  // Restore the draft and the step after hydration (session storage and the URL exist only in the browser).
  useEffect(() => {
    const stored = loadDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(stored);
    const wanted = stepFromHash();
    // A deep link to a later step is honoured only as far as the answers allow.
    const firstIncomplete = STEPS.findIndex((key) => missingInStep(key, stored).length > 0);
    setStep(firstIncomplete === -1 ? wanted : Math.min(wanted, firstIncomplete));
    setReady(true);
    const onPop = () => {
      moved.current = true;
      setErrors({});
      setStep(stepFromHash());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (ready) saveDraft(draft);
  }, [draft, ready]);

  // Editing an item of the quote basket: its answers replace the draft (the basket holds answers only).
  useEffect(() => {
    if (!basket) return;
    const itemId = new URLSearchParams(window.location.search).get("item");
    if (!itemId) return;
    let active = true;
    void fetchBasket().then((result) => {
      const item = result.ok ? result.basket.items.find((entry) => entry.id === itemId && entry.kind === "configuration") : undefined;
      if (!active || !item?.answers) return;
      setDraft(normaliseDraft({ ...EMPTY_DRAFT, ...(item.answers as ConfiguratorDraft) }));
      setReview(null);
      setEditing(itemId);
    });
    return () => {
      active = false;
    };
  }, [basket]);

  // After a step change the heading takes focus, so keyboard and screen-reader users land at the new step.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    heading.current?.focus();
  }, [step]);

  const go = useCallback((index: number) => {
    moved.current = true;
    setErrors({});
    setStep(index);
    window.history.pushState(null, "", `#${STEPS[index]}`);
  }, []);

  const update = (patch: Partial<ConfiguratorDraft>) => {
    setDraft((previous) => normaliseDraft({ ...previous, ...patch }));
    setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !(key in patch))));
    setReview(null);
  };

  const toggle = <K extends "features" | "operations">(key: K, value: K extends "features" ? FeatureKey : OperationKey, on: boolean) => {
    const list = draft[key] as string[];
    update({ [key]: on ? [...list, value] : list.filter((item) => item !== value) } as Partial<ConfiguratorDraft>);
  };

  // The review is requested whenever the last step opens with complete answers.
  useEffect(() => {
    if (!ready || current !== "review" || review) return;
    if (!isComplete(draft)) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setReviewError(null);
    void reviewConfiguration(draft).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.ok) {
        setReview(result.review);
        setSubmissionId(newSubmissionId()); // one id per review: a repeated click returns the same lead
        return;
      }
      const text = { unsupported: t.errors.unsupported, stale: t.errors.stale, rate_limited: t.errors.rateLimited, unavailable: t.errors.failed, failed: t.errors.failed }[result.kind];
      setReviewError({ text, rules: result.kind === "unsupported" ? result.rules : [] });
    });
    return () => {
      active = false;
    };
  }, [ready, current, draft, review, t.errors]);

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = missingInStep(current, draft);
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((key) => [key, t.errors.required])));
      const first = document.querySelector<HTMLInputElement>(`input[name="${missing[0]}"]`);
      first?.focus();
      return;
    }
    go(step + 1);
  }

  function restart() {
    saveDraft(null);
    setDraft(EMPTY_DRAFT);
    setReview(null);
    setReviewError(null);
    setBasketError(null);
    setSubmissionId("");
    go(0);
  }

  async function sendQuote(contact: QuoteContact, formToken: string): Promise<QuoteSendOutcome> {
    if (!isComplete(draft)) return { ok: false, message: t.errors.summary };
    const result = await submitConfiguration(draft as ConfiguratorAnswers, contact, submissionId, formToken, locale);
    if (result.ok) {
      saveDraft(null);
      return result;
    }
    if (result.kind === "validation") return { ok: false, message: t.errors.summary, fieldErrors: result.fieldErrors };
    const message = { unsupported: t.errors.unsupported, rate_limited: t.errors.rateLimited, token: t.errors.token, spam: t.errors.spam, failed: t.errors.submitFailed }[result.kind];
    return { ok: false, message };
  }

  /** Quote basket on: the configuration becomes an item of the request (or replaces the one being edited). */
  async function addToBasket() {
    if (!basket || !isComplete(draft) || basketBusy) return;
    setBasketBusy(true);
    setBasketError(null);
    const result = await saveConfiguration(draft as ConfiguratorAnswers, locale, editing ?? undefined);
    if (result.ok) {
      saveDraft(null);
      router.push(basket.href);
      return;
    }
    setBasketBusy(false);
    setBasketError(result.kind === "full" ? basket.texts.full : result.kind === "unsupported" ? t.errors.unsupported : result.kind === "rate_limited" ? t.errors.rateLimited : basket.texts.failed);
  }

  const type = draft.project_type;
  const money = (value: number) => formatEuro(locale, value);
  const itemName = (kind: string, key: string) => (kind === "package" ? names.packages[key] : kind === "care_plan" ? names.carePlans[key] : names.services[key]) ?? key;
  const unpricedLabel = (key: string) => (key.startsWith("feature:") ? q.features.options[key.slice(8) as FeatureKey] : t.review.unpricedLabels[key]) ?? key;
  const ruleLabel = (rule: string) => {
    const [name, feature] = rule.split(":");
    const label = t.review.ruleLabels[name] ?? rule;
    return feature ? `${label} (${q.features.options[feature as FeatureKey] ?? feature})` : label;
  };

  const options = <T extends string>(values: T[], labels: Record<T, string>) => values.map((value) => ({ value, label: labels[value] }));

  let body: ReactNode = null;
  if (current === "type") {
    body = (
      <Choice
        name="project_type"
        legend={q.project_type.label}
        value={type}
        error={errors.project_type}
        options={OPTIONS.project_type.map((value) => ({ value, ...q.project_type.options[value] }))}
        onChange={(value) => update({ project_type: value })}
      />
    );
  } else if (current === "scope") {
    body = (
      <>
        <Choice
          name="pages"
          legend={q.pages.label}
          value={draft.pages}
          error={errors.pages}
          note={type === "landing_page" ? q.pages.landingNote : undefined}
          options={OPTIONS.pages.map((value) => ({ value, label: q.pages.options[value], disabled: type === "landing_page" && value !== "one" }))}
          onChange={(value) => update({ pages: value })}
        />
        {sellsProducts(type) && (
          <Choice
            name="products"
            legend={q.products.label}
            value={draft.products}
            error={errors.products}
            options={OPTIONS.products.map((value) => ({ value, label: q.products.options[value], disabled: type === "online_store" && value === "none" }))}
            onChange={(value) => update({ products: value })}
          />
        )}
        <Choice name="languages" legend={q.languages.label} value={draft.languages} error={errors.languages} options={options(OPTIONS.languages, q.languages.options)} onChange={(value) => update({ languages: value })} />
        <Choice name="build" legend={q.build.label} value={draft.build} error={errors.build} options={options(OPTIONS.build, q.build.options)} onChange={(value) => update({ build: value })} />
        <div>
          <Tick id="content_migration" label={q.content_migration} checked={draft.content_migration} onChange={(checked) => update({ content_migration: checked })} />
          {type === "online_store" && <Tick id="store_migration" label={q.store_migration} checked={draft.store_migration} onChange={(checked) => update({ store_migration: checked })} />}
        </div>
      </>
    );
  } else if (current === "features") {
    const available = OPTIONS.features.filter((feature) => isFeatureAvailable(type, feature));
    body = (
      <fieldset aria-describedby="features-hint" data-testid="q-features">
        <legend className="field-label mb-1 text-base">{q.features.label}</legend>
        <p id="features-hint" className="field-hint mb-3">
          {q.features.hint} {q.features.dashboardNote}
        </p>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {available.map((feature) => (
            <Tick
              key={feature}
              id={`feature-${feature}`}
              label={q.features.options[feature]}
              checked={draft.features.includes(feature)}
              disabled={feature === "user_dashboard" && !draft.features.includes("customer_accounts")}
              onChange={(checked) => toggle("features", feature, checked)}
            />
          ))}
        </div>
      </fieldset>
    );
  } else if (current === "design") {
    body = (
      <>
        <Choice name="branding" legend={q.branding.label} value={draft.branding} error={errors.branding} options={options(OPTIONS.branding, q.branding.options)} onChange={(value) => update({ branding: value })} />
        <Choice name="design_level" legend={q.design_level.label} value={draft.design_level} error={errors.design_level} options={options(OPTIONS.design_level, q.design_level.options)} onChange={(value) => update({ design_level: value })} />
        <div>
          <Tick id="accessibility" label={q.accessibility} checked={draft.accessibility} onChange={(checked) => update({ accessibility: checked })} />
          <Tick id="interactive_elements" label={q.interactive_elements} checked={draft.interactive_elements} onChange={(checked) => update({ interactive_elements: checked })} />
        </div>
      </>
    );
  } else if (current === "operations") {
    body = (
      <fieldset aria-describedby="operations-hint" data-testid="q-operations">
        <legend className="field-label mb-1 text-base">{q.operations.label}</legend>
        <p id="operations-hint" className="field-hint mb-3">
          {q.operations.hint}
        </p>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {OPTIONS.operations.map((operation) => (
            <Tick key={operation} id={`operation-${operation}`} label={q.operations.options[operation]} checked={draft.operations.includes(operation)} onChange={(checked) => toggle("operations", operation, checked)} />
          ))}
        </div>
      </fieldset>
    );
  } else if (current === "business") {
    body = (
      <>
        <Choice name="timeline" legend={inquiry.timeline} value={draft.timeline} error={errors.timeline} options={options(OPTIONS.timeline, inquiry.timelines)} onChange={(value) => update({ timeline: value })} />
        <Choice name="budget_range" legend={inquiry.budget} value={draft.budget_range} error={errors.budget_range} note={inquiry.budgetNote} options={options(OPTIONS.budget_range, inquiry.budgets)} onChange={(value) => update({ budget_range: value })} />
      </>
    );
  }

  const listSection = (title: string, items: string[], labels: (key: string) => string, testId: string, lead?: string) =>
    items.length > 0 && (
      <section className="grid gap-2" data-testid={testId}>
        <h3 className="t-h3">{title}</h3>
        {lead && <p className="text-body-sm text-fg-muted">{lead}</p>}
        <ul className="grid list-disc gap-1 pl-5 text-body-sm text-fg-secondary">
          {items.map((item) => (
            <li key={item} data-key={item}>
              {labels(item)}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="tool-frame grid gap-8 p-5 sm:p-8" data-testid="project-configurator" data-ready={ready || undefined}>
      <StepProgress steps={STEPS.map((key) => t.steps[key])} current={step} label={t.progressLabel} stepOf={t.stepOf} />
      <h2 ref={heading} tabIndex={-1} className="t-h2 outline-none" data-testid="configurator-step-title">
        {current === "review" ? t.review.title : t.steps[current]}
      </h2>

      {current !== "review" ? (
        <form onSubmit={next} noValidate className="grid gap-8" data-testid={`step-${current}`}>
          {Object.keys(errors).length > 0 && (
            <Alert tone="error" role="alert">
              {t.errors.summary}
            </Alert>
          )}
          {body}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-6">
            <Button variant="secondary" onClick={() => window.history.back()} disabled={step === 0}>
              {t.nav.back}
            </Button>
            <Button type="submit" icon="arrowRight">
              {STEPS[step + 1] === "review" ? t.nav.toReview : t.nav.next}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-fg-subtle">{t.privacyNote}</p>
        </form>
      ) : (
        <div className="grid gap-8" data-testid="step-review">
          <Alert tone="info" role="note">
            {t.review.notice}
          </Alert>
          {loading && (
            <p role="status" aria-live="polite" className="text-fg-muted">
              {t.review.loading}
            </p>
          )}
          {reviewError && (
            <div role="alert" className="grid gap-2" data-testid="review-error">
              <Alert tone="error">{reviewError.text}</Alert>
              {reviewError.rules.length > 0 && (
                <ul className="grid list-disc gap-1 pl-5 text-body-sm text-fg-secondary">
                  {reviewError.rules.map((rule) => (
                    <li key={rule}>{ruleLabel(rule)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!isComplete(draft) && !loading && (
            <Alert tone="warning" role="alert">
              {t.errors.summary}
            </Alert>
          )}

          {review && (
            <div className="grid gap-8" data-testid="review-result" data-package={review.package} data-schedule={review.schedule_version}>
              <section className="grid gap-2">
                <p className="t-label">{t.review.package}</p>
                <p className="t-h3-lg" data-testid="review-package">
                  {names.packages[review.package] ?? review.package} <span className="badge ml-2 align-middle">{t.review.delivery[review.delivery]}</span>
                </p>
              </section>

              <section className="grid gap-3">
                <h3 className="t-h3">{t.review.items}</h3>
                <ul className="divide-y divide-line-subtle rounded-[var(--radius-lg)] border border-line-subtle" data-testid="review-items">
                  {review.items.map((item) => (
                    <li key={`${item.kind}-${item.key}`} className="grid gap-1 bg-surface-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4" data-item={`${item.kind}:${item.key}`}>
                      <div className="min-w-0">
                        <p className="font-semibold text-fg">{itemName(item.kind, item.key)}</p>
                        <p className="text-xs text-fg-subtle">{t.review.kinds[item.kind]}</p>
                      </div>
                      {item.band ? (
                        <div className="sm:text-right">
                          <p className="font-display font-semibold text-fg" data-price="from">
                            {t.review.from} {money(item.band.from)}
                            {item.band.unit === "month" ? ` ${t.review.perMonth}` : ""}
                          </p>
                          <p className="text-body-sm text-fg-muted">
                            {t.review.typical} {money(item.band.typical[0])}–{money(item.band.typical[1])}
                            {item.band.unit === "month" ? ` ${t.review.perMonth}` : ""}
                          </p>
                        </div>
                      ) : (
                        <p className="font-semibold text-fg sm:text-right" data-price="assessment">
                          {t.review.requiresAssessment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="grid gap-2" data-testid="review-totals">
                <h3 className="t-h3">{t.review.totals}</h3>
                <dl className="grid gap-1 text-body-sm">
                  {review.totals.one_time_from > 0 && (
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-fg-secondary">{t.review.oneTime}</dt>
                      <dd className="font-semibold text-fg" data-total="one-time">
                        {money(review.totals.one_time_from)}
                      </dd>
                    </div>
                  )}
                  {review.totals.monthly_from > 0 && (
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-fg-secondary">{t.review.monthly}</dt>
                      <dd className="font-semibold text-fg" data-total="monthly">
                        {money(review.totals.monthly_from)} {t.review.perMonth}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="text-xs leading-relaxed text-fg-subtle">
                  {t.review.totalsNote} {!review.totals.primary_priced && t.review.primaryUnpriced}
                </p>
              </section>

              {listSection(t.review.included, review.included, (key) => q.features.options[key as FeatureKey] ?? key, "review-included")}
              {listSection(t.review.unpriced, review.unpriced, unpricedLabel, "review-unpriced", t.review.unpricedLead)}
              {listSection(t.review.assumptions, review.assumptions, (key) => t.review.assumptionLabels[key] ?? key, "review-assumptions")}
              {listSection(t.review.exclusions, review.exclusions, (key) => t.review.exclusionLabels[key] ?? key, "review-exclusions")}
              {listSection(t.review.humanReview, review.human_review.reasons, (key) => t.review.reasonLabels[key] ?? key, "review-reasons")}
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t border-line-subtle pt-6">
            <Button variant="secondary" onClick={() => window.history.back()}>
              {t.nav.edit}
            </Button>
            <Button variant="ghost" onClick={restart}>
              {t.nav.restart}
            </Button>
          </div>

          {review && basket && (
            <section aria-labelledby="cfg-basket-title" className="grid gap-4 border-t border-line-subtle pt-8" data-testid="configurator-basket">
              <h3 id="cfg-basket-title" className="t-h3-lg">
                {basket.texts.title}
              </h3>
              <p className="max-w-2xl text-fg-muted">{basket.texts.lead}</p>
              {basketError && (
                <Alert tone="error" role="alert">
                  {basketError}
                </Alert>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button icon="arrowRight" loading={basketBusy} loadingLabel={basket.texts.saving} onClick={() => void addToBasket()}>
                  {editing ? basket.texts.update : basket.texts.add}
                </Button>
                <Link href={basket.href} className="link text-body-sm">
                  {basket.texts.open}
                </Link>
              </div>
            </section>
          )}

          {review && !basket && (
            <section aria-labelledby="cfg-quote-title" className="grid gap-4 border-t border-line-subtle pt-8" data-testid="configurator-quote">
              <h3 id="cfg-quote-title" className="t-h3-lg">
                {t.quote.title}
              </h3>
              <QuoteContactForm
                testId="configurator-quote-form"
                form={form}
                validation={validation}
                privacyHref={privacyHref}
                texts={{ lead: t.quote.lead, goals: q.goals, special: q.special, sent: t.quote.sent, sentNext: t.quote.sentNext, summary: t.errors.summary }}
                send={sendQuote}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
