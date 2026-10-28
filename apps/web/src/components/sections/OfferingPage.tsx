import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ManagedRelation } from "@/components/sections/Catalogue";
import { CtaBand } from "@/components/sections/CtaBand";
import { StatusChip } from "@/components/sections/StatusChip";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, CheckList, Container, Section, SectionHeading } from "@/components/ui/primitives";
import { domainByKey, serviceByKey } from "@/content";
import type { Dictionary } from "@/i18n";
import { type Locale, localizePath } from "@/i18n/config";
import { type CatalogueDetail, type CatalogueRef, formatDuration } from "@/lib/catalogue";
import { domainDefinition, type EngagementModel } from "@/lib/domains";
import { contactWithService, routes } from "@/lib/routes";
import { serviceJsonLd } from "@/lib/seo";

/** Engagement model that describes each catalogue type (texts: dict.domain.engagementModels). */
const TYPE_MODEL: Record<CatalogueDetail["offeringType"], EngagementModel> = {
  service: "implementation",
  assessment: "assessment",
  workshop: "workshop",
};

/** Whether a build in this domain can continue as a managed service (domain engagement models). */
export function hasManagedFollowUp(domainKey: CatalogueDetail["domain"]): boolean {
  return domainKey !== "managed_operations" && domainDefinition(domainKey).engagement.some((e) => e.model === "managed");
}

/**
 * Page of an entry that exists only in the service catalogue (an assessment, a workshop or a service
 * created in the admin). The nine existing services keep their richer TypeScript-content template.
 * Every text comes from the published catalogue entry; nothing is added that the entry does not state.
 */
export function OfferingPage({ entry, locale, dict }: { entry: CatalogueDetail; locale: Locale; dict: Dictionary }) {
  const labels = dict.catalogue;
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.service(entry.slug));
  const domain = domainByKey(locale, entry.domain);
  const domainHref = href(routes.service(domain.slug));
  const contactHref = href(contactWithService(domainDefinition(entry.domain).contactService));
  const model = dict.domain.engagementModels[TYPE_MODEL[entry.offeringType]];
  const paragraphs = entry.body.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean);
  const otherOfferings = [...entry.related.assessments, ...entry.related.workshops];
  const refHref = (ref: CatalogueRef) => href(routes.service(ref.slug));

  return (
    <>
      <JsonLd
        data={serviceJsonLd({ title: entry.name, metaDescription: entry.seo.description, path, type: labels.types[entry.offeringType] }, locale)}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.services, path: href(routes.services) },
          { name: domain.name, path: domainHref },
          { name: entry.shortName ?? entry.name, path },
        ]}
      />

      {/* ------------------------------------------------------------ hero */}
      <div className="relative overflow-hidden border-b border-line-subtle" data-testid="offering-page" data-offering-type={entry.offeringType}>
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative pb-12 pt-10 sm:pb-14 sm:pt-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-accent">{labels.types[entry.offeringType]}</span>
            {entry.deliveryStatus !== "available" && (
              <StatusChip status={entry.deliveryStatus} label={dict.domain.status[entry.deliveryStatus]} />
            )}
          </div>
          <h1 className="t-h1 mt-6 max-w-4xl">{entry.name}</h1>
          <p className="t-lead mt-6 max-w-2xl">{entry.summary}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={contactHref} size="lg" icon="arrowRight">
              {dict.nav.cta}
            </ButtonLink>
            <ButtonLink href={domainHref} size="lg" variant="secondary">
              {domain.name}
            </ButtonLink>
          </div>

          <dl
            aria-label={dict.service.summaryTitle}
            className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle bg-line-subtle md:grid-cols-3"
          >
            <div className="bg-surface-1 p-5">
              <dt className="t-label">{labels.formatTitle}</dt>
              <dd className="mt-2 text-[15px] text-fg-secondary">{labels.types[entry.offeringType]}</dd>
            </div>
            <div className="bg-surface-1 p-5">
              <dt className="t-label">{labels.domainLabel}</dt>
              <dd className="mt-2 text-[15px]">
                <Link href={domainHref} className="link font-semibold">
                  {domain.name}
                </Link>
              </dd>
            </div>
            <div className="bg-surface-1 p-5">
              <dt className="t-label">{entry.duration ? labels.durationLabel : dict.service.firstStepLabel}</dt>
              <dd className="mt-2 text-[15px] text-fg-secondary">
                {entry.duration ? formatDuration(entry.duration, locale) : dict.service.firstStep}
              </dd>
            </div>
          </dl>
        </Container>
      </div>

      {/* ------------------------------------------------------------ body + capabilities */}
      <Section labelledBy={entry.capabilities.length > 0 ? "offering-capabilities-title" : undefined}>
        <div className="max-w-3xl space-y-4 text-[17px] leading-relaxed text-fg-secondary">
          {paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        {entry.capabilities.length > 0 && (
          <>
            <SectionHeading id="offering-capabilities-title" title={labels.capabilitiesTitle} className="mt-14" />
            <ol className="mt-10 grid gap-x-12 md:grid-cols-2">
              {entry.capabilities.map((capability, index) => (
                <li key={capability.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-t border-line-subtle py-6">
                  <span className="font-mono text-sm text-brand" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="t-h3">{capability.title}</h3>
                    <p className="mt-1.5 leading-relaxed text-fg-muted">{capability.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </Section>

      {/* ------------------------------------------------------------ deliverables + format */}
      <Section labelledBy="offering-deliverables-title" alt>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="card p-6 sm:p-8">
            <h2 id="offering-deliverables-title" className="t-h2 text-2xl sm:text-3xl">
              {labels.deliverablesTitle}
            </h2>
            <CheckList items={entry.deliverables} className="mt-6" />
          </div>
          <div className="card card-accent p-6 sm:p-8">
            <h2 className="t-h2 text-2xl sm:text-3xl">{labels.formatTitle}</h2>
            <p className="mt-4 font-semibold text-fg">{model.title}</p>
            <p className="mt-2 leading-relaxed text-fg-muted">{model.description}</p>
            <p className="mt-4 text-sm text-fg-muted">{dict.service.pricingNote}</p>
            <ButtonLink href={contactHref} icon="arrowRight" className="mt-6 w-full sm:w-auto">
              {dict.nav.cta}
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ related entries and managed operation */}
      {(entry.related.services.length > 0 || otherOfferings.length > 0 || hasManagedFollowUp(entry.domain)) && (
        <Section labelledBy={entry.related.services.length > 0 ? "offering-related-title" : undefined}>
          <div className="grid gap-10">
            {entry.related.services.length > 0 && (
              <RefList id="offering-related-title" title={labels.relatedServicesTitle} refs={entry.related.services} hrefFor={refHref} />
            )}
            {otherOfferings.length > 0 && (
              <RefList
                id="offering-other-title"
                title={labels.relatedOfferingsTitle}
                refs={otherOfferings}
                hrefFor={refHref}
                typeLabels={labels.types}
              />
            )}
            {hasManagedFollowUp(entry.domain) && (
              <ManagedRelation href={href(routes.service(serviceByKey(locale, "ai_managed").slug))} labels={labels} />
            )}
          </div>
        </Section>
      )}

      <CtaBand title={labels.ctaTitle} lead={labels.ctaLead} primary={{ href: contactHref, label: dict.nav.cta }} points={dict.cta.points} />
    </>
  );
}

function RefList({
  id,
  title,
  refs,
  hrefFor,
  typeLabels,
}: {
  id: string;
  title: string;
  refs: CatalogueRef[];
  hrefFor: (ref: CatalogueRef) => string;
  typeLabels?: Dictionary["catalogue"]["types"];
}) {
  return (
    <div>
      <h2 id={id} className="t-h2 text-2xl sm:text-3xl">
        {title}
      </h2>
      <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {refs.map((ref) => (
          <li key={ref.key} className="min-w-0">
            <Link
              href={hrefFor(ref)}
              className="card card-interactive flex min-h-14 items-center justify-between gap-3 px-5 py-4 font-semibold text-fg"
            >
              <span className="min-w-0">
                {typeLabels && <span className="t-label mb-1 block text-brand">{typeLabels[ref.offeringType]}</span>}
                {ref.name}
              </span>
              <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-fg-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
