import type { MetadataRoute } from "next";

import { articleRoutePaths, getContent, isIndexableCategory, serviceRoutePaths, topicRoutePaths } from "@/content";
import { type Locale, localeMeta, localizePath, locales } from "@/i18n/config";
import { routes } from "@/lib/routes";
import { type LocalizedPaths, samePathEverywhere } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

/** Date of the last substantive content revision of the static pages. */
export const CONTENT_REVISED = "2026-10-25";

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
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) => {
    const { services, articles, editorialCategories, caseStudies, legal } = getContent(locale);
    const url = (path: string) => absoluteUrl(localizePath(locale, path));
    return [
      ...STATIC_PATHS.filter((entry) => !(entry.legal && legal.isDraft)).map((entry) => ({
        url: url(entry.path),
        lastModified: CONTENT_REVISED,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: alternates(samePathEverywhere(entry.path)),
      })),
      ...services.map((service) => ({
        url: url(routes.service(service.slug)),
        lastModified: CONTENT_REVISED,
        changeFrequency: "monthly" as const,
        priority: 0.9,
        alternates: alternates(serviceRoutePaths(service.key)),
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
