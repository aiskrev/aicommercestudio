"use client";

import { useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel, Pill } from "@/components/admin/ui";
import { Alert, buttonClass } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import type { StaffMember, StaffRole } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { useAdminData } from "@/lib/use-admin-data";

const ROLES: StaffRole[] = ["admin", "editor", "viewer"];

/** Administrators change staff roles here; the API enforces who may do it and revokes sessions. */
export function StaffRoles() {
  const { t: dict, locale } = useAdminI18n();
  const t = dict.staff;
  const staff = useAdminData<StaffMember[]>("/api/admin/staff");
  const [roles, setRoles] = useState<Record<string, StaffRole>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function save(member: StaffMember) {
    setBusy(member.id);
    setNotice(null);
    try {
      const updated = await adminFetch<StaffMember>(`/api/admin/staff/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: roles[member.id] ?? member.role }),
      });
      staff.replace((staff.data ?? []).map((m) => (m.id === updated.id ? updated : m)));
      setRoles((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== member.id)));
      setNotice({ tone: "success", text: fmt(t.saved, { name: updated.full_name }) });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof ApiError ? error.message : dict.common.saveError });
    } finally {
      setBusy(null);
    }
  }

  const header = <AdminPageHeader title={t.title} description={t.description} />;
  if (staff.error) return <>{header}<ErrorState message={staff.error} requestId={staff.errorId} onRetry={staff.reload} /></>;
  if (!staff.data) return <>{header}<LoadingState rows={4} /></>;

  return (
    <>
      {header}
      <Alert tone="info" role="note" className="mb-6">
        {t.roleHelp}
      </Alert>
      {notice && (
        <Alert tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"} className="mb-6">
          {notice.text}
        </Alert>
      )}
      <Panel>
        {staff.data.length === 0 ? (
          <EmptyState icon="users" title={t.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm" data-testid="staff-table">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t.columns.name}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t.columns.role}</th>
                  <th scope="col" className="py-2 font-medium">{t.columns.lastLogin}</th>
                </tr>
              </thead>
              <tbody>
                {staff.data.map((member) => {
                  const selected = roles[member.id] ?? member.role;
                  const id = `role-${member.id}`;
                  return (
                    <tr key={member.id} className="border-t border-white/[0.06]">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-white">{member.full_name}</span>{" "}
                        {member.is_self && <Pill tone="bg-sky-400/10 text-sky-200 ring-sky-400/30">{t.you}</Pill>}{" "}
                        {!member.is_active && <Pill tone="bg-white/[0.04] text-slate-400 ring-white/10">{t.inactive}</Pill>}
                        <span className="block text-xs text-slate-400">{member.email}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor={id} className="sr-only">
                            {`${t.columns.role}: ${member.email}`}
                          </label>
                          <select
                            id={id}
                            className="field max-w-[12rem]"
                            value={selected}
                            disabled={member.is_self}
                            onChange={(e) => setRoles((current) => ({ ...current, [member.id]: e.target.value as StaffRole }))}
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {t.roles[role]}
                              </option>
                            ))}
                          </select>
                          {member.is_self ? (
                            <span className="text-xs text-slate-400">{t.ownRole}</span>
                          ) : (
                            <button
                              type="button"
                              className={buttonClass("secondary", "sm")}
                              disabled={busy !== null || selected === member.role}
                              onClick={() => save(member)}
                            >
                              {t.save}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-slate-400">
                        {member.last_login_at ? formatDateTime(member.last_login_at, locale) : t.never}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
