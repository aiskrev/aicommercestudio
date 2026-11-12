"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { useAdminRole } from "@/components/admin/AdminRole";
import type { ProjectRow } from "@/components/admin/ProjectsAdmin";
import { Alert, Button } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { routes } from "@/lib/routes";

/**
 * The delivery projects of one inquiry, and the form that creates a draft for a verified customer account. The
 * customer is chosen by the e-mail address of their account: staff never type a workspace id. Hidden entirely while
 * projects are switched off (the API answers 404).
 */
export function ProjectPanel({ leadId, acceptedQuotationId }: { leadId: string; acceptedQuotationId: string | null }) {
  const { t } = useAdminI18n();
  const p = t.projects;
  const canWrite = useAdminRole() === "admin";
  const [state, setState] = useState<"loading" | "off" | "ready">("loading");
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [link, setLink] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await adminFetch<ProjectRow[]>(`/api/admin/projects?lead_id=${leadId}`));
      setState("ready");
    } catch (error) {
      setState(error instanceof ApiError && error.status === 404 ? "off" : "ready");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/leads/${leadId}/projects`, {
        method: "POST",
        body: JSON.stringify({
          account_email: email.trim(),
          title: title.trim(),
          summary: summary.trim(),
          quotation_id: link && acceptedQuotationId ? acceptedQuotationId : null,
        }),
      });
      setEmail("");
      setTitle("");
      setSummary("");
      setMessage({ ok: true, text: p.create.created });
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof ApiError ? error.message : p.errors.failed });
    } finally {
      setBusy(false);
    }
  }

  if (state !== "ready") return null;
  return (
    <section aria-label={p.create.title} className="grid gap-3 rounded-lg border border-white/[0.08] p-4" data-testid="project-panel">
      <h3 className="text-sm font-semibold">{p.create.title}</h3>
      <p className="text-sm text-slate-400">{p.create.lead}</p>
      <div>
        <h4 className="text-sm font-semibold">{p.create.existing}</h4>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">{p.create.none}</p>
        ) : (
          <ul className="mt-1 grid gap-1 text-sm" data-testid="lead-projects">
            {rows.map((row) => (
              <li key={row.id}>
                <Link className="text-cyan-300 underline" href={`${routes.adminProjects}?id=${row.id}`}>
                  {row.title}
                </Link>{" "}
                · {p.statuses[row.status]} · {row.customer_email ?? "—"}
              </li>
            ))}
          </ul>
        )}
      </div>
      {canWrite && (
        <form onSubmit={create} className="grid max-w-xl gap-3" data-testid="project-create-form">
          <label className="grid gap-1.5 text-sm">
            <span>{p.create.email}</span>
            <input className="field" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby={`pc-hint-${leadId}`} />
            <span id={`pc-hint-${leadId}`} className="text-xs text-slate-400">
              {p.create.emailHint}
            </span>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>{p.create.projectTitle}</span>
            <input className="field" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>{p.create.summary}</span>
            <textarea className="field" rows={2} maxLength={2000} value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          {acceptedQuotationId && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={link} onChange={(event) => setLink(event.target.checked)} className="mt-1" />
              <span>{p.create.linkQuotation}</span>
            </label>
          )}
          <div>
            <Button type="submit" size="sm" loading={busy}>
              {p.create.submit}
            </Button>
          </div>
        </form>
      )}
      {message && (
        <Alert tone={message.ok ? "success" : "error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </Alert>
      )}
    </section>
  );
}
