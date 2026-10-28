import Link from "next/link";

import { ControlLanes } from "@/components/home/ControlLanes";
import { CredibilityStrip } from "@/components/home/CredibilityStrip";
import { HeroWorkflow } from "@/components/home/HeroWorkflow";
import { OfferGroups } from "@/components/home/OfferGroups";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { SystemMap } from "@/components/home/SystemMap";
import { ToolsPreview } from "@/components/home/ToolsPreview";
import { CtaBand } from "@/components/sections/CtaBand";
import { FounderPortrait } from "@/components/sections/Founder";
import { Faq } from "@/components/sections/Faq";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { EditorialSplit } from "@/components/ui/patterns";
import { ButtonLink, Container, Eyebrow, Section, SectionHeading } from "@/components/ui/primitives";
import { domainByKey, getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { isDomainPublished } from "@/lib/domains";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { toolHrefs, toolMinutes } from "@/lib/tools";
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

/**
 * Homepage. It answers four questions in order: what we offer (hero + four capability groups that
 * lead to the ten domain hubs), which tool to try first (tools, the Advisor marked "Start here"),
 * what happens after launch (AI Managed Services), and how we work and who does it (methodology,
 * human-approval controls, the founder and the verifiable capabilities), then FAQ and the final CTA.
 * Consultation and assessment CTAs sit in the hero, the managed section and the final band.
 * Everything is a server component; motion comes from the shared interaction system (CSS).
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const { home, advisor, tools, founder, aiManaged } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const managedHref = href(routes.service(serviceByKey(locale, "ai_managed").slug));
  const offerGroups = home.offer.groups.map((group) => ({
    ...group,
    domains: group.domains.filter(isDomainPublished).map((key) => {
      const domain = domainByKey(locale, key);
      return { key, name: domain.name, href: href(routes.service(domain.slug)) };
    }),
  }));

  return (
    <>
      <JsonLd data={faqJsonLd(home.faq.items)} />

      {/* 1 ---------------------------------------------------------------- hero */}
      <div className="relative overflow-hidden">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-10 pb-14 pt-10 sm:gap-12 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:pb-24 lg:pt-20">
          <div className="min-w-0">
            <Eyebrow>{home.hero.eyebrow}</Eyebrow>
            <h1 className="t-display mt-6">
              {home.hero.title} <span className="text-brand">{home.hero.titleHighlight}</span>
            </h1>
            <p className="t-lead mt-6 max-w-xl">{home.hero.lead}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={href(routes.contact)} size="lg" icon="arrowRight">
                {home.hero.primaryCta}
              </ButtonLink>
              <ButtonLink href={href(routes.advisor)} size="lg" variant="secondary">
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
          <SystemMap content={home.hero.systemMap} />
        </Container>
      </div>

      {/* 2 ---------------------------------------------------------------- what we offer: four capability groups */}
      <Section labelledBy="offer-title" density="spacious">
        <SectionHeading
          id="offer-title"
          eyebrow={home.offer.eyebrow}
          title={home.offer.title}
          lead={home.offer.lead}
          action={
            <ButtonLink href={href(routes.services)} variant="secondary" icon="arrowRight">
              {dict.common.allServices}
            </ButtonLink>
          }
        />
        <div className="mt-12">
          <OfferGroups groups={offerGroups} />
        </div>
      </Section>

      {/* 3 ---------------------------------------------------------------- which tool to try first */}
      <Section labelledBy="tools-title" tone="raised" density="spacious">
        <SectionHeading
          id="tools-title"
          eyebrow={home.tools.eyebrow}
          title={home.tools.title}
          lead={home.tools.lead}
          action={
            <ButtonLink href={href(routes.tools)} variant="secondary" icon="arrowRight">
              {home.tools.allTools}
            </ButtonLink>
          }
        />
        <div className="mt-12">
          <ToolsPreview catalog={tools} hrefs={toolHrefs(locale)} minutes={toolMinutes()} showcase={advisor.showcase} startBadge={home.tools.startBadge} />
        </div>
      </Section>

      {/* 4 ---------------------------------------------------------------- after launch: AI Managed Services */}
      <Section labelledBy="managed-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <div className="min-w-0">
            <Eyebrow>{home.managed.eyebrow}</Eyebrow>
            <h2 id="managed-title" className="t-h2 reveal mt-4">
              {home.managed.title}
            </h2>
            <p className="t-lead mt-5 max-w-xl">{home.managed.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={managedHref} icon="arrowRight">
                {home.managed.primaryCta}
              </ButtonLink>
              <ButtonLink href={`${managedHref}#ams-inquiry`} variant="secondary">
                {home.managed.secondaryCta}
              </ButtonLink>
            </div>
          </div>
          <div className="card card-accent min-w-0 p-6 sm:p-8" data-testid="managed-packages">
            <p className="t-label">{aiManaged.packages.title}</p>
            <ul className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line-subtle bg-line-subtle">
              {aiManaged.packages.items.map((item) => (
                <li key={item.key} className="flex items-start gap-3 bg-surface-1 p-4">
                  <Icon name="activity" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-fg">{item.name}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-fg-muted">{item.summary}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-fg-muted">
              {aiManaged.packages.priceLabel}. {aiManaged.packages.lead}
            </p>
          </div>
        </div>
      </Section>

      {/* 5 ---------------------------------------------------------------- methodology: how we work */}
      <Section labelledBy="process-title" tone="raised">
        <SectionHeading
          id="process-title"
          eyebrow={home.process.eyebrow}
          title={home.process.title}
          lead={home.process.lead}
          action={
            <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight">
              {home.process.linkLabel}
            </ButtonLink>
          }
        />
        <div className="mt-14">
          <ProcessSteps steps={home.process.steps} layout="horizontal" />
        </div>
      </Section>

      {/* 6 ---------------------------------------------------------------- solution architecture / orchestration */}
      <Section labelledBy="orchestration-title" tone="deep" density="spacious">
        <div className="max-w-4xl">
          <Eyebrow>{home.orchestration.eyebrow}</Eyebrow>
          <h2 id="orchestration-title" className="t-display reveal mt-5 text-[clamp(2.1rem,1.4rem+2.6vw,3.6rem)]">
            {home.orchestration.title}
          </h2>
          <p className="t-lead mt-6 max-w-3xl">{home.orchestration.lead}</p>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-10">
          <HeroWorkflow content={home.orchestration.workflow} />
          <div className="min-w-0">
            <ControlLanes
              lanes={[
                { tone: "ai", title: home.orchestration.allowedTitle, items: home.orchestration.allowed },
                { tone: "approval", title: home.orchestration.approvalTitle, items: home.orchestration.approval },
                { tone: "record", title: home.orchestration.auditTitle, items: home.orchestration.audit },
              ]}
            />
            <ButtonLink href={href(routes.aiSolutions)} variant="ghost" icon="arrowRight" className="mt-6">
              {home.orchestration.linkLabel}
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* 7 ---------------------------------------------------------------- who builds it: founder + verifiable capabilities */}
      <Section labelledBy="founder-title" className="border-t border-line-subtle">
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

      <CredibilityStrip label={home.capabilities.title} lead={home.capabilities.lead} groups={home.capabilities.groups} />

      {/* 8 ---------------------------------------------------------------- FAQ */}
      <Section labelledBy="faq-title" tone="raised">
        <EditorialSplit
          sticky
          aside={
            <>
              <SectionHeading id="faq-title" eyebrow={home.faq.eyebrow} title={home.faq.title} />
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

      {/* 9 ---------------------------------------------------------------- final CTA */}
      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: home.finalCta.primary }}
        secondary={{ href: href(routes.advisor), label: home.finalCta.secondary }}
        emphasis
      />
    </>
  );
}
