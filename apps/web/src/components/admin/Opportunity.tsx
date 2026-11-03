"use client";

import { type FormEvent, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { EmptyState, ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import { buttonClass, cx } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import {
  ALLOWED_ACTIONS,
  ASSESSMENT_TOOLS,
  contentToText,
  DISCOVERY_STATUSES,
  type Opportunity,
  PROPOSAL_KINDS,
  PROPOSAL_SECTIONS,
  type Proposal,
  type ProposalAction,
  type ProposalContent,
  type ProposalKind,
  type ProposalSection,
  PROVIDED_IN,
  QUALIFICATION_STATUSES,
  SERVICE_DOMAINS,
  type Stakeholder,
  textToContent,
  type VersionDetail,
} from "@/lib/opportunity-types";
import { useAdminData } from "@/lib/use-admin-data";
import workshopTitles from "@/lib/workshop-keys.json";

const WORKSHOPS = Object.keys(workshopTitles) as (keyof typeof workshopTitles)[];

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const blank = (value: string) => (value.trim() ? value.trim() : null);

/**
 * Engineering opportunity record of one lead (docs/OPPORTUNITY_WORKFLOW.md): source and linked
 * assessments, domain, problem and scope, discovery and qualification with rationale, constraints,
 * stakeholders the client named, next action and the recommended workshop or assessment.
 */
export function OpportunityPanel({ leadId, onSaved }: { leadId: string; onSaved?: () => void }) {
  const data = useAdminData<Opportunity>(`/api/admin/leads/${leadId}/opportunity`);
  const { t: dict } = useAdminI18n();
  if (data.loading && !data.data) return <LoadingState />;
  if (data.error && !data.data) return <ErrorState message={data.error} requestId={data.errorId} onRetry={data.reload} />;
  if (!data.data) return null;
  return (
    <OpportunityForm
      key={data.data.revision}
      initial={data.data}
      onSaved={(next) => {
        data.replace(next);
        onSaved?.();
      }}
      onReload={data.reload}
      title={dict.opportunity.title}
    />
  );
}

function OpportunityForm({
  initial,
  onSaved,
  onReload,
  title,
}: {
  initial: Opportunity;
  onSaved: (next: Opportunity) => void;
  onReload: () => void;
  title: string;
}) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.opportunity;
  const [form, setForm] = useState({
    service_domain: initial.service_domain ?? "",
    problem_summary: initial.problem_summary ?? "",
    scope_summary: initial.scope_summary ?? "",
    discovery_status: initial.discovery_status,
    qualification_status: initial.qualification_status,
    qualification_rationale: initial.qualification_rationale ?? "",
    technical_constraints: initial.technical_constraints ?? "",
    next_action: initial.next_action ?? "",
    next_action_due: initial.next_action_due ?? "",
    notes: initial.notes ?? "",
    recommended_workshop: initial.recommended_workshop ?? "",
    recommended_assessment: initial.recommended_assessment ?? "",
    recommendation_rationale: initial.recommendation_rationale ?? "",
  });
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>(initial.stakeholders);
  const [confirmed, setConfirmed] = useState(initial.stakeholders.length > 0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [stale, setStale] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const src = initial.source;
  const workshopName = (key: string) => (workshopTitles as Record<string, { bg: string; en: string }>)[key]?.[locale] ?? key;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const next = await adminFetch<Opportunity>(`/api/admin/leads/${initial.lead_id}/opportunity`, {
        method: "PUT",
        body: JSON.stringify({
          expected_revision: initial.revision,
          service_domain: form.service_domain || null,
          problem_summary: blank(form.problem_summary),
          scope_summary: blank(form.scope_summary),
          discovery_status: form.discovery_status,
          qualification_status: form.qualification_status,
          qualification_rationale: blank(form.qualification_rationale),
          technical_constraints: blank(form.technical_constraints),
          stakeholders: stakeholders.filter((s) => s.name.trim() && s.role.trim()),
          stakeholders_confirmed: confirmed,
          next_action: blank(form.next_action),
          next_action_due: form.next_action_due || null,
          notes: blank(form.notes),
          recommended_workshop: form.recommended_workshop || null,
          recommended_assessment: form.recommended_assessment || null,
          recommendation_rationale: blank(form.recommendation_rationale),
        }),
      });
      onSaved(next);
      setMessage({ ok: true, text: t.savedOk });
    } catch (err) {
      setStale(err instanceof ApiError && err.code === "opportunity_stale");
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : dict.common.saveError });
    } finally {
      setSaving(false);
    }
  }

  const textarea = (key: keyof typeof form, label: string, hint?: string) => (
    <Field id={`opp-${key}`} label={label} hint={hint}>
      <textarea id={`opp-${key}`} className="field min-h-20" maxLength={4000} value={form[key]} onChange={set(key)} />
    </Field>
  );

  return (
    <Panel title={title}>
      <form onSubmit={save} className="grid gap-5" data-testid="opportunity-form">
        <p className="text-sm text-slate-400">{t.lead}</p>
        <p className="text-sm text-slate-300">
          {initial.exists ? fmt(t.saved, { revision: initial.revision, who: initial.updated_by ?? "—" }) : t.notSaved}
        </p>

        <section className="grid gap-2 rounded-lg border border-white/[0.08] p-4 text-sm" data-testid="opportunity-source">
          <h3 className="font-semibold">{t.source}</h3>
          <p className="text-slate-300">{fmt(t.sourceLine, { source: src.source, type: src.inquiry_type, service: src.submitted_service })}</p>
          {src.workshop_key && <p className="text-slate-300">{fmt(t.workshopEnquiry, { title: workshopName(src.workshop_key) })}</p>}
          <h4 className="mt-2 font-medium">{t.linked}</h4>
          {src.linked.length === 0 ? (
            <p className="text-slate-400">{t.noLinked}</p>
          ) : (
            <ul className="grid gap-1">
              {src.linked.map((record) => (
                <li key={`${record.kind}-${record.reference}`} className="text-slate-300">
                  {t.linkedKinds[record.kind]} · #{record.reference}
                  {record.detail ? ` · ${record.detail}` : ""}
                  {record.created_at ? ` · ${formatDateTime(record.created_at, locale)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="opp-domain" label={t.domain}>
            <select id="opp-domain" className="field" value={form.service_domain} onChange={set("service_domain")}>
              <option value="">{t.none}</option>
              {SERVICE_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {t.domains[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="opp-discovery" label={t.discovery}>
            <select id="opp-discovery" className="field" value={form.discovery_status} onChange={set("discovery_status")}>
              {DISCOVERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.discoveryStatuses[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="opp-qualification" label={t.qualification}>
            <select id="opp-qualification" className="field" value={form.qualification_status} onChange={set("qualification_status")}>
              {QUALIFICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.qualificationStatuses[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {textarea("qualification_rationale", t.rationale)}
        {textarea("problem_summary", t.problem)}
        {textarea("scope_summary", t.scope)}
        {textarea("technical_constraints", t.constraints)}

        <fieldset className="grid gap-3 rounded-lg border border-white/[0.08] p-4" data-testid="opportunity-stakeholders">
          <legend className="px-1 text-sm font-semibold">{t.stakeholders}</legend>
          <p className="text-xs text-slate-400">{t.stakeholdersHint}</p>
          {stakeholders.map((person, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
              <Field id={`opp-sh-name-${index}`} label={t.stakeholderName}>
                <input
                  id={`opp-sh-name-${index}`}
                  className="field"
                  maxLength={120}
                  value={person.name}
                  onChange={(e) => setStakeholders((list) => list.map((p, i) => (i === index ? { ...p, name: e.target.value } : p)))}
                />
              </Field>
              <Field id={`opp-sh-role-${index}`} label={t.stakeholderRole}>
                <input
                  id={`opp-sh-role-${index}`}
                  className="field"
                  maxLength={120}
                  value={person.role}
                  onChange={(e) => setStakeholders((list) => list.map((p, i) => (i === index ? { ...p, role: e.target.value } : p)))}
                />
              </Field>
              <Field id={`opp-sh-in-${index}`} label={t.providedIn}>
                <select
                  id={`opp-sh-in-${index}`}
                  className="field"
                  value={person.provided_in}
                  onChange={(e) =>
                    setStakeholders((list) =>
                      list.map((p, i) => (i === index ? { ...p, provided_in: e.target.value as Stakeholder["provided_in"] } : p)),
                    )
                  }
                >
                  {PROVIDED_IN.map((v) => (
                    <option key={v} value={v}>
                      {t.providedInLabels[v]}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setStakeholders((list) => list.filter((_, i) => i !== index))}>
                {t.removeStakeholder}
              </button>
            </div>
          ))}
          {stakeholders.length < 12 && (
            <button
              type="button"
              className={cx(buttonClass("secondary", "sm"), "justify-self-start")}
              onClick={() => setStakeholders((list) => [...list, { name: "", role: "", provided_in: "call" }])}
            >
              {t.addStakeholder}
            </button>
          )}
          {stakeholders.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              {t.stakeholdersConfirmed}
            </label>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field id="opp-next" label={t.nextAction}>
            <input id="opp-next" className="field" maxLength={300} value={form.next_action} onChange={set("next_action")} />
          </Field>
          <Field id="opp-due" label={t.nextActionDue}>
            <input id="opp-due" type="date" className="field" value={form.next_action_due} onChange={set("next_action_due")} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="opp-workshop" label={t.recommendedWorkshop}>
            <select id="opp-workshop" className="field" value={form.recommended_workshop} onChange={set("recommended_workshop")}>
              <option value="">{t.none}</option>
              {WORKSHOPS.map((key) => (
                <option key={key} value={key}>
                  {workshopName(key)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="opp-assessment" label={t.recommendedAssessment}>
            <select id="opp-assessment" className="field" value={form.recommended_assessment} onChange={set("recommended_assessment")}>
              <option value="">{t.none}</option>
              {ASSESSMENT_TOOLS.map((key) => (
                <option key={key} value={key}>
                  {t.tools[key]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {textarea("recommendation_rationale", t.recommendationRationale)}
        {textarea("notes", t.notes)}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClass("primary")} disabled={saving}>
            {saving ? dict.common.saving : t.save}
          </button>
          {stale && (
            <button type="button" onClick={onReload} className={buttonClass("secondary", "sm")}>
              {t.reload}
            </button>
          )}
          <p aria-live="polite" className={cx("text-sm", message?.ok ? "text-emerald-300" : "text-rose-300")}>
            {message?.text}
          </p>
        </div>
      </form>
    </Panel>
  );
}

const STATUS_TONE: Record<Proposal["status"], string> = {
  draft: "ring-slate-500/40 text-slate-300",
  in_review: "ring-amber-400/40 text-amber-200",
  approved: "ring-emerald-400/40 text-emerald-200",
  rejected: "ring-rose-400/40 text-rose-200",
  withdrawn: "ring-slate-600/40 text-slate-400",
};

/** Proposal and SOW drafts of one lead: create (blank or generated), versions, review, human approval. */
export function ProposalsPanel({ leadId, onChanged }: { leadId: string; onChanged?: () => void }) {
  const list = useAdminData<Proposal[]>(`/api/admin/leads/${leadId}/proposals`);
  const { t: dict } = useAdminI18n();
  const t = dict.proposals;
  const [kind, setKind] = useState<ProposalKind>("proposal");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function create(generate: boolean) {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await adminFetch<Proposal>(`/api/admin/leads/${leadId}/proposals`, {
        method: "POST",
        body: JSON.stringify({ kind, title: title.trim(), generate }),
      });
      setTitle("");
      setOpenId(created.id);
      list.reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.common.saveError);
    } finally {
      setBusy(false);
    }
  }

  const replace = (next: Proposal) => {
    list.replace((list.data ?? []).map((p) => (p.id === next.id ? next : p)));
    onChanged?.();
  };

  return (
    <Panel title={t.title}>
      <div className="grid gap-5" data-testid="proposals">
        <p className="text-sm text-slate-400">{t.lead}</p>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Field id="proposal-kind" label={t.kind}>
            <select id="proposal-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as ProposalKind)}>
              {PROPOSAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="proposal-title" label={t.newTitle}>
            <input id="proposal-title" className="field" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass("primary", "sm")} disabled={busy || !title.trim()} onClick={() => create(true)}>
            {t.generate}
          </button>
          <button type="button" className={buttonClass("secondary", "sm")} disabled={busy || !title.trim()} onClick={() => create(false)}>
            {t.blank}
          </button>
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}

        {list.loading && !list.data && <LoadingState />}
        {list.error && <ErrorState message={list.error} requestId={list.errorId} onRetry={list.reload} />}
        {list.data && list.data.length === 0 && <EmptyState icon="clipboard" title={t.empty} />}
        {list.data?.map((proposal) => (
          <article key={proposal.id} className="rounded-lg border border-white/[0.08]" data-testid="proposal" data-status={proposal.status}>
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
              aria-expanded={openId === proposal.id}
              onClick={() => setOpenId(openId === proposal.id ? null : proposal.id)}
            >
              <span className="font-semibold">
                {proposal.title} <span className="text-sm font-normal text-slate-400">· {t.kinds[proposal.kind]} · v{proposal.current_version}</span>
              </span>
              <Pill tone={STATUS_TONE[proposal.status]}>{t.statuses[proposal.status]}</Pill>
            </button>
            {openId === proposal.id && <ProposalEditor key={proposal.revision} proposal={proposal} onChanged={replace} onReload={list.reload} />}
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ProposalEditor({ proposal, onChanged, onReload }: { proposal: Proposal; onChanged: (p: Proposal) => void; onReload: () => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.proposals;
  const latest = proposal.latest;
  const editable = proposal.status === "draft" || proposal.status === "rejected";
  const [text, setText] = useState<Record<ProposalSection, string>>(() => contentToText(latest.content));
  const [commercial, setCommercial] = useState<ProposalContent["commercial"]>(latest.content.commercial);
  const [changeNote, setChangeNote] = useState("");
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; stale?: boolean } | null>(null);
  const [viewing, setViewing] = useState<VersionDetail | null>(null);
  const date = (value: string) => formatDateTime(value, locale);

  async function call(path: string, body: object) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await adminFetch<Proposal>(`/api/admin/leads/${proposal.lead_id}/proposals/${proposal.id}${path}`, {
        method: "POST",
        body: JSON.stringify({ expected_revision: proposal.revision, ...body }),
      });
      onChanged(next);
    } catch (err) {
      const stale = err instanceof ApiError && err.code === "opportunity_stale";
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : dict.common.saveError, stale });
    } finally {
      setBusy(false);
    }
  }

  async function view(number: number) {
    if (viewing?.number === number) return setViewing(null);
    setViewing(await adminFetch<VersionDetail>(`/api/admin/leads/${proposal.lead_id}/proposals/${proposal.id}/versions/${number}`));
  }

  function act(action: ProposalAction) {
    return call("/transition", { action, note: note.trim() || null, acknowledge_warnings: acknowledged });
  }

  return (
    <div className="grid gap-5 border-t border-white/[0.08] p-4">
      <p className="text-sm text-slate-400">
        {fmt(t.versionLine, { number: latest.number, origin: t.origins[latest.origin], author: latest.author ?? "—", date: date(latest.created_at) })}
      </p>
      {latest.origin === "generated_draft" && <p className="text-sm text-amber-200">{t.generatedNote}</p>}
      {proposal.status === "approved" && proposal.approved_version && proposal.approved_at && (
        <p className="text-sm text-emerald-200" data-testid="proposal-approved">
          {fmt(t.approvedLine, { version: proposal.approved_version, who: proposal.decided_by ?? "—", date: date(proposal.approved_at) })}
        </p>
      )}

      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void call("/versions", { content: textToContent(text, commercial), change_note: changeNote.trim() });
        }}
      >
        {PROPOSAL_SECTIONS.filter((s) => s !== "commercial").map((section) => (
          <Field key={section} id={`p-${proposal.id}-${section}`} label={t.sections[section]}>
            <textarea
              id={`p-${proposal.id}-${section}`}
              className="field min-h-20 font-mono text-xs"
              readOnly={!editable}
              value={text[section]}
              onChange={(e) => setText((v) => ({ ...v, [section]: e.target.value }))}
            />
          </Field>
        ))}
        <fieldset className="grid gap-3 rounded-lg border border-white/[0.08] p-4">
          <legend className="px-1 text-sm font-semibold">{t.sections.commercial}</legend>
          {(Object.keys(commercial) as (keyof ProposalContent["commercial"])[]).map((field) => (
            <Field key={field} id={`p-${proposal.id}-c-${field}`} label={t.commercial[field]}>
              <input
                id={`p-${proposal.id}-c-${field}`}
                className="field"
                readOnly={!editable}
                value={commercial[field]}
                onChange={(e) => setCommercial((c) => ({ ...c, [field]: e.target.value }))}
              />
            </Field>
          ))}
        </fieldset>
        {editable && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field id={`p-${proposal.id}-note`} label={t.changeNote}>
              <input id={`p-${proposal.id}-note`} className="field" maxLength={500} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
            </Field>
            <button type="submit" className={buttonClass("primary", "sm")} disabled={busy || changeNote.trim().length < 3}>
              {t.saveVersion}
            </button>
          </div>
        )}
      </form>

      <section aria-label={t.findings} data-testid="proposal-findings">
        <h3 className="text-sm font-semibold">{t.findings}</h3>
        {latest.findings.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">{t.noFindings}</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {latest.findings.map((f) => (
              <li key={`${f.code}-${f.section}`} className={f.blocking ? "text-rose-200" : "text-amber-200"}>
                {t.sections[f.section].split(" (")[0]}: {t.findingCodes[f.code]}
                {f.blocking ? ` (${t.blocking})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ALLOWED_ACTIONS[proposal.status].length > 0 && (
        <div className="grid gap-3">
          <Field id={`p-${proposal.id}-decision`} label={t.decisionNote}>
            <textarea id={`p-${proposal.id}-decision`} className="field min-h-16" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {proposal.status === "in_review" && latest.findings.some((f) => !f.blocking) && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
              {t.acknowledge}
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {ALLOWED_ACTIONS[proposal.status].map((action) => (
              <button
                key={action}
                type="button"
                className={buttonClass(action === "approve" ? "primary" : "secondary", "sm")}
                disabled={busy}
                onClick={() => void act(action)}
              >
                {t.actions[action]}
              </button>
            ))}
          </div>
        </div>
      )}
      {message && (
        <p aria-live="polite" className={cx("text-sm", message.ok ? "text-emerald-300" : "text-rose-300")}>
          {message.text}{" "}
          {message.stale && (
            <button type="button" className="underline" onClick={onReload}>
              {dict.opportunity.reload}
            </button>
          )}
        </p>
      )}

      <section aria-label={t.history}>
        <h3 className="text-sm font-semibold">{t.history}</h3>
        <ol className="mt-2 grid gap-2 text-sm" data-testid="proposal-history">
          {[...proposal.versions].reverse().map((v) => (
            <li key={v.number} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300">
              <span>{fmt(t.versionLine, { number: v.number, origin: t.origins[v.origin], author: v.author ?? "—", date: date(v.created_at) })}</span>
              {v.change_note && <span className="text-slate-400">“{v.change_note}”</span>}
              <span className="text-xs text-slate-400">{fmt(t.changed, { sections: v.changed_sections.map((s) => t.sections[s].split(" (")[0]).join(", ") })}</span>
              <button type="button" className="text-cyan-300 underline" onClick={() => void view(v.number)}>
                {viewing?.number === v.number ? t.hide : t.view}
              </button>
            </li>
          ))}
        </ol>
        {viewing && (
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-slate-300" data-testid="proposal-version-view">
            {PROPOSAL_SECTIONS.map((s) =>
              s === "commercial"
                ? `${t.sections[s]}\n${Object.values(viewing.content.commercial).filter(Boolean).join("\n")}`
                : `${t.sections[s]}\n${contentToText(viewing.content)[s]}`,
            ).join("\n\n")}
          </pre>
        )}
      </section>
    </div>
  );
}
