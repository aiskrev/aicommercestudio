import "../globals.css";

import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/lib/fonts";
import { localeMeta } from "@/i18n/config";
import { getAdminLocale } from "@/lib/admin-locale";
import { site } from "@/lib/site";


export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Client portal", template: "%s | Client portal" },
  // Never indexed: a private, authenticated area (also disallowed in robots.txt).
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#080f19", colorScheme: "dark" };

/** Separate root layout for the read-only client portal: no site navigation, no staff session. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const locale = await getAdminLocale();
  return (
    <html lang={localeMeta[locale].htmlLang} className={fontVariables}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
