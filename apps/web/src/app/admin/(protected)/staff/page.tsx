import type { Metadata } from "next";

import { StaffRoles } from "@/components/admin/StaffRoles";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.staff };
}

export default function AdminStaffPage() {
  return <StaffRoles />;
}
