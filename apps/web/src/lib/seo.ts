import type { Metadata } from "next";

import type { FaqItem } from "@/content/types";
import { type Locale, localeMeta, localizePath, locales } from "@/i18n/config";
import { absoluteUrl, site } from "@/lib/site";

/** Canonical route paths of one page per locale (each with that locale's slug). */
export type LocalizedPaths = Record<Locale, string>;

export function samePathEverywhere(path: string): LocalizedPaths {
  return Object.fromEntries(locales.map((locale) => [locale, path])) as LocalizedPaths;
}

interface PageMetaInput {
  locale: Locale;
  title: string;
  description: string;
  /** Canonical route path (same for all locales) or a per-locale map when slugs differ. */
  path: string | LocalizedPaths;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  /** Exclude from search results (still followed for links), e.g. draft legal pages or thin category pages. */
  noindex?: boolean;
  /** Use the title verbatim (homepage) instead of the "%s | brand" template. */
  absoluteTitle?: boolean;
  /** Locales in which the page exists (default: all). Only these get hreflang alternates. */
  availableIn?: readonly Locale[];
}

/**
 * Page metadata with a self-referencing canonical, reciprocal hreflang alternates for every locale the
 * page exists in, and x-default pointing to the Bulgarian (default-locale) version.
 */
export function buildMetadata({
  locale,
  title,
  description,
  path,
  type = "website",
  publishedTime,
  modifiedTime,
  section,
  noindex = false,
  absoluteTitle = false,
  availableIn = locales,
}: PageMetaInput): Metadata {
  const paths = typeof path === "string" ? samePathEverywhere(path) : path;
  const localized = localizePath(locale, paths[locale]);
  const fullTitle = absoluteTitle ? `${title} | ${site.name}` : title;
  const languages: Record<string, string> = {};
  for (const other of availableIn) languages[localeMeta[other].htmlLang] = localizePath(other, paths[other]);
  if (availableIn.includes("bg")) languages["x-default"] = localizePath("bg", paths.bg);

  return {
    title: absoluteTitle ? { absolute: fullTitle } : title,
    description,
    alternates: { canonical: localized, languages },
    openGraph: {
      type,
      url: localized,
      title: fullTitle,
      description,
      siteName: site.name,
      locale: localeMeta[locale].ogLocale,
      alternateLocale: availableIn.filter((other) => other !== locale).map((other) => localeMeta[other].ogLocale),
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      ...(section ? { section } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}

export const organizationId = `${site.url}/#organization`;

/** Organization data limited to verified facts: name, URL and (if configured) contact details. */
export function organizationJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId,
    name: site.name,
    url: site.url,
    areaServed: site.areaServed[locale],
    ...(site.contactEmail ? { email: site.contactEmail } : {}),
    ...(site.contactPhone ? { telephone: site.contactPhone } : {}),
  };
}

export function websiteJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: absoluteUrl(localizePath(locale, "/")),
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

export function serviceJsonLd(
  service: { title: string; metaDescription: string; path: string; type: string },
  locale: Locale,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.metaDescription,
    serviceType: service.type,
    url: absoluteUrl(service.path),
    inLanguage: localeMeta[locale].htmlLang,
    provider: { "@id": organizationId },
    areaServed: site.areaServed[locale],
  };
}

export function itemListJsonLd(name: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function collectionPageJsonLd(page: { name: string; description: string; path: string }, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: page.name,
    description: page.description,
    url: absoluteUrl(page.path),
    inLanguage: localeMeta[locale].htmlLang,
    isPartOf: { "@type": "WebSite", name: site.name, url: absoluteUrl(localizePath(locale, "/")) },
  };
}

export function articleJsonLd(
  article: {
    title: string;
    description: string;
    publishedAt: string;
    updatedAt: string;
    path: string;
    section: string;
    about: string;
  },
  locale: Locale,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    articleSection: article.section,
    about: article.about,
    inLanguage: localeMeta[locale].htmlLang,
    mainEntityOfPage: absoluteUrl(article.path),
    image: absoluteUrl("/opengraph-image"),
    author: { "@id": organizationId },
    publisher: { "@id": organizationId },
  };
}
