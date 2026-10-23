import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { IconBadge } from "@/components/ui/primitives";
import type { Service } from "@/content/types";

export function ServiceCard({
  service,
  href,
  cta,
  index,
  headingLevel = 3,
  showCapabilities = true,
}: {
  service: Service;
  href: string;
  cta: string;
  index?: number;
  headingLevel?: 2 | 3;
  showCapabilities?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card card-interactive group flex h-full flex-col p-6 sm:p-7">
      <div className="flex items-start justify-between">
        <IconBadge name={service.icon} />
        {index !== undefined && (
          <span className="font-display text-sm font-semibold text-slate-400" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>
      <Heading className="t-h3 mt-5 text-xl">
        {/* The whole card is clickable via the stretched link; the heading carries the accessible name. */}
        <Link href={href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
          {service.shortTitle}
        </Link>
      </Heading>
      <p className="mt-2 leading-relaxed text-slate-400">{service.summary}</p>
      {showCapabilities && (
        <ul className="mt-5 grid flex-1 content-start gap-2 border-t border-white/[0.06] pt-5 text-sm text-slate-300">
          {service.capabilities.slice(0, 3).map((capability) => (
            <li key={capability.title} className="flex gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              {capability.title}
            </li>
          ))}
        </ul>
      )}
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300" aria-hidden="true">
        {cta}
        <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </article>
  );
}
