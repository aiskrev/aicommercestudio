import { notFound } from "next/navigation";

import { AdvisorPromo } from "@/components/advisor/AdvisorPromo";
import { ArticleCard } from "@/components/editorial/ArticleCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { ServiceCard } from "@/components/sections/ServiceCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import {
  ButtonLink,
  CheckList,
  Container,
  Eyebrow,
  IconBadge,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import { articleByKey, findService, getContent, serviceByKey, serviceRoutePaths } from "@/content";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { contactWithService, quoteWithService, routes } from "@/lib/routes";
import { buildMetadata, faqJsonLd, serviceJsonLd } from "@/lib/seo";

export const dynamicParams = false;

/** Services whose visitors are offered the AI automation advisor. */
const ADVISOR_SERVICES = new Set(["automation", "ai_tools"]);

// Services with a dedicated route (e.g. uslugi/ai-managed-services) are not rendered by this template.
export function generateStaticParams({ params }: { params: { locale: string } }) {
  const { locale } = params;
  if (!isLocale(locale)) return [];
  return getContent(locale)
    .services.filter((service) => !service.customPage)
    .map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/uslugi/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
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
  const service = findService(locale, slug);
  if (!service || service.customPage) notFound();

  const dict = getDictionary(locale);
  const { home, advisor } = getContent(locale);
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.service(service.slug));
  const related = service.related.map((key) => serviceByKey(locale, key));
  const relatedArticles = service.relatedArticles
    .map((articleKey) => articleByKey(locale, articleKey))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const contactHref = href(contactWithService(service.key));
  const quoteHref = href(quoteWithService(service.key));

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
          { name: service.shortTitle, path },
        ]}
      />

      {/* ------------------------------------------------------------ hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.3fr_0.7fr] lg:items-start lg:py-20">
          <div>
            <div className="flex items-center gap-4">
              <IconBadge name={service.icon} className="h-12 w-12" />
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

          <aside className="card-accent rounded-2xl p-6" aria-labelledby="summary-title">
            <h2 id="summary-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {dict.service.summaryTitle}
            </h2>
            <dl className="mt-4 grid gap-4 text-sm">
              <div>
                <dt className="text-slate-400">{dict.service.engagement}</dt>
                <dd className="mt-1.5 flex flex-wrap gap-2">
                  {service.engagement.map((model) => (
                    <span key={model} className="badge badge-accent">
                      {model}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">{dict.service.deliverables}</dt>
                <dd className="mt-1 text-slate-200">{service.deliverables[0]}</dd>
              </div>
              <div>
                <dt className="text-slate-400">{dict.service.firstStepLabel}</dt>
                <dd className="mt-1 text-slate-200">{dict.service.firstStep}</dd>
              </div>
            </dl>
            <p className="mt-5 border-t border-white/[0.07] pt-4 text-xs leading-relaxed text-slate-400">
              {dict.service.pricingNote}
            </p>
          </aside>
        </Container>
      </div>

      {/* ------------------------------------------------------------ customer problems */}
      <Section labelledBy="problems-title">
        <SectionHeading id="problems-title" eyebrow={dict.service.problemsEyebrow} title={service.headings.problems} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {service.signals.map((signal) => (
            <li key={signal} className="card flex items-start gap-4 p-5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/[0.08] text-amber-200">
                <Icon name="alert" className="h-4.5 w-4.5" />
              </span>
              <p className="pt-1.5 leading-relaxed text-slate-200">{signal}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ capabilities */}
      <Section labelledBy="capabilities-title" alt>
        <SectionHeading id="capabilities-title" eyebrow={service.shortTitle} title={service.headings.capabilities} />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {service.capabilities.map((capability, index) => (
            <li key={capability.title} className="card p-6">
              <span className="font-display text-sm font-semibold text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="t-h3 mt-3">{capability.title}</h3>
              <p className="mt-2 leading-relaxed text-slate-400">{capability.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------ technical checks */}
      <Section labelledBy="checks-title">
        <SectionHeading id="checks-title" eyebrow={dict.service.checksEyebrow} title={service.headings.checks} />
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {service.checks.map((check) => (
            <li key={check.title} className="card flex gap-4 p-5">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <div>
                <h3 className="t-h3">{check.title}</h3>
                <p className="mt-1.5 leading-relaxed text-slate-400">{check.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ deliverables + engagement */}
      <Section labelledBy="deliverables-title" alt>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card p-6 sm:p-8">
            <h2 id="deliverables-title" className="t-h2 text-2xl sm:text-3xl">
              {service.headings.deliverables}
            </h2>
            <CheckList items={service.deliverables} className="mt-6" />
          </div>
          <div className="card-accent rounded-[1.25rem] p-6 sm:p-8">
            <h2 className="t-h2 text-2xl sm:text-3xl">{dict.service.engagement}</h2>
            <ul className="mt-6 grid gap-3">
              {service.engagement.map((model) => (
                <li key={model} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-950/50 px-4 py-3.5 text-slate-200">
                  <Icon name="layers" className="h-5 w-5 shrink-0 text-cyan-300" />
                  {model}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-400">{dict.service.pricingNote}</p>
            <ButtonLink href={quoteHref} icon="arrowRight" className="mt-6 w-full sm:w-auto">
              {dict.common.requestQuote}
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ process */}
      <Section labelledBy="service-process-title">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading id="service-process-title" eyebrow={home.process.eyebrow} title={service.headings.workflow} />
          <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight">
            {dict.service.fullProcess}
          </ButtonLink>
        </div>
        <ProcessTimeline steps={service.workflow} className="mt-14" />
        <div className="card mt-12 p-6 sm:p-8">
          <h3 className="t-h3 text-xl">{dict.service.inputsTitle}</h3>
          <CheckList items={service.inputs} className="mt-5 sm:grid-cols-2" />
        </div>
      </Section>

      {/* ------------------------------------------------------------ FAQ */}
      <Section labelledBy="service-faq-title" alt>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading id="service-faq-title" eyebrow={service.shortTitle} title={dict.service.faq} />
          <Faq items={service.faqs} />
        </div>
        {ADVISOR_SERVICES.has(service.key) && (
          <AdvisorPromo promo={advisor.promo} href={href(routes.advisor)} className="mt-12" />
        )}
      </Section>

      {/* ------------------------------------------------------------ related articles */}
      {relatedArticles.length > 0 && (
        <Section labelledBy="service-articles-title">
          <h2 id="service-articles-title" className="t-h2 text-2xl sm:text-3xl">
            {dict.editorial.servicesArticles}
          </h2>
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
