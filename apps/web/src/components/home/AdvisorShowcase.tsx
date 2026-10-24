import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Eyebrow } from "@/components/ui/primitives";

interface Showcase {
  eyebrow: string;
  title: string;
  lead: string;
  sampleLabel: string;
  inputTitle: string;
  outputTitle: string;
  input: { business: string; volume: string; tools: string[]; description: string };
  output: { complexity: string; opportunities: string[]; approval: string; question: string };
  labels: Record<"business" | "volume" | "tools" | "description" | "complexity" | "opportunities" | "approval" | "question", string>;
  note: string;
  cta: string;
}

/**
 * Product showcase for the AI Automation Advisor: how it works, an example input and an excerpt of
 * the structured output (sample data, labelled), and a link to the real tool. Rendered on the
 * light editorial surface so the dark product window stands out.
 */
export function AdvisorShowcase({
  content,
  steps,
  stepsTitle,
  href,
  id,
}: {
  content: Showcase;
  steps: { title: string; description: string }[];
  stepsTitle: string;
  href: string;
  id: string;
}) {
  const { labels } = content;
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
      <div>
        <Eyebrow>{content.eyebrow}</Eyebrow>
        <h2 id={id} className="t-h2 mt-4">
          {content.title}
        </h2>
        <p className="t-lead mt-5">{content.lead}</p>
        <h3 className="mt-8 text-[15px] font-semibold text-ink">{stepsTitle}</h3>
        <ol className="mt-3 grid gap-3">
          {steps.slice(0, 3).map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <span className="font-mono text-sm text-brand-ink">{String(index + 1).padStart(2, "0")}</span>
              <span>
                <span className="block font-semibold text-ink">{step.title}</span>
                <span className="block text-[15px] leading-relaxed text-ink-muted">{step.description}</span>
              </span>
            </li>
          ))}
        </ol>
        <ButtonLink href={href} size="lg" icon="arrowRight" className="mt-8">
          {content.cta}
        </ButtonLink>
      </div>

      <figure className="overflow-hidden rounded-[var(--radius-xl)] bg-ink-950 text-fg-secondary shadow-[0_40px_80px_-40px_rgb(20_35_45_/_0.55)]" aria-label={content.sampleLabel}>
        <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          </div>
          <span className="rounded-[5px] border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-[11px] text-warning">
            {content.sampleLabel}
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:p-6">
          <section aria-label={content.inputTitle} className="rounded-[var(--radius-md)] border border-line-subtle bg-surface-1 p-4">
            <p className="t-label">{content.inputTitle}</p>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-[14px] sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-fg-subtle">{labels.business}</dt>
              <dd className="text-fg">{content.input.business}</dd>
              <dt className="text-fg-subtle">{labels.volume}</dt>
              <dd className="text-fg">{content.input.volume}</dd>
              <dt className="text-fg-subtle">{labels.tools}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {content.input.tools.map((tool) => (
                  <span key={tool} className="badge">
                    {tool}
                  </span>
                ))}
              </dd>
              <dt className="text-fg-subtle">{labels.description}</dt>
              <dd className="leading-relaxed text-fg-secondary">“{content.input.description}”</dd>
            </dl>
          </section>

          <div className="flex items-center gap-3 font-mono text-[12px] text-brand-2" aria-hidden="true">
            <span className="h-px flex-1 bg-line-default" />
            <Icon name="sparkles" className="h-4 w-4" />
            <span className="h-px flex-1 bg-line-default" />
          </div>

          <section aria-label={content.outputTitle} className="rounded-[var(--radius-md)] border border-brand-2/30 bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="t-label">{content.outputTitle}</p>
              <span className="rounded-[5px] border border-line-default px-2 py-0.5 font-mono text-[11px] text-fg-secondary">
                {labels.complexity}: {content.output.complexity}
              </span>
            </div>
            <p className="mt-3 text-[13px] text-fg-subtle">{labels.opportunities}</p>
            <ul className="mt-1.5 grid gap-1.5 text-[14.5px] text-fg">
              {content.output.opportunities.map((item) => (
                <li key={item} className="flex gap-2">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex gap-2 rounded-[6px] border border-warning/35 bg-warning/[0.07] px-3 py-2 text-[14px] text-fg-secondary">
              <Icon name="users" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                <span className="font-semibold text-warning">{labels.approval}: </span>
                {content.output.approval}
              </span>
            </p>
            <p className="mt-3 text-[13px] text-fg-subtle">{labels.question}</p>
            <p className="mt-1 text-[14.5px] text-fg-secondary">{content.output.question}</p>
          </section>
        </div>
        <figcaption className="border-t border-line-subtle px-5 py-3 text-xs leading-relaxed text-fg-subtle sm:px-6">{content.note}</figcaption>
      </figure>
    </div>
  );
}
