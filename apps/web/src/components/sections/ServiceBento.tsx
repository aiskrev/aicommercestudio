import Link from "next/link";

import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { Service } from "@/content/types";

/**
 * Column spans (of 12) for an asymmetric editorial grid. Seven services → 7+5 / 4+4+4 / 5+7, so
 * every row is full and two services are featured. Other counts fall back to an even 3-up grid.
 */
function spansFor(count: number): number[] {
  if (count === 7) return [7, 5, 4, 4, 4, 5, 7];
  return Array.from({ length: count }, () => 4);
}

const SPAN_CLASS: Record<number, string> = {
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  7: "lg:col-span-7",
};

export function ServiceBento({
  services,
  hrefFor,
  cta,
  headingLevel = 3,
}: {
  services: Service[];
  hrefFor: (service: Service) => string;
  cta: string;
  headingLevel?: 2 | 3;
}) {
  const spans = spansFor(services.length);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  // Two-column (tablet) layout: featured tiles span both columns; if the remaining tiles are odd,
  // the last one does too, so no row is left half empty.
  const singles = spans.map((span, index) => (span === 7 ? -1 : index)).filter((index) => index >= 0);
  const widenAtSm = singles.length % 2 === 1 ? singles[singles.length - 1] : -1;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
      {services.map((service, index) => {
        const span = spans[index];
        const featured = span === 7;
        return (
          <li key={service.key} className={cx("min-w-0", (featured || index === widenAtSm) && "sm:col-span-2", SPAN_CLASS[span])}>
            <article
              className={cx(
                "card card-interactive group relative flex h-full flex-col overflow-hidden p-6 sm:p-7",
                featured && "card-accent",
              )}
            >
              <div className={cx("flex h-full flex-col", featured && "lg:grid lg:grid-cols-[1fr_auto] lg:gap-8")}>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand transition-colors group-hover:border-brand/50">
                      <Icon name={service.icon} className="h-5 w-5" />
                    </span>
                    {!featured && <ServiceMotif service={service.key} className="h-12 w-[4.5rem] opacity-80" />}
                  </div>
                  <Heading className={cx("mt-5", featured ? "t-h3-lg" : "t-h3")}>
                    {/* The whole tile is clickable via the stretched link; the heading carries the accessible name. */}
                    <Link href={hrefFor(service)} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                      {service.shortTitle}
                    </Link>
                  </Heading>
                  <p className="mt-2 leading-relaxed text-fg-muted">{service.summary}</p>
                  <ul className="mt-5 grid gap-1.5 border-t border-line-subtle pt-4 text-[14.5px] text-fg-secondary">
                    {service.capabilities.slice(0, 3).map((capability) => (
                      <li key={capability.title} className="flex items-start gap-2.5">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
                        {capability.title}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-brand" aria-hidden="true">
                    {cta}
                    <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
                {featured && (
                  <div className="hidden items-center lg:flex">
                    <ServiceMotif service={service.key} className="h-32 w-48" />
                  </div>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
