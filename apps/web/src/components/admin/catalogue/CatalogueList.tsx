"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { useAdminRole } from "@/components/admin/AdminRole";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import { buttonClass, cx } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import type { CatalogueEntityPage, CatalogueEntitySummary, CatalogueStatus } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

export const STATUS_TONE: Record<CatalogueStatus, string> = {
  draft: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
  published: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
  archived: "bg-white/[0.04] text-slate-400 ring-white/10",
};

type Kind = "" | "domain" | "service" | "assessment" | "workshop";

function query(kind: Kind, status: string, q: string): string {
  const params = new URLSearchParams({ page_size: "100" });
  if (kind === "domain") params.set("type", "domain");
  else if (kind) {
    params.set("type", "service");
    params.set("offering_type", kind);
  }
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  return `/api/admin/catalogue/entities?${params}`;
}

export function kindOf(entity: Pick<CatalogueEntitySummary, "type" | "offering_type">): Exclude<Kind, ""> {
  return entity.type === "domain" ? "domain" : (entity.offering_type ?? "service");
}

/** Domains and services with their publishing state; links to the editor. */
export function CatalogueList() {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.catalogue;
  const role = useAdminRole();
  const [kind, setKind] = useState<Kind>("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const list = useAdminData<CatalogueEntityPage>(query(kind, status, q));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQ(search.trim());
  }

  const filtered = Boolean(kind || status || q);
  const header = (
    <AdminPageHeader
      title={t.title}
      description={t.description}
      actions={
        role !== "viewer" ? (
          <Link href={routes.adminCatalogueNew} className={buttonClass("primary")}>
            {t.create}
          </Link>
        ) : undefined
      }
    />
  );

  return (
    <>
      {header}
      <p className="-mt-4 mb-6 text-sm text-slate-400">{fmt(t.roleNote, { role: t.roles[role] })}</p>
      <Panel className="mb-6">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,12rem))_minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm">
            <span className="text-slate-300">{t.type}</span>
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="">{t.allTypes}</option>
              {(["domain", "service", "assessment", "workshop"] as const).map((value) => (
                <option key={value} value={value}>
                  {t.types[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-slate-300">{t.statusLabel}</span>
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t.allStatuses}</option>
              {(["draft", "published", "archived"] as const).map((value) => (
                <option key={value} value={value}>
                  {t.status[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-slate-300">{t.search}</span>
            <input
              type="search"
              className="field"
              value={search}
              maxLength={100}
              placeholder={t.searchPlaceholder}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button type="submit" className={buttonClass("secondary")}>
            {t.search}
          </button>
        </form>
      </Panel>

      {list.error ? (
        <ErrorState message={list.error} requestId={list.errorId} onRetry={list.reload} />
      ) : !list.data || list.loading ? (
        <LoadingState rows={6} />
      ) : list.data.items.length === 0 ? (
        <Panel>
          <EmptyState icon="clipboard" title={t.empty} description={filtered ? t.emptyText : t.emptyCatalogue} />
        </Panel>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm" data-testid="catalogue-table">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t.columns.name}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t.columns.type}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t.columns.domain}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t.columns.status}</th>
                  <th scope="col" className="py-2 font-medium">{t.columns.updated}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((entity) => (
                  <tr key={entity.id} className="border-t border-white/[0.06]">
                    <td className="py-3 pr-4">
                      <Link href={routes.adminCatalogueEntry(entity.id)} className="font-medium text-white hover:text-cyan-200">
                        {locale === "en" ? entity.name_en : entity.name_bg}
                      </Link>
                      <span className="block font-mono text-xs text-slate-400">{entity.key}</span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{t.types[kindOf(entity)]}</td>
                    <td className="py-3 pr-4 text-slate-300">{entity.domain ?? dict.common.none}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Pill tone={STATUS_TONE[entity.status]}>{t.status[entity.status]}</Pill>
                        {entity.has_unpublished_changes && entity.status !== "draft" && (
                          <Pill tone="bg-sky-400/10 text-sky-200 ring-sky-400/30">{t.unpublished}</Pill>
                        )}
                      </div>
                    </td>
                    <td className={cx("py-3 text-slate-400")}>{formatDateTime(entity.updated_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
