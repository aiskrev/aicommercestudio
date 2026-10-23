import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { formatDate } from "@/lib/format";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/statii">) {
  const locale = await resolveLocale(params);
  const { insightsPage } = getContent(locale);
  return buildMetadata({
    locale,
    title: insightsPage.metaTitle,
    description: insightsPage.metaDescription,
    path: routes.insights,
  });
}

export default async function InsightsPage({ params }: PageProps<"/[locale]/statii">) {
  const locale = await resolveLocale(params);
  const { insightsPage: page, articles } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const sorted = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.insights, path: href(routes.insights) },
        ]}
      />
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} />
      <Section>
        {sorted.length === 0 ? (
          <p className="glass rounded-2xl p-8 text-center text-slate-400">{page.empty}</p>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((article) => (
              <li key={article.slug}>
                <article className="glass glass-hover group relative flex h-full flex-col rounded-2xl p-6">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 font-semibold text-cyan-200">{article.category}</span>
                    <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>
                    <span>
                      {article.readingMinutes} {dict.common.minutesRead}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold leading-snug">
                    <Link href={href(routes.article(article.slug))} className="after:absolute after:inset-0">
                      {article.title}
                    </Link>
                  </h2>
                  <p className="mt-3 flex-1 leading-relaxed text-slate-400">{article.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300">
                    {dict.common.readArticle}
                    <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
