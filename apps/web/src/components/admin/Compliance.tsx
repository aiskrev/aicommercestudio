"use client";

import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/admin/ui";
import { Alert, Button, cx } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { useAdminData } from "@/lib/use-admin-data";

type Tab = "withdrawals" | "data";

type WithdrawalRow = {
  id: string;
  reference: string;
  offer: string;
  status: string;
  eligibility: string;
  customer_kind: string;
  early_start_requested: boolean;
  contract_concluded_at: string | null;
  period_ends_at: string | null;
  created_at: string;
  decided_at: string | null;
  outcome_note: string | null;
  refund_reference: string | null;
  refund_amount_minor: number | null;
};
type WithdrawalDetail = WithdrawalRow & {
  statement: string;
  locale: string;
  account_email: string | null;
  audit: AuditEntry[];
};
type Deadline = {
  state: "on_track" | "due_soon" | "overdue" | "closed";
  received_at: string | null;
  base_due_at: string | null;
  extended_due_at: string | null;
  effective_due_at: string | null;
  extension_reason: string | null;
  extension_notified_at: string | null;
  completed_at: string | null;
};
type DataRow = {
  id: string;
  reference: string;
  kind: string;
  status: string;
  created_at: string;
  handled_at: string | null;
  outcome_note: string | null;
  deadline?: Deadline;
};

const DEADLINE_TONE: Record<Deadline["state"], string> = {
  on_track: "bg-emerald-400/10 text-emerald-200",
  due_soon: "bg-amber-400/15 text-amber-100",
  overdue: "bg-rose-500/15 text-rose-200",
  closed: "bg-white/5 text-slate-300",
};

function DeadlineBadge({ deadline }: { deadline?: Deadline }) {
  const { t: dict, locale } = useAdminI18n();
  if (!deadline) return null;
  const t = dict.compliance;
  return (
    <span className={cx("inline-flex rounded-md px-2 py-0.5 text-xs", DEADLINE_TONE[deadline.state])} data-testid="deadline-badge">
      {t.deadlineStates[deadline.state]}
      {deadline.effective_due_at && deadline.state !== "closed" ? ` · ${formatDateTime(deadline.effective_due_at, locale)}` : ""}
    </span>
  );
}
type DataDetail = DataRow & {
  message: string | null;
  handled_by: string | null;
  account_email: string | null;
  deletion_blockers: string[];
  stripe_attestation_required: boolean;
  audit: AuditEntry[];
};
type AuditEntry = { at: string; action: string; by: string };

const WITHDRAWAL_STATUSES = ["received", "refund_review", "refunded", "closed"] as const;
const DATA_STATUSES = ["open", "done", "rejected"] as const;

/** Staff queues for withdrawals from a contract and data-subject requests (docs/LEGAL_COMPLIANCE_REMEDIATION). */
export function Compliance() {
  const { t: dict } = useAdminI18n();
  const t = dict.compliance;
  const [tab, setTab] = useState<Tab>("withdrawals");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <AdminPageHeader title={t.title} description={t.description} />
      <div role="tablist" aria-label={t.title} className="mb-4 inline-flex rounded-xl border border-white/10 p-1">
        {(["withdrawals", "data"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            id={`compliance-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="compliance-panel"
            onClick={() => {
              setTab(key);
              setSelected(null);
            }}
            className={cx(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              tab === key ? "bg-cyan-400/15 text-cyan-200" : "text-slate-400 hover:text-white",
            )}
          >
            {t.tabs[key]}
          </button>
        ))}
      </div>
      <div id="compliance-panel" role="tabpanel" aria-labelledby={`compliance-tab-${tab}`}>
        {tab === "withdrawals" ? (
          <Withdrawals selected={selected} onSelect={setSelected} />
        ) : (
          <DataRequests selected={selected} onSelect={setSelected} />
        )}
      </div>
    </>
  );
}

function StatusFilter({ id, value, onChange, options }: { id: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  const { t: dict } = useAdminI18n();
  const t = dict.compliance;
  return (
    <div className="mb-3 flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-slate-400">
        {t.filterStatus}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-slate-100"
      >
        <option value="">{t.all}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {t.statuses[option as keyof typeof t.statuses]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Withdrawals({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.compliance;
  const [status, setStatus] = useState("");
  const list = useAdminData<WithdrawalRow[]>(`/api/admin/compliance/withdrawals${status ? `?status=${status}` : ""}`);

  if (selected) return <WithdrawalDetailView id={selected} onBack={() => (onSelect(null), list.reload())} />;
  return (
    <Panel>
      <StatusFilter id="withdrawal-status" value={status} onChange={setStatus} options={WITHDRAWAL_STATUSES} />
      {list.loading && !list.data && <LoadingState />}
      {list.error && <ErrorState message={list.error} requestId={list.errorId} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && <EmptyState icon="inbox" title={t.empty} />}
      {list.data && list.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="withdrawal-list">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4">{t.reference}</th>
                <th className="py-2 pr-4">{t.created}</th>
                <th className="py-2 pr-4">{t.offer}</th>
                <th className="py-2 pr-4">{t.eligibility}</th>
                <th className="py-2 pr-4">{t.status}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-4 font-mono">{row.reference}</td>
                  <td className="py-2 pr-4">{formatDateTime(row.created_at, locale)}</td>
                  <td className="py-2 pr-4">{row.offer}</td>
                  <td className="py-2 pr-4">{t.eligibilities[row.eligibility as keyof typeof t.eligibilities] ?? row.eligibility}</td>
                  <td className="py-2 pr-4">{t.statuses[row.status as keyof typeof t.statuses] ?? row.status}</td>
                  <td className="py-2">
                    <Button variant="secondary" size="sm" onClick={() => onSelect(row.id)} aria-label={`${t.open} ${row.reference}`}>
                      {t.open}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}

function Trail({ entries }: { entries: AuditEntry[] }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.compliance;
  return (
    <section aria-labelledby="compliance-audit" className="mt-6">
      <h3 id="compliance-audit" className="mb-2 text-sm font-semibold">
        {t.audit}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">{t.noAudit}</p>
      ) : (
        <ul className="space-y-1 text-sm" data-testid="audit-trail">
          {entries.map((entry, index) => (
            <li key={index}>
              {formatDateTime(entry.at, locale)} · {entry.action} · {entry.by}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WithdrawalDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.compliance;
  const detail = useAdminData<WithdrawalDetail>(`/api/admin/compliance/withdrawals/${id}`);
  const [decision, setDecision] = useState<"refund_review" | "refunded" | "closed">("refund_review");
  const [note, setNote] = useState("");
  const [refundRef, setRefundRef] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const row = detail.data;
  const closed = row ? row.status === "refunded" || row.status === "closed" : false;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/compliance/withdrawals/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({
          status: decision,
          note: note || null,
          refund_reference: decision === "refunded" ? refundRef : null,
          refund_amount_minor: decision === "refunded" && amount ? Number(amount) : null,
        }),
      });
      setMessage({ tone: "success", text: t.saved });
      detail.reload();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof ApiError ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={row?.reference}
      actions={
        <Button variant="secondary" size="sm" onClick={onBack}>
          {t.back}
        </Button>
      }
    >
      {detail.loading && !row && <LoadingState />}
      {detail.error && <ErrorState message={detail.error} requestId={detail.errorId} onRetry={detail.reload} />}
      {row && (
        <div data-testid="withdrawal-detail">
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[14rem_1fr]">
            <Field label={t.status}>{t.statuses[row.status as keyof typeof t.statuses] ?? row.status}</Field>
            <Field label={t.eligibility}>{t.eligibilities[row.eligibility as keyof typeof t.eligibilities] ?? row.eligibility}</Field>
            <Field label={t.customerKind}>{row.customer_kind}</Field>
            <Field label={t.offer}>{row.offer}</Field>
            <Field label={t.earlyStart}>{row.early_start_requested ? "✓" : "—"}</Field>
            <Field label={t.concluded}>{row.contract_concluded_at ? formatDateTime(row.contract_concluded_at, locale) : "—"}</Field>
            <Field label={t.periodEnds}>{row.period_ends_at ? formatDateTime(row.period_ends_at, locale) : "—"}</Field>
            <Field label={t.created}>{formatDateTime(row.created_at, locale)}</Field>
            <Field label={t.requester}>{row.account_email ?? "—"}</Field>
            <Field label={t.locale}>{row.locale}</Field>
            <Field label={t.statement}>
              <span className="whitespace-pre-wrap">{row.statement}</span>
            </Field>
            <Field label={t.outcome}>{row.outcome_note ?? "—"}</Field>
            <Field label={t.refundRef}>{row.refund_reference ?? "—"}</Field>
          </dl>

          {!closed && (
            <form
              className="mt-6 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <p className="text-sm text-slate-400">{t.decideNote}</p>
              <div>
                <label htmlFor="decision" className="block text-sm text-slate-400">
                  {t.status}
                </label>
                <select
                  id="decision"
                  value={decision}
                  onChange={(event) => setDecision(event.target.value as typeof decision)}
                  className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1"
                >
                  {(["refund_review", "refunded", "closed"] as const).map((value) => (
                    <option key={value} value={value}>
                      {t.statuses[value]}
                    </option>
                  ))}
                </select>
              </div>
              {decision === "refunded" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="refund-ref" className="block text-sm text-slate-400">
                      {t.refundRef}
                    </label>
                    <input id="refund-ref" value={refundRef} onChange={(event) => setRefundRef(event.target.value)} className="w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1" maxLength={100} />
                  </div>
                  <div>
                    <label htmlFor="refund-amount" className="block text-sm text-slate-400">
                      {t.refundAmount}
                    </label>
                    <input id="refund-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} className="w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1" />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="decision-note" className="block text-sm text-slate-400">
                  {t.note}
                </label>
                <textarea id="decision-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1" />
              </div>
              <Button type="submit" loading={busy}>
                {t.decide}
              </Button>
            </form>
          )}
          {message && (
            <Alert tone={message.tone} role={message.tone === "error" ? "alert" : "status"} className="mt-4">
              {message.text}
            </Alert>
          )}
          <Trail entries={row.audit} />
        </div>
      )}
    </Panel>
  );
}

function DataRequests({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.compliance;
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const query = [status && `status=${status}`, kind && `kind=${kind}`].filter(Boolean).join("&");
  const list = useAdminData<DataRow[]>(`/api/admin/compliance/data-requests${query ? `?${query}` : ""}`);

  if (selected) return <DataDetailView id={selected} onBack={() => (onSelect(null), list.reload())} />;
  return (
    <Panel>
      <div className="flex flex-wrap gap-4">
        <StatusFilter id="data-status" value={status} onChange={setStatus} options={DATA_STATUSES} />
        <div className="mb-3 flex items-center gap-2 text-sm">
          <label htmlFor="data-kind-filter" className="text-slate-400">
            {t.kind}
          </label>
          <select
            id="data-kind-filter"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-slate-100"
          >
            <option value="">{t.all}</option>
            {(["deletion", "correction", "restriction", "objection"] as const).map((value) => (
              <option key={value} value={value}>
                {t.kinds[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {list.loading && !list.data && <LoadingState />}
      {list.error && <ErrorState message={list.error} requestId={list.errorId} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && <EmptyState icon="inbox" title={t.empty} />}
      {list.data && list.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="data-request-list">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4">{t.reference}</th>
                <th className="py-2 pr-4">{t.created}</th>
                <th className="py-2 pr-4">{t.kind}</th>
                <th className="py-2 pr-4">{t.status}</th>
                <th className="py-2 pr-4">{t.due}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <td className="py-2 pr-4 font-mono">{row.reference}</td>
                  <td className="py-2 pr-4">{formatDateTime(row.created_at, locale)}</td>
                  <td className="py-2 pr-4">{t.kinds[row.kind as keyof typeof t.kinds] ?? row.kind}</td>
                  <td className="py-2 pr-4">{t.statuses[row.status as keyof typeof t.statuses] ?? row.status}</td>
                  <td className="py-2 pr-4">
                    <DeadlineBadge deadline={row.deadline} />
                  </td>
                  <td className="py-2">
                    <Button variant="secondary" size="sm" onClick={() => onSelect(row.id)} aria-label={`${t.open} ${row.reference}`}>
                      {t.open}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function DataDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.compliance;
  const detail = useAdminData<DataDetail>(`/api/admin/compliance/data-requests/${id}`);
  const [note, setNote] = useState("");
  const [stripeChecked, setStripeChecked] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const row = detail.data;

  async function handle(action: "done" | "reject" | "execute_deletion") {
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/compliance/data-requests/${id}/handle`, {
        method: "POST",
        body: JSON.stringify({ action, note: note || null, stripe_checked: stripeChecked }),
      });
      setMessage({ tone: "success", text: t.saved });
      setConfirmDelete(false);
      detail.reload();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof ApiError ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={row?.reference}
      actions={
        <Button variant="secondary" size="sm" onClick={onBack}>
          {t.back}
        </Button>
      }
    >
      {detail.loading && !row && <LoadingState />}
      {detail.error && <ErrorState message={detail.error} requestId={detail.errorId} onRetry={detail.reload} />}
      {row && (
        <div data-testid="data-request-detail">
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[14rem_1fr]">
            <Field label={t.kind}>{t.kinds[row.kind as keyof typeof t.kinds] ?? row.kind}</Field>
            <Field label={t.status}>{t.statuses[row.status as keyof typeof t.statuses] ?? row.status}</Field>
            <Field label={t.created}>{formatDateTime(row.created_at, locale)}</Field>
            <Field label={t.requester}>{row.account_email ?? "—"}</Field>
            <Field label={t.message}>
              <span className="whitespace-pre-wrap">{row.message ?? "—"}</span>
            </Field>
            <Field label={t.outcome}>{row.outcome_note ?? "—"}</Field>
            <Field label={t.handledBy}>{row.handled_by ?? "—"}</Field>
          </dl>

          <DeadlinePanel id={id} row={row} onChange={detail.reload} />
          {row.kind === "deletion" && row.status === "open" && (
            <section aria-labelledby="deletion-blockers" className="mt-4">
              <h3 id="deletion-blockers" className="text-sm font-semibold">
                {t.blockers}
              </h3>
              {row.deletion_blockers.length === 0 ? (
                <p className="text-sm text-slate-400">{t.noBlockers}</p>
              ) : (
                <ul className="list-disc pl-5 text-sm" data-testid="deletion-blockers">
                  {row.deletion_blockers.map((code) => (
                    <li key={code}>{t.blockerLabels[code as keyof typeof t.blockerLabels] ?? code}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {row.status === "open" && (
            <div className="mt-6 space-y-3">
              <div>
                <label htmlFor="handle-note" className="block text-sm text-slate-400">
                  {t.note}
                </label>
                <textarea id="handle-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className="w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" loading={busy} onClick={() => void handle("done")}>
                  {t.handleDone}
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void handle("reject")}>
                  {t.handleReject}
                </Button>
              </div>
              {row.kind === "deletion" && (
                <div className="space-y-2 rounded-lg border border-white/10 p-3">
                  <p className="text-sm text-slate-400">{t.deleteHint}</p>
                  {row.stripe_attestation_required && (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={stripeChecked} onChange={(event) => setStripeChecked(event.target.checked)} />
                      <span>
                        {t.stripeChecked} <span className="text-slate-400">({t.stripeRequired})</span>
                      </span>
                    </label>
                  )}
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} />
                    <span>{t.deleteConfirm}</span>
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || !confirmDelete || row.deletion_blockers.length > 0}
                    onClick={() => void handle("execute_deletion")}
                  >
                    {t.handleDelete}
                  </Button>
                </div>
              )}
            </div>
          )}
          {message && (
            <Alert tone={message.tone} role={message.tone === "error" ? "alert" : "status"} className="mt-4">
              {message.text}
            </Alert>
          )}
          <Trail entries={row.audit} />
        </div>
      )}
    </Panel>
  );
}

/** Working due dates of a data-subject request, and the staff decision to extend one. Nothing here is automatic. */
function DeadlinePanel({ id, row, onChange }: { id: string; row: DataDetail; onChange: () => void }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.compliance;
  const [months, setMonths] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [notified, setNotified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const deadline = row.deadline;
  if (!deadline) return null;
  const date = (value: string | null) => (value ? formatDateTime(value, locale) : "—");

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/compliance/data-requests/${id}/${path}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      setMessage({ tone: "success", text: t.saved });
      onChange();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof ApiError ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="request-deadline" className="mt-4 space-y-3" data-testid="request-deadline">
      <h3 id="request-deadline" className="text-sm font-semibold">
        {t.due} <DeadlineBadge deadline={deadline} />
      </h3>
      <p className="text-xs text-slate-400">{t.dueNote}</p>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]">
        <Field label={t.received}>{date(deadline.received_at)}</Field>
        <Field label={t.baseDue}>{date(deadline.base_due_at)}</Field>
        <Field label={t.extendedDue}>{date(deadline.extended_due_at)}</Field>
        <Field label={t.extensionReason}>{deadline.extension_reason ?? "—"}</Field>
        <Field label={t.extensionNotified}>{date(deadline.extension_notified_at)}</Field>
      </dl>
      {row.status === "open" && !deadline.extended_due_at && (
        <form
          className="space-y-2 rounded-lg border border-white/10 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void post("extend", { months, reason, notified });
          }}
        >
          <label htmlFor="extend-months" className="block text-sm text-slate-400">
            {t.extendMonths}
          </label>
          <select id="extend-months" value={months} onChange={(event) => setMonths(Number(event.target.value) as 1 | 2)} className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1">
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
          <label htmlFor="extend-reason" className="block text-sm text-slate-400">
            {t.extensionReason}
          </label>
          <textarea id="extend-reason" required minLength={10} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={notified} onChange={(event) => setNotified(event.target.checked)} />
            <span>{t.extendNotified}</span>
          </label>
          <Button type="submit" variant="secondary" size="sm" disabled={busy || reason.trim().length < 10}>
            {t.extend}
          </Button>
        </form>
      )}
      {deadline.extended_due_at && !deadline.extension_notified_at && (
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void post("extension-notified")}>
          {t.markNotified}
        </Button>
      )}
      {message && (
        <Alert tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </Alert>
      )}
    </section>
  );
}
