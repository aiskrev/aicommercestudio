import Link from "next/link";

import { AdvisorPromo } from "@/components/advisor/AdvisorPromo";
import { ArticleCard } from "@/components/editorial/ArticleCard";
import { AiPipeline } from "@/components/home/AiPipeline";
import { CapabilityMatrix } from "@/components/home/CapabilityMatrix";
import { HeroWorkflow } from "@/components/home/HeroWorkflow";
import { ProblemIndex } from "@/components/home/ProblemIndex";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { ServiceBento } from "@/components/sections/ServiceBento";
import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container, Eyebrow, Section, SectionHeading } from "@/components/ui/primitives";
import { categoryByKey, getContent, serviceByKey, sortedArticles } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata, faqJsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const { home } = getContent(locale);
  return buildMetadata({
    locale,
    title: home.metaTitle,
    description: home.metaDescription,
    path: routes.home,
    absoluteTitle: true,
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const { home, coreServices, industries, advisor } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const audit = serviceByKey(locale, "audit");
  const [featuredArticle, ...moreArticles] = sortedArticles(locale).slice(0, 4);
  const articleLabels = { minutesRead: dict.common.minutesRead, readArticle: dict.common.readArticle };

  return (
    <>
      <JsonLd data={faqJsonLd(home.faq.items)} />

      {/* ------------------------------------------------------------ hero */}
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.12fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
          <div>
            <Eyebrow>{home.hero.eyebrow}</Eyebrow>
            <h1 className="t-display mt-6">
              {home.hero.title} <span className="text-brand">{home.hero.titleHighlight}</span>
            </h1>
            <p className="t-lead mt-6 max-w-xl">{home.hero.lead}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={href(routes.contact)} size="lg" icon="arrowRight">
                {home.hero.primaryCta}
              </ButtonLink>
              <ButtonLink href={href(routes.services)} size="lg" variant="secondary">
                {home.hero.secondaryCta}
              </ButtonLink>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-secondary">
              {home.hero.highlights.map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 font-mono text-[12.5px] text-fg-subtle">{home.hero.context}</p>
          </div>
          <HeroWorkflow content={home.hero.workflow} />
        </Container>
      </div>

      {/* ------------------------------------------------------------ services */}
      <Section labelledBy="services-title">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            id="services-title"
            eyebrow={home.servicesIntro.eyebrow}
            title={home.servicesIntro.title}
            lead={home.servicesIntro.lead}
          />
          <ButtonLink href={href(routes.services)} variant="secondary" icon="arrowRight" className="self-start lg:self-auto">
            {dict.common.allServices}
          </ButtonLink>
        </div>
        <div className="mt-12">
          <ServiceBento
            services={coreServices}
            hrefFor={(service) => href(routes.service(service.slug))}
            cta={dict.common.learnMore}
          />
        </div>
        <Link
          href={href(routes.service(audit.slug))}
          className="group mt-4 flex flex-col gap-4 rounded-[var(--radius-lg)] border border-dashed border-line-strong px-6 py-5 transition-colors hover:border-brand/60 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-4">
            <ServiceMotif service="audit" className="hidden h-12 w-16 shrink-0 sm:block" />
            <span>
              <span className="t-label block text-brand">{dict.ui.firstStepBadge}</span>
              <span className="mt-1 block text-lg font-semibold text-fg">{audit.shortTitle}</span>
              <span className="mt-0.5 block max-w-2xl text-[15px] text-fg-muted">{audit.summary}</span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand">
            {dict.common.learnMore}
            <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </Section>

      {/* ------------------------------------------------------------ problems → services (light editorial) */}
      <Section labelledBy="problems-title" tone="light" density="spacious">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <SectionHeading id="problems-title" eyebrow={home.problems.eyebrow} title={home.problems.title} />
          <p className="t-lead lg:pb-1">{home.problems.lead}</p>
        </div>
        <ProblemIndex
          solutionLabel={home.problems.solutionLabel}
          rows={home.problems.items.map((item) => {
            const service = serviceByKey(locale, item.service);
            return {
              title: item.title,
              description: item.description,
              icon: item.icon,
              service: { title: service.shortTitle, href: href(routes.service(service.slug)) },
            };
          })}
        />
      </Section>

      {/* ------------------------------------------------------------ controlled AI workflow */}
      <Section labelledBy="ai-control-title" density="spacious">
        <SectionHeading
          id="ai-control-title"
          eyebrow={home.aiControl.eyebrow}
          title={home.aiControl.title}
          lead={home.aiControl.lead}
        />
        <AiPipeline
          stages={home.aiControl.stages}
          allowedTitle={home.aiControl.allowedTitle}
          allowed={home.aiControl.allowed}
          approvalTitle={home.aiControl.approvalTitle}
          approval={home.aiControl.approval}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={href(routes.aiSolutions)} variant="secondary" icon="arrowRight">
            {dict.nav.aiSolutions}
          </ButtonLink>
        </div>
        <AdvisorPromo promo={advisor.promo} href={href(routes.advisor)} className="mt-12" />
      </Section>

      {/* ------------------------------------------------------------ process */}
      <Section labelledBy="process-title" tone="raised">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading id="process-title" eyebrow={home.process.eyebrow} title={home.process.title} lead={home.process.lead} />
            <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight" className="mt-6">
              {dict.common.learnMore}
            </ButtonLink>
          </div>
          <ProcessSteps steps={home.process.steps} />
        </div>
      </Section>

      {/* ------------------------------------------------------------ capabilities (light) */}
      <Section labelledBy="capabilities-title" tone="light">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <SectionHeading
              id="capabilities-title"
              eyebrow={home.capabilities.eyebrow}
              title={home.capabilities.title}
              lead={home.capabilities.lead}
            />
            <h3 className="mt-10 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">
              {home.advantages.title}
            </h3>
            <ul className="mt-4 grid gap-4">
              {home.advantages.items.slice(0, 4).map((item) => (
                <li key={item.title} className="border-l-2 border-brand-ink pl-4">
                  <p className="font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-ink-muted">{item.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <CapabilityMatrix groups={home.capabilities.groups} />
        </div>
      </Section>

      {/* ------------------------------------------------------------ who we help + engagement */}
      <Section labelledBy="industries-title">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <SectionHeading
              id="industries-title"
              eyebrow={home.industriesIntro.eyebrow}
              title={home.industriesIntro.title}
              lead={home.industriesIntro.lead}
            />
            <ul className="mt-8 grid gap-x-8 sm:grid-cols-2">
              {industries.segments.slice(0, 6).map((segment) => (
                <li key={segment.title} className="flex gap-3 border-t border-line-subtle py-4">
                  {segment.icon && <Icon name={segment.icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand" />}
                  <span>
                    <span className="block font-semibold text-fg">{segment.title}</span>
                    <span className="mt-0.5 block text-[14.5px] leading-relaxed text-fg-muted">{segment.description}</span>
                  </span>
                </li>
              ))}
            </ul>
            <ButtonLink href={href(routes.industries)} variant="ghost" icon="arrowRight" className="mt-4">
              {home.industriesIntro.cta}
            </ButtonLink>
          </div>
          <div className="panel self-start p-6 sm:p-8">
            <p className="t-eyebrow">{home.engagement.eyebrow}</p>
            <h3 className="t-h3-lg mt-3">{home.engagement.title}</h3>
            <p className="mt-2 text-[15px] text-fg-muted">{home.engagement.lead}</p>
            <ul className="mt-6 grid gap-1">
              {home.engagement.items.map((item) => (
                <li key={item.title} className="flex gap-4 rounded-[var(--radius-md)] border-t border-line-subtle py-4 first:border-t-0">
                  {item.icon && (
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand">
                      <Icon name={item.icon} className="h-4 w-4" />
                    </span>
                  )}
                  <span>
                    <span className="block font-semibold text-fg">{item.title}</span>
                    <span className="mt-0.5 block text-[14.5px] leading-relaxed text-fg-muted">{item.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ insights (editorial) */}
      <Section labelledBy="latest-articles-title" tone="raised">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            id="latest-articles-title"
            eyebrow={dict.nav.insights}
            title={dict.editorial.latestTitle}
            lead={dict.editorial.latestLead}
          />
          <ButtonLink href={href(routes.insights)} variant="secondary" icon="arrowRight" className="self-start lg:self-auto">
            {dict.common.allArticles}
          </ButtonLink>
        </div>
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          {featuredArticle && (
            <ArticleCard
              article={featuredArticle}
              href={href(routes.article(featuredArticle.slug))}
              categoryName={categoryByKey(locale, featuredArticle.category)?.name}
              locale={locale}
              labels={articleLabels}
              headingLevel={3}
              variant="featured"
            />
          )}
          <div className="-mt-6 divide-y divide-line-subtle">
            {moreArticles.map((article) => (
              <ArticleCard
                key={article.slug}
                article={article}
                href={href(routes.article(article.slug))}
                categoryName={categoryByKey(locale, article.category)?.name}
                locale={locale}
                labels={articleLabels}
                headingLevel={3}
                variant="row"
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ FAQ */}
      <Section labelledBy="faq-title">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading id="faq-title" eyebrow={home.faq.eyebrow} title={home.faq.title} />
            <p className="mt-6 text-fg-muted">
              {dict.common.moreQuestions}{" "}
              <Link href={href(routes.contact)} className="font-semibold text-brand underline-offset-4 hover:underline">
                {dict.common.writeToUs}
              </Link>
            </p>
          </div>
          <Faq items={home.faq.items} />
        </div>
      </Section>

      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: home.finalCta.primary }}
        secondary={{ href: href(routes.service(audit.slug)), label: home.finalCta.secondary }}
      />
    </>
  );
}
