import { Suspense } from "react";

import { ProjectsAdmin } from "@/components/admin/ProjectsAdmin";

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsAdmin />
    </Suspense>
  );
}
