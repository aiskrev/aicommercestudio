"use client";

import { useCallback, useEffect, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { buttonClass, cx } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import type { QuotationStatus } from "@/lib/quotation";

interface StaffQuotation {
  id: string;
  proposal_id: string;
  version_number: number;
  status: QuotationStatus;
  locale: "bg" | "en";
  valid_until: string | null;
  published_by: string | null;
  published_at: string;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  decided_at: string | null;
  decision_name: string | null;
  decision_note: string | null;
  withdrawn_at: string | null;
  withdrawal_note: string | null;
  revision: number;
}

/** Public path of the quotation page per language (lib/routes.ts `quotation`, i18n/config.ts). */
const PAGE: Record<"bg" | "en", string> = { bg: "/bg/oferta", en: "/en/quotation" };

/**
 * Showing an approved proposal to the client. Staff publish the approved version and get the secret link once; they
 * send it themselves (the system sends nothing). Hidden entirely while quotations are switched off (404).
 */
export function QuotationPanel({ leadId, proposalId, proposalRevision, approved }: { leadId: string; proposalId: string; proposalRevision: number; approved: boolean }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.quotation;
  const base = `/api/admin/leads/${leadId}/proposals/${proposalId}/quotation`;
  const [state, setState] = useState<"loading" | "off" | "ready">("loading");
  const [quotation, setQuotation] = useState<StaffQuotation | null>(null);
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Tomorrow, in the browser: the server refuses today or the past too (`validity_in_the_past`).
  const [minDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const date = (value: string) => formatDateTime(value, locale);

  const load = useCallback(async () => {
    try {
      setQuotation(await adminFetch<StaffQuotation | null>(base));
      setState("ready");
    } catch (error) {
      // Switched off: the API answers 404 `not_found`, and the whole panel stays out of sight.
      setState(error instanceof ApiError && error.status === 404 ? "off" : "ready");
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof ApiError ? error.message : dict.common.saveError });
    } finally {
      setBusy(false);
    }
  }

  const publish = () =>
    run(async () => {
      const result = await adminFetch<{ token: string; quotation: StaffQuotation }>(base, {
        method: "POST",
        body: JSON.stringify({ expected_revision: proposalRevision, valid_until: validUntil || null }),
      });
      setQuotation(result.quotation);
      setLink(`${window.location.origin}${PAGE[result.quotation.locale]}#t=${result.token}`);
      setValidUntil("");
    });

  const withdraw = () =>
    run(async () => {
      if (!quotation) return;
      setQuotation(await adminFetch<StaffQuotation>(`${base}/withdraw`, { method: "POST", body: JSON.stringify({ expected_revision: quotation.revision, note: note.trim() }) }));
      setLink(null);
      setNote("");
    });

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setMessage({ ok: true, text: t.copied });
    } catch {
      setMessage({ ok: false, text: t.copyFailed });
    }
  }

  if (state !== "ready" || !approved) return null;
  const live = quotation?.status === "published" || quotation?.status === "expired";

  return (
    <section aria-label={t.title} className="grid gap-3 rounded-lg border border-white/[0.08] p-4" data-testid="quotation-panel" data-status={quotation?.status ?? "none"}>
      <h3 className="text-sm font-semibold">{t.title}</h3>
      <p className="text-sm text-slate-400">{t.lead}</p>

      {quotation && (
        <p className="text-sm text-slate-200" data-testid="quotation-state">
          {fmt(t.stateLine, { status: t.statuses[quotation.status], version: quotation.version_number, date: date(quotation.published_at), who: quotation.published_by ?? "—" })}
          {quotation.valid_until ? ` ${fmt(t.validUntil, { date: quotation.valid_until })}` : ""}
          {quotation.view_count > 0 ? ` ${fmt(t.viewed, { count: quotation.view_count, date: quotation.last_viewed_at ? date(quotation.last_viewed_at) : "—" })}` : ` ${t.notViewed}`}
        </p>
      )}
      {quotation?.decision_name && quotation.decided_at && (
        <p className="text-sm text-emerald-200" data-testid="quotation-answer">
          {fmt(t.answerLine, { name: quotation.decision_name, date: date(quotation.decided_at) })}
          {quotation.decision_note ? ` “${quotation.decision_note}”` : ""}
        </p>
      )}
      {quotation?.withdrawal_note && <p className="text-sm text-slate-400">{fmt(t.withdrawnLine, { note: quotation.withdrawal_note })}</p>}

      {link && (
        <div className="grid gap-2 rounded-lg border border-amber-300/30 bg-amber-300/[0.06] p-3" data-testid="quotation-link">
          <p className="text-sm text-amber-100">{t.linkOnce}</p>
          <input readOnly aria-label={t.linkLabel} className="field font-mono text-xs" value={link} onFocus={(event) => event.currentTarget.select()} />
          <div>
            <button type="button" className={buttonClass("secondary", "sm")} onClick={() => void copy()}>
              {t.copy}
            </button>
          </div>
          <p className="text-xs text-slate-400">{t.sendYourself}</p>
        </div>
      )}

      {!live && quotation?.status !== "accepted" && (
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
          <div className="grid gap-1.5">
            <label htmlFor={`q-valid-${proposalId}`} className="text-sm text-slate-300">
              {t.validUntilLabel}
            </label>
            <input id={`q-valid-${proposalId}`} type="date" className="field" min={minDate} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} aria-describedby={`q-valid-hint-${proposalId}`} />
            <p id={`q-valid-hint-${proposalId}`} className="text-xs text-slate-400">
              {t.validUntilHint}
            </p>
          </div>
          <div>
            <button type="button" className={buttonClass("primary", "sm")} disabled={busy} onClick={() => void publish()}>
              {quotation ? t.publishAgain : t.publish}
            </button>
          </div>
        </div>
      )}

      {live && quotation && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <label htmlFor={`q-withdraw-${proposalId}`} className="text-sm text-slate-300">
              {t.withdrawNote}
            </label>
            <input id={`q-withdraw-${proposalId}`} className="field" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <button type="button" className={buttonClass("secondary", "sm")} disabled={busy || note.trim().length < 3} onClick={() => void withdraw()}>
            {t.withdraw}
          </button>
        </div>
      )}
      {message && (
        <p aria-live="polite" className={cx("text-sm", message.ok ? "text-emerald-300" : "text-rose-300")}>
          {message.text}
        </p>
      )}
    </section>
  );
}
