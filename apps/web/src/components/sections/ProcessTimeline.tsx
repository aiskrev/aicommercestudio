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
        "before:absolute before:bottom-6 before:left-[1.4rem] before:top-6 before:w-px before:bg-gradient-to-b before:from-cyan-400/60 before:via-blue-500/40 before:to-violet-500/50",
        "lg:before:bottom-auto lg:before:left-6 lg:before:right-6 lg:before:top-[1.4rem] lg:before:h-px lg:before:w-auto lg:before:bg-gradient-to-r",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-5 lg:block">
          <span className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-ink-950 font-display text-sm font-semibold text-cyan-200 shadow-[0_0_0_6px_var(--color-ink-950),0_0_24px_-6px_rgb(34_211_238_/_0.6)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="pt-1.5 lg:mt-5 lg:pt-0">
            <h3 className="t-h3">{step.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
