"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAdminRole } from "@/components/admin/AdminRole";
import { Dashboard } from "@/components/admin/Dashboard";
import { LoadingState } from "@/components/admin/ui";
import { routes } from "@/lib/routes";

/** The dashboard for administrators; editors and viewers only have the catalogue, so they go there. */
export function RoleLanding() {
  const role = useAdminRole();
  const router = useRouter();
  useEffect(() => {
    if (role !== "admin") router.replace(routes.adminCatalogue);
  }, [role, router]);
  return role === "admin" ? <Dashboard /> : <LoadingState />;
}
