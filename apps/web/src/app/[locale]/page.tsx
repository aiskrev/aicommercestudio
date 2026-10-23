import Link from "next/link";

import { AdvisorPromo } from "@/components/advisor/AdvisorPromo";
import { ArticleCard } from "@/components/editorial/ArticleCard";
import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { HeroVisual } from "@/components/sections/HeroVisual";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { ServiceCard } from "@/components/sections/ServiceCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import {
  ButtonLink,
  Container,
  Eyebrow,
  FeatureCard,
  IconBadge,
  Section,
  SectionHeading,
} from "@/components/ui/primitives";
import { findCategory, getContent, serviceByKey, sortedArticles } from "@/content";
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
  const latestArticles = sortedArticles(locale).slice(0, 3);

  return (
    <>
      <JsonLd data={faqJsonLd(home.faq.items)} />

      {/* ------------------------------------------------------------ hero */}
      <div className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-14 pb-16 pt-14 sm:pb-20 sm:pt-20 lg:grid-cols-[1.08fr_1fr] lg:pb-24 lg:pt-24">
          <div>
            <Eyebrow>{home.hero.eyebrow}</Eyebrow>
            <h1 className="t-display mt-6">
              {home.hero.title} <span className="text-gradient">{home.hero.titleHighlight}</span>
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
            <ul className="mt-10 flex flex-wrap gap-2">
              {home.hero.highlights.map((item) => (
                <li key={item} className="badge">
                  <Icon name="check" className="h-3.5 w-3.5 text-cyan-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden md:block">
            <HeroVisual />
          </div>
        </Container>
      </div>

      {/* ------------------------------------------------------------ technologies */}
      <div className="border-y border-white/[0.06] bg-ink-900/60">
        <Container className="flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:gap-10">
          <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {home.technologies.label}
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-300">
            {home.technologies.items.map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-cyan-400/70" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
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
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreServices.map((service, index) => (
            <li key={service.key}>
              <ServiceCard
                service={service}
                href={href(routes.service(service.slug))}
                cta={dict.common.learnMore}
                index={index}
              />
            </li>
          ))}
        </ul>
        <div className="card card-interactive card-accent mt-5 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-4">
            <IconBadge name={audit.icon} />
            <div>
              <p className="badge badge-accent mb-2">Препоръчителна първа стъпка</p>
              <h3 className="t-h3 text-xl">
                <Link href={href(routes.service(audit.slug))} className="after:absolute after:inset-0 focus-visible:outline-none">
                  {audit.shortTitle}
                </Link>
              </h3>
              <p className="mt-1 max-w-2xl text-slate-400">{audit.summary}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-cyan-300" aria-hidden="true">
            {dict.common.learnMore}
            <Icon name="arrowRight" className="h-4 w-4" />
          </span>
        </div>
      </Section>

      {/* ------------------------------------------------------------ problems → solutions */}
      <Section labelledBy="problems-title" alt>
        <SectionHeading id="problems-title" eyebrow={home.problems.eyebrow} title={home.problems.title} lead={home.problems.lead} />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {home.problems.items.map((item) => {
            const service = serviceByKey(locale, item.service);
            return (
              <li key={item.title} className="card flex flex-col p-6">
                {item.icon && <IconBadge name={item.icon} />}
                <h3 className="t-h3 mt-5">{item.title}</h3>
                <p className="mt-2 flex-1 leading-relaxed text-slate-400">{item.description}</p>
                <Link
                  href={href(routes.service(service.slug))}
                  className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm transition-colors hover:border-cyan-400/40"
                >
                  <span>
                    <span className="block text-xs text-slate-400">{home.problems.solutionLabel}</span>
                    <span className="font-semibold text-white">{service.shortTitle}</span>
                  </span>
                  <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-cyan-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ industries */}
      <Section labelledBy="industries-title">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              id="industries-title"
              eyebrow={home.industriesIntro.eyebrow}
              title={home.industriesIntro.title}
              lead={home.industriesIntro.lead}
            />
            <ButtonLink href={href(routes.industries)} variant="secondary" icon="arrowRight" className="mt-8">
              {home.industriesIntro.cta}
            </ButtonLink>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {industries.segments.slice(0, 6).map((segment) => (
              <li key={segment.title} className="card p-6">
                {segment.icon && <IconBadge name={segment.icon} />}
                <h3 className="t-h3 mt-4">{segment.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{segment.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------------------ process */}
      <Section labelledBy="process-title" alt>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading id="process-title" eyebrow={home.process.eyebrow} title={home.process.title} />
          <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight">
            {dict.common.learnMore}
          </ButtonLink>
        </div>
        <ProcessTimeline steps={home.process.steps} className="mt-14" />
      </Section>

      {/* ------------------------------------------------------------ AI with human control */}
      <Section labelledBy="ai-control-title">
        <div className="card-accent relative overflow-hidden rounded-[1.75rem] p-6 sm:p-10 lg:p-12">
          <div className="hero-glow pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="relative">
            <SectionHeading
              id="ai-control-title"
              eyebrow={home.aiControl.eyebrow}
              title={home.aiControl.title}
              lead={home.aiControl.lead}
            />
            <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {home.aiControl.steps.map((step, index) => (
                <li key={step.title} className="relative rounded-2xl border border-white/[0.08] bg-ink-950/60 p-5">
                  <div className="flex items-center justify-between">
                    {step.icon && <IconBadge name={step.icon} className="h-10 w-10" />}
                    <span className="font-display text-sm font-semibold text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="t-h3 mt-4">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400">{step.description}</p>
                  {index < home.aiControl.steps.length - 1 && (
                    <Icon
                      name="arrowRight"
                      className="absolute -right-3.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-cyan-300/70 xl:block"
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ use cases */}
      <Section labelledBy="usecases-title" alt>
        <SectionHeading id="usecases-title" eyebrow={home.useCases.eyebrow} title={home.useCases.title} lead={home.useCases.lead} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {home.useCases.items.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
        <div className="mt-8">
          <ButtonLink href={href(routes.aiSolutions)} variant="secondary" icon="arrowRight">
            {dict.nav.aiSolutions}
          </ButtonLink>
        </div>
        <AdvisorPromo promo={advisor.promo} href={href(routes.advisor)} className="mt-12" />
      </Section>

      {/* ------------------------------------------------------------ advantages */}
      <Section labelledBy="advantages-title">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading id="advantages-title" eyebrow={home.advantages.eyebrow} title={home.advantages.title} />
          </div>
          <ul className="grid gap-4">
            {home.advantages.items.map((item) => (
              <li key={item.title} className="card flex gap-5 p-6">
                {item.icon && <IconBadge name={item.icon} />}
                <div>
                  <h3 className="t-h3">{item.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-slate-400">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------------------ engagement models */}
      <Section labelledBy="engagement-title" alt>
        <SectionHeading
          id="engagement-title"
          eyebrow={home.engagement.eyebrow}
          title={home.engagement.title}
          lead={home.engagement.lead}
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {home.engagement.items.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ latest articles */}
      <Section labelledBy="latest-articles-title">
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
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {latestArticles.map((article) => (
            <li key={article.slug}>
              <ArticleCard
                article={article}
                href={href(routes.article(article.slug))}
                categoryName={findCategory(locale, article.category)?.name}
                locale={locale}
                labels={{ minutesRead: dict.common.minutesRead, readArticle: dict.common.readArticle }}
                headingLevel={3}
              />
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------ FAQ */}
      <Section labelledBy="faq-title" alt>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading id="faq-title" eyebrow={home.faq.eyebrow} title={home.faq.title} />
            <p className="mt-6 text-slate-400">
              {dict.common.moreQuestions}{" "}
              <Link href={href(routes.contact)} className="font-semibold text-cyan-300 underline-offset-4 hover:underline">
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
        points={dict.cta.points}
      />
    </>
  );
}
