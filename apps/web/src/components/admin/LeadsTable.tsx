"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, StatusBadge } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { locales } from "@/i18n/config";
import { LEAD_STATUSES, type LeadPage } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

const PAGE_SIZE = 20;
type FilterKey = "status" | "service" | "inquiry_type" | "locale" | "from" | "to" | "q" | "sort" | "page";

/** Local calendar date (YYYY-MM-DD) → ISO instant at the start or end of that day in the browser's zone. */
function dayBoundary(date: string, end: boolean): string {
  return new Date(`${date}T${end ? "23:59:59.999" : "00:00:00"}`).toISOString();
}

export function LeadsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t: dict, labels, locale } = useAdminI18n();
  const t = dict.leads;
  const common = dict.common;

  const status = searchParams.get("status") ?? "";
  const service = searchParams.get("service") ?? "";
  const inquiryType = searchParams.get("inquiry_type") ?? "";
  const leadLocale = searchParams.get("locale") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const [search, setSearch] = useState(q);

  const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), sort });
  if (status) query.set("status", status);
  if (service) query.set("service", service);
  if (inquiryType) query.set("inquiry_type", inquiryType);
  if (leadLocale) query.set("locale", leadLocale);
  if (from) query.set("created_from", dayBoundary(from, false));
  if (to) query.set("created_to", dayBoundary(to, true));
  if (q) query.set("q", q);
  const { data, error, errorId, loading, reload } = useAdminData<LeadPage>(`/api/admin/leads?${query.toString()}`);

  function setFilters(changes: Partial<Record<FilterKey, string>>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ q: search.trim() });
  }

  const filtered = Boolean(status || service || inquiryType || leadLocale || from || to || q);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <AdminPageHeader
        title={t.title}
        description={data ? fmt(data.total === 1 ? t.countOne : t.countMany, { n: data.total }) : undefined}
      />

      <Panel className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[1fr_auto_auto_auto]">
          <form onSubmit={onSearch} role="search" className="flex gap-2 sm:col-span-3 xl:col-span-1">
            <label htmlFor="lead-search" className="sr-only">
              {t.search}
            </label>
            <input
              id="lead-search"
              type="search"
              placeholder={t.searchPlaceholder}
              className="field"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className={buttonClass("secondary")} aria-label={t.searchButton}>
              <Icon name="search" className="h-4 w-4" />
            </button>
          </form>
          <select
            aria-label={t.statusFilter}
            className="field xl:w-48"
            value={status}
            onChange={(e) => setFilters({ status: e.target.value })}
          >
            <option value="">{t.allStatuses}</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labels.status[s]}
              </option>
            ))}
          </select>
          <select
            aria-label={t.serviceFilter}
            className="field xl:w-56"
            value={service}
            onChange={(e) => setFilters({ service: e.target.value })}
          >
            <option value="">{t.allServices}</option>
            {Object.entries(labels.service).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label={t.sort}
            className="field xl:w-40"
            value={sort}
            onChange={(e) => setFilters({ sort: e.target.value === "newest" ? "" : e.target.value })}
          >
            <option value="newest">{t.newest}</option>
            <option value="oldest">{t.oldest}</option>
          </select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select
            aria-label={t.typeFilter}
            className="field"
            value={inquiryType}
            onChange={(e) => setFilters({ inquiry_type: e.target.value })}
          >
            <option value="">{t.allTypes}</option>
            {Object.entries(labels.inquiryType).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label={t.localeFilter}
            className="field"
            value={leadLocale}
            onChange={(e) => setFilters({ locale: e.target.value })}
          >
            <option value="">{t.allLocales}</option>
            {locales.map((code) => (
              <option key={code} value={code}>
                {labels.locale[code]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <span className="shrink-0">{t.from}</span>
            <input
              type="date"
              aria-label={t.fromLabel}
              className="field"
              value={from}
              max={to || undefined}
              onChange={(e) => setFilters({ from: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <span className="shrink-0">{t.to}</span>
            <input
              type="date"
              aria-label={t.toLabel}
              className="field"
              value={to}
              min={from || undefined}
              onChange={(e) => setFilters({ to: e.target.value })}
            />
          </label>
        </div>
        {filtered && (
          <button
            type="button"
            className="mt-3 text-sm text-cyan-300 hover:text-cyan-200"
            onClick={() => {
              setSearch("");
              router.replace(pathname);
            }}
          >
            {common.clearFilters}
          </button>
        )}
      </Panel>

      {error && <ErrorState message={error} requestId={errorId} onRetry={reload} />}
      {loading && !data && (
        <Panel>
          <LoadingState rows={6} label={t.loading} />
        </Panel>
      )}
      {data && data.items.length === 0 && (
        <Panel>
          <EmptyState
            title={filtered ? t.noResults : t.emptyTitle}
            description={filtered ? t.noResultsBody : t.emptyBody}
          />
        </Panel>
      )}
      {data && data.items.length > 0 && (
        <div className={cx("rounded-2xl border border-white/[0.08] bg-ink-900/70 transition-opacity", loading && "opacity-60")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm" data-testid="leads-table">
              <thead className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">{t.colInquiry}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t.colService}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t.colLanguage}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t.colStatus}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t.colReceived}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.items.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <Link href={routes.adminLead(lead.id)} className="font-medium text-white hover:text-cyan-200">
                        {lead.name}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {lead.company} · {lead.email}
                      </p>
                      <p className="font-mono text-[11px] text-slate-400">
                        #{lead.reference}
                        {lead.inquiry_type === "quote" && (
                          <span className="ml-2 rounded bg-violet-400/15 px-1.5 py-0.5 font-sans text-violet-200">{t.quoteTag}</span>
                        )}
                        {lead.source === "synthetic_seed" && <span className="ml-2 text-amber-300/80">{t.syntheticTag}</span>}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{labels.service[lead.service] ?? lead.service}</td>
                    <td className="px-5 py-4 font-mono text-xs uppercase text-slate-300" title={labels.locale[lead.locale]}>
                      {lead.locale}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-400">{formatDateTime(lead.created_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label={common.pages} className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-sm">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-cyan-300 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-50 disabled:hover:bg-transparent"
              disabled={page <= 1}
              onClick={() => setFilters({ page: String(page - 1) })}
            >
              {common.previous}
            </button>
            <span className="text-slate-400">{fmt(common.pageOf, { page, total: totalPages })}</span>
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-cyan-300 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-50 disabled:hover:bg-transparent"
              disabled={page >= totalPages}
              onClick={() => setFilters({ page: String(page + 1) })}
            >
              {common.next}
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
