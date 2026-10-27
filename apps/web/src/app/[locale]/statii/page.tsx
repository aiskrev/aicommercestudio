import Link from "next/link";

import { ArticleCard } from "@/components/editorial/ArticleCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHero, Section } from "@/components/ui/primitives";
import { articlesInCategory, categoryByKey, getContent, sortedArticles } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata, itemListJsonLd } from "@/lib/seo";

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
  const { insightsPage: page, editorialCategories, home } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const articles = sortedArticles(locale);

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          page.title,
          articles.map((a) => ({ name: a.title, path: href(routes.article(a.slug)) })),
        )}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.insights, path: href(routes.insights) },
        ]}
      />
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead}>
        <nav aria-label={dict.editorial.allTopics} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {editorialCategories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={href(routes.insightsCategory(category.slug))}
                  className="badge transition-colors hover:border-brand/50 hover:text-fg"
                >
                  {category.name}
                  <span className="text-fg-muted">{articlesInCategory(locale, category.key).length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </PageHero>
      <Section>
        {articles.length === 0 ? (
          <p className="card p-8 text-center text-fg-muted">{page.empty}</p>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
            <ArticleCard
              article={articles[0]}
              href={href(routes.article(articles[0].slug))}
              categoryName={categoryByKey(locale, articles[0].category)?.name}
              locale={locale}
              labels={{ minutesRead: dict.common.minutesRead, readArticle: dict.common.readArticle }}
              variant="featured"
            />
            <ul className="-mt-6 divide-y divide-line-subtle">
              {articles.slice(1).map((article) => (
                <li key={article.slug}>
                  <ArticleCard
                    article={article}
                    href={href(routes.article(article.slug))}
                    categoryName={categoryByKey(locale, article.category)?.name}
                    locale={locale}
                    labels={{ minutesRead: dict.common.minutesRead, readArticle: dict.common.readArticle }}
                    variant="row"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: dict.nav.cta }}
      />
    </>
  );
}
