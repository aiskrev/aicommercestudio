import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { ServiceCard } from "@/components/sections/ServiceCard";
import { ButtonLink, IconBadge, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
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
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {coreServices.map((service, index) => (
            <li key={service.key} className={service.key === "ai_managed" ? "sm:col-span-2 lg:col-span-3" : undefined}>
              <ServiceCard
                service={service}
                href={href(routes.service(service.slug))}
                cta={dict.common.learnMore}
                index={index}
                wide={service.key === "ai_managed"}
                headingLevel={2}
              />
            </li>
          ))}
        </ul>

        <div className="card-accent mt-10 grid gap-6 rounded-[1.5rem] p-8 sm:p-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <IconBadge name={audit.icon} className="h-14 w-14" />
          <div>
            <h2 className="t-h2 text-2xl sm:text-3xl">{servicesPage.offeringTitle}</h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-slate-300">{servicesPage.offeringLead}</p>
          </div>
          <ButtonLink href={href(routes.service(audit.slug))} icon="arrowRight">
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
