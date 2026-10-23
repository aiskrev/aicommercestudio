import type { Metadata } from "next";

import { Dashboard } from "@/components/admin/Dashboard";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.dashboard };
}

export default function AdminDashboardPage() {
  return <Dashboard />;
}
