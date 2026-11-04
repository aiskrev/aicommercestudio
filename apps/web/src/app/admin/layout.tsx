import "../globals.css";

import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/lib/fonts";
import { AdminI18nProvider } from "@/components/admin/AdminI18n";
import { localeMeta } from "@/i18n/config";
import { getAdminDictionary, getAdminLocale } from "@/lib/admin-locale";
import { site } from "@/lib/site";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminDictionary();
  return {
    // Absolute URLs for the site-wide Open Graph image (this is a separate root layout).
    metadataBase: new URL(site.url),
    title: { default: t.meta.title, template: `%s | ${t.meta.title}` },
    robots: { index: false, follow: false, nocache: true },
  };
}

export const viewport: Viewport = { themeColor: "#080f19", colorScheme: "dark" };

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getAdminLocale();
  return (
    <html lang={localeMeta[locale].htmlLang} className={fontVariables}>
      <body className="min-h-dvh bg-ink-950">
        <AdminI18nProvider locale={locale}>{children}</AdminI18nProvider>
      </body>
    </html>
  );
}
