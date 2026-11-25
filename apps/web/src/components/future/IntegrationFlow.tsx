import { reveal } from "@/components/motion/reveal";
import { Icon } from "@/components/ui/Icon";
import type { FlowNode } from "@/content/v5-types";

/**
 * Integration flow (Future Commerce §5): Website → API → CRM → Automation → Analytics. An ordered list of nodes
 * joined by "beams"; from 64rem a data bus runs above the five nodes (docs/MOTION_SYSTEM.md → Integration flow).
 *
 * When the figure scrolls into view (components/motion/reveal.ts) the nodes are drawn in order, the bus fills, a
 * small data packet (transform only) travels from the first node to the last, and each node pulses once as the
 * packet reaches it. Where scroll-driven animations are supported on desktop the bus, the packet and the pulses
 * follow the scroll instead. On phones a packet runs down each beam in turn. Without JavaScript, with reduced
 * motion or when the figure is on screen at load, the full diagram is shown at once and there is no packet.
 * Server-rendered; no client JavaScript of its own.
 */
export function IntegrationFlow({ nodes, caption, testId }: { nodes: FlowNode[]; caption: string; testId?: string }) {
  return (
    <figure {...reveal()} className="fc-flow-figure min-w-0" style={{ ["--nodes" as string]: nodes.length }}>
      <div className="fc-bus" aria-hidden="true">
        <span className="fc-bus-fill" />
        <span className="fc-packet">
          <i />
        </span>
      </div>
      <ol className="fc-flow" data-testid={testId}>
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
