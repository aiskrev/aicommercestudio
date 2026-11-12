"use client";

import Link from "next/link";
import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

export interface Person {
  id: string;
  name: string;
}
export interface TaskRow {
  id: string;
  lead_id: string;
  lead_reference: string;
  lead_service: string;
  title: string;
  due_on: string | null;
  state: "open" | "done" | "cancelled";
  overdue: boolean;
  assignee: Person | null;
  created_at: string;
  done_at: string | null;
  revision: number;
}
interface Overview {
  period_days: number;
  enquiries_total: number;
  enquiries_in_period: number;
  enquiries_by_status: Record<string, number>;
  unassigned_open_enquiries: number;
  open_opportunities: number;
  proposals_approved: number;
  quotations_pending: number;
  quotations_accepted: number;
  projects_active: number;
  projects_by_status: Record<string, number>;
  follow_ups_open: number;
  follow_ups_overdue: number;
  follow_ups_due_this_week: number;
  owners: { owner: Person | null; open_enquiries: number; open_tasks: number; overdue_tasks: number }[];
}
interface TaskPage {
  items: TaskRow[];
  total: number;
  page: number;
  page_size: number;
}

const CARDS = [
  "enquiries_total",
  "enquiries_in_period",
  "unassigned_open_enquiries",
  "open_opportunities",
  "proposals_approved",
  "quotations_pending",
  "quotations_accepted",
  "projects_active",
  "follow_ups_open",
  "follow_ups_overdue",
  "follow_ups_due_this_week",
] as const;

/** The CRM start page: the overview of real counts, the follow-ups and the export. It extends the existing admin. */
export function Crm() {
  const { t } = useAdminI18n();
  const p = t.crm;
  const [days, setDays] = useState(30);
  const overview = useAdminData<Overview>(`/api/admin/crm/overview?days=${days}`);
  return (
    <>
      <AdminPageHeader
        title={p.title}
        description={p.lead}
        actions={
          <div className="grid gap-1 text-right">
            <a className={buttonClass("secondary", "sm")} href="/api/admin/crm/leads.csv" download="pipeline.csv" data-testid="crm-export">
              {p.export}
            </a>
            <span className="text-xs text-slate-400">{p.exportNote}</span>
          </div>
        }
      />
      <div className="grid gap-6">
        <Panel
          title={p.overview.title}
          actions={
            <label className="flex items-center gap-2 text-sm">
              <span>{p.overview.period}</span>
              <select className="field w-auto" value={days} onChange={(event) => setDays(Number(event.target.value))}>
                {[7, 30, 90, 365].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          {overview.error && !overview.data ? (
            <ErrorState message={overview.error} requestId={overview.errorId} onRetry={overview.reload} />
          ) : !overview.data ? (
            <LoadingState />
          ) : (
            <OverviewBody data={overview.data} />
          )}
        </Panel>
        <FollowUps />
      </div>
    </>
  );
}

function OverviewBody({ data }: { data: Overview }) {
  const { t, labels } = useAdminI18n();
  const p = t.crm.overview;
  return (
    <div className="grid gap-6" data-testid="crm-overview">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((key) => (
          <div key={key} className="rounded-lg border border-white/[0.08] p-3" data-card={key}>
            <dt className="text-xs text-slate-400">{p.cards[key]}</dt>
            <dd className="mt-1 text-2xl font-semibold">{data[key]}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <Counts title={p.byStatus} counts={data.enquiries_by_status} labels={labels.status as Record<string, string>} />
        <Counts title={p.projects} counts={data.projects_by_status} labels={t.projects.statuses as Record<string, string>} />
      </div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={p.owners}>
        <h3 className="mb-2 text-sm font-semibold">{p.owners}</h3>
        {data.owners.length === 0 ? (
          <p className="text-sm text-slate-400">{p.none}</p>
        ) : (
          <table className="w-full text-left text-sm" data-testid="crm-owners">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 pr-4">{p.ownerColumns.owner}</th>
                <th className="py-2 pr-4">{p.ownerColumns.enquiries}</th>
                <th className="py-2 pr-4">{p.ownerColumns.tasks}</th>
                <th className="py-2">{p.ownerColumns.overdue}</th>
              </tr>
            </thead>
            <tbody>
              {data.owners.map((row) => (
                <tr key={row.owner?.id ?? "none"} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-4">{row.owner?.name ?? p.unassigned}</td>
                  <td className="py-2 pr-4">{row.open_enquiries}</td>
                  <td className="py-2 pr-4">{row.open_tasks}</td>
                  <td className="py-2">{row.overdue_tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Counts({ title, counts, labels }: { title: string; counts: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(counts);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="grid gap-1 text-sm">
        {entries.map(([key, value]) => (
          <li key={key} className="flex justify-between gap-4 border-b border-white/[0.06] py-1" data-count={key}>
            <span>{labels[key] ?? key}</span>
            <span className="font-medium">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FollowUps() {
  const { t, locale } = useAdminI18n();
  const p = t.crm.tasks;
  const [assignee, setAssignee] = useState("me");
  const [due, setDue] = useState("");
  const [state, setState] = useState("open");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ assignee, state, page: String(page), page_size: "25" });
  if (assignee === "any") query.delete("assignee");
  if (due) query.set("due", due);
  const { data, error, errorId, reload } = useAdminData<TaskPage>(`/api/admin/crm/tasks?${query.toString()}`);
  const [failed, setFailed] = useState<string | null>(null);

  async function change(task: TaskRow, next: "open" | "done" | "cancelled") {
    setFailed(null);
    try {
      await adminFetch(`/api/admin/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ expected_revision: task.revision, state: next }) });
      reload();
    } catch (reason) {
      setFailed(reason instanceof ApiError && reason.code === "task_stale" ? p.stale : p.failed);
      reload();
    }
  }

  return (
    <Panel
      title={p.title}
      actions={
        <div className="flex flex-wrap gap-2">
          <select className="field w-auto" aria-label={p.columns.assignee} value={assignee} onChange={(event) => { setAssignee(event.target.value); setPage(1); }}>
            <option value="me">{p.mine}</option>
            <option value="any">{p.all}</option>
            <option value="none">{p.unassigned}</option>
          </select>
          <select className="field w-auto" aria-label={p.columns.due} value={due} onChange={(event) => { setDue(event.target.value); setPage(1); }}>
            <option value="">{p.due.any}</option>
            <option value="overdue">{p.due.overdue}</option>
            <option value="week">{p.due.week}</option>
            <option value="none">{p.due.none}</option>
          </select>
          <select className="field w-auto" aria-label={p.columns.state} value={state} onChange={(event) => { setState(event.target.value); setPage(1); }}>
            {(["open", "done", "cancelled"] as const).map((value) => (
              <option key={value} value={value}>
                {p.state[value]}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {error && !data ? (
        <ErrorState message={error} requestId={errorId} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState title={p.empty} />
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={p.title}>
          <table className="w-full text-left text-sm" data-testid="crm-tasks">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 pr-4">{p.columns.task}</th>
                <th className="py-2 pr-4">{p.columns.enquiry}</th>
                <th className="py-2 pr-4">{p.columns.due}</th>
                <th className="py-2 pr-4">{p.columns.assignee}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((task) => (
                <tr key={task.id} className="border-t border-white/[0.06]" data-task={task.id} data-state={task.state}>
                  <td className="py-2 pr-4">{task.title}</td>
                  <td className="py-2 pr-4">
                    <Link className="text-cyan-300 underline" href={routes.adminLead(task.lead_id)}>
                      {task.lead_reference}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    {task.due_on ? formatDateTime(task.due_on, locale).split(",")[0] : "—"}
                    {task.overdue && <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-xs text-rose-200">{p.overdue}</span>}
                  </td>
                  <td className="py-2 pr-4">{task.assignee?.name ?? "—"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {task.state === "open" ? (
                        <>
                          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void change(task, "done")}>
                            {p.done}
                          </button>
                          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void change(task, "cancelled")}>
                            {p.cancel}
                          </button>
                        </>
                      ) : (
                        <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void change(task, "open")}>
                          {p.reopen}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.total > data.page_size && (
            <div className="mt-3 flex gap-2">
              <button type="button" className={buttonClass("secondary", "sm")} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                ←
              </button>
              <button type="button" className={buttonClass("secondary", "sm")} disabled={page * data.page_size >= data.total} onClick={() => setPage(page + 1)}>
                →
              </button>
            </div>
          )}
        </div>
      )}
      {failed && <p className="mt-3 text-sm text-rose-300" role="alert">{failed}</p>}
    </Panel>
  );
}
