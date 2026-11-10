import { NextResponse } from "next/server";

import { customerAccountsEnabled } from "@/lib/account-flag";

/**
 * Whether customer accounts are switched on. The public pages are prerendered, so they cannot read the
 * runtime flag themselves; the header and footer ask this endpoint instead (components/layout/AccountEntry.tsx).
 * It only answers true or false and is never cached.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ enabled: customerAccountsEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
