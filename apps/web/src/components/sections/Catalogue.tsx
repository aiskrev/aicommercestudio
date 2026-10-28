import Link from "next/link";

import { StatusChip } from "@/components/sections/StatusChip";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, cx } from "@/components/ui/primitives";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { type CatalogueEntry, formatDuration } from "@/lib/catalogue-shared";

type CatalogueLabels = Dictionary["catalogue"];
type StatusLabels = Dictionary["domain"]["status"];

/** One catalogue entry as a card: type, name, summary, status and (for fixed formats) duration. */
export function OfferingCard({
  entry,
  href,
  locale,
  labels,
  statusLabels,
  domainName,
  headingLevel = 3,
}: {
  entry: CatalogueEntry;
  href: string;
  locale: Locale;
  labels: CatalogueLabels;
  statusLabels: StatusLabels;
  domainName?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card card-interactive group relative flex h-full min-w-0 flex-col p-6" data-testid="offering-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-accent">{labels.types[entry.offeringType]}</span>
        {entry.deliveryStatus !== "available" && <StatusChip status={entry.deliveryStatus} label={statusLabels[entry.deliveryStatus]} />}
      </div>
      <Heading className="t-h3 mt-4">
        {/* The stretched link makes the whole card clickable; the heading carries the accessible name. */}
        <Link href={href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
          {entry.shortName ?? entry.name}
        </Link>
      </Heading>
      <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{entry.summary}</p>
      {(domainName || entry.duration) && (
        <dl className="mt-auto grid gap-1 pt-5 text-sm">
          {domainName && (
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-fg-muted">{labels.domainLabel}:</dt>
              <dd className="font-semibold text-fg-secondary">{domainName}</dd>
            </div>
          )}
          {entry.duration && (
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-fg-muted">{labels.durationLabel}:</dt>
              <dd className="font-semibold text-fg-secondary">{formatDuration(entry.duration, locale)}</dd>
            </div>
          )}
        </dl>
      )}
      <Icon name="arrowRight" className={cx("arrow-nudge h-5 w-5 text-fg-subtle group-hover:text-brand", domainName || entry.duration ? "mt-4" : "mt-auto pt-1")} />
    </article>
  );
}

/**
 * Assessments and workshops of a domain (cross-links on hubs and service pages). With none
 * published, a plain statement and a contact path instead of an empty grid or invented offers.
 */
export function CatalogueOfferings({
  id,
  entries,
  hrefFor,
  locale,
  labels,
  statusLabels,
  contactHref,
}: {
  id: string;
  entries: CatalogueEntry[];
  hrefFor: (entry: CatalogueEntry) => string;
  locale: Locale;
  labels: CatalogueLabels;
  statusLabels: StatusLabels;
  contactHref: string;
}) {
  return (
    <div data-testid="catalogue-offerings">
      <h2 id={id} className="t-h2 text-2xl sm:text-3xl">
        {labels.offeringsTitle}
      </h2>
      {entries.length > 0 ? (
        <>
          <p className="mt-3 max-w-2xl leading-relaxed text-fg-muted">{labels.offeringsLead}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <li key={entry.key} className="min-w-0">
                <OfferingCard entry={entry} href={hrefFor(entry)} locale={locale} labels={labels} statusLabels={statusLabels} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="panel mt-6 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between" data-testid="offerings-empty">
          <p className="max-w-2xl leading-relaxed text-fg-muted">{labels.offeringsEmpty}</p>
          <ButtonLink href={contactHref} variant="secondary" icon="arrowRight" className="shrink-0">
            {labels.offeringsEmptyCta}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

/** "After launch" panel that links a build service to the managed operation of what it builds. */
export function ManagedRelation({ href, labels }: { href: string; labels: CatalogueLabels }) {
  return (
    <aside aria-labelledby="managed-relation-title" className="card card-accent flex flex-col gap-4 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between" data-testid="managed-relation">
      <div className="max-w-2xl">
        <h2 id="managed-relation-title" className="t-h3-lg">
          {labels.managedTitle}
        </h2>
        <p className="mt-2 leading-relaxed text-fg-muted">{labels.managedText}</p>
      </div>
      <ButtonLink href={href} variant="secondary" icon="arrowRight" className="shrink-0">
        {labels.managedLink}
      </ButtonLink>
    </aside>
  );
}
