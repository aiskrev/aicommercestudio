"use client";

import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { aiActionTypeLabels, aiStatusLabels, riskLabels } from "@/lib/admin-labels";
import type { AIAction } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { useAdminData } from "@/lib/use-admin-data";

export function AiActions() {
  const [filter, setFilter] = useState<"PENDING" | "">("PENDING");
  const { data, error, loading, reload } = useAdminData<AIAction[]>(
    `/api/admin/ai/actions${filter ? `?status=${filter}` : ""}`,
  );

  return (
    <>
      <AdminPageHeader
        title="AI одобрения"
        description="Действия, предложени от AI агенти. Нищо с реален ефект не се изпълнява без одобрение."
      />
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Филтър">
        {(
          [
            ["PENDING", "Чакащи"],
            ["", "Всички"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cx(
              "rounded-full px-4 py-2 text-sm font-medium",
              filter === value ? "bg-white/[0.08] text-white" : "text-slate-400 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mb-6 flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-slate-400">
        <Icon name="info" className="h-5 w-5 shrink-0 text-cyan-300" />
        Във V1 одобрението само записва решението в журнала. Изпълнители, които реално изпращат съобщения или променят
        данни в магазина, все още не са свързани.
      </p>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data && data.length === 0 && (
        <Panel>
          <EmptyState icon="bot" title={filter ? "Няма чакащи действия" : "Няма записани действия"} />
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
    </>
  );
}

function ActionCard({ action, onDecided }: { action: AIAction; onDecided: () => void }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const risk = riskLabels[action.risk_level] ?? { label: action.risk_level, tone: "bg-white/5 text-slate-300 ring-white/10" };

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
      setError(err instanceof ApiError ? err.message : "Грешка при запис на решението.");
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={risk.tone}>{risk.label}</Pill>
        <Pill tone="bg-white/5 text-slate-300 ring-white/10">{aiStatusLabels[action.status] ?? action.status}</Pill>
        <span className="text-xs text-slate-500">{formatDateTime(action.created_at)}</span>
      </div>
      <h2 className="mt-3 text-lg font-semibold">{aiActionTypeLabels[action.action_type] ?? action.action_type}</h2>
      <p className="mt-1 text-slate-300">{action.summary}</p>
      <p className="mt-1 text-xs text-slate-500">Заявено от: {action.requested_by}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-cyan-300">Данни на действието</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-ink-950 p-3 text-xs text-slate-300">
          {JSON.stringify(action.payload, null, 2)}
        </pre>
      </details>

      {action.status === "PENDING" ? (
        <div className="mt-4 grid gap-3">
          <label htmlFor={`comment-${action.id}`} className="sr-only">
            Коментар
          </label>
          <input
            id={`comment-${action.id}`}
            className="field"
            placeholder="Коментар (по желание)"
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => decide("approve")} className={buttonClass("primary")}>
              Одобри
            </button>
            <button type="button" disabled={busy} onClick={() => decide("reject")} className={buttonClass("secondary")}>
              Отхвърли
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          {aiStatusLabels[action.status]}
          {action.decided_by_name && ` от ${action.decided_by_name}`}
          {action.decided_at && ` на ${formatDateTime(action.decided_at)}`}
          {action.decision_comment && ` — „${action.decision_comment}“`}
        </p>
      )}
    </Panel>
  );
}
