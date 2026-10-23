import Link from "next/link";

import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { HeroVisual } from "@/components/sections/HeroVisual";
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
import { getContent, serviceByKey } from "@/content";
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
  const { home, coreServices } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const audit = serviceByKey(locale, "audit");

  return (
    <>
      <JsonLd data={faqJsonLd(home.faq.items)} />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <Eyebrow>{home.hero.eyebrow}</Eyebrow>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] sm:text-5xl xl:text-6xl">
              {home.hero.title} <span className="text-gradient">{home.hero.titleHighlight}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400 sm:text-xl">{home.hero.lead}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={href(routes.contact)} size="lg" icon="arrowRight">
                {home.hero.primaryCta}
              </ButtonLink>
              <ButtonLink href={href(routes.services)} size="lg" variant="secondary">
                {home.hero.secondaryCta}
              </ButtonLink>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
              {home.hero.highlights.map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 text-cyan-300" />
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

      {/* Services */}
      <Section labelledBy="services-title" className="border-t border-white/5">
        <SectionHeading
          id="services-title"
          eyebrow={home.servicesIntro.eyebrow}
          title={home.servicesIntro.title}
          lead={home.servicesIntro.lead}
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreServices.map((service) => (
            <li key={service.key}>
              <Link
                href={href(routes.service(service.slug))}
                className="glass glass-hover group flex h-full flex-col rounded-2xl p-6"
              >
                <IconBadge name={service.icon} />
                <h3 className="mt-5 text-lg font-semibold">{service.shortTitle}</h3>
                <p className="mt-2 flex-1 leading-relaxed text-slate-400">{service.summary}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300">
                  {dict.common.learnMore}
                  <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href={href(routes.service(audit.slug))}
          className="glass glass-hover mt-5 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-4">
            <IconBadge name={audit.icon} />
            <div>
              <h3 className="text-lg font-semibold">{audit.shortTitle}</h3>
              <p className="mt-1 text-slate-400">{audit.summary}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-cyan-300">
            {dict.common.learnMore}
            <Icon name="arrowRight" className="h-4 w-4" />
          </span>
        </Link>
      </Section>

      {/* Problems */}
      <Section labelledBy="problems-title" className="bg-ink-900/50">
        <SectionHeading id="problems-title" eyebrow={home.problems.eyebrow} title={home.problems.title} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {home.problems.items.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>

      {/* Process */}
      <Section labelledBy="process-title">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading id="process-title" eyebrow={home.process.eyebrow} title={home.process.title} />
          <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight">
            {dict.common.learnMore}
          </ButtonLink>
        </div>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {home.process.steps.map((step, index) => (
            <li key={step.title} className="glass relative rounded-2xl p-6">
              <span className="font-display text-sm font-semibold text-cyan-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-slate-400">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Use cases */}
      <Section labelledBy="usecases-title" className="bg-ink-900/50">
        <SectionHeading
          id="usecases-title"
          eyebrow={home.useCases.eyebrow}
          title={home.useCases.title}
          lead={home.useCases.lead}
        />
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
      </Section>

      {/* Advantages */}
      <Section labelledBy="advantages-title">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading id="advantages-title" eyebrow={home.advantages.eyebrow} title={home.advantages.title} />
          </div>
          <ul className="grid gap-4">
            {home.advantages.items.map((item) => (
              <li key={item.title} className="glass flex gap-5 rounded-2xl p-6">
                {item.icon && <IconBadge name={item.icon} />}
                <div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-slate-400">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Engagement models */}
      <Section labelledBy="engagement-title" className="bg-ink-900/50">
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

      {/* FAQ */}
      <Section labelledBy="faq-title">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading id="faq-title" eyebrow={home.faq.eyebrow} title={home.faq.title} />
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
