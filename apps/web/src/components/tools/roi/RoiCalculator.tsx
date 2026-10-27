"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { LineChart, StackedBars } from "@/components/tools/charts/Charts";
import { PillGroup, fill } from "@/components/tools/team/TeamControls";
import { ToolActions } from "@/components/tools/ToolActions";
import { MethodologyNote, ToolLeadCapture, ToolState } from "@/components/tools/ToolUi";
import { Alert, Button, cx } from "@/components/ui/primitives";
import type { roiTool } from "@/content/bg/tool-roi";
import type { tools } from "@/content/bg/tools";
import type { Locale } from "@/i18n/config";
import { type ToolEvent, trackToolEvent } from "@/lib/analytics";
import {
  HORIZONS,
  REALIZATION_OPTIONS,
  ROI_BOUNDS,
  ROI_FIELDS,
  type RoiDraft,
  type RoiErrors,
  type RoiField,
  type RoiInputs,
  type RoiResult,
  SCENARIO_KEYS,
  calculateRoi,
  calculateScenarios,
  decodeRoi,
  encodeRoi,
  validateRoi,
} from "@/lib/roi";

type Content = typeof roiTool;
type Ui = (typeof tools)["ui"];

/** Session hand-off from the opportunity finder (the process name never travels in a URL). */
export const ROI_PROCESS_KEY = "acs:roi:process";

const GROUPS: { key: keyof Content["sections"]; fields: RoiField[] }[] = [
  { key: "process", fields: ["volume", "minutes", "hourlyCost"] },
  { key: "automation", fields: ["coverage", "timeReduction", "reviewMinutes"] },
  { key: "costs", fields: ["implementationCost", "runCost", "maintenanceCost"] },
];

export function formatEur(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "bg-BG", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number, locale: Locale, digits = 1): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "bg-BG", { maximumFractionDigits: digits }).format(value);
}

/** Process name handed over by the opportunity finder (session storage, never a URL). */
function readProcessHandOff(): string {
  try {
    return typeof window === "undefined" ? "" : (window.sessionStorage.getItem(ROI_PROCESS_KEY) ?? "").slice(0, 200);
  } catch {
    return "";
  }
}

/** Prefill from the AI team configurator (?impl=&run=&maint=) — costs only, never savings. */
function teamPrefill(params: URLSearchParams): RoiDraft {
  const out: RoiDraft = {};
  for (const [param, field] of [["impl", "implementationCost"], ["run", "runCost"], ["maint", "maintenanceCost"]] as const) {
    const value = params.get(param);
    if (value && /^\d{1,8}$/.test(value)) out[field] = value;
  }
  return out;
}

export function roiSummaryText(content: Content, inputs: RoiInputs, result: RoiResult, locale: Locale, description: string): string {
  const r = content.result;
  const money = (v: number) => formatEur(v, locale);
  const scenarios = calculateScenarios(inputs);
  const lines = [
    content.summaryHeading,
    description ? `${content.description.label}: ${description}` : "",
    "",
    ...ROI_FIELDS.map((field) => `${content.fields[field].label}: ${formatNumber(inputs[field], locale, 2)} ${content.fields[field].unit}`),
    "",
    `${r.currentCost}: ${money(result.currentCost)}`,
    `${r.futureCost}: ${money(result.futureCost)}`,
    `${result.hoursReleased >= 0 ? r.hoursReleased : r.hoursReleasedNegative}: ${fill(r.hoursUnit, { hours: formatNumber(Math.abs(result.hoursReleased), locale) })}`,
    `${r.capacityValue}: ${money(result.capacityValue)}`,
    `${r.realizedSavings}: ${money(result.realizedSavings)}`,
    `${r.netMonthly}: ${money(result.netMonthly)}`,
    `${r.investment}: ${money(result.investment)}`,
    `${r.payback}: ${paybackText(content, result, locale)}`,
    `${r.net12}: ${money(result.net12)}`,
    `${fill(r.roi, { months: result.horizon })}: ${result.roiPercent === null ? r.roiUndefined : `${formatNumber(result.roiPercent, locale, 0)}%`}`,
    "",
    `${content.charts.scenarioTitle}:`,
    ...SCENARIO_KEYS.map(
      (key) =>
        `- ${content.scenarios[key].title} (${content.scenarios[key].text}): ${r.netMonthly} ${money(scenarios[key].netMonthly)}; ${r.payback} ${paybackText(content, scenarios[key], locale)}; ${r.net12} ${money(scenarios[key].net12)}`,
    ),
    "",
    content.disclaimer,
  ];
  return lines.filter((line, i) => line !== "" || lines[i - 1] !== "").join("\n");
}

function paybackText(content: Content, result: RoiResult, locale: Locale): string {
  if (result.paybackMonths === null) return content.result.paybackNever;
  if (result.paybackMonths === 0) return content.result.paybackImmediate;
  return fill(content.result.paybackValue, { months: formatNumber(result.paybackMonths, locale) });
}

export function RoiCalculator({
  content,
  ui,
  locale,
  contactHref,
  finderHref,
  teamHref,
}: {
  content: Content;
  ui: Ui;
  locale: Locale;
  contactHref: string;
  finderHref?: string;
  teamHref?: string;
}) {
  const params = useSearchParams();
  const shared = decodeRoi(params.get("r"));
  const prefill = teamPrefill(params);
  const [draft, setDraft] = useState<RoiDraft>(() => shared ?? prefill);
  // Rendered in the browser only (Suspense + useSearchParams), so session storage can be read here.
  const [description, setDescription] = useState(readProcessHandOff);
  const [touched, setTouched] = useState<Partial<Record<RoiField, boolean>>>({});
  const [showAll, setShowAll] = useState(false);
  const started = useRef(false);
  const completed = useRef(false);
  const track = (name: ToolEvent["name"], extra: Partial<ToolEvent> = {}) => trackToolEvent({ name, tool: "roi", locale, ...extra });

  const { inputs, errors } = useMemo(() => validateRoi(draft), [draft]);
  const result = useMemo(() => (inputs ? calculateRoi(inputs) : null), [inputs]);
  const scenarios = useMemo(() => (inputs ? calculateScenarios(inputs) : null), [inputs]);
  const fromTeam = !shared && Object.keys(prefill).length > 0;

  useEffect(() => {
    track("tool_opened");
    try {
      window.sessionStorage.removeItem(ROI_PROCESS_KEY);
    } catch {
      // Storage may be unavailable (private mode); the description is optional.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    if (!result || completed.current) return;
    completed.current = true;
    track("tool_completed", { result: result.paybackMonths === null ? "payback_not_reached" : "payback_reached" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first complete calculation only
  }, [result]);

  function update(field: RoiField, value: string) {
    if (!started.current) {
      started.current = true;
      track("tool_started");
    }
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function errorText(field: RoiField, error: NonNullable<RoiErrors[RoiField]>): string {
    const { min, max } = ROI_BOUNDS[field];
    return error === "range" ? fill(content.errors.range, { min: formatNumber(min, locale, 2), max: formatNumber(max, locale, 2) }) : content.errors[error];
  }

  const visibleError = (field: RoiField) => {
    const error = errors[field];
    if (!error) return undefined;
    if (error === "required" && !showAll) return undefined;
    if (!touched[field] && !showAll) return undefined;
    return errorText(field, error);
  };

  function revealErrors() {
    setShowAll(true);
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-roi-form] [aria-invalid='true']")?.focus());
  }

  const numberField = (field: RoiField) => {
    const f = content.fields[field];
    const error = visibleError(field);
    const id = `roi-${field}`;
    return (
      <div key={field}>
        <label htmlFor={id} className="field-label">
          {f.label}
        </label>
        <div className="relative">
          <input
            id={id}
            name={field}
            inputMode="decimal"
            autoComplete="off"
            className="field pr-16"
            value={draft[field] ?? ""}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-${error ? "error" : "hint"}`}
            onChange={(event) => update(field, event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, [field]: true }))}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle" aria-hidden="true">
            {f.unit}
          </span>
        </div>
        {error ? (
          <p id={`${id}-error`} className="field-error">
            {error}
          </p>
        ) : (
          <p id={`${id}-hint`} className="field-hint">
            {f.hint}
          </p>
        )}
      </div>
    );
  };

  const money = (value: number) => formatEur(value, locale);
  const shareUrl = () => (inputs ? `${window.location.origin}${window.location.pathname}?r=${encodeRoi(inputs)}` : window.location.href);

  return (
    <div className="grid gap-10">
      {shared && <ToolState kind="success" title={ui.linkRestored} />}
      {fromTeam && (
        <Alert tone="info" role="status">
          {content.prefilled}
        </Alert>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        <form className="tool-frame grid gap-8 p-5 sm:p-8" noValidate onSubmit={(event) => event.preventDefault()} data-roi-form aria-label={content.title}>
          <div>
            <label htmlFor="roi-description" className="field-label">
              {content.description.label}
            </label>
            <input
              id="roi-description"
              className="field"
              maxLength={200}
              value={description}
              placeholder={content.description.placeholder}
              aria-describedby="roi-description-hint"
              onChange={(event) => setDescription(event.target.value)}
            />
            <p id="roi-description-hint" className="field-hint">
              {content.description.hint}
            </p>
          </div>
          {GROUPS.map((group) => (
            <fieldset key={group.key} className="grid gap-5">
              <legend className="mb-1">
                <span className="t-h3 block">{content.sections[group.key].title}</span>
                <span className="mt-1 block text-sm text-fg-muted">{content.sections[group.key].text}</span>
              </legend>
              <div className="grid gap-5 sm:grid-cols-2">{group.fields.map(numberField)}</div>
              {group.key === "costs" && teamHref && (
                <Link href={teamHref} className="link text-sm">
                  {content.teamLink}
                </Link>
              )}
            </fieldset>
          ))}
          <fieldset className="grid gap-5">
            <legend className="mb-1">
              <span className="t-h3 block">{content.sections.realisation.title}</span>
              <span className="mt-1 block text-sm text-fg-muted">{content.sections.realisation.text}</span>
            </legend>
            <PillGroup
              id="roi-horizon"
              legend={content.fields.horizon.label}
              hint={content.fields.horizon.hint}
              options={HORIZONS.map((n) => ({ value: String(n), label: fill(content.horizonOption, { n }) }))}
              value={draft.horizon}
              onChange={(value) => update("horizon", value)}
              error={visibleError("horizon")}
            />
            <PillGroup
              id="roi-realization"
              legend={content.fields.realization.label}
              hint={content.fields.realization.hint}
              options={REALIZATION_OPTIONS.map((n) => ({ value: String(n), label: content.realizationOptions[n] }))}
              value={draft.realization}
              onChange={(value) => update("realization", value)}
              error={visibleError("realization")}
            />
          </fieldset>
        </form>

        <section aria-labelledby="roi-result-title" className="panel grid gap-6 p-5 sm:p-7 lg:sticky lg:top-24" data-testid="roi-result" aria-live="polite">
          <h2 id="roi-result-title" className="t-h3-lg">
            {content.result.title}
          </h2>
          {!result || !scenarios ? (
            <div className="grid gap-4">
              <p className="text-fg-muted">{content.result.empty}</p>
              <p className="text-sm text-fg-subtle" data-testid="roi-missing">
                {ROI_FIELDS.filter((f) => errors[f]).length} / {ROI_FIELDS.length}
              </p>
              <div>
                <Button variant="secondary" onClick={revealErrors}>
                  {content.errors.summary}
                </Button>
              </div>
            </div>
          ) : (
            <RoiResultView content={content} result={result} scenarios={scenarios} locale={locale} money={money} realization={inputs!.realization} />
          )}
        </section>
      </div>

      {result && inputs && (
        <ToolActions
          title={ui.actionsTitle}
          labels={ui}
          fileName={locale === "en" ? "ai-roi-calculation.txt" : "ai-roi-izchislenie.txt"}
          summaryText={() => roiSummaryText(content, inputs, result, locale, description.trim())}
          shareUrl={shareUrl}
          onExport={(format) => track("export_requested", { format })}
        />
      )}
      <MethodologyNote title={content.methodologyTitle} paragraphs={[...content.formulas, content.disclaimer]} />
      <ToolLeadCapture
        title={content.leadCapture.title}
        text={content.leadCapture.text}
        primary={{ href: contactHref, label: content.leadCapture.cta }}
        secondary={finderHref ? { href: finderHref, label: content.leadCapture.secondary } : undefined}
      />
    </div>
  );
}

function Stat({ label, value, note, tone, testId }: { label: string; value: ReactNode; note?: string; tone?: "good" | "bad"; testId?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-line-subtle bg-surface-page/60 p-4">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={cx("mt-1 font-display text-xl font-bold", tone === "bad" ? "text-danger" : "text-fg")} data-testid={testId}>
        {value}
      </dd>
      {note && <dd className="mt-1 text-xs text-fg-subtle">{note}</dd>}
    </div>
  );
}

function RoiResultView({
  content,
  result,
  scenarios,
  locale,
  money,
  realization,
}: {
  content: Content;
  result: RoiResult;
  scenarios: Record<(typeof SCENARIO_KEYS)[number], RoiResult>;
  locale: Locale;
  money: (value: number) => string;
  realization: number;
}) {
  const r = content.result;
  const c = content.charts;
  const labourAfter = result.currentCost - result.realizedSavings;
  const negative = result.hoursReleased < 0;
  return (
    <div className="grid gap-7">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Stat label={r.currentCost} value={money(result.currentCost)} note={fill(r.hoursUnit, { hours: formatNumber(result.currentHours, locale) })} testId="roi-current-cost" />
        <Stat label={r.futureCost} value={money(result.futureCost)} note={fill(r.hoursUnit, { hours: formatNumber(result.futureHours, locale) })} testId="roi-future-cost" />
        <Stat label={r.netMonthly} value={money(result.netMonthly)} tone={result.netMonthly < 0 ? "bad" : undefined} testId="roi-net-monthly" />
        <Stat label={r.payback} value={paybackText(content, result, locale)} testId="roi-payback" />
        <Stat label={r.net12} value={money(result.net12)} tone={result.net12 < 0 ? "bad" : undefined} testId="roi-net12" />
        <Stat
          label={fill(r.roi, { months: result.horizon })}
          value={result.roiPercent === null ? r.roiUndefined : `${formatNumber(result.roiPercent, locale, 0)}%`}
          tone={result.roiPercent !== null && result.roiPercent < 0 ? "bad" : undefined}
          testId="roi-percent"
        />
      </dl>

      <div className="grid gap-2 rounded-[var(--radius-md)] border border-line-subtle p-4 text-sm" data-testid="roi-capacity">
        <p className="flex justify-between gap-3">
          <span className="text-fg-secondary">{negative ? r.hoursReleasedNegative : r.hoursReleased}</span>
          <strong className="font-mono text-fg">{fill(r.hoursUnit, { hours: formatNumber(Math.abs(result.hoursReleased), locale) })}</strong>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-fg-secondary">{r.capacityValue}</span>
          <strong className="font-mono text-fg">{money(result.capacityValue)}</strong>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-fg-secondary">{r.realizedSavings}</span>
          <strong className="font-mono text-fg">{money(result.realizedSavings)}</strong>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-fg-secondary">{r.runningCosts}</span>
          <strong className="font-mono text-fg">{money(result.runningCosts)}</strong>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-fg-secondary">{r.investment}</span>
          <strong className="font-mono text-fg">{money(result.investment)}</strong>
        </p>
        <p className={cx("mt-1 text-xs", negative ? "text-warning" : "text-fg-subtle")}>{negative ? r.negativeNote : fill(r.capacityNote, { share: realization })}</p>
      </div>

      <div className="grid gap-3">
        <h3 className="t-label">{c.costTitle}</h3>
        <StackedBars
          label={c.costTitle}
          format={money}
          series={[
            { key: "labour", label: c.labour },
            { key: "running", label: c.running },
            { key: "maintenance", label: c.maintenance },
          ]}
          bars={[
            { key: "now", label: c.costNow, values: [result.currentCost, 0, 0], total: money(result.currentCost) },
            {
              key: "after",
              label: c.costAfter,
              values: [Math.max(0, labourAfter), result.runCost, result.maintenanceCost],
              total: money(result.futureCost),
            },
          ]}
        />
      </div>

      <div className="grid gap-3">
        <h3 className="t-label">{c.cumulativeTitle}</h3>
        <LineChart
          label={c.cumulativeTitle}
          months={result.horizon}
          format={money}
          monthLabel={(m) => fill(c.month, { n: m })}
          markerLabel={c.breakEven}
          series={SCENARIO_KEYS.map((key) => ({
            key,
            label: content.scenarios[key].title,
            values: scenarios[key].cumulative,
            marker: scenarios[key].paybackMonths,
          }))}
        />
      </div>

      <div className="grid gap-3">
        <h3 className="t-label">{c.scenarioTitle}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm" data-testid="roi-scenarios">
            <thead>
              <tr className="border-b border-line-default text-left">
                <th scope="col" className="py-2 pr-3 font-medium text-fg-muted">
                  {content.scenarioColumns.metric}
                </th>
                {SCENARIO_KEYS.map((key) => (
                  <th key={key} scope="col" className="py-2 pr-3 text-right font-medium text-fg">
                    {content.scenarios[key].title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [r.realizedSavings, (s: RoiResult) => money(s.realizedSavings)],
                  [r.netMonthly, (s: RoiResult) => money(s.netMonthly)],
                  [r.payback, (s: RoiResult) => paybackText(content, s, locale)],
                  [r.net12, (s: RoiResult) => money(s.net12)],
                  [fill(r.roi, { months: result.horizon }), (s: RoiResult) => (s.roiPercent === null ? "—" : `${formatNumber(s.roiPercent, locale, 0)}%`)],
                ] as const
              ).map(([label, value]) => (
                <tr key={label} className="border-b border-line-subtle">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-fg-secondary">
                    {label}
                  </th>
                  {SCENARIO_KEYS.map((key) => (
                    <td key={key} className="py-2 pr-3 text-right font-mono text-fg">
                      {value(scenarios[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="grid gap-1 text-xs text-fg-subtle">
          {SCENARIO_KEYS.map((key) => (
            <li key={key}>
              <strong className="font-semibold text-fg-muted">{content.scenarios[key].title}:</strong> {content.scenarios[key].text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

