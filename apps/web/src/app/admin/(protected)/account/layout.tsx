import type { Metadata } from "next";

import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.account };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
