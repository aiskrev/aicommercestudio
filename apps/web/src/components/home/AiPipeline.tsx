import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface PipelineStage {
  kind: string;
  title: string;
  description: string;
}

const STAGE: Record<string, { icon: IconName; tone: "brand" | "ai" | "human" }> = {
  input: { icon: "inbox", tone: "brand" },
  ai: { icon: "sparkles", tone: "ai" },
  rules: { icon: "shield", tone: "brand" },
  human: { icon: "users", tone: "human" },
  output: { icon: "check", tone: "brand" },
};

const TONE = {
  brand: "border-line-default bg-surface-2 text-brand",
  ai: "border-brand-2/50 bg-brand-2/10 text-brand-2",
  human: "border-warning/50 bg-warning/10 text-warning",
};

/**
 * Five stages of a controlled AI workflow with the boundary between what AI may do on its own
 * and what needs a human decision. Static diagram; no motion required to understand it.
 */
export function AiPipeline({
  stages,
  allowedTitle,
  allowed,
  approvalTitle,
  approval,
}: {
  stages: PipelineStage[];
  allowedTitle: string;
  allowed: string[];
  approvalTitle: string;
  approval: string[];
}) {
  return (
    <div className="mt-12">
      <ol className="grid gap-3 md:grid-cols-5 md:gap-0">
        {stages.map((stage, index) => {
          const meta = STAGE[stage.kind] ?? STAGE.input;
          const last = index === stages.length - 1;
          return (
            <li key={stage.title} className="relative flex gap-4 md:block md:pr-6">
              {/* connector */}
              {!last && (
                <span
                  className="absolute left-5 top-11 h-[calc(100%-1.5rem)] w-px bg-line-default md:left-11 md:right-0 md:top-5 md:h-px md:w-auto"
                  aria-hidden="true"
                />
              )}
              <span
                className={cx(
                  "relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border",
                  TONE[meta.tone],
                )}
                aria-hidden="true"
              >
                <Icon name={meta.icon} className="h-5 w-5" />
              </span>
              <div className="pb-6 md:pb-0 md:pt-5">
                <p className="t-label">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="t-h3 mt-1">{stage.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{stage.description}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-brand-2/30 bg-brand-2/[0.06] p-5 sm:p-6">
          <p className="flex items-center gap-2 font-semibold text-fg">
            <Icon name="sparkles" className="h-4 w-4 text-brand-2" />
            {allowedTitle}
          </p>
          <ul className="mt-3 grid gap-1.5 text-[15px] text-fg-secondary">
            {allowed.map((item) => (
              <li key={item} className="flex gap-2">
                <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-brand-2" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-warning/35 bg-warning/[0.06] p-5 sm:p-6">
          <p className="flex items-center gap-2 font-semibold text-fg">
            <Icon name="lock" className="h-4 w-4 text-warning" />
            {approvalTitle}
          </p>
          <ul className="mt-3 grid gap-1.5 text-[15px] text-fg-secondary">
            {approval.map((item) => (
              <li key={item} className="flex gap-2">
                <Icon name="users" className="mt-1 h-4 w-4 shrink-0 text-warning" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
