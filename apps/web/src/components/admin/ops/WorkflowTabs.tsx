"use client";

import { type FormEvent, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { ActionError, Button, Field, SimulatedBadge, TONE, Timeline, fmtDate, post, useAction } from "@/components/admin/ops/shared";
import { EmptyState, ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import type { OpsAgent } from "@/lib/admin-types";
import type { Change, ChangeDetail, EvalRun, Incident, IncidentDetail, VersionSummary } from "@/lib/ops-types";
import { useAdminData } from "@/lib/use-admin-data";

const SEVERITY_TONE = { sev1: TONE.bad, sev2: TONE.bad, sev3: TONE.warn, sev4: TONE.info } as const;

/** Incident records: detected → … → reviewed, an append-only timeline, notes and evidence. */
export function IncidentsTab({ base, agents, permissions }: { base: string; agents: OpsAgent[]; permissions: string[] }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.opsPlatform.incidents;
  const c = dict.opsPlatform.common;
  const list = useAdminData<Incident[]>(`${base}/incidents`);
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useAdminData<IncidentDetail>(selected ? `${base}/incidents/${selected}` : null);
  const action = useAction();
  const [form, setForm] = useState({ title: "", severity: "sev3", impact: "customer_facing", agent_id: "", client_summary: "" });
  const [note, setNote] = useState("");
  const write = permissions.includes("incidents.write");

  async function create(event: FormEvent) {
    event.preventDefault();
    const created = await action.run<Incident>(`${base}/incidents`, post({ ...form, agent_id: form.agent_id || null, client_summary: form.client_summary || null }));
    if (created) {
      setForm({ ...form, title: "", client_summary: "" });
      setSelected(created.id);
      list.reload();
    }
  }

  async function move(to: string) {
    if (!detail.data) return;
    if (await action.run(`${base}/incidents/${detail.data.id}/transition`, post({ to, expected_version: detail.data.lock_version, note: note || null }))) {
      setNote("");
      detail.reload();
      list.reload();
    }
  }

  async function addNote(kind: "note" | "evidence") {
    if (!detail.data || !note.trim()) return;
    if (await action.run(`${base}/incidents/${detail.data.id}/notes`, post({ body: note, kind }))) {
      setNote("");
      detail.reload();
    }
  }

  return (
    <div className="grid gap-6" data-testid="ops-incidents">
      <Panel title={t.title}>
        <p className="text-sm text-slate-400">{t.intro}</p>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title={t.title}>
          {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
          {!list.data && !list.error && <LoadingState rows={2} />}
          {list.data?.length === 0 && <EmptyState icon="alert" title={t.none} />}
          <ul className="grid gap-2 text-sm" data-testid="ops-incident-list">
            {list.data?.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setSelected(i.id)} aria-pressed={selected === i.id}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-left hover:border-white/20">
                  <span className="text-white">#{i.number} {i.title}</span>
                  <span className="flex gap-2"><Pill tone={SEVERITY_TONE[i.severity]}>{t.severities[i.severity]}</Pill><Pill tone={TONE.muted}>{t.statuses[i.status]}</Pill></span>
                </button>
              </li>
            ))}
          </ul>
          {write && (
            <form onSubmit={create} className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4" data-testid="ops-new-incident">
              <h3 className="text-sm font-semibold text-white">{t.new}</h3>
              <Field label={t.titleLabel}><input required minLength={3} className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t.severity}>
                  <select className="field" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                    {Object.entries(t.severities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label={t.impact}>
                  <select className="field" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })}>
                    {Object.entries(t.impacts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label={c.agent}>
                  <select className="field" value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })}>
                    <option value="">{c.none}</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={t.clientSummary}><input className="field" value={form.client_summary} onChange={(e) => setForm({ ...form, client_summary: e.target.value })} /></Field>
              <div><Button type="submit" variant="primary" busy={action.busy}>{t.create}</Button></div>
            </form>
          )}
        </Panel>

        <Panel title={detail.data ? `#${detail.data.number} ${detail.data.title}` : t.timeline}>
          <ActionError message={action.error} />
          {detail.data && (
            <div className="grid gap-4 text-sm" data-testid="ops-incident-detail">
              <p className="flex flex-wrap gap-2">
                <Pill tone={SEVERITY_TONE[detail.data.severity]}>{t.severities[detail.data.severity]}</Pill>
                <Pill tone={TONE.muted}>{t.impacts[detail.data.impact]}</Pill>
                <Pill tone={TONE.info}>{t.statuses[detail.data.status]}</Pill>
              </p>
              {detail.data.client_summary && <p className="text-slate-300">{detail.data.client_summary}</p>}
              <p className="text-xs text-slate-500">{c.updated}: {fmtDate(detail.data.updated_at, locale)}</p>
              {(detail.data.allowed_transitions.length > 0 || write) && (
                <div className="grid gap-2 rounded-lg border border-white/[0.06] p-3">
                  <Field label={c.note}><textarea className="field min-h-16" placeholder={c.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                  <div className="flex flex-wrap gap-2">
                    {detail.data.allowed_transitions.map((to) => (
                      <Button key={to} variant="primary" busy={action.busy} onClick={() => move(to)}>{t.move}: {t.statuses[to as keyof typeof t.statuses]}</Button>
                    ))}
                    {write && <Button busy={action.busy} onClick={() => addNote("note")} disabled={!note.trim()}>{t.addNote}</Button>}
                    {write && <Button busy={action.busy} onClick={() => addNote("evidence")} disabled={!note.trim()}>{t.evidence}</Button>}
                  </div>
                </div>
              )}
              <h3 className="text-sm font-semibold text-white">{t.timeline}</h3>
              <Timeline events={detail.data.events} kinds={t.kinds} statuses={t.statuses} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Controlled changes: draft → risk review → evaluation → human approval → recorded release → review. */
export function ChangesTab({ base, agents, permissions }: { base: string; agents: OpsAgent[]; permissions: string[] }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.opsPlatform.changes;
  const c = dict.opsPlatform.common;
  const list = useAdminData<Change[]>(`${base}/changes`);
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useAdminData<ChangeDetail>(selected ? `${base}/changes/${selected}` : null);
  const runs = useAdminData<EvalRun[]>(detail.data ? `${base}/eval-runs?agent_version_id=${detail.data.agent_version_id}` : null);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const versions = useAdminData<VersionSummary[]>(agentId ? `${base}/agents/${agentId}/versions` : null);
  const action = useAction();
  const [form, setForm] = useState({ agent_version_id: "", title: "", risk: "medium", risk_notes: "" });
  const [step, setStep] = useState({ note: "", evaluation_run_id: "", release_note: "" });
  const write = permissions.includes("changes.write");

  async function create(event: FormEvent) {
    event.preventDefault();
    const created = await action.run<Change>(`${base}/changes`, post({ ...form, risk_notes: form.risk_notes || null }));
    if (created) {
      setSelected(created.id);
      list.reload();
    }
  }

  async function move(to: string) {
    if (!detail.data) return;
    const body = {
      to,
      expected_version: detail.data.lock_version,
      note: step.note || null,
      evaluation_run_id: step.evaluation_run_id || null,
      release_note: step.release_note || null,
    };
    if (await action.run(`${base}/changes/${detail.data.id}/transition`, post(body))) {
      setStep({ note: "", evaluation_run_id: "", release_note: "" });
      detail.reload();
      list.reload();
    }
  }

  return (
    <div className="grid gap-6" data-testid="ops-changes">
      <Panel title={t.title}>
        <p className="text-sm text-slate-400">{t.intro}</p>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title={t.title}>
          {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
          {!list.data && !list.error && <LoadingState rows={2} />}
          {list.data?.length === 0 && <EmptyState icon="workflow" title={t.none} />}
          <ul className="grid gap-2 text-sm">
            {list.data?.map((ch) => (
              <li key={ch.id}>
                <button type="button" onClick={() => setSelected(ch.id)} aria-pressed={selected === ch.id}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-left hover:border-white/20">
                  <span className="text-white">#{ch.number} {ch.title}</span>
                  <span className="flex gap-2"><Pill tone={ch.risk === "high" ? TONE.bad : ch.risk === "medium" ? TONE.warn : TONE.info}>{t.risks[ch.risk]}</Pill><Pill tone={TONE.muted}>{t.statuses[ch.status]}</Pill></span>
                </button>
              </li>
            ))}
          </ul>
          {write && (
            <form onSubmit={create} className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4">
              <h3 className="text-sm font-semibold text-white">{t.new}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={c.agent}>
                  <select className="field" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label={t.version}>
                  <select required className="field" value={form.agent_version_id} onChange={(e) => setForm({ ...form, agent_version_id: e.target.value })}>
                    <option value="">—</option>
                    {versions.data?.map((v) => <option key={v.id} value={v.id}>v{v.number} · {dict.opsPlatform.registry.statuses[v.status]}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={dict.opsPlatform.incidents.titleLabel}><input required minLength={3} className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t.risk}>
                  <select className="field" value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })}>
                    {Object.entries(t.risks).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label={t.riskNotes}><input className="field" value={form.risk_notes} onChange={(e) => setForm({ ...form, risk_notes: e.target.value })} /></Field>
              </div>
              <div><Button type="submit" variant="primary" busy={action.busy}>{t.create}</Button></div>
            </form>
          )}
        </Panel>

        <Panel title={detail.data ? `#${detail.data.number} ${detail.data.title}` : dict.opsPlatform.incidents.timeline}>
          <ActionError message={action.error} />
          {detail.data && (
            <div className="grid gap-4 text-sm" data-testid="ops-change-detail">
              <p className="flex flex-wrap items-center gap-2">
                <Pill tone={TONE.info}>{t.statuses[detail.data.status]}</Pill>
                {detail.data.approved_by && <span className="text-xs text-emerald-200">{t.approvedBy} · {fmtDate(detail.data.approved_at, locale)}</span>}
                {detail.data.evidence_simulated && <SimulatedBadge />}
              </p>
              {detail.data.risk_notes && <p className="text-slate-300">{t.riskNotes}: {detail.data.risk_notes}</p>}
              {detail.data.release_note && <p className="text-slate-300">{t.releaseNote}: {detail.data.release_note}</p>}
              {detail.data.allowed_transitions.length > 0 && (
                <div className="grid gap-2 rounded-lg border border-white/[0.06] p-3">
                  <Field label={c.note}><input className="field" placeholder={c.notePlaceholder} value={step.note} onChange={(e) => setStep({ ...step, note: e.target.value })} /></Field>
                  {detail.data.status === "evaluation" && (
                    <Field label={t.evaluationRun}>
                      <select className="field" value={step.evaluation_run_id} onChange={(e) => setStep({ ...step, evaluation_run_id: e.target.value })}>
                        <option value="">—</option>
                        {runs.data?.map((r) => <option key={r.id} value={r.id}>{fmtDate(r.finished_at, locale)} · {r.passed}/{r.total}{r.simulated ? ` · ${c.simulated}` : ""}</option>)}
                      </select>
                    </Field>
                  )}
                  {detail.data.status === "approved" && (
                    <Field label={t.releaseNote}><input className="field" value={step.release_note} onChange={(e) => setStep({ ...step, release_note: e.target.value })} /></Field>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {detail.data.allowed_transitions.map((to) => (
                      <Button key={to} variant={to === "rejected" ? "secondary" : "primary"} busy={action.busy} onClick={() => move(to)}>{dict.opsPlatform.incidents.move}: {t.statuses[to as keyof typeof t.statuses]}</Button>
                    ))}
                  </div>
                </div>
              )}
              <Timeline events={detail.data.events} kinds={dict.opsPlatform.incidents.kinds} statuses={t.statuses} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
