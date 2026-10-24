import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface BuildItem {
  key: string;
  icon: IconName;
  title: string;
  description: string;
  examples: string[];
  linkLabel: string;
  href: string;
}

/** Bento placement per offering (12-column grid from lg). */
const SPAN: Record<string, string> = {
  agents: "lg:col-span-7",
  automation: "lg:col-span-5",
  integrations: "lg:col-span-4",
  custom: "lg:col-span-4",
  consulting: "lg:col-span-4",
  managed: "lg:col-span-12",
};

/**
 * "What we build": six offerings as a bento (one featured, one full-width) instead of an even card
 * grid. Each card is one link named by its heading; the visible link label adds context only.
 */
export function BuildBento({ items, headingLevel = 3 }: { items: BuildItem[]; headingLevel?: 3 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
      {items.map((item, index) => {
        const featured = index === 0;
        const wide = item.key === "managed";
        return (
          <li key={item.key} className={cx("min-w-0", SPAN[item.key], (featured || wide) && "sm:col-span-2")}>
            <article
              className={cx(
                "card card-interactive group relative flex h-full flex-col p-6 sm:p-7",
                featured && "card-accent lg:p-9",
                wide && "lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-10",
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span
                    className={cx(
                      "inline-flex shrink-0 items-center justify-center rounded-full border text-brand",
                      featured ? "h-12 w-12 border-brand/45 bg-brand/[0.08]" : "h-10 w-10 border-line-default bg-surface-2",
                    )}
                    aria-hidden="true"
                  >
                    <Icon name={item.icon} className={featured ? "h-5.5 w-5.5" : "h-5 w-5"} />
                  </span>
                  <span className="t-index text-fg-subtle" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <Heading className={cx("mt-5", featured ? "t-h3-lg lg:text-[2rem] lg:leading-tight" : "t-h3 text-xl")}>
                  <Link href={item.href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                    {item.title}
                  </Link>
                </Heading>
                <p className={cx("mt-3 leading-relaxed text-fg-muted", featured && "max-w-xl text-[17px]")}>{item.description}</p>
              </div>
              <div className={cx("mt-auto min-w-0", wide ? "pt-6 lg:pt-0" : "pt-6")}>
                <ul className="flex flex-wrap gap-1.5">
                  {item.examples.map((example) => (
                    <li key={example} className="rounded-[6px] border border-line-subtle bg-surface-page px-2.5 py-1 font-mono text-[12px] text-fg-secondary">
                      {example}
                    </li>
                  ))}
                </ul>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand" aria-hidden="true">
                  {item.linkLabel}
                  <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
                </span>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
