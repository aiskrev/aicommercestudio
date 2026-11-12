import { ConfiguratorEntry } from "@/components/configurator/ConfiguratorEntry";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { PriceTag } from "@/components/sections/PriceTag";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { Alert, ButtonLink, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { UiPreview } from "@/components/v5/UiPreview";
import { getContent, serviceByKey } from "@/content";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/lib/params";
import { priceText } from "@/lib/prices";
import { MAINTENANCE_CARE_PLANS, PROJECT_PACKAGES, carePlanPrice, packagePrice } from "@/lib/project-packages";
import { quoteWithService, routes } from "@/lib/routes";
import { buildMetadata, collectionPageJsonLd, faqJsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/proektni-paketi">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).projectPackages;
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.projectPackages });
}

/**
 * Project packages: typical scopes of the build services, side by side. Every package points at its service page
 * and at the quote form for that service. Prices are the published indicative bands (lib/prices.ts) where the
 * schedule has one; otherwise the page says the price comes in a written quote (lib/project-packages.ts).
 * No price is put in structured data. Server component: the details use native <details>.
 */
export default async function ProjectPackagesPage({ params }: PageProps<"/[locale]/proektni-paketi">) {
  const locale = await resolveLocale(params);
  const { projectPackages: t, carePlans, pricingPage, configurator } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  const packages = PROJECT_PACKAGES.map((definition) => {
    const service = serviceByKey(locale, definition.service);
    return {
      definition,
      text: t.packages[definition.key],
      service,
      price: packagePrice(definition),
      serviceHref: href(routes.service(service.slug)),
      quoteHref: href(quoteWithService(definition.service)),
      care: definition.carePlan ? carePlans.plans[definition.carePlan].name : t.labels.careSeparate,
    };
  });

  const list = (items: string[]) => (
    <ul className="mt-2 grid gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <JsonLd data={collectionPageJsonLd({ name: t.title, description: t.metaDescription, path: href(routes.projectPackages) }, locale)} />
      <JsonLd data={faqJsonLd(t.faq.items)} />
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.title, path: href(routes.projectPackages) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} aside={<UiPreview kind="store" caption={getContent(locale).v5.home.hero.previewCaption} />}>
        <Alert tone="info" role="note" className="mt-8 max-w-3xl">
          {t.note}
        </Alert>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ConfiguratorEntry href={href(routes.configurator)} label={configurator.entryLabel} />
          <ButtonLink href={href(routes.pricing)} variant="ghost" icon="arrowRight">
            {pricingPage.title}
          </ButtonLink>
        </div>
      </PageHero>

      <Section size="wide">
        <div className="grid gap-6 lg:grid-cols-2" data-testid="project-packages">
          {packages.map(({ definition, text, service, price, serviceHref, quoteHref, care }) => (
            <article key={definition.key} id={definition.key} className="card flex min-w-0 flex-col p-6" data-testid={`package-${definition.key}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="t-h3-lg">{text.name}</h2>
                <span className="badge">{t.delivery[definition.delivery]}</span>
              </div>
              <dl className="mt-5 grid flex-1 gap-5 text-body-sm">
                <div>
                  <dt className="t-label">{t.labels.audience}</dt>
                  <dd className="mt-1 text-fg-secondary">{text.audience}</dd>
                </div>
                <div>
                  <dt className="t-label">{t.labels.objective}</dt>
                  <dd className="mt-1 text-fg-secondary">{text.objective}</dd>
                </div>
                <div>
                  <dt className="t-label">{t.labels.includes}</dt>
                  <dd className="text-fg-secondary">{list(text.includes)}</dd>
                </div>
                <div>
                  <dt className="t-label">{t.labels.excludes}</dt>
                  <dd className="mt-2 text-fg-muted">
                    <ul className="grid list-disc gap-1 pl-5">
                      {text.excludes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="t-label">{t.labels.prerequisites}</dt>
                  <dd className="mt-2 text-fg-muted">
                    <ul className="grid list-disc gap-1 pl-5">
                      {text.prerequisites.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>

              <details className="group mt-5 border-t border-line-subtle pt-4 text-body-sm">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-fg">
                  <span>{t.labels.more}</span>
                  <Icon name="chevronDown" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <dl className="mt-3 grid gap-4">
                  {(
                    [
                      [t.labels.technical, text.technical],
                      [t.labels.design, text.design],
                      [t.labels.integrations, text.integrations],
                      [t.labels.content, text.content],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="t-label">{label}</dt>
                      <dd className="mt-1 text-fg-secondary">{value}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="t-label">{t.labels.stages}</dt>
                    <dd className="mt-2 text-fg-secondary">
                      <ol className="grid list-decimal gap-1 pl-5">
                        {service.workflow.map((step) => (
                          <li key={step.title}>{step.title}</li>
                        ))}
                      </ol>
                    </dd>
                  </div>
                </dl>
              </details>

              <div className="mt-5 border-t border-line-subtle pt-4" data-testid={`package-price-${definition.key}`}>
                <p className="t-label">{t.labels.price}</p>
                {price ? (
                  <PriceTag locale={locale} price={price} className="mt-2" />
                ) : (
                  <p className="mt-2 font-display text-lg font-semibold text-fg">{t.labels.priceOnQuote}</p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
                  {definition.delivery === "staged" ? t.labels.stagedNote : price ? t.labels.priceNote : t.labels.priceOnQuoteNote}
                </p>
                <p className="mt-3 text-body-sm text-fg-muted">
                  {t.labels.care}: <span className="text-fg-secondary">{care}</span>
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <ButtonLink href={quoteHref} icon="arrowRight">
                  {t.labels.quote}
                </ButtonLink>
                <ButtonLink href={serviceHref} variant="secondary">
                  {t.labels.details}
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="light" labelledBy="compare-title" size="wide">
        <SectionHeading id="compare-title" title={t.compare.title} lead={t.compare.lead} />
        <div
          className="mt-stack overflow-x-auto rounded-[var(--radius-lg)] border border-line-subtle"
          role="region"
          aria-labelledby="compare-title"
          tabIndex={0}
          data-testid="package-comparison"
        >
          <table className="w-full min-w-[52rem] border-collapse text-left text-body-sm">
            <caption className="sr-only">{t.compare.caption}</caption>
            <thead>
              <tr className="border-b border-line-subtle bg-surface-2">
                {(["package", "scope", "payments", "integrations", "delivery", "price", "care"] as const).map((column) => (
                  <th key={column} scope="col" className="px-4 py-3 font-semibold text-fg">
                    {t.compare.rows[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {packages.map(({ definition, text, price, care }) => (
                <tr key={definition.key} className="border-b border-line-subtle last:border-b-0">
                  <th scope="row" className="px-4 py-3 align-top font-semibold text-fg">
                    <a href={`#${definition.key}`} className="link">
                      {text.name}
                    </a>
                  </th>
                  <td className="px-4 py-3 align-top text-fg-secondary">{text.compare.scope}</td>
                  <td className="px-4 py-3 align-top text-fg-secondary">{text.compare.payments}</td>
                  <td className="px-4 py-3 align-top text-fg-secondary">{text.compare.integrations}</td>
                  <td className="px-4 py-3 align-top text-fg-secondary">{t.delivery[definition.delivery]}</td>
                  <td className="px-4 py-3 align-top text-fg-secondary">{price ? priceText(locale, price).from : t.labels.priceOnQuote}</td>
                  <td className="px-4 py-3 align-top text-fg-secondary">{care}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section labelledBy="care-title" size="wide">
        <SectionHeading id="care-title" title={t.care.title} lead={t.care.lead} />
        <ul className="mt-stack grid gap-6 md:grid-cols-2" data-testid="package-care">
          {MAINTENANCE_CARE_PLANS.map((key) => (
            <li key={key} className="card min-w-0 p-6" data-testid={`package-care-${key}`}>
              <h3 className="t-h3">{carePlans.plans[key].name}</h3>
              <p className="mt-2 text-body-sm text-fg-muted">{carePlans.plans[key].forWho}</p>
              <PriceTag locale={locale} price={carePlanPrice(key)} className="mt-4" />
            </li>
          ))}
        </ul>
        <ButtonLink href={href(routes.carePlans)} variant="secondary" icon="arrowRight" className="mt-6">
          {t.care.cta}
        </ButtonLink>
      </Section>

      <Section tone="raised" labelledBy="packages-faq-title">
        <SectionHeading id="packages-faq-title" title={t.faq.title} />
        <div className="mt-stack">
          <Faq items={t.faq.items} />
        </div>
      </Section>

      <CtaBand title={t.ctaTitle} lead={t.ctaLead} primary={{ href: href(`${routes.contact}?tip=oferta`), label: t.labels.quote }} />
    </>
  );
}
