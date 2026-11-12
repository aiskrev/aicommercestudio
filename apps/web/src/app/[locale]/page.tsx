import Link from "next/link";

import { ConfiguratorEntry } from "@/components/configurator/ConfiguratorEntry";
import { AiWorkflowDemo } from "@/components/future/AiWorkflowDemo";
import { compareData } from "@/components/future/compare-data";
import { IntegrationFlow } from "@/components/future/IntegrationFlow";
import { PackageExplorer, type PackageCard } from "@/components/future/PackageExplorer";
import { ProcessStepper } from "@/components/future/ProcessStepper";
import { ProductShowcase } from "@/components/future/ProductShowcase";
import { ServiceComparison } from "@/components/future/ServiceComparison";
import { ShowcaseMock } from "@/components/future/ShowcaseMock";
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
import { ArrowLink, TickList } from "@/components/v5/blocks";
import { type PreviewKind, UiPreview } from "@/components/v5/UiPreview";
import { getContent, serviceByKey } from "@/content";
import type { FutureCardKey, ShowcaseKey } from "@/content/v5-types";
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

/** Accent of each service card: cyan only for the AI direction (docs/V5_VISUAL_DIRECTION.md → colour). */
/** Bento placement (docs/V5_DESIGN_SYSTEM.md → Bento): wide and narrow cards alternate. */
const BENTO: Record<FutureCardKey, string> = { website: "bento-wide", store: "bento-narrow", platform: "bento-narrow", ai: "bento-wide" };

/** Wide cards carry a small decorative preview on the right (covered by the hero caption: sample screens). */
const CARD_PREVIEW: Partial<Record<FutureCardKey, PreviewKind>> = { website: "static", ai: "ai" };

const CARD_TONE: Partial<Record<FutureCardKey, string>> = { ai: "var(--color-brand-2)" };

/**
 * Homepage, Future Commerce (docs/FUTURE_COMMERCE_REDESIGN_REPORT.md), on the V5 tokens and components.
 * 1 interactive hero · 2 four service cards (details on hover and keyboard focus) · 3 tabbed product showcase ·
 * 4 service comparison (static ↔ CMS ↔ interactive ↔ store ↔ application) · 5 interactive process timeline ·
 * 6 integration flow · 7 package comparison · 8 AI workflow demo and the free tools · 9 engineering practices ·
 * 10 the founder (protected portrait, unchanged) · 11 FAQ · 12 final call to action. Light (paper) and dark
 * sections alternate. Every link goes to a page that exists with the default flags; the configurator button is
 * drawn only while the configurator is switched on.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const { v5, advisor, tools, founder, home: legacyHome, projectPackages, carePlans } = getContent(locale);
  const home = v5.home;
  const fc = v5.future;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const quoteHref = href(`${routes.contact}?tip=oferta`);
  const servicePage = (key: Parameters<typeof serviceByKey>[1]) => href(routes.service(serviceByKey(locale, key).slug));
  const cardHref: Record<FutureCardKey, string> = {
    website: href(routes.websites),
    store: href(routes.ecommerce),
    platform: servicePage("portals_web_apps"),
    ai: servicePage("automation"),
  };
  const showcaseHref: Record<ShowcaseKey, string> = {
    corporate: `${href(routes.websites)}#corporate`,
    interactive: `${href(routes.websites)}#interactive`,
    store: href(routes.ecommerce),
    saas: servicePage("portals_web_apps"),
  };
  const corporate = fc.showcase.items[0];

  const compare = compareData(locale);

  const packageCards: PackageCard[] = PROJECT_PACKAGES.map((definition) => {
    const text = projectPackages.packages[definition.key];
    const price = packagePrice(definition);
    return {
      key: definition.key,
      name: text.name,
      objective: text.objective,
      scope: text.compare.scope,
      payments: text.compare.payments,
      integrations: text.compare.integrations,
      delivery: projectPackages.delivery[definition.delivery],
      care: definition.carePlan ? carePlans.plans[definition.carePlan].name : projectPackages.labels.careSeparate,
      price: price ? (
        <>
          <PriceTag locale={locale} price={price} />
          <p className="mt-1 text-xs text-fg-subtle">{definition.delivery === "staged" ? projectPackages.labels.stagedNote : projectPackages.labels.priceNote}</p>
        </>
      ) : (
        <>
          <p className="font-display text-lg font-semibold text-fg">{projectPackages.labels.priceOnQuote}</p>
          <p className="mt-1 text-xs text-fg-subtle">{projectPackages.labels.priceOnQuoteNote}</p>
        </>
      ),
      featured: definition.key === "business_website" || definition.key === "store_complete",
      href: `${href(routes.projectPackages)}#${definition.key}`,
      quote: href(quoteWithService(definition.service)),
      quoteLabel: projectPackages.labels.quote,
      moreLabel: projectPackages.labels.more,
    };
  });

  return (
    <>
      <JsonLd data={faqJsonLd(home.faq.items)} />

      {/* 1 ---------------------------------------------------------------- interactive hero */}
      <div className="relative isolate overflow-hidden">
        <div className="fc-backdrop" aria-hidden="true">
          <div className="fc-grid" />
        </div>
        <Container size="wide" className="relative grid items-center gap-12 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 lg:pb-24 lg:pt-20">
          <div className="min-w-0">
            <Eyebrow>{fc.hero.eyebrow}</Eyebrow>
            <h1 className="t-hero mt-6">
              {fc.hero.title} <span className="text-brand">{fc.hero.titleHighlight}</span>
            </h1>
            <p className="t-lead mt-6 max-w-xl">{fc.hero.lead}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href={href(routes.services)} size="lg" icon="arrowRight" testId="hero-primary">
                {fc.hero.primaryCta}
              </ButtonLink>
              <ButtonLink href={quoteHref} size="lg" variant="secondary" testId="hero-secondary">
                {fc.hero.secondaryCta}
              </ButtonLink>
              <ConfiguratorEntry href={href(routes.configurator)} label={fc.hero.configureCta} variant="secondary" className="btn-lg" />
            </div>
            <ul className="mt-9 grid gap-x-6 gap-y-2.5 border-t border-line-subtle pt-6 text-sm text-fg-secondary sm:grid-cols-2">
              {fc.hero.points.map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Layered previews: a corporate site, a store and an automation, with status chips; one caption for all. */}
          <figure className="min-w-0" data-testid="hero-preview">
            <div className="fc-stage">
              <div className="fc-enter" style={{ ["--i" as string]: 0 }}>
                <ShowcaseMock item={corporate} />
              </div>
              <div data-layer="store" className="fc-enter hidden lg:block" style={{ ["--i" as string]: 2 }}>
                <UiPreview kind="store" compact />
              </div>
              <div data-layer="ai" className="fc-enter hidden xl:block" style={{ ["--i" as string]: 3 }}>
                <UiPreview kind="ai" compact />
              </div>
              <ul className="fc-stage-chips pointer-events-none" aria-hidden="true">
                {fc.hero.chips.map((chip, index) => (
                  <li key={chip.label} className="fc-enter" style={{ ["--i" as string]: 4 + index }}>
                    <span className="fc-glass fc-chip fc-float" style={{ animationDelay: `${index * -2.2}s` }}>
                      <Icon name={chip.icon} className={index === 2 ? "h-4 w-4 text-warning" : index === 1 ? "h-4 w-4 text-brand-2" : "h-4 w-4 text-success"} />
                      {chip.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <figcaption className="t-label mt-5 lg:mt-10">{fc.hero.previewCaption}</figcaption>
          </figure>
        </Container>
        <span className="fc-horizon" aria-hidden="true" />
      </div>

      {/* 2 ---------------------------------------------------------------- four service cards */}
      <Section labelledBy="showcase-title" size="wide">
        <SectionHeading id="showcase-title" eyebrow={fc.services.eyebrow} title={fc.services.title} lead={fc.services.lead} />
        <ul className="bento mt-stack" data-testid="home-showcase">
          {fc.services.cards.map((card, index) => {
            const service = serviceByKey(locale, card.service);
            return (
              <li key={card.key} className={cx("fc-card", BENTO[card.key])} style={CARD_TONE[card.key] ? { ["--fc-tone" as string]: CARD_TONE[card.key] } : undefined} data-testid={`showcase-${card.key}`}>
                {CARD_PREVIEW[card.key] && (
                  <div className="pointer-events-none absolute right-6 top-6 hidden w-[42%] lg:block">
                    <UiPreview kind={CARD_PREVIEW[card.key]!} compact />
                  </div>
                )}
                <div className={cx("flex flex-1 flex-col p-6", CARD_PREVIEW[card.key] && "lg:max-w-[54%]")}>
                  <div className="flex items-center justify-between">
                    <span className="fc-card-icon">
                      <Icon name={card.icon} className="h-5 w-5" />
                    </span>
                    <span className={cx("t-index", CARD_PREVIEW[card.key] && "lg:hidden")}>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="t-h3-lg mt-6">
                    <Link href={cardHref[card.key]} className="hover:text-brand" data-testid={`showcase-link-${card.key}`}>
                      {card.title}
                    </Link>
                  </h3>
                  <p className="mt-3 leading-relaxed text-fg-muted">{card.summary}</p>
                  <p className="mt-3 text-body-sm text-fg-secondary">
                    <span className="font-semibold text-fg">{fc.services.audienceLabel}: </span>
                    {card.audience}
                  </p>
                  <div className="mt-auto pt-6">
                    <PriceTag locale={locale} price={SERVICE_PRICES[card.service]} testId={`showcase-price-${card.key}`} />
                    <p className="mt-1 text-xs text-fg-subtle">{fc.services.priceNote}</p>
                  </div>
                </div>
                <div className="fc-card-more">
                  <p className="t-label">{fc.services.includesLabel}</p>
                  <TickList items={card.includes} className="mt-2 gap-1.5" />
                  <div className="mt-2 flex flex-wrap items-center gap-x-4">
                    <ArrowLink href={cardHref[card.key]} label={card.more} />
                    <Link href={href(quoteWithService(card.service))} className="link inline-flex min-h-11 items-center text-sm" data-testid={`showcase-quote-${card.key}`} aria-label={`${fc.services.quoteLabel}: ${service.shortTitle}`}>
                      {fc.services.quoteLabel}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-fg-subtle">{fc.hero.previewCaption}</p>
        <div className="mt-6 flex flex-col gap-4 rounded-[var(--radius-xl)] border border-line-subtle bg-surface-1 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-fg-secondary">
            <span className="font-semibold text-fg">{fc.services.selectorTitle} </span>
            {fc.services.selectorText}
          </p>
          <ButtonLink href={`${href(routes.services)}#selector`} variant="secondary" icon="arrowRight" className="shrink-0" testId="home-selector-link">
            {fc.services.selectorCta}
          </ButtonLink>
        </div>
      </Section>

      {/* 3 ---------------------------------------------------------------- tabbed product showcase */}
      <Section className="fc-defer" labelledBy="product-title" tone="raised" size="wide">
        <SectionHeading id="product-title" eyebrow={fc.showcase.eyebrow} title={fc.showcase.title} lead={fc.showcase.lead} />
        <div className="mt-stack">
          <ProductShowcase
            items={fc.showcase.items}
            label={fc.showcase.tabsLabel}
            caption={fc.showcase.caption}
            hrefs={showcaseHref}
            platformsLabel={fc.showcase.platformsLabel}
            platforms={home.stores.platforms.map((platform) => ({ id: platform.id, title: platform.title, href: `${href(routes.ecommerce)}#${platform.id}` }))}
          />
        </div>
      </Section>

      {/* 4 ---------------------------------------------------------------- service comparison (paper) */}
      <Section labelledBy="websites-title" tone="light" size="wide">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end">
          <SectionHeading id="websites-title" eyebrow={fc.compare.eyebrow} title={fc.compare.title} lead={fc.compare.lead} />
          <div className="grid gap-3 rounded-[var(--radius-xl)] border border-line-subtle bg-surface-1 p-5" data-testid="static-vs-interactive">
            <p className="font-semibold text-fg">{fc.compare.staticVsInteractive.title}</p>
            <p className="text-body-sm leading-relaxed text-fg-muted">
              <span className="badge mr-2">{fc.compare.options[0].label}</span>
              {fc.compare.staticVsInteractive.static}
            </p>
            <p className="text-body-sm leading-relaxed text-fg-muted">
              <span className="badge badge-accent mr-2">{fc.compare.options[2].label}</span>
              {fc.compare.staticVsInteractive.interactive}
            </p>
          </div>
        </div>
        <div className="mt-stack">
          <ServiceComparison text={fc.compare} prices={compare.prices} links={compare.links} />
        </div>
      </Section>

      {/* 5 ---------------------------------------------------------------- interactive process timeline */}
      <Section className="fc-defer" labelledBy="process-title" tone="deep" size="wide">
        <SectionHeading
          id="process-title"
          eyebrow={fc.process.eyebrow}
          title={fc.process.title}
          lead={fc.process.lead}
          action={
            <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight">
              {fc.process.link}
            </ButtonLink>
          }
        />
        <div className="mt-stack">
          <ProcessStepper steps={fc.process.steps} label={fc.process.tabsLabel} outputLabel={fc.process.outputLabel} inputLabel={fc.process.inputLabel} testId="home-timeline" />
        </div>
      </Section>

      {/* 6 ---------------------------------------------------------------- integration flow */}
      <Section className="fc-defer" labelledBy="flow-title" size="wide">
        <SectionHeading
          id="flow-title"
          eyebrow={fc.flow.eyebrow}
          title={fc.flow.title}
          lead={fc.flow.lead}
          action={
            <ButtonLink href={servicePage("integrations")} variant="secondary" icon="arrowRight">
              {fc.flow.cta}
            </ButtonLink>
          }
        />
        <div className="mt-stack">
          <IntegrationFlow nodes={fc.flow.nodes} caption={fc.flow.caption} testId="integration-flow" />
        </div>
        <p className="mt-4 max-w-3xl text-sm text-fg-subtle">{fc.flow.note}</p>
      </Section>

      {/* 7 ---------------------------------------------------------------- package comparison (paper) */}
      <Section labelledBy="offers-title" tone="light" size="wide">
        <SectionHeading
          id="offers-title"
          eyebrow={fc.packages.eyebrow}
          title={fc.packages.title}
          lead={fc.packages.lead}
          action={
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={href(routes.projectPackages)} variant="secondary" icon="arrowRight">
                {fc.packages.compareCta}
              </ButtonLink>
              <ButtonLink href={href(routes.pricing)} variant="ghost" icon="arrowRight">
                {fc.packages.pricingCta}
              </ButtonLink>
            </div>
          }
        />
        <div className="mt-stack">
          <PackageExplorer
            text={fc.packages}
            cards={packageCards}
            care={{ title: fc.packages.careTitle, text: fc.packages.careText, cta: fc.packages.careCta, href: href(routes.carePlans), covers: carePlans.plans.website.covers }}
          />
        </div>
        <p className="mt-4 text-xs text-fg-subtle">{projectPackages.note}</p>
      </Section>

      {/* 8 ---------------------------------------------------------------- AI workflow demonstration */}
      <Section className="fc-defer" labelledBy="ai-demo-title" size="wide">
        <SectionHeading id="ai-demo-title" eyebrow={fc.aiDemo.eyebrow} title={fc.aiDemo.title} lead={fc.aiDemo.lead} />
        <div className="mt-stack">
          <AiWorkflowDemo text={fc.aiDemo} />
        </div>
      </Section>

      {/* 9 ---------------------------------------------------------------- free tools and labelled demonstrations */}
      <Section className="fc-defer" labelledBy="tools-title" tone="raised" size="wide">
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

      {/* 10 --------------------------------------------------------------- engineering practices (no certificates, logos or numbers) */}
      <CredibilityStrip label={home.practices.title} lead={home.practices.lead} groups={home.practices.groups} />

      {/* 11 --------------------------------------------------------------- the founder (protected portrait, unchanged; paper surround) */}
      <Section labelledBy="founder-title" tone="light">
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-14 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="fc-portrait w-48 md:w-full">
            <FounderPortrait alt={founder.portraitAlt} sizes="(min-width: 1024px) 18rem, (min-width: 768px) 15rem, 12rem" className="aspect-[4/5] w-full" />
          </div>
          <div className="min-w-0">
            <Eyebrow>{fc.about.eyebrow}</Eyebrow>
            <h2 id="founder-title" className="t-h2 mt-4">
              {founder.name}
            </h2>
            <p className="mt-2 font-medium text-fg-secondary">{founder.title}</p>
            <div className="measure mt-5 grid gap-4 leading-relaxed text-fg-muted">
              {founder.home.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <ul className="mt-6 flex flex-wrap gap-2">
              {fc.about.points.map((point) => (
                <li key={point} className="badge">
                  <Icon name="check" className="h-3.5 w-3.5 text-brand" />
                  {point}
                </li>
              ))}
            </ul>
            <ButtonLink href={href(routes.founder)} variant="ghost" icon="arrowRight" className="mt-6">
              {founder.home.cta}
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* 12 --------------------------------------------------------------- FAQ */}
      <Section className="fc-defer" labelledBy="faq-title" tone="raised">
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

      {/* 13 --------------------------------------------------------------- final call to action */}
      <CtaBand
        eyebrow={fc.finalCta.eyebrow}
        title={fc.finalCta.title}
        lead={fc.finalCta.lead}
        primary={{ href: quoteHref, label: fc.finalCta.primary }}
        secondary={{ href: href(routes.projectPackages), label: fc.finalCta.secondary }}
        points={fc.finalCta.points}
        emphasis
      />
    </>
  );
}
