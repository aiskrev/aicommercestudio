import Link from "next/link";

import { PriceTag } from "@/components/sections/PriceTag";
import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { ButtonLink, IconBadge } from "@/components/ui/primitives";
import type { IconName } from "@/components/ui/Icon";
import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";
import type { PriceItem } from "@/lib/prices";

export interface EntryPoint {
  key: ServiceKey;
  icon: IconName;
  title: string;
  text: string;
  detailsHref: string;
  quoteHref: string;
  price: PriceItem;
}

/**
 * The five commercial entry points of the homepage. Each card links to its service page (scope) and to the
 * quote form pre-set for that service. Prices are the existing indicative bands from lib/prices.ts and are
 * labelled as such; nothing here is a checkout amount. Server component, no client JavaScript.
 */
export function ProjectEntryPoints({
  locale,
  items,
  labels,
}: {
  locale: Locale;
  items: EntryPoint[];
  labels: { details: string; quote: string; priceNote: string };
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="project-entry-points">
      {items.map((item) => (
        <li key={item.key} className="card flex min-w-0 flex-col p-5 sm:p-6" data-testid={`entry-${item.key}`}>
          <div className="flex items-start justify-between gap-4">
            <IconBadge name={item.icon} />
            <ServiceMotif service={item.key} className="h-10 w-16 shrink-0 opacity-80" />
          </div>
          <h3 className="t-h3 mt-4">
            <Link href={item.detailsHref} className="transition-colors hover:text-brand">
              {item.title}
            </Link>
          </h3>
          <p className="mt-2 flex-1 text-body-sm leading-relaxed text-fg-muted">{item.text}</p>
          <div className="mt-4 border-t border-line-subtle pt-4">
            <PriceTag locale={locale} price={item.price} />
            <p className="mt-1 text-xs text-fg-subtle">{labels.priceNote}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href={item.quoteHref} size="sm">
              {labels.quote}
            </ButtonLink>
            <ButtonLink href={item.detailsHref} size="sm" variant="ghost" icon="arrowRight">
              {labels.details}
            </ButtonLink>
          </div>
        </li>
      ))}
    </ul>
  );
}
