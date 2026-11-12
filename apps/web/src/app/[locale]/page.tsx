import Link from "next/link";

import { ConfiguratorEntry } from "@/components/configurator/ConfiguratorEntry";
import { CredibilityStrip } from "@/components/home/CredibilityStrip";
import { ToolsPreview } from "@/components/home/ToolsPreview";
import { CtaBand } from "@/components/sections/CtaBand";
import { FounderPortrait } from "@/components/sections/Founder";
import { Faq } from "@/components/sections/Faq";
import { PriceTag } from "@/components/sections/PriceTag";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { EditorialSplit } from "@/components/ui/patterns";
import { ButtonLink, Container, Eyebrow, Section, SectionHeading, cx } from "@/components/ui/primitives";
import { ArrowLink, Timeline, TickList } from "@/components/v5/blocks";
import { UiPreview } from "@/components/v5/UiPreview";
import { getContent, serviceByKey } from "@/content";
import type { HomeShowcaseCard } from "@/content/v5-types";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { SERVICE_PRICES } from "@/lib/prices";
import { PROJECT_PACKAGES, packagePrice } from "@/lib/project-packages";
import { quoteWithService, routes } from "@/lib/routes";
import { buildMetadata, faqJsonLd } from "@/lib/seo";
import { toolHrefs, toolMinutes } from "@/lib/tools";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const { v5 } = getContent(locale);
  return buildMetadata({
    locale,
    title: v5.home.metaTitle,
    description: v5.home.metaDescription,
    path: routes.home,
    absoluteTitle: true,
  });
}

/** Bento placement of the four showcase cards (docs/V5_DESIGN_SYSTEM.md → Bento). */
const BENTO: Record<HomeShowcaseCard["key"], string> = {
  website: "bento-wide",
  store: "bento-narrow",
  platform: "bento-narrow",
  ai: "bento-wide",
};

/**
 * Homepage, V5 (docs/V5_VISUAL_DIRECTION.md §6). One story in order: hero (websites, stores and AI); four
 * directions with previews and indicative prices; website development (types, static vs interactive); online
 * stores (three platforms); the six-stage process; free tools and labelled demonstrations; entry packages; the
 * engineering practices we can be checked on; the founder (protected, unchanged); FAQ; the final call to action.
 * Every link goes to a page that exists with the default flags: the configurator button is drawn only while the
 * configurator is switched on, otherwise the quote form is the working path.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const { v5, advisor, tools, founder, home: legacyHome, projectPackages, carePlans } = getContent(locale);
  const home = v5.home;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const quoteHref = href(`${routes.contact}?tip=oferta`);
  const cardHref: Record<HomeShowcaseCard["key"], string> = {
    website: href(routes.websites),
    store: href(routes.ecommerce),
    platform: href(routes.service(serviceByKey(locale, "portals_web_apps").slug)),
    ai: href(routes.service(serviceByKey(locale, "automation").slug)),
  };

  return (
    <>
      <JsonLd data={faqJsonLd(home.faq.items)} />

      {/* 1 ---------------------------------------------------------------- hero */}
      <div className="hero-v5 relative overflow-hidden">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container size="wide" className="relative grid items-center gap-12 pb-14 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 lg:pb-20 lg:pt-16">
          <div className="min-w-0">
            <Eyebrow>{home.hero.eyebrow}</Eyebrow>
            <h1 className="t-hero mt-6">
              {home.hero.title} <span className="text-brand">{home.hero.titleHighlight}</span>
            </h1>
            <p className="t-lead mt-6 max-w-xl">{home.hero.lead}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href={href(routes.services)} size="lg" icon="arrowRight" testId="hero-primary">
                {home.hero.primaryCta}
              </ButtonLink>
              <ButtonLink href={quoteHref} size="lg" variant="secondary" testId="hero-secondary">
                {home.hero.secondaryCta}
              </ButtonLink>
              <ConfiguratorEntry href={href(routes.configurator)} label={home.hero.configureCta} variant="secondary" className="btn-lg" />
            </div>
            <ul className="mt-8 grid gap-x-6 gap-y-2.5 text-sm text-fg-secondary sm:grid-cols-2">
              {home.hero.points.map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Composite preview: a website, a store and an automation, one caption for all three. */}
          <figure className="min-w-0" data-testid="hero-preview">
            <div className="relative lg:pb-16 lg:pr-10">
              <UiPreview kind="static" />
              <UiPreview kind="store" compact className="absolute -bottom-4 right-0 hidden w-[50%] lg:block" />
              <UiPreview kind="ai" compact className="absolute -left-6 bottom-6 hidden w-[42%] xl:block" />
            </div>
            <figcaption className="t-label mt-4">{home.hero.previewCaption}</figcaption>
          </figure>
        </Container>
      </div>

      {/* 2 ---------------------------------------------------------------- four directions (bento) */}
      <Section labelledBy="showcase-title" size="wide">
        <SectionHeading id="showcase-title" eyebrow={home.showcase.eyebrow} title={home.showcase.title} lead={home.showcase.lead} />
        <ul className="bento mt-stack" data-testid="home-showcase">
          {home.showcase.cards.map((card) => {
            const service = serviceByKey(locale, card.service);
            return (
              <li key={card.key} className={cx("offer-card", BENTO[card.key])} data-testid={`showcase-${card.key}`}>
                <div className="offer-stage">
                  <UiPreview kind={card.preview} compact className="translate-y-px" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="t-h3-lg">
                    <Link href={cardHref[card.key]} className="hover:text-brand focus-visible:outline-none" data-testid={`showcase-link-${card.key}`}>
                      {card.title}
                    </Link>
                  </h3>
                  <p className="mt-2 leading-relaxed text-fg-muted">{card.text}</p>
                  <p className="mt-3 text-body-sm text-fg-secondary">
                    <span className="font-semibold text-fg">{home.showcase.audienceLabel}: </span>
                    {card.audience}
                  </p>
                  <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line-subtle pt-5">
                    <div>
                      <PriceTag locale={locale} price={SERVICE_PRICES[card.service]} testId={`showcase-price-${card.key}`} />
                      <p className="mt-1 text-xs text-fg-subtle">{home.showcase.priceNote}</p>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <ArrowLink href={cardHref[card.key]} label={card.more} />
                      <Link href={href(quoteWithService(card.service))} className="link text-sm" data-testid={`showcase-quote-${card.key}`} aria-label={`${home.showcase.quoteLabel}: ${service.shortTitle}`}>
                        {home.showcase.quoteLabel}
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-fg-subtle">{home.hero.previewCaption}</p>
      </Section>

      {/* 3 ---------------------------------------------------------------- website development */}
      <Section labelledBy="websites-title" tone="raised" size="wide">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div className="min-w-0">
            <Eyebrow>{home.websites.eyebrow}</Eyebrow>
            <h2 id="websites-title" className="t-h2 reveal mt-4">
              {home.websites.title}
            </h2>
            <p className="t-lead mt-5">{home.websites.lead}</p>
            <div className="mt-8 grid gap-4 rounded-[var(--radius-xl)] border border-line-subtle bg-surface-page p-5" data-testid="static-vs-interactive">
              <p className="font-semibold text-fg">{home.websites.staticVsInteractive.title}</p>
              <p className="text-body-sm leading-relaxed text-fg-muted">
                <span className="badge mr-2">{home.websites.types[1].title}</span>
                {home.websites.staticVsInteractive.static}
              </p>
              <p className="text-body-sm leading-relaxed text-fg-muted">
                <span className="badge badge-accent mr-2">{home.websites.types[3].title}</span>
                {home.websites.staticVsInteractive.interactive}
              </p>
            </div>
            <ButtonLink href={`${href(routes.websites)}#compare`} variant="secondary" icon="arrowRight" className="mt-6">
              {home.websites.cta}
            </ButtonLink>
          </div>
          <ul className="grid content-start gap-4 sm:grid-cols-2">
            {home.websites.types.map((type, index) => (
              <li key={type.id} className="card card-interactive focus-frame flex flex-col p-6">
                <span className="flex items-center justify-between gap-3">
                  <span className="t-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="badge">{type.tag}</span>
                </span>
                <h3 className="t-h3-lg mt-5">
                  <Link href={`${href(routes.websites)}#${type.id}`} className="after:absolute after:inset-0">
                    {type.title}
                  </Link>
                </h3>
                <p className="mt-2 leading-relaxed text-fg-muted">{type.text}</p>
                <Icon name="arrowRight" className="arrow-nudge mt-4 h-4 w-4 self-end text-brand" />
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 4 ---------------------------------------------------------------- online stores */}
      <Section labelledBy="stores-title" size="wide">
        <SectionHeading
          id="stores-title"
          eyebrow={home.stores.eyebrow}
          title={home.stores.title}
          lead={home.stores.lead}
          action={
            <ButtonLink href={`${href(routes.ecommerce)}#costs`} variant="secondary" icon="arrowRight">
              {home.stores.cta}
            </ButtonLink>
          }
        />
        <ul className="mt-stack grid gap-4 md:grid-cols-3">
          {home.stores.platforms.map((platform) => (
            <li key={platform.id} className="card card-interactive focus-frame flex flex-col p-6">
              <Icon name={platform.id === "custom" ? "layers" : "store"} className="h-6 w-6 text-brand" />
              <h3 className="t-h3-lg mt-4">
                <Link href={`${href(routes.ecommerce)}#${platform.id}`} className="after:absolute after:inset-0">
                  {platform.title}
                </Link>
              </h3>
              <p className="mt-2 leading-relaxed text-fg-muted">{platform.text}</p>
              <p className="mt-auto pt-5 text-sm font-medium text-fg-secondary">
                <Icon name="check" className="mr-2 inline h-4 w-4 text-success" />
                {platform.fit}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-5 max-w-3xl text-sm text-fg-subtle">{home.stores.note}</p>
      </Section>

      {/* 5 ---------------------------------------------------------------- process */}
      <Section labelledBy="process-title" tone="deep" size="wide">
        <SectionHeading
          id="process-title"
          eyebrow={home.process.eyebrow}
          title={home.process.title}
          lead={home.process.lead}
          action={
            <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight">
              {home.process.link}
            </ButtonLink>
          }
        />
        <Timeline steps={home.process.steps} className="mt-stack" testId="home-timeline" />
      </Section>

      {/* 6 ---------------------------------------------------------------- tools and labelled demonstrations */}
      <Section labelledBy="tools-title" size="wide">
        <SectionHeading
          id="tools-title"
          eyebrow={home.tools.eyebrow}
          title={home.tools.title}
          lead={home.tools.lead}
          action={
            <ButtonLink href={href(routes.tools)} variant="secondary" icon="arrowRight">
              {home.tools.toolsCta}
            </ButtonLink>
          }
        />
        <div className="mt-stack grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <div className="min-w-0">
            <ToolsPreview catalog={tools} hrefs={toolHrefs(locale)} minutes={toolMinutes()} showcase={advisor.showcase} startBadge={legacyHome.tools.startBadge} compact />
          </div>
          <div className="feature-panel flex min-w-0 flex-col self-start p-6" data-testid="home-demos">
            <UiPreview kind="ai" compact />
            <h3 className="t-h3-lg mt-6">{home.tools.demosTitle}</h3>
            <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">{home.tools.demosText}</p>
            <div className="flex flex-wrap gap-x-5 pt-4">
              <ArrowLink href={href(routes.demoCentre)} label={home.tools.demosCta} />
              <ArrowLink href={href(routes.scenarios)} label={home.tools.scenariosCta} />
            </div>
          </div>
        </div>
      </Section>

      {/* 7 ---------------------------------------------------------------- entry offers */}
      <Section labelledBy="offers-title" tone="raised" size="wide">
        <SectionHeading
          id="offers-title"
          eyebrow={home.offers.eyebrow}
          title={home.offers.title}
          lead={home.offers.lead}
          action={
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={href(routes.projectPackages)} variant="secondary" icon="arrowRight">
                {home.offers.compareCta}
              </ButtonLink>
              <ButtonLink href={href(routes.pricing)} variant="ghost" icon="arrowRight">
                {home.offers.pricingCta}
              </ButtonLink>
            </div>
          }
        />
        <ul className="mt-stack grid gap-4 sm:grid-cols-2 xl:grid-cols-5" data-testid="home-offers">
          {home.offers.packages.map((key) => {
            const definition = PROJECT_PACKAGES.find((item) => item.key === key)!;
            const text = projectPackages.packages[key];
            const price = packagePrice(definition);
            return (
              <li key={key} className="price-card" data-testid={`home-offer-${key}`}>
                <h3 className="t-h3">{text.name}</h3>
                <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">{text.objective}</p>
                <div className="mt-5 border-t border-line-subtle pt-4">
                  {price ? <PriceTag locale={locale} price={price} /> : <p className="font-display text-lg font-semibold text-fg">{projectPackages.labels.priceOnQuote}</p>}
                </div>
                <div className="mt-auto pt-5">
                  <ArrowLink href={`${href(routes.projectPackages)}#${key}`} label={projectPackages.labels.more} />
                </div>
              </li>
            );
          })}
          <li className="price-card price-card-featured" data-testid="home-offer-care">
            <h3 className="t-h3">{home.offers.careTitle}</h3>
            <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">{home.offers.careText}</p>
            <TickList items={carePlans.plans.website.covers} className="mt-5" />
            <div className="mt-auto pt-5">
              <ArrowLink href={href(routes.carePlans)} label={home.offers.careCta} />
            </div>
          </li>
        </ul>
        <p className="mt-4 text-xs text-fg-subtle">{projectPackages.note}</p>
      </Section>

      {/* 8 ---------------------------------------------------------------- engineering practices (no certificates, logos or numbers) */}
      <CredibilityStrip label={home.practices.title} lead={home.practices.lead} groups={home.practices.groups} />

      {/* 9 ---------------------------------------------------------------- who builds it: founder (protected content, unchanged) */}
      <Section labelledBy="founder-title">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
          <FounderPortrait alt={founder.portraitAlt} sizes="(min-width: 1024px) 17rem, (min-width: 768px) 15rem, 12rem" className="aspect-[4/5] w-48 md:w-full" />
          <div className="min-w-0">
            <Eyebrow>{founder.home.eyebrow}</Eyebrow>
            <h2 id="founder-title" className="t-h2 mt-4">
              {founder.name}
            </h2>
            <p className="mt-2 font-medium text-fg-secondary">{founder.title}</p>
            <div className="measure mt-5 grid gap-4 leading-relaxed text-fg-muted">
              {founder.home.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <ButtonLink href={href(routes.founder)} variant="ghost" icon="arrowRight" className="mt-6">
              {founder.home.cta}
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* 10 --------------------------------------------------------------- FAQ */}
      <Section labelledBy="faq-title" tone="raised">
        <EditorialSplit
          sticky
          aside={
            <>
              <SectionHeading id="faq-title" title={home.faq.title} />
              <p className="mt-6 text-fg-muted">
                {dict.common.moreQuestions}{" "}
                <Link href={href(routes.contact)} className="link">
                  {dict.common.writeToUs}
                </Link>
              </p>
            </>
          }
        >
          <Faq items={home.faq.items} />
        </EditorialSplit>
      </Section>

      {/* 11 --------------------------------------------------------------- final CTA */}
      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: quoteHref, label: home.finalCta.primary }}
        secondary={{ href: href(routes.projectPackages), label: home.finalCta.secondary }}
        emphasis
      />
    </>
  );
}
