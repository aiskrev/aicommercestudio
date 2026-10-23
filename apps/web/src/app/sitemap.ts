import type { MetadataRoute } from "next";

import { getContent, isIndexableCategory } from "@/content";
import { localizePath, locales } from "@/i18n/config";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";

/** Date of the last substantive content revision of the static pages. */
export const CONTENT_REVISED = "2026-10-24";

type Freq = "weekly" | "monthly" | "yearly";

const STATIC_PATHS: { path: string; priority: number; changeFrequency: Freq; legal?: boolean }[] = [
  { path: routes.home, priority: 1, changeFrequency: "weekly" },
  { path: routes.services, priority: 0.9, changeFrequency: "monthly" },
  { path: routes.aiSolutions, priority: 0.8, changeFrequency: "monthly" },
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

/** Only indexable URLs are listed: draft legal pages and thin topic pages are `noindex`. */
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
      })),
      ...services.map((service) => ({
        url: url(routes.service(service.slug)),
        lastModified: CONTENT_REVISED,
        changeFrequency: "monthly" as const,
        priority: 0.9,
      })),
      ...articles.map((article) => ({
        url: url(routes.article(article.slug)),
        lastModified: article.updatedAt,
        changeFrequency: "yearly" as const,
        priority: 0.6,
      })),
      ...editorialCategories
        .filter((category) => isIndexableCategory(locale, category.slug))
        .map((category) => ({
          url: url(routes.insightsCategory(category.slug)),
          lastModified: CONTENT_REVISED,
          changeFrequency: "monthly" as const,
          priority: 0.4,
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
