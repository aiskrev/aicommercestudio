import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Bullets, FlowDiagram, LinkList, StatusBadge, TextBlock } from "@/components/reference/ReferenceBlocks";
import { Alert, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { PATTERN_KEYS, PATTERN_SLUGS, pattern, patternBySlug, scenariosUsing } from "@/lib/reference";
import { scenarioLinks, serviceLinks } from "@/lib/reference-links";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return PATTERN_KEYS.map((key) => ({ pattern: PATTERN_SLUGS[key].bg }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/integratsionni-modeli/[pattern]">) {
  const locale = await resolveLocale(params);
  const key = patternBySlug((await params).pattern);
  if (!key) return {};
  const p = getContent(locale).reference.patternTexts[key];
  return buildMetadata({ locale, title: p.title, description: p.summary, path: routes.pattern(PATTERN_SLUGS[key].bg) });
}

/** One integration pattern: when (not) to use it, diagram, prerequisites, controls, failure modes, observability. */
export default async function PatternPage({ params }: PageProps<"/[locale]/integratsionni-modeli/[pattern]">) {
  const locale = await resolveLocale(params);
  const key = patternBySlug((await params).pattern);
  if (!key) notFound();
  const { reference } = getContent(locale);
  const t = reference.patterns;
  const d = t.detail;
  const p = reference.patternTexts[key];
  const def = pattern(key);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const services = serviceLinks(locale, def.domains);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: t.title, path: href(routes.patterns) },
          { name: p.title, path: href(routes.pattern(PATTERN_SLUGS[key].bg)) },
        ]}
      />
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative pb-12 pt-12 sm:pt-16">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="t-h1 mt-5 max-w-4xl">{p.title}</h1>
          <p className="t-lead mt-6 max-w-3xl">{p.summary}</p>
          <div className="mt-8 flex max-w-3xl flex-col gap-3" data-testid="pattern-status">
            <p className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
              {t.statusLabel}: <StatusBadge status={def.status} label={t.statuses[def.status].label} />
            </p>
            <Alert tone="info" role="note">
              {p.statusNote}
            </Alert>
          </div>
        </Container>
      </div>

      <Section size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <TextBlock title={d.description}>
            <p>{p.description}</p>
          </TextBlock>
          <TextBlock title={d.prerequisites}>
            <Bullets items={p.prerequisites} />
          </TextBlock>
          <TextBlock title={d.whenToUse} testId="pattern-when">
            <Bullets items={p.whenToUse} />
          </TextBlock>
          <TextBlock title={d.whenNotToUse} testId="pattern-when-not">
            <Bullets items={p.whenNotToUse} />
          </TextBlock>
        </div>
      </Section>

      <Section size="wide" alt>
        <FlowDiagram
          id="pattern-diagram"
          stages={p.stages}
          title={d.diagram}
          note={d.diagramNote}
          labels={{ tableTitle: reference.scenarios.detail.tableTitle, stage: reference.scenarios.detail.tableStage, components: reference.scenarios.detail.tableComponents }}
        />
      </Section>

      <Section size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <TextBlock title={d.securityControls}>
            <Bullets items={p.securityControls} />
          </TextBlock>
          <TextBlock title={d.observability}>
            <Bullets items={p.observability} />
          </TextBlock>
        </div>
        <h2 className="t-h3-lg mt-12">{d.failureModes}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm" data-testid="pattern-failure-modes">
            <thead className="text-fg-subtle">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">{d.failureMode}</th>
                <th scope="col" className="py-2 font-medium">{d.mitigation}</th>
              </tr>
            </thead>
            <tbody>
              {p.failureModes.map((f) => (
                <tr key={f.mode} className="border-t border-line-subtle align-top">
                  <th scope="row" className="py-2 pr-4 font-medium text-fg">{f.mode}</th>
                  <td className="py-2 text-fg-secondary">{f.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section size="wide" alt>
        <div className="grid gap-8 lg:grid-cols-2">
          {services.length > 0 && (
            <TextBlock title={d.relatedServices}>
              <LinkList items={services} testId="pattern-services" />
            </TextBlock>
          )}
          <TextBlock title={d.relatedScenarios}>
            <LinkList items={scenarioLinks(locale, scenariosUsing(key))} testId="pattern-scenarios" />
          </TextBlock>
        </div>
        <p className="mt-10">
          <Link href={href(routes.patterns)} className="link">
            ← {d.backToList}
          </Link>
        </p>
      </Section>
    </>
  );
}
