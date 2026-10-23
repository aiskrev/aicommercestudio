"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ActivityList } from "@/components/admin/ActivityList";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, Pill, StatusBadge } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { priorityLabels, serviceLabels, statusLabels } from "@/lib/admin-labels";
import { type AuditEntry, LEAD_STATUSES, type LeadDetail as Lead, type LeadNote, type LeadStatus, type LeadTriage } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

export function LeadDetail({ id }: { id: string }) {
  const lead = useAdminData<Lead>(`/api/admin/leads/${id}`);
  const history = useAdminData<AuditEntry[]>(`/api/admin/leads/${id}/audit`);

  if (lead.loading && !lead.data) return <LoadingState />;
  if (lead.error && !lead.data) {
    return (
      <div className="grid gap-4">
        <ErrorState message={lead.error} onRetry={lead.reload} />
        <Link href={routes.adminLeads} className="text-sm text-cyan-300">
          ← Към запитванията
        </Link>
      </div>
    );
  }
  if (!lead.data) return null;

  const data = lead.data;
  const refresh = (updated?: Lead) => {
    if (updated) lead.replace(updated);
    else lead.reload();
    history.reload();
  };

  return (
    <>
      <Link href={routes.adminLeads} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        ← Всички запитвания
      </Link>
      <AdminPageHeader
        title={data.name}
        description={`${data.company} · #${data.reference}`}
        actions={<StatusBadge status={data.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Запитване">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Имейл">
                <a href={`mailto:${data.email}`} className="text-cyan-300 hover:text-cyan-200">
                  {data.email}
                </a>
              </Info>
              <Info label="Телефон">{data.phone ?? <span className="text-slate-500">Не е посочен</span>}</Info>
              <Info label="Услуга">{serviceLabels[data.service] ?? data.service}</Info>
              <Info label="Получено">{formatDateTime(data.created_at)}</Info>
              <Info label="Източник">{data.source === "synthetic_seed" ? "Синтетични данни (разработка)" : "Контактна форма"}</Info>
              <Info label="Последна промяна на статус">
                {data.status_changed_at ? formatDateTime(data.status_changed_at) : "—"}
              </Info>
            </dl>
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Съобщение</p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 leading-relaxed text-slate-200">
                {data.message}
              </p>
            </div>
          </Panel>

          <Notes lead={data} onAdded={(note) => refresh({ ...data, notes: [note, ...data.notes] })} />
          <AiTriage leadId={data.id} onDone={() => history.reload()} />
        </div>

        <div className="grid content-start gap-6">
          <StatusEditor lead={data} onSaved={(updated) => refresh(updated)} />

          <Panel title="Съгласия (GDPR)">
            <dl className="grid gap-3 text-sm">
              <Info label="Информация за поверителност">
                Потвърдена на {formatDateTime(data.privacy_acknowledged_at)} (версия {data.privacy_notice_version})
              </Info>
              <Info label="Маркетингово съгласие">
                {data.marketing_consent && data.marketing_consent_at
                  ? `Дадено на ${formatDateTime(data.marketing_consent_at)}`
                  : "Не е дадено"}
              </Info>
            </dl>
          </Panel>

          <Panel title="История">
            {history.loading && !history.data && <LoadingState />}
            {history.error && <ErrorState message={history.error} onRetry={history.reload} />}
            {history.data && history.data.length === 0 && <EmptyState icon="activity" title="Няма записи" />}
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
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-200">{children}</dd>
    </div>
  );
}

function StatusEditor({ lead, onSaved }: { lead: Lead; onSaved: (lead: Lead) => void }) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await adminFetch<Lead>(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onSaved(updated);
      setMessage({ ok: true, text: "Статусът е запазен." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Грешка при запазване." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Статус">
      <form onSubmit={save} className="grid gap-3">
        <label htmlFor="lead-status" className="sr-only">
          Статус на запитването
        </label>
        <select
          id="lead-status"
          className="field"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus)}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass("primary")} disabled={saving || status === lead.status}>
          {saving ? "Запазване…" : "Запази статуса"}
        </button>
        <p aria-live="polite" className={cx("text-sm", message?.ok ? "text-emerald-300" : "text-rose-300")}>
          {message?.text}
        </p>
      </form>
    </Panel>
  );
}

function Notes({ lead, onAdded }: { lead: Lead; onAdded: (note: LeadNote) => void }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) {
      setError("Бележката не може да е празна.");
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
      setError(err instanceof ApiError ? err.fieldErrors.body ?? err.message : "Грешка при запазване.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Бележки">
      <form onSubmit={add} className="grid gap-3">
        <label htmlFor="note-body" className="sr-only">
          Нова бележка
        </label>
        <textarea
          id="note-body"
          rows={3}
          maxLength={4000}
          className="field"
          placeholder="Добавете вътрешна бележка (видима само за администратори)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
        <button type="submit" className={cx(buttonClass("secondary"), "justify-self-start")} disabled={saving}>
          {saving ? "Запазване…" : "Добави бележка"}
        </button>
      </form>
      {lead.notes.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">Все още няма бележки.</p>
      ) : (
        <ul className="mt-5 grid gap-3" data-testid="notes-list">
          {lead.notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{note.body}</p>
              <p className="mt-2 text-xs text-slate-500">
                {note.author_name ?? "Изтрит потребител"} · {formatDateTime(note.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AiTriage({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [result, setResult] = useState<LeadTriage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await adminFetch<LeadTriage>(`/api/admin/leads/${leadId}/ai/triage`, { method: "POST" }));
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "AI анализът не е наличен.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      title="AI анализ (предложение)"
      actions={
        <button type="button" onClick={run} disabled={loading} className={buttonClass("secondary")}>
          <Icon name="sparkles" className="h-4 w-4" />
          {loading ? "Анализ…" : result ? "Анализирай отново" : "Анализирай"}
        </button>
      }
    >
      {error && <ErrorState message={error} />}
      {!result && !error && (
        <p className="text-sm text-slate-400">
          Класифицира запитването и предлага следваща стъпка. Действието е само за четене — нищо не се изпраща и не се
          променя автоматично.
        </p>
      )}
      {result && (
        <div className="grid gap-4 text-sm" data-testid="ai-triage">
          <div className="flex flex-wrap gap-2">
            <Pill tone="bg-cyan-400/10 text-cyan-200 ring-cyan-400/30">
              {serviceLabels[result.suggested_service] ?? result.suggested_service}
            </Pill>
            <Pill tone="bg-violet-400/10 text-violet-200 ring-violet-400/30">
              Приоритет: {priorityLabels[result.priority]}
            </Pill>
            <Pill tone="bg-white/5 text-slate-300 ring-white/10">
              {result.provider} · {result.model}
            </Pill>
          </div>
          <p className="text-slate-200">{result.summary}</p>
          <p>
            <span className="text-slate-500">Следваща стъпка: </span>
            <span className="text-slate-200">{result.suggested_next_step}</span>
          </p>
          {result.signals.length > 0 && (
            <ul className="list-inside list-disc text-xs text-slate-400">
              {result.signals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-amber-200/80">{result.disclaimer}</p>
        </div>
      )}
    </Panel>
  );
}

function DeleteLead({ lead }: { lead: Lead }) {
  const router = useRouter();
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
      setError(err instanceof ApiError ? err.message : "Грешка при изтриване.");
    }
  }

  return (
    <Panel title="Изтриване (GDPR)">
      <p className="text-sm text-slate-400">
        Изтрива окончателно запитването и бележките към него, например при искане за изтриване на лични данни. В журнала
        остава само записът за изтриването, без лични данни.
      </p>
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
            {deleting ? "Изтриване…" : "Потвърди изтриването"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={buttonClass("secondary")}>
            Отказ
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/10"
        >
          <Icon name="trash" className="h-4 w-4" />
          Изтрий запитването
        </button>
      )}
    </Panel>
  );
}
