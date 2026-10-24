import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/editorial/ArticleBody";
import { ArticleCard } from "@/components/editorial/ArticleCard";
import { InlineCta } from "@/components/editorial/InlineCta";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { ServiceCard } from "@/components/sections/ServiceCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { Container } from "@/components/ui/primitives";
import { articleByKey, articleRoutePaths, categoryByKey, findArticle, getContent, serviceByKey } from "@/content";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { formatDate } from "@/lib/format";
import { resolveLocale } from "@/lib/params";
import { contactWithService, quoteWithService, routes } from "@/lib/routes";
import { articleJsonLd, buildMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  const { locale } = params;
  if (!isLocale(locale)) return [];
  return getContent(locale).articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/statii/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const article = findArticle(locale, slug);
  if (!article) return {};
  const { paths, availableIn } = articleRoutePaths(article.key);
  return buildMetadata({
    locale,
    title: article.metaTitle ?? article.title,
    description: article.description,
    path: paths,
    availableIn,
    type: "article",
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    section: categoryByKey(locale, article.category)?.name,
  });
}

export default async function ArticlePage({ params }: PageProps<"/[locale]/statii/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const article = findArticle(locale, slug);
  if (!article) notFound();

  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.article(article.slug));
  const category = categoryByKey(locale, article.category);
  const primaryService = serviceByKey(locale, article.relatedService);
  const relatedServices = article.relatedServices.map((key) => serviceByKey(locale, key));
  const relatedArticles = article.relatedArticles
    .map((key) => articleByKey(locale, key))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const ctaAfter = Math.max(1, Math.floor(article.sections.length / 2) - 1);

  return (
    <>
      <JsonLd
        data={articleJsonLd(
          {
            title: article.title,
            description: article.description,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            path,
            section: category?.name ?? article.category,
            about: primaryService.shortTitle,
          },
          locale,
        )}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.insights, path: href(routes.insights) },
          ...(category ? [{ name: category.name, path: href(routes.insightsCategory(category.slug)) }] : []),
          { name: article.title, path },
        ]}
      />
      <article>
        <Container size="reading" className="py-10 sm:py-14">
          <header>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="badge badge-accent">{dict.ui.articleTypes[article.type]}</span>
              {category && (
                <Link href={href(routes.insightsCategory(category.slug))} className="text-cyan-300 hover:text-cyan-200">
                  {category.name}
                </Link>
              )}
            </div>
            <h1 className="t-h1 mt-5">{article.title}</h1>
            <p className="t-lead mt-5">{article.description}</p>
            <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
              <time dateTime={article.publishedAt}>
                {dict.common.published}: {formatDate(article.publishedAt, locale)}
              </time>
              {article.updatedAt !== article.publishedAt && (
                <time dateTime={article.updatedAt}>
                  {dict.editorial.updated}: {formatDate(article.updatedAt, locale)}
                </time>
              )}
              <span>
                {article.readingMinutes} {dict.common.minutesRead}
              </span>
            </p>
          </header>

          <section className="card-accent mt-10 rounded-2xl p-6" aria-labelledby="key-points">
            <h2 id="key-points" className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              {dict.editorial.keyPoints}
            </h2>
            <ul className="mt-4 grid gap-3">
              {article.keyPoints.map((point) => (
                <li key={point} className="flex gap-3 text-slate-200">
                  <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
                  {point}
                </li>
              ))}
            </ul>
          </section>

          <nav aria-labelledby="toc-title" className="mt-8 rounded-2xl border border-white/[0.07] p-5">
            <h2 id="toc-title" className="text-sm font-semibold text-white">
              {dict.editorial.contents}
            </h2>
            <ol className="mt-3 grid gap-1.5 text-sm">
              {article.sections.map((section, index) => (
                <li key={section.heading}>
                  <a href={`#section-${index}`} className="text-slate-300 hover:text-cyan-200">
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="divider-glow my-10" aria-hidden="true" />

          <ArticleBody
            sections={article.sections}
            localize={href}
            relatedLabel={dict.editorial.related}
            insertAfter={ctaAfter}
            insert={
              <InlineCta
                service={primaryService}
                title={dict.editorial.inlineCtaTitle}
                lead={dict.editorial.inlineCtaLead}
                quoteHref={href(quoteWithService(primaryService.key))}
                serviceHref={href(routes.service(primaryService.slug))}
                labels={{ quote: dict.common.requestQuote, learnMore: primaryService.shortTitle }}
              />
            }
          />
        </Container>
      </article>

      <section aria-labelledby="related-services" className="py-12">
        <Container>
          <h2 id="related-services" className="t-h2 text-2xl">
            {dict.editorial.relatedServices}
          </h2>
          <ul className="mt-6 grid gap-5 md:grid-cols-3">
            {relatedServices.map((service) => (
              <li key={service.key}>
                <ServiceCard service={service} href={href(routes.service(service.slug))} cta={dict.common.learnMore} showCapabilities={false} />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {relatedArticles.length > 0 && (
        <section aria-labelledby="related-articles" className="py-12">
          <Container>
            <h2 id="related-articles" className="t-h2 text-2xl">
              {dict.editorial.relatedArticles}
            </h2>
            <ul className="mt-6 grid gap-5 md:grid-cols-2">
              {relatedArticles.map((related) => (
                <li key={related.slug}>
                  <ArticleCard
                    article={related}
                    href={href(routes.article(related.slug))}
                    categoryName={categoryByKey(locale, related.category)?.name}
                    locale={locale}
                    labels={{ minutesRead: dict.common.minutesRead, readArticle: dict.common.readArticle }}
                    headingLevel={3}
                  />
                </li>
              ))}
            </ul>
            <Link href={href(routes.insights)} className="mt-8 inline-flex items-center gap-2 text-sm text-cyan-300">
              ← {dict.common.allArticles}
            </Link>
          </Container>
        </section>
      )}

      <CtaBand
        title={dict.service.ctaTitle}
        lead={dict.service.ctaLead}
        primary={{ href: href(contactWithService(primaryService.key)), label: dict.nav.cta }}
        points={dict.cta.points}
      />
    </>
  );
}
