"use client";

import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/admin/ui";
import { Alert, Badge, Button } from "@/components/ui/primitives";
import { adminFetch, ApiError } from "@/lib/admin-api";
import type { AdminSessionInfo } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useAdminData } from "@/lib/use-admin-data";

function describeAgent(agent: string | null): string {
  if (!agent) return "Неизвестно устройство";
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Браузър";
  const os = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

export default function AdminAccountPage() {
  const sessions = useAdminData<AdminSessionInfo[]>("/api/admin/auth/sessions");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logoutAll() {
    setBusy(true);
    setError(null);
    try {
      await adminFetch("/api/admin/auth/logout-all", { method: "POST" });
      window.location.assign(routes.adminLogin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Действието не можа да бъде изпълнено.");
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader title="Акаунт и сесии" description="Активни входове в администрацията с вашия акаунт." />
      <div className="grid max-w-3xl gap-6">
        <Panel title="Активни сесии">
          {sessions.error && <ErrorState message={sessions.error} requestId={sessions.errorId} onRetry={sessions.reload} />}
          {sessions.loading && !sessions.data && <LoadingState rows={2} />}
          {sessions.data && sessions.data.length === 0 && <EmptyState title="Няма активни сесии" />}
          {sessions.data && sessions.data.length > 0 && (
            <ul className="grid gap-3" data-testid="session-list">
              {sessions.data.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-white">
                      {describeAgent(session.user_agent)}
                      {session.current && <Badge accent>Тази сесия</Badge>}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Вход: {formatDateTime(session.created_at)} · Последна активност: {formatDateTime(session.last_seen_at)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">Изтича: {formatDateTime(session.expires_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Сигурност">
          <div className="grid gap-4 text-sm text-slate-300">
            <p>
              Ако подозирате, че друг човек има достъп до акаунта ви, излезте от всички устройства. Всички сесии,
              включително текущата, ще бъдат прекратени и действието ще бъде записано в журнала.
            </p>
            {error && <Alert tone="error" role="alert">{error}</Alert>}
            <div>
              <Button variant="dangerOutline" icon="logout" loading={busy} loadingLabel="Прекратяване…" onClick={logoutAll}>
                Изход от всички устройства
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
