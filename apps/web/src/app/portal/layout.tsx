import "../globals.css";

import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";

import { localeMeta } from "@/i18n/config";
import { getAdminLocale } from "@/lib/admin-locale";
import { site } from "@/lib/site";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

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
    <html lang={localeMeta[locale].htmlLang} className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
