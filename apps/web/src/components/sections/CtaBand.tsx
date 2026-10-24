import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container } from "@/components/ui/primitives";

/**
 * Closing conversion block: one statement, one primary action, an optional quiet secondary link.
 */
export function CtaBand({
  title,
  lead,
  primary,
  secondary,
  points,
}: {
  title: string;
  lead: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  points?: string[];
}) {
  return (
    <section className="py-16 sm:py-24" aria-labelledby="cta-title">
      <Container>
        <div className="panel relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16">
          <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <h2 id="cta-title" className="t-h2 max-w-2xl">
                {title}
              </h2>
              <p className="t-lead mt-5 max-w-xl">{lead}</p>
            </div>
            <div className="flex flex-col gap-5 lg:items-end">
              <ButtonLink href={primary.href} size="lg" icon="arrowRight" className="w-full sm:w-auto">
                {primary.label}
              </ButtonLink>
              {secondary && (
                <Link
                  href={secondary.href}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-brand"
                >
                  {secondary.label}
                  <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
          {points && points.length > 0 && (
            <ul className="relative mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line-subtle pt-6 text-sm text-fg-muted">
              {points.map((point) => (
                <li key={point} className="inline-flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 text-brand" />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}
