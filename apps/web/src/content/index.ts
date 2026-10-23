import { advisor } from "@/content/bg/advisor";
import { articles, insightsPage } from "@/content/bg/articles";
import { editorialCategories, publishableCaseStudies } from "@/content/bg/editorial";
import { home } from "@/content/bg/home";
import {
  cookiePolicy,
  LEGAL_TEXTS_ARE_DRAFTS,
  legalDraftNotice,
  privacyPolicy,
  termsOfUse,
} from "@/content/bg/legal";
import { about, aiSolutions, industries, processPage, servicesPage } from "@/content/bg/pages";
import { keywordMap } from "@/content/bg/seo";
import { coreServices, services } from "@/content/bg/services";
import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";

const bg = {
  home,
  services,
  coreServices,
  servicesPage,
  industries,
  about,
  processPage,
  aiSolutions,
  advisor,
  articles,
  insightsPage,
  editorialCategories,
  caseStudies: publishableCaseStudies(),
  keywordMap,
  legal: { privacyPolicy, cookiePolicy, termsOfUse, draftNotice: legalDraftNotice, isDraft: LEGAL_TEXTS_ARE_DRAFTS },
};

export type SiteContent = typeof bg;

const content: Record<Locale, SiteContent> = { bg };

export function getContent(locale: Locale): SiteContent {
  return content[locale];
}

export function findService(locale: Locale, slug: string) {
  return getContent(locale).services.find((s) => s.slug === slug);
}

export function serviceByKey(locale: Locale, key: ServiceKey) {
  const service = getContent(locale).services.find((s) => s.key === key);
  if (!service) throw new Error(`Unknown service key: ${key}`);
  return service;
}

export function findArticle(locale: Locale, slug: string) {
  return getContent(locale).articles.find((a) => a.slug === slug);
}

export function findCategory(locale: Locale, slug: string) {
  return getContent(locale).editorialCategories.find((c) => c.slug === slug);
}

export function articlesInCategory(locale: Locale, slug: string) {
  return sortedArticles(locale).filter((a) => a.category === slug);
}

/** Newest first (by publication date, then last update). */
export function sortedArticles(locale: Locale) {
  return [...getContent(locale).articles].sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

/** Category pages with fewer articles than this are thin: noindex and kept out of the sitemap. */
export const MIN_ARTICLES_FOR_INDEXED_CATEGORY = 2;

export function isIndexableCategory(locale: Locale, slug: string): boolean {
  return articlesInCategory(locale, slug).length >= MIN_ARTICLES_FOR_INDEXED_CATEGORY;
}
