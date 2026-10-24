import { advisor } from "@/content/bg/advisor";
import { aiManaged } from "@/content/bg/ai-managed";
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
import { about, aiSolutions, industries, processPage, servicesPage, toolsPage } from "@/content/bg/pages";
import { keywordMap } from "@/content/bg/seo";
import { coreServices, services } from "@/content/bg/services";
import { tools } from "@/content/bg/tools";
import { advisor as enAdvisor } from "@/content/en/advisor";
import { aiManaged as enAiManaged } from "@/content/en/ai-managed";
import { articles as enArticles, insightsPage as enInsightsPage } from "@/content/en/articles";
import { editorialCategories as enEditorialCategories } from "@/content/en/editorial";
import { home as enHome } from "@/content/en/home";
import {
  cookiePolicy as enCookiePolicy,
  legalDraftNotice as enLegalDraftNotice,
  privacyPolicy as enPrivacyPolicy,
  termsOfUse as enTermsOfUse,
} from "@/content/en/legal";
import {
  about as enAbout,
  aiSolutions as enAiSolutions,
  industries as enIndustries,
  processPage as enProcessPage,
  servicesPage as enServicesPage,
  toolsPage as enToolsPage,
} from "@/content/en/pages";
import { keywordMap as enKeywordMap } from "@/content/en/seo";
import { coreServices as enCoreServices, services as enServices } from "@/content/en/services";
import { tools as enTools } from "@/content/en/tools";
import type { ServiceKey } from "@/content/types";
import type { Locale, SlugMap } from "@/i18n/config";
import { routes } from "@/lib/routes";
import type { LocalizedPaths } from "@/lib/seo";

const bg = {
  home,
  services,
  coreServices,
  servicesPage,
  industries,
  about,
  processPage,
  aiSolutions,
  aiManaged,
  advisor,
  tools,
  toolsPage,
  articles,
  insightsPage,
  editorialCategories,
  caseStudies: publishableCaseStudies(),
  keywordMap,
  legal: { privacyPolicy, cookiePolicy, termsOfUse, draftNotice: legalDraftNotice, isDraft: LEGAL_TEXTS_ARE_DRAFTS },
};

export type SiteContent = typeof bg;

/** English content. Typed as `SiteContent`, so a missing section or field fails `tsc`. */
const en: SiteContent = {
  home: enHome,
  services: enServices,
  coreServices: enCoreServices,
  servicesPage: enServicesPage,
  industries: enIndustries,
  about: enAbout,
  processPage: enProcessPage,
  aiSolutions: enAiSolutions,
  aiManaged: enAiManaged,
  advisor: enAdvisor,
  tools: enTools,
  toolsPage: enToolsPage,
  articles: enArticles,
  insightsPage: enInsightsPage,
  editorialCategories: enEditorialCategories,
  // Case studies are only published once real and approved — none exist in either language.
  caseStudies: publishableCaseStudies(),
  keywordMap: enKeywordMap,
  legal: {
    privacyPolicy: enPrivacyPolicy,
    cookiePolicy: enCookiePolicy,
    termsOfUse: enTermsOfUse,
    draftNotice: enLegalDraftNotice,
    isDraft: LEGAL_TEXTS_ARE_DRAFTS,
  },
};

const content: Record<Locale, SiteContent> = { bg, en };

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

/** Article by its URL slug in this locale (routing). */
export function findArticle(locale: Locale, slug: string) {
  return getContent(locale).articles.find((a) => a.slug === slug);
}

/** Article by its stable cross-locale key (references between content items). */
export function articleByKey(locale: Locale, key: string) {
  return getContent(locale).articles.find((a) => a.key === key);
}

/** Topic by its URL slug in this locale (routing). */
export function findCategory(locale: Locale, slug: string) {
  return getContent(locale).editorialCategories.find((c) => c.slug === slug);
}

/** Topic by its stable cross-locale key (as stored in `article.category`). */
export function categoryByKey(locale: Locale, key: string) {
  return getContent(locale).editorialCategories.find((c) => c.key === key);
}

export function articlesInCategory(locale: Locale, categoryKey: string) {
  return sortedArticles(locale).filter((a) => a.category === categoryKey);
}

/** Newest first (by publication date, then last update). */
export function sortedArticles(locale: Locale) {
  return [...getContent(locale).articles].sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

/** Category pages with fewer articles than this are thin: noindex and kept out of the sitemap. */
export const MIN_ARTICLES_FOR_INDEXED_CATEGORY = 2;

export function isIndexableCategory(locale: Locale, categoryKey: string): boolean {
  return articlesInCategory(locale, categoryKey).length >= MIN_ARTICLES_FOR_INDEXED_CATEGORY;
}

/** Slug of the same page in another locale, or null when it does not exist there. */
export function translatedServiceSlug(from: Locale, to: Locale, slug: string): string | null {
  const service = findService(from, slug);
  return service ? serviceByKey(to, service.key).slug : null;
}

/** bg slug → en slug tables for the language switcher (built from the content of both locales). */
export function buildSlugMap(): SlugMap {
  const map: SlugMap = { services: {}, articles: {}, topics: {} };
  for (const service of getContent("bg").services) map.services[service.slug] = serviceByKey("en", service.key).slug;
  for (const article of getContent("bg").articles) {
    const translated = articleByKey("en", article.key);
    if (translated) map.articles[article.slug] = translated.slug;
  }
  for (const topic of getContent("bg").editorialCategories) {
    const translated = categoryByKey("en", topic.key);
    if (translated) map.topics[topic.slug] = translated.slug;
  }
  return map;
}

/** Per-locale canonical route paths of a service page (hreflang alternates). */
export function serviceRoutePaths(key: ServiceKey): LocalizedPaths {
  return { bg: routes.service(serviceByKey("bg", key).slug), en: routes.service(serviceByKey("en", key).slug) };
}

/** Per-locale canonical route paths of an article, for the locales in which it exists. */
export function articleRoutePaths(key: string): { paths: LocalizedPaths; availableIn: Locale[] } {
  const bg = articleByKey("bg", key);
  const en = articleByKey("en", key);
  return {
    paths: { bg: routes.article(bg?.slug ?? key), en: routes.article(en?.slug ?? key) },
    availableIn: [...(bg ? (["bg"] as const) : []), ...(en ? (["en"] as const) : [])],
  };
}

/** Per-locale canonical route paths of a topic page. */
export function topicRoutePaths(key: string): LocalizedPaths {
  return {
    bg: routes.insightsCategory(categoryByKey("bg", key)?.slug ?? key),
    en: routes.insightsCategory(categoryByKey("en", key)?.slug ?? key),
  };
}
