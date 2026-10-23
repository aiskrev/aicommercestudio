import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/editorial/ArticleCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { IconBadge, PageHero, Section } from "@/components/ui/primitives";
import {
  articlesInCategory,
  findCategory,
  getContent,
  isIndexableCategory,
  serviceByKey,
  topicRoutePaths,
} from "@/content";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata, collectionPageJsonLd, itemListJsonLd } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  const { locale } = params;
  if (!isLocale(locale)) return [];
  return getContent(locale).editorialCategories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/statii/tema/[category]">) {
  const locale = await resolveLocale(params);
  const { category: slug } = await params;
  const category = findCategory(locale, slug);
  if (!category) return {};
  return buildMetadata({
    locale,
    title: category.title,
    description: category.description,
    path: topicRoutePaths(category.key),
    // Topics with a single article are thin pages: keep them crawlable but out of the index.
    noindex: !isIndexableCategory(locale, category.key),
  });
}

export default async function CategoryPage({ params }: PageProps<"/[locale]/statii/tema/[category]">) {
  const locale = await resolveLocale(params);
  const { category: slug } = await params;
  const category = findCategory(locale, slug);
  if (!category) notFound();

  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.insightsCategory(category.slug));
  const articles = articlesInCategory(locale, category.key);
  const service = serviceByKey(locale, category.relatedService);

  return (
    <>
      <JsonLd
        data={[
          collectionPageJsonLd({ name: category.title, description: category.description, path }, locale),
          itemListJsonLd(category.title, articles.map((a) => ({ name: a.title, path: href(routes.article(a.slug)) }))),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.insights, path: href(routes.insights) },
          { name: category.name, path },
        ]}
      />
      <PageHero eyebrow={dict.editorial.category} title={category.title} lead={category.description} />
      <Section>
        {articles.length === 0 ? (
          <p className="card p-8 text-center text-slate-400">{dict.editorial.categoryEmpty}</p>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.slug}>
                <ArticleCard
                  article={article}
                  href={href(routes.article(article.slug))}
                  locale={locale}
                  labels={{ minutesRead: dict.common.minutesRead, readArticle: dict.common.readArticle }}
                />
              </li>
            ))}
          </ul>
        )}

        <Link
          href={href(routes.service(service.slug))}
          className="card card-interactive mt-10 flex items-center gap-4 p-6"
        >
          <IconBadge name={service.icon} />
          <span>
            <span className="block text-sm text-slate-400">{dict.editorial.relatedServices}</span>
            <span className="t-h3">{service.shortTitle}</span>
          </span>
        </Link>
        <Link href={href(routes.insights)} className="mt-6 inline-flex text-sm text-cyan-300">
          ← {dict.common.allArticles}
        </Link>
      </Section>
      <CtaBand
        title={dict.service.ctaTitle}
        lead={dict.service.ctaLead}
        primary={{ href: href(contactWithService(service.key)), label: dict.nav.cta }}
      />
    </>
  );
}
