import { Icon, type IconName } from "@/components/ui/Icon";
import { DiagramFrame } from "@/components/ui/patterns";
import { cx } from "@/components/ui/primitives";

const ICONS: IconName[] = ["bot", "gauge", "alert", "sparkles", "check"];

/**
 * Conceptual diagram of AI Managed Services: application → monitoring & evaluation → incident
 * management → optimization → reliable operations. Purely illustrative (no data, no live status);
 * the caption says so. `vertical` keeps the stacked layout at every width (used in the hero).
 */
export function AiOpsDiagram({
  title,
  caption,
  steps,
  vertical = false,
}: {
  title: string;
  caption: string;
  steps: { title: string; description: string }[];
  vertical?: boolean;
}) {
  return (
    <DiagramFrame title={title} titleId="ai-ops-diagram-title" caption={caption} testId="ai-ops-diagram">
      <ol className={cx("grid gap-2.5", !vertical && "lg:grid-cols-5 lg:gap-0")}>
        {steps.map((step, index) => {
          const last = index === steps.length - 1;
          return (
            <li key={step.title} className={cx("relative flex", !vertical && "lg:flex-col")}>
              <div
                className={cx(
                  "flex flex-1 items-start gap-3.5 rounded-[var(--radius-md)] border p-3.5",
                  last ? "border-success/40 bg-success/[0.06]" : "border-line-default bg-surface-2",
                  !vertical && "lg:mx-1.5 lg:flex-col lg:p-4",
                )}
              >
                <span
                  className={cx(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border",
                    last ? "border-success/45 text-success" : "border-line-default bg-surface-page text-brand",
                  )}
                  aria-hidden="true"
                >
                  <Icon name={ICONS[index] ?? "check"} className="h-4.5 w-4.5" />
                </span>
                <div className={cx("min-w-0", !vertical && "lg:mt-1")}>
                  <p className="text-[15px] font-semibold text-fg">{step.title}</p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-fg-muted">{step.description}</p>
                </div>
              </div>
              {!last && (
                <span
                  className={cx(
                    "absolute -bottom-2.5 left-7 z-10 text-brand",
                    !vertical && "lg:-right-2 lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2",
                  )}
                  aria-hidden="true"
                >
                  <Icon name="arrowRight" className={cx("h-4 w-4 rotate-90", !vertical && "lg:rotate-0")} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </DiagramFrame>
  );
}
