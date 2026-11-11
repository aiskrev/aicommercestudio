import { NextResponse } from "next/server";

import { projectConfiguratorEnabled } from "@/lib/configurator-flag";

/**
 * Whether the project configurator is switched on. Prerendered pages cannot read the runtime flag themselves, so
 * their entry link asks this endpoint (components/configurator/ConfiguratorEntry.tsx). It only answers true or
 * false and is never cached.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ enabled: projectConfiguratorEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
