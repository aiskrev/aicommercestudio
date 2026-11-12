import { notFound } from "next/navigation";

import { DemoRunner } from "@/components/demo/DemoRunner";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import { getDictionary } from "@/i18n";
import { isLocale, localizePath } from "@/i18n/config";
import { demoTexts } from "@/i18n/demos";
import { DEMO_FIELDS, DEMO_SERVICE, DEMO_WITH_PACKAGES } from "@/lib/demo-fields";
import { DEMO_KEYS, DEMO_SLUGS, demoBySlug } from "@/lib/demo-slugs";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata, collectionPageJsonLd } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return DEMO_KEYS.map((key) => ({ scenario: DEMO_SLUGS[key].bg }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/demo-tsentar/[scenario]">) {
  const locale = await resolveLocale(params);
  const key = demoBySlug((await params).scenario);
  if (!key) return {};
  const text = demoTexts[locale].scenarios[key];
  return buildMetadata({ locale, title: text.title, description: text.lead, path: routes.demoScenario(DEMO_SLUGS[key].bg) });
}

/** One interactive demonstration on simulated data: stateless, deterministic, nothing is executed. */
export default async function DemoScenarioPage({ params }: PageProps<"/[locale]/demo-tsentar/[scenario]">) {
  const locale = await resolveLocale(params);
  const key = demoBySlug((await params).scenario);
  if (!key) notFound();
  const t = demoTexts[locale];
  const text = t.scenarios[key];
  const centre = getContent(locale).demoCentre;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.demoScenario(DEMO_SLUGS[key].bg));
  const service = serviceByKey(locale, DEMO_SERVICE[key]);
  return (
    <>
      <JsonLd data={collectionPageJsonLd({ name: text.title, description: text.lead, path }, locale)} />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: centre.title, path: href(routes.demoCentre) },
          { name: text.title, path },
        ]}
      />
      <PageHero eyebrow={t.eyebrow} title={text.title} lead={text.lead} />
      <Section size="wide">
        <div className="mb-10 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="t-h3">{t.shows}</h2>
            <ul className="mt-3 grid list-disc gap-1 pl-5 text-fg-secondary">
              {text.shows.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="t-h3">{t.notForTitle}</h2>
            <ul className="mt-3 grid list-disc gap-1 pl-5 text-fg-secondary">
              {t.notFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <DemoRunner
          locale={locale}
          scenario={key}
          fields={DEMO_FIELDS[key]}
          next={{
            serviceHref: href(routes.service(service.slug)),
            packagesHref: href(routes.projectPackages),
            contactHref: href(contactWithService(DEMO_SERVICE[key])),
            packages: DEMO_WITH_PACKAGES.has(key),
          }}
        />
      </Section>
      <CtaBand title={centre.ctaTitle} lead={centre.ctaLead} primary={{ href: href(routes.contact), label: centre.ctaPrimary }} secondary={{ href: href(routes.demoCentre), label: centre.title }} />
    </>
  );
}
