import Link from "next/link";

import { AdvisorPreview, type Showcase } from "@/components/home/AdvisorPreview";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ButtonLink, cx } from "@/components/ui/primitives";

export interface ToolsCatalog {
  liveBadge: string;
  upcomingBadge: string;
  upcomingNote: string;
  relatedTitle: string;
  relatedLead: string;
  items: { key: string; icon: IconName; category: string; title: string; description: string; cta?: string }[];
}

/** Localized URL per live tool; a tool without an entry is "in preparation" and is never linked. */
export type ToolHrefs = Partial<Record<string, string>>;

/**
 * Interactive tools: the live tool(s) with the Advisor product window, and planned tools labelled
 * "in preparation" (no links, no dates) with a note pointing to what can be used now.
 */
export function ToolsPreview({
  catalog,
  hrefs,
  showcase,
  headingLevel = 3,
}: {
  catalog: ToolsCatalog;
  hrefs: ToolHrefs;
  showcase: Showcase;
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  const live = catalog.items.filter((tool) => hrefs[tool.key]);
  const upcoming = catalog.items.filter((tool) => !hrefs[tool.key]);
  return (
    <div className="grid gap-6">
      {live.map((tool) => (
        <article
          key={tool.key}
          className="tool-frame grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-12 lg:p-10"
        >
          <div className="min-w-0">
            <span className="badge badge-success badge-dot">{catalog.liveBadge}</span>
            <p className="t-label mt-5">{tool.category}</p>
            <Heading className="t-h3-lg mt-2">{tool.title}</Heading>
            <p className="mt-3 leading-relaxed text-fg-muted">{tool.description}</p>
            <ButtonLink href={hrefs[tool.key]!} icon="arrowRight" className="mt-7">
              {tool.cta}
            </ButtonLink>
          </div>
          {tool.key === "advisor" && <AdvisorPreview content={showcase} />}
        </article>
      ))}

      {upcoming.length > 0 && (
        <div className="min-w-0">
          <ul className="grid gap-3 md:grid-cols-3">
            {upcoming.map((tool) => (
              <li key={tool.key}>
                <UpcomingTool tool={tool} badge={catalog.upcomingBadge} heading={Heading} />
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-fg-subtle">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            {catalog.upcomingNote}
          </p>
        </div>
      )}
    </div>
  );
}

/** Compact tools block for service pages: the tools relevant to the service, in the same rules. */
export function RelatedTools({
  catalog,
  hrefs,
  keys,
  id,
}: {
  catalog: ToolsCatalog;
  hrefs: ToolHrefs;
  keys: string[];
  id: string;
}) {
  const items = keys.map((key) => catalog.items.find((tool) => tool.key === key)).filter((tool) => tool !== undefined);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="t-h3-lg">
        {catalog.relatedTitle}
      </h2>
      <p className="mt-2 text-fg-muted">{catalog.relatedLead}</p>
      <ul className={cx("mt-6 grid gap-3", items.length > 1 && "md:grid-cols-2")}>
        {items.map((tool) => {
          const href = hrefs[tool.key];
          return (
            <li key={tool.key}>
              {href ? (
                <article className="card card-interactive card-accent group relative flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <ToolIcon name={tool.icon} live />
                    <span className="badge badge-success badge-dot">{catalog.liveBadge}</span>
                  </div>
                  <h3 className="t-h3 mt-4">
                    <Link href={href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                      {tool.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-fg-muted">{tool.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand" aria-hidden="true">
                    {tool.cta}
                    <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
                  </span>
                </article>
              ) : (
                <UpcomingTool tool={tool} badge={catalog.upcomingBadge} heading="h3" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function UpcomingTool({
  tool,
  badge,
  heading: Heading,
}: {
  tool: ToolsCatalog["items"][number];
  badge: string;
  heading: "h2" | "h3";
}) {
  return (
    <div className="h-full rounded-[var(--radius-lg)] border border-dashed border-line-strong p-5">
      <div className="flex items-start justify-between gap-3">
        <ToolIcon name={tool.icon} />
        <span className="badge badge-outline">{badge}</span>
      </div>
      <Heading className="t-h3 mt-4">{tool.title}</Heading>
      <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{tool.description}</p>
    </div>
  );
}

function ToolIcon({ name, live = false }: { name: IconName; live?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
        live ? "border-brand/45 bg-brand/[0.08] text-brand" : "border-line-default text-fg-muted",
      )}
      aria-hidden="true"
    >
      <Icon name={name} className="h-5 w-5" />
    </span>
  );
}
