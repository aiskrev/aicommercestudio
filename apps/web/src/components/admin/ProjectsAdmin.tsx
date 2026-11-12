"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { useAdminRole } from "@/components/admin/AdminRole";
import { DocumentsAdmin } from "@/components/admin/DocumentsAdmin";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/admin/ui";
import { Alert, Button, buttonClass } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

export type ProjectStatus = "draft" | "quotation" | "awaiting_approval" | "approved" | "in_progress" | "client_review" | "completed" | "maintenance";
const STATUSES: ProjectStatus[] = ["draft", "quotation", "awaiting_approval", "approved", "in_progress", "client_review", "completed", "maintenance"];
const PLANS = ["website", "commerce", "automation", "cloud", "security"];

export interface ProjectRow {
  id: string;
  reference: string;
  title: string;
  status: ProjectStatus;
  updated_at: string;
  open_requests: number;
  customer_email: string | null;
}
interface Milestone {
  id: string | null;
  title: string;
  description: string | null;
  indicative_timing: string | null;
  status: "planned" | "in_progress" | "done";
}
interface HistoryEntry {
  id: string;
  kind: string;
  visibility: "client" | "internal";
  author: "client" | "team" | "system";
  body: string | null;
  state: "open" | "answered" | "closed" | null;
  meta: { from?: string | null; to?: string } | null;
  created_at: string;
}
interface StaffProject extends ProjectRow {
  summary: string | null;
  revision: number;
  lead_id: string | null;
  quotation_id: string | null;
  quotation_reference: string | null;
  quotation_status: string | null;
  scope_version: number | null;
  customer_name: string | null;
  contract_reference: string | null;
  invoice_references: string[];
  maintenance_plan: string | null;
  maintenance_note: string | null;
  milestones: Milestone[];
  events: HistoryEntry[];
  staff_transitions: ProjectStatus[];
}

/** What a failed call says: a stale project is named, the rest uses the server's own message. */
function useProblem() {
  const { t } = useAdminI18n();
  return (error: unknown) =>
    error instanceof ApiError ? (error.status === 409 && error.code === "project_stale" ? t.projects.errors.stale : error.message) : t.projects.errors.failed;
}

/** The staff list of projects, with the management view of one project chosen by `?id=`. */
export function ProjectsAdmin() {
  const { t } = useAdminI18n();
  const id = useSearchParams().get("id");
  return (
    <>
      <AdminPageHeader title={t.projects.title} description={t.projects.lead} />
      {id ? <ProjectManager id={id} /> : <ProjectList />}
    </>
  );
}

function ProjectList() {
  const { t, locale } = useAdminI18n();
  const p = t.projects;
  const [status, setStatus] = useState("");
  const [data, setData] = useState<ProjectRow[] | null>(null);
  const [problem, setProblem] = useState<{ off: boolean; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    adminFetch<ProjectRow[]>(`/api/admin/projects${status ? `?status=${status}` : ""}`).then(
      (rows) => active && (setData(rows), setProblem(null)),
      (error: unknown) => active && setProblem({ off: error instanceof ApiError && error.status === 404, text: error instanceof ApiError ? error.message : p.errors.failed }),
    );
    return () => {
      active = false;
    };
  }, [status, version, p.errors.failed]);

  if (problem?.off) return <Alert tone="info">{p.off}</Alert>;
  if (problem && !data) return <ErrorState message={problem.text} onRetry={() => setVersion((value) => value + 1)} />;
  const loading = !data;
  return (
    <Panel
      title={p.title}
      actions={
        <label className="flex items-center gap-2 text-sm">
          <span>{p.filter}</span>
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{p.all}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {p.statuses[value]}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {loading ? (
        <LoadingState label={p.loading} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={p.empty} />
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={p.title}>
          <table className="w-full text-left text-sm" data-testid="projects-table">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 pr-4">{p.columns.project}</th>
                <th className="py-2 pr-4">{p.columns.customer}</th>
                <th className="py-2 pr-4">{p.columns.status}</th>
                <th className="py-2 pr-4">{p.columns.updated}</th>
                <th className="py-2">{p.columns.requests}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]" data-reference={row.reference}>
                  <td className="py-2 pr-4">
                    <Link className="text-cyan-300 underline" href={`${routes.adminProjects}?id=${row.id}`}>
                      {row.title}
                    </Link>
                    <span className="block text-xs text-slate-400">{fmt(p.reference, { reference: row.reference })}</span>
                  </td>
                  <td className="py-2 pr-4">{row.customer_email ?? "—"}</td>
                  <td className="py-2 pr-4">{p.statuses[row.status]}</td>
                  <td className="py-2 pr-4">{formatDateTime(row.updated_at, locale)}</td>
                  <td className="py-2">{row.open_requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ProjectManager({ id }: { id: string }) {
  const { t, locale } = useAdminI18n();
  const p = t.projects;
  const canWrite = useAdminRole() === "admin";
  const { data: project, error, errorId, reload, replace } = useAdminData<StaffProject>(`/api/admin/projects/${encodeURIComponent(id)}`);
  if (error && !project) return <ErrorState message={error} requestId={errorId} onRetry={reload} />;
  if (!project) return <LoadingState label={p.loading} />;
  return (
    <div className="grid gap-6" data-testid="project-manager" data-reference={project.reference} data-status={project.status}>
      <Link href={routes.adminProjects} className="text-sm text-cyan-300 underline">
        {p.back}
      </Link>
      <Panel title={project.title}>
        <p className="text-sm text-slate-300" data-testid="project-state">
          {p.statuses[project.status]} · {fmt(p.reference, { reference: project.reference })} · {fmt(p.customerLine, { who: project.customer_email ?? "—" })}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {project.quotation_reference ? fmt(p.quotation, { status: project.quotation_status ?? "—", version: project.scope_version ?? "—" }) : p.noQuotation}
          {project.lead_id && (
            <>
              {" "}
              <Link className="text-cyan-300 underline" href={routes.adminLead(project.lead_id)}>
                {p.inquiry}
              </Link>
            </>
          )}
        </p>
        {project.status === "draft" && <p className="mt-2 text-sm text-amber-200">{p.draftNote}</p>}
        <p className="mt-1 text-xs text-slate-400">{formatDateTime(project.updated_at, locale)}</p>
      </Panel>
      {canWrite && <Transitions project={project} onDone={replace} />}
      {canWrite ? <Details project={project} onDone={replace} /> : null}
      {canWrite ? <Milestones project={project} onDone={replace} /> : null}
      {canWrite && <PostForm project={project} onDone={replace} />}
      <DocumentsAdmin projectId={project.id} />
      <NotificationsPanel projectId={project.id} />
      <History project={project} canWrite={canWrite} onDone={replace} />
    </div>
  );
}

interface NotificationRow {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

/** The delivery of the e-mail about a project: kind, state, attempts and error code; never an address or text. */
function NotificationsPanel({ projectId }: { projectId: string }) {
  const { t, locale } = useAdminI18n();
  const p = t.projects.notifications;
  const { data } = useAdminData<NotificationRow[]>(`/api/admin/projects/${encodeURIComponent(projectId)}/notifications`);
  if (!data) return null;
  return (
    <Panel title={p.title}>
      <p className="mb-3 text-sm text-slate-400">{p.lead}</p>
      {data.length === 0 ? (
        <p className="text-sm text-slate-400">{p.empty}</p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={p.title}>
          <table className="w-full text-left text-sm" data-testid="notifications-table">
            <thead>
              <tr className="text-slate-400">
                <th className="py-2 pr-4">{p.columns.kind}</th>
                <th className="py-2 pr-4">{p.columns.status}</th>
                <th className="py-2 pr-4">{p.columns.attempts}</th>
                <th className="py-2 pr-4">{p.columns.error}</th>
                <th className="py-2 pr-4">{p.columns.created}</th>
                <th className="py-2">{p.columns.sent}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]" data-status={row.status}>
                  <td className="py-2 pr-4">{p.kinds[row.kind] ?? row.kind}</td>
                  <td className="py-2 pr-4">{p.statuses[row.status] ?? row.status}</td>
                  <td className="py-2 pr-4">{row.attempts}</td>
                  <td className="py-2 pr-4">{row.last_error ?? "—"}</td>
                  <td className="py-2 pr-4">{formatDateTime(row.created_at, locale)}</td>
                  <td className="py-2">{row.sent_at ? formatDateTime(row.sent_at, locale) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
  return notice ? (
    <Alert tone={notice.ok ? "success" : "error"} role={notice.ok ? "status" : "alert"}>
      {notice.text}
    </Alert>
  ) : null;
}

function Transitions({ project, onDone }: { project: StaffProject; onDone: (project: StaffProject) => void }) {
  const { t } = useAdminI18n();
  const p = t.projects;
  const problem = useProblem();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function move(to: ProjectStatus) {
    setBusy(true);
    setNotice(null);
    try {
      onDone(
        await adminFetch<StaffProject>(`/api/admin/projects/${project.id}/transition`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: project.revision, to, note: note.trim() || null }),
        }),
      );
      setNote("");
    } catch (error) {
      setNotice({ ok: false, text: problem(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={p.transitions}>
      <div className="grid max-w-2xl gap-3">
        {project.status === "awaiting_approval" && <p className="text-sm text-slate-400">{p.clientOnly}</p>}
        {project.staff_transitions.length === 0 ? (
          <p className="text-sm text-slate-400">{p.noTransitions}</p>
        ) : (
          <>
            <label className="grid gap-1.5 text-sm">
              <span>{p.transitionNote}</span>
              <textarea className="field" rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              {project.staff_transitions.map((to) => (
                <button key={to} type="button" className={buttonClass("secondary", "sm")} disabled={busy} data-move={to} onClick={() => void move(to)}>
                  {fmt(p.moveTo, { status: p.statuses[to] })}
                </button>
              ))}
            </div>
          </>
        )}
        <Notice notice={notice} />
      </div>
    </Panel>
  );
}

function Details({ project, onDone }: { project: StaffProject; onDone: (project: StaffProject) => void }) {
  const { t } = useAdminI18n();
  const p = t.projects;
  const problem = useProblem();
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary ?? "");
  const [contract, setContract] = useState(project.contract_reference ?? "");
  const [invoices, setInvoices] = useState(project.invoice_references.join("\n"));
  const [plan, setPlan] = useState(project.maintenance_plan ?? "");
  const [maintenanceNote, setMaintenanceNote] = useState(project.maintenance_note ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const body: Record<string, unknown> = {
      expected_revision: project.revision,
      title: title.trim(),
      summary: summary.trim(),
      invoice_references: invoices.split("\n").map((line) => line.trim()).filter(Boolean),
      maintenance_note: maintenanceNote.trim(),
    };
    if (contract.trim()) body.contract_reference = contract.trim();
    else if (project.contract_reference) body.clear_contract_reference = true;
    if (plan) body.maintenance_plan = plan;
    try {
      onDone(await adminFetch<StaffProject>(`/api/admin/projects/${project.id}`, { method: "PATCH", body: JSON.stringify(body) }));
      setNotice({ ok: true, text: p.saved });
    } catch (error) {
      setNotice({ ok: false, text: problem(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={p.details}>
      <form onSubmit={save} className="grid max-w-2xl gap-3" data-testid="project-details-form">
        <label className="grid gap-1.5 text-sm">
          <span>{p.fields.title}</span>
          <input className="field" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span>{p.fields.summary}</span>
          <textarea className="field" rows={3} maxLength={2000} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span>{p.fields.contract}</span>
          <input className="field" maxLength={40} value={contract} onChange={(event) => setContract(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span>{p.fields.invoices}</span>
          <textarea className="field" rows={3} value={invoices} onChange={(event) => setInvoices(event.target.value)} />
        </label>
        <p className="text-xs text-slate-400">{p.referencesNote}</p>
        <label className="grid gap-1.5 text-sm">
          <span>{p.fields.plan}</span>
          <select className="field" value={plan} onChange={(event) => setPlan(event.target.value)}>
            <option value="">{p.fields.noPlan}</option>
            {PLANS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span>{p.fields.maintenanceNote}</span>
          <input className="field" maxLength={300} value={maintenanceNote} onChange={(event) => setMaintenanceNote(event.target.value)} />
        </label>
        <div>
          <Button type="submit" size="sm" loading={busy}>
            {p.save}
          </Button>
        </div>
        <Notice notice={notice} />
      </form>
    </Panel>
  );
}

function Milestones({ project, onDone }: { project: StaffProject; onDone: (project: StaffProject) => void }) {
  const { t } = useAdminI18n();
  const p = t.projects;
  const problem = useProblem();
  const [rows, setRows] = useState<Milestone[]>(project.milestones);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (index: number, change: Partial<Milestone>) => setRows((list) => list.map((row, position) => (position === index ? { ...row, ...change } : row)));
  const swap = (index: number, other: number) =>
    setRows((list) => {
      if (other < 0 || other >= list.length) return list;
      const next = [...list];
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      onDone(
        await adminFetch<StaffProject>(`/api/admin/projects/${project.id}/milestones`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: project.revision,
            milestones: rows.filter((row) => row.title.trim()).map((row) => ({ ...(row.id ? { id: row.id } : {}), title: row.title.trim(), description: (row.description ?? "").trim(), indicative_timing: (row.indicative_timing ?? "").trim(), status: row.status })),
          }),
        }),
      );
      setNotice({ ok: true, text: p.saved });
    } catch (error) {
      setNotice({ ok: false, text: problem(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={p.milestones}>
      <div className="grid gap-4" data-testid="project-milestones-editor">
        {rows.map((row, index) => (
          <fieldset key={row.id ?? `new-${index}`} className="grid gap-2 rounded-lg border border-white/[0.08] p-3 sm:grid-cols-2">
            <legend className="px-1 text-xs text-slate-400">{index + 1}</legend>
            <label className="grid gap-1 text-sm">
              <span>{p.milestoneFields.title}</span>
              <input className="field" maxLength={160} value={row.title} onChange={(event) => set(index, { title: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{p.milestoneFields.status}</span>
              <select className="field" value={row.status} onChange={(event) => set(index, { status: event.target.value as Milestone["status"] })}>
                {(["planned", "in_progress", "done"] as const).map((value) => (
                  <option key={value} value={value}>
                    {p.milestoneStatus[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>{p.milestoneFields.description}</span>
              <input className="field" maxLength={500} value={row.description ?? ""} onChange={(event) => set(index, { description: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{p.milestoneFields.timing}</span>
              <input className="field" maxLength={120} value={row.indicative_timing ?? ""} onChange={(event) => set(index, { indicative_timing: event.target.value })} />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" className={buttonClass("secondary", "sm")} onClick={() => swap(index, index - 1)} disabled={index === 0}>
                {p.up}
              </button>
              <button type="button" className={buttonClass("secondary", "sm")} onClick={() => swap(index, index + 1)} disabled={index === rows.length - 1}>
                {p.down}
              </button>
              <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setRows((list) => list.filter((_, position) => position !== index))}>
                {p.removeMilestone}
              </button>
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass("secondary", "sm")} disabled={rows.length >= 20} onClick={() => setRows((list) => [...list, { id: null, title: "", description: "", indicative_timing: "", status: "planned" }])}>
            {p.addMilestone}
          </button>
          <Button size="sm" loading={busy} onClick={() => void save()}>
            {p.saveMilestones}
          </Button>
        </div>
        <Notice notice={notice} />
      </div>
    </Panel>
  );
}

function PostForm({ project, onDone }: { project: StaffProject; onDone: (project: StaffProject) => void }) {
  const { t } = useAdminI18n();
  const p = t.projects;
  const problem = useProblem();
  const [kind, setKind] = useState<"update" | "delivery">("update");
  const [visibility, setVisibility] = useState<"client" | "internal">("client");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      onDone(await adminFetch<StaffProject>(`/api/admin/projects/${project.id}/events`, { method: "POST", body: JSON.stringify({ kind, visibility, body: body.trim() }) }));
      setBody("");
    } catch (error) {
      setNotice({ ok: false, text: problem(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={p.post}>
      <form onSubmit={send} className="grid max-w-2xl gap-3" data-testid="project-post-form">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span>{p.postKindLabel}</span>
            <select className="field" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              <option value="update">{p.postKind.update}</option>
              <option value="delivery">{p.postKind.delivery}</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>{p.fields.summary.split(" (")[0]}</span>
            <select className="field" value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}>
              <option value="client">{p.postVisibility.client}</option>
              <option value="internal">{p.postVisibility.internal}</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1.5 text-sm">
          <span>{p.postBody}</span>
          <textarea className="field" rows={3} minLength={3} maxLength={2000} required value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <div>
          <Button type="submit" size="sm" loading={busy}>
            {p.send}
          </Button>
        </div>
        <Notice notice={notice} />
      </form>
    </Panel>
  );
}

/** One history line: a status change, a document event (a publication, a request for a decision, a decision) or the text. */
function eventText(event: HistoryEntry, p: ReturnType<typeof useAdminI18n>["t"]["projects"]): string | null {
  const meta = event.meta as { from?: string | null; to?: string; document?: string; version?: number; action?: string } | null;
  const note = event.body ? `: ${event.body}` : "";
  if (event.kind === "status" && meta?.to) {
    return `${meta.from ? p.statuses[meta.from as ProjectStatus] : "—"} → ${p.statuses[meta.to as ProjectStatus]}${note}`;
  }
  if (meta?.document) return `${meta.document} · v${meta.version ?? ""} · ${meta.action ?? ""}${note}`;
  return event.body;
}

function History({ project, canWrite, onDone }: { project: StaffProject; canWrite: boolean; onDone: (project: StaffProject) => void }) {
  const { t, locale } = useAdminI18n();
  const p = t.projects;
  return (
    <Panel title={p.history}>
      {project.events.length === 0 ? (
        <p className="text-sm text-slate-400">{p.noHistory}</p>
      ) : (
        <ol className="grid gap-4 text-sm" data-testid="project-history">
          {project.events.map((event) => (
            <li key={event.id} data-kind={event.kind} data-visibility={event.visibility} className="grid gap-1">
              <span className="text-xs text-slate-400">
                {formatDateTime(event.created_at, locale)} · {p.authors[event.author]} · {p.kinds[event.kind as keyof typeof p.kinds] ?? event.kind} · {p.visibility[event.visibility]}
                {event.state && ` · ${p.requestStates[event.state]}`}
              </span>
              <span className="whitespace-pre-wrap text-slate-200">
                {eventText(event, p)}
              </span>
              {canWrite && event.state === "open" && <ReplyForm project={project} request={event.id} onDone={onDone} />}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function ReplyForm({ project, request, onDone }: { project: StaffProject; request: string; onDone: (project: StaffProject) => void }) {
  const { t } = useAdminI18n();
  const p = t.projects;
  const problem = useProblem();
  const [body, setBody] = useState("");
  const [state, setState] = useState<"answered" | "closed">("answered");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      onDone(await adminFetch<StaffProject>(`/api/admin/projects/${project.id}/requests/${request}/reply`, { method: "POST", body: JSON.stringify({ body: body.trim(), state }) }));
      setBody("");
    } catch (error) {
      setNotice({ ok: false, text: problem(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="mt-1 grid max-w-xl gap-2" data-testid="project-reply-form">
      <label className="grid gap-1 text-sm">
        <span>{p.reply}</span>
        <textarea className="field" rows={2} required minLength={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select className="field w-auto" aria-label={p.reply} value={state} onChange={(event) => setState(event.target.value as typeof state)}>
          <option value="answered">{p.replyState.answered}</option>
          <option value="closed">{p.replyState.closed}</option>
        </select>
        <Button type="submit" size="sm" loading={busy}>
          {p.replySend}
        </Button>
      </div>
      <Notice notice={notice} />
    </form>
  );
}
