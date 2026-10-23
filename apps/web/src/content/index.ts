import { articles, insightsPage } from "@/content/bg/articles";
import { home } from "@/content/bg/home";
import { cookiePolicy, legalDraftNotice, privacyPolicy, termsOfUse } from "@/content/bg/legal";
import { about, aiSolutions, industries, processPage, servicesPage } from "@/content/bg/pages";
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
  articles,
  insightsPage,
  legal: { privacyPolicy, cookiePolicy, termsOfUse, draftNotice: legalDraftNotice },
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
