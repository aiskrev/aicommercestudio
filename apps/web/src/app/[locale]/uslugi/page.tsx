import Link from "next/link";

import { compareData } from "@/components/future/compare-data";
import { buildSelectorLinks } from "@/components/future/selector-links";
import { ServiceComparison } from "@/components/future/ServiceComparison";
import { ServiceSelector } from "@/components/future/ServiceSelector";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CatalogueBrowser } from "@/components/sections/CatalogueBrowser";
import { CtaBand } from "@/components/sections/CtaBand";
import { DomainBands } from "@/components/sections/DomainBands";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { ServiceShowcase } from "@/components/sections/ServiceShowcase";
import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { UiPreview } from "@/components/v5/UiPreview";
import { domainByKey, getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getCatalogue } from "@/lib/catalogue";
import { BANDS, domainsInBand, isDomainPublished } from "@/lib/domains";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { SELECTOR_ANCHOR } from "@/lib/site-nav";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata, itemListJsonLd } from "@/lib/seo";

/** Prerendered from the TypeScript content; catalogue-only entries join on regeneration (lib/catalogue.ts). */
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/uslugi">) {
  const locale = await resolveLocale(params);
  const { servicesPage } = getContent(locale);
  return buildMetadata({
    locale,
    title: servicesPage.metaTitle,
    description: servicesPage.metaDescription,
    path: routes.services,
  });
}

export default async function ServicesPage({ params }: PageProps<"/[locale]/uslugi">) {
  const locale = await resolveLocale(params);
  const { servicesPage, coreServices, home, v5 } = getContent(locale);
  const fc = v5.future;
  const compare = compareData(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const audit = serviceByKey(locale, "audit");
  const startHref = {
    website: href(routes.websites),
    store: href(routes.ecommerce),
    platform: href(routes.service(serviceByKey(locale, "portals_web_apps").slug)),
    ai: href(routes.aiSolutions),
  } as const;
  const { entries } = await getCatalogue(locale);
  const catalogueDomains = BANDS.flatMap(domainsInBand)
    .filter((domain) => isDomainPublished(domain.key))
    .map((domain) => ({ key: domain.key, name: domainByKey(locale, domain.key).name }));

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          servicesPage.title,
          [...coreServices, audit].map((s) => ({ name: s.shortTitle, path: href(routes.service(s.slug)) })),
        )}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.services, path: href(routes.services) },
        ]}
      />
      <PageHero eyebrow={servicesPage.eyebrow} title={servicesPage.title} lead={servicesPage.lead} aside={<UiPreview kind="portal" caption={v5.home.hero.previewCaption} />} />

      {/* V5: the four directions first, as on the homepage, then the ten service areas. */}
      <Section labelledBy="services-start-title" density="compact">
        <h2 id="services-start-title" className="t-h3-lg">
          {v5.home.showcase.title}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="services-start">
          {v5.home.showcase.cards.map((card) => (
            <li key={card.key} className="card card-interactive focus-frame flex flex-col p-5">
              <UiPreview kind={card.preview} compact />
              <h3 className="t-h3 mt-5">
                <Link href={startHref[card.key]} className="after:absolute after:inset-0">
                  {card.title}
                </Link>
              </h3>
              <p className="mt-1.5 text-body-sm leading-relaxed text-fg-muted">{card.audience}</p>
              <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-brand">
                {card.more}
                <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Future Commerce: what to build → the matching package and services (the configurator's model, flag off). */}
      <Section id={SELECTOR_ANCHOR} labelledBy="selector-title" tone="light">
        <SectionHeading id="selector-title" eyebrow={fc.selector.eyebrow} title={fc.selector.title} lead={fc.selector.lead} />
        <div className="mt-stack">
          <ServiceSelector text={fc.selector} links={buildSelectorLinks(locale)} />
        </div>
      </Section>

      <Section labelledBy="services-compare-title" tone="raised" size="wide">
        <SectionHeading id="services-compare-title" eyebrow={fc.compare.eyebrow} title={fc.compare.title} lead={fc.compare.lead} />
        <div className="mt-stack">
          <ServiceComparison text={fc.compare} prices={compare.prices} links={compare.links} />
        </div>
      </Section>

      <Section labelledBy="services-domains-title">
        <SectionHeading id="services-domains-title" title={dict.domain.domainsTitle} lead={dict.domain.domainsLead} />
        <div className="mt-12">
          <DomainBands locale={locale} labels={dict.domain} />
        </div>
      </Section>

      <Section alt>
        <ServiceShowcase
          services={coreServices}
          hrefFor={(service) => href(routes.service(service.slug))}
          cta={dict.common.learnMore}
          groups={servicesPage.groups}
          groupHeadingLevel={2}
        />

        <div className="mt-10 grid gap-6 rounded-[var(--radius-lg)] border border-dashed border-line-strong p-7 sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <ServiceMotif service="audit" className="h-16 w-24" />
          <div>
            <p className="t-label text-brand">{dict.ui.firstStepBadge}</p>
            <h2 className="t-h3-lg mt-2">{servicesPage.offeringTitle}</h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-fg-muted">{servicesPage.offeringLead}</p>
          </div>
          <ButtonLink href={href(routes.service(audit.slug))} icon="arrowRight" className="w-full whitespace-normal text-center sm:w-auto">
            {audit.shortTitle}
          </ButtonLink>
        </div>
      </Section>

      <Section labelledBy="services-catalogue-title">
        <SectionHeading id="services-catalogue-title" title={dict.catalogue.browserTitle} lead={dict.catalogue.browserLead} />
        <div className="mt-10">
          <CatalogueBrowser
            entries={entries}
            hrefs={Object.fromEntries(entries.map((entry) => [entry.key, href(routes.service(entry.slug))]))}
            domains={catalogueDomains}
            locale={locale}
            labels={dict.catalogue}
            statusLabels={dict.domain.status}
          />
        </div>
      </Section>

      <Section labelledBy="services-process-title" alt>
        <SectionHeading id="services-process-title" eyebrow={home.process.eyebrow} title={home.process.title} />
        <ProcessTimeline steps={home.process.steps} className="mt-14" />
      </Section>

      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: dict.nav.cta }}
        points={dict.cta.points}
      />
    </>
  );
}
