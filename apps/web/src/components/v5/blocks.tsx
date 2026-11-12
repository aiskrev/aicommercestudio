import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

/**
 * V5 building blocks (docs/V5_DESIGN_SYSTEM.md). Server components; no client JavaScript.
 */

export interface CompareColumn {
  key: string;
  label: string;
}

export interface CompareRow {
  label: string;
  /** One cell per column, in column order. */
  cells: string[];
}

/** Semantic comparison table that scrolls inside its own focusable frame on narrow screens. */
export function CompareTable({
  caption,
  corner,
  columns,
  rows,
  highlight,
  testId,
}: {
  caption: string;
  /** Header of the first column (row labels). */
  corner: string;
  columns: CompareColumn[];
  rows: CompareRow[];
  /** Column key drawn with stronger text. */
  highlight?: string;
  testId?: string;
}) {
  return (
    // The frame is focusable so keyboard users can scroll a wide table on a phone.
    <div className="compare-scroll" tabIndex={0} role="region" aria-label={caption} data-testid={testId}>
      <table className="compare-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{corner}</th>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, index) => (
                <td key={columns[index]?.key ?? index} className={cx(columns[index]?.key === highlight && "is-recommended")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface TimelineStep {
  title: string;
  text: string;
}

/** Numbered process steps: vertical on phones, one row from 64rem. */
export function Timeline({ steps, className, testId }: { steps: TimelineStep[]; className?: string; testId?: string }) {
  return (
    <ol className={cx("timeline", className)} style={{ ["--steps" as string]: steps.length }} data-testid={testId}>
      {steps.map((step) => (
        <li key={step.title} className="min-w-0">
          <h3 className="t-h3">{step.title}</h3>
          <p className="mt-1.5 text-body-sm leading-relaxed text-fg-muted">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** A row of jump links to the sections of the same page. */
export function JumpNav({ label, items, className }: { label: string; items: { id: string; label: string }[]; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="jump-nav">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Icon + text list with a check, for "what you get" style lists. */
export function TickList({ items, tone = "brand", className }: { items: string[]; tone?: "brand" | "muted"; className?: string }) {
  return (
    <ul className={cx("grid gap-2.5", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-body-sm leading-relaxed text-fg-secondary">
          <Icon name={tone === "brand" ? "check" : "close"} className={cx("mt-1 h-4 w-4 shrink-0", tone === "brand" ? "text-brand" : "text-fg-subtle")} />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Small arrow link used at the bottom of cards. */
export function ArrowLink({ href, label, className, testId }: { href: string; label: string; className?: string; testId?: string }) {
  return (
    <Link href={href} className={cx("group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand", className)} data-testid={testId}>
      <span className="underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current group-focus-visible:decoration-current">{label}</span>
      <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
    </Link>
  );
}

export type { IconName };
