"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

import { ActivityList } from "@/components/admin/ActivityList";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/admin/ui";
import { Button, cx } from "@/components/ui/primitives";
import { auditActionGroups, knownAuditActions } from "@/lib/admin-labels";
import type { AuditPage } from "@/lib/admin-types";
import { useAdminData } from "@/lib/use-admin-data";

const PAGE_SIZE = 50;

export default function AdminActivityPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ActivityLog />
    </Suspense>
  );
}

function ActivityLog() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const action = params.get("action") ?? "";
  const group = params.get("group") ?? "";
  const actor = params.get("actor") ?? "";
  const entity = params.get("entity") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const [actorInput, setActorInput] = useState(actor);
  const [entityInput, setEntityInput] = useState(entity);

  const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (action) query.set("action", action);
  if (group) query.set("action_prefix", group);
  if (actor) query.set("actor", actor);
  if (entity) query.set("entity_id", entity);
  const { data, error, errorId, loading, reload } = useAdminData<AuditPage>(`/api/admin/audit?${query}`);

  function setFilters(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ actor: actorInput.trim(), entity: entityInput.trim() });
  }

  const filtered = Boolean(action || group || actor || entity);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <AdminPageHeader
        title="Активност"
        description={
          data ? `Журнал на действията в системата · ${data.total} записа` : "Журнал на действията в системата"
        }
      />

      <Panel className="mb-6">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[auto_1fr_1fr_1fr_auto]">
          <select
            aria-label="Група действия"
            className="field xl:w-48"
            value={group}
            onChange={(e) => setFilters({ group: e.target.value, action: "" })}
          >
            <option value="">Всички групи</option>
            {auditActionGroups.map((g) => (
              <option key={g.prefix} value={g.prefix}>
                {g.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Конкретно действие"
            className="field"
            value={action}
            onChange={(e) => setFilters({ action: e.target.value, group: "" })}
          >
            <option value="">Всички действия</option>
            {knownAuditActions().map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Изпълнител"
            className="field"
            placeholder="Изпълнител (имейл, website, cli…)"
            value={actorInput}
            maxLength={120}
            onChange={(e) => setActorInput(e.target.value)}
          />
          <input
            aria-label="ID на запис"
            className="field font-mono text-sm"
            placeholder="ID на запитване"
            value={entityInput}
            maxLength={64}
            onChange={(e) => setEntityInput(e.target.value)}
          />
          <Button type="submit" variant="secondary" icon="search">
            Филтрирай
          </Button>
        </form>
        {filtered && (
          <button
            type="button"
            className="mt-3 text-sm text-cyan-300 hover:text-cyan-200"
            onClick={() => {
              setActorInput("");
              setEntityInput("");
              router.replace(pathname);
            }}
          >
            Изчисти филтрите
          </button>
        )}
      </Panel>

      <Panel>
        {error && <ErrorState message={error} requestId={errorId} onRetry={reload} />}
        {loading && !data && <LoadingState rows={8} />}
        {data && data.items.length === 0 && (
          <EmptyState
            icon="activity"
            title={filtered ? "Няма записи за избраните филтри" : "Няма записана активност"}
          />
        )}
        {data && data.items.length > 0 && (
          <div className={cx("transition-opacity", loading && "opacity-60")}>
            <ActivityList entries={data.items} />
          </div>
        )}
        {data && data.total > PAGE_SIZE && (
          <nav aria-label="Страници" className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-sm">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setFilters({ page: String(page - 1) })}>
              ← Предишна
            </Button>
            <span className="text-slate-400">
              Страница {page} от {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setFilters({ page: String(page + 1) })}
            >
              Следваща →
            </Button>
          </nav>
        )}
      </Panel>
    </>
  );
}
