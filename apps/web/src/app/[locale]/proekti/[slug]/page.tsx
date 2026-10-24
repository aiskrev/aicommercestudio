import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CaseStudyLayout, ResultList } from "@/components/ui/patterns";
import { CheckList, PageHero, Section } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { formatDate } from "@/lib/format";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export const dynamicParams = false;

/** Only publishable (verified, client-approved) case studies get a page. */
export function generateStaticParams() {
  return getContent("bg").caseStudies.map((study) => ({ slug: study.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/proekti/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const study = getContent(locale).caseStudies.find((s) => s.slug === slug);
  if (!study) return {};
  return buildMetadata({ locale, title: study.title, description: study.description, path: routes.caseStudy(study.slug) });
}

export default async function CaseStudyPage({ params }: PageProps<"/[locale]/proekti/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const study = getContent(locale).caseStudies.find((s) => s.slug === slug);
  if (!study) notFound();
  const dict = getDictionary(locale);
  const copy = dict.ui.caseStudies;
  const href = (path: string) => localizePath(locale, path);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: copy.eyebrow, path: href(routes.caseStudies) },
          { name: study.title, path: href(routes.caseStudy(study.slug)) },
        ]}
      />
      <PageHero
        eyebrow={study.client.anonymised ? study.client.industry : `${study.client.name} · ${study.client.industry}`}
        title={study.title}
        lead={study.description}
      />
      <Section>
        <CaseStudyLayout
          facts={[
            { label: copy.services, value: study.services.map((key) => serviceByKey(locale, key).shortTitle).join(", ") },
            { label: copy.approved, value: formatDate(study.verification.approvedAt, locale) },
          ]}
          chapters={[
            {
              id: "case-challenge",
              title: copy.challenge,
              children: <p className="measure text-lg leading-relaxed text-fg-secondary">{study.challenge}</p>,
            },
            { id: "case-solution", title: copy.solution, children: <CheckList items={study.solution} /> },
            ...(study.results.length > 0
              ? [
                  {
                    id: "case-results",
                    title: copy.results,
                    children: (
                      <ResultList
                        items={study.results.map((result) => ({
                          metric: result.metric,
                          value: result.value,
                          evidence: `${copy.source}: ${result.source} · ${copy.measured} ${formatDate(result.measuredAt, locale)}`,
                        }))}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Section>
    </>
  );
}
