import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/Icon";

export interface ProblemRow {
  title: string;
  description: string;
  icon?: IconName;
  service: { title: string; href: string };
}

/**
 * Editorial index on the light surface: each client problem on its own row, linked to the service
 * that addresses it. Deliberately not a card grid.
 */
export function ProblemIndex({ rows, solutionLabel }: { rows: ProblemRow[]; solutionLabel: string }) {
  return (
    <ul className="mt-12 border-t border-ink/15">
      {rows.map((row) => (
        <li key={row.title} className="border-b border-ink/15">
          <Link
            href={row.service.href}
            className="group grid gap-3 py-6 transition-colors sm:grid-cols-[2.5rem_1fr] md:grid-cols-[2.5rem_1.1fr_1fr_auto] md:items-center md:gap-8 md:py-7"
          >
            {row.icon ? (
              <span className="hidden h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-ink text-brand sm:inline-flex" aria-hidden="true">
                <Icon name={row.icon} className="h-5 w-5" />
              </span>
            ) : (
              <span className="hidden sm:block" />
            )}
            <span className="font-display text-xl font-bold leading-snug tracking-[-0.015em] text-ink sm:text-[1.4rem]">
              {row.title}
            </span>
            <span className="text-[15px] leading-relaxed text-ink-muted sm:col-start-2 md:col-start-auto">{row.description}</span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink sm:col-start-2 md:col-start-auto md:justify-self-end">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">{solutionLabel}</span>
              <span className="underline decoration-brand-ink/30 underline-offset-4 group-hover:decoration-brand-ink">{row.service.title}</span>
              <Icon name="arrowRight" className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
