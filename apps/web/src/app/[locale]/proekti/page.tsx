import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/**
 * Case studies index. Renders only verified, client-approved case studies (see content/bg/editorial.ts).
 * While none exist the route returns 404, is not linked anywhere and is absent from the sitemap.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]/proekti">) {
  const locale = await resolveLocale(params);
  return buildMetadata({
    locale,
    title: "Реализирани проекти",
    description: "Проекти, публикувани с изричното съгласие на клиентите, с описание на задачата, решението и измерените резултати.",
    path: routes.caseStudies,
  });
}

export default async function CaseStudiesPage({ params }: PageProps<"/[locale]/proekti">) {
  const locale = await resolveLocale(params);
  const { caseStudies } = getContent(locale);
  if (caseStudies.length === 0) notFound();
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: "Проекти", path: href(routes.caseStudies) },
        ]}
      />
      <PageHero
        eyebrow="Проекти"
        title="Реализирани проекти"
        lead="Публикуваме само реални проекти с писменото съгласие на клиента. Резултатите са посочени с източник и период на измерване."
      />
      <Section>
        <ul className="grid gap-5 md:grid-cols-2">
          {caseStudies.map((study) => (
            <li key={study.slug} className="card card-interactive relative p-6">
              <p className="text-sm text-slate-400">{study.client.industry}</p>
              <h2 className="t-h3 mt-2 text-xl">
                <Link href={href(routes.caseStudy(study.slug))} className="after:absolute after:inset-0">
                  {study.title}
                </Link>
              </h2>
              <p className="mt-2 text-slate-400">{study.description}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
