"use client";

import { type ReactNode, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Pill } from "@/components/admin/ui";
import { buttonClass, cx } from "@/components/ui/primitives";
import { ApiError, adminFetch } from "@/lib/admin-api";
import type { OpsAgent } from "@/lib/admin-types";

export const TONE = {
  ok: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
  warn: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
  bad: "bg-rose-400/10 text-rose-200 ring-rose-400/30",
  info: "bg-sky-400/10 text-sky-200 ring-sky-400/30",
  muted: "bg-white/[0.04] text-slate-400 ring-white/10",
} as const;

/** One API action with its pending state and a readable error (never a raw exception). */
export function useAction() {
  const { t } = useAdminI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await adminFetch<T>(path, init);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.status === 403 ? t.opsPlatform.common.noPermission : e.code === "ops_stale" ? t.opsPlatform.incidents.stale : e.message);
      } else {
        setError(t.opsPlatform.common.failed);
      }
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, clear: () => setError(null) };
}

export const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
      {message}
    </p>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-sm text-slate-300">
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Button({ children, onClick, busy, variant = "secondary", type = "button", disabled }: {
  children: ReactNode;
  onClick?: () => void;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button type={type} className={cx(buttonClass(variant, "sm"), "inline-flex")} onClick={onClick} disabled={busy || disabled}>
      {children}
    </button>
  );
}

export function SimulatedBadge() {
  const { t } = useAdminI18n();
  return (
    <span title={t.opsPlatform.common.simulatedHint} data-testid="simulated-badge">
      <Pill tone={TONE.warn}>{t.opsPlatform.common.simulated}</Pill>
    </span>
  );
}

export function AgentPicker({ agents, value, onChange }: { agents: OpsAgent[]; value: string | null; onChange: (id: string) => void }) {
  const { t } = useAdminI18n();
  return (
    <Field label={t.opsPlatform.common.agent}>
      <select className="field min-w-64" value={value ?? ""} onChange={(e) => onChange(e.target.value)} data-testid="ops-agent-picker">
        <option value="" disabled>
          {t.opsPlatform.common.chooseAgent}
        </option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "bg-BG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, String(v)), template);

/** Append-only timeline of an incident or change. */
export function Timeline({ events, kinds, statuses }: {
  events: { id: string; kind: string; from_status: string | null; to_status: string | null; body: string | null; actor_label: string; created_at: string }[];
  kinds: Record<string, string>;
  statuses: Record<string, string>;
}) {
  const { locale } = useAdminI18n();
  return (
    <ol className="grid gap-3 border-l border-white/10 pl-4 text-sm" data-testid="ops-timeline">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-cyan-300" aria-hidden="true" />
          <p className="text-slate-300">
            <span className="font-medium text-white">{kinds[e.kind] ?? e.kind}</span>
            {e.to_status && (
              <span>
                {" "}
                · {e.from_status ? `${statuses[e.from_status] ?? e.from_status} → ` : ""}
                {statuses[e.to_status] ?? e.to_status}
              </span>
            )}
          </p>
          {e.body && <p className="mt-1 whitespace-pre-wrap text-slate-400">{e.body}</p>}
          <p className="mt-0.5 text-xs text-slate-500">
            {e.actor_label} · {fmtDate(e.created_at, locale)}
          </p>
        </li>
      ))}
    </ol>
  );
}
