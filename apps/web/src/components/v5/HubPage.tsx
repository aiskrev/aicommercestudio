import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { PriceTag } from "@/components/sections/PriceTag";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { EditorialSplit } from "@/components/ui/patterns";
import { ButtonLink, Container, Eyebrow, Section, SectionHeading, cx } from "@/components/ui/primitives";
import { ArrowLink, CompareTable, JumpNav, Timeline, TickList } from "@/components/v5/blocks";
import { ShowcaseMock } from "@/components/future/ShowcaseMock";
import { getContent, serviceByKey } from "@/content";
import type { HubContent } from "@/content/v5-types";
import { type Locale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { SERVICE_PRICES } from "@/lib/prices";
import { PROJECT_PACKAGES, packagePrice } from "@/lib/project-packages";
import { quoteWithService, routes } from "@/lib/routes";
import { faqJsonLd, serviceJsonLd } from "@/lib/seo";

/**
 * Service hub of the V5 redesign (docs/V5_FINAL_IMPLEMENTATION_REPORT.md): one page per visitor intent ("I need a
 * website", "I need an online store") that presents the kinds of offer as sections of the same page — no thin
 * doorway pages — and links to the existing service pages, packages and quote form. Prices come only from
 * lib/prices.ts and lib/project-packages.ts; an offer without an approved price says "price on request".
 */
export function HubPage({ locale, hub, path, primaryService }: { locale: Locale; hub: HubContent; path: string; primaryService: Parameters<typeof quoteWithService>[0] }) {
  const href = (target: string) => localizePath(locale, target);
  const dict = getDictionary(locale);
  const { projectPackages, v5 } = getContent(locale);
  const url = href(path);
  const secondaryAnchor = hub.costs ? "costs" : "compare";
  const jump = [
    ...hub.offers.map((offer) => ({ id: offer.id, label: offer.name })),
    { id: "compare", label: hub.compare.title },
    ...(hub.costs ? [{ id: "costs", label: hub.costs.title }] : []),
    { id: "packages", label: hub.packages.title },
    { id: "faq", label: hub.faq.title },
  ];
  // Hero mock-up: the storefront for the e-commerce hub (it has the costs table), the corporate site otherwise.
  const heroMock = v5.future.showcase.items.find((item) => item.key === (hub.costs ? "store" : "corporate"))!;

  return (
    <>
      <JsonLd data={[serviceJsonLd({ title: hub.title, metaDescription: hub.metaDescription, path: url, type: hub.breadcrumb }, locale), faqJsonLd(hub.faq.items)]} />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: hub.breadcrumb, path: url },
        ]}
      />

      {/* ------------------------------------------------------------ hero */}
      <div className="relative isolate overflow-hidden border-b border-line-subtle">
        <div className="fc-backdrop" aria-hidden="true">
          <div className="fc-grid" />
        </div>
        <Container className="relative grid items-center gap-12 pb-14 pt-10 sm:pt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pb-20">
          <div className="min-w-0">
            <Eyebrow>{hub.eyebrow}</Eyebrow>
            <h1 className="t-hero mt-6">{hub.title}</h1>
            <p className="t-lead mt-6 max-w-2xl">{hub.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={href(quoteWithService(primaryService))} size="lg" icon="arrowRight" testId="hub-quote">
                {hub.primaryCta}
              </ButtonLink>
              <ButtonLink href={`#${secondaryAnchor}`} size="lg" variant="secondary">
                {hub.secondaryCta}
              </ButtonLink>
            </div>
          </div>
          <figure className="fc-enter min-w-0 lg:pl-6" data-testid="hub-preview">
            <ShowcaseMock item={heroMock} />
            <figcaption className="t-label mt-3">{hub.previewCaption}</figcaption>
          </figure>
        </Container>
        <Container className="relative pb-10">
          <JumpNav label={hub.jumpLabel} items={jump} />
        </Container>
      </div>

      {/* ------------------------------------------------------------ offers, one section each */}
      <Section labelledBy="offers-title" tone="light">
        <SectionHeading id="offers-title" eyebrow={hub.eyebrow} title={hub.offersTitle} lead={hub.offersLead} />
        <div className="mt-stack grid gap-6">
          {hub.offers.map((offer, index) => {
            const service = serviceByKey(locale, offer.service);
            return (
              <section
                key={offer.id}
                id={offer.id}
                aria-labelledby={`${offer.id}-title`}
                className={cx("card grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12", index === 0 && "card-accent")}
                data-testid={`offer-${offer.id}`}
              >
                <div className="min-w-0">
                  <span className="t-index">{String(index + 1).padStart(2, "0")}</span>
                  <h3 id={`${offer.id}-title`} className="t-h3-lg mt-2">
                    {offer.name}
                  </h3>
                  <p className="mt-3 text-lead-sm leading-relaxed text-fg-secondary">{offer.value}</p>
                  <dl className="spec-list mt-6">
                    <div>
                      <dt>{hub.labels.audience}</dt>
                      <dd>{offer.audience}</dd>
                    </div>
                    <div>
                      <dt>{hub.labels.price}</dt>
                      <dd data-testid={`offer-price-${offer.id}`}>
                        {offer.price === "service" ? (
                          <>
                            <PriceTag locale={locale} price={SERVICE_PRICES[offer.service]} />
                            <span className="mt-1 block text-xs text-fg-subtle">{hub.labels.priceNote}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-display text-lg font-semibold text-fg">{hub.labels.priceOnRequest}</span>
                            <span className="mt-1 block text-xs text-fg-subtle">{hub.labels.priceOnRequestNote}</span>
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <ButtonLink href={href(quoteWithService(offer.service))} icon="arrowRight">
                      {hub.labels.quote}
                    </ButtonLink>
                    <ArrowLink href={href(routes.service(service.slug))} label={`${hub.labels.service}: ${service.shortTitle}`} />
                  </div>
                </div>
                <div className="grid min-w-0 content-start gap-6">
                  <div>
                    <h4 className="t-label">{hub.labels.deliverables}</h4>
                    <TickList items={offer.deliverables} className="mt-3" />
                  </div>
                  <div>
                    <h4 className="t-label">{hub.labels.exclusions}</h4>
                    <TickList items={offer.exclusions} tone="muted" className="mt-3" />
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-line-subtle bg-surface-page p-4">
                    <h4 className="t-label">{hub.labels.approach}</h4>
                    <p className="mt-2 text-body-sm leading-relaxed text-fg-secondary">{offer.approach}</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </Section>

      {/* ------------------------------------------------------------ comparison */}
      <Section labelledBy="compare-title" tone="raised">
        <div id="compare">
          <SectionHeading id="compare-title" title={hub.compare.title} lead={hub.compare.lead} />
          <div className="mt-stack">
            <CompareTable
              caption={hub.compare.caption}
              corner={hub.compare.corner}
              columns={hub.compare.columns}
              rows={hub.compare.rows}
              highlight={hub.compare.highlight}
              testId="hub-compare"
            />
          </div>
        </div>
      </Section>

      {hub.costs && (
        <Section labelledBy="costs-title">
          <div id="costs">
            <SectionHeading id="costs-title" title={hub.costs.title} lead={hub.costs.lead} />
            <div className="mt-stack">
              <CompareTable caption={hub.costs.caption} corner={hub.costs.corner} columns={hub.costs.columns} rows={hub.costs.rows} testId="hub-costs" />
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {hub.costs.sources.map((source) => (
                <li key={source.href}>
                  <a href={source.href} className="link inline-flex items-center gap-1.5 font-medium" rel="noopener noreferrer" target="_blank">
                    {source.label}
                    <Icon name="arrowRight" className="h-3.5 w-3.5 -rotate-45" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------ packages with published prices */}
      <Section labelledBy="packages-title" tone={hub.costs ? "raised" : "default"}>
        <div id="packages">
          <SectionHeading
            id="packages-title"
            title={hub.packages.title}
            lead={hub.packages.lead}
            action={
              <ButtonLink href={href(routes.projectPackages)} variant="secondary" icon="arrowRight">
                {hub.packages.cta}
              </ButtonLink>
            }
          />
          <ul className="mt-stack grid gap-5 md:grid-cols-2">
            {hub.packages.keys.map((key) => {
              const definition = PROJECT_PACKAGES.find((item) => item.key === key)!;
              const text = projectPackages.packages[key];
              const price = packagePrice(definition);
              return (
                <li key={key} className={cx("price-card", price && "price-card-featured")} data-testid={`hub-package-${key}`}>
                  <h3 className="t-h3">{text.name}</h3>
                  <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">{text.audience}</p>
                  <div className="mt-5 border-t border-line-subtle pt-5">
                    {price ? (
                      <PriceTag locale={locale} price={price} />
                    ) : (
                      <p className="font-display text-lg font-semibold text-fg">{projectPackages.labels.priceOnQuote}</p>
                    )}
                    <p className="mt-1 text-xs text-fg-subtle">{price ? projectPackages.labels.priceNote : projectPackages.labels.priceOnQuoteNote}</p>
                  </div>
                  <TickList items={text.includes.slice(0, 4)} className="mt-5" />
                  <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-6">
                    <ButtonLink href={href(quoteWithService(definition.service))} size="sm" icon="arrowRight">
                      {projectPackages.labels.quote}
                    </ButtonLink>
                    <Link href={`${href(routes.projectPackages)}#${key}`} className="link text-sm">
                      {projectPackages.labels.more}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------------------ related services */}
      <Section labelledBy="related-title">
        <SectionHeading id="related-title" size="sm" title={hub.related.title} lead={hub.related.lead} />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hub.related.items.map((item) => {
            const service = serviceByKey(locale, item.service);
            return (
              <li key={item.title} className="card card-interactive focus-frame flex flex-col p-5">
                <Icon name={service.icon} className="h-5 w-5 text-brand" />
                <h3 className="t-h3 mt-3">
                  <Link href={href(routes.service(service.slug))} className="after:absolute after:inset-0">
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-1.5 text-body-sm leading-relaxed text-fg-muted">{item.text}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ process */}
      <Section labelledBy="hub-process-title" tone="deep">
        <SectionHeading id="hub-process-title" title={hub.process.title} />
        <Timeline steps={hub.process.steps} className="mt-stack" testId="hub-timeline" />
      </Section>

      {/* ------------------------------------------------------------ FAQ */}
      <Section labelledBy="faq-title" tone="raised">
        <div id="faq">
          <EditorialSplit sticky aside={<SectionHeading id="faq-title" title={hub.faq.title} />}>
            <Faq items={hub.faq.items} />
          </EditorialSplit>
        </div>
      </Section>

      <CtaBand
        title={hub.cta.title}
        lead={hub.cta.lead}
        primary={{ href: href(quoteWithService(primaryService)), label: hub.primaryCta }}
        secondary={{ href: href(routes.projectPackages), label: hub.packages.cta }}
        emphasis
      />
    </>
  );
}
