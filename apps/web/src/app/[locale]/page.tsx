import Link from "next/link";

import { BuildBento } from "@/components/home/BuildBento";
import { ControlLanes } from "@/components/home/ControlLanes";
import { CredibilityStrip } from "@/components/home/CredibilityStrip";
import { HeroWorkflow } from "@/components/home/HeroWorkflow";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { SystemMap } from "@/components/home/SystemMap";
import { ToolsPreview } from "@/components/home/ToolsPreview";
import { UseCaseLedger } from "@/components/home/UseCaseLedger";
import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { EditorialSplit } from "@/components/ui/patterns";
import { ButtonLink, Container, Eyebrow, Section, SectionHeading } from "@/components/ui/primitives";
import type { HomeLink } from "@/content/bg/home";
import { getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
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
 * Homepage. Section order: hero (system map) → capabilities → what we build → how we work →
 * interactive tools → solution architecture → use cases by function → FAQ → final CTA.
 * Everything is a server component; motion comes from the shared interaction system (CSS).
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const { home, advisor, tools } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const linkFor = (link: HomeLink) =>
    "service" in link ? href(routes.service(serviceByKey(locale, link.service).slug)) : href(routes[link.route]);

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
              <ButtonLink href={href(routes.aiSolutions)} size="lg" icon="arrowRight">
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

      {/* 2 ---------------------------------------------------------------- credibility and capabilities */}
      <CredibilityStrip label={home.capabilities.eyebrow} groups={home.capabilities.groups} />

      {/* 3 ---------------------------------------------------------------- what we build (bento) */}
      <Section labelledBy="build-title" density="spacious">
        <SectionHeading
          id="build-title"
          eyebrow={home.build.eyebrow}
          title={home.build.title}
          lead={home.build.lead}
          action={
            <ButtonLink href={href(routes.services)} variant="secondary" icon="arrowRight">
              {dict.common.allServices}
            </ButtonLink>
          }
        />
        <div className="mt-12">
          <BuildBento items={home.build.items.map((item) => ({ ...item, href: linkFor(item.link) }))} />
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-line-subtle pt-6 lg:flex-row lg:items-baseline lg:gap-8">
          <p className="shrink-0 text-[15px] font-semibold text-fg">{home.build.foundation.title}</p>
          <p className="text-[15px] text-fg-muted">
            {home.build.foundation.lead}{" "}
            {home.build.foundation.services.map((key, index) => {
              const service = serviceByKey(locale, key);
              return (
                <span key={key}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  <Link href={href(routes.service(service.slug))} className="link font-medium">
                    {service.shortTitle}
                  </Link>
                </span>
              );
            })}
          </p>
        </div>
      </Section>

      {/* 4 ---------------------------------------------------------------- how we work */}
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

      {/* 5 ---------------------------------------------------------------- interactive tools */}
      <Section labelledBy="tools-title" density="spacious">
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
          <ToolsPreview catalog={tools} hrefs={toolHrefs(locale)} minutes={toolMinutes()} showcase={advisor.showcase} />
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

      {/* 7 ---------------------------------------------------------------- use cases by business function (light) */}
      <Section labelledBy="use-cases-title" tone="light" density="spacious">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end">
          <SectionHeading id="use-cases-title" eyebrow={home.useCases.eyebrow} title={home.useCases.title} />
          <p className="t-lead lg:pb-1">{home.useCases.lead}</p>
        </div>
        <div className="mt-12">
          <UseCaseLedger items={home.useCases.items} labels={home.useCases.labels} />
        </div>
      </Section>

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
