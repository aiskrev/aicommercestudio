import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface ToolCardContent {
  key: string;
  icon: IconName;
  category: string;
  title: string;
  description: string;
  audience: string;
  cta?: string;
}

/**
 * Tool card for the hub and the homepage. Available tools are one link (named by the title) with
 * a visible CTA; tools in preparation have no link at all and say so. Estimated time is shown only
 * when the registry states it.
 */
export function ToolCard({
  tool,
  href,
  minutes,
  labels,
  headingLevel = 3,
}: {
  tool: ToolCardContent;
  href?: string;
  minutes?: number;
  labels: { liveBadge: string; upcomingBadge: string; audience: string; time: string; minutes: string };
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  const live = Boolean(href);
  return (
    <article
      className={cx(
        "group relative flex h-full flex-col rounded-[var(--radius-lg)] p-6",
        live ? "card card-interactive card-accent" : "border border-dashed border-line-strong",
      )}
      data-tool={tool.key}
      data-status={live ? "live" : "planned"}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
            live ? "border-brand/45 bg-brand/[0.08] text-brand" : "border-line-default text-fg-muted",
          )}
          aria-hidden="true"
        >
          <Icon name={tool.icon} className="h-5 w-5" />
        </span>
        <span className={cx("badge", live ? "badge-success badge-dot" : "badge-outline")}>
          {live ? labels.liveBadge : labels.upcomingBadge}
        </span>
      </div>
      <p className="t-label mt-5">{tool.category}</p>
      <Heading className="t-h3-lg mt-1.5">
        {live ? (
          <Link href={href!} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
            {tool.title}
          </Link>
        ) : (
          tool.title
        )}
      </Heading>
      <p className="mt-2 flex-1 leading-relaxed text-fg-muted">{tool.description}</p>
      <dl className="mt-5 grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-fg-subtle">{labels.audience}:</dt>
          <dd className="text-fg-secondary">{tool.audience}</dd>
        </div>
        {minutes !== undefined && (
          <div className="flex gap-2">
            <dt className="text-fg-subtle">{labels.time}:</dt>
            <dd className="text-fg-secondary">{labels.minutes.replace("{n}", String(minutes))}</dd>
          </div>
        )}
      </dl>
      {live && tool.cta && (
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand" aria-hidden="true">
          {tool.cta}
          <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
        </span>
      )}
    </article>
  );
}
