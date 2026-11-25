"use client";

import Link from "next/link";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { prefersReducedMotion, revealGroup } from "@/components/motion/reveal";
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
  const [filter, setFilterState] = useState<Filter>("all");
  const listRef = useRef<HTMLUListElement>(null);
  // FLIP (docs/MOTION_SYSTEM.md → Package filters): the positions of the cards before a change of filter.
  const before = useRef<Map<string, DOMRect> | null>(null);
  const setFilter = (next: Filter) => {
    const list = listRef.current;
    if (list && !prefersReducedMotion() && typeof list.animate === "function") {
      before.current = new Map(Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-flip]"), (el) => [el.dataset.flip!, el.getBoundingClientRect()]));
    }
    setFilterState(next);
  };
  // After the change: cards that stay glide from their old place to the new one (Web Animations, transform only,
  // 420 ms on desktop, 280 ms on phones); cards that appear scale and fade in 40 ms apart. Interrupting a running
  // move measures from where the card is, so a quick second change never jumps.
  useLayoutEffect(() => {
    const list = listRef.current;
    const previous = before.current;
    before.current = null;
    if (!list || !previous) return;
    const duration = window.matchMedia("(max-width: 47.99rem)").matches ? 280 : 420;
    let entering = 0;
    for (const el of list.querySelectorAll<HTMLElement>(":scope > [data-flip]")) {
      for (const running of el.getAnimations()) running.cancel();
      const from = previous.get(el.dataset.flip!);
      const to = el.getBoundingClientRect();
      if (from) {
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        el.animate([{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: "translate3d(0, 0, 0)" }], { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      } else {
        el.animate([{ opacity: 0, transform: "translate3d(0, 12px, 0) scale(0.96)" }, { opacity: 1, transform: "none" }], { duration, delay: 60 + entering * 40, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" });
        entering += 1;
      }
    }
  }, [filter]);
  const visible = cards.filter((card) => filter === "all" || GROUP[card.key] === filter);
  return (
    <Tabs id="package-filter" label={text.filterLabel} items={text.filters.map((item) => ({ value: item.key, label: item.label }))} value={filter} onChange={setFilter} variant="segmented" panelClassName="pt-8">
      <ul ref={listRef} {...revealGroup()} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="home-offers">
        {visible.map((card) => (
          <li key={card.key} data-flip={card.key} className={cx("price-card motion-card", card.featured && "price-card-featured")} data-testid={`home-offer-${card.key}`}>
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
          <li data-flip="care" className="price-card motion-card border-dashed" data-testid="home-offer-care">
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
