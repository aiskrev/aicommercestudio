import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Bullets, LinkList, TextBlock } from "@/components/reference/ReferenceBlocks";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { Alert, buttonClass, Container, Eyebrow, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { assessmentLinks, patternLinks, scenarioLinks, serviceLinks } from "@/lib/reference-links";
import { contactAboutWorkshop, routes } from "@/lib/routes";
import { buildMetadata, serviceJsonLd } from "@/lib/seo";
import { workshopArticles } from "@/lib/workshop-links";
import { WORKSHOP_KEYS, WORKSHOP_SLUGS, workshop, workshopBySlug, workshopContactService } from "@/lib/workshops";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return WORKSHOP_KEYS.map((key) => ({ workshop: WORKSHOP_SLUGS[key].bg }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/rabotni-sreshti/[workshop]">) {
  const locale = await resolveLocale(params);
  const key = workshopBySlug((await params).workshop);
  if (!key) return {};
  const w = getContent(locale).workshops.texts[key];
  return buildMetadata({ locale, title: w.title, description: w.summary, path: routes.workshop(WORKSHOP_SLUGS[key].bg) });
}

/** One workshop or advisory assessment: audience, problems, prerequisites, format, agenda, deliverables, limits, links. */
export default async function WorkshopPage({ params }: PageProps<"/[locale]/rabotni-sreshti/[workshop]">) {
  const locale = await resolveLocale(params);
  const key = workshopBySlug((await params).workshop);
  if (!key) notFound();
  const { workshops } = getContent(locale);
  const t = workshops.page;
  const d = workshops.detail;
  const w = workshops.texts[key];
  const def = workshop(key);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.workshop(WORKSHOP_SLUGS[key].bg));
  const services = serviceLinks(locale, def.domains);
  const assessments = assessmentLinks(locale, def.assessments);
  const articles = workshopArticles(locale, key);
  const enquiry = href(contactAboutWorkshop(workshopContactService(key), key));

  return (
    <>
      <JsonLd data={serviceJsonLd({ title: w.title, metaDescription: w.summary, path, type: t.kinds[def.kind] }, locale)} />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: t.title, path: href(routes.workshops) },
          { name: w.title, path },
        ]}
      />
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative pb-12 pt-12 sm:pt-16">
          <Eyebrow>{t.kinds[def.kind]}</Eyebrow>
          <h1 className="t-h1 mt-5 max-w-4xl">{w.title}</h1>
          <p className="t-lead mt-6 max-w-3xl">{w.summary}</p>
          <p className="mt-6 flex flex-wrap gap-2">
            <span className="badge badge-accent">{t.kinds[def.kind]}</span>
            <span className="badge">{t.custom}</span>
          </p>
          <Alert tone="info" role="note" className="mt-8 max-w-3xl">
            <span data-testid="workshop-notice">{d.notice}</span>
          </Alert>
          <p className="mt-8">
            <Link href={enquiry} className={buttonClass("primary")} data-testid="workshop-enquiry">
              <span className="btn-label">{d.ctaButton}</span>
            </Link>
          </p>
        </Container>
      </div>

      <Section size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <TextBlock title={d.audience} testId="workshop-audience">
            <Bullets items={w.audience} />
          </TextBlock>
          <TextBlock title={d.problems} testId="workshop-problems">
            <Bullets items={w.problems} />
          </TextBlock>
          <TextBlock title={d.prerequisites} testId="workshop-prerequisites">
            <Bullets items={w.prerequisites} />
          </TextBlock>
          <TextBlock title={d.format} testId="workshop-format">
            <dl className="grid gap-3">
              {(
                [
                  [d.participants, w.format.participants],
                  [d.mode, w.format.mode],
                  [d.length, w.format.length],
                ] as const
              ).map(([term, value]) => (
                <div key={term}>
                  <dt className="font-medium text-fg">{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </TextBlock>
        </div>
      </Section>

      <Section size="wide" alt>
        <h2 className="t-h2">{d.agenda}</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4" data-testid="workshop-agenda">
          {w.agenda.map((step, index) => (
            <li key={step.title} className="border-t-2 border-brand/50 pt-4">
              <p className="t-index">
                {String(index + 1).padStart(2, "0")} · {step.title}
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-fg-secondary">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <TextBlock title={d.deliverables} testId="workshop-deliverables">
            <Bullets items={w.deliverables} />
          </TextBlock>
          <TextBlock title={d.limitations} testId="workshop-limitations">
            <Bullets items={w.limitations} />
          </TextBlock>
        </div>
      </Section>

      <Section size="wide">
        <div className="grid gap-8 lg:grid-cols-2">
          {services.length > 0 && (
            <TextBlock title={d.relatedServices}>
              <LinkList items={services} testId="workshop-services" />
            </TextBlock>
          )}
          {assessments.length > 0 && (
            <TextBlock title={d.relatedAssessments}>
              <LinkList items={assessments} testId="workshop-assessments" />
            </TextBlock>
          )}
          <TextBlock title={d.relatedScenarios}>
            <LinkList items={scenarioLinks(locale, def.scenarios)} testId="workshop-scenarios" />
          </TextBlock>
          <TextBlock title={d.relatedPatterns}>
            <LinkList items={patternLinks(locale, def.patterns)} testId="workshop-patterns" />
          </TextBlock>
          <TextBlock title={d.relatedInsights} testId="workshop-insights">
            {articles.length > 0 ? <LinkList items={articles} /> : <p className="text-fg-muted">{d.noInsights}</p>}
          </TextBlock>
        </div>
        <p className="mt-10">
          <Link href={href(routes.workshops)} className="link">
            ← {d.backToList}
          </Link>
        </p>
      </Section>

      <CtaBand title={d.ctaTitle} lead={d.ctaText} primary={{ href: enquiry, label: d.ctaButton }} />
    </>
  );
}
