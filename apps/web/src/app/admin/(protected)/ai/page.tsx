import type { Metadata } from "next";

import { AiActions } from "@/components/admin/AiActions";
import { getAdminDictionary } from "@/lib/admin-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAdminDictionary()).meta.ai };
}

export default function AdminAiActionsPage() {
  return <AiActions />;
}
