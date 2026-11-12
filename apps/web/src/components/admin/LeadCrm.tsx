"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import type { Person, TaskRow } from "@/components/admin/Crm";
import { Panel } from "@/components/admin/ui";
import { Alert, Button, buttonClass } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";

interface TimelineItem {
  at: string;
  kind: string;
  action: string;
  actor: string | null;
  detail: string | null;
  ref: string | null;
}
interface Customer {
  has_account: boolean;
  account_verified: boolean;
  projects: { id: string; reference: string; title: string; status: string }[];
  quotations: { id: string; status: string; version: number; published_at: string }[];
}

/**
 * What the CRM adds to an enquiry (docs/ADMIN_CRM.md): who owns it, the customer and projects behind it, its follow-up
 * tasks and everything that was recorded about it. It extends the existing lead page; it is not a second screen.
 */
export function LeadCrm({ leadId, ownerId, onOwnerChanged }: { leadId: string; ownerId: string | null; onOwnerChanged?: () => void }) {
  const { t: dict } = useAdminI18n();
  const t = dict.crm;
  const [admins, setAdmins] = useState<Person[]>([]);
  const [owner, setOwner] = useState(ownerId ?? "");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([
      adminFetch<Person[]>("/api/admin/crm/admins"),
      adminFetch<TaskRow[]>(`/api/admin/leads/${leadId}/tasks`),
      adminFetch<TimelineItem[]>(`/api/admin/leads/${leadId}/timeline`),
      adminFetch<Customer>(`/api/admin/leads/${leadId}/customer`),
    ])
      .then(([a, task, line, who]) => {
        if (!active) return;
        setAdmins(a);
        setTasks(task);
        setTimeline(line);
        setCustomer(who);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [leadId, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  async function saveOwner(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await adminFetch(`/api/admin/leads/${leadId}/owner`, { method: "PUT", body: JSON.stringify({ owner_id: owner || null }) });
      setMessage({ ok: true, text: t.owner.saved });
      onOwnerChanged?.();
      reload();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof ApiError && error.code === "assignee_invalid" ? t.owner.invalid : t.tasks.failed });
    }
  }

  return (
    <Panel title={t.title}>
      <div className="grid gap-6" data-testid="lead-crm">
        <form onSubmit={saveOwner} className="flex flex-wrap items-end gap-3" data-testid="lead-owner-form">
          <label className="grid gap-1.5 text-sm">
            <span>{t.owner.label}</span>
            <select className="field" value={owner} onChange={(event) => setOwner(event.target.value)}>
              <option value="">{t.owner.none}</option>
              {admins.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm" variant="secondary">
            {t.owner.save}
          </Button>
        </form>
        {message && (
          <Alert tone={message.ok ? "success" : "error"} role={message.ok ? "status" : "alert"}>
            {message.text}
          </Alert>
        )}
        <CustomerBlock customer={customer} />
        <Tasks leadId={leadId} tasks={tasks} admins={admins} onChanged={reload} />
        <Timeline items={timeline} />
      </div>
    </Panel>
  );
}

function CustomerBlock({ customer }: { customer: Customer | null }) {
  const { t: dict } = useAdminI18n();
  const t = dict.crm.customer;
  if (!customer) return null;
  return (
    <section aria-label={t.title} className="grid gap-2 text-sm" data-testid="lead-customer">
      <h3 className="text-sm font-semibold">{t.title}</h3>
      <p>
        {t.account}: {customer.has_account ? `${t.yes} (${customer.account_verified ? t.verified : t.unverified})` : t.no}
      </p>
      <p>
        {t.projects}:{" "}
        {customer.projects.length === 0
          ? t.none
          : customer.projects.map((project, index) => (
              <span key={project.id}>
                {index > 0 && ", "}
                <Link className="text-cyan-300 underline" href={`${routes.adminProjects}?id=${project.id}`}>
                  {project.title}
                </Link>{" "}
                ({dict.projects.statuses[project.status as keyof typeof dict.projects.statuses] ?? project.status})
              </span>
            ))}
      </p>
      <p>
        {t.quotations}: {customer.quotations.length === 0 ? t.none : customer.quotations.map((q) => `v${q.version} ${dict.quotation.statuses[q.status as keyof typeof dict.quotation.statuses] ?? q.status}`).join(", ")}
      </p>
    </section>
  );
}

function Tasks({ leadId, tasks, admins, onChanged }: { leadId: string; tasks: TaskRow[]; admins: Person[]; onChanged: () => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.crm.tasks;
  const [title, setTitle] = useState("");
  const hintId = useId();
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Tomorrow, in the browser: the server refuses the past too.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const failure = (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.code === "task_stale") return t.stale;
      if (error.code === "due_in_past") return t.past;
      if (error.code === "task_limit") return t.limit;
    }
    return t.failed;
  };

  async function add(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await adminFetch(`/api/admin/leads/${leadId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), due_on: due || null, assignee_id: assignee || null }),
      });
      setTitle("");
      setDue("");
      setMessage({ ok: true, text: t.added });
      onChanged();
    } catch (error) {
      setMessage({ ok: false, text: failure(error) });
    }
  }

  async function change(task: TaskRow, state: "open" | "done" | "cancelled") {
    setMessage(null);
    try {
      await adminFetch(`/api/admin/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ expected_revision: task.revision, state }) });
    } catch (error) {
      setMessage({ ok: false, text: failure(error) });
    }
    onChanged();
  }

  return (
    <section aria-label={t.title} className="grid gap-3" data-testid="lead-tasks">
      <h3 className="text-sm font-semibold">{t.title}</h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">{t.empty}</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {tasks.map((task) => (
            <li key={task.id} data-task={task.id} data-state={task.state} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={task.state === "open" ? "" : "text-slate-500 line-through"}>{task.title}</span>
              <span className="text-xs text-slate-400">
                {task.due_on ? formatDateTime(task.due_on, locale).split(",")[0] : "—"} · {task.assignee?.name ?? "—"} · {t.state[task.state]}
              </span>
              {task.overdue && <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-xs text-rose-200">{t.overdue}</span>}
              {task.state === "open" ? (
                <>
                  <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void change(task, "done")}>
                    {t.done}
                  </button>
                  <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void change(task, "cancelled")}>
                    {t.cancel}
                  </button>
                </>
              ) : (
                <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void change(task, "open")}>
                  {t.reopen}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid max-w-xl gap-3" data-testid="task-form">
        <div className="grid gap-1.5 text-sm">
          <label htmlFor={`${hintId}-title`}>{t.text}</label>
          <input id={`${hintId}-title`} className="field" required maxLength={200} value={title} aria-describedby={`${hintId}-hint`} onChange={(event) => setTitle(event.target.value)} />
          <span id={`${hintId}-hint`} className="text-xs text-slate-400">{t.textHint}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span>{t.dueOn}</span>
            <input className="field" type="date" min={today} value={due} onChange={(event) => setDue(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>{t.assignee}</span>
            <select className="field" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">{t.assigneeDefault}</option>
              {admins.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <Button type="submit" size="sm">
            {t.save}
          </Button>
        </div>
      </form>
      {message && (
        <Alert tone={message.ok ? "success" : "error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </Alert>
      )}
    </section>
  );
}

function Timeline({ items }: { items: TimelineItem[] }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.crm.timeline;
  const label = (item: TimelineItem) => {
    if (item.action.startsWith("project.status.")) {
      const status = item.action.slice("project.status.".length) as keyof typeof dict.projects.statuses;
      return `${dict.projects.title}: ${dict.projects.statuses[status] ?? status}`;
    }
    return t.actions[item.action] ?? item.action;
  };
  return (
    <section aria-label={t.title} className="grid gap-2" data-testid="lead-timeline">
      <h3 className="text-sm font-semibold">{t.title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{t.empty}</p>
      ) : (
        <ol className="grid gap-2 text-sm">
          {items.map((item, index) => (
            <li key={`${item.at}-${item.action}-${index}`} data-kind={item.kind} data-action={item.action}>
              <span className="text-xs text-slate-400">
                {formatDateTime(item.at, locale)}
                {item.actor ? ` · ${item.actor}` : ""}
              </span>
              <span className="block text-slate-200">
                {label(item)}
                {item.detail ? `: ${item.detail}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
