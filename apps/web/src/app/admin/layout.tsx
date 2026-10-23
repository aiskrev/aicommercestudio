import "../globals.css";

import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";

import { AdminI18nProvider } from "@/components/admin/AdminI18n";
import { localeMeta } from "@/i18n/config";
import { getAdminDictionary, getAdminLocale } from "@/lib/admin-locale";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminDictionary();
  return {
    title: { default: t.meta.title, template: `%s | ${t.meta.title}` },
    robots: { index: false, follow: false, nocache: true },
  };
}

export const viewport: Viewport = { themeColor: "#04070f", colorScheme: "dark" };

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getAdminLocale();
  return (
    <html lang={localeMeta[locale].htmlLang} className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-dvh bg-ink-950">
        <AdminI18nProvider locale={locale}>{children}</AdminI18nProvider>
      </body>
    </html>
  );
}
