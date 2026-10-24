import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { ServiceShowcase } from "@/components/sections/ServiceShowcase";
import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { ButtonLink, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata, itemListJsonLd } from "@/lib/seo";

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

      <Section>
        <ServiceShowcase
          services={coreServices}
          hrefFor={(service) => href(routes.service(service.slug))}
          cta={dict.common.learnMore}
          groups={home.servicesIntro.groups}
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
