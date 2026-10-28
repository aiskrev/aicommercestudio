import type { MetadataRoute } from "next";

import {
  articleRoutePaths,
  domainRoutePaths,
  getContent,
  isIndexableCategory,
  serviceRoutePaths,
  topicRoutePaths,
} from "@/content";
import { type Locale, localeMeta, localizePath, locales } from "@/i18n/config";
import { AGENT_KEYS } from "@/lib/ai-team";
import { AGENT_SLUGS } from "@/lib/agent-library";
import { getCatalogue } from "@/lib/catalogue";
import { isDomainPublished } from "@/lib/domains";
import { routes } from "@/lib/routes";
import { isToolAvailable, toolByKey, TOOLS } from "@/lib/tools";
import { type LocalizedPaths, samePathEverywhere } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

/** Regenerated like the catalogue pages, so published catalogue-only entries are listed (lib/catalogue.ts). */
export const revalidate = 300;

/** Date of the last substantive content revision of the static pages. */
export const CONTENT_REVISED = "2026-10-27";

type Freq = "weekly" | "monthly" | "yearly";

const STATIC_PATHS: { path: string; priority: number; changeFrequency: Freq; legal?: boolean }[] = [
  { path: routes.home, priority: 1, changeFrequency: "weekly" },
  { path: routes.services, priority: 0.9, changeFrequency: "monthly" },
  { path: routes.aiSolutions, priority: 0.8, changeFrequency: "monthly" },
  { path: routes.tools, priority: 0.7, changeFrequency: "monthly" },
  { path: routes.advisor, priority: 0.8, changeFrequency: "monthly" },
  { path: routes.industries, priority: 0.6, changeFrequency: "monthly" },
  { path: routes.process, priority: 0.5, changeFrequency: "monthly" },
  { path: routes.about, priority: 0.5, changeFrequency: "monthly" },
  { path: routes.founder, priority: 0.5, changeFrequency: "monthly" },
  { path: routes.contact, priority: 0.8, changeFrequency: "yearly" },
  { path: routes.insights, priority: 0.7, changeFrequency: "weekly" },
  { path: routes.privacy, priority: 0.2, changeFrequency: "yearly", legal: true },
  { path: routes.cookies, priority: 0.2, changeFrequency: "yearly", legal: true },
  { path: routes.terms, priority: 0.2, changeFrequency: "yearly", legal: true },
];

function alternates(paths: LocalizedPaths, availableIn: readonly Locale[] = locales) {
  return {
    languages: Object.fromEntries(
      availableIn.map((locale) => [localeMeta[locale].htmlLang, absoluteUrl(localizePath(locale, paths[locale]))]),
    ),
  };
}

/**
 * Only real, indexable URLs are listed — one entry per locale, each with reciprocal hreflang
 * alternates. Draft legal pages and thin topic pages are `noindex` and therefore omitted.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogueOnly = Object.fromEntries(
    await Promise.all(
      locales.map(async (locale) => [locale, (await getCatalogue(locale)).entries.filter((entry) => entry.origin === "catalogue")] as const),
    ),
  );
  return locales.flatMap((locale) => {
    const { services, domains, articles, editorialCategories, caseStudies, legal } = getContent(locale);
    const url = (path: string) => absoluteUrl(localizePath(locale, path));
    return [
      ...STATIC_PATHS.filter((entry) => !(entry.legal && legal.isDraft)).map((entry) => ({
        url: url(entry.path),
        lastModified: CONTENT_REVISED,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: alternates(samePathEverywhere(entry.path)),
      })),
      // Tool pages under /instrumenti that are available (implemented + flag on).
      ...TOOLS.filter(isToolAvailable)
        .filter((tool) => tool.path.startsWith(`${routes.tools}/`))
        .map((tool) => ({
          url: url(tool.path),
          lastModified: CONTENT_REVISED,
          changeFrequency: "monthly" as const,
          priority: 0.7,
          alternates: alternates(samePathEverywhere(tool.path)),
        })),
      // Agent library: index and one static page per agent role.
      ...(isToolAvailable(toolByKey("agents"))
        ? [routes.agentLibrary, ...AGENT_KEYS.map((key) => routes.agent(AGENT_SLUGS[key].bg))].map((path) => ({
            url: url(path),
            lastModified: CONTENT_REVISED,
            changeFrequency: "monthly" as const,
            priority: path === routes.agentLibrary ? 0.7 : 0.6,
            alternates: alternates(samePathEverywhere(path)),
          }))
        : []),
      ...services.map((service) => ({
        url: url(routes.service(service.slug)),
        lastModified: CONTENT_REVISED,
        changeFrequency: "monthly" as const,
        priority: 0.9,
        alternates: alternates(serviceRoutePaths(service.key)),
      })),
      // Domain hubs share the /uslugi namespace; only published hubs are listed.
      ...domains
        .filter((domain) => isDomainPublished(domain.key))
        .map((domain) => ({
          url: url(routes.service(domain.slug)),
          lastModified: CONTENT_REVISED,
          changeFrequency: "monthly" as const,
          priority: 0.8,
          alternates: alternates(domainRoutePaths(domain.key)),
        })),
      // Assessments, workshops and services that exist only in the published catalogue.
      ...catalogueOnly[locale].map((entry) => ({
        url: url(routes.service(entry.slug)),
        changeFrequency: "monthly" as const,
        priority: 0.7,
        alternates: alternates({ bg: routes.service(entry.alternateSlugs.bg), en: routes.service(entry.alternateSlugs.en) }),
      })),
      ...articles.map((article) => {
        const { paths, availableIn } = articleRoutePaths(article.key);
        return {
          url: url(routes.article(article.slug)),
          lastModified: article.updatedAt,
          changeFrequency: "yearly" as const,
          priority: 0.6,
          alternates: alternates(paths, availableIn),
        };
      }),
      ...editorialCategories
        .filter((category) => isIndexableCategory(locale, category.key))
        .map((category) => ({
          url: url(routes.insightsCategory(category.slug)),
          lastModified: CONTENT_REVISED,
          changeFrequency: "monthly" as const,
          priority: 0.4,
          alternates: alternates(topicRoutePaths(category.key)),
        })),
      ...caseStudies.map((study) => ({
        url: url(routes.caseStudy(study.slug)),
        lastModified: study.publishedAt,
        changeFrequency: "yearly" as const,
        priority: 0.7,
      })),
    ];
  });
}
