import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { DiagramFrame } from "@/components/ui/patterns";

export interface LifecycleContent {
  label: string;
  caption: string;
  center: string;
  stages: { key: string; title: string; text: string; anchor: string }[];
}

/**
 * AI Managed Services as an operating lifecycle (discover → onboard → observe → evaluate →
 * optimize → govern, with observe → evaluate → optimize repeating). Each stage links to the part of
 * the service page that describes it. An illustration of the way of working, captioned as such:
 * no package, response time or SLA is implied.
 */
export function ManagedLifecycle({ content, serviceHref }: { content: LifecycleContent; serviceHref: string }) {
  return (
    <DiagramFrame title={content.label} titleId="managed-lifecycle-title" caption={content.caption}>
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Icon name="gauge" className="h-4 w-4 text-brand-2" />
        {content.center}
      </p>
      <ol className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line-subtle bg-line-subtle sm:grid-cols-2" data-testid="managed-lifecycle">
        {content.stages.map((stage, index) => (
          <li key={stage.key} className="bg-surface-1" data-stage={stage.key}>
            <Link href={`${serviceHref}#${stage.anchor}`} className="group flex h-full gap-3 p-4 transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2">
              <span className="t-index pt-0.5">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold text-fg group-hover:text-brand">
                  {stage.title}
                  <Icon name="arrowRight" className="arrow-nudge h-3.5 w-3.5 text-fg-subtle group-hover:text-brand" />
                </span>
                <span className="mt-1 block text-caption leading-relaxed text-fg-muted">{stage.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-2 text-caption text-fg-subtle" aria-hidden="true">
        <Icon name="refresh" className="h-3.5 w-3.5" />
        {content.stages.slice(2, 5).map((stage) => stage.title).join(" → ")} →
      </p>
    </DiagramFrame>
  );
}
