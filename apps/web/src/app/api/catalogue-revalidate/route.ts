import { createHash, timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { CATALOGUE_TAG } from "@/lib/catalogue";

/**
 * On-demand regeneration of the catalogue pages (docs/SERVICE_CATALOGUE_ARCHITECTURE.md §9).
 * `POST /api/catalogue-revalidate` with the header `X-Revalidate-Secret: <CATALOGUE_REVALIDATE_SECRET>`
 * marks every cached catalogue fetch stale, so the next request to a hub, a service page, the index
 * or the sitemap renders with the current published catalogue. Without the variable (or with one
 * shorter than 16 characters) the endpoint does not exist (404); pages then refresh every 300 s.
 * This static segment takes precedence over the `/api/[...path]` proxy, so the request never reaches FastAPI.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export async function POST(request: NextRequest) {
  const secret = process.env.CATALOGUE_REVALIDATE_SECRET ?? "";
  if (secret.length < 16) return Response.json({ code: "not_found" }, { status: 404, headers: NO_STORE });
  const given = request.headers.get("x-revalidate-secret") ?? "";
  if (!timingSafeEqual(digest(given), digest(secret))) {
    return Response.json({ code: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  // `expire: 0`: the next request renders fresh data instead of serving the stale page once more.
  revalidateTag(CATALOGUE_TAG, { expire: 0 });
  return Response.json({ revalidated: true }, { headers: NO_STORE });
}
