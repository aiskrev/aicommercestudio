import Link from "next/link";

import { RelatedTools } from "@/components/home/ToolsPreview";
import { CtaBand } from "@/components/sections/CtaBand";
import { Icon } from "@/components/ui/Icon";
import { EditorialSplit } from "@/components/ui/patterns";
import {
  ButtonLink,
  CheckList,
  Container,
  cx,
  Eyebrow,
  IconBadge,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import { domainByKey, getContent, serviceByKey } from "@/content";
import type { DomainContent } from "@/content/types";
import type { Dictionary } from "@/i18n";
import { type Locale, localizePath } from "@/i18n/config";
import { type DeliveryStatus, type DomainDefinition, type DomainKey, domainStatus, isDomainPublished } from "@/lib/domains";
import { contactWithService, routes } from "@/lib/routes";
import { isToolAvailable, toolByKey, toolHrefs, toolMinutes } from "@/lib/tools";

const STATUS_BADGE: Record<DeliveryStatus, string> = {
  available: "badge-success",
  custom: "",
  planned: "badge-warning",
};

/** Delivery status chip; the label carries the meaning, the colour only repeats it. */
export function StatusChip({ status, label, className }: { status: DeliveryStatus; label: string; className?: string }) {
  return <span className={cx("badge badge-dot", STATUS_BADGE[status], className)}>{label}</span>;
}

/**
 * Domain hub (docs/CONTENT_STRATEGY_BG_EN.md §5.1): what the domain covers, which families are
 * available today, what the client keeps, how we engage, prerequisites and limitations, and where it
 * leads next. Existing service pages are linked from their family; nothing here states prices or outcomes.
 */
export function DomainHub({
  locale,
  domain,
  definition,
  dict,
}: {
  locale: Locale;
  domain: DomainContent;
  definition: DomainDefinition;
  dict: Dictionary;
}) {
  const labels = dict.domain;
  const { tools } = getContent(locale);
  const href = (path: string) => localizePath(locale, path);
  const serviceHref = (key: Parameters<typeof serviceByKey>[1]) => href(routes.service(serviceByKey(locale, key).slug));
  const domainLink = (key: DomainKey) => {
    const target = domainByKey(locale, key);
    return { key, name: target.name, href: href(routes.service(target.slug)) };
  };
  const status = domainStatus(definition.key);
  const contactHref = href(contactWithService(definition.contactService));
  const related = definition.related.filter(isDomainPublished).map((key) => ({ ...domainLink(key), summary: domainByKey(locale, key).summary }));
  const liveTools = definition.tools.filter((key) => isToolAvailable(toolByKey(key)));

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid gap-12 pb-14 pt-10 sm:pb-16 sm:pt-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:pb-20">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <IconBadge name={definition.icon} />
              <Eyebrow>
                {labels.eyebrow} {definition.id} · {labels.bands[definition.band].title}
              </Eyebrow>
            </div>
            <h1 className="t-h1 mt-6">{domain.name}</h1>
            <p className="t-lead mt-6 max-w-2xl">{domain.positioning}</p>
            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <span>{labels.statusLabel}:</span>
              <StatusChip status={status} label={labels.status[status]} />
              <span className="basis-full sm:basis-auto">{labels.statusHint[status]}</span>
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={contactHref} size="lg" icon="arrowRight" className="whitespace-normal text-center">
                {domain.cta}
              </ButtonLink>
              <ButtonLink href={href(routes.services)} size="lg" variant="secondary">
                {dict.common.allServices}
              </ButtonLink>
            </div>
          </div>
          <div className="panel p-6 sm:p-8" aria-labelledby="domain-who-title">
            <h2 id="domain-who-title" className="t-h3-lg">
              {labels.whoTitle}
            </h2>
            <CheckList items={domain.idealCustomers} className="mt-5" />
          </div>
        </Container>
      </div>

      {/* ------------------------------------------------------------ problems */}
      <Section labelledBy="domain-problems-title">
        <EditorialSplit aside={<SectionHeading id="domain-problems-title" eyebrow={domain.name} title={labels.problemsTitle} />}>
          <ul className="border-t border-line-subtle">
            {domain.problems.map((problem) => (
              <li key={problem} className="flex items-start gap-4 border-b border-line-subtle py-5">
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="text-[17px] leading-relaxed text-fg-secondary">{problem}</p>
              </li>
            ))}
          </ul>
        </EditorialSplit>
      </Section>

      {/* ------------------------------------------------------------ service families */}
      <Section labelledBy="domain-families-title" tone="raised">
        <SectionHeading id="domain-families-title" eyebrow={domain.name} title={labels.familiesTitle} lead={labels.familiesLead} />
        <ul className="mt-12 grid gap-4 md:grid-cols-2">
          {definition.families.map((family) => {
            const text = domain.families[family.key];
            const services = family.services ?? [];
            const via = (family.via ?? []).filter(isDomainPublished).map(domainLink);
            return (
              <li key={family.key} className="card flex min-w-0 flex-col p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="t-h3 min-w-0">{text.title}</h3>
                  <StatusChip status={family.status} label={labels.status[family.status]} className="shrink-0" />
                </div>
                <p className="mt-2 leading-relaxed text-fg-muted">{text.capabilities}</p>
                {family.status === "planned" && text.prerequisite && (
                  <p className="mt-3 text-sm text-fg-muted">
                    <span className="font-semibold text-fg-secondary">{labels.prerequisiteLabel}:</span> {text.prerequisite}
                  </p>
                )}
                {(services.length > 0 || via.length > 0) && (
                  <ul className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-5 text-sm">
                    {services.map((key) => (
                      <li key={key}>
                        <Link href={serviceHref(key)} className="link inline-flex min-h-6 items-center gap-1.5 font-semibold">
                          {serviceByKey(locale, key).shortTitle}
                          <Icon name="arrowRight" className="h-3.5 w-3.5" />
                        </Link>
                      </li>
                    ))}
                    {via.map((target) => (
                      <li key={target.key} className="text-fg-muted">
                        {labels.viaLabel}{" "}
                        <Link href={target.href} className="link font-semibold">
                          {target.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ deliverables + engagement */}
      <Section labelledBy="domain-deliverables-title">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="card p-6 sm:p-8">
            <h2 id="domain-deliverables-title" className="t-h2 text-2xl sm:text-3xl">
              {labels.deliverablesTitle}
            </h2>
            <CheckList items={domain.deliverables} className="mt-6" />
          </div>
          <div className="card card-accent p-6 sm:p-8">
            <h2 className="t-h2 text-2xl sm:text-3xl">{labels.engagementTitle}</h2>
            <ul className="mt-6 grid gap-3">
              {definition.engagement.map(({ model, via }) => {
                const targets = (via ?? []).filter(isDomainPublished).map(domainLink);
                return (
                  <li key={model} className="rounded-[var(--radius-md)] border border-line-subtle bg-surface-page px-4 py-3.5">
                    <p className="flex items-center gap-3 font-semibold text-fg">
                      <Icon name="layers" className="h-5 w-5 shrink-0 text-brand" />
                      {labels.engagementModels[model].title}
                    </p>
                    <p className="mt-1 pl-8 text-[15px] leading-relaxed text-fg-muted">
                      {targets.length > 0 ? (
                        <>
                          {labels.viaLabel}{" "}
                          {targets.map((target, index) => (
                            <span key={target.key}>
                              {index > 0 && ", "}
                              <Link href={target.href} className="link">
                                {target.name}
                              </Link>
                            </span>
                          ))}
                        </>
                      ) : (
                        labels.engagementModels[model].description
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-fg-muted">{dict.service.pricingNote}</p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ prerequisites + limitations */}
      <Section labelledBy="domain-prerequisites-title" tone="raised">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 id="domain-prerequisites-title" className="t-h3-lg">
              {labels.prerequisitesTitle}
            </h2>
            <CheckList items={domain.prerequisites} className="mt-5" />
          </div>
          <div>
            <h2 className="t-h3-lg">{labels.limitationsTitle}</h2>
            <ul className="mt-5 grid gap-3">
              {domain.limitations.map((limitation) => (
                <li key={limitation} className="flex items-start gap-3">
                  <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-fg-subtle" />
                  <span className="leading-relaxed text-fg-secondary">{limitation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ related domains + tools */}
      <Section labelledBy="domain-related-title">
        <h2 id="domain-related-title" className="t-h2 text-2xl sm:text-3xl">
          {labels.relatedTitle}
        </h2>
        <ul className={cx("mt-8 grid gap-4 md:grid-cols-2", related.length > 2 && "lg:grid-cols-4")}>
          {related.map((target) => (
            <li key={target.key} className="min-w-0">
              <article className="card card-interactive group relative flex h-full flex-col p-6">
                <h3 className="t-h3">
                  <Link href={target.href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                    {target.name}
                  </Link>
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{target.summary}</p>
                <Icon name="arrowRight" className="arrow-nudge mt-auto h-5 w-5 pt-1 text-fg-subtle group-hover:text-brand" />
              </article>
            </li>
          ))}
        </ul>
        {liveTools.length > 0 && (
          <div className="mt-14 border-t border-line-subtle pt-12">
            <RelatedTools catalog={tools} hrefs={toolHrefs(locale)} minutes={toolMinutes()} keys={liveTools} id="domain-tools-title" />
          </div>
        )}
      </Section>

      <CtaBand
        title={domain.cta}
        lead={labels.ctaLead}
        primary={{ href: contactHref, label: dict.nav.cta }}
        points={dict.cta.points}
      />
    </>
  );
}
