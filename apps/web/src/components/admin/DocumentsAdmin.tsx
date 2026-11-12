"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { useAdminRole } from "@/components/admin/AdminRole";
import { Panel } from "@/components/admin/ui";
import { Alert, Button, buttonClass } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";

type Approval = { id: string; version: number; state: "pending" | "approved" | "rejected" | "withdrawn" | "superseded"; message: string | null; decided_at: string | null; decision_note: string | null };
type Version = {
  number: number;
  filename: string;
  size_bytes: number;
  sha256: string;
  note: string | null;
  state: "draft" | "published" | "withdrawn";
  scan_status: "not_scanned" | "clean" | "infected" | "failed";
  uploaded_by: "client" | "team";
  uploaded_by_label: string | null;
  created_at: string;
  downloadable: boolean;
  purged: boolean;
  approval: Approval | null;
};
type Comment = { id: string; version: number; author: "client" | "team"; body: string; created_at: string };
type Doc = {
  id: string;
  title: string;
  category: string;
  origin: "staff" | "client";
  archived: boolean;
  retain_until: string | null;
  versions: Version[];
  comments: Comment[];
  can_add_version: boolean;
};
type Limits = { max_bytes: number; extensions: { extension: string }[]; categories: string[]; upload: boolean };
type View = { documents: Doc[]; limits: Limits };

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * The documents of one project, for staff (docs/PROJECT_DOCUMENTS.md). Hidden while documents are switched off (404).
 * Viewers and editors read; administrators upload, publish, scan, ask for decisions and answer.
 */
export function DocumentsAdmin({ projectId }: { projectId: string }) {
  const { t: dict } = useAdminI18n();
  const t = dict.projectDocs;
  const canWrite = useAdminRole() === "admin";
  const base = `/api/admin/projects/${projectId}/documents`;
  const [view, setView] = useState<View | null>(null);
  const [state, setState] = useState<"loading" | "off" | "ready">("loading");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await adminFetch<View>(base));
      setState("ready");
    } catch (error) {
      setState(error instanceof ApiError && error.status === 404 ? "off" : "ready");
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** One staff action, answered with the whole list again. */
  async function act(path: string, body?: object) {
    setNotice(null);
    try {
      setView(await adminFetch<View>(`${base}${path}`, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) }));
      setNotice({ ok: true, text: t.done });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof ApiError ? error.message : t.failed });
    }
  }

  if (state === "loading") return null;
  if (state === "off" || !view) return null;
  return (
    <Panel title={t.title}>
      <div className="grid gap-5" data-testid="documents-admin">
        <p className="text-sm text-slate-400">{t.lead}</p>
        <p className="text-xs text-slate-400">{t.scanNote}</p>
        {view.documents.length === 0 && <p className="text-sm text-slate-400">{t.empty}</p>}
        {view.documents.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} base={base} canWrite={canWrite} limits={view.limits} act={act} onView={setView} />
        ))}
        {canWrite &&
          (view.limits.upload ? (
            <UploadForm base={base} limits={view.limits} onView={setView} />
          ) : (
            <p className="text-sm text-slate-400">{t.upload.closed}</p>
          ))}
        {notice && (
          <Alert tone={notice.ok ? "success" : "error"} role={notice.ok ? "status" : "alert"}>
            {notice.text}
          </Alert>
        )}
      </div>
    </Panel>
  );
}

function DocumentRow({ doc, base, canWrite, limits, act, onView }: { doc: Doc; base: string; canWrite: boolean; limits: Limits; act: (path: string, body?: object) => Promise<void>; onView: (view: View) => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.projectDocs;
  const [scan, setScan] = useState<"clean" | "infected" | "failed">("clean");
  const [message, setMessage] = useState("");
  const latestPublished = [...doc.versions].reverse().find((v) => v.state === "published");
  return (
    <section className="grid gap-3 rounded-lg border border-white/[0.08] p-4" data-document={doc.id} data-testid="staff-document">
      <header>
        <h3 className="text-sm font-semibold">
          {doc.title}
          {doc.archived && <span className="text-slate-400"> ({t.archived})</span>}
        </h3>
        <p className="text-xs text-slate-400">
          {t.categories[doc.category] ?? doc.category} · {t.origin[doc.origin]}
          {doc.retain_until && ` · ${fmt(t.retainUntil, { date: formatDateTime(doc.retain_until, locale) })}`}
        </p>
      </header>
      <ol className="grid gap-4 text-sm">
        {[...doc.versions].reverse().map((v) => (
          <li key={v.number} data-version={v.number} data-state={v.state} className="grid gap-1.5">
            <span className="font-medium text-slate-100">
              {fmt(t.version, { n: v.number })} · {t.states[v.state]} · {t.scan[v.scan_status]}
            </span>
            <span className="text-xs text-slate-400">
              {v.filename} · {size(v.size_bytes)} · {v.uploaded_by === "client" ? t.authors.client : (v.uploaded_by_label ?? t.authors.team)} · {formatDateTime(v.created_at, locale)}
              {v.purged && ` · ${t.purged}`}
            </span>
            {v.note && <span className="text-xs text-slate-300">{v.note}</span>}
            <span className="break-all font-mono text-xs text-slate-500">{v.sha256}</span>
            {v.approval && (
              <span className="text-xs text-cyan-200" data-approval={v.approval.state}>
                {t.approval[v.approval.state]}
                {v.approval.decided_at && ` · ${formatDateTime(v.approval.decided_at, locale)}`}
                {v.approval.decision_note && ` — ${v.approval.decision_note}`}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {v.downloadable && (
                <a className="text-cyan-300 underline" href={`${base}/${doc.id}/versions/${v.number}/download`} download={v.filename}>
                  {t.download}
                </a>
              )}
              {canWrite && v.state === "draft" && (
                <button type="button" className={buttonClass("secondary", "sm")} data-action="publish" onClick={() => void act(`/${doc.id}/versions/${v.number}/publish`)}>
                  {t.publish}
                </button>
              )}
              {canWrite && v.state !== "withdrawn" && (
                <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void act(`/${doc.id}/versions/${v.number}/withdraw`)}>
                  {t.withdraw}
                </button>
              )}
              {canWrite && v.approval?.state === "pending" && (
                <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void act(`/approvals/${v.approval!.id}/withdraw`)}>
                  {t.withdrawApproval}
                </button>
              )}
            </div>
            {canWrite && !v.purged && (
              <div className="flex flex-wrap items-center gap-2">
                <select className="field w-auto" aria-label={t.scanLabel} value={scan} onChange={(event) => setScan(event.target.value as typeof scan)}>
                  {(["clean", "infected", "failed"] as const).map((value) => (
                    <option key={value} value={value}>
                      {t.scan[value]}
                    </option>
                  ))}
                </select>
                <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void act(`/${doc.id}/versions/${v.number}/scan`, { result: scan })}>
                  {t.scanSave}
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {canWrite && !doc.archived && doc.origin === "staff" && latestPublished && latestPublished.approval?.state !== "pending" && (
        <div className="grid max-w-xl gap-2" data-testid="request-approval">
          <label className="grid gap-1 text-sm">
            <span>{t.approvalMessage}</span>
            <input className="field" maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <div>
            <button type="button" className={buttonClass("primary", "sm")} onClick={() => void act(`/${doc.id}/versions/${latestPublished.number}/approvals`, message.trim() ? { message: message.trim() } : {})}>
              {t.requestApproval}
            </button>
          </div>
        </div>
      )}
      <Comments doc={doc} base={base} canWrite={canWrite} onView={onView} />
      {canWrite && doc.can_add_version && <UploadForm base={base} limits={limits} document={doc} onView={onView} />}
      {canWrite && !doc.archived && (
        <div>
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void act(`/${doc.id}/archive`)}>
            {t.archive}
          </button>
        </div>
      )}
    </section>
  );
}

function Comments({ doc, base, canWrite, onView }: { doc: Doc; base: string; canWrite: boolean; onView: (view: View) => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.projectDocs;
  const latestPublished = [...doc.versions].reverse().find((v) => v.state === "published");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!latestPublished) return;
    setError(null);
    try {
      onView(await adminFetch<View>(`${base}/${doc.id}/comments`, { method: "POST", body: JSON.stringify({ version: latestPublished.number, body: body.trim() }) }));
      setBody("");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t.failed);
    }
  }

  return (
    <div className="grid gap-2" data-testid="staff-comments">
      <h4 className="text-xs font-semibold uppercase text-slate-400">{t.comments}</h4>
      {doc.comments.length === 0 ? (
        <p className="text-sm text-slate-400">{t.noComments}</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {doc.comments.map((comment) => (
            <li key={comment.id}>
              <span className="text-xs text-slate-400">
                {t.authors[comment.author]} · {fmt(t.commentOn, { n: comment.version })} · {formatDateTime(comment.created_at, locale)}
              </span>
              <span className="block whitespace-pre-wrap text-slate-200">{comment.body}</span>
            </li>
          ))}
        </ul>
      )}
      {canWrite && latestPublished && !doc.archived && (
        <form onSubmit={send} className="grid max-w-xl gap-2">
          <label className="grid gap-1 text-sm">
            <span>{t.commentAdd}</span>
            <textarea className="field" rows={2} minLength={3} maxLength={2000} required value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <div>
            <Button type="submit" size="sm" variant="secondary">
              {t.commentSend}
            </Button>
          </div>
          {error && <Alert tone="error" role="alert">{error}</Alert>}
        </form>
      )}
    </div>
  );
}

function UploadForm({ base, limits, document, onView }: { base: string; limits: Limits; document?: Doc; onView: (view: View) => void }) {
  const { t: dict } = useAdminI18n();
  const t = dict.projectDocs;
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("design");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const file = input.current?.files?.[0];
    if (!file) return setMessage({ ok: false, text: t.upload.noFile });
    const headers: Record<string, string> = { "X-File-Name": encodeURIComponent(file.name) };
    if (note.trim()) headers["X-Version-Note"] = encodeURIComponent(note.trim());
    if (document) headers["X-Expected-Version"] = String(document.versions[document.versions.length - 1]?.number ?? 0);
    else {
      headers["X-Document-Title"] = encodeURIComponent((title.trim() || file.name).slice(0, 200));
      headers["X-Document-Category"] = category;
    }
    setBusy(true);
    try {
      onView(
        await adminFetch<View>(document ? `${base}/${document.id}/versions` : base, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/octet-stream" },
          body: file,
        }),
      );
      setMessage({ ok: true, text: t.upload.done });
      setTitle("");
      setNote("");
      if (input.current) input.current.value = "";
    } catch (error) {
      setMessage({ ok: false, text: error instanceof ApiError ? error.message : t.failed });
    } finally {
      setBusy(false);
    }
  }

  const types = limits.extensions.map((item) => item.extension).join(", ");
  return (
    <form onSubmit={send} className="grid max-w-xl gap-3 rounded-lg border border-white/[0.08] p-3" data-testid={document ? "staff-version-form" : "staff-upload-form"}>
      <h4 className="text-sm font-semibold">{document ? t.upload.newVersion : t.upload.newDoc}</h4>
      <label className="grid gap-1 text-sm">
        <span>{t.upload.file}</span>
        <input ref={input} type="file" accept={limits.extensions.map((item) => item.extension).join(",")} />
      </label>
      {!document && (
        <>
          <label className="grid gap-1 text-sm">
            <span>{t.upload.docTitle}</span>
            <input className="field" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>{t.upload.category}</span>
            <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
              {limits.categories.map((value) => (
                <option key={value} value={value}>
                  {t.categories[value] ?? value}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="grid gap-1 text-sm">
        <span>{t.upload.note}</span>
        <input className="field" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <p className="text-xs text-slate-400">{fmt(t.upload.allowed, { types, size: Math.round(limits.max_bytes / 1024 / 1024) })}</p>
      <div>
        <Button type="submit" size="sm" loading={busy}>
          {t.upload.send}
        </Button>
      </div>
      {message && (
        <Alert tone={message.ok ? "success" : "error"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </Alert>
      )}
    </form>
  );
}
