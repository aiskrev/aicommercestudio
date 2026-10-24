import { Suspense } from "react";

import { ContactForm } from "@/components/contact/ContactForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AiOpsDiagram } from "@/components/sections/AiOpsDiagram";
import { Faq } from "@/components/sections/Faq";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import {
  ButtonLink,
  CheckList,
  Container,
  Eyebrow,
  FeatureCard,
  FeatureIndex,
  Section,
  SectionHeading,
  cx,
} from "@/components/ui/primitives";
import { getContent, serviceByKey, serviceRoutePaths } from "@/content";
import type { PackageCell } from "@/content/bg/ai-managed";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { contactFormProps } from "@/lib/contact-form-props";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata, faqJsonLd, serviceJsonLd } from "@/lib/seo";

/**
 * AI Managed Services landing page (dedicated route; the generic service template skips this service).
 * Public URLs: /bg/uslugi/ai-managed-services and /en/services/ai-managed-services.
 * Nothing on this page claims live monitoring, prices, SLAs or results.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]/uslugi/ai-managed-services">) {
  const locale = await resolveLocale(params);
  const service = serviceByKey(locale, "ai_managed");
  return buildMetadata({
    locale,
    title: service.metaTitle,
    description: service.metaDescription,
    path: serviceRoutePaths("ai_managed"),
  });
}

function Cell({ value, labels }: { value: PackageCell; labels: { included: string; notIncluded: string } }) {
  if (value === "yes") {
    return (
      <>
        <Icon name="check" className="mx-auto h-5 w-5 text-cyan-300" />
        <span className="sr-only">{labels.included}</span>
      </>
    );
  }
  if (value === "no") {
    return (
      <>
        <span aria-hidden="true" className="text-slate-500">
          —
        </span>
        <span className="sr-only">{labels.notIncluded}</span>
      </>
    );
  }
  return <span className="text-slate-300">{value}</span>;
}

export default async function AiManagedServicesPage({ params }: PageProps<"/[locale]/uslugi/ai-managed-services">) {
  const locale = await resolveLocale(params);
  const { aiManaged: page } = getContent(locale);
  const dict = getDictionary(locale);
  const service = serviceByKey(locale, "ai_managed");
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.service(service.slug));
  const formProps = contactFormProps(locale);
  const inquiryHref = `${path}#ams-inquiry`;

  return (
    <>
      <JsonLd
        data={[
          serviceJsonLd(
            { title: service.title, metaDescription: service.metaDescription, path, type: service.shortTitle },
            locale,
          ),
          faqJsonLd(page.faq),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.services, path: href(routes.services) },
          { name: service.shortTitle, path },
        ]}
      />

      {/* 1. hero */}
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid gap-12 pb-14 pt-10 sm:pb-20 sm:pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
          <Eyebrow>{page.hero.eyebrow}</Eyebrow>
          <h1 className="t-h1 mt-5 max-w-4xl">{page.hero.title}</h1>
          <p className="t-lead mt-6 max-w-3xl">{page.hero.subtitle}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={inquiryHref} size="lg" icon="arrowRight">
              {page.hero.primaryCta}
            </ButtonLink>
            <ButtonLink href={href(routes.services)} variant="secondary" size="lg">
              {page.hero.secondaryCta}
            </ButtonLink>
          </div>
          <blockquote className="mt-10 max-w-3xl border-l-2 border-brand pl-5 text-lg leading-relaxed text-fg-secondary">
            {page.hero.positioning}
          </blockquote>
          <nav aria-label={dict.common.onThisPage} className="mt-10">
            <ul className="flex flex-wrap gap-2">
              {page.sectionNav.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="badge transition-colors hover:border-brand/50 hover:text-fg">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          </div>
          <AiOpsDiagram title={page.diagram.title} caption={page.diagram.caption} steps={page.diagram.steps} vertical />
        </Container>
      </div>

      {/* 2. value proposition */}
      <Section labelledBy="ams-value">
        <SectionHeading id="ams-value" title={page.value.title} lead={page.value.lead} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {page.value.items.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
        <h3 className="t-h3 mt-14 text-xl">{page.value.differentiationTitle}</h3>
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          {page.value.differentiation.map((row) => (
            <div key={row.other} className="card p-5">
              <dt className="text-sm font-semibold text-cyan-200">{row.other}</dt>
              <dd className="mt-2 leading-relaxed text-slate-300">{row.difference}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 3. who this is for */}
      <Section labelledBy="ams-audience" alt>
        <SectionHeading id="ams-audience" title={page.audience.title} lead={page.audience.lead} />
        <FeatureIndex items={page.audience.segments} className="mt-10" />
      </Section>

      {/* 4. problems we solve */}
      <Section labelledBy="ams-problems" tone="light">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
          <SectionHeading id="ams-problems" title={page.problems.title} />
          <p className="border-l-2 border-brand-ink pl-5 text-lg font-semibold leading-relaxed text-ink">{page.problems.keyMessage}</p>
        </div>
        <p className="t-lead mt-8 max-w-3xl">{page.problems.lead}</p>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-ink/15 bg-ink/15 sm:grid-cols-2 lg:grid-cols-3">
          {page.problems.causes.map((cause) => (
            <li key={cause.title} className="bg-surface-light p-5">
              <p className="font-semibold text-ink">{cause.title}</p>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-muted">{cause.description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm text-ink-muted">{page.problems.disclaimer}</p>
      </Section>

      {/* 5. what we monitor */}
      <Section labelledBy="ams-monitoring" alt>
        <SectionHeading id="ams-monitoring" title={page.monitoring.title} lead={page.monitoring.lead} />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="card p-6 sm:p-7">
            <h3 className="t-h3 text-lg">{page.monitoring.availableTitle}</h3>
            <CheckList items={page.monitoring.available} className="mt-5" />
          </div>
          <div className="card p-6 sm:p-7">
            <h3 className="t-h3 text-lg">{page.monitoring.integrationsTitle}</h3>
            <CheckList items={page.monitoring.integrations} className="mt-5" />
          </div>
        </div>
        <p className="mt-6 flex max-w-3xl gap-2 text-sm text-slate-400">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          {page.monitoring.note}
        </p>
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="card p-6 sm:p-7">
            <h3 className="t-h3 text-lg">{page.maintenance.title}</h3>
            <p className="mt-2 text-slate-400">{page.maintenance.lead}</p>
            <CheckList items={page.maintenance.items} className="mt-5" />
            <p className="mt-5 text-sm text-slate-400">{page.maintenance.boundary}</p>
          </div>
          <div className="card p-6 sm:p-7">
            <h3 className="t-h3 text-lg">{page.improvement.title}</h3>
            <CheckList items={page.improvement.items} className="mt-5" />
          </div>
        </div>
      </Section>

      {/* 6. quality and reliability */}
      <Section labelledBy="ams-quality">
        <SectionHeading id="ams-quality" title={page.quality.title} lead={page.quality.lead} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.quality.items.map((item) => (
            <li key={item.title} className="card p-5">
              <p className="font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-sm text-slate-400">{item.description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm text-slate-400">{page.quality.disclaimer}</p>
        <h3 className="t-h3 mt-12 text-xl">{page.quality.examplesTitle}</h3>
        <p className="mt-2 inline-flex rounded-full border border-amber-300/30 bg-amber-300/[0.07] px-3 py-1 text-xs font-semibold text-amber-100">
          {page.quality.examplesNote}
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {page.quality.examples.map((example) => (
            <div key={example.system} className="card p-6" data-testid="evaluation-example">
              <p className="font-semibold text-white">{example.system}</p>
              <CheckList items={example.criteria} className="mt-4 text-sm" />
            </div>
          ))}
        </div>
      </Section>

      {/* 7. security and governance */}
      <Section labelledBy="ams-security" alt>
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeading id="ams-security" title={page.security.title} lead={page.security.lead} />
            <p className="mt-8 rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.06] p-5 leading-relaxed text-cyan-50">
              {page.security.principle}
            </p>
          </div>
          <CheckList items={page.security.items} className="self-start" />
        </div>
      </Section>

      {/* 8. cost optimization */}
      <Section labelledBy="ams-cost">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <SectionHeading id="ams-cost" title={page.cost.title} lead={page.cost.lead} />
          <div>
            <CheckList items={page.cost.items} />
            <p className="mt-6 text-sm text-slate-400">{page.cost.note}</p>
          </div>
        </div>
      </Section>

      {/* incident response */}
      <Section labelledBy="ams-incidents" alt>
        <SectionHeading id="ams-incidents" title={page.incidents.title} lead={page.incidents.lead} />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {page.incidents.steps.map((step, index) => (
            <li key={step.title} className="card p-5">
              <span className="font-display text-sm font-semibold text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-2 font-semibold text-white">{step.title}</p>
              <p className="mt-1 text-sm text-slate-400">{step.description}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl text-sm text-slate-400">{page.incidents.note}</p>
      </Section>

      {/* 9. onboarding */}
      <Section labelledBy="ams-onboarding">
        <SectionHeading id="ams-onboarding" title={page.onboarding.title} lead={page.onboarding.lead} />
        <ProcessTimeline steps={page.onboarding.steps} className="mt-14" />
      </Section>

      {/* 10. packages */}
      <Section labelledBy="ams-packages" alt>
        <SectionHeading id="ams-packages" title={page.packages.title} lead={page.packages.lead} />
        <ul className="mt-10 grid gap-5 lg:grid-cols-3">
          {page.packages.items.map((pkg, index) => (
            <li
              key={pkg.key}
              className={cx("card flex flex-col p-6 sm:p-7", index === 1 && "card-accent")}
              data-testid={`package-${pkg.key}`}
            >
              <p className="font-display text-2xl font-semibold text-white">{pkg.name}</p>
              <p className="mt-2 text-sm text-slate-400">{pkg.audience}</p>
              <p className="mt-4 text-slate-300">{pkg.summary}</p>
              <p className="mt-5 text-lg font-semibold text-cyan-200">{page.packages.priceLabel}</p>
              <CheckList items={pkg.includes} className="mt-5 flex-1 text-sm" />
              <ButtonLink href={inquiryHref} variant={index === 1 ? "primary" : "secondary"} className="mt-6 w-full">
                {page.packages.cta}
              </ButtonLink>
            </li>
          ))}
        </ul>

        <div className="card mt-10 overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="px-5 pt-5 text-left text-lg font-semibold text-white">{page.packages.comparisonTitle}</caption>
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium">
                  {page.packages.comparisonFeature}
                </th>
                {page.packages.items.map((pkg) => (
                  <th key={pkg.key} scope="col" className="px-5 py-4 text-center font-medium">
                    {pkg.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {page.packages.comparison.map((row) => (
                <tr key={row.feature}>
                  <th scope="row" className="px-5 py-3.5 font-medium text-white">
                    {row.feature}
                  </th>
                  {row.values.map((value, index) => (
                    <td key={`${row.feature}-${index}`} className="px-5 py-3.5 text-center">
                      <Cell value={value} labels={page.packages} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid gap-3 text-sm text-slate-400 md:grid-cols-2">
          <p className="flex gap-2">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            {page.packages.thirdPartyNote}
          </p>
          <p className="flex gap-2" data-testid="no-sla-note">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
            {page.packages.noSlaNote}
          </p>
        </div>
      </Section>

      {/* 11. scope and exclusions */}
      <Section labelledBy="ams-scope">
        <SectionHeading id="ams-scope" title={page.scope.title} />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="card p-6 sm:p-7">
            <h3 className="t-h3 text-lg">{page.scope.includedTitle}</h3>
            <CheckList items={page.scope.included} className="mt-5" />
          </div>
          <div className="card p-6 sm:p-7">
            <h3 className="t-h3 text-lg">{page.scope.excludedTitle}</h3>
            <ul className="mt-5 grid gap-3">
              {page.scope.excluded.map((item) => (
                <li key={item} className="flex gap-3 text-slate-300">
                  <Icon name="close" className="mt-1 h-4 w-4 shrink-0 text-rose-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 12. FAQ */}
      <Section labelledBy="ams-faq" alt>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading id="ams-faq" title={dict.service.faq} />
          <Faq items={page.faq} />
        </div>
      </Section>

      {/* 13. consultation request */}
      <section id="ams-inquiry" aria-labelledby="ams-inquiry-title" className="scroll-mt-20 py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 id="ams-inquiry-title" className="t-h2">
              {page.cta.title}
            </h2>
            <p className="t-lead mt-4">{page.cta.lead}</p>
            <div className="card mt-8 p-6">
              <p className="font-semibold text-white">{page.form.title}</p>
              <p className="mt-2 text-sm text-slate-400">{page.form.lead}</p>
            </div>
            <ButtonLink href={href(routes.contact)} variant="ghost" className="mt-6">
              {page.cta.secondary}
            </ButtonLink>
          </div>
          <Suspense>
            <ContactForm {...formProps} initialService="ai_managed" />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
