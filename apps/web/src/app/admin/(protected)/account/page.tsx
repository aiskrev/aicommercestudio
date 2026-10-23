"use client";

import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/admin/ui";
import { Alert, Badge, Button } from "@/components/ui/primitives";
import { type AdminDictionary, fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import type { AdminSessionInfo } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

function describeAgent(agent: string | null, t: AdminDictionary["account"]): string {
  if (!agent) return t.unknownDevice;
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : t.browser;
  const os = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

export default function AdminAccountPage() {
  const sessions = useAdminData<AdminSessionInfo[]>("/api/admin/auth/sessions");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t: dict, locale } = useAdminI18n();
  const t = dict.account;

  async function logoutAll() {
    setBusy(true);
    setError(null);
    try {
      await adminFetch("/api/admin/auth/logout-all", { method: "POST" });
      window.location.assign(routes.adminLogin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.failed);
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader title={t.title} description={t.description} />
      <div className="grid max-w-3xl gap-6">
        <Panel title={t.sessions}>
          {sessions.error && <ErrorState message={sessions.error} requestId={sessions.errorId} onRetry={sessions.reload} />}
          {sessions.loading && !sessions.data && <LoadingState rows={2} />}
          {sessions.data && sessions.data.length === 0 && <EmptyState title={t.noSessions} />}
          {sessions.data && sessions.data.length > 0 && (
            <ul className="grid gap-3" data-testid="session-list">
              {sessions.data.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-white">
                      {describeAgent(session.user_agent, t)}
                      {session.current && <Badge accent>{t.thisSession}</Badge>}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {fmt(t.sessionTimes, {
                        created: formatDateTime(session.created_at, locale),
                        seen: formatDateTime(session.last_seen_at, locale),
                      })}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">{fmt(t.expires, { date: formatDateTime(session.expires_at, locale) })}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t.security}>
          <div className="grid gap-4 text-sm text-slate-300">
            <p>{t.securityBody}</p>
            {error && <Alert tone="error" role="alert">{error}</Alert>}
            <div>
              <Button variant="dangerOutline" icon="logout" loading={busy} loadingLabel={t.ending} onClick={logoutAll}>
                {t.logoutAll}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
