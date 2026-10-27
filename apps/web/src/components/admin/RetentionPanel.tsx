"use client";

import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { ErrorState, Panel } from "@/components/admin/ui";
import { Alert, Button, Skeleton } from "@/components/ui/primitives";
import { fmt, fmtNodes } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import type { RetentionPreview } from "@/lib/admin-types";
import { formatDate } from "@/lib/format";
import { useAdminData } from "@/lib/use-admin-data";

/** GDPR retention: shows what the policy would delete and lets an admin apply it (confirmed, audited). */
export function RetentionPanel() {
  const preview = useAdminData<RetentionPreview>("/api/admin/retention");
  const { t: dict, locale } = useAdminI18n();
  const t = dict.retention;
  const days = (n: number | undefined) => <strong className="text-white">{fmt(dict.common.days, { n: n ?? 0 })}</strong>;
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
        team_configurations_deleted?: number;
      }>(
        "/api/admin/retention/run",
        { method: "POST", body: JSON.stringify({ confirm: true }) },
      );
      setResult({
        tone: "success",
        text: fmt(t.result, {
          leads: out.leads_deleted,
          audit: out.audit_entries_deleted,
          advisor: out.advisor_assessments_deleted ?? 0,
          team: out.team_configurations_deleted ?? 0,
        }),
      });
      preview.reload();
    } catch (err) {
      setResult({ tone: "error", text: err instanceof ApiError ? err.message : t.failed });
    } finally {
      setRunning(false);
      setConfirming(false);
    }
  }

  const data = preview.data;
  const due = data
    ? data.leads_due + data.audit_entries_due + (data.advisor_assessments_due ?? 0) + (data.team_configurations_due ?? 0)
    : 0;

  return (
    <Panel title={t.title}>
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
            {fmtNodes(t.policy, {
              leadDays: days(data.lead_retention_days),
              auditDays: days(data.audit_retention_days),
              advisorDays: days(data.advisor_retention_days),
            })}
          </p>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] p-3">
              <dt className="text-xs text-slate-400">{t.leadsDue}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-white" data-testid="retention-leads-due">
                {data.leads_due}
              </dd>
              <dd className="text-xs text-slate-400">{fmt(t.leadsCutoff, { date: formatDate(data.lead_cutoff, locale) })}</dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] p-3">
              <dt className="text-xs text-slate-400">{t.auditDue}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-white">{data.audit_entries_due}</dd>
              <dd className="text-xs text-slate-400">{fmt(t.auditCutoff, { date: formatDate(data.audit_cutoff, locale) })}</dd>
            </div>
            <div className="rounded-xl border border-white/[0.07] p-3">
              <dt className="text-xs text-slate-400">{t.advisorDue}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-white">{data.advisor_assessments_due ?? 0}</dd>
              <dd className="text-xs text-slate-400">{t.advisorNote}</dd>
            </div>
          </dl>
          {result && (
            <Alert tone={result.tone} role={result.tone === "error" ? "alert" : "status"}>
              {result.text}
            </Alert>
          )}
          {due === 0 ? (
            <p className="text-slate-400">{t.nothingDue}</p>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="danger" size="sm" icon="trash" loading={running} loadingLabel={t.deleting} onClick={run}>
                {t.confirm}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                {dict.common.cancel}
              </Button>
            </div>
          ) : (
            <Button variant="dangerOutline" size="sm" icon="trash" onClick={() => setConfirming(true)}>
              {t.apply}
            </Button>
          )}
          <p className="text-xs text-slate-400">
            {t.schedule} <code className="font-mono">python -m app.cli maintenance</code> {t.scheduleSuffix}
          </p>
        </div>
      )}
    </Panel>
  );
}
