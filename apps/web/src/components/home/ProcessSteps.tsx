import { cx } from "@/components/ui/primitives";

export interface ProcessStep {
  title: string;
  description: string;
  outputs?: string[];
}

/**
 * Stepped process. `vertical`: large mono numerals on a rail (service pages). `horizontal`: a
 * timeline across the page from `lg` (homepage), vertical rail on smaller screens.
 */
export function ProcessSteps({ steps, layout = "vertical" }: { steps: ProcessStep[]; layout?: "vertical" | "horizontal" }) {
  if (layout === "horizontal") {
    return (
      <ol className={cx("grid gap-8 lg:gap-6", steps.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {steps.map((step, index) => (
          <li key={step.title} className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-4 lg:block">
            {/* rail: vertical on mobile, horizontal from lg */}
            {index < steps.length - 1 && (
              <span
                className="absolute bottom-[-2rem] left-[1.2rem] top-12 w-px bg-line-default lg:bottom-auto lg:left-14 lg:right-[-1.5rem] lg:top-[1.2rem] lg:h-px lg:w-auto"
                aria-hidden="true"
              />
            )}
            <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-brand/50 bg-surface-page font-mono text-sm text-brand">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="lg:mt-6">
              <h3 className="t-h3">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{step.description}</p>
              {step.outputs && (
                <ul className="mt-4 grid gap-1.5 text-[14px] text-fg-secondary">
                  {step.outputs.map((output) => (
                    <li key={output} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
                      {output}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="relative">
      {steps.map((step, index) => (
        <li key={step.title} className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 pb-10 last:pb-0 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-6">
          {index < steps.length - 1 && (
            <span className="absolute bottom-0 left-[1.15rem] top-12 w-px bg-line-default sm:left-[1.6rem]" aria-hidden="true" />
          )}
          <span className="font-mono text-3xl font-medium leading-none text-brand sm:text-[2.6rem]" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="border-t border-line-subtle pt-4">
            <h3 className="t-h3-lg">{step.title}</h3>
            <p className="mt-2 max-w-xl leading-relaxed text-fg-muted">{step.description}</p>
            {step.outputs && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {step.outputs.map((output) => (
                  <li key={output} className="badge">
                    {output}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
