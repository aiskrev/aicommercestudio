"use client";

import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { ActionError, AgentPicker, Button, Field, SimulatedBadge, TONE, fill, fmtDate, post, useAction } from "@/components/admin/ops/shared";
import { EmptyState, ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin-api";
import type { OpsAgent } from "@/lib/admin-types";
import type { Comparison, Dataset, EvalRun, EvalRunDetail, VersionSummary } from "@/lib/ops-types";
import { useAdminData } from "@/lib/use-admin-data";

/** Versioned synthetic datasets, simulated runs, manual labels and run-to-run comparison. */
export function EvaluationsTab({ base, agents, permissions }: { base: string; agents: OpsAgent[]; permissions: string[] }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.opsPlatform.evaluations;
  const [agentId, setAgentId] = useState<string | null>(agents[0]?.id ?? null);
  const datasets = useAdminData<Dataset[]>(agentId ? `${base}/agents/${agentId}/datasets` : null);
  const versions = useAdminData<VersionSummary[]>(agentId ? `${base}/agents/${agentId}/versions` : null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const dataset = datasets.data?.find((d) => d.id === datasetId) ?? null;
  const runs = useAdminData<EvalRun[]>(datasetId ? `${base}/eval-runs?dataset_id=${datasetId}` : null);
  const [runId, setRunId] = useState<string | null>(null);
  const run = useAdminData<EvalRunDetail>(runId ? `${base}/eval-runs/${runId}` : null);
  const [versionId, setVersionId] = useState("");
  const [pair, setPair] = useState({ base: "", candidate: "" });
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const action = useAction();
  const can = (p: string) => permissions.includes(p);

  async function fromTemplate() {
    const created = await action.run<Dataset>(`${base}/agents/${agentId}/datasets/templates/support_basics`, post());
    if (created) {
      setDatasetId(created.id);
      datasets.reload();
    }
  }

  async function lock() {
    if (await action.run(`${base}/datasets/${datasetId}/lock`, post())) datasets.reload();
  }

  async function execute() {
    const created = await action.run<EvalRunDetail>(`${base}/datasets/${datasetId}/runs`, post({ agent_version_id: versionId }));
    if (created) {
      setRunId(created.id);
      runs.reload();
    }
  }

  async function compare() {
    setComparison(await adminFetch<Comparison>(`${base}/eval-runs/${pair.base}/compare/${pair.candidate}`).catch(() => null));
  }

  async function label(resultId: string, value: string) {
    if (await action.run(`${base}/eval-results/${resultId}/label`, { method: "PUT", body: JSON.stringify({ label: value || null }) })) run.reload();
  }

  return (
    <div className="grid gap-6" data-testid="ops-evaluations">
      <Panel title={t.title}>
        <p className="mb-4 text-sm text-slate-400">{t.intro}</p>
        <div className="flex flex-wrap items-end gap-4">
          <AgentPicker agents={agents} value={agentId} onChange={(id) => { setAgentId(id); setDatasetId(null); setRunId(null); }} />
          {can("evals.write") && agentId && <Button onClick={fromTemplate} busy={action.busy}>{t.fromTemplate}</Button>}
        </div>
        <div className="mt-3"><ActionError message={action.error} /></div>
      </Panel>

      {agentId && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title={t.datasets}>
            {datasets.error && <ErrorState message={datasets.error} onRetry={datasets.reload} />}
            {!datasets.data && !datasets.error && <LoadingState rows={2} />}
            {datasets.data?.length === 0 && <EmptyState icon="list" title={t.noDatasets} />}
            <ul className="grid gap-2 text-sm">
              {datasets.data?.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => { setDatasetId(d.id); setRunId(null); }} aria-pressed={datasetId === d.id}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-left hover:border-white/20">
                    <span className="text-white">{d.name} <span className="font-mono text-xs text-slate-500">{d.key} v{d.version}</span></span>
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                      {fill(t.cases, { n: d.case_count })}
                      <Pill tone={d.status === "locked" ? TONE.ok : TONE.muted}>{d.status === "locked" ? t.locked : t.draft}</Pill>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {dataset && can("evals.write") && (
              <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4">
                {dataset.status === "draft" ? (
                  <div><Button onClick={lock} busy={action.busy}>{t.lock}</Button></div>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label={t.run}>
                      <select className="field min-w-48" value={versionId} onChange={(e) => setVersionId(e.target.value)} data-testid="ops-run-version">
                        <option value="">{t.chooseVersion}</option>
                        {versions.data?.map((v) => <option key={v.id} value={v.id}>v{v.number} · {dict.opsPlatform.registry.statuses[v.status]}</option>)}
                      </select>
                    </Field>
                    <Button variant="primary" onClick={execute} busy={action.busy} disabled={!versionId}>{t.run}</Button>
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title={t.runs}>
            {!datasetId && <p className="text-sm text-slate-400">—</p>}
            {runs.data?.length === 0 && <EmptyState icon="activity" title={t.noRuns} />}
            <ul className="grid gap-2 text-sm" data-testid="ops-runs">
              {runs.data?.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setRunId(r.id)} aria-pressed={runId === r.id}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-left hover:border-white/20">
                    <span className="text-white">{fill(t.passRate, { passed: r.passed, total: r.total })}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-400">{fmtDate(r.finished_at, locale)}{r.simulated && <SimulatedBadge />}</span>
                  </button>
                </li>
              ))}
            </ul>
            {runs.data && runs.data.length > 1 && (
              <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4">
                <h3 className="text-sm font-semibold text-white">{t.compare}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["base", "candidate"] as const).map((key) => (
                    <Field key={key} label={t[key]}>
                      <select className="field" value={pair[key]} onChange={(e) => setPair({ ...pair, [key]: e.target.value })}>
                        <option value="">—</option>
                        {runs.data!.map((r) => <option key={r.id} value={r.id}>{fmtDate(r.finished_at, locale)} · {r.passed}/{r.total}</option>)}
                      </select>
                    </Field>
                  ))}
                </div>
                <div><Button onClick={compare} disabled={!pair.base || !pair.candidate}>{t.compare}</Button></div>
                {comparison && (
                  <div className="grid gap-1 text-sm" data-testid="ops-comparison">
                    {comparison.simulated && <p><SimulatedBadge /></p>}
                    <p className="text-slate-300">{comparison.base_pass_rate}% → {comparison.candidate_pass_rate}%</p>
                    <p className={comparison.has_regressions ? "text-rose-200" : "text-emerald-200"}>
                      {comparison.has_regressions ? `${t.regressions}: ${comparison.regressions.join(", ")}` : t.noRegressions}
                    </p>
                    {comparison.fixes.length > 0 && <p className="text-slate-300">{t.fixes}: {comparison.fixes.join(", ")}</p>}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}

      {run.data && (
        <Panel title={t.results}>
          {run.data.note && <p className="mb-3 flex items-center gap-2 text-sm text-amber-100"><SimulatedBadge /> {run.data.note}</p>}
          <ul className="grid gap-3 text-sm" data-testid="ops-results">
            {run.data.results.map((r) => (
              <li key={r.id} className="rounded-lg border border-white/[0.06] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-white">{r.case_key}</span>
                  <Pill tone={r.passed ? TONE.ok : TONE.bad}>{r.passed ? dict.opsPlatform.evaluations.labels.pass : dict.opsPlatform.evaluations.labels.fail}</Pill>
                </div>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-400">{r.output_text}</pre>
                <ul className="mt-2 grid gap-0.5 text-xs">
                  {r.assertion_results.map((a, i) => (
                    <li key={i} className={a.passed ? "text-emerald-300" : "text-rose-300"}>{a.passed ? "✓" : "✗"} {a.type}: {a.value}</li>
                  ))}
                </ul>
                {permissions.includes("evals.label") && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    {t.label}
                    <select className="field py-1 text-xs" value={r.manual_label ?? ""} onChange={(e) => label(r.id, e.target.value)}>
                      <option value="">{t.clearLabel}</option>
                      {(["pass", "fail", "needs_review"] as const).map((l) => <option key={l} value={l}>{t.labels[l]}</option>)}
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
