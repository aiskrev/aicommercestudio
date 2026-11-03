import Link from "next/link";

import { Icon } from "@/components/ui/Icon";

export interface PatternCard {
  key: string;
  title: string;
  summary: string;
  href: string;
}

/**
 * Homepage proof without fabricated proof: three fictional reference scenarios, each labelled as
 * such, then links to the full scenario library, the integration patterns and the workshops.
 */
export function SolutionPatterns({
  items,
  fictionalLabel,
  readLabel,
  links,
}: {
  items: PatternCard[];
  fictionalLabel: string;
  readLabel: string;
  links: { href: string; label: string }[];
}) {
  return (
    <>
      <ul className="grid gap-4 md:grid-cols-3" data-testid="solution-patterns">
        {items.map((item) => (
          <li key={item.key} className="min-w-0">
            <article className="card card-interactive relative flex h-full flex-col p-6" data-scenario={item.key}>
              <span className="badge badge-warning self-start">{fictionalLabel}</span>
              <h3 className="t-h3 mt-4">
                <Link href={item.href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                  {item.title}
                </Link>
              </h3>
              <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">{item.summary}</p>
              <p className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand">
                {readLabel}
                <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
              </p>
            </article>
          </li>
        ))}
      </ul>
      <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="link">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
