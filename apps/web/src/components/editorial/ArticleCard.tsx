import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import type { Article } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format";

export const articleTypeLabels: Record<Article["type"], string> = {
  guide: "Ръководство",
  checklist: "Чеклист",
  comparison: "Сравнение",
  explainer: "Обяснение",
};

export function ArticleCard({
  article,
  href,
  categoryName,
  locale,
  labels,
  headingLevel = 2,
}: {
  article: Article;
  href: string;
  categoryName?: string;
  locale: Locale;
  labels: { minutesRead: string; readArticle: string };
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card card-interactive group relative flex h-full flex-col p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="badge badge-accent">{articleTypeLabels[article.type]}</span>
        {categoryName && <span>{categoryName}</span>}
        <span aria-hidden="true">·</span>
        <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>
        <span aria-hidden="true">·</span>
        <span>
          {article.readingMinutes} {labels.minutesRead}
        </span>
      </div>
      <Heading className="t-h3 mt-4 text-xl leading-snug">
        <Link href={href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
          {article.title}
        </Link>
      </Heading>
      <p className="mt-3 flex-1 leading-relaxed text-slate-400">{article.description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-300" aria-hidden="true">
        {labels.readArticle}
        <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </article>
  );
}
