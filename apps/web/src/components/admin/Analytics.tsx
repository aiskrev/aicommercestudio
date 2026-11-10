"use client";

import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, StatCard, StatsSkeleton } from "@/components/admin/ui";
import { cx } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import type { AnalyticsCount, AnalyticsSummary, AnalyticsVisits } from "@/lib/admin-types";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAdminData } from "@/lib/use-admin-data";

const RANGES = [7, 30, 90] as const;

/** Dashboard of the anonymous site statistics (docs/ANALYTICS.md). */
export function Analytics() {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.analytics;
  const [days, setDays] = useState<number>(30);
  const summary = useAdminData<AnalyticsSummary>(`/api/admin/analytics/summary?days=${days}`);
  const visits = useAdminData<AnalyticsVisits>("/api/admin/analytics/visits?limit=20");
  const data = summary.data;

  return (
    <>
      <AdminPageHeader
        title={t.title}
        description={t.description}
        actions={
          <div role="group" aria-label={t.range} className="inline-flex rounded-xl border border-white/10 p-1">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={days === range}
                onClick={() => setDays(range)}
                className={cx(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  days === range ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:text-white",
                )}
              >
                {fmt(t.rangeDays, { n: range })}
              </button>
            ))}
          </div>
        }
      />

      {summary.loading && !data && <StatsSkeleton />}
      {summary.error && <ErrorState message={summary.error} requestId={summary.errorId} onRetry={summary.reload} />}

      {data && (
        <>
          {!data.enabled && (
            <p role="status" className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {t.off}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="analytics-stats">
            <StatCard label={t.visits} value={data.visits} hint={t.visitsHint} icon="users" />
            <StatCard label={t.views} value={data.views} icon="eye" />
            <StatCard label={t.clicks} value={data.clicks} icon="target" />
            <StatCard label={t.toolEvents} value={data.tool_events} icon="gauge" />
          </div>
          {data.first_event_at && (
            <p className="mt-2 text-xs text-slate-400">{fmt(t.since, { date: formatDate(data.first_event_at, locale) })}</p>
          )}

          <Panel title={t.chartTitle} className="mt-6">
            <DayChart data={data} label={t.chartLabel} visitsLabel={t.legendVisits} viewsLabel={t.legendViews} locale={locale} />
          </Panel>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title={t.topPages}>
              {data.top_pages.length === 0 ? (
                <EmptyState icon="activity" title={t.empty} />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr>
                      <th scope="col" className="pb-2 font-normal">{t.page}</th>
                      <th scope="col" className="pb-2 text-right font-normal">{t.pageViews}</th>
                      <th scope="col" className="pb-2 text-right font-normal">{t.pageVisits}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_pages.map((row) => (
                      <tr key={row.path} className="border-t border-white/[0.06]">
                        <td className="max-w-0 truncate py-2 pr-3 font-mono text-xs text-slate-200" title={row.path}>{row.path}</td>
                        <td className="py-2 text-right tabular-nums">{row.views}</td>
                        <td className="py-2 text-right tabular-nums text-slate-400">{row.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title={t.topClicks}>
              {data.top_clicks.length === 0 ? (
                <EmptyState icon="activity" title={t.empty} />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr>
                      <th scope="col" className="pb-2 font-normal">{t.clickLabel}</th>
                      <th scope="col" className="pb-2 font-normal">{t.clickTarget}</th>
                      <th scope="col" className="pb-2 font-normal">{t.clickPage}</th>
                      <th scope="col" className="pb-2 text-right font-normal">{t.clickCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_clicks.map((row) => (
                      <tr key={`${row.page}|${row.label}|${row.target}`} className="border-t border-white/[0.06] align-top">
                        <td className="py-2 pr-3 text-slate-100">{row.label}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-300">{target(row.target, t.contactLinks)}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-400">{row.page}</td>
                        <td className="py-2 text-right tabular-nums">{row.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Breakdown title={t.referrers} rows={data.referrers} empty={t.noRows} />
            <Breakdown title={t.devices} rows={data.devices} empty={t.noRows} names={t.deviceNames} />
            <Breakdown title={t.languages} rows={data.locales} empty={t.noRows} names={{ bg: "Български", en: "English" }} />
            <Breakdown title={t.tools} rows={data.tools} empty={t.noRows} />
          </div>
        </>
      )}

      <Panel title={t.recent} className="mt-6">
        <p className="mb-4 text-sm text-slate-400">{t.recentLead}</p>
        {visits.error && <ErrorState message={visits.error} requestId={visits.errorId} onRetry={visits.reload} />}
        {visits.loading && !visits.data && <LoadingState rows={3} />}
        {visits.data && visits.data.visits.length === 0 && <EmptyState icon="activity" title={t.noVisits} />}
        {visits.data && visits.data.visits.length > 0 && (
          <ul className="grid gap-3" data-testid="analytics-visits">
            {visits.data.visits.map((visit) => (
              <li key={visit.id} className="rounded-xl border border-white/[0.06] p-4">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-mono text-cyan-200">{fmt(t.visit, { id: visit.id })}</span>
                  <span className="text-slate-400">
                    {formatDateTime(visit.started_at, locale)} · {t.deviceNames[visit.device] ?? visit.device} · {visit.locale.toUpperCase()} ·{" "}
                    {visit.referrer_host ?? t.direct}
                  </span>
                </p>
                <ol className="mt-3 grid gap-1.5 text-sm">
                  {visit.events.map((event, index) => (
                    <li key={`${event.at}-${index}`} className="grid grid-cols-[4.5rem_1fr] gap-3">
                      <span className="text-xs text-slate-500">
                        {event.kind === "view" ? t.kindView : event.kind === "click" ? t.kindClick : t.kindTool}
                      </span>
                      <span className="min-w-0 break-words">
                        {event.kind === "click" ? (
                          <>
                            <span className="text-slate-100">{event.label}</span>
                            {event.target && <span className="text-slate-400"> → {target(event.target, t.contactLinks)}</span>}
                            <span className="text-slate-500"> · {event.path}</span>
                          </>
                        ) : event.kind === "tool" ? (
                          <>
                            <span className="text-slate-100">{event.label}</span>
                            <span className="text-slate-500"> · {event.path}</span>
                          </>
                        ) : (
                          <span className="font-mono text-xs text-slate-200">{event.path}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {data && <p className="mt-6 text-xs text-slate-500">{fmt(t.privacy, { n: data.retention_days })}</p>}
    </>
  );
}

function target(value: string | null, contact: Record<string, string>): string {
  if (!value) return "—";
  return contact[value] ?? value;
}

function Breakdown({ title, rows, empty, names }: { title: string; rows: AnalyticsCount[]; empty: string; names?: Record<string, string> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="grid gap-2.5 text-sm">
          {rows.map((row) => (
            <li key={row.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-slate-200">{names?.[row.name] ?? row.name}</span>
                <span className="tabular-nums text-slate-400">{row.count}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/[0.06]" aria-hidden="true">
                <div className="h-1 rounded-full bg-cyan-400/70" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** One column per day: the paler bar is page views, the stronger one visits. A table below it holds the same figures. */
function DayChart({
  data,
  label,
  visitsLabel,
  viewsLabel,
  locale,
}: {
  data: AnalyticsSummary;
  label: string;
  visitsLabel: string;
  viewsLabel: string;
  locale: "bg" | "en";
}) {
  const max = Math.max(1, ...data.daily.map((day) => day.views));
  return (
    <figure>
      <div
        role="img"
        aria-label={`${label}: ${visitsLabel} ${data.visits}, ${viewsLabel} ${data.views}`}
        className="flex h-44 items-end gap-px sm:gap-1"
        data-testid="analytics-chart"
      >
        {data.daily.map((day) => (
          <div key={day.date} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${formatDate(day.date, locale)}: ${visitsLabel} ${day.visits}, ${viewsLabel} ${day.views}`}>
            <div className="relative w-full rounded-t bg-cyan-400/25" style={{ height: `${(day.views / max) * 100}%` }}>
              <div className="absolute inset-x-0 bottom-0 rounded-t bg-cyan-400" style={{ height: day.views ? `${Math.min(100, (day.visits / day.views) * 100)}%` : 0 }} />
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          {formatDate(data.daily[0].date, locale)} – {formatDate(data.daily[data.daily.length - 1].date, locale)}
        </span>
        <span className="inline-flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm bg-cyan-400" aria-hidden="true" />{visitsLabel}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm bg-cyan-400/25" aria-hidden="true" />{viewsLabel}</span>
        </span>
      </figcaption>
    </figure>
  );
}
