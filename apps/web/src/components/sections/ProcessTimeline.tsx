import { cx } from "@/components/ui/primitives";

const columns: Record<number, string> = {
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

/**
 * Process diagram: a horizontal connected timeline on large screens and a vertical one on
 * mobile. The connecting line is decorative (pseudo-element), steps are an ordered list.
 */
export function ProcessTimeline({
  steps,
  className,
}: {
  steps: { title: string; description: string }[];
  className?: string;
}) {
  return (
    <ol
      className={cx(
        "relative grid gap-8 lg:gap-5",
        columns[steps.length] ?? "lg:grid-cols-6",
        // connecting line: vertical on mobile, horizontal on desktop
        "before:absolute before:bottom-6 before:left-[1.25rem] before:top-6 before:w-px before:bg-line-default",
        "lg:before:bottom-auto lg:before:left-6 lg:before:right-6 lg:before:top-[1.25rem] lg:before:h-px lg:before:w-auto",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-5 lg:block">
          <span className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-brand/45 bg-surface-page font-mono text-[13px] font-medium text-brand shadow-[0_0_0_6px_var(--surface-page)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="pt-1.5 lg:mt-5 lg:pt-0">
            <h3 className="t-h3">{step.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
