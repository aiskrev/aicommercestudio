import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Bullets, FlowDiagram, LinkList, TextBlock } from "@/components/reference/ReferenceBlocks";
import { CtaBand } from "@/components/sections/CtaBand";
import { Alert, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { SCENARIO_KEYS, SCENARIO_SLUGS, scenario, scenarioBySlug } from "@/lib/reference";
import { assessmentLinks, patternLinks, serviceLinks } from "@/lib/reference-links";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return SCENARIO_KEYS.map((key) => ({ scenario: SCENARIO_SLUGS[key].bg }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/referentni-stsenarii/[scenario]">) {
  const locale = await resolveLocale(params);
  const key = scenarioBySlug((await params).scenario);
  if (!key) return {};
  const { reference } = getContent(locale);
  const s = reference.scenarioTexts[key];
  return buildMetadata({
    locale,
    title: `${s.title} — ${reference.scenarios.detail.fictionalLabel}`,
    description: s.summary,
    path: routes.scenario(SCENARIO_SLUGS[key].bg),
  });
}

/** One fictional reference scenario: problem, assumptions, architecture, flow, boundaries, phases, trade-offs. */
export default async function ScenarioPage({ params }: PageProps<"/[locale]/referentni-stsenarii/[scenario]">) {
  const locale = await resolveLocale(params);
  const key = scenarioBySlug((await params).scenario);
  if (!key) notFound();
  const { reference } = getContent(locale);
  const t = reference.scenarios;
  const d = t.detail;
  const s = reference.scenarioTexts[key];
  const def = scenario(key);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const services = serviceLinks(locale, def.domains);
  const assessments = assessmentLinks(locale, def.assessments);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: t.title, path: href(routes.scenarios) },
          { name: s.title, path: href(routes.scenario(SCENARIO_SLUGS[key].bg)) },
        ]}
      />
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative pb-12 pt-12 sm:pt-16">
          <Eyebrow>{t.categories[def.category].title}</Eyebrow>
          <h1 className="t-h1 mt-5 max-w-4xl">{s.title}</h1>
          <p className="t-lead mt-6 max-w-3xl">{s.summary}</p>
          <Alert tone="warning" role="note" className="mt-8 max-w-3xl">
            <span data-testid="fictional-label">
              <strong>{d.fictionalLabel}.</strong> {d.fictionalText}
            </span>
          </Alert>
        </Container>
      </div>

      <Section size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <TextBlock title={d.problem}>
            <p>{s.problem}</p>
          </TextBlock>
          <div className="grid gap-8">
            <TextBlock title={d.assumptions}>
              <Bullets items={s.assumptions} />
            </TextBlock>
            <TextBlock title={d.constraints}>
              <Bullets items={s.constraints} />
            </TextBlock>
          </div>
        </div>
      </Section>

      <Section size="wide" alt>
        <FlowDiagram
          id="scenario-architecture"
          stages={s.stages}
          title={d.architecture}
          note={d.architectureNote}
          labels={{ tableTitle: d.tableTitle, stage: d.tableStage, components: d.tableComponents }}
        />
        <h2 className="t-h3-lg mt-12">{d.interfaces}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm" data-testid="scenario-interfaces">
            <thead className="text-fg-subtle">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">{d.interfaceFrom}</th>
                <th scope="col" className="py-2 pr-4 font-medium">{d.interfaceTo}</th>
                <th scope="col" className="py-2 font-medium">{d.interfaceVia}</th>
              </tr>
            </thead>
            <tbody>
              {s.interfaces.map((i) => (
                <tr key={`${i.from}-${i.to}`} className="border-t border-line-subtle">
                  <td className="py-2 pr-4 text-fg">{i.from}</td>
                  <td className="py-2 pr-4 text-fg">{i.to}</td>
                  <td className="py-2 text-fg-secondary">{i.via}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <TextBlock title={d.dataFlow} testId="scenario-data-flow">
            <ol className="grid list-decimal gap-1.5 pl-5">
              {s.dataFlow.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </TextBlock>
          <div className="grid gap-8">
            <TextBlock title={d.security}>
              <Bullets items={s.security} />
            </TextBlock>
            <TextBlock title={d.approvals} testId="scenario-approvals">
              <Bullets items={s.approvals} />
            </TextBlock>
          </div>
        </div>
      </Section>

      <Section size="wide" alt>
        <h2 className="t-h2">{d.phases}</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4" data-testid="scenario-phases">
          {s.phases.map((phase, index) => (
            <li key={phase.title} className="border-t-2 border-brand/50 pt-4">
              <p className="t-index">
                {String(index + 1).padStart(2, "0")} · {phase.title}
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-fg-secondary">{phase.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <TextBlock title={d.limitations}>
            <Bullets items={s.limitations} />
          </TextBlock>
          <TextBlock title={d.tradeoffs}>
            <Bullets items={s.tradeoffs} />
          </TextBlock>
        </div>
      </Section>

      <Section size="wide">
        <div className="grid gap-8 lg:grid-cols-3">
          {services.length > 0 && (
            <TextBlock title={d.relatedServices}>
              <LinkList items={services} testId="scenario-services" />
            </TextBlock>
          )}
          {assessments.length > 0 && (
            <TextBlock title={d.relatedAssessments}>
              <LinkList items={assessments} testId="scenario-assessments" />
            </TextBlock>
          )}
          <TextBlock title={d.relatedPatterns}>
            <LinkList items={patternLinks(locale, def.patterns)} testId="scenario-patterns" />
          </TextBlock>
        </div>
        <p className="mt-10">
          <Link href={href(routes.scenarios)} className="link">
            ← {d.backToList}
          </Link>
        </p>
      </Section>

      <CtaBand title={d.ctaTitle} lead={d.ctaText} primary={{ href: href(contactWithService("audit")), label: d.ctaButton }} />
    </>
  );
}
