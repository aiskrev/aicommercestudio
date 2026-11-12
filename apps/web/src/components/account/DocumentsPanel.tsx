"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import type { Locale } from "@/i18n/config";
import { projectTexts } from "@/i18n/projects";
import { AccountError, projectsFetch } from "@/lib/account-api";

type Approval = {
  id: string;
  version: number;
  state: "pending" | "approved" | "rejected" | "withdrawn" | "superseded";
  message: string | null;
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
  decided_by: "you" | "member" | null;
};
type Version = {
  number: number;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  note: string | null;
  state: "draft" | "published" | "withdrawn";
  published_at: string | null;
  created_at: string;
  uploaded_by: "client" | "team";
  mine: boolean;
  downloadable: boolean;
  approval: Approval | null;
};
type Comment = { id: string; version: number; author: "client" | "team"; mine: boolean; body: string; created_at: string };
type Doc = {
  id: string;
  title: string;
  category: string;
  origin: "staff" | "client";
  revision: number;
  created_at: string;
  versions: Version[];
  comments: Comment[];
  can_add_version: boolean;
};
type Limits = {
  max_bytes: number;
  extensions: { extension: string; content_type: string }[];
  categories: string[];
  client_categories: string[];
  upload: boolean;
  client_upload: boolean;
};
type View = { documents: Doc[]; limits: Limits; can_decide: boolean };

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
const stamp = (value: string, locale: Locale) => new Date(value).toLocaleDateString(locale === "bg" ? "bg-BG" : "en-GB");
const megabytes = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
const kilobytes = (bytes: number, locale: Locale) =>
  bytes >= 1024 * 1024 ? `${megabytes(bytes).toLocaleString(locale)} MB` : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale)} KB`;

/**
 * The documents of one project (docs/PROJECT_DOCUMENTS.md). Hidden entirely while documents are switched off (the API
 * answers 404). The page only follows what the server says: which versions download, whether the person may decide,
 * whether an upload form is offered. A download is a plain link: the browser sends the session and the server
 * authorizes it; the bytes never pass through the page's code.
 */
export function DocumentsPanel({ locale, projectId, onActivity }: { locale: Locale; projectId: string; /** Called after the person changed something, so the project's history can be reloaded. */ onActivity?: () => void }) {
  const t = projectTexts[locale].documents;
  const network = projectTexts[locale].network;
  const [view, setView] = useState<View | null>(null);
  const [state, setState] = useState<"loading" | "off" | "ready" | "failed">("loading");

  const load = useCallback(async () => {
    try {
      setView(await projectsFetch<View>(`/${projectId}/documents`, locale, network));
      setState("ready");
    } catch (reason) {
      setState(reason instanceof AccountError && reason.status === 404 ? "off" : "failed");
    }
  }, [projectId, locale, network]);

  const changed = (next: View) => {
    setView(next);
    onActivity?.();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state === "off" || state === "loading") return null;
  if (state === "failed" || !view) {
    return (
      <Section locale={locale}>
        <Alert tone="error" role="alert">{t.failed}</Alert>
      </Section>
    );
  }
  return (
    <Section locale={locale}>
      {view.documents.length === 0 ? (
        <p className="text-fg-muted" data-testid="documents-empty">{t.empty}</p>
      ) : (
        <ul className="grid gap-6" data-testid="documents-list">
          {view.documents.map((doc) => (
            <DocumentCard key={doc.id} locale={locale} projectId={projectId} doc={doc} view={view} onChanged={changed} />
          ))}
        </ul>
      )}
      {view.limits.client_upload ? (
        <UploadForm locale={locale} projectId={projectId} limits={view.limits} onChanged={changed} />
      ) : (
        <p className="text-body-sm text-fg-muted">{t.upload.closed}</p>
      )}
    </Section>
  );
}

function Section({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-4 [overflow-wrap:anywhere] [&_input]:max-w-full [&_select]:max-w-full [&_textarea]:max-w-full [&>*]:min-w-0" aria-labelledby="p-documents" data-section="documents">
      <h3 id="p-documents" className="t-h3">
        {projectTexts[locale].documents.title}
      </h3>
      {children}
    </section>
  );
}

function problem(reason: unknown, locale: Locale, area: "upload" | "approval" | "comment"): string {
  const t = projectTexts[locale].documents;
  if (reason instanceof AccountError) {
    if (area === "upload") {
      if (reason.status === 413) return t.upload.tooLarge;
      if (reason.code === "file_type_not_allowed") return t.upload.type;
      if (reason.code === "file_content_invalid") return t.upload.content;
      if (reason.code === "version_conflict") return t.upload.conflict;
      if (reason.code === "document_limit" || reason.code === "version_limit") return t.upload.limit;
      return t.upload.failed;
    }
    if (area === "approval") {
      if (reason.code === "version_conflict" || reason.code === "approval_superseded") return t.approval.stale;
      if (reason.code === "approval_closed") return t.approval.closed;
      if (reason.code === "role_not_allowed") return t.approval.onlyOwners;
      if (reason.code === "note_required") return t.approval.commentRequired;
      return t.approval.refused;
    }
  }
  return projectTexts[locale].network;
}

function DocumentCard({ locale, projectId, doc, view, onChanged }: { locale: Locale; projectId: string; doc: Doc; view: View; onChanged: (view: View) => void }) {
  const t = projectTexts[locale].documents;
  const latest = doc.versions[doc.versions.length - 1];
  return (
    <li className="card grid min-w-0 gap-4 p-4 [&>*]:min-w-0" data-document={doc.id} data-origin={doc.origin}>
      <header className="grid gap-1">
        <h4 className="font-semibold">{doc.title}</h4>
        <p className="text-body-sm text-fg-muted">
          {t.categories[doc.category] ?? doc.category} · {doc.origin === "staff" ? t.from.team : t.from.client}
        </p>
      </header>
      <ol className="grid min-w-0 gap-3 [&>li]:min-w-0" data-testid="document-versions">
        {[...doc.versions].reverse().map((version) => (
          <li key={version.number} data-version={version.number} className="grid gap-1">
            <span className="font-medium">
              {fill(t.version, { n: version.number })}
              {version.number === latest.number && <span className="text-fg-muted"> ({t.latest})</span>}
            </span>
            <span className="text-body-sm text-fg-muted">
              {version.filename} · {kilobytes(version.size_bytes, locale)} · {version.mine ? t.from.you : version.uploaded_by === "team" ? t.from.team : t.from.client} ·{" "}
              {stamp(version.published_at ?? version.created_at, locale)}
            </span>
            {version.note && <span className="text-body-sm text-fg-secondary">{version.note}</span>}
            <span className="font-mono text-xs text-fg-muted break-all">
              {t.sha}: {version.sha256}
            </span>
            {version.downloadable ? (
              <a
                className="text-body-sm underline"
                href={`/api/projects/${projectId}/documents/${doc.id}/versions/${version.number}/download`}
                download={version.filename}
                data-testid="document-download"
              >
                {t.download}
              </a>
            ) : (
              <span className="text-body-sm text-fg-muted">{t.scanPending}</span>
            )}
            {version.approval && <ApprovalLine locale={locale} approval={version.approval} />}
          </li>
        ))}
      </ol>
      {latest.approval?.state === "pending" && (
        <ApprovalDecision locale={locale} projectId={projectId} approval={latest.approval} canDecide={view.can_decide} onChanged={onChanged} />
      )}
      <Comments locale={locale} projectId={projectId} doc={doc} onChanged={onChanged} />
      {doc.can_add_version && <UploadForm locale={locale} projectId={projectId} limits={view.limits} document={doc} onChanged={onChanged} />}
    </li>
  );
}

function ApprovalLine({ locale, approval }: { locale: Locale; approval: Approval }) {
  const t = projectTexts[locale].documents.approval;
  return (
    <span className="text-body-sm" data-approval={approval.state}>
      <strong>{t[approval.state]}</strong>
      {approval.decided_at && (
        <>
          {" "}
          {approval.decided_by ? t.decidedBy[approval.decided_by] : ""} {t.on} {stamp(approval.decided_at, locale)}
        </>
      )}
      {approval.decision_note && <> — {approval.decision_note}</>}
    </span>
  );
}

function ApprovalDecision({ locale, projectId, approval, canDecide, onChanged }: { locale: Locale; projectId: string; approval: Approval; canDecide: boolean; onChanged: (view: View) => void }) {
  const t = projectTexts[locale].documents.approval;
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function decide(decision: "approve" | "reject", event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (decision === "approve" && !confirmed) return setMessage({ tone: "error", text: t.confirmNeeded });
    if (decision === "reject" && comment.trim().length < 3) return setMessage({ tone: "error", text: t.commentRequired });
    setBusy(decision);
    try {
      onChanged(
        await projectsFetch<View>(`/${projectId}/approvals/${approval.id}/decision`, locale, projectTexts[locale].network, {
          method: "POST",
          body: { expected_version: approval.version, decision, comment: comment.trim() || null },
        }),
      );
    } catch (reason) {
      setMessage({ tone: "error", text: problem(reason, locale, "approval") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-line p-3" data-testid="approval-request" role="group" aria-label={t.title}>
      <p className="font-semibold">{t.title}</p>
      {approval.message && (
        <p className="text-body-sm">
          <span className="text-fg-muted">{t.message}:</span> {approval.message}
        </p>
      )}
      {canDecide ? (
        <form className="grid max-w-2xl gap-3">
          <label className="flex items-start gap-2 text-body-sm">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
            <span>{t.statement}</span>
          </label>
          <label className="grid gap-1 text-body-sm">
            <span>{t.comment}</span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" onClick={(event) => void decide("approve", event)} loading={busy === "approve"}>
              {t.approve}
            </Button>
            <Button type="submit" variant="secondary" onClick={(event) => void decide("reject", event)} loading={busy === "reject"}>
              {t.reject}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-body-sm text-fg-muted" data-testid="approval-owners-only">{t.onlyOwners}</p>
      )}
      {message && <Alert tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>{message.text}</Alert>}
    </div>
  );
}

function Comments({ locale, projectId, doc, onChanged }: { locale: Locale; projectId: string; doc: Doc; onChanged: (view: View) => void }) {
  const t = projectTexts[locale].documents.comments;
  const latest = doc.versions[doc.versions.length - 1];
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (body.trim().length < 3) return setMessage({ tone: "error", text: t.tooShort });
    setBusy(true);
    try {
      onChanged(
        await projectsFetch<View>(`/${projectId}/documents/${doc.id}/comments`, locale, projectTexts[locale].network, {
          method: "POST",
          body: { version: latest.number, body: body.trim() },
        }),
      );
      setBody("");
      setMessage({ tone: "success", text: t.sent });
    } catch (reason) {
      setMessage({ tone: "error", text: problem(reason, locale, "comment") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2" data-testid="document-comments">
      <h5 className="t-label">{t.title}</h5>
      {doc.comments.length === 0 ? (
        <p className="text-body-sm text-fg-muted">{t.none}</p>
      ) : (
        <ul className="grid gap-2">
          {doc.comments.map((comment) => (
            <li key={comment.id} className="text-body-sm">
              <span className="text-fg-muted">
                {comment.mine ? projectTexts[locale].documents.from.you : comment.author === "team" ? projectTexts[locale].documents.from.team : projectTexts[locale].documents.from.client} ·{" "}
                {fill(t.on, { n: comment.version })} · {stamp(comment.created_at, locale)}
              </span>
              <span className="block whitespace-pre-wrap">{comment.body}</span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send} className="grid max-w-2xl gap-2">
        <label className="grid gap-1 text-body-sm">
          <span>{t.add}</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={2} />
        </label>
        <div>
          <Button type="submit" size="sm" variant="secondary" loading={busy}>
            {t.send}
          </Button>
        </div>
        {message && <Alert tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>{message.text}</Alert>}
      </form>
    </div>
  );
}

function UploadForm({ locale, projectId, limits, document, onChanged }: { locale: Locale; projectId: string; limits: Limits; document?: Doc; onChanged: (view: View) => void }) {
  const t = projectTexts[locale].documents;
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(limits.client_categories[0] ?? "brief");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const file = input.current?.files?.[0];
    if (!file) return setMessage({ tone: "error", text: t.upload.noFile });
    if (file.size > limits.max_bytes) return setMessage({ tone: "error", text: t.upload.tooLarge });
    const latest = document?.versions[document.versions.length - 1];
    const headers: Record<string, string> = { "X-File-Name": encodeURIComponent(file.name) };
    if (note.trim()) headers["X-Version-Note"] = encodeURIComponent(note.trim());
    if (document && latest) headers["X-Expected-Version"] = String(latest.number);
    else {
      headers["X-Document-Title"] = encodeURIComponent((title.trim() || file.name).slice(0, 200));
      headers["X-Document-Category"] = category;
    }
    setBusy(true);
    try {
      const path = document ? `/${projectId}/documents/${document.id}/versions` : `/${projectId}/documents`;
      onChanged(await projectsFetch<View>(path, locale, projectTexts[locale].network, { method: "POST", raw: file, headers }));
      setMessage({ tone: "success", text: t.upload.done });
      setTitle("");
      setNote("");
      if (input.current) input.current.value = "";
    } catch (reason) {
      setMessage({ tone: "error", text: problem(reason, locale, "upload") });
    } finally {
      setBusy(false);
    }
  }

  const types = limits.extensions.map((item) => item.extension).join(", ");
  const accept = limits.extensions.map((item) => item.extension).join(",");
  return (
    <form onSubmit={send} className="grid min-w-0 max-w-2xl gap-3 rounded-lg border border-line p-3 [&_label]:min-w-0" data-testid={document ? "document-version-form" : "document-upload-form"}>
      <h4 className="font-semibold">{document ? t.upload.newVersion : t.upload.title}</h4>
      {!document && <p className="text-body-sm text-fg-muted">{t.upload.lead}</p>}
      <label className="grid gap-1 text-body-sm">
        <span>{t.upload.file}</span>
        <input ref={input} type="file" accept={accept} />
      </label>
      {!document && (
        <>
          <label className="grid gap-1 text-body-sm">
            <span>{t.upload.docTitle}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
          </label>
          <label className="grid gap-1 text-body-sm">
            <span>{t.upload.category}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {limits.client_categories.map((value) => (
                <option key={value} value={value}>
                  {t.categories[value] ?? value}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="grid gap-1 text-body-sm">
        <span>{t.upload.note}</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} />
      </label>
      <p className="text-body-sm text-fg-muted">{fill(t.upload.allowed, { types, size: megabytes(limits.max_bytes) })}</p>
      <div>
        <Button type="submit" loading={busy} loadingLabel={t.upload.sending}>
          {t.upload.send}
        </Button>
      </div>
      {message && <Alert tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>{message.text}</Alert>}
    </form>
  );
}
