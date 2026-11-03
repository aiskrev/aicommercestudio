"use client";

import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { ActionError, Button, Field, TONE, fill, fmtDate, post, useAction } from "@/components/admin/ops/shared";
import { EmptyState, ErrorState, LoadingState, Panel, Pill, StatCard } from "@/components/admin/ui";
import type { ObservabilityEvaluation, RateCard, UsageSummary } from "@/lib/ops-types";
import { useAdminData } from "@/lib/use-admin-data";

/**
 * Bounded usage/cost view. Every number comes from stored records (synthetic samples or manual
 * imports); the freshness banner says so and nothing is ever presented as live.
 */
export function ObservabilityTab({ base, permissions, isDemo }: { base: string; permissions: string[]; isDemo: boolean }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.opsPlatform.observability;
  const [groupBy, setGroupBy] = useState<"agent" | "workspace">("agent");
  const summary = useAdminData<UsageSummary>(`${base}/observability/summary?days=30&group_by=${groupBy}`);
  const evaluation = useAdminData<ObservabilityEvaluation>(`${base}/observability/evaluation`);
  const cards = useAdminData<RateCard[]>(`${base}/rate-cards`);
  const action = useAction();
  const [json, setJson] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const write = permissions.includes("observability.write");
  const number = (n: number) => new Intl.NumberFormat(locale === "en" ? "en-GB" : "bg-BG").format(n);
  const cost = (costs: Record<string, string>) =>
    Object.entries(costs).map(([currency, amount]) => `${amount} ${currency}`).join(" · ") || "—";

  function reloadAll() {
    summary.reload();
    evaluation.reload();
  }

  async function importJson() {
    let body: unknown;
    try {
      body = JSON.parse(json);
    } catch {
      setResult(dict.opsPlatform.common.failed);
      return;
    }
    const out = await action.run<{ received: number; inserted: number; duplicates: number }>(`${base}/observability/import`, post(body));
    if (out) {
      setResult(fill(t.imported, out));
      reloadAll();
    }
  }

  async function synthetic() {
    const out = await action.run<{ received: number; inserted: number; duplicates: number }>(`${base}/observability/synthetic`, post({ days: 14, runs_per_day: 10 }));
    if (out) {
      setResult(fill(t.imported, out));
      reloadAll();
    }
  }

  const fresh = summary.data?.freshness;
  const totals = summary.data?.totals;

  return (
    <div className="grid gap-6" data-testid="ops-observability">
      <Panel title={t.title}>
        <p className="text-sm text-slate-400">{t.intro}</p>
        {fresh && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300" data-testid="ops-freshness">
            <Pill tone={TONE.warn}>{t.notLive}</Pill>
            {t.sources}: {Object.entries(fresh.sources).map(([s, n]) => `${t.sourceNames[s as keyof typeof t.sourceNames] ?? s} ${n}`).join(", ") || "—"} · {t.latest}: {fmtDate(fresh.latest_record_at, locale)}
          </p>
        )}
      </Panel>

      {summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}
      {!summary.data && !summary.error && <LoadingState rows={3} />}
      {totals && totals.runs === 0 && <Panel><EmptyState icon="activity" title={t.noData} /></Panel>}
      {totals && totals.runs > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t.runs} value={number(totals.runs)} icon="activity" />
            <StatCard label={t.errorRate} value={`${totals.error_rate_percent}%`} icon="alert" />
            <StatCard label={t.tokens} value={`${number(totals.input_tokens)} / ${number(totals.output_tokens)}`} icon="chart" />
            <StatCard label={t.cost} value={cost(totals.estimated_cost)} hint={totals.missing_rate_runs ? fill(t.missingRate, { n: totals.missing_rate_runs }) : undefined} icon="chart" />
          </div>
          <Panel title={t.groupBy} actions={
            <select className="field py-1 text-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value as "agent" | "workspace")} aria-label={t.groupBy}>
              <option value="agent">{t.groupAgent}</option>
              <option value="workspace">{t.groupWorkspace}</option>
            </select>
          }>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm" data-testid="ops-usage-groups">
                <thead className="text-slate-400">
                  <tr>{[groupBy === "agent" ? t.groupAgent : t.groupWorkspace, t.runs, t.errorRate, t.avgDuration, t.tokens, t.cost].map((h) => <th key={h} scope="col" className="pb-2 pr-3 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {summary.data!.groups.map((g) => (
                    <tr key={g.key} className="border-t border-white/[0.06]">
                      <th scope="row" className="py-2 pr-3 font-medium text-white">{g.label}</th>
                      <td className="py-2 pr-3">{number(g.runs)}</td>
                      <td className="py-2 pr-3">{g.error_rate_percent}%</td>
                      <td className="py-2 pr-3">{number(g.avg_duration_ms)} ms</td>
                      <td className="py-2 pr-3">{number(g.input_tokens)} / {number(g.output_tokens)}</td>
                      <td className="py-2">{cost(g.estimated_cost)}{g.missing_rate_runs > 0 && <span className="block text-xs text-amber-200">{fill(t.missingRate, { n: g.missing_rate_runs })}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={t.budgets}>
          <p className="mb-3 text-xs text-slate-500">{t.evaluationNote}</p>
          {evaluation.data?.budgets.length === 0 && <p className="text-sm text-slate-400">—</p>}
          <ul className="grid gap-2 text-sm" data-testid="ops-budgets">
            {evaluation.data?.budgets.map((b) => (
              <li key={b.budget.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white">{b.budget.name}</span>
                <span className="flex items-center gap-2 text-slate-300">
                  {b.month_to_date ?? "—"} / {b.budget.amount} {b.budget.currency}
                  <Pill tone={b.state === "ok" ? TONE.ok : b.state === "warning" ? TONE.warn : b.state === "exceeded" ? TONE.bad : TONE.muted}>{t.budgetStates[b.state]}</Pill>
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-white">{t.rules}</h3>
          <ul className="grid gap-2 text-sm">
            {evaluation.data?.rules.map((r) => (
              <li key={r.rule.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white">{r.rule.name} <span className="text-xs text-slate-500">{r.rule.metric} &gt; {r.rule.threshold} · {r.rule.window_days}d</span></span>
                <Pill tone={r.breached === null ? TONE.muted : r.breached ? TONE.bad : TONE.ok}>{r.breached === null ? t.noValue : r.breached ? t.breached : t.notBreached}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t.rateCards}>
          {cards.data?.length === 0 && <p className="text-sm text-amber-200">{t.noRateCards}</p>}
          <ul className="grid gap-2 text-sm">
            {cards.data?.map((c) => (
              <li key={c.id} className="text-slate-300">
                <span className="text-white">{c.provider} · {c.model}</span> <span className="font-mono text-xs">{c.version}</span>: {c.input_per_million} / {c.output_per_million} {c.currency} {t.perMillion}
                <span className="block text-xs text-slate-500">{fmtDate(c.effective_from, locale)} · {c.source_note}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {write && (
        <Panel title={t.import}>
          <div className="grid gap-3">
            <Field label={t.import} hint={t.importHint}>
              <textarea className="field min-h-28 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} data-testid="ops-import-json" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={importJson} busy={action.busy} disabled={!json.trim()}>{t.importButton}</Button>
              {isDemo && <Button onClick={synthetic} busy={action.busy}>{t.synthetic}</Button>}
            </div>
            {isDemo && <p className="text-xs text-slate-500">{t.syntheticHint}</p>}
            <ActionError message={action.error} />
            {result && !action.error && <p role="status" className="text-sm text-emerald-200">{result}</p>}
          </div>
        </Panel>
      )}
    </div>
  );
}
