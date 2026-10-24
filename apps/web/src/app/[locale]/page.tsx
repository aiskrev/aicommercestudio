import Link from "next/link";

import { ArticleCard } from "@/components/editorial/ArticleCard";
import { AdvisorShowcase } from "@/components/home/AdvisorShowcase";
import { AiPipeline } from "@/components/home/AiPipeline";
import { CredibilityStrip } from "@/components/home/CredibilityStrip";
import { HeroWorkflow } from "@/components/home/HeroWorkflow";
import { ManagedFeature } from "@/components/home/ManagedFeature";
import { ProblemIndex } from "@/components/home/ProblemIndex";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { ServiceShowcase } from "@/components/sections/ServiceShowcase";
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
  const { home, coreServices, advisor, aiManaged } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const audit = serviceByKey(locale, "audit");
  const managed = serviceByKey(locale, "ai_managed");
  const managedHref = href(routes.service(managed.slug));
  const [featuredArticle, ...moreArticles] = sortedArticles(locale).slice(0, 4);
  const articleLabels = { minutesRead: dict.common.minutesRead, readArticle: dict.common.readArticle };

  return (
    <>
      <JsonLd data={faqJsonLd(home.faq.items)} />

      {/* 1 ---------------------------------------------------------------- hero */}
      <div className="relative overflow-hidden">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-10 pb-14 pt-10 sm:gap-12 sm:pt-16 lg:grid-cols-[1.12fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
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
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-secondary">
              {home.hero.highlights.map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <HeroWorkflow content={home.hero.workflow} />
        </Container>
      </div>

      {/* 2 ---------------------------------------------------------------- credibility */}
      <CredibilityStrip label={home.capabilities.eyebrow} groups={home.capabilities.groups} />

      {/* 3 ---------------------------------------------------------------- curated services */}
      <Section labelledBy="services-title" density="spacious">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
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
        <div className="mt-14">
          <ServiceShowcase
            services={coreServices}
            hrefFor={(service) => href(routes.service(service.slug))}
            cta={dict.common.learnMore}
            groups={home.servicesIntro.groups}
          />
        </div>
        <Link
          href={href(routes.service(audit.slug))}
          className="group mt-10 flex flex-col gap-4 rounded-[var(--radius-lg)] border border-dashed border-line-strong px-6 py-5 transition-colors hover:border-brand/60 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-4">
            <ServiceMotif service="audit" className="hidden h-12 w-16 shrink-0 sm:block" />
            <span>
              <span className="block text-[13px] font-semibold text-brand">{dict.ui.firstStepBadge}</span>
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

      {/* 4 ---------------------------------------------------------------- problems → solutions (light) */}
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

      {/* 5 ---------------------------------------------------------------- controlled AI workflow (full-width editorial headline) */}
      <Section labelledBy="ai-control-title" density="spacious">
        <div className="max-w-4xl">
          <Eyebrow>{home.aiControl.eyebrow}</Eyebrow>
          <h2 id="ai-control-title" className="t-display mt-5 text-[clamp(2.1rem,1.4rem+2.6vw,3.6rem)]">
            {home.aiControl.title}
          </h2>
          <p className="t-lead mt-6 max-w-3xl">{home.aiControl.lead}</p>
        </div>
        <AiPipeline
          stages={home.aiControl.stages}
          allowedTitle={home.aiControl.allowedTitle}
          allowed={home.aiControl.allowed}
          approvalTitle={home.aiControl.approvalTitle}
          approval={home.aiControl.approval}
        />
        <ButtonLink href={href(routes.aiSolutions)} variant="ghost" icon="arrowRight" className="mt-6">
          {dict.nav.aiSolutions}
        </ButtonLink>
      </Section>

      {/* 6 ---------------------------------------------------------------- AI Managed Services feature */}
      <Section labelledBy="managed-title" tone="raised" density="spacious">
        <ManagedFeature
          id="managed-title"
          eyebrow={aiManaged.hero.eyebrow}
          title={aiManaged.hero.title}
          lead={aiManaged.hero.positioning}
          diagram={aiManaged.diagram}
          plans={aiManaged.packages.items.map((plan) => ({ key: plan.key, name: plan.name, audience: plan.audience }))}
          priceLabel={aiManaged.packages.priceLabel}
          primary={{ href: `${managedHref}#ams-inquiry`, label: aiManaged.hero.primaryCta }}
          secondary={{ href: managedHref, label: dict.common.learnMore }}
        />
      </Section>

      {/* 7 ---------------------------------------------------------------- process (horizontal timeline) */}
      <Section labelledBy="process-title">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <SectionHeading id="process-title" eyebrow={home.process.eyebrow} title={home.process.title} lead={home.process.lead} />
          <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight" className="self-start lg:self-auto">
            {dict.common.learnMore}
          </ButtonLink>
        </div>
        <div className="mt-14">
          <ProcessSteps steps={home.process.steps} layout="horizontal" />
        </div>
      </Section>

      {/* 8 ---------------------------------------------------------------- advisor product showcase (light) */}
      <Section labelledBy="advisor-showcase-title" tone="light" density="spacious">
        <AdvisorShowcase
          id="advisor-showcase-title"
          content={advisor.showcase}
          steps={advisor.steps}
          stepsTitle={advisor.stepsTitle}
          href={href(routes.advisor)}
        />
      </Section>

      {/* 9 ---------------------------------------------------------------- insights */}
      <Section labelledBy="latest-articles-title">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
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

      {/* 10 --------------------------------------------------------------- FAQ */}
      <Section labelledBy="faq-title" tone="raised">
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

      {/* 11 --------------------------------------------------------------- conversion */}
      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: home.finalCta.primary }}
        secondary={{ href: href(routes.service(audit.slug)), label: home.finalCta.secondary }}
        emphasis
      />
    </>
  );
}
