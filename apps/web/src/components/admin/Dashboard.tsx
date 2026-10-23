"use client";

import Link from "next/link";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ActivityList } from "@/components/admin/ActivityList";
import { RetentionPanel } from "@/components/admin/RetentionPanel";
import { EmptyState, ErrorState, LoadingState, Panel, StatCard, StatsSkeleton } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { statusTone } from "@/lib/admin-labels";
import { type DashboardStats, LEAD_STATUSES, type SystemStatus } from "@/lib/admin-types";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

export function Dashboard() {
  const stats = useAdminData<DashboardStats>("/api/admin/dashboard/stats");
  const system = useAdminData<SystemStatus>("/api/admin/system/status");
  const t = useAdminI18n().t.dashboard;
  const common = useAdminI18n().t.common;

  return (
    <>
      <AdminPageHeader title={t.title} description={t.description} />
      {stats.loading && !stats.data && <StatsSkeleton />}
      {stats.error && <ErrorState message={stats.error} requestId={stats.errorId} onRetry={stats.reload} />}
      {stats.data && <StatsView stats={stats.data} />}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <RetentionPanel />
        <Panel title={t.system}>
          {system.loading && !system.data && <LoadingState />}
          {system.error && <ErrorState message={system.error} onRetry={system.reload} />}
          {system.data && (
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <dl className="grid gap-3 text-sm">
                <Row label={t.environment} value={system.data.environment} />
                <Row label={t.aiProvider} value={system.data.ai_provider === "mock" ? t.aiMock : system.data.ai_provider} />
                <Row label={t.email} value={system.data.email_enabled ? t.emailOn : t.emailOff} />
                <Row label={t.retention} value={fmt(common.days, { n: system.data.lead_retention_days })} />
              </dl>
              <ul className="grid gap-2 sm:grid-cols-2">
                {system.data.integrations.map((integration) => (
                  <li key={integration.key} className="rounded-xl border border-white/[0.06] p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      <span className={cx("h-2 w-2 rounded-full", integration.configured ? "bg-emerald-400" : "bg-slate-500")} />
                      {integration.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{integration.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/[0.05] pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-white">{value}</dd>
    </div>
  );
}

function StatsView({ stats }: { stats: DashboardStats }) {
  const { t: dict, labels } = useAdminI18n();
  const t = dict.dashboard;
  const maxService = Math.max(1, ...Object.values(stats.by_service));
  const quotes = stats.by_inquiry_type.quote ?? 0;
  const byLocale = Object.entries(stats.by_locale ?? {});
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t.total}
          value={stats.total_leads}
          icon="inbox"
          hint={fmt(t.totalHint, {
            quotes,
            quoteWord: quotes === 1 ? t.quoteOne : t.quoteMany,
            last30: stats.leads_last_30_days,
          })}
        />
        <StatCard label={t.newLeads} value={stats.new_leads} icon="alert" hint={fmt(t.newHint, { n: stats.leads_last_7_days })} />
        <StatCard label={t.pipeline} value={stats.open_pipeline} icon="workflow" hint={t.pipelineHint} />
        <StatCard
          label={t.pendingAi}
          value={stats.pending_ai_actions}
          icon="bot"
          hint={fmt(t.pendingHint, { won: stats.won, lost: stats.lost })}
        />
      </div>

      {stats.total_leads === 0 ? (
        <Panel>
          <EmptyState
            title={t.emptyTitle}
            description={t.emptyBody}
          />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t.byStatus} actions={<Link href={routes.adminLeads} className="text-sm text-cyan-300">{t.all}</Link>}>
            <ul className="grid gap-2">
              {LEAD_STATUSES.map((status) => (
                <li key={status}>
                  <Link
                    href={`${routes.adminLeads}?status=${status}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/[0.03]"
                  >
                    <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", statusTone[status])}>
                      {labels.status[status]}
                    </span>
                    <span className="font-display font-semibold text-white">{stats.by_status[status] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t.byService}>
            <ul className="grid gap-3">
              {Object.entries(stats.by_service)
                .sort((a, b) => b[1] - a[1])
                .map(([service, count]) => (
                  <li key={service}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">{labels.service[service] ?? service}</span>
                      <span className="font-semibold text-white">{count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.05]">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                        style={{ width: `${(count / maxService) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
            {byLocale.length > 0 && (
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t.byLocale}</p>
                <ul className="mt-2 flex flex-wrap gap-2" data-testid="leads-by-locale">
                  {byLocale.map(([code, count]) => (
                    <li key={code} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                      {labels.locale[code] ?? code}: <span className="font-semibold text-white">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>
      )}

      <Panel
        title={t.recent}
        actions={
          <Link href={routes.adminActivity} className="inline-flex items-center gap-1 text-sm text-cyan-300">
            {t.fullLog} <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        }
      >
        {stats.recent_activity.length === 0 ? (
          <EmptyState icon="activity" title={t.noActivity} />
        ) : (
          <ActivityList entries={stats.recent_activity} />
        )}
      </Panel>
    </div>
  );
}
