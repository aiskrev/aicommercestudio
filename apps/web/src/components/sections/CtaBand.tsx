import { ButtonLink, Container } from "@/components/ui/primitives";

export function CtaBand({
  title,
  lead,
  primary,
  secondary,
}: {
  title: string;
  lead: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="py-16 sm:py-24" aria-labelledby="cta-title">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900 px-6 py-14 text-center sm:px-12">
          <div className="hero-glow pointer-events-none absolute inset-0 opacity-90" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl">
            <h2 id="cta-title" className="text-3xl font-semibold sm:text-4xl">
              {title}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">{lead}</p>
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
          </div>
        </div>
      </Container>
    </section>
  );
}
