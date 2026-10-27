"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ActivityList } from "@/components/admin/ActivityList";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, Pill, StatusBadge } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import {
  type AiManagedDetails,
  type AuditEntry,
  LEAD_STATUSES,
  type LeadDetail as Lead,
  type LeadNote,
  type LeadStatus,
  type LeadTriage,
  type LinkedAssessment,
  type ReadinessDetails,
} from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

export function LeadDetail({ id }: { id: string }) {
  const lead = useAdminData<Lead>(`/api/admin/leads/${id}`);
  const history = useAdminData<AuditEntry[]>(`/api/admin/leads/${id}/audit`);
  const { t: dict, labels, locale } = useAdminI18n();
  const t = dict.lead;

  if (lead.loading && !lead.data) return <LoadingState />;
  if (lead.error && !lead.data) {
    return (
      <div className="grid gap-4">
        <ErrorState message={lead.error} requestId={lead.errorId} onRetry={lead.reload} />
        <Link href={routes.adminLeads} className="text-sm text-cyan-300">
          {t.backToList}
        </Link>
      </div>
    );
  }
  if (!lead.data) return null;

  const data = lead.data;
  const date = (value: string) => formatDateTime(value, locale);
  const refresh = (updated?: Lead) => {
    if (updated) lead.replace(updated);
    else lead.reload();
    history.reload();
  };

  return (
    <>
      <Link href={routes.adminLeads} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        {t.back}
      </Link>
      <AdminPageHeader
        title={data.name}
        description={`${data.company} · #${data.reference}`}
        actions={<StatusBadge status={data.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title={t.panel}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Info label={t.email}>
                <a href={`mailto:${data.email}`} className="text-cyan-300 hover:text-cyan-200">
                  {data.email}
                </a>
              </Info>
              <Info label={t.phone}>{data.phone ?? <span className="text-slate-400">{t.noPhone}</span>}</Info>
              <Info label={t.type}>{labels.inquiryType[data.inquiry_type] ?? data.inquiry_type}</Info>
              <Info label={t.service}>
                {labels.service[data.service] ?? data.service}
                {data.submitted_service !== data.service && (
                  <span className="block text-xs text-slate-400">
                    {fmt(t.originally, { service: labels.service[data.submitted_service] ?? data.submitted_service })}
                  </span>
                )}
              </Info>
              <Info label={t.language}>
                <span data-testid="lead-locale">{labels.locale[data.locale] ?? data.locale}</span>
              </Info>
              {data.inquiry_type === "quote" && (
                <>
                  <Info label={t.platform}>{labels.platform[data.platform ?? ""] ?? "—"}</Info>
                  <Info label={t.budget}>{labels.budget[data.budget_range ?? ""] ?? "—"}</Info>
                  <Info label={t.timeline}>{labels.timeline[data.timeline ?? ""] ?? "—"}</Info>
                  <Info label={t.website}>
                    {data.website_url ? (
                      <a
                        href={data.website_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="break-all text-cyan-300 hover:text-cyan-200"
                      >
                        {data.website_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </Info>
                </>
              )}
              <Info label={t.received}>{date(data.created_at)}</Info>
              <Info label={t.source}>
                {data.source === "synthetic_seed"
                  ? t.sourceSynthetic
                  : data.source === "readiness_assessment"
                    ? t.sourceReadiness
                    : t.sourceForm}
              </Info>
              <Info label={t.statusChanged}>{data.status_changed_at ? date(data.status_changed_at) : "—"}</Info>
            </dl>
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.message}</p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 leading-relaxed text-slate-200">
                {data.message}
              </p>
            </div>
          </Panel>

          {data.ai_managed && <AiManagedPanel details={data.ai_managed} />}
          {data.readiness && <ReadinessPanel leadId={data.id} details={data.readiness} />}
          {data.advisor_assessment && <LinkedAssessmentPanel linked={data.advisor_assessment} />}

          <Notes lead={data} onAdded={(note) => refresh({ ...data, notes: [note, ...data.notes] })} />
          <AiTriage lead={data} onDone={() => history.reload()} onApplied={(updated) => refresh(updated)} />
        </div>

        <div className="grid content-start gap-6">
          <StatusEditor lead={data} onSaved={(updated) => refresh(updated)} onConflict={() => refresh()} />
          <ServiceEditor lead={data} onSaved={(updated) => refresh(updated)} />

          <Panel title={t.consents}>
            <dl className="grid gap-3 text-sm">
              <Info label={t.privacy}>
                {fmt(t.privacyAck, { date: date(data.privacy_acknowledged_at), version: data.privacy_notice_version })}
              </Info>
              <Info label={t.marketing}>
                {data.marketing_consent && data.marketing_consent_at
                  ? data.marketing_consent_version
                    ? fmt(t.marketingVersion, { date: date(data.marketing_consent_at), version: data.marketing_consent_version })
                    : fmt(t.marketingGiven, { date: date(data.marketing_consent_at) })
                  : t.marketingNone}
              </Info>
            </dl>
          </Panel>

          <Panel title={t.history}>
            {history.loading && !history.data && <LoadingState />}
            {history.error && <ErrorState message={history.error} requestId={history.errorId} onRetry={history.reload} />}
            {history.data && history.data.length === 0 && <EmptyState icon="activity" title={t.noHistory} />}
            {history.data && history.data.length > 0 && <ActivityList entries={history.data} linkLeads={false} />}
          </Panel>

          <DeleteLead lead={data} />
        </div>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 text-slate-200">{children}</dd>
    </div>
  );
}

/** What the client told us about their AI system (descriptive only — no access data is collected). */
function AiManagedPanel({ details }: { details: AiManagedDetails }) {
  const { t: dict, labels } = useAdminI18n();
  const t = dict.aiManaged;
  const ai = labels.aiManaged;
  const list = (values: string[], map: Record<string, string>) => values.map((v) => map[v] ?? v).join(", ");
  return (
    <Panel title={t.title}>
      <div className="grid gap-4 text-sm" data-testid="ai-managed-details">
        <p className="text-xs text-slate-400">{t.note}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Info label={t.sector}>{ai.sector[details.sector] ?? details.sector}</Info>
          <Info label={t.agentsCount}>{ai.agentsCount[details.agents_count] ?? details.agents_count}</Info>
          <Info label={t.systemTypes}>{list(details.system_types, ai.systemType)}</Info>
          <Info label={t.interests}>{list(details.support_interests, ai.interest)}</Info>
          <Info label={t.provider}>{details.ai_provider || "—"}</Info>
          <Info label={t.hosting}>{details.hosting ? (ai.hosting[details.hosting] ?? details.hosting) : "—"}</Info>
          <Info label={t.communication}>
            {labels.locale[details.communication_language] ?? details.communication_language}
          </Info>
        </dl>
        {details.additional_notes && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.notes}</p>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 leading-relaxed text-slate-200">
              {details.additional_notes}
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

const READINESS_DIMENSION_ORDER = ["strategy", "data", "process", "technology", "people", "governance"];
const dimensionRank = (key: string) => {
  const index = READINESS_DIMENSION_ORDER.indexOf(key);
  return index === -1 ? READINESS_DIMENSION_ORDER.length : index;
};

/** AI readiness submission: the server-computed result, plus the PDF report rebuilt from it. */
function ReadinessPanel({ leadId, details }: { leadId: string; details: ReadinessDetails }) {
  const { t: dict } = useAdminI18n();
  const t = dict.readiness;
  return (
    <Panel title={t.title}>
      <div className="grid gap-4 text-sm" data-testid="readiness-details">
        <p className="text-xs text-slate-400">{t.note}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Info label={t.overall}>
            <span className="font-mono text-lg text-white">{details.overall}</span>
            <span className="text-slate-400"> / 100</span>
          </Info>
          <Info label={t.band}>{t.bands[details.band] ?? details.band}</Info>
          <Info label={t.role}>{details.role || "—"}</Info>
          <Info label={t.consultation}>{details.consultation_requested ? t.yes : t.no}</Info>
        </dl>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.dimensions}</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {/* Model order (JSONB does not keep key order); unknown keys from other model versions last. */}
            {Object.entries(details.dimensions)
              .sort(([a], [b]) => dimensionRank(a) - dimensionRank(b))
              .map(([key, score]) => (
                <li key={key} className="flex justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2">
                  <span className="text-slate-300">{t.dimensionNames[key] ?? key}</span>
                  <span className="font-mono text-white">{score}</span>
                </li>
              ))}
          </ul>
        </div>
        <Info label={t.blockers}>
          {details.blockers.length ? details.blockers.map((b) => t.blockerNames[b] ?? b).join(", ") : t.noBlockers}
        </Info>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            href={`/api/admin/leads/${leadId}/readiness-report`}
            download
            className={cx(buttonClass("secondary", "sm"), "inline-flex")}
            data-testid="readiness-report-download"
          >
            <Icon name="fileText" className="h-4 w-4" />
            {t.download}
          </a>
          <span className="text-xs text-slate-400">{fmt(t.model, { version: details.model_version })}</span>
        </div>
      </div>
    </Panel>
  );
}

function StatusEditor({
  lead,
  onSaved,
  onConflict,
}: {
  lead: Lead;
  onSaved: (lead: Lead) => void;
  onConflict: () => void;
}) {
  const { t: dict, labels } = useAdminI18n();
  const t = dict.lead;
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [synced, setSynced] = useState(lead.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [conflict, setConflict] = useState(false);
  // Follow server-side changes (e.g. after a conflict reload) without an effect.
  if (lead.status !== synced) {
    setSynced(lead.status);
    setStatus(lead.status);
    setConflict(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await adminFetch<Lead>(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        // expected_status: the server rejects the change (409) if someone else changed the status meanwhile.
        body: JSON.stringify({ status, expected_status: lead.status }),
      });
      onSaved(updated);
      setMessage({ ok: true, text: t.statusSaved });
    } catch (err) {
      setConflict(err instanceof ApiError && err.code === "status_conflict");
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : dict.common.saveError });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={t.status}>
      <form onSubmit={save} className="grid gap-3">
        <label htmlFor="lead-status" className="sr-only">
          {t.statusLabel}
        </label>
        <select
          id="lead-status"
          className="field"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus)}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {labels.status[s]}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass("primary")} disabled={saving || status === lead.status}>
          {saving ? dict.common.saving : t.saveStatus}
        </button>
        <p aria-live="polite" className={cx("text-sm", message?.ok ? "text-emerald-300" : "text-rose-300")}>
          {message?.text}
        </p>
        {conflict && (
          <button type="button" onClick={onConflict} className={buttonClass("secondary", "sm")}>
            {t.reload}
          </button>
        )}
      </form>
    </Panel>
  );
}

function ServiceEditor({ lead, onSaved }: { lead: Lead; onSaved: (lead: Lead) => void }) {
  const { t: dict, labels } = useAdminI18n();
  const t = dict.lead;
  const [service, setService] = useState(lead.service);
  const [synced, setSynced] = useState(lead.service);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  if (lead.service !== synced) {
    setSynced(lead.service);
    setService(lead.service);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await adminFetch<Lead>(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ service }),
      });
      onSaved(updated);
      setMessage({ ok: true, text: t.categorySaved });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : dict.common.saveError });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={t.category}>
      <form onSubmit={save} className="grid gap-3">
        <label htmlFor="lead-service" className="sr-only">
          {t.service}
        </label>
        <select id="lead-service" className="field" value={service} onChange={(e) => setService(e.target.value)}>
          {Object.entries(labels.service).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass("secondary")} disabled={saving || service === lead.service}>
          {saving ? dict.common.saving : t.saveCategory}
        </button>
        <p aria-live="polite" className={cx("text-sm", message?.ok ? "text-emerald-300" : "text-rose-300")}>
          {message?.text}
        </p>
      </form>
    </Panel>
  );
}

function Notes({ lead, onAdded }: { lead: Lead; onAdded: (note: LeadNote) => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.lead;
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) {
      setError(t.noteEmpty);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const note = await adminFetch<LeadNote>(`/api/admin/leads/${lead.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody("");
      onAdded(note);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors.body ?? err.message) : dict.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={t.notes}>
      <form onSubmit={add} className="grid gap-3">
        <label htmlFor="note-body" className="sr-only">
          {t.newNote}
        </label>
        <textarea
          id="note-body"
          rows={3}
          maxLength={4000}
          className="field"
          placeholder={t.notePlaceholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
        <button type="submit" className={cx(buttonClass("secondary"), "justify-self-start")} disabled={saving}>
          {saving ? dict.common.saving : t.addNote}
        </button>
      </form>
      {lead.notes.length === 0 ? (
        <p className="mt-5 text-sm text-slate-400">{t.noNotes}</p>
      ) : (
        <ul className="mt-5 grid gap-3" data-testid="notes-list">
          {lead.notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{note.body}</p>
              <p className="mt-2 text-xs text-slate-400">
                {note.author_name ?? t.deletedUser} · {formatDateTime(note.created_at, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AiTriage({
  lead,
  onDone,
  onApplied,
}: {
  lead: Lead;
  onDone: () => void;
  onApplied: (lead: Lead) => void;
}) {
  const { t: dict, labels, locale } = useAdminI18n();
  const t = dict.lead;
  const leadId = lead.id;
  const [result, setResult] = useState<LeadTriage | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applySuggestion(service: string) {
    setApplying(true);
    setError(null);
    try {
      onApplied(
        await adminFetch<Lead>(`/api/admin/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ service }) }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.applyFailed);
    } finally {
      setApplying(false);
    }
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await adminFetch<LeadTriage>(`/api/admin/leads/${leadId}/ai/triage`, { method: "POST" }));
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.triageUnavailable);
    } finally {
      setLoading(false);
    }
  }

  const suggested = result ? (labels.service[result.suggested_service] ?? result.suggested_service) : "";

  return (
    <Panel
      title={t.triage}
      actions={
        <button type="button" onClick={run} disabled={loading} className={buttonClass("secondary")}>
          <Icon name="sparkles" className="h-4 w-4" />
          {loading ? t.analysing : result ? t.analyseAgain : t.analyse}
        </button>
      }
    >
      {error && <ErrorState message={error} />}
      {!result && !error && <p className="text-sm text-slate-400">{t.triageIntro}</p>}
      {result && (
        <div className="grid gap-4 text-sm" data-testid="ai-triage">
          <div className="flex flex-wrap gap-2">
            <Pill tone="bg-cyan-400/10 text-cyan-200 ring-cyan-400/30">{suggested}</Pill>
            <Pill tone="bg-violet-400/10 text-violet-200 ring-violet-400/30">
              {fmt(t.priority, { priority: labels.priority[result.priority] ?? result.priority })}
            </Pill>
            <Pill tone="bg-white/5 text-slate-300 ring-white/10">
              {result.provider} · {result.model}
            </Pill>
          </div>
          <p className="text-slate-200">{result.summary}</p>
          <p>
            <span className="text-slate-400">{t.nextStep}</span>
            <span className="text-slate-200">{result.suggested_next_step}</span>
          </p>
          {result.suggested_service !== lead.service && (
            <div>
              <button
                type="button"
                onClick={() => applySuggestion(result.suggested_service)}
                disabled={applying}
                className={buttonClass("secondary", "sm")}
              >
                {applying ? t.applying : fmt(t.applyCategory, { service: suggested })}
              </button>
              <p className="mt-1 text-xs text-slate-400">{t.applyNote}</p>
            </div>
          )}
          {result.signals.length > 0 && (
            <ul className="list-inside list-disc text-xs text-slate-400">
              {result.signals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-amber-200/80">{result.disclaimer}</p>
          {locale === "en" && result.provider === "mock" && <p className="text-xs text-slate-400">{t.triageLanguageNote}</p>}
        </div>
      )}
    </Panel>
  );
}

function DeleteLead({ lead }: { lead: Lead }) {
  const router = useRouter();
  const { t: dict } = useAdminI18n();
  const t = dict.lead;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    try {
      await adminFetch(`/api/admin/leads/${lead.id}`, { method: "DELETE" });
      router.push(routes.adminLeads);
    } catch (err) {
      setDeleting(false);
      setError(err instanceof ApiError ? err.message : t.deleteError);
    }
  }

  return (
    <Panel title={t.delete}>
      <p className="text-sm text-slate-400">{t.deleteBody}</p>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {confirming ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400"
          >
            <Icon name="trash" className="h-4 w-4" />
            {deleting ? t.deleting : t.confirmDelete}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={buttonClass("secondary")}>
            {dict.common.cancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/10"
        >
          <Icon name="trash" className="h-4 w-4" />
          {t.deleteLead}
        </button>
      )}
    </Panel>
  );
}

/** Advisor assessment the visitor attached when requesting a consultation (read-only). */
function LinkedAssessmentPanel({ linked }: { linked: LinkedAssessment }) {
  const { t: dict, labels, locale } = useAdminI18n();
  const t = dict.lead;
  const a = linked.assessment;
  return (
    <Panel title={fmt(t.assessment, { reference: linked.reference })}>
      <div className="grid gap-4 text-sm" data-testid="linked-assessment">
        <p className="flex flex-wrap items-center gap-2">
          <Pill tone={linked.mode === "demo" ? "bg-amber-400/10 text-amber-200 ring-amber-400/30" : "bg-cyan-400/10 text-cyan-200 ring-cyan-400/30"}>
            {linked.mode === "demo" ? t.assessmentDemo : t.assessmentAi}
          </Pill>
          <Pill tone="bg-white/5 text-slate-300 ring-white/15">
            {fmt(t.complexity, { level: labels.complexity[a.complexity.level] ?? a.complexity.level })}
          </Pill>
          <span className="text-xs text-slate-400">{formatDateTime(linked.created_at, locale)}</span>
        </p>
        <p className="leading-relaxed text-slate-200">{a.problem_summary}</p>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.opportunities}</p>
          <ul className="mt-2 list-disc pl-5 text-slate-300">
            {a.opportunities.map((o) => (
              <li key={o.title}>{o.title}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.questions}</p>
          <ul className="mt-2 list-disc pl-5 text-slate-300">
            {a.clarification_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">
          {fmt(t.assessmentMeta, {
            tools: linked.tools.join(", ") || "—",
            volume: linked.monthly_volume,
            team: linked.team_size,
          })}
        </p>
      </div>
    </Panel>
  );
}
