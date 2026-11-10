"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import { accountTexts } from "@/i18n/account";
import type { Locale } from "@/i18n/config";
import { accountFetch } from "@/lib/account-api";

type Kind = "deletion" | "correction" | "restriction" | "objection";
type DataRequest = { reference: string; kind: Kind; status: string; created_at: string; created?: boolean };

/**
 * Data-subject rights in the account area: download, and requests for correction, restriction, objection or
 * deletion. A deletion request is only ever "received": an administrator carries it out, and accounting records are
 * kept where the law requires.
 */
export function DataRights({ locale }: { locale: Locale }) {
  const t = accountTexts[locale];
  const d = t.data;
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [kind, setKind] = useState<Kind>("deletion");
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const api = useCallback(
    <T,>(path: string, method = "GET", body?: unknown) => accountFetch<T>(path, locale, t.network, { method, body }),
    [locale, t.network],
  );

  const load = useCallback(async () => {
    try {
      setRequests(await api<DataRequest[]>("/data/requests"));
    } catch {
      setRequests([]);
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function download() {
    setStatus(null);
    try {
      const data = await api<unknown>("/data/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "account-data.json";
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ tone: "success", text: d.exportDone });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : d.error });
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = String(new FormData(form).get("message") ?? "").trim();
    setBusy(true);
    setStatus(null);
    try {
      const result = await api<DataRequest>("/data/requests", "POST", { kind, message: message || null });
      setStatus({ tone: "success", text: `${result.created === false ? d.repeat : d.received} ${result.reference}` });
      form.reset();
      await load();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : d.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="account-data" className="space-y-4" data-testid="account-data">
      <h2 id="account-data" className="text-xl font-semibold">
        {d.title}
      </h2>
      <p className="text-sm">{d.lead}</p>
      {status && (
        <Alert tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>
          {status.text}
        </Alert>
      )}
      <Button type="button" variant="secondary" onClick={() => void download()}>
        {d.export}
      </Button>

      <form onSubmit={(event) => void send(event)} className="space-y-3">
        <div>
          <label htmlFor="data-kind" className="field-label">
            {d.kind}
          </label>
          <select id="data-kind" className="field" value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
            {(Object.keys(d.kinds) as Kind[]).map((value) => (
              <option key={value} value={value}>
                {d.kinds[value]}
              </option>
            ))}
          </select>
        </div>
        {kind === "deletion" && <p className="text-sm">{d.deletionNote}</p>}
        <div>
          <label htmlFor="data-message" className="field-label">
            {d.message}
          </label>
          <textarea id="data-message" name="message" className="field min-h-20" maxLength={1000} />
        </div>
        <Button type="submit" loading={busy} loadingLabel={t.working}>
          {d.send}
        </Button>
      </form>

      {requests.length > 0 && (
        <div className="space-y-1 text-sm">
          <h3 className="font-semibold">{d.mine}</h3>
          <ul className="space-y-1">
            {requests.map((item) => (
              <li key={item.reference}>
                {item.reference} · {d.kinds[item.kind] ?? item.kind} ·{" "}
                {d.status[item.status as keyof typeof d.status] ?? item.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
