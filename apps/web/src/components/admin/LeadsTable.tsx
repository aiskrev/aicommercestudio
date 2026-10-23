"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, StatusBadge } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { serviceLabels, statusLabels } from "@/lib/admin-labels";
import { LEAD_STATUSES, type LeadPage } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

const PAGE_SIZE = 20;
type FilterKey = "status" | "service" | "q" | "sort" | "page";

export function LeadsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const service = searchParams.get("service") ?? "";
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const [search, setSearch] = useState(q);

  const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), sort });
  if (status) query.set("status", status);
  if (service) query.set("service", service);
  if (q) query.set("q", q);
  const { data, error, loading, reload } = useAdminData<LeadPage>(`/api/admin/leads?${query.toString()}`);

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

  const filtered = Boolean(status || service || q);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <AdminPageHeader
        title="Запитвания"
        description={data ? `${data.total} ${data.total === 1 ? "запитване" : "запитвания"}` : undefined}
      />

      <Panel className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[1fr_auto_auto_auto]">
          <form onSubmit={onSearch} role="search" className="flex gap-2 sm:col-span-3 xl:col-span-1">
            <label htmlFor="lead-search" className="sr-only">
              Търсене
            </label>
            <input
              id="lead-search"
              type="search"
              placeholder="Търсене по име, фирма или имейл"
              className="field"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className={buttonClass("secondary")} aria-label="Търси">
              <Icon name="search" className="h-4 w-4" />
            </button>
          </form>
          <select
            aria-label="Филтър по статус"
            className="field xl:w-48"
            value={status}
            onChange={(e) => setFilters({ status: e.target.value })}
          >
            <option value="">Всички статуси</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Филтър по услуга"
            className="field xl:w-56"
            value={service}
            onChange={(e) => setFilters({ service: e.target.value })}
          >
            <option value="">Всички услуги</option>
            {Object.entries(serviceLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Подреждане"
            className="field xl:w-40"
            value={sort}
            onChange={(e) => setFilters({ sort: e.target.value === "newest" ? "" : e.target.value })}
          >
            <option value="newest">Най-нови</option>
            <option value="oldest">Най-стари</option>
          </select>
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
            Изчисти филтрите
          </button>
        )}
      </Panel>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {data && data.items.length === 0 && (
        <Panel>
          <EmptyState
            title={filtered ? "Няма резултати" : "Все още няма запитвания"}
            description={
              filtered
                ? "Няма запитвания, които отговарят на избраните филтри."
                : "Запитванията от контактната форма ще се появят тук."
            }
          />
        </Panel>
      )}
      {data && data.items.length > 0 && (
        <div className={cx("rounded-2xl border border-white/[0.08] bg-ink-900/70 transition-opacity", loading && "opacity-60")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm" data-testid="leads-table">
              <thead className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Запитване</th>
                  <th scope="col" className="px-5 py-3 font-medium">Услуга</th>
                  <th scope="col" className="px-5 py-3 font-medium">Статус</th>
                  <th scope="col" className="px-5 py-3 font-medium">Получено</th>
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
                      <p className="font-mono text-[11px] text-slate-600">
                        #{lead.reference}
                        {lead.source === "synthetic_seed" && <span className="ml-2 text-amber-300/80">синтетичен</span>}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{serviceLabels[lead.service] ?? lead.service}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-400">{formatDateTime(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Страници" className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 text-sm">
            <button
              type="button"
              className="text-cyan-300 disabled:text-slate-600"
              disabled={page <= 1}
              onClick={() => setFilters({ page: String(page - 1) })}
            >
              ← Предишна
            </button>
            <span className="text-slate-400">
              Страница {page} от {totalPages}
            </span>
            <button
              type="button"
              className="text-cyan-300 disabled:text-slate-600"
              disabled={page >= totalPages}
              onClick={() => setFilters({ page: String(page + 1) })}
            >
              Следваща →
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
