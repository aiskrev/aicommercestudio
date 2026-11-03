import Link from "next/link";

import { CapabilityAreas } from "@/components/home/CapabilityAreas";
import { ControlLanes } from "@/components/home/ControlLanes";
import { CredibilityStrip } from "@/components/home/CredibilityStrip";
import { HeroWorkflow } from "@/components/home/HeroWorkflow";
import { ManagedLifecycle } from "@/components/home/ManagedLifecycle";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { SolutionPatterns } from "@/components/home/SolutionPatterns";
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
import { SCENARIO_SLUGS } from "@/lib/reference";
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
 * Homepage (docs/DESIGN_SYSTEM.md → Homepage composition, redesign v4). In order: hero; three
 * capability areas with unequal weight that link the ten domain hubs; the AI Automation Advisor as a
 * product (with the other live tools); AI Managed Services as an operating lifecycle; engineering
 * credibility (human-approval architecture and the practices we can be checked on); the delivery
 * model; example solution patterns (fictional, labelled — no fabricated proof); the founder; FAQ;
 * the final CTA. Everything is a server component; motion comes from the shared CSS system.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const { home, advisor, tools, founder, aiManaged, reference } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const managedHref = href(routes.service(serviceByKey(locale, "ai_managed").slug));
  const areas = home.offer.areas.map((area) => ({
    ...area,
    domains: area.domains.filter(isDomainPublished).map((key) => {
      const domain = domainByKey(locale, key);
      return { key, name: domain.name, href: href(routes.service(domain.slug)) };
    }),
  }));
  const patterns = home.proof.scenarios.map((key) => ({
    key,
    title: reference.scenarioTexts[key].title,
    summary: reference.scenarioTexts[key].summary,
    href: href(routes.scenario(SCENARIO_SLUGS[key].bg)),
  }));

  return (
    <>
      <JsonLd data={faqJsonLd(home.faq.items)} />

      {/* 1 ---------------------------------------------------------------- hero */}
      <div className="relative overflow-hidden">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid items-center gap-10 pb-12 pt-10 sm:gap-12 sm:pt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:pb-16 lg:pt-16">
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

      {/* 2 ---------------------------------------------------------------- capability narrative: three areas */}
      <Section labelledBy="offer-title">
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
        <div className="mt-stack">
          <CapabilityAreas areas={areas} labels={home.offer.labels} />
        </div>
      </Section>

      {/* 3 ---------------------------------------------------------------- the AI Automation Advisor as a product */}
      <Section labelledBy="tools-title" tone="raised">
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
        <dl className="mt-stack grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle bg-line-subtle sm:grid-cols-2 lg:grid-cols-4" data-testid="advisor-facts">
          {home.tools.facts.map((fact) => (
            <div key={fact.title} className="bg-surface-1 p-5">
              <dt className="t-label">{fact.title}</dt>
              <dd className="mt-2 text-body-sm leading-relaxed text-fg-secondary">{fact.text}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <ToolsPreview catalog={tools} hrefs={toolHrefs(locale)} minutes={toolMinutes()} showcase={advisor.showcase} startBadge={home.tools.startBadge} compact />
        </div>
      </Section>

      {/* 4 ---------------------------------------------------------------- AI Managed Services: operating lifecycle */}
      <Section labelledBy="managed-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
          <div className="min-w-0">
            <Eyebrow>{home.managed.eyebrow}</Eyebrow>
            <h2 id="managed-title" className="t-h2 reveal mt-4">
              {home.managed.title}
            </h2>
            <p className="t-lead mt-5 max-w-xl">{home.managed.lead}</p>
            <dl className="mt-8 grid border-t border-line-subtle">
              {home.managed.contrast.map((item) => (
                <div key={item.title} className="grid gap-1 border-b border-line-subtle py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="font-semibold text-fg">{item.title}</dt>
                  <dd className="text-body-sm leading-relaxed text-fg-muted">{item.text}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={managedHref} icon="arrowRight">
                {home.managed.primaryCta}
              </ButtonLink>
              <ButtonLink href={`${managedHref}#ams-inquiry`} variant="secondary">
                {home.managed.secondaryCta}
              </ButtonLink>
            </div>
          </div>
          <ManagedLifecycle content={home.managed.lifecycle} serviceHref={managedHref} />
        </div>
        <div className="mt-10 border-t border-line-subtle pt-6" data-testid="managed-packages">
          <p className="t-label">{aiManaged.packages.title}</p>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {aiManaged.packages.items.map((item) => (
              <li key={item.key} className="min-w-0">
                <p className="font-semibold text-fg">{item.name}</p>
                <p className="mt-1 text-body-sm leading-relaxed text-fg-muted">{item.summary}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-fg-subtle">
            {aiManaged.packages.priceLabel}. {aiManaged.packages.lead}
          </p>
        </div>
      </Section>

      {/* 5 ---------------------------------------------------------------- engineering credibility: control architecture + practices */}
      <Section labelledBy="orchestration-title" tone="deep" density="spacious">
        <div className="max-w-4xl">
          <Eyebrow>{home.orchestration.eyebrow}</Eyebrow>
          <h2 id="orchestration-title" className="t-h1 reveal mt-5">
            {home.orchestration.title}
          </h2>
          <p className="t-lead mt-6 max-w-3xl">{home.orchestration.lead}</p>
        </div>
        <div className="mt-stack grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-10">
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

      <CredibilityStrip label={home.capabilities.title} lead={home.capabilities.lead} groups={home.capabilities.groups} />

      {/* 6 ---------------------------------------------------------------- delivery model */}
      <Section labelledBy="process-title">
        <SectionHeading
          id="process-title"
          title={home.process.title}
          lead={home.process.lead}
          action={
            <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight">
              {home.process.linkLabel}
            </ButtonLink>
          }
        />
        <div className="mt-stack">
          <ProcessSteps steps={home.process.steps} layout="horizontal" />
        </div>
      </Section>

      {/* 7 ---------------------------------------------------------------- proof: example solution patterns (fictional, labelled) */}
      <Section labelledBy="proof-title" tone="raised">
        <SectionHeading id="proof-title" eyebrow={home.proof.eyebrow} title={home.proof.title} lead={home.proof.lead} />
        <div className="mt-stack">
          <SolutionPatterns
            items={patterns}
            fictionalLabel={reference.scenarios.detail.fictionalLabel}
            readLabel={reference.scenarios.open}
            links={[
              { href: href(routes.scenarios), label: home.proof.links.scenarios },
              { href: href(routes.patterns), label: home.proof.links.patterns },
              { href: href(routes.workshops), label: home.proof.links.workshops },
            ]}
          />
        </div>
      </Section>

      {/* 8 ---------------------------------------------------------------- who builds it: founder */}
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

      {/* 8 ---------------------------------------------------------------- FAQ */}
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
