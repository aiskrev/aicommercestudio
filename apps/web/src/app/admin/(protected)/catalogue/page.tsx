import type { Metadata } from "next";

import { CatalogueList } from "@/components/admin/catalogue/CatalogueList";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.catalogue };
}

export default function AdminCataloguePage() {
  return <CatalogueList />;
}
