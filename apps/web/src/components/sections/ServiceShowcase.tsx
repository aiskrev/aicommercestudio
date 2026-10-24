import Link from "next/link";

import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { Service, ServiceKey } from "@/content/types";

/** Services presented as the lead proposition; every other service is a core operation. */
const AI_GROUP: ReadonlySet<ServiceKey> = new Set(["ai_tools", "automation", "ai_managed"]);

interface GroupCopy {
  title: string;
  lead: string;
}

/**
 * Curated editorial service layout: AI & automation as large feature panels, core operations as
 * compact rows. Groups are derived from service keys, so adding or removing a service needs no
 * layout change. Each service is an <article> whose heading link covers the whole item.
 */
export function ServiceShowcase({
  services,
  hrefFor,
  cta,
  groups,
  groupHeadingLevel = 3,
}: {
  services: Service[];
  hrefFor: (service: Service) => string;
  cta: string;
  groups: { ai: GroupCopy; core: GroupCopy };
  /** Level of the two group headings; service names are one level below. */
  groupHeadingLevel?: 2 | 3;
}) {
  const ai = services.filter((service) => AI_GROUP.has(service.key));
  const core = services.filter((service) => !AI_GROUP.has(service.key));
  const GroupHeading = groupHeadingLevel === 2 ? "h2" : "h3";
  const Heading = groupHeadingLevel === 2 ? "h3" : "h4";

  return (
    <div className="grid gap-14">
      {ai.length > 0 && (
        <div>
          <GroupLabel heading={GroupHeading} copy={groups.ai} />
          <ul className={cx("mt-6 grid gap-4", ai.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
            {ai.map((service) => (
              <li key={service.key} className="min-w-0">
                <article
                  className={cx(
                    "card card-interactive group relative flex h-full flex-col overflow-hidden",
                    service.key === "ai_managed" && "card-accent",
                  )}
                >
                  <div className="relative flex h-36 items-center justify-center border-b border-line-subtle bg-surface-page/70">
                    <div className="grid-backdrop absolute inset-0 opacity-70" aria-hidden="true" />
                    <ServiceMotif service={service.key} className="relative h-24 w-36" />
                  </div>
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <Heading className="t-h3-lg">
                      <Link href={hrefFor(service)} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                        {service.shortTitle}
                      </Link>
                    </Heading>
                    <p className="mt-2 leading-relaxed text-fg-muted">{service.summary}</p>
                    <ul className="mt-5 grid gap-1.5 text-[14.5px] text-fg-secondary">
                      {service.capabilities.slice(0, 3).map((capability) => (
                        <li key={capability.title} className="flex items-start gap-2.5">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
                          {capability.title}
                        </li>
                      ))}
                    </ul>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-brand" aria-hidden="true">
                      {cta}
                      <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      )}

      {core.length > 0 && (
        <div>
          <GroupLabel heading={GroupHeading} copy={groups.core} />
          <ul className="mt-6 grid border-t border-line-subtle md:grid-cols-2 md:gap-x-10">
            {core.map((service) => (
              <li key={service.key} className="min-w-0 border-b border-line-subtle">
                <article className="focus-frame group relative grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-4 py-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand transition-colors group-hover:border-brand/50">
                    <Icon name={service.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <Heading className="t-h3 transition-colors group-focus-within:text-brand group-hover:text-brand">
                      <Link href={hrefFor(service)} className="after:absolute after:inset-0 focus-visible:outline-none">
                        {service.shortTitle}
                      </Link>
                    </Heading>
                    <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">{service.summary}</p>
                  </div>
                  <Icon name="arrowRight" className="arrow-nudge mt-1 h-5 w-5 text-fg-subtle group-hover:text-brand group-focus-within:text-brand" />
                </article>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GroupLabel({ heading: Tag, copy }: { heading: "h2" | "h3"; copy: GroupCopy }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
      <Tag className="shrink-0 whitespace-nowrap text-[1.0625rem] font-semibold text-fg">{copy.title}</Tag>
      <p className="text-[15px] text-fg-muted">{copy.lead}</p>
    </div>
  );
}
