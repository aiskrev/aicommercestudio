import { AiOpsDiagram } from "@/components/sections/AiOpsDiagram";
import { ButtonLink, Eyebrow } from "@/components/ui/primitives";

/**
 * Homepage feature for AI Managed Services: positioning, the operations lifecycle (conceptual) and
 * the three plans by audience — with the "custom quote" label and no prices or service levels.
 */
export function ManagedFeature({
  id,
  eyebrow,
  title,
  lead,
  diagram,
  plans,
  priceLabel,
  primary,
  secondary,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  diagram: { title: string; caption: string; steps: { title: string; description: string }[] };
  plans: { key: string; name: string; audience: string }[];
  priceLabel: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
}) {
  return (
    <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="t-h2 mt-4">
          {title}
        </h2>
        <p className="t-lead mt-5 max-w-xl">{lead}</p>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle bg-line-subtle">
          {plans.map((plan) => (
            <li key={plan.key} className="bg-surface-1 px-5 py-4">
              <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-semibold text-fg">{plan.name}</span>
                <span className="font-mono text-[12px] text-brand">{priceLabel}</span>
              </span>
              <span className="mt-1 block text-[14.5px] leading-relaxed text-fg-muted">{plan.audience}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={primary.href} size="lg" icon="arrowRight">
            {primary.label}
          </ButtonLink>
          <ButtonLink href={secondary.href} size="lg" variant="secondary">
            {secondary.label}
          </ButtonLink>
        </div>
      </div>
      <div className="lg:self-center">
        <AiOpsDiagram title={diagram.title} caption={diagram.caption} steps={diagram.steps} vertical />
      </div>
    </div>
  );
}
