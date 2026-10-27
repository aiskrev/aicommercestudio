"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { PillGroup, fill } from "@/components/tools/team/TeamControls";
import { ToolState } from "@/components/tools/ToolUi";
import { Alert, Button, cx } from "@/components/ui/primitives";
import type { teamTool } from "@/content/bg/tool-team";
import type { Locale } from "@/i18n/config";
import { COST_SCENARIOS, type CostScenario } from "@/lib/ai-team";
import type { ApiFailure, Overrides, RateKey, TeamEstimate, TeamMeta } from "@/lib/team-api";

type Content = typeof teamTool;
const RATE_KEYS: RateKey[] = ["day_rate", "internal_hourly_rate", "price_per_million_input", "price_per_million_output"];
const ONE_TIME_KEYS = ["discovery", "agents", "integrations", "approvals", "deployment", "testing"] as const;
const MONTHLY_KEYS = ["infrastructure", "model_usage", "monitoring", "oversight"] as const;

export function formatMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "bg-BG", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

/**
 * Transparent cost estimate: three scenarios, every line with how it was derived, the published
 * assumptions version, and the four rates a visitor may change (bounded by the API's /meta).
 */
export function TeamCosts({
  content,
  locale,
  estimate,
  status,
  failure,
  meta,
  overrides,
  integrationName,
  complexityName,
  onApply,
  onRetry,
  roiHref,
}: {
  content: Content;
  locale: Locale;
  estimate: TeamEstimate | null;
  status: "loading" | "ready" | "error";
  failure?: ApiFailure;
  meta: TeamMeta | null;
  overrides: Overrides;
  integrationName: (key: string) => string;
  complexityName: (key: "low" | "medium" | "high") => string;
  onApply: (overrides: Overrides) => void;
  onRetry: () => void;
  /** ROI calculator; the link carries the expected scenario's costs (never savings). */
  roiHref?: string;
}) {
  const c = content.costs;
  const [scenario, setScenario] = useState<CostScenario>("expected");
  const money = (value: number) => formatMoney(value, locale);

  return (
    <section aria-labelledby="team-costs-title" className="grid gap-6" data-testid="team-costs">
      <div>
        <h2 id="team-costs-title" className="t-h3-lg">
          {c.title}
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-fg-muted">{c.lead}</p>
      </div>

      {status === "loading" && !estimate && <ToolState kind="loading" title={c.loading} />}
      {status === "error" && (
        <ToolState
          kind="error"
          title={failure?.kind === "stale" ? c.stale : c.error}
          action={
            failure?.kind === "stale" ? undefined : (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                {c.apply}
              </Button>
            )
          }
        />
      )}

      {estimate && (
        <div className={cx("grid gap-6 transition-opacity", status === "loading" && "opacity-60")} aria-busy={status === "loading" || undefined}>
          <dl className="grid gap-3 sm:grid-cols-2" data-testid="team-cost-ranges">
            <div className="card p-5">
              <dt className="t-label">{c.oneTimeTitle}</dt>
              <dd className="mt-2 font-display text-2xl font-bold text-fg">
                {money(estimate.ranges.one_time[0])} – {money(estimate.ranges.one_time[1])}
              </dd>
            </div>
            <div className="card p-5">
              <dt className="t-label">{c.monthlyTitle}</dt>
              <dd className="mt-2 font-display text-2xl font-bold text-fg">
                {money(estimate.ranges.monthly[0])} – {money(estimate.ranges.monthly[1])}
                <span className="ml-2 text-sm font-normal text-fg-muted">{c.perMonth}</span>
              </dd>
            </div>
          </dl>

          <PillGroup
            id="team-scenario"
            legend={c.scenarioLabel}
            options={COST_SCENARIOS.map((key) => ({ value: key, label: c.scenarios[key].title }))}
            value={scenario}
            onChange={setScenario}
            hint={c.scenarios[scenario].text}
          />

          <ScenarioTables content={content} estimate={estimate} scenario={scenario} money={money} />

          {estimate.scenarios[scenario].integrations.length > 0 && (
            <div className="card p-5">
              <h3 className="t-h3">{c.integrationEffortTitle}</h3>
              <ul className="mt-3 grid gap-1.5 text-sm text-fg-secondary sm:grid-cols-2">
                {estimate.scenarios[scenario].integrations.map((row) => (
                  <li key={row.integration}>
                    <span className="font-medium text-fg">{integrationName(row.integration)}</span> —{" "}
                    {fill(c.integrationRow, { complexity: complexityName(row.complexity), days: row.days })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Assumptions content={content} estimate={estimate} meta={meta} overrides={overrides} onApply={onApply} />

          <details className="accordion rounded-[var(--radius-lg)] border border-line-subtle bg-surface-1 px-5 py-4">
            <summary className="cursor-pointer font-semibold text-fg">{content.result.methodologyTitle}</summary>
            <ul className="mt-3 grid gap-2 text-[15px] leading-relaxed text-fg-muted">
              {c.formulas.map((formula) => (
                <li key={formula}>{formula}</li>
              ))}
            </ul>
          </details>
          {roiHref && (
            <p>
              <Link
                className="link"
                data-testid="team-roi-link"
                href={`${roiHref}?impl=${estimate.scenarios.expected.one_time.total}&run=${estimate.scenarios.expected.monthly.infrastructure + estimate.scenarios.expected.monthly.model_usage}&maint=${estimate.scenarios.expected.monthly.monitoring}`}
              >
                {c.roiLink}
              </Link>
            </p>
          )}
          <p className="text-sm leading-relaxed text-fg-subtle" data-testid="team-cost-disclaimer">
            {c.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}

function ScenarioTables({
  content,
  estimate,
  scenario,
  money,
}: {
  content: Content;
  estimate: TeamEstimate;
  scenario: CostScenario;
  money: (value: number) => string;
}) {
  const c = content.costs;
  const s = estimate.scenarios[scenario];
  const millions = (n: number) => (n / 1_000_000).toFixed(1);
  const monthlyNote: Partial<Record<(typeof MONTHLY_KEYS)[number], string>> = {
    model_usage: fill(c.notes.model_usage, { tasks: s.usage.tasks_per_month, input: millions(s.usage.input_tokens), output: millions(s.usage.output_tokens) }),
    oversight: fill(c.notes.oversight, { reviews: s.oversight.reviews_per_month, hours: s.oversight.hours_per_month }),
    monitoring: fill(c.notes.monitoring, { studio: s.monitoring_hours.studio, internal: s.monitoring_hours.internal }),
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid={`team-costs-${scenario}`}>
      {(
        [
          ["one_time", c.oneTimeTitle, ONE_TIME_KEYS, s.one_time, (key: string) => fill(c.notes.days, { days: s.one_time_days[key] })],
          ["monthly", c.monthlyTitle, MONTHLY_KEYS, s.monthly, (key: string) => monthlyNote[key as (typeof MONTHLY_KEYS)[number]] ?? ""],
        ] as const
      ).map(([group, title, keys, values, note]) => (
        <table key={group} className="card w-full overflow-hidden text-sm">
          <caption className="px-5 pt-4 text-left font-semibold text-fg">{title}</caption>
          <tbody>
            {keys.map((key) => (
              <tr key={key} className="border-b border-line-subtle last:border-0">
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  <span className="text-fg-secondary">{(group === "one_time" ? c.oneTime : c.monthly)[key as never]}</span>
                  {note(key) && <span className="mt-0.5 block text-xs text-fg-subtle">{note(key)}</span>}
                </th>
                <td className="px-5 py-3 text-right font-mono text-fg">{money((values as Record<string, number>)[key])}</td>
              </tr>
            ))}
            <tr className="bg-surface-2">
              <th scope="row" className="px-5 py-3 text-left font-semibold text-fg">
                {(group === "one_time" ? c.oneTime : c.monthly).total}
              </th>
              <td className="px-5 py-3 text-right font-mono font-semibold text-fg" data-testid={`team-${group}-total`}>
                {money(values.total)}
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
}

function Assumptions({
  content,
  estimate,
  meta,
  overrides,
  onApply,
}: {
  content: Content;
  estimate: TeamEstimate;
  meta: TeamMeta | null;
  overrides: Overrides;
  onApply: (overrides: Overrides) => void;
}) {
  const c = content.costs;
  const [values, setValues] = useState<Record<RateKey, string>>(
    () => Object.fromEntries(RATE_KEYS.map((key) => [key, String(estimate.rates[key])])) as Record<RateKey, string>,
  );
  const [errors, setErrors] = useState<Partial<Record<RateKey, string>>>({});
  const editable = meta?.assumptions.editable;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    const next: Overrides = {};
    const nextErrors: Partial<Record<RateKey, string>> = {};
    for (const key of RATE_KEYS) {
      const value = Number(values[key].replace(",", "."));
      const { min, max, default: fallback } = editable[key];
      if (!values[key].trim() || !Number.isFinite(value) || value < min || value > max) nextErrors[key] = fill(c.outOfRange, { min, max });
      else if (value !== fallback) next[key] = value;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onApply(next);
  }

  function reset() {
    if (!editable) return;
    setValues(Object.fromEntries(RATE_KEYS.map((key) => [key, String(editable[key].default)])) as Record<RateKey, string>);
    setErrors({});
    onApply({});
  }

  return (
    <form onSubmit={submit} noValidate className="card grid gap-5 p-5 sm:p-6" aria-labelledby="team-assumptions-title" data-testid="team-assumptions">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="team-assumptions-title" className="t-h3">
          {c.assumptionsTitle}
        </h3>
        {Object.keys(overrides).length > 0 && <span className="badge badge-warning">{c.customised}</span>}
        <span className="ml-auto font-mono text-xs text-fg-subtle">{fill(c.assumptionsVersion, { version: estimate.assumptions_version })}</span>
      </div>
      <p className="text-sm text-fg-muted">{c.assumptionsText}</p>
      {editable ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {RATE_KEYS.map((key) => (
              <div key={key}>
                <label htmlFor={`team-rate-${key}`} className="field-label">
                  {c.editable[key].label}
                </label>
                <input
                  id={`team-rate-${key}`}
                  name={key}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={editable[key].min}
                  max={editable[key].max}
                  className="field"
                  value={values[key]}
                  aria-invalid={Boolean(errors[key]) || undefined}
                  aria-describedby={`team-rate-${key}-${errors[key] ? "error" : "hint"}`}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                />
                {errors[key] ? (
                  <p id={`team-rate-${key}-error`} className="field-error">
                    {errors[key]}
                  </p>
                ) : (
                  <p id={`team-rate-${key}-hint`} className="field-hint">
                    {c.editable[key].hint}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm">
              {c.apply}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              {c.reset}
            </Button>
          </div>
        </>
      ) : (
        <Alert tone="info">{c.loading}</Alert>
      )}
    </form>
  );
}
