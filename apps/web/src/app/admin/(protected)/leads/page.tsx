import type { Metadata } from "next";
import { Suspense } from "react";

import { LeadsTable } from "@/components/admin/LeadsTable";
import { LoadingState } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Запитвания" };

export default function AdminLeadsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LeadsTable />
    </Suspense>
  );
}
