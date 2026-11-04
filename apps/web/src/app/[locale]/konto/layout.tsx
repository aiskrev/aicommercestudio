import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { customerAccountsEnabled } from "@/lib/account-flag";

/** Rendered per request: the flag is read at runtime, so these pages are never prerendered as live. */
export const dynamic = "force-dynamic";

export default function AccountLayout({ children }: { children: ReactNode }) {
  if (!customerAccountsEnabled()) notFound();
  return children;
}
