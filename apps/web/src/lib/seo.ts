import type { Metadata } from "next";

import type { FaqItem } from "@/content/types";
import { type Locale, localeMeta, localizePath } from "@/i18n/config";
import { absoluteUrl, site } from "@/lib/site";

interface PageMetaInput {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  publishedTime?: string;
  /** Use the title verbatim (homepage) instead of the "%s | brand" template. */
  absoluteTitle?: boolean;
}

export function buildMetadata({
  locale,
  title,
  description,
  path,
  type = "website",
  publishedTime,
  absoluteTitle = false,
}: PageMetaInput): Metadata {
  const localized = localizePath(locale, path);
  const fullTitle = absoluteTitle ? `${title} | ${site.name}` : title;
  return {
    title: absoluteTitle ? { absolute: fullTitle } : title,
    description,
    alternates: {
      canonical: localized,
      languages: { [localeMeta[locale].htmlLang]: localized, "x-default": localizePath("bg", path) },
    },
    openGraph: {
      type,
      url: localized,
      title: fullTitle,
      description,
      siteName: site.name,
      locale: localeMeta[locale].ogLocale,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}

export const organizationId = `${site.url}/#organization`;

/** Organization data limited to verified facts: name, URL and (if configured) contact details. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId,
    name: site.name,
    url: site.url,
    areaServed: site.areaServed,
    ...(site.contactEmail ? { email: site.contactEmail } : {}),
    ...(site.contactPhone ? { telephone: site.contactPhone } : {}),
  };
}

export function websiteJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    inLanguage: localeMeta[locale].htmlLang,
    publisher: { "@id": organizationId },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function serviceJsonLd(service: { title: string; metaDescription: string; path: string; type: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.metaDescription,
    serviceType: service.type,
    url: absoluteUrl(service.path),
    provider: { "@id": organizationId },
    areaServed: site.areaServed,
  };
}
