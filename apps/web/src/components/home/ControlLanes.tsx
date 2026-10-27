import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

type Tone = "ai" | "approval" | "record";

const TONE: Record<Tone, { border: string; icon: string; dot: string; glyph: IconName }> = {
  ai: { border: "border-brand-2/35", icon: "text-brand-2", dot: "bg-brand-2", glyph: "sparkles" },
  approval: { border: "border-warning/40", icon: "text-warning", dot: "bg-warning", glyph: "users" },
  record: { border: "border-success/35", icon: "text-success", dot: "bg-success", glyph: "list" },
};

/**
 * The control model next to the orchestration example: what AI may do alone, what needs a human
 * decision, and what is always recorded. Colours follow the diagram semantics (periwinkle = AI,
 * amber = human approval, green = completed / recorded).
 */
export function ControlLanes({ lanes }: { lanes: { tone: Tone; title: string; items: string[] }[] }) {
  return (
    <ul className="grid gap-3">
      {lanes.map((lane) => {
        const t = TONE[lane.tone];
        return (
          <li key={lane.title} className={cx("rounded-[var(--radius-lg)] border bg-surface-1 p-5", t.border)}>
            <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-fg">
              <Icon name={t.glyph} className={cx("h-4.5 w-4.5", t.icon)} />
              {lane.title}
            </h3>
            <ul className="mt-3 grid gap-1.5 text-[15px] text-fg-secondary">
              {lane.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className={cx("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
