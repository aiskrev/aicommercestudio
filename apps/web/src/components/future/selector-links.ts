import type { SelectorLinks } from "@/components/future/ServiceSelector";
import { getContent, serviceByKey } from "@/content";
import type { ServiceKey } from "@/content/types";
import { type Locale, localizePath } from "@/i18n/config";
import type { CarePlanKey } from "@/lib/care-plans";
import { PROJECT_PACKAGES } from "@/lib/project-packages";
import { quoteWithService, routes } from "@/lib/routes";

/** Every service the selector can name (lib/service-selector.ts). */
const SELECTOR_SERVICES: ServiceKey[] = [
  "business_websites",
  "store_development",
  "portals_web_apps",
  "automation",
  "ai_agents",
  "payments_subscriptions",
  "integrations",
  "maintenance",
  "seo",
];

/** Localized, server-built links for the selector: only pages that exist with the default flags. */
export function buildSelectorLinks(locale: Locale): SelectorLinks {
  const href = (path: string) => localizePath(locale, path);
  const { projectPackages, carePlans } = getContent(locale);
  const services: SelectorLinks["services"] = {};
  for (const key of SELECTOR_SERVICES) {
    const service = serviceByKey(locale, key);
    // The two V5 hubs are the better landing page for websites and stores.
    const page = key === "business_websites" ? routes.websites : key === "store_development" ? routes.ecommerce : routes.service(service.slug);
    services[key] = { title: service.shortTitle, href: href(page), quote: href(quoteWithService(key)) };
  }
  const packages = Object.fromEntries(
    PROJECT_PACKAGES.map((item) => [item.key, { name: projectPackages.packages[item.key].name, href: `${href(routes.projectPackages)}#${item.key}` }]),
  ) as SelectorLinks["packages"];
  const care = Object.fromEntries(
    (Object.keys(carePlans.plans) as CarePlanKey[]).map((key) => [key, { name: carePlans.plans[key].name, href: href(routes.carePlans) }]),
  ) as SelectorLinks["carePlans"];
  return { services, packages, carePlans: care, careSeparate: projectPackages.labels.careSeparate };
}
