"use client";

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ActivityList } from "@/components/admin/ActivityList";
import { EmptyState, ErrorState, LoadingState, Panel, StatCard, StatsSkeleton } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { serviceLabels, statusLabels, statusTone } from "@/lib/admin-labels";
import { type DashboardStats, LEAD_STATUSES, type SystemStatus } from "@/lib/admin-types";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

export function Dashboard() {
  const stats = useAdminData<DashboardStats>("/api/admin/dashboard/stats");
  const system = useAdminData<SystemStatus>("/api/admin/system/status");

  return (
    <>
      <AdminPageHeader title="Табло" description="Обобщение въз основа на реалните данни в базата." />
      {stats.loading && !stats.data && <StatsSkeleton />}
      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}
      {stats.data && <StatsView stats={stats.data} />}

      <div className="mt-6">
        <Panel title="Състояние на системата">
          {system.loading && !system.data && <LoadingState />}
          {system.error && <ErrorState message={system.error} onRetry={system.reload} />}
          {system.data && (
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <dl className="grid gap-3 text-sm">
                <Row label="Среда" value={system.data.environment} />
                <Row label="AI доставчик" value={system.data.ai_provider === "mock" ? "Локален mock (без външни заявки)" : system.data.ai_provider} />
                <Row label="Имейл известия" value={system.data.email_enabled ? "Активни" : "Не са конфигурирани"} />
                <Row label="Срок за съхранение на запитвания" value={`${system.data.lead_retention_days} дни`} />
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
  const maxService = Math.max(1, ...Object.values(stats.by_service));
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Общо запитвания" value={stats.total_leads} icon="inbox" hint={`${stats.leads_last_30_days} за последните 30 дни`} />
        <StatCard label="Нови (необработени)" value={stats.new_leads} icon="alert" hint={`${stats.leads_last_7_days} за последните 7 дни`} />
        <StatCard label="Активни в процес" value={stats.open_pipeline} icon="workflow" hint="Нови, контакт, квалифицирани, оферта" />
        <StatCard label="AI действия за одобрение" value={stats.pending_ai_actions} icon="bot" hint={`Спечелени: ${stats.won} · Загубени: ${stats.lost}`} />
      </div>

      {stats.total_leads === 0 ? (
        <Panel>
          <EmptyState
            title="Все още няма запитвания"
            description="Когато посетител изпрати контактната форма, запитването ще се появи тук."
          />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="По статус" actions={<Link href={routes.adminLeads} className="text-sm text-cyan-300">Всички →</Link>}>
            <ul className="grid gap-2">
              {LEAD_STATUSES.map((status) => (
                <li key={status}>
                  <Link
                    href={`${routes.adminLeads}?status=${status}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/[0.03]"
                  >
                    <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", statusTone[status])}>
                      {statusLabels[status]}
                    </span>
                    <span className="font-display font-semibold text-white">{stats.by_status[status] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="По услуга">
            <ul className="grid gap-3">
              {Object.entries(stats.by_service)
                .sort((a, b) => b[1] - a[1])
                .map(([service, count]) => (
                  <li key={service}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">{serviceLabels[service] ?? service}</span>
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
          </Panel>
        </div>
      )}

      <Panel
        title="Последна активност"
        actions={
          <Link href={routes.adminActivity} className="inline-flex items-center gap-1 text-sm text-cyan-300">
            Пълен журнал <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        }
      >
        {stats.recent_activity.length === 0 ? (
          <EmptyState icon="activity" title="Няма записана активност" />
        ) : (
          <ActivityList entries={stats.recent_activity} />
        )}
      </Panel>
    </div>
  );
}
