import "../globals.css";

import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";

import { Footer } from "@/components/layout/Footer";
import { StickyQuoteBar } from "@/components/editorial/StickyQuoteBar";
import { Header } from "@/components/layout/Header";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildSlugMap, getContent } from "@/content";
import { localeMeta, localizePath, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { site } from "@/lib/site";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono-face", display: "swap", weight: ["400", "500"] });

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s | ${site.name}` },
  applicationName: site.name,
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#080f19",
  colorScheme: "dark",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const { services } = getContent(locale);
  const href = (path: string) => localizePath(locale, path);

  const navServices = services.map((service) => ({
    href: href(routes.service(service.slug)),
    label: service.shortTitle,
    description: service.summary,
    icon: service.icon,
  }));
  const navItems = [
    { href: href(routes.aiSolutions), label: dict.nav.aiSolutions },
    { href: href(routes.industries), label: dict.nav.industries },
    { href: href(routes.process), label: dict.nav.process },
    { href: href(routes.insights), label: dict.nav.insights },
    { href: href(routes.about), label: dict.nav.about },
  ];

  return (
    <html lang={localeMeta[locale].htmlLang} className={`${inter.variable} ${manrope.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-cyan-300 px-5 py-2.5 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
        >
          {dict.skipToContent}
        </a>
        <Header
          homeHref={href(routes.home)}
          servicesHref={href(routes.services)}
          services={navServices}
          items={navItems}
          cta={{ href: href(routes.contact), label: dict.nav.cta }}
          locale={locale}
          slugs={buildSlugMap()}
          languageLabels={dict.language}
          labels={{
            nav: dict.nav.label,
            openMenu: dict.nav.openMenu,
            closeMenu: dict.nav.closeMenu,
            services: dict.nav.services,
            allServices: dict.common.allServices,
          }}
        />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} dict={dict} services={services} />
        <StickyQuoteBar
          href={href(`${routes.contact}?tip=oferta`)}
          label={dict.quoteBar.label}
          hint={dict.quoteBar.hint}
          dismissLabel={dict.quoteBar.dismiss}
          hiddenOn={[href(routes.contact)]}
        />
        <JsonLd data={[organizationJsonLd(locale), websiteJsonLd(locale)]} />
      </body>
    </html>
  );
}
