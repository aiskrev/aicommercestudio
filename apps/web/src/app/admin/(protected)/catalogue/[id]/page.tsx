import type { Metadata } from "next";

import { CatalogueEditor } from "@/components/admin/catalogue/CatalogueEditor";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.catalogue };
}

export default async function AdminCatalogueEntryPage({ params }: PageProps<"/admin/catalogue/[id]">) {
  const { id } = await params;
  return <CatalogueEditor id={id} />;
}
