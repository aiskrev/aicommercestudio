import { type NextRequest, NextResponse } from "next/server";

import { decideRoute } from "@/lib/locale-routing";
import { site } from "@/lib/site";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const decision = decideRoute(pathname, request.cookies.has(site.sessionCookieName));

  if (decision.type === "redirect") {
    const target = new URL(decision.location, request.url);
    return NextResponse.redirect(target, decision.location.startsWith("/admin/login") ? 307 : 308);
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
