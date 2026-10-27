"use client";

import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { fmt } from "@/i18n/admin";
import { riskTone } from "@/lib/admin-labels";
import type { AIAction } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { useAdminData } from "@/lib/use-admin-data";

export function AiActions() {
  const [filter, setFilter] = useState<"PENDING" | "">("PENDING");
  const t = useAdminI18n().t.ai;
  const { data, error, loading, reload } = useAdminData<AIAction[]>(
    `/api/admin/ai/actions${filter ? `?status=${filter}` : ""}`,
  );

  return (
    <>
      <AdminPageHeader
        title={t.title}
        description={t.description}
      />
      <Tabs
        id="ai-actions"
        label={t.filter}
        items={[
          { value: "PENDING", label: t.pending },
          { value: "", label: t.all },
        ]}
        value={filter}
        onChange={setFilter}
        className="mb-6"
      >
        <p className="mb-6 flex gap-2 rounded-xl border border-line-subtle bg-surface-1 p-4 text-sm text-fg-muted">
          <Icon name="info" className="h-5 w-5 shrink-0 text-brand" />
          {t.v1Note}
        </p>

        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <LoadingState />}
        {data && data.length === 0 && (
          <Panel>
            <EmptyState icon="bot" title={filter ? t.noPending : t.noActions} />
          </Panel>
        )}
        {data && data.length > 0 && (
          <ul className="grid gap-4">
            {data.map((action) => (
              <li key={action.id}>
                <ActionCard action={action} onDecided={reload} />
              </li>
            ))}
          </ul>
        )}
      </Tabs>
    </>
  );
}

function ActionCard({ action, onDecided }: { action: AIAction; onDecided: () => void }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t: dict, labels, locale } = useAdminI18n();
  const t = dict.ai;
  const risk = {
    label: labels.risk[action.risk_level] ?? action.risk_level,
    tone: riskTone[action.risk_level] ?? "bg-white/5 text-slate-300 ring-white/10",
  };

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/ai/actions/${action.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, comment: comment.trim() || null }),
      });
      onDecided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.decisionError);
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={risk.tone}>{risk.label}</Pill>
        <Pill tone="bg-white/5 text-slate-300 ring-white/10">{labels.aiStatus[action.status] ?? action.status}</Pill>
        <span className="text-xs text-slate-400">{formatDateTime(action.created_at, locale)}</span>
      </div>
      <h2 className="mt-3 text-lg font-semibold">{labels.aiActionType[action.action_type] ?? action.action_type}</h2>
      <p className="mt-1 text-slate-300">{action.summary}</p>
      <p className="mt-1 text-xs text-slate-400">{fmt(t.requestedBy, { who: action.requested_by })}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-cyan-300">{t.payload}</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-ink-950 p-3 text-xs text-slate-300">
          {JSON.stringify(action.payload, null, 2)}
        </pre>
      </details>

      {action.status === "PENDING" ? (
        <div className="mt-4 grid gap-3">
          <label htmlFor={`comment-${action.id}`} className="sr-only">
            {t.comment}
          </label>
          <input
            id={`comment-${action.id}`}
            className="field"
            placeholder={t.commentPlaceholder}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => decide("approve")} className={buttonClass("primary")}>
              {t.approve}
            </button>
            <button type="button" disabled={busy} onClick={() => decide("reject")} className={buttonClass("secondary")}>
              {t.reject}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          {labels.aiStatus[action.status]}
          {action.decided_by_name && fmt(t.decidedBy, { name: action.decided_by_name })}
          {action.decided_at && fmt(t.decidedAt, { date: formatDateTime(action.decided_at, locale) })}
          {action.decision_comment &&
            (locale === "en" ? ` — “${action.decision_comment}”` : ` — „${action.decision_comment}“`)}
        </p>
      )}
    </Panel>
  );
}
