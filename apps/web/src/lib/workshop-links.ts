import { articlesInCategory, getContent } from "@/content";
import { type Locale, localizePath } from "@/i18n/config";
import { topicsForDomains } from "@/lib/insight-topics";
import { routes } from "@/lib/routes";
import { workshop, WORKSHOP_SLUGS, type WorkshopKey, type WorkshopKind } from "@/lib/workshops";
import { priceText, WORKSHOP_PRICES } from "@/lib/prices";

export interface WorkshopLink {
  key: WorkshopKey;
  href: string;
  label: string;
  summary: string;
  kind: WorkshopKind;
  kindLabel: string;
  /** "from" price in the market of the locale (lib/prices.ts). */
  priceFrom: string;
}

/** Card links to workshop pages, in the order given. */
export function workshopLinks(locale: Locale, keys: readonly WorkshopKey[]): WorkshopLink[] {
  const { texts, page } = getContent(locale).workshops;
  return keys.map((key) => {
    const kind = workshop(key).kind;
    return {
      key,
      href: localizePath(locale, routes.workshop(WORKSHOP_SLUGS[key].bg)),
      label: texts[key].title,
      summary: texts[key].summary,
      kind,
      kindLabel: page.kinds[kind],
      priceFrom: priceText(locale, WORKSHOP_PRICES[key]).from,
    };
  });
}

/** Published articles in the topics that share a domain with the workshop (newest first, at most `limit`). */
export function workshopArticles(locale: Locale, key: WorkshopKey, limit = 4) {
  const topics = topicsForDomains(workshop(key).domains);
  const seen = new Set<string>();
  return topics
    .flatMap((topic) => articlesInCategory(locale, topic))
    .filter((article) => (seen.has(article.key) ? false : (seen.add(article.key), true)))
    .slice(0, limit)
    .map((article) => ({ href: localizePath(locale, routes.article(article.slug)), label: article.title }));
}
