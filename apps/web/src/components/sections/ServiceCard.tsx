import Link from "next/link";

import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { Service } from "@/content/types";

/** Compact service tile used for related-service lists (the main directories use ServiceShowcase). */
export function ServiceCard({
  service,
  href,
  cta,
  headingLevel = 3,
  showCapabilities = true,
}: {
  service: Service;
  href: string;
  cta: string;
  headingLevel?: 2 | 3;
  showCapabilities?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card card-interactive group relative flex h-full flex-col p-6">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand">
          <Icon name={service.icon} className="h-5 w-5" />
        </span>
        <ServiceMotif service={service.key} className="h-10 w-16 opacity-70" />
      </div>
      <Heading className="t-h3 mt-5">
        {/* The whole card is clickable via the stretched link; the heading carries the accessible name. */}
        <Link href={href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
          {service.shortTitle}
        </Link>
      </Heading>
      <p className="mt-2 leading-relaxed text-fg-muted">{service.summary}</p>
      {showCapabilities && (
        <ul className={cx("mt-5 grid gap-1.5 border-t border-line-subtle pt-4 text-[14.5px] text-fg-secondary")}>
          {service.capabilities.slice(0, 3).map((capability) => (
            <li key={capability.title} className="flex items-start gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
              {capability.title}
            </li>
          ))}
        </ul>
      )}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-brand" aria-hidden="true">
        {cta}
        <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
      </span>
    </article>
  );
}
