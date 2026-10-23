import type { MetadataRoute } from "next";

import { getContent } from "@/content";
import { localizePath, locales } from "@/i18n/config";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";

const STATIC_PATHS: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: routes.home, priority: 1, changeFrequency: "weekly" },
  { path: routes.services, priority: 0.9, changeFrequency: "monthly" },
  { path: routes.aiSolutions, priority: 0.8, changeFrequency: "monthly" },
  { path: routes.industries, priority: 0.7, changeFrequency: "monthly" },
  { path: routes.process, priority: 0.6, changeFrequency: "monthly" },
  { path: routes.about, priority: 0.6, changeFrequency: "monthly" },
  { path: routes.contact, priority: 0.8, changeFrequency: "yearly" },
  { path: routes.insights, priority: 0.7, changeFrequency: "weekly" },
  { path: routes.privacy, priority: 0.2, changeFrequency: "yearly" },
  { path: routes.cookies, priority: 0.2, changeFrequency: "yearly" },
  { path: routes.terms, priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) => {
    const { services, articles } = getContent(locale);
    return [
      ...STATIC_PATHS.map((entry) => ({
        url: absoluteUrl(localizePath(locale, entry.path)),
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
      })),
      ...services.map((service) => ({
        url: absoluteUrl(localizePath(locale, routes.service(service.slug))),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
      ...articles.map((article) => ({
        url: absoluteUrl(localizePath(locale, routes.article(article.slug))),
        lastModified: article.publishedAt,
        changeFrequency: "yearly" as const,
        priority: 0.5,
      })),
    ];
  });
}
