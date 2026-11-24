import { reveal } from "@/components/motion/reveal";
import { Icon } from "@/components/ui/Icon";
import type { FlowNode } from "@/content/v5-types";

/**
 * Integration flow (Future Commerce §5): Website → API → CRM → Automation → Analytics. An ordered list of nodes
 * joined by "beams" (brand hairlines). When the figure first scrolls into view it is drawn once — node, connector,
 * node, 150 ms apart (components/motion/reveal.ts; CSS transform and opacity) — and then stays static. Without
 * JavaScript, with reduced motion or when it is on screen at load, the full diagram is shown at once.
 * Server-rendered; no client JavaScript of its own.
 */
export function IntegrationFlow({ nodes, caption, testId }: { nodes: FlowNode[]; caption: string; testId?: string }) {
  return (
    <figure className="min-w-0">
      <ol {...reveal()} className="fc-flow" style={{ ["--nodes" as string]: nodes.length }} data-testid={testId}>
        {nodes.map((node, index) => (
          <li key={node.key} className="min-w-0" style={{ ["--i" as string]: index }}>
            <div className="fc-node h-full">
              <span className="flex items-center gap-3">
                <span className="fc-card-icon h-10 w-10" style={index === 3 ? { ["--fc-tone" as string]: "var(--color-brand-2)" } : undefined}>
                  <Icon name={node.icon} className="h-4.5 w-4.5" />
                </span>
                <span className="t-index">{String(index + 1).padStart(2, "0")}</span>
              </span>
              <span className="mt-2 font-semibold text-fg">{node.title}</span>
              <span className="text-body-sm leading-relaxed text-fg-muted">{node.text}</span>
            </div>
            {index < nodes.length - 1 && <span className="fc-beam" aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <figcaption className="t-label mt-4">{caption}</figcaption>
    </figure>
  );
}
