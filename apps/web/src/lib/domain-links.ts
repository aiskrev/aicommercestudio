import { domainByKey } from "@/content";
import { type Locale, localizePath } from "@/i18n/config";
import { DOMAIN_KEYS, type DomainKey, domainDefinition } from "@/lib/domains";
import { routes } from "@/lib/routes";

/** Links to the published domain hubs, keyed by domain (unpublished domains are left out). */
export function domainHubLinks(locale: Locale): Partial<Record<DomainKey, { href: string; label: string }>> {
  return Object.fromEntries(
    DOMAIN_KEYS.filter((key) => domainDefinition(key).published).map((key) => {
      const hub = domainByKey(locale, key);
      return [key, { href: localizePath(locale, routes.service(hub.slug)), label: hub.name }];
    }),
  );
}
