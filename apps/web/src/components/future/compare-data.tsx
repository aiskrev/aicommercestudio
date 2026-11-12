import type { ReactNode } from "react";

import { PriceTag } from "@/components/sections/PriceTag";
import { getContent, serviceByKey } from "@/content";
import type { CompareOptionKey } from "@/content/v5-types";
import { type Locale, localizePath } from "@/i18n/config";
import { SERVICE_PRICES } from "@/lib/prices";
import { quoteWithService, routes } from "@/lib/routes";

/**
 * Server-side data of the service comparison (components/future/ServiceComparison): prices only from the published
 * schedule (lib/prices.ts); `null` = price on request — static, CMS (owner decision D-51). Links go to the hub
 * section or service page and to the quote form preselected with the option's service.
 */
export function compareData(locale: Locale): { prices: Record<CompareOptionKey, ReactNode>; links: Record<CompareOptionKey, { href: string; quote: string }> } {
  const href = (path: string) => localizePath(locale, path);
  const options = getContent(locale).v5.future.compare.options;
  const portals = href(routes.service(serviceByKey(locale, "portals_web_apps").slug));
  const prices: Record<CompareOptionKey, ReactNode> = {
    static: null,
    cms: null,
    interactive: <PriceTag locale={locale} price={SERVICE_PRICES.business_websites} />,
    store: <PriceTag locale={locale} price={SERVICE_PRICES.store_development} />,
    app: <PriceTag locale={locale} price={SERVICE_PRICES.portals_web_apps} />,
  };
  const links = Object.fromEntries(
    options.map((option) => [
      option.key,
      {
        href: option.key === "store" ? href(routes.ecommerce) : option.key === "app" ? portals : `${href(routes.websites)}#${option.key}`,
        quote: href(quoteWithService(option.service)),
      },
    ]),
  ) as Record<CompareOptionKey, { href: string; quote: string }>;
  return { prices, links };
}
