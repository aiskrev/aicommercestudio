import type { Metadata } from "next";

import { RoleLanding } from "@/components/admin/RoleLanding";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.dashboard };
}

export default function AdminDashboardPage() {
  return <RoleLanding />;
}
