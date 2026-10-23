import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CheckList, Container } from "@/components/ui/primitives";
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
      <Container className="max-w-3xl py-12">
        <p className="text-sm text-slate-400">
          {study.client.anonymised ? study.client.industry : `${study.client.name} · ${study.client.industry}`}
        </p>
        <h1 className="t-h1 mt-4">{study.title}</h1>
        <p className="t-lead mt-4">{study.description}</p>
        <h2 className="t-h2 mt-10 text-2xl">{copy.challenge}</h2>
        <p className="mt-3 text-slate-300">{study.challenge}</p>
        <h2 className="t-h2 mt-10 text-2xl">{copy.solution}</h2>
        <CheckList items={study.solution} className="mt-4" />
        {study.results.length > 0 && (
          <>
            <h2 className="t-h2 mt-10 text-2xl">{copy.results}</h2>
            <ul className="mt-4 grid gap-3">
              {study.results.map((result) => (
                <li key={result.metric} className="card p-4">
                  <p className="font-semibold text-white">
                    {result.metric}: {result.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {copy.source}: {result.source} · {copy.measured} {formatDate(result.measuredAt, locale)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-10 text-sm text-slate-400">
          {copy.services}: {study.services.map((key) => serviceByKey(locale, key).shortTitle).join(", ")} · {copy.approved}{" "}
          {formatDate(study.verification.approvedAt, locale)}.
        </p>
      </Container>
    </>
  );
}
