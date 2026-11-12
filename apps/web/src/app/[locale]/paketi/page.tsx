import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { PriceTag } from "@/components/sections/PriceTag";
import { JsonLd } from "@/components/seo/JsonLd";
import Link from "next/link";

import { Alert, ButtonLink, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { UiPreview } from "@/components/v5/UiPreview";
import { getContent, serviceByKey } from "@/content";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { CARE_PLANS } from "@/lib/care-plans";
import { resolveLocale } from "@/lib/params";
import { CARE_PLAN_PRICES } from "@/lib/prices";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata, collectionPageJsonLd } from "@/lib/seo";
import { CARE_MATRIX_ANCHOR } from "@/lib/site-nav";

export async function generateMetadata({ params }: PageProps<"/[locale]/paketi">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).carePlans;
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.carePlans });
}

/** Comparable care plans. Unconfirmed commercial values are never shown (lib/care-plans.ts). */
export default async function CarePlansPage({ params }: PageProps<"/[locale]/paketi">) {
  const locale = await resolveLocale(params);
  const { carePlans: t, aiManaged, v5 } = getContent(locale);
  const care = v5.care;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const managed = serviceByKey(locale, "ai_managed");

  return (
    <>
      <JsonLd data={collectionPageJsonLd({ name: t.title, description: t.metaDescription, path: href(routes.carePlans) }, locale)} />
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.title, path: href(routes.carePlans) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} aside={<UiPreview kind="portal" caption={getContent(locale).v5.home.hero.previewCaption} />}>
        <Alert tone="info" role="note" className="mt-8 max-w-3xl">
          {t.note}
        </Alert>
      </PageHero>
      <Section size="wide">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" data-testid="care-plans">
          {CARE_PLANS.map((plan) => {
            const text = t.plans[plan.key];
            return (
              <article key={plan.key} className="card flex flex-col p-6" data-testid={`care-plan-${plan.key}`}>
                <h2 className="t-h3">{text.name}</h2>
                <dl className="mt-4 grid flex-1 gap-4 text-body-sm">
                  <div>
                    <dt className="t-label">{t.labels.forWho}</dt>
                    <dd className="mt-1 text-fg-secondary">{text.forWho}</dd>
                  </div>
                  <div>
                    <dt className="t-label">{t.labels.covers}</dt>
                    <dd className="mt-1 text-fg-secondary">
                      <ul className="grid gap-1">
                        {text.covers.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label">{t.labels.excludes}</dt>
                    <dd className="mt-1 text-fg-secondary">{text.excludes}</dd>
                  </div>
                  <div>
                    <dt className="t-label">{t.labels.reporting}</dt>
                    <dd className="mt-1 text-fg-secondary">{text.reporting}</dd>
                  </div>
                  <div>
                    <dt className="t-label">{t.labels.response}</dt>
                    <dd className="mt-1 text-fg-secondary">{plan.terms.responseTime ?? t.responseValue}</dd>
                  </div>
                  <div>
                    <dt className="t-label">{t.labels.price}</dt>
                    <dd className="mt-1">
                      <PriceTag locale={locale} price={CARE_PLAN_PRICES[plan.key]} testId={`care-plan-price-${plan.key}`} />
                    </dd>
                  </div>
                </dl>
                <ButtonLink href={href(contactWithService(plan.contactService))} icon="arrowRight" className="mt-6 w-full">
                  {t.labels.cta}
                </ButtonLink>
              </article>
            );
          })}
        </div>
      </Section>
      {/* V5 phase 11: every recurring and secondary service, split into covered / billing / third-party / unconfirmed. */}
      <Section labelledBy={`${CARE_MATRIX_ANCHOR}-title`} tone="light" size="wide">
        <div id={CARE_MATRIX_ANCHOR}>
          <SectionHeading id={`${CARE_MATRIX_ANCHOR}-title`} title={care.title} lead={care.lead} />
          <div className="compare-scroll mt-stack" tabIndex={0} role="region" aria-label={care.caption} data-testid="care-matrix">
            <table className="compare-table">
              <caption>{care.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{care.corner}</th>
                  {care.columns.map((column) => (
                    <th key={column.key} scope="col">
                      {column.label}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">{care.enquire}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {care.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((cell, index) => (
                      <td key={care.columns[index].key}>{cell}</td>
                    ))}
                    <td>
                      {row.service && (
                        <Link href={href(contactWithService(row.service))} className="link whitespace-nowrap text-sm" aria-label={`${care.enquire}: ${row.label}`}>
                          {care.enquire}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-fg-subtle">{care.legend}</p>
        </div>
      </Section>
      <Section tone="raised" labelledBy="ai-managed-title">
        <h2 id="ai-managed-title" className="t-h2">
          {t.aiManaged.title}
        </h2>
        <p className="mt-3 max-w-3xl text-fg-muted">{t.aiManaged.lead}</p>
        <ul className="mt-6 flex flex-wrap gap-2" data-testid="ai-managed-tiers">
          {aiManaged.packages.items.map((item) => (
            <li key={item.key} className="badge">
              {item.name}
            </li>
          ))}
        </ul>
        <ButtonLink href={href(routes.service(managed.slug))} variant="secondary" icon="arrowRight" className="mt-6">
          {t.aiManaged.cta}
        </ButtonLink>
      </Section>
      <CtaBand title={t.ctaTitle} lead={t.ctaLead} primary={{ href: href(routes.contact), label: dict.nav.contact }} />
    </>
  );
}
