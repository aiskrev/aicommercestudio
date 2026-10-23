import type { Metadata } from "next";

import { AiActions } from "@/components/admin/AiActions";

export const metadata: Metadata = { title: "AI одобрения" };

export default function AdminAiActionsPage() {
  return <AiActions />;
}
