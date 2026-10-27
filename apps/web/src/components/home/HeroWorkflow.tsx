import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface WorkflowStep {
  kind: string;
  label: string;
  detail: string;
  code?: string;
  output?: string[][];
  status?: string;
}

export interface WorkflowContent {
  label: string;
  demo: string;
  title: string;
  caption: string;
  steps: WorkflowStep[];
}

const KIND_ICON: Record<string, IconName> = {
  event: "cart",
  api: "plug",
  ai: "sparkles",
  approval: "users",
  action: "check",
};

/**
 * Product-style illustration of a controlled automation: store event → API → AI suggestion →
 * rules + human approval → business action. Static and fully readable without motion; the
 * illustrative data is labelled as a demo (never presented as a live system).
 */
export function HeroWorkflow({ content }: { content: WorkflowContent }) {
  return (
    <figure className="panel relative overflow-hidden" aria-labelledby="hero-workflow-title">
      {/* window bar */}
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-window-chrome" />
          <span className="h-2.5 w-2.5 rounded-full bg-window-chrome" />
          <span className="h-2.5 w-2.5 rounded-full bg-window-chrome" />
        </div>
        <p className="t-label min-w-0 truncate">{content.label}</p>
        <span className="shrink-0 whitespace-nowrap rounded-[5px] border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-[11px] font-medium text-warning">
          {content.demo}
        </span>
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6">
        <p id="hero-workflow-title" className="text-[15px] font-semibold text-fg">
          {content.title}
        </p>

        <ol className="relative mt-3 sm:mt-4">
          {content.steps.map((step, index) => {
            const last = index === content.steps.length - 1;
            const isAi = step.kind === "ai";
            const isApproval = step.kind === "approval";
            return (
              <li key={step.label} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 pb-2 last:pb-0 sm:pb-3.5">
                {!last && <span className="flow-line absolute bottom-0 left-[1.1rem] top-9 w-px" aria-hidden="true" />}
                <span
                  className={cx(
                    "relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border",
                    isAi
                      ? "border-brand-2/50 bg-brand-2/10 text-brand-2"
                      : isApproval
                        ? "border-warning/50 bg-warning/10 text-warning"
                        : "border-line-default bg-surface-2 text-brand",
                  )}
                  aria-hidden="true"
                >
                  <Icon name={KIND_ICON[step.kind] ?? "workflow"} className="h-4 w-4" />
                </span>
                <div
                  className={cx(
                    "min-w-0 rounded-[var(--radius-md)] border px-3.5 py-2.5",
                    isAi ? "border-brand-2/30 bg-surface-2" : "border-line-subtle bg-surface-page/60",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-fg">{step.label}</p>
                    {step.status && (
                      <span
                        className={cx(
                          "font-mono text-[11px]",
                          isApproval ? "text-warning" : "text-fg-muted",
                        )}
                      >
                        {step.status}
                      </span>
                    )}
                  </div>
                  {/* Phones: titles and status only, so the CTA above stays close to the fold. */}
                  <p className="mt-0.5 hidden text-[13px] leading-snug text-fg-muted sm:block">{step.detail}</p>
                  {step.code && (
                    <p className="mt-2 hidden truncate rounded-[5px] bg-surface-page px-2 py-1 font-mono text-[11.5px] text-brand sm:block">
                      {step.code}
                    </p>
                  )}
                  {step.output && (
                    <dl className="mt-2 hidden grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-[5px] bg-surface-page px-2.5 py-1.5 font-mono text-[11.5px] sm:grid">
                      {step.output.map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="text-fg-subtle">{key}</dt>
                          <dd className="truncate text-brand-2">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <figcaption className="border-t border-line-subtle px-5 py-3 text-xs leading-relaxed text-fg-subtle sm:px-6">
        {content.caption}
      </figcaption>
    </figure>
  );
}
