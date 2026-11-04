import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { advisorWorkspaceEnabled } from "@/lib/account-flag";

export default function AdvisorWorkspaceLayout({ children }: { children: ReactNode }) {
  if (!advisorWorkspaceEnabled()) notFound();
  return children;
}
