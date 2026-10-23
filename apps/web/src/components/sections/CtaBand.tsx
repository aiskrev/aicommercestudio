import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container } from "@/components/ui/primitives";

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
        <div className="card-accent relative overflow-hidden rounded-[1.75rem] px-6 py-14 text-center sm:px-12 sm:py-16">
          <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl">
            <h2 id="cta-title" className="t-h2">
              {title}
            </h2>
            <p className="t-lead mt-4">{lead}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={primary.href} size="lg" icon="arrowRight">
                {primary.label}
              </ButtonLink>
              {secondary && (
                <ButtonLink href={secondary.href} size="lg" variant="secondary">
                  {secondary.label}
                </ButtonLink>
              )}
            </div>
            {points && points.length > 0 && (
              <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-300">
                {points.map((point) => (
                  <li key={point} className="inline-flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 text-cyan-300" />
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
