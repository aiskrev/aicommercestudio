"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Tabs } from "@/components/ui/Tabs";
import { cx } from "@/components/ui/primitives";
import { ArrowLink, TickList } from "@/components/v5/blocks";
import type { FutureContent } from "@/content/v5-types";
import type { ProjectPackageKey } from "@/lib/project-packages";

type Filter = FutureContent["packages"]["filters"][number]["key"];

const GROUP: Record<ProjectPackageKey, Exclude<Filter, "all">> = {
  landing_page: "websites",
  business_website: "websites",
  store_setup: "stores",
  store_complete: "stores",
  custom_web_app: "custom",
};

export interface PackageCard {
  key: ProjectPackageKey;
  name: string;
  objective: string;
  scope: string;
  payments: string;
  integrations: string;
  delivery: string;
  care: string;
  /** Price block rendered on the server (published band or "price in a written quote"). */
  price: ReactNode;
  featured: boolean;
  href: string;
  quote: string;
  quoteLabel: string;
  moreLabel: string;
}

/**
 * Premium package comparison (Future Commerce §6). The approved packages of lib/project-packages.ts with their
 * published prices (rendered on the server — no pricing logic here), filterable by kind with segmented tabs; the
 * care plans card closes the row. Every card links to its section of the packages page and to the quote form
 * preselected with the package's service.
 */
export function PackageExplorer({
  text,
  cards,
  care,
}: {
  text: FutureContent["packages"];
  cards: PackageCard[];
  care: { title: string; text: string; cta: string; href: string; covers: string[] };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = cards.filter((card) => filter === "all" || GROUP[card.key] === filter);
  return (
    <Tabs id="package-filter" label={text.filterLabel} items={text.filters.map((item) => ({ value: item.key, label: item.label }))} value={filter} onChange={setFilter} variant="segmented" panelClassName="pt-8">
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="home-offers">
        {visible.map((card) => (
          <li key={card.key} className={cx("price-card fc-panel-enter", card.featured && "price-card-featured")} data-testid={`home-offer-${card.key}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="t-h3-lg">{card.name}</h3>
              <span className="badge shrink-0">{card.delivery}</span>
            </div>
            <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">{card.objective}</p>
            <div className="mt-5 border-t border-line-subtle pt-4">{card.price}</div>
            <dl className="spec-list mt-5">
              <div>
                <dt>{text.scopeLabel}</dt>
                <dd>{card.scope}</dd>
              </div>
              <div>
                <dt>{text.paymentsLabel}</dt>
                <dd>{card.payments}</dd>
              </div>
              <div>
                <dt>{text.integrationsLabel}</dt>
                <dd>{card.integrations}</dd>
              </div>
              <div>
                <dt>{text.careLabel}</dt>
                <dd>{card.care}</dd>
              </div>
            </dl>
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 pt-5">
              <Link href={card.quote} className="btn btn-sm btn-primary">
                <span className="btn-label">{card.quoteLabel}</span>
                <Icon name="arrowRight" className="btn-icon h-4 w-4" />
              </Link>
              <ArrowLink href={card.href} label={card.moreLabel} />
            </div>
          </li>
        ))}
        {(filter === "all" || filter === "websites" || filter === "stores") && (
          <li className="price-card fc-panel-enter border-dashed" data-testid="home-offer-care">
            <span className="fc-card-icon h-10 w-10" style={{ ["--fc-tone" as string]: "var(--color-brand-2)" }}>
              <Icon name="wrench" className="h-4.5 w-4.5" />
            </span>
            <h3 className="t-h3-lg mt-4">{care.title}</h3>
            <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">{care.text}</p>
            <TickList items={care.covers} className="mt-5" />
            <div className="mt-auto pt-5">
              <ArrowLink href={care.href} label={care.cta} />
            </div>
          </li>
        )}
      </ul>
    </Tabs>
  );
}
