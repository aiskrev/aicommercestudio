import Link from "next/link";

import { cx } from "@/components/ui/primitives";
import type { WorkshopLink } from "@/lib/workshop-links";

/**
 * Cards linking to workshop and assessment pages (domain hubs, service pages, topic pages,
 * assessment results, scenarios, industries). Each card states the format kind and that the scope is
 * individual; nothing here mentions a price or a duration promise.
 */
export function WorkshopCards({
  items,
  customLabel,
  className,
  columns = 3,
  testId = "workshop-cards",
}: {
  items: WorkshopLink[];
  customLabel: string;
  className?: string;
  columns?: 2 | 3;
  testId?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={cx("grid gap-4 md:grid-cols-2", columns === 3 && "xl:grid-cols-3", className)} data-testid={testId}>
      {items.map((item) => (
        <li key={item.key}>
          <article className="card card-interactive relative flex h-full flex-col p-5" data-workshop={item.key}>
            <p className="flex flex-wrap gap-2">
              <span className="badge badge-accent">{item.kindLabel}</span>
              <span className="badge">{customLabel}</span>
            </p>
            <h3 className="t-h3 mt-3">
              <Link href={item.href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                {item.label}
              </Link>
            </h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{item.summary}</p>
          </article>
        </li>
      ))}
    </ul>
  );
}
