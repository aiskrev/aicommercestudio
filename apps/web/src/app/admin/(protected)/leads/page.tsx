import type { Metadata } from "next";
import { Suspense } from "react";

import { LeadsTable } from "@/components/admin/LeadsTable";
import { LoadingState } from "@/components/admin/ui";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.leads };
}

export default function AdminLeadsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LeadsTable />
    </Suspense>
  );
}
