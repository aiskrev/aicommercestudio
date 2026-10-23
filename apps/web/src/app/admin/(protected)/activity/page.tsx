"use client";

import { ActivityList } from "@/components/admin/ActivityList";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/admin/ui";
import type { AuditEntry } from "@/lib/admin-types";
import { useAdminData } from "@/lib/use-admin-data";

export default function AdminActivityPage() {
  const { data, error, loading, reload } = useAdminData<AuditEntry[]>("/api/admin/audit?limit=200");
  return (
    <>
      <AdminPageHeader title="Активност" description="Журнал на действията в системата (последните 200 записа)." />
      <Panel>
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data && <LoadingState />}
        {data && data.length === 0 && <EmptyState icon="activity" title="Няма записана активност" />}
        {data && data.length > 0 && <ActivityList entries={data} />}
      </Panel>
    </>
  );
}
