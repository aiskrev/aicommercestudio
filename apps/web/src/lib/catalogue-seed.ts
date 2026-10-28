import { domainByKey, getContent, serviceByKey } from "@/content";
import type { ServiceKey } from "@/content/types";
import { locales, type Locale } from "@/i18n/config";
import { BANDS, DOMAINS, domainsInBand, primaryDomainOf } from "@/lib/domains";
import { routes } from "@/lib/routes";

/**
 * Seed snapshot for the API's service catalogue (docs/SERVICE_CATALOGUE_ARCHITECTURE.md, step S1).
 * The TypeScript content stays the source of truth; this function turns it into the language-neutral
 * structure the API seeds from. The snapshot is committed twice (web + API copy) and compared by hash
 * in scripts/test.ps1, like the readiness and AI team vectors.
 */
export const CATALOGUE_SEED_SCHEMA_VERSION = 2;

type PerLocale<T> = Record<Locale, T>;

function perLocale<T>(build: (locale: Locale) => T): PerLocale<T> {
  return Object.fromEntries(locales.map((locale) => [locale, build(locale)])) as PerLocale<T>;
}

function primaryKeyword(locale: Locale, path: string): string | null {
  return getContent(locale).keywordMap.find((entry) => entry.path === path)?.primaryKeyword ?? null;
}

export function catalogueSeedSnapshot() {
  const domains = BANDS.flatMap((band) =>
    domainsInBand(band).map((definition, position) => ({
      key: definition.key,
      code: definition.id,
      band,
      icon: definition.icon,
      position,
      status: definition.published ? ("published" as const) : ("draft" as const),
      contact_service: definition.contactService,
      related: [...definition.related],
      translations: perLocale((locale) => {
        const domain = domainByKey(locale, definition.key);
        return {
          slug: domain.slug,
          name: domain.name,
          summary: domain.summary,
          body: domain.positioning,
          cta_label: domain.cta,
          seo_title: domain.metaTitle,
          seo_description: domain.metaDescription,
          primary_keyword: primaryKeyword(locale, routes.service(domain.slug)),
          deliverables: [...domain.deliverables],
        };
      }),
    })),
  );

  const families = DOMAINS.flatMap((definition) =>
    definition.families.map((family, position) => ({
      key: `${definition.key}.${family.key}`,
      domain: definition.key,
      delivery_status: family.status,
      position,
      status: definition.published ? ("published" as const) : ("draft" as const),
      services: [...(family.services ?? [])],
      via: [...(family.via ?? [])],
      translations: perLocale((locale) => {
        const text = domainByKey(locale, definition.key).families[family.key];
        return { name: text.title, summary: text.capabilities, prerequisite: text.prerequisite ?? null };
      }),
    })),
  );

  // Services in the order of their primary domain, then their position inside it.
  const serviceKeys: ServiceKey[] = DOMAINS.flatMap((definition) => definition.primaryServices);
  const services = serviceKeys.map((key) => {
    const bg = serviceByKey("bg", key);
    const domain = primaryDomainOf(key);
    if (!domain) throw new Error(`Service without a primary domain: ${key}`);
    return {
      key,
      primary_domain: domain.key,
      offering_type: "service" as const,
      delivery_status: "available" as const,
      lead_category: key,
      icon: bg.icon,
      custom_page: Boolean(bg.customPage),
      is_entry_offer: Boolean(bg.isOffering),
      position: domain.primaryServices.indexOf(key),
      status: "published" as const,
      related: [...bg.related],
      translations: perLocale((locale) => {
        const service = serviceByKey(locale, key);
        return {
          slug: service.slug,
          name: service.title,
          short_name: service.shortTitle,
          summary: service.summary,
          body: service.intro,
          seo_title: service.metaTitle,
          seo_description: service.metaDescription,
          primary_keyword: primaryKeyword(locale, routes.service(service.slug)),
          capabilities: service.capabilities.map((capability) => ({ title: capability.title, body: capability.description })),
          deliverables: [...service.deliverables],
        };
      }),
    };
  });

  return { schema_version: CATALOGUE_SEED_SCHEMA_VERSION, locales: [...locales], domains, families, services };
}
