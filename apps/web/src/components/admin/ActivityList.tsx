import Link from "next/link";

import { actionLabel, statusLabels } from "@/lib/admin-labels";
import type { AuditEntry, LeadStatus } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";

function describe(entry: AuditEntry): string | null {
  const d = entry.details;
  if (entry.action === "lead.status_changed" && typeof d.from === "string" && typeof d.to === "string") {
    return `${statusLabels[d.from as LeadStatus] ?? d.from} → ${statusLabels[d.to as LeadStatus] ?? d.to}`;
  }
  if (entry.action === "lead.deleted" && typeof d.reason === "string") return `Причина: ${d.reason}`;
  if (entry.action === "ai.lead_triage" && typeof d.suggested_service === "string") {
    return `Предложение: ${d.suggested_service} (${d.provider})`;
  }
  return null;
}

export function ActivityList({ entries, linkLeads = true }: { entries: AuditEntry[]; linkLeads?: boolean }) {
  return (
    <ol className="grid gap-1" data-testid="activity-list">
      {entries.map((entry) => {
        const detail = describe(entry);
        const linkable = linkLeads && entry.entity_type === "lead" && entry.entity_id && entry.action !== "lead.deleted";
        return (
          <li key={entry.id} className="grid gap-1 rounded-lg px-2 py-2.5 text-sm sm:grid-cols-[10rem_1fr] sm:gap-4">
            <time dateTime={entry.created_at} className="text-xs text-slate-500 sm:text-sm">
              {formatDateTime(entry.created_at)}
            </time>
            <div className="min-w-0">
              <p className="text-white">
                {linkable ? (
                  <Link href={routes.adminLead(entry.entity_id!)} className="hover:text-cyan-200">
                    {actionLabel(entry.action)}
                  </Link>
                ) : (
                  actionLabel(entry.action)
                )}
                <span className="text-slate-500"> · {entry.actor_label}</span>
              </p>
              {detail && <p className="mt-0.5 truncate text-xs text-slate-400">{detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
