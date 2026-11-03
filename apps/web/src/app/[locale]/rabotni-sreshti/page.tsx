import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { Alert, PageHero, Section } from "@/components/ui/primitives";
import { WorkshopCards } from "@/components/workshops/WorkshopCards";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { BANDS } from "@/lib/domains";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata, collectionPageJsonLd, itemListJsonLd } from "@/lib/seo";
import { workshopLinks } from "@/lib/workshop-links";
import { WORKSHOP_KEYS, workshopBand } from "@/lib/workshops";

export async function generateMetadata({ params }: PageProps<"/[locale]/rabotni-sreshti">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).workshops.page;
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.workshops });
}

/** Workshops & Advisory catalogue grouped by band, with an in-page navigation (works without JavaScript). */
export default async function WorkshopsPage({ params }: PageProps<"/[locale]/rabotni-sreshti">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).workshops.page;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const all = workshopLinks(locale, WORKSHOP_KEYS);
  const bands = BANDS.map((band) => ({ band, items: all.filter((item) => workshopBand(item.key) === band) })).filter((g) => g.items.length > 0);

  return (
    <>
      <JsonLd
        data={[
          collectionPageJsonLd({ name: t.title, description: t.metaDescription, path: href(routes.workshops) }, locale),
          itemListJsonLd(t.title, all.map((item) => ({ name: item.label, path: item.href }))),
        ]}
      />
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.title, path: href(routes.workshops) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
        <Alert tone="info" role="note" className="mt-8 max-w-3xl">
          <span data-testid="workshops-notice">{t.notice}</span>
        </Alert>
      </PageHero>
      <Section size="wide">
        <nav aria-label={t.bandNav} className="mb-10">
          <ul className="flex flex-wrap gap-2" data-testid="workshop-bands">
            {bands.map(({ band, items }) => (
              <li key={band}>
                <a href={`#${band}`} className="badge hover:border-brand">
                  {t.bands[band].title} · {items.length}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-14">
          {bands.map(({ band, items }) => (
            <section key={band} id={band} aria-labelledby={`${band}-title`} className="scroll-mt-28">
              <h2 id={`${band}-title`} className="t-h2">
                {t.bands[band].title}
              </h2>
              <p className="mt-2 max-w-3xl text-fg-muted">{t.bands[band].text}</p>
              <WorkshopCards items={items} customLabel={t.custom} className="mt-6" />
            </section>
          ))}
        </div>
      </Section>
      <CtaBand
        title={getContent(locale).workshops.detail.ctaTitle}
        lead={getContent(locale).workshops.detail.ctaText}
        primary={{ href: href(contactWithService("audit")), label: getContent(locale).workshops.detail.ctaButton }}
      />
    </>
  );
}
