import { AdvisorPreview, type Showcase } from "@/components/home/AdvisorPreview";
import { ToolCard, type ToolCardContent } from "@/components/tools/ToolCard";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, cx } from "@/components/ui/primitives";

export interface ToolsCatalog {
  liveBadge: string;
  upcomingBadge: string;
  upcomingNote: string;
  relatedTitle: string;
  relatedLead: string;
  labels: { audience: string; time: string; minutes: string };
  items: ToolCardContent[];
}

/** Localized URL per available tool; a tool without an entry is "in preparation" and is never linked. */
export type ToolHrefs = Partial<Record<string, string>>;
/** Estimated minutes per tool (from the registry, only where stated). */
export type ToolMinutes = Partial<Record<string, number>>;

const cardLabels = (catalog: ToolsCatalog) => ({
  liveBadge: catalog.liveBadge,
  upcomingBadge: catalog.upcomingBadge,
  ...catalog.labels,
});

/**
 * Homepage tools preview: the Advisor with its product window (the recommended first tool), then
 * the other tools as cards (available ones linked, the rest labelled "in preparation"). `limit`
 * caps the secondary cards.
 */
export function ToolsPreview({
  catalog,
  hrefs,
  minutes,
  showcase,
  limit = 3,
  startBadge,
}: {
  catalog: ToolsCatalog;
  hrefs: ToolHrefs;
  minutes: ToolMinutes;
  showcase: Showcase;
  limit?: number;
  /** Marks the Advisor as the recommended first tool ("Start here"). */
  startBadge?: string;
}) {
  const advisor = catalog.items.find((tool) => tool.key === "advisor");
  const others = catalog.items
    .filter((tool) => tool.key !== "advisor")
    .sort((a, b) => Number(Boolean(hrefs[b.key])) - Number(Boolean(hrefs[a.key])))
    .slice(0, limit);
  const advisorHref = advisor ? hrefs[advisor.key] : undefined;
  return (
    <div className="grid gap-6">
      {advisor && advisorHref && (
        <article className="tool-frame grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-12 lg:p-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {startBadge && (
                <span className="badge badge-accent" data-testid="tool-start-here">
                  {startBadge}
                </span>
              )}
              <span className="badge badge-success badge-dot">{catalog.liveBadge}</span>
            </div>
            <p className="t-label mt-5">{advisor.category}</p>
            <h3 className="t-h3-lg mt-2">{advisor.title}</h3>
            <p className="mt-3 leading-relaxed text-fg-muted">{advisor.description}</p>
            <ButtonLink href={advisorHref} icon="arrowRight" className="mt-7">
              {advisor.cta}
            </ButtonLink>
          </div>
          <AdvisorPreview content={showcase} />
        </article>
      )}
      {others.length > 0 && (
        <div className="min-w-0">
          <ul className="grid gap-4 md:grid-cols-3">
            {others.map((tool) => (
              <li key={tool.key}>
                <ToolCard tool={tool} href={hrefs[tool.key]} minutes={minutes[tool.key]} labels={cardLabels(catalog)} />
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

/** Tools block for service pages: the tools relevant to the service, as tool cards. */
export function RelatedTools({
  catalog,
  hrefs,
  minutes,
  keys,
  id,
}: {
  catalog: ToolsCatalog;
  hrefs: ToolHrefs;
  minutes: ToolMinutes;
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
      <ul className={cx("mt-6 grid gap-4", items.length > 1 && "md:grid-cols-2", items.length > 2 && "lg:grid-cols-3")}>
        {items.map((tool) => (
          <li key={tool.key}>
            <ToolCard tool={tool} href={hrefs[tool.key]} minutes={minutes[tool.key]} labels={cardLabels(catalog)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
