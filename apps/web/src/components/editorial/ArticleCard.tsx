import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { Article } from "@/content/types";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/lib/format";

/**
 * Article preview. `card` for grids, `featured` for the lead story of an editorial list and `row`
 * for compact list entries — so a list of articles does not repeat one identical card.
 */
export function ArticleCard({
  article,
  href,
  categoryName,
  locale,
  labels,
  headingLevel = 2,
  variant = "card",
}: {
  article: Article;
  href: string;
  categoryName?: string;
  locale: Locale;
  labels: { minutesRead: string; readArticle: string };
  headingLevel?: 2 | 3;
  variant?: "card" | "featured" | "row";
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-fg-muted">
      <span className="text-brand">{getDictionary(locale).ui.articleTypes[article.type]}</span>
      {categoryName && (
        <>
          <span aria-hidden="true">/</span>
          <span>{categoryName}</span>
        </>
      )}
      <span aria-hidden="true">·</span>
      <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>
      <span aria-hidden="true">·</span>
      <span>
        {article.readingMinutes} {labels.minutesRead}
      </span>
    </div>
  );
  const link = (
    <Link href={href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
      {article.title}
    </Link>
  );

  if (variant === "row") {
    return (
      <article className="focus-frame group relative grid gap-2 py-6 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
        <div className="min-w-0">
          {meta}
          <Heading className="t-h3 mt-2 leading-snug transition-colors group-focus-within:text-brand group-hover:text-brand">{link}</Heading>
          <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-fg-muted">{article.description}</p>
        </div>
        <Icon name="arrowRight" className="hidden h-5 w-5 text-brand transition-transform group-hover:translate-x-1 sm:block" />
      </article>
    );
  }

  return (
    <article
      className={cx(
        "card card-interactive group relative flex h-full flex-col p-6",
        variant === "featured" && "card-accent p-7 sm:p-9",
      )}
    >
      {meta}
      <Heading className={cx("mt-4 leading-snug", variant === "featured" ? "t-h3-lg" : "t-h3 text-xl")}>{link}</Heading>
      <p className={cx("mt-3 flex-1 leading-relaxed text-fg-muted", variant === "featured" && "text-[17px]")}>{article.description}</p>
      {variant === "featured" && article.keyPoints.length > 0 && (
        <ul className="mt-5 grid gap-1.5 border-t border-line-subtle pt-5 text-[15px] text-fg-secondary">
          {article.keyPoints.slice(0, 3).map((point) => (
            <li key={point} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      )}
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand" aria-hidden="true">
        {labels.readArticle}
        <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </article>
  );
}
