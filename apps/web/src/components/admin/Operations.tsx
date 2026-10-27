"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, Pill, StatCard } from "@/components/admin/ui";
import { Alert } from "@/components/ui/primitives";
import type { OpsAgent, OpsAgentStatus, OpsMember, OpsOrganization, OpsOverview, OpsWorkspace } from "@/lib/admin-types";
import { useAdminData } from "@/lib/use-admin-data";

const STATUS_TONE: Record<OpsAgentStatus, string> = {
  active: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
  paused: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
  planned: "bg-sky-400/10 text-sky-200 ring-sky-400/30",
  retired: "bg-white/[0.04] text-slate-400 ring-white/10",
};

/**
 * Internal AI operations scaffold. Shows only what the API returns for organisations the user is a
 * member of; there is no telemetry, so the page says so instead of showing empty charts.
 */
export function Operations() {
  const { t: dict } = useAdminI18n();
  const t = dict.operations;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orgs = useAdminData<OpsOrganization[]>("/api/ops/organizations");
  const selected = orgs.data?.find((o) => o.id === params.get("org")) ?? orgs.data?.[0];
  const base = selected ? `/api/ops/organizations/${selected.id}` : null;
  const overview = useAdminData<OpsOverview>(base);
  const agents = useAdminData<OpsAgent[]>(base && `${base}/agents`);
  const workspaces = useAdminData<OpsWorkspace[]>(base && `${base}/workspaces`);
  const canSeeMembers = overview.data?.permissions.includes("members.read") ?? false;
  const members = useAdminData<OpsMember[]>(base && canSeeMembers ? `${base}/members` : null);

  const header = <AdminPageHeader title={t.title} description={t.description} />;
  if (orgs.error) return <>{header}<ErrorState message={orgs.error} requestId={orgs.errorId} onRetry={orgs.reload} /></>;
  if (!orgs.data) return <>{header}<LoadingState rows={6} /></>;
  if (!selected) {
    return (
      <>
        {header}
        <Panel>
          <EmptyState icon="layers" title={t.noOrganizations} description={t.noOrganizationsText} />
        </Panel>
      </>
    );
  }

  const workspaceName = (id: string) => workspaces.data?.find((w) => w.id === id)?.name ?? "—";
  const counts = overview.data?.agents_by_status ?? {};
  const totalAgents = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <>
      {header}
      <div className="mb-6 grid gap-3">
        <Alert tone="info" role="note">
          {t.scaffoldNotice}
        </Alert>
        {selected.is_demo && (
          <Alert tone="warning" role="note">
            <span data-testid="ops-demo-notice">{t.demoNotice}</span>
          </Alert>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="grid gap-1.5 text-sm text-slate-400">
          {t.organization}
          <select
            className="field min-w-64"
            value={selected.id}
            onChange={(e) => router.replace(`${pathname}?org=${encodeURIComponent(e.target.value)}`)}
          >
            {orgs.data.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-400">
          {t.role}: <span className="text-white">{t.roles[selected.role]}</span> · {t.region}:{" "}
          <span className="uppercase text-white">{selected.data_region}</span>
        </p>
      </div>

      {overview.error && <ErrorState message={overview.error} requestId={overview.errorId} onRetry={overview.reload} />}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t.workspaces} value={overview.data?.workspaces ?? "…"} icon="layers" />
        <StatCard
          label={t.agents}
          value={overview.data ? totalAgents : "…"}
          hint={(["active", "paused", "planned"] as const).map((s) => `${t.status[s]}: ${counts[s] ?? 0}`).join(" · ")}
          icon="bot"
        />
        <StatCard label={t.telemetry} value={t.telemetryOff} icon="activity" />
      </div>

      <Panel title={t.agentsTitle} className="mb-6">
        {agents.error && <ErrorState message={agents.error} requestId={agents.errorId} onRetry={agents.reload} />}
        {!agents.data && !agents.error && <LoadingState rows={3} />}
        {agents.data && agents.data.length === 0 && <EmptyState icon="bot" title={t.noAgents} />}
        {agents.data && agents.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm" data-testid="ops-agents">
              <thead className="text-slate-400">
                <tr>
                  {Object.values(t.columns).map((label) => (
                    <th key={label} scope="col" className="pb-2 pr-4 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.data.map((agent) => (
                  <tr key={agent.id} className="border-t border-white/[0.06]">
                    <th scope="row" className="py-2.5 pr-4 font-medium text-white">
                      {agent.name}
                      <span className="block font-mono text-xs font-normal text-slate-500">{agent.key}</span>
                    </th>
                    <td className="py-2.5 pr-4 text-slate-300">{workspaceName(agent.workspace_id)}</td>
                    <td className="py-2.5 pr-4">
                      <Pill tone={STATUS_TONE[agent.status]}>{t.status[agent.status]}</Pill>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-300">{[agent.provider, agent.model].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="py-2.5 font-mono text-xs text-slate-300">{agent.version ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {canSeeMembers && (
          <Panel title={t.membersTitle}>
            {members.data ? (
              <ul className="grid gap-2 text-sm" data-testid="ops-members">
                {members.data.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-white">
                      {m.full_name} <span className="text-slate-500">· {m.email}</span>
                    </span>
                    <span className="shrink-0 text-slate-400">{t.roles[m.role]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <LoadingState rows={2} />
            )}
          </Panel>
        )}
        <Panel title={t.plannedTitle}>
          <p className="text-sm text-slate-400">{t.plannedText}</p>
          <ul className="mt-3 grid gap-1.5 text-sm text-slate-300">
            {t.planned.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
