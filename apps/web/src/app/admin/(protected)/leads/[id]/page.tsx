import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadDetail } from "@/components/admin/LeadDetail";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.lead };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminLeadPage({ params }: PageProps<"/admin/leads/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  return <LeadDetail id={id} />;
}
