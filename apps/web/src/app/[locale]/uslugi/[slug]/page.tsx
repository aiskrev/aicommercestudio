import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/editorial/ArticleCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { DomainHub } from "@/components/sections/DomainHub";
import { Faq } from "@/components/sections/Faq";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { RelatedTools } from "@/components/home/ToolsPreview";
import { ServiceCard } from "@/components/sections/ServiceCard";
import { ServiceConcept } from "@/components/sections/ServiceConcept";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { EditorialSplit } from "@/components/ui/patterns";
import {
  ButtonLink,
  CheckList,
  Container,
  Eyebrow,
  IconBadge,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import {
  articleByKey,
  domainByKey,
  domainRoutePaths,
  findDomain,
  findService,
  getContent,
  serviceByKey,
  serviceRoutePaths,
} from "@/content";
import type { DomainContent } from "@/content/types";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { domainDefinition, isDomainPublished, primaryDomainOf } from "@/lib/domains";
import { resolveLocale } from "@/lib/params";
import { contactWithService, quoteWithService, routes } from "@/lib/routes";
import { buildMetadata, faqJsonLd, serviceJsonLd } from "@/lib/seo";
import { SERVICE_TOOLS, toolHrefs, toolMinutes } from "@/lib/tools";

export const dynamicParams = false;

/** Published domain hub for this slug; domain and service slugs share the `/uslugi` namespace. */
function publishedDomain(locale: Parameters<typeof findDomain>[0], slug: string): DomainContent | undefined {
  const domain = findDomain(locale, slug);
  return domain && isDomainPublished(domain.key) ? domain : undefined;
}

// Services with a dedicated route (e.g. uslugi/ai-managed-services) are not rendered by this template.
// Published domain hubs (docs/SERVICE_TAXONOMY.md) are rendered here as well.
export function generateStaticParams({ params }: { params: { locale: string } }) {
  const { locale } = params;
  if (!isLocale(locale)) return [];
  const { services, domains } = getContent(locale);
  return [
    ...services.filter((service) => !service.customPage).map((service) => ({ slug: service.slug })),
    ...domains.filter((domain) => isDomainPublished(domain.key)).map((domain) => ({ slug: domain.slug })),
  ];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/uslugi/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const domain = publishedDomain(locale, slug);
  if (domain) {
    return buildMetadata({
      locale,
      title: domain.metaTitle,
      description: domain.metaDescription,
      path: domainRoutePaths(domain.key),
    });
  }
  const service = findService(locale, slug);
  if (!service || service.customPage) return {};
  return buildMetadata({
    locale,
    title: service.metaTitle,
    description: service.metaDescription,
    path: serviceRoutePaths(service.key),
  });
}

export default async function ServicePage({ params }: PageProps<"/[locale]/uslugi/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const dict = getDictionary(locale);
  const domain = publishedDomain(locale, slug);
  if (domain) return <DomainPage locale={locale} domain={domain} dict={dict} />;

  const service = findService(locale, slug);
  if (!service || service.customPage) notFound();

  const { home, tools } = getContent(locale);
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.service(service.slug));
  const related = service.related.map((key) => serviceByKey(locale, key));
  const relatedArticles = service.relatedArticles
    .map((articleKey) => articleByKey(locale, articleKey))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const contactHref = href(contactWithService(service.key));
  const quoteHref = href(quoteWithService(service.key));
  const parentDomain = primaryDomainOf(service.key);
  const parent = parentDomain?.published ? domainByKey(locale, parentDomain.key) : undefined;

  return (
    <>
      <JsonLd
        data={[
          serviceJsonLd(
            { title: service.title, metaDescription: service.metaDescription, path, type: service.shortTitle },
            locale,
          ),
          faqJsonLd(service.faqs),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.services, path: href(routes.services) },
          ...(parent ? [{ name: parent.name, path: href(routes.service(parent.slug)) }] : []),
          { name: service.shortTitle, path },
        ]}
      />

      {/* ------------------------------------------------------------ hero */}
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid gap-12 pb-14 pt-10 sm:pb-16 sm:pt-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:pb-20">
          <div>
            <div className="flex items-center gap-3">
              <IconBadge name={service.icon} />
              <Eyebrow>{service.shortTitle}</Eyebrow>
            </div>
            <h1 className="t-h1 mt-6">{service.title}</h1>
            <p className="t-lead mt-6 max-w-2xl">{service.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={quoteHref} size="lg" icon="arrowRight">
                {dict.common.requestQuote}
              </ButtonLink>
              <ButtonLink href={href(routes.services)} size="lg" variant="secondary">
                {dict.common.allServices}
              </ButtonLink>
            </div>
          </div>
          <ServiceConcept service={service.key} steps={service.workflow} label={dict.service.conceptLabel} />
        </Container>

        {/* summary strip */}
        <Container className="relative pb-10">
          <dl
            aria-label={dict.service.summaryTitle}
            className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle bg-line-subtle md:grid-cols-3"
          >
            <div className="bg-surface-1 p-5">
              <dt className="t-label">{dict.service.engagement}</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {service.engagement.map((model) => (
                  <span key={model} className="badge badge-accent">
                    {model}
                  </span>
                ))}
              </dd>
            </div>
            <div className="bg-surface-1 p-5">
              <dt className="t-label">{dict.service.deliverables}</dt>
              <dd className="mt-2 text-[15px] text-fg-secondary">{service.deliverables[0]}</dd>
            </div>
            <div className="bg-surface-1 p-5">
              <dt className="t-label">{dict.service.firstStepLabel}</dt>
              <dd className="mt-2 text-[15px] text-fg-secondary">{dict.service.firstStep}</dd>
            </div>
          </dl>
        </Container>
      </div>

      {/* ------------------------------------------------------------ customer problems (editorial list) */}
      <Section labelledBy="problems-title">
        <EditorialSplit
          aside={<SectionHeading id="problems-title" eyebrow={dict.service.problemsEyebrow} title={service.headings.problems} />}
        >
          <ul className="border-t border-line-subtle">
            {service.signals.map((signal) => (
              <li key={signal} className="flex items-start gap-4 border-b border-line-subtle py-5">
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="text-[17px] leading-relaxed text-fg-secondary">{signal}</p>
              </li>
            ))}
          </ul>
        </EditorialSplit>
      </Section>

      {/* ------------------------------------------------------------ solution approach */}
      <Section labelledBy="approach-title" tone="raised">
        <SectionHeading id="approach-title" eyebrow={dict.service.approachEyebrow} title={dict.service.approachTitle} />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {service.approach.map((step, index) => (
            <li key={step.title} className="min-w-0 border-t border-brand/40 pt-6">
              <span className="t-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="t-h3 mt-3">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-fg-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------ capabilities (two-column index) */}
      <Section labelledBy="capabilities-title">
        <SectionHeading id="capabilities-title" eyebrow={service.shortTitle} title={service.headings.capabilities} />
        <ol className="mt-12 grid gap-x-12 md:grid-cols-2">
          {service.capabilities.map((capability, index) => (
            <li key={capability.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-t border-line-subtle py-6">
              <span className="font-mono text-sm text-brand" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="t-h3">{capability.title}</h3>
                <p className="mt-1.5 leading-relaxed text-fg-muted">{capability.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------ use cases */}
      <Section labelledBy="use-cases-title" tone="deep">
        <SectionHeading
          id="use-cases-title"
          eyebrow={dict.service.useCasesEyebrow}
          title={dict.service.useCasesTitle}
          lead={dict.service.useCasesNote}
        />
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {service.useCases.map((useCase) => (
            <li key={useCase.title} className="card flex flex-col p-6">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-2/40 text-brand-2" aria-hidden="true">
                <Icon name="target" className="h-4.5 w-4.5" />
              </span>
              <h3 className="t-h3 mt-4">{useCase.title}</h3>
              <p className="mt-2 leading-relaxed text-fg-muted">{useCase.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ technical checks (light) */}
      <Section labelledBy="checks-title" tone="light">
        <SectionHeading id="checks-title" eyebrow={dict.service.checksEyebrow} title={service.headings.checks} />
        <ul className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-ink/15 bg-ink/15 md:grid-cols-2">
          {service.checks.map((check) => (
            <li key={check.title} className="flex gap-4 bg-surface-light p-6">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-ink text-brand" aria-hidden="true">
                <Icon name="check" className="h-4 w-4" />
              </span>
              <div>
                <h3 className="t-h3">{check.title}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-muted">{check.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ deliverables + engagement */}
      <Section labelledBy="deliverables-title" alt>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="card p-6 sm:p-8">
            <h2 id="deliverables-title" className="t-h2 text-2xl sm:text-3xl">
              {service.headings.deliverables}
            </h2>
            <CheckList items={service.deliverables} className="mt-6" />
          </div>
          <div className="card card-accent p-6 sm:p-8">
            <h2 className="t-h2 text-2xl sm:text-3xl">{dict.service.engagement}</h2>
            <ul className="mt-6 grid gap-3">
              {service.engagement.map((model) => (
                <li key={model} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line-subtle bg-surface-page px-4 py-3.5 text-fg-secondary">
                  <Icon name="layers" className="h-5 w-5 shrink-0 text-brand" />
                  {model}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-fg-muted">{dict.service.pricingNote}</p>
            <ButtonLink href={quoteHref} icon="arrowRight" className="mt-6 w-full sm:w-auto">
              {dict.common.requestQuote}
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ process */}
      <Section labelledBy="service-process-title">
        <EditorialSplit
          sticky
          aside={
            <>
              <SectionHeading id="service-process-title" eyebrow={home.process.eyebrow} title={service.headings.workflow} />
              <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight" className="mt-6">
                {dict.service.fullProcess}
              </ButtonLink>
              <div className="panel mt-10 p-6">
                <h3 className="t-h3">{dict.service.inputsTitle}</h3>
                <CheckList items={service.inputs} className="mt-4" />
              </div>
            </>
          }
        >
          <ProcessSteps steps={service.workflow} />
        </EditorialSplit>
      </Section>

      {/* ------------------------------------------------------------ FAQ */}
      <Section labelledBy="service-faq-title" alt>
        <EditorialSplit aside={<SectionHeading id="service-faq-title" eyebrow={service.shortTitle} title={dict.service.faq} />}>
          <Faq items={service.faqs} />
        </EditorialSplit>
        <div className="mt-14 border-t border-line-subtle pt-12 empty:hidden">
          <RelatedTools
            catalog={tools}
            hrefs={toolHrefs(locale)}
            minutes={toolMinutes()}
            keys={SERVICE_TOOLS[service.key]}
            id="service-tools-title"
          />
        </div>
      </Section>

      {/* ------------------------------------------------------------ related articles */}
      {relatedArticles.length > 0 && (
        <Section labelledBy="service-articles-title">
          <SectionHeading id="service-articles-title" size="sm" title={dict.editorial.servicesArticles} />
          <ul className="mt-8 grid gap-5 md:grid-cols-2">
            {relatedArticles.map((article) => (
              <li key={article.slug}>
                <ArticleCard
                  article={article}
                  href={href(routes.article(article.slug))}
                  locale={locale}
                  labels={{ minutesRead: dict.common.minutesRead, readArticle: dict.common.readArticle }}
                  headingLevel={3}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ------------------------------------------------------------ related services */}
      <Section labelledBy="related-title" alt>
        <h2 id="related-title" className="t-h2 text-2xl sm:text-3xl">
          {dict.service.related}
        </h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {related.map((item) => (
            <li key={item.key}>
              <ServiceCard service={item} href={href(routes.service(item.slug))} cta={dict.common.learnMore} showCapabilities={false} />
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title={dict.service.ctaTitle}
        lead={dict.service.ctaLead}
        primary={{ href: contactHref, label: dict.nav.cta }}
        points={dict.cta.points}
      />
    </>
  );
}

function DomainPage({
  locale,
  domain,
  dict,
}: {
  locale: Parameters<typeof findDomain>[0];
  domain: DomainContent;
  dict: ReturnType<typeof getDictionary>;
}) {
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.service(domain.slug));
  return (
    <>
      <JsonLd
        data={serviceJsonLd({ title: domain.name, metaDescription: domain.metaDescription, path, type: domain.name }, locale)}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.services, path: href(routes.services) },
          { name: domain.name, path },
        ]}
      />
      <DomainHub locale={locale} domain={domain} definition={domainDefinition(domain.key)} dict={dict} />
    </>
  );
}
