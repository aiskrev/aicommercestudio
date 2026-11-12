import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container, Eyebrow } from "@/components/ui/primitives";

/**
 * Closing conversion block (Future Commerce): one statement, one primary action, an optional quiet secondary
 * link and optional reassurance points. `emphasis` = full-bleed closing section with the hero's layered backdrop
 * (homepage, hubs); otherwise a layered panel inside the page width.
 */
export function CtaBand({
  title,
  lead,
  primary,
  secondary,
  points,
  eyebrow,
  emphasis = false,
}: {
  title: string;
  lead: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  points?: string[];
  eyebrow?: string;
  /** Full-bleed closing statement with display-size type (homepage, hubs). */
  emphasis?: boolean;
}) {
  const secondaryLink = secondary && (
    <Link
      href={secondary.href}
      className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-brand"
    >
      {secondary.label}
      <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
    </Link>
  );
  const pointList = points && points.length > 0 && (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-muted">
      {points.map((point) => (
        <li key={point} className="inline-flex items-center gap-2">
          <Icon name="check" className="h-4 w-4 text-brand" />
          {point}
        </li>
      ))}
    </ul>
  );

  if (emphasis) {
    return (
      <section className="relative isolate overflow-hidden border-t border-line-subtle" aria-labelledby="cta-title">
        <div className="fc-backdrop" aria-hidden="true">
          <div className="fc-grid" />
        </div>
        <Container className="relative py-20 sm:py-28 lg:py-32">
          <div className="fc-cta px-6 py-12 sm:px-12 sm:py-16 lg:px-16">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h2 id="cta-title" className="t-display mt-5 max-w-4xl">
              {title}
            </h2>
            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <p className="t-lead max-w-2xl">{lead}</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <ButtonLink href={primary.href} size="lg" icon="arrowRight" className="w-full sm:w-auto">
                  {primary.label}
                </ButtonLink>
                {secondaryLink}
              </div>
            </div>
            {pointList && <div className="mt-10 border-t border-line-subtle pt-6">{pointList}</div>}
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="py-16 sm:py-24" aria-labelledby="cta-title">
      <Container>
        <div className="fc-cta px-6 py-12 sm:px-12 sm:py-16">
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
            <div>
              {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
              <h2 id="cta-title" className="t-h2 max-w-2xl">
                {title}
              </h2>
              <p className="t-lead mt-5 max-w-xl">{lead}</p>
            </div>
            <div className="flex flex-col gap-4 lg:items-end">
              <ButtonLink href={primary.href} size="lg" icon="arrowRight" className="w-full sm:w-auto">
                {primary.label}
              </ButtonLink>
              {secondaryLink}
            </div>
          </div>
          {pointList && <div className="relative mt-10 border-t border-line-subtle pt-6">{pointList}</div>}
        </div>
      </Container>
    </section>
  );
}
