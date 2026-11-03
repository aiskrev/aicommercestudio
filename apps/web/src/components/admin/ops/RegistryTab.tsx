"use client";

import { type FormEvent, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { ActionError, AgentPicker, Button, Field, SimulatedBadge, TONE, fmtDate, post, useAction } from "@/components/admin/ops/shared";
import { EmptyState, ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import type { OpsAgent } from "@/lib/admin-types";
import type { EvalRun, VersionDetail, VersionDiff, VersionStatus, VersionSummary } from "@/lib/ops-types";
import { useAdminData } from "@/lib/use-admin-data";

const STATUS_TONE: Record<VersionStatus, string> = { draft: TONE.muted, in_review: TONE.info, approved: TONE.ok, retired: TONE.muted };

/** Versioned configuration/prompt registry: drafts, review decisions, diffs and rollback drafts. Nothing deploys. */
export function RegistryTab({ base, agents, permissions }: { base: string; agents: OpsAgent[]; permissions: string[] }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.opsPlatform.registry;
  const c = dict.opsPlatform.common;
  const [agentId, setAgentId] = useState<string | null>(agents[0]?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const versions = useAdminData<VersionSummary[]>(agentId ? `${base}/agents/${agentId}/versions` : null);
  const detail = useAdminData<VersionDetail>(selected ? `${base}/versions/${selected}` : null);
  const runs = useAdminData<EvalRun[]>(selected ? `${base}/eval-runs?agent_version_id=${selected}` : null);
  const previous = versions.data?.find((v) => detail.data && v.number === detail.data.number - 1);
  const diff = useAdminData<VersionDiff>(previous && selected ? `${base}/versions/${previous.id}/diff/${selected}` : null);
  const action = useAction();
  const can = (p: string) => permissions.includes(p);
  const [draft, setDraft] = useState({ prompt: "", provider: "", model: "", reason: "" });
  const [note, setNote] = useState("");
  const [runId, setRunId] = useState("");

  const refresh = () => {
    versions.reload();
    detail.reload();
  };

  async function create(event: FormEvent) {
    event.preventDefault();
    const body = {
      content: { prompt_template: draft.prompt, provider: draft.provider || null, model: draft.model || null },
      change_reason: draft.reason,
    };
    const created = await action.run<VersionDetail>(`${base}/agents/${agentId}/versions`, post(body));
    if (created) {
      setDraft({ prompt: "", provider: "", model: "", reason: "" });
      setSelected(created.id);
      versions.reload();
    }
  }

  async function act(path: string, body?: unknown) {
    if (await action.run(`${base}/versions/${selected}/${path}`, post(body))) refresh();
  }

  async function rollback() {
    const created = await action.run<VersionDetail>(`${base}/agents/${agentId}/versions`, post({ rollback_of_id: selected, change_reason: `Rollback to v${detail.data?.number}` }));
    if (created) {
      setSelected(created.id);
      versions.reload();
    }
  }

  return (
    <div className="grid gap-6" data-testid="ops-registry">
      <Panel title={t.title}>
        <p className="mb-4 text-sm text-slate-400">{t.intro}</p>
        <AgentPicker agents={agents} value={agentId} onChange={(id) => { setAgentId(id); setSelected(null); }} />
      </Panel>

      {agentId && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Panel title={t.versions}>
            {versions.error && <ErrorState message={versions.error} onRetry={versions.reload} />}
            {!versions.data && !versions.error && <LoadingState rows={3} />}
            {versions.data?.length === 0 && <EmptyState icon="layers" title={t.noVersions} />}
            {versions.data && versions.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm" data-testid="ops-versions">
                  <thead className="text-slate-400">
                    <tr>
                      {[t.columns.number, t.columns.status, t.columns.environment, t.columns.reason].map((h) => (
                        <th key={h} scope="col" className="pb-2 pr-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {versions.data.map((v) => (
                      <tr key={v.id} className="border-t border-white/[0.06]">
                        <th scope="row" className="py-2 pr-3">
                          <button type="button" className="font-mono text-cyan-300 hover:underline" onClick={() => setSelected(v.id)} aria-pressed={selected === v.id}>
                            v{v.number}
                          </button>
                        </th>
                        <td className="py-2 pr-3">
                          <Pill tone={STATUS_TONE[v.status]}>{t.statuses[v.status]}</Pill>
                          {v.sensitive && <span className="ml-2 text-xs text-amber-200">{t.sensitive}</span>}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{dict.operations.environments[v.environment as keyof typeof dict.operations.environments] ?? v.environment}</td>
                        <td className="py-2 text-slate-300">{v.change_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {can("registry.write") && (
              <form onSubmit={create} className="mt-6 grid gap-3 border-t border-white/[0.06] pt-5" data-testid="ops-new-version">
                <h3 className="text-sm font-semibold text-white">{t.newDraft}</h3>
                <Field label={t.prompt}>
                  <textarea required className="field min-h-32 font-mono text-xs" value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t.provider}><input className="field" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} /></Field>
                  <Field label={t.model}><input className="field" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></Field>
                </div>
                <Field label={t.reason}><input required minLength={3} className="field" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></Field>
                <div><Button type="submit" variant="primary" busy={action.busy}>{t.create}</Button></div>
              </form>
            )}
          </Panel>

          <Panel title={detail.data ? `v${detail.data.number}` : t.versions}>
            <ActionError message={action.error} />
            {!selected && <p className="text-sm text-slate-400">—</p>}
            {detail.data && (
              <div className="grid gap-4 text-sm" data-testid="ops-version-detail">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={STATUS_TONE[detail.data.status]}>{t.statuses[detail.data.status]}</Pill>
                  {detail.data.sensitive && <span className="text-xs text-amber-200" title={t.sensitiveHint}>{t.sensitive}: {t.sensitiveHint}</span>}
                </div>
                <p className={detail.data.integrity_ok ? "text-emerald-200" : "text-rose-200"} data-testid="ops-integrity">
                  {t.integrity}: {detail.data.integrity_ok ? t.integrityOk : t.integrityFailed}
                </p>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">{t.prompt}</p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-xs text-slate-200">{detail.data.prompt_template}</pre>
                </div>
                <p className="text-slate-300">
                  {t.provider}: {detail.data.provider ?? "—"} · {t.model}: {detail.data.model ?? "—"} · {t.parameters}: <code className="text-xs">{JSON.stringify(detail.data.parameters)}</code>
                </p>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">{t.tools}</p>
                  {detail.data.tools.length === 0 ? <p className="text-slate-400">{t.noTools}</p> : (
                    <ul className="grid gap-1">
                      {detail.data.tools.map((tool) => (
                        <li key={tool.name} className="text-slate-300"><span className="font-mono">{tool.name}</span> · {tool.kind} · {tool.access}{tool.integration ? ` · ${tool.integration}` : ""}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {detail.data.evidence_simulated && <p className="flex items-center gap-2 text-slate-300"><SimulatedBadge /> {t.evidenceSimulated}</p>}
                <p className="text-xs text-slate-500">{c.created}: {fmtDate(detail.data.created_at, locale)} · <span className="font-mono">{detail.data.content_hash.slice(0, 16)}…</span></p>

                <div className="flex flex-wrap gap-2">
                  {detail.data.status === "draft" && can("registry.write") && <Button variant="primary" busy={action.busy} onClick={() => act("submit")}>{t.submit}</Button>}
                  {detail.data.status === "approved" && can("registry.approve") && <Button busy={action.busy} onClick={() => act("retire")}>{t.retire}</Button>}
                  {(detail.data.status === "approved" || detail.data.status === "retired") && can("registry.write") && <Button busy={action.busy} onClick={rollback}>{t.rollback}</Button>}
                </div>

                {detail.data.status === "in_review" && can("registry.approve") && (
                  <div className="grid gap-3 rounded-lg border border-white/[0.06] p-3" data-testid="ops-review">
                    <Field label={t.evaluationRun}>
                      <select className="field" value={runId} onChange={(e) => setRunId(e.target.value)}>
                        <option value="">{t.noRun}</option>
                        {runs.data?.map((r) => (
                          <option key={r.id} value={r.id}>{fmtDate(r.finished_at, locale)} · {r.passed}/{r.total}{r.simulated ? ` · ${c.simulated}` : ""}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={c.note}><input className="field" placeholder={c.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" busy={action.busy} onClick={() => act("review", { decision: "approve", note: note || null, evaluation_run_id: runId || null })}>{t.approve}</Button>
                      <Button busy={action.busy} onClick={() => act("review", { decision: "request_changes", note: note || null })}>{t.requestChanges}</Button>
                    </div>
                  </div>
                )}

                {previous && diff.data && (
                  <details className="rounded-lg border border-white/[0.06] p-3" data-testid="ops-diff">
                    <summary className="cursor-pointer text-white">{t.diff} (v{diff.data.from_version} → v{diff.data.to_version})</summary>
                    {diff.data.changes.length === 0 && diff.data.prompt_diff.length === 0 ? <p className="mt-2 text-slate-400">{t.noDiff}</p> : (
                      <>
                        {diff.data.changes.map((ch) => (
                          <p key={ch.field} className="mt-2 text-slate-300"><span className="font-medium">{ch.field}</span>: <code className="text-xs">{JSON.stringify(ch.before)}</code> → <code className="text-xs">{JSON.stringify(ch.after)}</code></p>
                        ))}
                        <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs">
                          {diff.data.prompt_diff.map((line, i) => (
                            <span key={i} className={line.startsWith("+") ? "text-emerald-300" : line.startsWith("-") ? "text-rose-300" : "text-slate-400"}>{line}{"\n"}</span>
                          ))}
                        </pre>
                      </>
                    )}
                  </details>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
