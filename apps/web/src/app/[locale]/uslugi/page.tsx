import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CatalogueBrowser } from "@/components/sections/CatalogueBrowser";
import { CtaBand } from "@/components/sections/CtaBand";
import { DomainBands } from "@/components/sections/DomainBands";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { ServiceShowcase } from "@/components/sections/ServiceShowcase";
import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { ButtonLink, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { domainByKey, getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getCatalogue } from "@/lib/catalogue";
import { BANDS, domainsInBand, isDomainPublished } from "@/lib/domains";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
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
  const { servicesPage, coreServices, home } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const audit = serviceByKey(locale, "audit");
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
      <PageHero eyebrow={servicesPage.eyebrow} title={servicesPage.title} lead={servicesPage.lead} />

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
