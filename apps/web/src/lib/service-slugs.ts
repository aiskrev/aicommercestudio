import { domainByKey, findDomain, findService, serviceByKey } from "@/content";
import type { Locale } from "@/i18n/config";
import { isDomainPublished } from "@/lib/domains";

/**
 * This locale's slug of a service or published service hub whose slug in the other language is `slug`, or `null`.
 * Used to redirect a wrong-language service URL (e.g. an old `/uslugi/technical-audit`, which the proxy sends to
 * `/bg/uslugi/technical-audit`) to the right page instead of answering 404 (Search Console, 2026-11-12).
 */
export function slugInThisLocale(locale: Locale, slug: string): string | null {
  // A slug that is valid in this language is never redirected.
  if (findService(locale, slug) || findDomain(locale, slug)) return null;
  const other: Locale = locale === "bg" ? "en" : "bg";
  const service = findService(other, slug);
  if (service && !service.customPage) return serviceByKey(locale, service.key).slug;
  const domain = findDomain(other, slug);
  if (domain && isDomainPublished(domain.key)) return domainByKey(locale, domain.key).slug;
  return null;
}
