import { Icon } from "@/components/ui/Icon";
import { DiagramFrame } from "@/components/ui/patterns";
import { cx } from "@/components/ui/primitives";
import type { ServiceKey } from "@/content/types";

interface Step {
  title: string;
  description: string;
}

type Layout = "cycle" | "tree" | "stack" | "flow" | "funnel" | "hub" | "checklist";

const LAYOUT: Record<ServiceKey, Layout> = {
  maintenance: "cycle",
  seo: "tree",
  ai_tools: "stack",
  automation: "flow",
  analytics: "funnel",
  integrations: "hub",
  ai_managed: "cycle",
  ai_agents: "hub",
  audit: "checklist",
};

/**
 * Conceptual hero diagram for a service page. The shape follows the discipline (maintenance cycle,
 * site tree, application stack, process flow, measurement funnel, system hub, audit checklist);
 * the labels are the service's own workflow steps. It is a concept, not data — labelled as such.
 */
export function ServiceConcept({ service, steps, label }: { service: ServiceKey; steps: Step[]; label: string }) {
  const layout = LAYOUT[service];
  const items = steps.slice(0, 4);
  return (
    <DiagramFrame title={label} titleId="service-concept-title">
      <div>
        {layout === "cycle" && <Cycle items={items} />}
        {layout === "tree" && <Tree items={items} />}
        {layout === "stack" && <Stack items={items} />}
        {layout === "flow" && <Flow items={items} />}
        {layout === "funnel" && <Funnel items={items} />}
        {layout === "hub" && <Hub items={items} />}
        {layout === "checklist" && <Checklist items={items} />}
      </div>
    </DiagramFrame>
  );
}

function Node({ step, index, accent = false, className }: { step: Step; index: number; accent?: boolean; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-md)] border px-3.5 py-3",
        accent ? "border-brand/45 bg-brand/[0.07]" : "border-line-default bg-surface-2",
        className,
      )}
    >
      <p className="font-mono text-[11px] text-fg-subtle">{String(index + 1).padStart(2, "0")}</p>
      <p className="mt-0.5 text-sm font-semibold leading-snug text-fg">{step.title}</p>
    </div>
  );
}

/** Repeating cycle (maintenance, managed operations): 2×2 with a loop arrow in the middle. */
function Cycle({ items }: { items: Step[] }) {
  const order = [0, 1, 3, 2]; // clockwise reading in a 2×2 grid
  return (
    <div className="relative grid grid-cols-2 gap-3">
      {order.map((i) => items[i] && <Node key={i} step={items[i]} index={i} accent={i === 0} />)}
      <span className="pointer-events-none absolute left-1/2 top-1/2 inline-flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line-default bg-surface-page text-brand" aria-hidden="true">
        <Icon name="refresh" className="h-5 w-5" />
      </span>
    </div>
  );
}

/** Site tree (SEO): first step as the root, the rest as branches. */
function Tree({ items }: { items: Step[] }) {
  const [root, ...branches] = items;
  return (
    <div>
      <Node step={root} index={0} accent className="mx-auto max-w-[16rem] text-center" />
      <div className="mx-auto h-4 w-px bg-line-strong" aria-hidden="true" />
      <div className="mx-[16.6%] h-px bg-line-strong" aria-hidden="true" />
      <div className="grid grid-cols-3 gap-2">
        {branches.map((step, i) => (
          <div key={step.title} className="flex flex-col items-center">
            <span className="h-4 w-px bg-line-strong" aria-hidden="true" />
            <Node step={step} index={i + 1} className="w-full text-center" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Application layers (custom AI tools): stacked, last layer = model/integration. */
function Stack({ items }: { items: Step[] }) {
  return (
    <div className="grid gap-2">
      {items.map((step, i) => (
        <Node key={step.title} step={step} index={i} accent={i === items.length - 1} className={cx(i === 0 && "mr-10", i === 1 && "mr-5")} />
      ))}
    </div>
  );
}

/** Process flow (automation): steps with an approval gate before the last step. */
function Flow({ items }: { items: Step[] }) {
  return (
    <ol className="grid gap-2">
      {items.map((step, i) => (
        <li key={step.title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <Node step={step} index={i} accent={i === items.length - 1} />
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line-default text-fg-muted" aria-hidden="true">
            <Icon name={i === items.length - 2 ? "users" : i === items.length - 1 ? "check" : "arrowRight"} className="h-4 w-4 rotate-0" />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Measurement framework (analytics): narrowing from data to decision. */
function Funnel({ items }: { items: Step[] }) {
  const inset = ["mx-0", "mx-4", "mx-8", "mx-12"];
  return (
    <div className="grid gap-2">
      {items.map((step, i) => (
        <Node key={step.title} step={step} index={i} accent={i === items.length - 1} className={cx(inset[i], "text-center")} />
      ))}
    </div>
  );
}

/** System architecture (integrations): hub in the middle, systems around it. */
function Hub({ items }: { items: Step[] }) {
  return (
    <div className="relative grid grid-cols-2 gap-x-14 gap-y-8">
      {items.map((step, i) => (
        <Node key={step.title} step={step} index={i} accent={i === 1} />
      ))}
      <span className="pointer-events-none absolute inset-x-[22%] top-1/2 h-px bg-line-strong" aria-hidden="true" />
      <span className="pointer-events-none absolute inset-y-[22%] left-1/2 w-px bg-line-strong" aria-hidden="true" />
      <span className="pointer-events-none absolute left-1/2 top-1/2 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[var(--radius-md)] border border-brand/50 bg-surface-page text-brand" aria-hidden="true">
        <Icon name="plug" className="h-5 w-5" />
      </span>
    </div>
  );
}

/** Audit: a checklist that ends in a prioritised plan. */
function Checklist({ items }: { items: Step[] }) {
  return (
    <ul className="grid gap-2">
      {items.map((step, i) => (
        <li key={step.title} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line-default bg-surface-2 px-3.5 py-3">
          <span className={cx("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border", i < items.length - 1 ? "border-brand/50 text-brand" : "border-line-strong text-fg-subtle")} aria-hidden="true">
            <Icon name="check" className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-fg">{step.title}</span>
        </li>
      ))}
    </ul>
  );
}
