"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import { DocumentsPanel } from "@/components/account/DocumentsPanel";
import { Alert, Button } from "@/components/ui/primitives";
import { type Locale, localizePath } from "@/i18n/config";
import { type ProjectTexts, projectTexts } from "@/i18n/projects";
import { AccountError, projectsFetch } from "@/lib/account-api";
import { routes } from "@/lib/routes";

type Status = "draft" | "quotation" | "awaiting_approval" | "approved" | "in_progress" | "client_review" | "completed" | "maintenance";
type Summary = { id: string; reference: string; title: string; status: Status; updated_at: string; open_requests: number };
type Milestone = { id: string; position: number; title: string; description: string | null; indicative_timing: string | null; status: "planned" | "in_progress" | "done" };
type ProjectEvent = {
  id: string;
  kind: "status" | "update" | "delivery" | "change_request" | "support" | "response" | "approval";
  author: "client" | "team" | "system";
  mine: boolean;
  body: string | null;
  state: "open" | "answered" | "closed" | null;
  parent_id: string | null;
  meta: { from?: string | null; to?: string } | null;
  created_at: string;
};
type Scope = { scope: string; deliverables: string[]; assumptions: string[]; exclusions: string[]; acceptance_criteria: string[] };
type Detail = Summary & {
  summary: string | null;
  revision: number;
  quotation_reference: string | null;
  quotation_status: keyof ProjectTexts["quotationStatus"] | null;
  scope_version: number | null;
  scope: Scope | null;
  contract_reference: string | null;
  invoice_references: string[];
  maintenance_plan: string | null;
  maintenance_note: string | null;
  milestones: Milestone[];
  events: ProjectEvent[];
  allowed_actions: string[];
};
type Decision = "approve_scope" | "accept_completion" | "request_changes";

/** The history line of a document event (a publication, a request for a decision, a decision), from its meta. */
function documentEventText(event: ProjectEvent, t: ProjectTexts): string | null {
  const meta = event.meta as { action?: string; document?: string; version?: number } | null;
  if (!meta?.action || !meta.document) return null;
  const key = meta.action as keyof ProjectTexts["documents"]["events"];
  const template = t.documents.events[key];
  return template ? template.replace("{document}", meta.document).replace("{version}", String(meta.version ?? "")) : null;
}

const date = (value: string, locale: Locale) => new Date(value).toLocaleDateString(locale === "bg" ? "bg-BG" : "en-GB");
const stamp = (value: string, locale: Locale) =>
  new Date(value).toLocaleString(locale === "bg" ? "bg-BG" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

/** What the person reads when a call fails: a sign-in problem leaves the page, the rest becomes a message. */
function useFailure(locale: Locale) {
  const t = projectTexts[locale];
  const router = useRouter();
  return useCallback(
    (reason: unknown): string => {
      if (reason instanceof AccountError) {
        if (reason.status === 401) {
          router.replace(localizePath(locale, routes.accountSignIn));
          return "";
        }
        if (reason.status === 404) return t.notFound;
        if (reason.status === 409) return reason.code === "project_stale" ? t.stale : t.refused;
        if (reason.status === 422) return reason.code === "note_required" ? t.noteRequired : t.spam;
        if (reason.status === 429) return t.rateLimited;
        if (reason.status === 403) return t.onlyOwners;
      }
      return t.network;
    },
    [locale, router, t],
  );
}

export function DeliveryProjects({ locale }: { locale: Locale }) {
  const id = useSearchParams().get("p");
  return id ? <ProjectView locale={locale} id={id} /> : <ProjectList locale={locale} />;
}

function ProjectList({ locale }: { locale: Locale }) {
  const t = projectTexts[locale];
  const fail = useFailure(locale);
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    projectsFetch<Summary[]>("", locale, t.network)
      .then((list) => active && setRows(list))
      .catch((reason) => active && setError(fail(reason) || t.failed));
    return () => {
      active = false;
    };
  }, [locale, t.network, t.failed, fail]);

  if (error) return <Alert tone="error" role="alert">{error}</Alert>;
  if (!rows) return <p role="status">{t.loading}</p>;
  if (rows.length === 0) return <p data-testid="projects-empty">{t.empty}</p>;
  return (
    <section aria-labelledby="delivery-list" data-testid="projects-list" className="grid gap-4">
      <h2 id="delivery-list" className="t-h3-lg">{t.list}</h2>
      <ul className="grid gap-3">
        {rows.map((row) => (
          <li key={row.id} data-reference={row.reference} className="card grid gap-1 p-4">
            <Link href={`${localizePath(locale, routes.accountDelivery)}?p=${row.id}`} className="font-semibold">
              {row.title}
            </Link>
            <span className="text-body-sm text-fg-muted">
              {t.reference}: {row.reference} · <span data-testid="project-status">{t.statuses[row.status]}</span> · {t.updated} {date(row.updated_at, locale)}
              {row.open_requests > 0 && <> · {t.openRequests}: {row.open_requests}</>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return items.length ? (
    <ul className="grid list-disc gap-1 pl-5 text-fg-secondary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : null;
}

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2" aria-labelledby={`p-${id}`} data-section={id}>
      <h3 id={`p-${id}`} className="t-h3">{title}</h3>
      {children}
    </section>
  );
}

function ProjectView({ locale, id }: { locale: Locale; id: string }) {
  const t = projectTexts[locale];
  const fail = useFailure(locale);
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProject(await projectsFetch<Detail>(`/${encodeURIComponent(id)}`, locale, t.network));
    } catch (reason) {
      setError(fail(reason) || t.failed);
    }
  }, [id, locale, t.network, t.failed, fail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const back = (
    <Link href={localizePath(locale, routes.accountDelivery)} className="text-body-sm">
      ← {t.back}
    </Link>
  );
  if (error) {
    return (
      <div className="grid gap-4" data-testid="project-error">
        {back}
        <Alert tone="error" role="alert">{error}</Alert>
      </div>
    );
  }
  if (!project) return <p role="status">{t.loading}</p>;

  const scope = project.scope;
  return (
    <article className="grid gap-8" data-testid="project-detail" data-reference={project.reference}>
      {back}
      <header className="grid gap-2">
        <h2 className="t-h2">{project.title}</h2>
        <p className="text-body-sm text-fg-muted">
          {t.reference}: {project.reference} · <strong data-testid="project-status">{t.statuses[project.status]}</strong> · {t.updated}{" "}
          {date(project.updated_at, locale)}
        </p>
        {t.statusHints[project.status] && <Alert tone="info">{t.statusHints[project.status]}</Alert>}
      </header>

      {project.summary && (
        <Block id="summary" title={t.sections.summary}>
          <p className="max-w-3xl whitespace-pre-wrap text-fg-secondary">{project.summary}</p>
        </Block>
      )}

      {scope && (
        <Block id="scope" title={t.sections.scope}>
          <p className="text-body-sm text-fg-muted">
            {t.scope.version}: {project.scope_version}
            {project.quotation_reference && (
              <>
                {" "}· {t.sections.quotation}: {project.quotation_reference}
                {project.quotation_status && ` (${t.quotationStatus[project.quotation_status]})`}
              </>
            )}
          </p>
          {scope.scope.trim() && <p className="max-w-3xl whitespace-pre-wrap text-fg-secondary">{scope.scope}</p>}
          {(["deliverables", "assumptions", "exclusions", "acceptance_criteria"] as const).map((key) =>
            scope[key].length ? (
              <div key={key}>
                <h4 className="t-label">{t.scope[key]}</h4>
                <List items={scope[key]} />
              </div>
            ) : null,
          )}
        </Block>
      )}

      <Block id="milestones" title={t.sections.milestones}>
        {project.milestones.length === 0 ? (
          <p className="text-fg-muted">{t.noMilestones}</p>
        ) : (
          <ol className="grid gap-2" data-testid="project-milestones">
            {project.milestones.map((item) => (
              <li key={item.id} data-status={item.status}>
                <span className="font-semibold">{item.title}</span> <span className="text-body-sm text-fg-muted">({t.milestoneStatus[item.status]})</span>
                {item.description && <span className="block text-fg-secondary">{item.description}</span>}
                {item.indicative_timing && (
                  <span className="block text-body-sm text-fg-muted">
                    {t.timing}: {item.indicative_timing}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Block id="references" title={t.sections.references}>
        {project.contract_reference || project.invoice_references.length ? (
          <dl className="grid gap-2">
            {project.contract_reference && (
              <div>
                <dt className="t-label">{t.contract}</dt>
                <dd>{project.contract_reference}</dd>
              </div>
            )}
            {project.invoice_references.length > 0 && (
              <div>
                <dt className="t-label">{t.invoices}</dt>
                <dd>{project.invoice_references.join(", ")}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-fg-muted">{t.noReferences}</p>
        )}
        <p className="text-body-sm text-fg-muted">{t.referencesNote}</p>
      </Block>

      {(project.status === "maintenance" || project.status === "completed" || project.maintenance_plan) && (
        <Block id="maintenance" title={t.sections.maintenance}>
          {project.maintenance_plan || project.maintenance_note ? (
            <p className="text-fg-secondary">
              {project.maintenance_plan && <><span className="t-label">{t.maintenancePlan}:</span> {t.maintenancePlans[project.maintenance_plan] ?? project.maintenance_plan} </>}
              {project.maintenance_note}
            </p>
          ) : (
            <p className="text-fg-muted">{t.maintenanceNone}</p>
          )}
        </Block>
      )}

      <Decisions locale={locale} project={project} onDone={setProject} />

      <DocumentsPanel locale={locale} projectId={project.id} onActivity={() => void load()} />

      <Block id="history" title={t.sections.history}>
        {project.events.length === 0 ? (
          <p className="text-fg-muted">{t.noHistory}</p>
        ) : (
          <ol className="grid gap-3" data-testid="project-history">
            {project.events.map((event) => (
              <li key={event.id} data-kind={event.kind} className="grid gap-0.5">
                <span className="text-body-sm text-fg-muted">
                  {stamp(event.created_at, locale)} · {event.mine ? t.authors.mine : t.authors[event.author]} · {t.events[event.kind]}
                  {event.state && ` · ${t.requestStates[event.state]}`}
                </span>
                {documentEventText(event, t) ? (
                  <span>{documentEventText(event, t)}{event.body && `: ${event.body}`}</span>
                ) : event.kind === "status" && event.meta?.to ? (
                  <span>
                    {t.statusChange
                      .replace("{from}", event.meta.from ? (t.statuses[event.meta.from as Status] ?? event.meta.from) : "—")
                      .replace("{to}", t.statuses[event.meta.to as Status] ?? event.meta.to)}
                    {event.body && `: ${event.body}`}
                  </span>
                ) : (
                  <span className="whitespace-pre-wrap">{event.body}</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Block>

      {project.allowed_actions.includes("support") && <RequestForm locale={locale} project={project} onDone={setProject} />}
    </article>
  );
}

/** The buttons the server says this member may press now; the page only follows `allowed_actions`. */
function Decisions({ locale, project, onDone }: { locale: Locale; project: Detail; onDone: (project: Detail) => void }) {
  const t = projectTexts[locale];
  const fail = useFailure(locale);
  const [sending, setSending] = useState<Decision | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const available = (["approve_scope", "accept_completion", "request_changes"] as const).filter((name) => project.allowed_actions.includes(name));
  const waitingForOwner = !available.length && (project.status === "awaiting_approval" || project.status === "client_review");

  if (!available.length && !waitingForOwner) return null;

  async function send(action: Decision, event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (action !== "request_changes" && !confirmed) return setMessage(t.confirmNeeded);
    if (action === "request_changes" && note.trim().length < 3) return setMessage(t.noteRequired);
    setSending(action);
    try {
      onDone(
        await projectsFetch<Detail>(`/${project.id}/decision`, locale, t.network, {
          method: "POST",
          body: { expected_revision: project.revision, action, note: note.trim() || null },
        }),
      );
      setNote("");
      setConfirmed(false);
    } catch (reason) {
      setMessage(fail(reason));
    } finally {
      setSending(null);
    }
  }

  return (
    <Block id="actions" title={t.sections.actions}>
      {waitingForOwner && <p className="text-fg-muted" data-testid="project-owners-only">{t.onlyOwners}</p>}
      {available.map((action) => (
        <form key={action} onSubmit={(event) => send(action, event)} className="grid max-w-2xl gap-3" data-action={action}>
          {action !== "request_changes" ? (
            <label className="flex items-start gap-2 text-body-sm">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
              <span>{action === "approve_scope" ? t.approveStatement : t.acceptStatement}</span>
            </label>
          ) : (
            <label className="grid gap-1 text-body-sm">
              <span>{t.note}</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} />
              <span className="text-fg-muted">{t.noteHint}</span>
            </label>
          )}
          <div>
            <Button type="submit" variant={action === "request_changes" ? "secondary" : "primary"} loading={sending === action} loadingLabel={t.sending}>
              {t.actions[action]}
            </Button>
          </div>
        </form>
      ))}
      {message && <Alert tone="error" role="alert">{message}</Alert>}
    </Block>
  );
}

function RequestForm({ locale, project, onDone }: { locale: Locale; project: Detail; onDone: (project: Detail) => void }) {
  const t = projectTexts[locale];
  const fail = useFailure(locale);
  const [kind, setKind] = useState<"change_request" | "support">("support");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    if (body.trim().length < 3) return setStatus({ tone: "error", text: t.requestTooShort });
    setSending(true);
    try {
      onDone(await projectsFetch<Detail>(`/${project.id}/requests`, locale, t.network, { method: "POST", body: { kind, body: body.trim() } }));
      setBody("");
      setStatus({ tone: "success", text: t.requestSent });
    } catch (reason) {
      setStatus({ tone: "error", text: fail(reason) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Block id="requests" title={t.sections.requests}>
      <form onSubmit={submit} className="grid max-w-2xl gap-3" data-testid="project-request-form">
        <label className="grid gap-1 text-body-sm">
          <span>{t.requestKind}</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="support">{t.requestKinds.support}</option>
            <option value="change_request">{t.requestKinds.change_request}</option>
          </select>
        </label>
        {kind === "change_request" && <p className="text-body-sm text-fg-muted">{t.changeRequestNote}</p>}
        <label className="grid gap-1 text-body-sm">
          <span>{t.requestBody}</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={4} />
          <span className="text-fg-muted">{t.noteHint}</span>
        </label>
        <div>
          <Button type="submit" loading={sending} loadingLabel={t.sending}>
            {t.requestSend}
          </Button>
        </div>
        <p className="text-body-sm text-fg-muted">{t.nothingSent}</p>
        {status && (
          <Alert tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>
            {status.text}
          </Alert>
        )}
      </form>
    </Block>
  );
}
