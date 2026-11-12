import { Icon } from "@/components/ui/Icon";
import type { FlowNode } from "@/content/v5-types";

/**
 * Integration flow (Future Commerce §5): Website → API → CRM → Automation → Analytics. An ordered list of nodes
 * joined by "beams": a hairline with a short light travelling along it (CSS transform, off with reduced motion).
 * Original, dependency-free equivalent of an animated-beam component; server-rendered, no client JavaScript.
 */
export function IntegrationFlow({ nodes, caption, testId }: { nodes: FlowNode[]; caption: string; testId?: string }) {
  return (
    <figure className="min-w-0">
      <ol className="fc-flow" style={{ ["--nodes" as string]: nodes.length }} data-testid={testId}>
        {nodes.map((node, index) => (
          <li key={node.key} className="min-w-0">
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
            {index < nodes.length - 1 && <span className="fc-beam" style={{ ["--i" as string]: index }} aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <figcaption className="t-label mt-4">{caption}</figcaption>
    </figure>
  );
}
