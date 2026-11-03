import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { Stage } from "@/content/bg/reference";
import type { IntegrationStatus } from "@/lib/reference";

/**
 * Reference diagram as accessible HTML: an ordered list of stages (top to bottom is the flow), each
 * with its components, followed by the same content as a table. It is an illustration — no status,
 * health or live data is ever shown in it.
 */
export function FlowDiagram({ id, stages, title, note, labels }: {
  id: string;
  stages: Stage[];
  title: string;
  note: string;
  labels: { tableTitle: string; stage: string; components: string };
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-5" data-testid="reference-diagram">
      <div>
        <h2 id={`${id}-title`} className="t-h2">
          {title}
        </h2>
        <p className="mt-2 text-sm text-fg-muted">{note}</p>
      </div>
      <ol className="tool-frame grid gap-0 p-4 sm:p-6" aria-label={title}>
        {stages.map((stage, index) => (
          <li key={stage.title} className="grid" data-stage={index}>
            <div className="grid gap-3 rounded-[var(--radius-md)] border border-line-subtle bg-surface-1 p-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
              <h3 className="text-sm font-semibold text-fg">
                <span className="mr-2 font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span>
                {stage.title}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {stage.items.map((item) => (
                  <li key={item} className="rounded-[var(--radius-md)] border border-line-default bg-surface-page px-3 py-1.5 text-sm text-fg-secondary">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {index < stages.length - 1 && (
              <span className="flex h-6 items-center justify-center text-fg-subtle" aria-hidden="true">
                <Icon name="chevronDown" className="h-4 w-4" />
              </span>
            )}
          </li>
        ))}
      </ol>
      <details className="accordion group rounded-[var(--radius-lg)] border border-line-subtle bg-surface-1 px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg [&::-webkit-details-marker]:hidden">
          {labels.tableTitle}
          <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-brand transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[24rem] text-left text-sm">
            <thead className="text-fg-subtle">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">{labels.stage}</th>
                <th scope="col" className="py-2 font-medium">{labels.components}</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.title} className="border-t border-line-subtle align-top">
                  <th scope="row" className="py-2 pr-4 font-medium text-fg">{stage.title}</th>
                  <td className="py-2 text-fg-secondary">{stage.items.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function TextBlock({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="min-w-0 border-t border-line-subtle pt-5" data-testid={testId}>
      <h2 className="t-label">{title}</h2>
      <div className="mt-3 text-[15px] leading-relaxed text-fg-secondary">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

const STATUS_BADGE: Record<IntegrationStatus, string> = {
  documented: "badge",
  demo: "badge badge-accent",
  available_adapter: "badge badge-success",
  configured: "badge badge-success",
  future: "badge badge-warning",
};

export function StatusBadge({ status, label }: { status: IntegrationStatus; label: string }) {
  return (
    <span className={STATUS_BADGE[status]} data-status={status}>
      {label}
    </span>
  );
}

export function LinkList({ items, testId }: { items: { href: string; label: string }[]; testId?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-testid={testId}>
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className={cx("badge hover:border-brand")}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
