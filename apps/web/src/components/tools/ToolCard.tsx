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
  /** What the visitor receives. */
  output?: string;
  cta?: string;
}

export interface ToolCardLabels {
  liveBadge: string;
  upcomingBadge: string;
  audience: string;
  time: string;
  minutes: string;
  output?: string;
  learnMore?: string;
}

/**
 * Tool card for the hub and the homepage. An available tool is one link (named by the title) to the
 * tool, with its CTA. A planned tool is marked "Coming soon": at most it links to its intro page
 * ("Learn more", never a start button), and without `introHref` it has no link at all. The
 * estimated time is shown only when the registry states it.
 */
export function ToolCard({
  tool,
  href,
  introHref,
  minutes,
  labels,
  headingLevel = 3,
}: {
  tool: ToolCardContent;
  /** The tool itself (available tools only). */
  href?: string;
  /** Intro page of a planned tool. */
  introHref?: string;
  minutes?: number;
  labels: ToolCardLabels;
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  const live = Boolean(href);
  const target = href ?? introHref;
  return (
    <article
      className={cx(
        "group relative flex h-full flex-col rounded-[var(--radius-lg)] p-6",
        live ? "card card-interactive card-accent" : "border border-dashed border-line-strong",
        !live && introHref && "transition-colors duration-200 hover:border-fg-subtle",
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
        {target ? (
          <Link href={target} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
            {tool.title}
          </Link>
        ) : (
          tool.title
        )}
      </Heading>
      <p className="mt-2 flex-1 leading-relaxed text-fg-muted">{tool.description}</p>
      <dl className="mt-5 grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="shrink-0 text-fg-subtle">{labels.audience}:</dt>
          <dd className="text-fg-secondary">{tool.audience}</dd>
        </div>
        {tool.output && labels.output && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-fg-subtle">{labels.output}:</dt>
            <dd className="text-fg-secondary">{tool.output}</dd>
          </div>
        )}
        {live && minutes !== undefined && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-fg-subtle">{labels.time}:</dt>
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
      {!live && introHref && labels.learnMore && (
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-secondary" aria-hidden="true">
          {labels.learnMore}
          <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
        </span>
      )}
    </article>
  );
}
