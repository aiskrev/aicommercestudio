import { Icon, type IconName } from "@/components/ui/Icon";

const ICONS: IconName[] = ["bot", "gauge", "alert", "sparkles", "check"];

/**
 * Conceptual diagram of AI Managed Services: application → monitoring & evaluation → incident
 * management → optimization → reliable operations. Purely illustrative (no data, no live status);
 * the caption says so. Horizontal from `lg`, vertical on small screens.
 */
export function AiOpsDiagram({
  title,
  caption,
  steps,
}: {
  title: string;
  caption: string;
  steps: { title: string; description: string }[];
}) {
  return (
    <figure className="card-accent rounded-[1.5rem] p-6 sm:p-8" data-testid="ai-ops-diagram">
      <figcaption className="sr-only">{`${title}. ${caption}`}</figcaption>
      <ol className="grid gap-3 lg:grid-cols-5 lg:gap-0">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex items-center gap-4 lg:flex-col lg:items-stretch lg:gap-0">
            <div className="flex flex-1 items-center gap-4 rounded-2xl border border-white/[0.08] bg-ink-950/60 p-4 lg:mx-2 lg:flex-col lg:items-start lg:p-5">
              <span
                className={
                  index === steps.length - 1
                    ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                    : "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
                }
                aria-hidden="true"
              >
                <Icon name={ICONS[index] ?? "check"} className="h-5 w-5" />
              </span>
              <div className="min-w-0 lg:mt-4">
                <p className="font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm text-slate-400">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <span
                className="absolute -bottom-3 left-8 z-10 text-cyan-300 lg:-right-2 lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2"
                aria-hidden="true"
              >
                <Icon name="arrowRight" className="h-4 w-4 rotate-90 lg:rotate-0" />
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-5 flex items-center gap-2 text-xs text-slate-400" aria-hidden="true">
        <Icon name="info" className="h-4 w-4 shrink-0" />
        {caption}
      </p>
    </figure>
  );
}
