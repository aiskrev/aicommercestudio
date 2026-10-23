import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { CheckList, Container, Eyebrow } from "@/components/ui/primitives";
import { findArticle, getContent, serviceByKey } from "@/content";
import { localeMeta, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { formatDate } from "@/lib/format";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata, organizationId } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getContent("bg").articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/statii/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const article = findArticle(locale, slug);
  if (!article) return {};
  return buildMetadata({
    locale,
    title: article.title,
    description: article.description,
    path: routes.article(article.slug),
    type: "article",
    publishedTime: article.publishedAt,
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
  const service = serviceByKey(locale, article.relatedService);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.description,
          datePublished: article.publishedAt,
          inLanguage: localeMeta[locale].htmlLang,
          mainEntityOfPage: absoluteUrl(path),
          author: { "@id": organizationId },
          publisher: { "@id": organizationId },
        }}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.insights, path: href(routes.insights) },
          { name: article.title, path },
        ]}
      />
      <article>
        <Container className="max-w-3xl py-12 sm:py-16">
          <header>
            <Eyebrow>{article.category}</Eyebrow>
            <h1 className="mt-5 text-3xl font-semibold leading-tight sm:text-5xl">{article.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-400">{article.description}</p>
            <p className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500">
              <time dateTime={article.publishedAt}>
                {dict.common.published}: {formatDate(article.publishedAt, locale)}
              </time>
              <span>
                {article.readingMinutes} {dict.common.minutesRead}
              </span>
            </p>
          </header>
          <div className="divider-glow my-10" aria-hidden="true" />
          <div className="prose-content text-[17px] text-slate-300">
            {article.sections.map((section) => (
              <section key={section.heading} className="mt-10 first:mt-0">
                <h2 className="text-2xl font-semibold">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets && <CheckList items={section.bullets} className="mt-5" />}
              </section>
            ))}
          </div>
          <aside className="glass mt-14 rounded-2xl p-6">
            <p className="text-sm text-slate-400">{dict.service.related}</p>
            <Link
              href={href(routes.service(service.slug))}
              className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-white hover:text-cyan-200"
            >
              {service.shortTitle}
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </aside>
          <Link href={href(routes.insights)} className="mt-8 inline-flex items-center gap-2 text-sm text-cyan-300">
            ← {dict.common.allArticles}
          </Link>
        </Container>
      </article>
      <CtaBand
        title={dict.service.ctaTitle}
        lead={dict.service.ctaLead}
        primary={{ href: href(contactWithService(service.key)), label: dict.nav.cta }}
      />
    </>
  );
}
