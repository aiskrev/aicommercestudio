import { Icon } from "@/components/ui/Icon";
import { DiagramFrame } from "@/components/ui/patterns";
import { cx } from "@/components/ui/primitives";

export interface SystemMapContent {
  label: string;
  badge: string;
  caption: string;
  layers: { key: string; title: string; items: string[] }[];
  gate: { title: string; description: string };
  actions: { title: string; items: string[] };
  operations: string;
}

/** Colour of the node dots per layer (diagram semantics: teal = data/systems, periwinkle = AI). */
const DOT: Record<string, string> = {
  data: "bg-brand",
  intelligence: "bg-brand-2",
  agents: "bg-brand-2",
};

/**
 * Hero diagram: the layers of an AI system as we build it — data and systems → intelligence →
 * agents and automation → human approval gate → actions — with operations (monitoring, evaluation,
 * cost, incidents) running alongside. Server-rendered, translatable HTML; the only motion is the
 * flowing connector, which stops under reduced motion. Illustrative, and captioned as such.
 */
export function SystemMap({ content }: { content: SystemMapContent }) {
  return (
    <DiagramFrame
      title={content.label}
      titleId="system-map-title"
      meta={<span className="badge badge-accent">{content.badge}</span>}
      caption={content.caption}
      testId="system-map"
    >
      <div className="relative sm:pr-7">
        <ol className="grid" aria-labelledby="system-map-title">
          {content.layers.map((layer, index) => (
            <li key={layer.key}>
              <Layer index={index + 1} title={layer.title} items={layer.items} dot={DOT[layer.key] ?? "bg-brand"} />
              <Connector />
            </li>
          ))}
          <li>
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-warning/45 bg-warning/[0.07] px-3.5 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-warning/50 text-warning" aria-hidden="true">
                <Icon name="users" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-warning">{content.gate.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-fg-secondary">{content.gate.description}</span>
              </span>
            </div>
            <Connector />
          </li>
          <li>
            <Layer
              index={content.layers.length + 1}
              title={content.actions.title}
              items={content.actions.items}
              dot="bg-success"
              tone="success"
            />
          </li>
        </ol>

        {/* Operations rail: monitoring runs alongside every layer (decorative; the text below names it). */}
        <span className="absolute bottom-3 right-1.5 top-3 hidden w-px bg-success/35 sm:block" aria-hidden="true">
          {[0, 25, 50, 75, 100].map((top) => (
            <span
              key={top}
              className="absolute -left-[3px] h-[7px] w-[7px] rounded-full border border-success/70 bg-surface-1"
              style={{ top: `${top}%` }}
            />
          ))}
        </span>
      </div>

      <p className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-success/30 bg-success/[0.06] px-3.5 py-2.5 text-[13px] leading-snug text-fg-secondary">
        <Icon name="activity" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        {content.operations}
      </p>
    </DiagramFrame>
  );
}

function Layer({
  index,
  title,
  items,
  dot,
  tone = "default",
}: {
  index: number;
  title: string;
  items: string[];
  dot: string;
  tone?: "default" | "success";
}) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-md)] border px-3.5 py-3",
        tone === "success" ? "border-success/35 bg-success/[0.05]" : "border-line-default bg-surface-2",
      )}
    >
      <p className="flex items-baseline gap-2.5">
        <span className="t-index text-fg-subtle" aria-hidden="true">
          {String(index).padStart(2, "0")}
        </span>
        <span className="text-[14px] font-semibold text-fg">{title}</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-line-subtle bg-surface-page px-2 py-1 text-[12.5px] leading-none text-fg-secondary"
          >
            <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-1" aria-hidden="true">
      <span className="flow-line h-5 w-px" />
    </div>
  );
}
