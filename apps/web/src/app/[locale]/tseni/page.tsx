import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { Alert, ButtonLink, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { CARE_PLANS } from "@/lib/care-plans";
import { resolveLocale } from "@/lib/params";
import { AI_MANAGED_PRICES, CARE_PLAN_PRICES, type PriceItem, priceText, SERVICE_PRICES, WORKSHOP_PRICES } from "@/lib/prices";
import { routes } from "@/lib/routes";
import { buildMetadata, collectionPageJsonLd } from "@/lib/seo";
import { WORKSHOP_KEYS, WORKSHOP_SLUGS } from "@/lib/workshop-slugs";

export async function generateMetadata({ params }: PageProps<"/[locale]/tseni">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).pricingPage;
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.pricing });
}

interface Row {
  key: string;
  name: string;
  href: string;
  price: PriceItem;
}

/**
 * Pricing overview: every published band, grouped by how it is charged (one-time or per month). It adds no price
 * of its own: each row reads lib/prices.ts, so this page cannot disagree with a service page. No price is put in
 * structured data. Server component.
 */
export default async function PricingPage({ params }: PageProps<"/[locale]/tseni">) {
  const locale = await resolveLocale(params);
  const content = getContent(locale);
  const t = content.pricingPage;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  const services: Row[] = content.services.map((service) => ({
    key: service.key,
    name: service.shortTitle,
    href: href(routes.service(service.slug)),
    price: SERVICE_PRICES[service.key],
  }));
  const managedHref = href(routes.service(serviceByKey(locale, "ai_managed").slug));

  const groups: { id: string; text: { title: string; lead: string; cta: string }; ctaHref: string; rows: Row[] }[] = [
    { id: "projects", text: t.groups.projects, ctaHref: href(routes.projectPackages), rows: services.filter((row) => row.price.unit === "project") },
    { id: "monthly", text: t.groups.monthly, ctaHref: href(routes.services), rows: services.filter((row) => row.price.unit === "month") },
    {
      id: "ai-managed",
      text: t.groups.aiManaged,
      ctaHref: managedHref,
      rows: content.aiManaged.packages.items.map((item) => ({
        key: item.key,
        name: item.name,
        href: managedHref,
        price: AI_MANAGED_PRICES[item.key as keyof typeof AI_MANAGED_PRICES],
      })),
    },
    {
      id: "care-plans",
      text: t.groups.carePlans,
      ctaHref: href(routes.carePlans),
      rows: CARE_PLANS.map((plan) => ({ key: plan.key, name: content.carePlans.plans[plan.key].name, href: href(routes.carePlans), price: CARE_PLAN_PRICES[plan.key] })),
    },
    {
      id: "workshops",
      text: t.groups.workshops,
      ctaHref: href(routes.workshops),
      rows: WORKSHOP_KEYS.map((key) => ({
        key,
        name: content.workshops.texts[key].title,
        href: href(routes.workshop(WORKSHOP_SLUGS[key].bg)),
        price: WORKSHOP_PRICES[key],
      })),
    },
  ];

  return (
    <>
      <JsonLd data={collectionPageJsonLd({ name: t.title, description: t.metaDescription, path: href(routes.pricing) }, locale)} />
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.navLabel, path: href(routes.pricing) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
        <div className="mt-8 max-w-3xl" data-testid="pricing-note">
          <Alert tone="info" role="note">{dict.prices.note}</Alert>
        </div>
        <nav aria-label={t.navLabel} className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <a href={`#${group.id}`} className="badge inline-flex min-h-11 items-center hover:text-fg">
                  {group.text.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHero>

      {groups.map((group, index) => (
        <Section key={group.id} labelledBy={`${group.id}-title`} tone={index % 2 === 1 ? "raised" : undefined} size="wide">
          <div id={group.id} className="scroll-mt-24">
            <SectionHeading
              id={`${group.id}-title`}
              title={group.text.title}
              lead={group.text.lead}
              action={
                <ButtonLink href={group.ctaHref} variant="secondary" icon="arrowRight">
                  {group.text.cta}
                </ButtonLink>
              }
            />
          </div>
          <div className="mt-stack overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle" data-testid={`pricing-${group.id}`}>
            <div className="hidden grid-cols-[minmax(0,1fr)_11rem_15rem] gap-4 border-b border-line-subtle bg-surface-2 px-5 py-3 text-body-sm font-semibold text-fg md:grid" aria-hidden="true">
              <span>{t.columns.offer}</span>
              <span>{t.columns.from}</span>
              <span>{t.columns.typical}</span>
            </div>
            <ul className="divide-y divide-line-subtle">
              {group.rows.map((row) => {
                const text = priceText(locale, row.price);
                return (
                  <li key={row.key} className="grid gap-1 bg-surface-1 px-5 py-4 md:grid-cols-[minmax(0,1fr)_11rem_15rem] md:items-center md:gap-4" data-price-row={row.key}>
                    <Link href={row.href} className="link font-semibold">
                      {row.name}
                    </Link>
                    <p className="font-display font-semibold text-fg" data-price="from">
                      <span className="sr-only">{t.columns.from}: </span>
                      {text.from}
                    </p>
                    <p className="text-body-sm text-fg-muted" data-price="typical">
                      <span className="sr-only">{t.columns.typical}: </span>
                      {text.typical}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>
      ))}

      <Section labelledBy="excluded-title" tone="raised">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="excluded-title" className="t-h2">
              {t.excluded.title}
            </h2>
            <ul className="mt-6 grid list-disc gap-2 pl-5 text-fg-secondary" data-testid="pricing-excluded">
              {t.excluded.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-body-sm text-fg-muted">{t.excluded.note}</p>
          </div>
          <div>
            <h2 className="t-h2">{t.how.title}</h2>
            <ol className="mt-6 grid gap-4" data-testid="pricing-how">
              {t.how.steps.map((step, position) => (
                <li key={step.title} className="flex gap-4">
                  <span className="badge h-8 w-8 shrink-0 justify-center" aria-hidden="true">
                    {position + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-fg">{step.title}</p>
                    <p className="mt-1 text-body-sm text-fg-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <CtaBand title={t.ctaTitle} lead={t.ctaLead} primary={{ href: href(`${routes.contact}?tip=oferta`), label: t.ctaButton }} />
    </>
  );
}
