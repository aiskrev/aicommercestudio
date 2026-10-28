import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolCard, type ToolCardContent, type ToolCardLabels } from "@/components/tools/ToolCard";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, CheckList, PageHero, Section, SectionHeading } from "@/components/ui/primitives";

export interface ToolIntroLabels {
  statusText: string;
  outputTitle: string;
  coversTitle: string;
  meanwhileTitle: string;
  meanwhileText: string;
  meanwhileCta: string;
  domainCta: string;
  tryTitle: string;
}

/**
 * Intro page of a planned tool ("Coming soon"): purpose, audience, expected output and what it
 * will cover, then honest alternatives — a consultant-led assessment, the related domain hub and
 * the tools that work today. It deliberately has no form, no questions and no start button.
 */
export function ToolIntro({
  tool,
  breadcrumbs,
  badge,
  labels,
  audienceLabel,
  contactHref,
  domain,
  alternatives,
  cardLabels,
}: {
  tool: ToolCardContent & { output: string; covers?: string[] };
  breadcrumbs: { name: string; path: string }[];
  badge: string;
  labels: ToolIntroLabels;
  audienceLabel: string;
  contactHref: string;
  domain?: { name: string; href: string };
  alternatives: { tool: ToolCardContent; href: string; minutes?: number }[];
  cardLabels: ToolCardLabels;
}) {
  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <PageHero eyebrow={tool.category} title={tool.title} lead={tool.description}>
        <div className="mt-8 flex max-w-2xl flex-col gap-3 rounded-[var(--radius-lg)] border border-dashed border-line-strong p-5 sm:flex-row sm:items-start" data-testid="tool-coming-soon">
          <span className="badge badge-outline shrink-0">{badge}</span>
          <p className="text-[15px] leading-relaxed text-fg-secondary">{labels.statusText}</p>
        </div>
      </PageHero>

      <Section labelledBy="tool-intro-covers-title">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="card p-6 sm:p-8">
            <dl className="grid gap-5">
              <div>
                <dt className="t-label">{audienceLabel}</dt>
                <dd className="mt-1.5 text-fg-secondary">{tool.audience}</dd>
              </div>
              <div>
                <dt className="t-label">{labels.outputTitle}</dt>
                <dd className="mt-1.5 text-fg-secondary">{tool.output}</dd>
              </div>
            </dl>
            {tool.covers && tool.covers.length > 0 && (
              <>
                <h2 id="tool-intro-covers-title" className="t-h3 mt-8">
                  {labels.coversTitle}
                </h2>
                <CheckList items={tool.covers} className="mt-4" />
              </>
            )}
          </div>
          <aside aria-labelledby="tool-intro-meanwhile-title" className="card card-accent flex flex-col p-6 sm:p-8">
            <h2 id="tool-intro-meanwhile-title" className="t-h3">
              {labels.meanwhileTitle}
            </h2>
            <p className="mt-3 leading-relaxed text-fg-muted">{labels.meanwhileText}</p>
            <div className="mt-6 flex flex-col gap-3">
              <ButtonLink href={contactHref} icon="arrowRight" className="w-full whitespace-normal text-center sm:w-auto">
                {labels.meanwhileCta}
              </ButtonLink>
              {domain && (
                <ButtonLink href={domain.href} variant="secondary" className="w-full whitespace-normal text-center sm:w-auto">
                  {labels.domainCta}: {domain.name}
                </ButtonLink>
              )}
            </div>
            <p className="mt-auto flex items-start gap-2 pt-6 text-sm text-fg-subtle">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
              {badge}
            </p>
          </aside>
        </div>
      </Section>

      {alternatives.length > 0 && (
        <Section labelledBy="tool-intro-try-title" tone="raised">
          <SectionHeading id="tool-intro-try-title" size="sm" title={labels.tryTitle} />
          <ul className="mt-8 grid gap-5 md:grid-cols-2">
            {alternatives.map((alternative) => (
              <li key={alternative.tool.key} className="min-w-0">
                <ToolCard tool={alternative.tool} href={alternative.href} minutes={alternative.minutes} labels={cardLabels} headingLevel={3} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
