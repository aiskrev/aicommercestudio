import { type NextRequest, NextResponse } from "next/server";

import { LOCALE_COOKIE } from "@/i18n/config";
import { decideRoute } from "@/lib/locale-routing";
import { site } from "@/lib/site";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const decision = decideRoute(
    pathname,
    request.cookies.has(site.sessionCookieName),
    request.cookies.get(LOCALE_COOKIE)?.value,
    search,
  );

  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url), decision.permanent ? 308 : 307);
  }
  if (decision.type === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals and files with an extension (robots.txt, sitemap.xml, icon.svg …)
  // as well as generated metadata images.
  matcher: ["/((?!api|_next|opengraph-image|.*\\..*).*)"],
};
