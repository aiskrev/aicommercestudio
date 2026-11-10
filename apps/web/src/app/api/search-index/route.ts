import { NextResponse } from "next/server";

import { defaultLocale, isLocale } from "@/i18n/config";
import { buildSearchIndex } from "@/lib/search-index";

/**
 * The site's searchable pages for one language (`?locale=bg|en`), loaded by the search box the first time
 * it opens. Built from the same content as the sitemap; no personal data and nothing from a visitor goes
 * into it. Cached by the browser and the CDN for five minutes.
 */

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = isLocale(requested) ? requested : defaultLocale;
  const entries = await buildSearchIndex(locale);
  return NextResponse.json(
    { locale, entries },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" } },
  );
}
