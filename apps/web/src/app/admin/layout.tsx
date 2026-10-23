import "../globals.css";

import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Администрация", template: "%s | Администрация" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#04070f", colorScheme: "dark" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-dvh bg-ink-950">{children}</body>
    </html>
  );
}
