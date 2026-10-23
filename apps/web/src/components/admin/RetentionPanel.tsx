"use client";

import { useState } from "react";

import { ErrorState, Panel } from "@/components/admin/ui";
import { Alert, Button, Skeleton } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import type { RetentionPreview } from "@/lib/admin-types";
import { formatDate } from "@/lib/format";
import { useAdminData } from "@/lib/use-admin-data";

/** GDPR retention: shows what the policy would delete and lets an admin apply it (confirmed, audited). */
export function RetentionPanel() {
  const preview = useAdminData<RetentionPreview>("/api/admin/retention");
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const out = await adminFetch<{
        leads_deleted: number;
        audit_entries_deleted: number;
        advisor_assessments_deleted?: number;
      }>(
        "/api/admin/retention/run",
        { method: "POST", body: JSON.stringify({ confirm: true }) },
      );
      setResult({
        tone: "success",
        text: `Изтрити запитвания: ${out.leads_deleted}; изтрити записи в журнала: ${out.audit_entries_deleted}; изтрити AI оценки: ${out.advisor_assessments_deleted ?? 0}.`,
      });
      preview.reload();
    } catch (err) {
      setResult({ tone: "error", text: err instanceof ApiError ? err.message : "Политиката не можа да бъде приложена." });
    } finally {
      setRunning(false);
      setConfirming(false);
    }
  }

  const data = preview.data;
  const due = data ? data.leads_due + data.audit_entries_due + (data.advisor_assessments_due ?? 0) : 0;

  return (
    <Panel title="Съхранение на данни (GDPR)">
      {preview.error && <ErrorState message={preview.error} requestId={preview.errorId} onRetry={preview.reload} />}
      {!data && !preview.error && (
        <div className="grid gap-2" aria-hidden="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
      {data && (
        <div className="grid gap-4 text-sm">
          <p className="text-slate-300">
            Запитванията се пазят <strong className="text-white">{data.lead_retention_days} дни</strong> след последната
            промяна, журналът — <strong className="text-white">{data.audit_retention_days} дни</strong>, а
            незаявените AI оценки — <strong className="text-white">{data.advisor_retention_days} дни</strong>.
          </p>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] p-3">
              <dt className="text-xs text-slate-400">Запитвания за изтриване</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-white" data-testid="retention-leads-due">
                {data.leads_due}
              </dd>
              <dd className="text-xs text-slate-400">непроменяни преди {formatDate(data.lead_cutoff)}</dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] p-3">
              <dt className="text-xs text-slate-400">Записи в журнала за изтриване</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-white">{data.audit_entries_due}</dd>
              <dd className="text-xs text-slate-400">по-стари от {formatDate(data.audit_cutoff)}</dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] p-3">
              <dt className="text-xs text-slate-400">AI оценки за изтриване</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-white">{data.advisor_assessments_due ?? 0}</dd>
              <dd className="text-xs text-slate-400">изтекли и несвързани със запитване</dd>
            </div>
          </dl>
          {result && (
            <Alert tone={result.tone} role={result.tone === "error" ? "alert" : "status"}>
              {result.text}
            </Alert>
          )}
          {due === 0 ? (
            <p className="text-slate-400">Няма данни с изтекъл срок за съхранение.</p>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="danger" size="sm" icon="trash" loading={running} loadingLabel="Изтриване…" onClick={run}>
                Потвърди окончателното изтриване
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                Отказ
              </Button>
            </div>
          ) : (
            <Button variant="dangerOutline" size="sm" icon="trash" onClick={() => setConfirming(true)}>
              Приложи политиката сега
            </Button>
          )}
          <p className="text-xs text-slate-400">
            Автоматично изпълнение: <code className="font-mono">python -m app.cli maintenance</code> по график.
          </p>
        </div>
      )}
    </Panel>
  );
}
