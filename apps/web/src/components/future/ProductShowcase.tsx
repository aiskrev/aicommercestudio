"use client";

import Link from "next/link";
import { useState } from "react";

import { ShowcaseMock } from "@/components/future/ShowcaseMock";
import { Icon } from "@/components/ui/Icon";
import { Tabs } from "@/components/ui/Tabs";
import { ArrowLink, TickList } from "@/components/v5/blocks";
import type { ShowcaseItem, ShowcaseKey } from "@/content/v5-types";

/**
 * Tabbed product showcase (Future Commerce §3): a corporate site, an interactive site, a storefront and a SaaS
 * dashboard. WAI-ARIA tabs (components/ui/Tabs); each panel pairs a large mock-up (sample data, captioned) with
 * what is behind it and a link to the page that describes it. The store tab also links the three platforms.
 */
export function ProductShowcase({
  items,
  label,
  caption,
  hrefs,
  platforms,
  platformsLabel,
}: {
  items: ShowcaseItem[];
  label: string;
  caption: string;
  hrefs: Record<ShowcaseKey, string>;
  /** Platform links shown under the store tab (Shopify, WooCommerce, custom). */
  platforms: { id: string; title: string; href: string }[];
  platformsLabel: string;
}) {
  const [value, setValue] = useState<ShowcaseKey>(items[0].key);
  const item = items.find((entry) => entry.key === value) ?? items[0];
  return (
    <div data-testid="product-showcase">
      <Tabs
        id="product-showcase"
        label={label}
        items={items.map((entry) => ({ value: entry.key, label: entry.label }))}
        value={value}
        onChange={setValue}
        variant="segmented"
        panelClassName="pt-8"
      >
        <div key={item.key} className="fc-panel-enter grid items-center gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-12" data-testid={`showcase-panel-${item.key}`}>
          <figure className="min-w-0">
            <ShowcaseMock item={item} />
            <figcaption className="t-label mt-3">{caption}</figcaption>
          </figure>
          <div className="min-w-0">
            <span className="fc-card-icon">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            <h3 className="t-h3-lg mt-5">{item.title}</h3>
            <p className="mt-3 leading-relaxed text-fg-muted">{item.text}</p>
            <TickList items={item.points} className="mt-5" />
            {item.key === "store" && (
              <div className="mt-6">
                <p className="t-label">{platformsLabel}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {platforms.map((platform) => (
                    <li key={platform.id}>
                      <Link href={platform.href} className="badge badge-accent min-h-9 hover:border-brand">
                        {platform.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ArrowLink href={hrefs[item.key]} label={item.link} className="mt-5" testId={`showcase-more-${item.key}`} />
          </div>
        </div>
      </Tabs>
    </div>
  );
}
