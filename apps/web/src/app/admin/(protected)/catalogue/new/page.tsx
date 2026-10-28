import type { Metadata } from "next";

import { CatalogueCreate } from "@/components/admin/catalogue/CatalogueCreate";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).catalogue.newTitle };
}

export default function AdminCatalogueNewPage() {
  return <CatalogueCreate />;
}
