export interface ProcessStep {
  title: string;
  description: string;
  outputs?: string[];
}

/** Stepped editorial sequence: large mono numerals on a vertical rail, outputs as tags. */
export function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  return (
    <ol className="relative">
      {steps.map((step, index) => (
        <li key={step.title} className="relative grid grid-cols-[3.5rem_1fr] gap-4 pb-10 last:pb-0 sm:grid-cols-[5rem_1fr] sm:gap-6">
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
