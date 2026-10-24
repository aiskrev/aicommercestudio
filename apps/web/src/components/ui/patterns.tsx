import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

/* Composition patterns built on the primitives. Usage: docs/DESIGN_SYSTEM.md → "Patterns". */

/**
 * Editorial split: a heading column and a content column. From `lg` the columns sit side by side
 * (0.8fr / 1.2fr, `minmax(0, …)` so long words cannot widen the grid); `sticky` keeps the heading
 * column in view while the content scrolls.
 */
export function EditorialSplit({
  aside,
  children,
  sticky = false,
  ratio = "default",
  className,
}: {
  aside: ReactNode;
  children: ReactNode;
  sticky?: boolean;
  ratio?: "default" | "even";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid gap-10 lg:gap-16",
        ratio === "even" ? "lg:grid-cols-2" : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]",
        className,
      )}
    >
      <div className={cx("min-w-0", sticky && "lg:sticky lg:top-28 lg:self-start")}>{aside}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Technical figure: blueprint grid, corner registration ticks and a mono title bar. `meta` sits at
 * the right of the bar (e.g. a "concept" or "demo" badge); `caption` is shown under the figure
 * with an info icon and should state what the diagram is (illustrative, not live data).
 */
export function DiagramFrame({
  title,
  titleId,
  meta,
  caption,
  children,
  className,
  testId,
}: {
  title: string;
  titleId?: string;
  meta?: ReactNode;
  caption?: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <figure className={cx("diagram-frame diagram-grid p-5 sm:p-6", className)} aria-labelledby={titleId} data-testid={testId}>
      <div className="diagram-bar">
        <p id={titleId} className="t-label min-w-0">
          {title}
        </p>
        {meta && (
          <span data-slot="meta" className="shrink-0">
            {meta}
          </span>
        )}
      </div>
      <div className="mt-5">{children}</div>
      {caption && (
        <figcaption className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-fg-subtle">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** Key/value facts as a description list: mono labels over values, hairline rows. */
export function SpecList({
  items,
  columns = 1,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl className={cx("spec-list", columns === 2 && "sm:grid-cols-2 sm:gap-x-8", className)}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Case study body: numbered chapters (challenge, solution, results …) beside a sticky facts column.
 * Content must be a real, client-approved project (see content/bg/editorial.ts); measured results
 * keep their source and date next to the figure.
 */
export function CaseStudyLayout({
  facts,
  chapters,
  className,
}: {
  facts: { label: string; value: ReactNode }[];
  chapters: { id: string; title: string; children: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16", className)}>
      <div className="grid min-w-0 gap-12">
        {chapters.map((chapter, index) => (
          <section key={chapter.id} aria-labelledby={chapter.id} className="border-t border-line-subtle pt-6">
            <p className="t-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2 id={chapter.id} className="t-h3-lg mt-2">
              {chapter.title}
            </h2>
            <div className="mt-5">{chapter.children}</div>
          </section>
        ))}
      </div>
      <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <SpecList items={facts} />
      </aside>
    </div>
  );
}

/** Measured outcome with its evidence (source, date) kept beside the figure. */
export function ResultList({
  items,
}: {
  items: { metric: string; value: string; evidence: string }[];
}) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle bg-line-subtle sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.metric} className="bg-surface-1 p-5">
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-fg">{item.value}</p>
          <p className="mt-1 font-medium text-fg-secondary">{item.metric}</p>
          <p className="t-label mt-3 text-fg-subtle">{item.evidence}</p>
        </li>
      ))}
    </ul>
  );
}
