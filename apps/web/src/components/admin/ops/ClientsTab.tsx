"use client";

import { type FormEvent, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { ActionError, Button, Field, TONE, fill, fmtDate, post, useAction } from "@/components/admin/ops/shared";
import { EmptyState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import { Alert } from "@/components/ui/primitives";
import type { PortalUser } from "@/lib/ops-types";
import { useAdminData } from "@/lib/use-admin-data";

/** Client portal accounts (read-only portal; off unless CLIENT_PORTAL_ENABLED). Links are shown once. */
export function ClientsTab({ base, permissions }: { base: string; permissions: string[] }) {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.opsPlatform.clients;
  const users = useAdminData<PortalUser[]>(`${base}/portal-users`);
  const action = useAction();
  const [form, setForm] = useState({ email: "", full_name: "" });
  const [link, setLink] = useState<{ path: string; hours: number } | null>(null);
  const write = permissions.includes("portal_users.write");
  const disabled = users.error !== null && users.error !== undefined;

  async function invite(event: FormEvent) {
    event.preventDefault();
    const out = await action.run<{ path: string; expires_in_hours: number }>(`${base}/portal-users`, post(form));
    if (out) {
      setLink({ path: out.path, hours: out.expires_in_hours });
      setForm({ email: "", full_name: "" });
      users.reload();
    }
  }

  async function act(id: string, path: "recovery" | "disable") {
    const out = await action.run<{ path?: string; expires_in_hours?: number }>(`${base}/portal-users/${id}/${path}`, post());
    if (out?.path) setLink({ path: out.path, hours: out.expires_in_hours ?? 0 });
    users.reload();
  }

  return (
    <Panel title={t.title}>
      <div className="grid gap-4 text-sm" data-testid="ops-clients">
        <p className="text-slate-400">{t.intro}</p>
        {disabled && (
          <Alert tone="info" role="note">
            <span data-testid="ops-portal-disabled">{t.disabled}</span>
          </Alert>
        )}
        {!disabled && !users.data && <LoadingState rows={2} />}
        {users.data?.length === 0 && <EmptyState icon="users" title={t.none} />}
        {users.data && users.data.length > 0 && (
          <ul className="grid gap-2">
            {users.data.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2">
                <span className="text-white">{u.full_name} <span className="text-slate-500">· {u.email}</span></span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <Pill tone={u.status === "active" ? TONE.ok : u.status === "invited" ? TONE.info : TONE.muted}>{t.statuses[u.status]}</Pill>
                  {t.mfa}: {u.mfa_enabled ? dict.opsPlatform.common.yes : dict.opsPlatform.common.no} · {fmtDate(u.last_login_at, locale)}
                  {write && u.status !== "disabled" && <Button onClick={() => act(u.id, "recovery")}>{t.recovery}</Button>}
                  {write && u.status !== "disabled" && <Button onClick={() => act(u.id, "disable")}>{t.disable}</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {link && (
          <div role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-amber-100" data-testid="ops-portal-link">
            {fill(t.linkOnce, { hours: link.hours })}
            <code className="mt-1 block break-all text-xs">{typeof window !== "undefined" ? window.location.origin : ""}{link.path}</code>
          </div>
        )}
        <ActionError message={action.error} />
        {write && !disabled && (
          <form onSubmit={invite} className="grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label={t.email}><input required type="email" className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label={t.name}><input required minLength={2} className="field" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Button type="submit" variant="primary" busy={action.busy}>{t.send}</Button>
          </form>
        )}
      </div>
    </Panel>
  );
}
