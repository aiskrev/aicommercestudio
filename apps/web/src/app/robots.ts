import type { MetadataRoute } from "next";

import { absoluteUrl, site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // /cdn-cgi/: Cloudflare's own paths (e-mail obfuscation links); not site pages, nothing to index.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/portal", "/api/", "/bg/konto", "/en/account", "/cdn-cgi/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
