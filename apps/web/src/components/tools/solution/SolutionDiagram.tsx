"use client";

import { useState } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { type ArchitectureComponent, type ComponentKey, LAYERS, type Layer } from "@/lib/solution";

export interface ComponentText {
  title: string;
  text: string;
  /** Short qualifier shown on the chip, e.g. "read and write". */
  meta?: string;
}

const LAYER_ICONS: Record<Layer, IconName> = {
  trigger: "inbox",
  orchestration: "workflow",
  agents: "bot",
  retrieval: "search",
  tools: "plug",
  approval: "shield",
  outputs: "target",
  monitoring: "activity",
};

/**
 * Layered architecture flow in plain HTML: an ordered list of layers (top to bottom is the flow of
 * data), each with its components as toggle buttons that show their responsibility in a details
 * panel. Monitoring spans every layer. The same information is available as a table below.
 */
export function SolutionDiagram({
  id,
  components,
  describe,
  labels,
  titleHidden = false,
}: {
  id: string;
  components: ArchitectureComponent[];
  describe: (key: ComponentKey) => ComponentText;
  labels: {
    title: string;
    note: string;
    layers: Record<Layer, string>;
    notUsed: string;
    hint: string;
    detailsLabel: string;
    monitoringNote: string;
    listTitle: string;
    table: { layer: string; component: string; responsibility: string };
  };
  /** When the surrounding step already shows the same heading, keep it for screen readers only. */
  titleHidden?: boolean;
}) {
  const [selected, setSelected] = useState<ComponentKey | null>(null);
  const flow = LAYERS.filter((layer) => layer !== "monitoring");
  const inLayer = (layer: Layer) => components.filter((c) => c.layer === layer);
  const current = selected && components.some((c) => c.key === selected) ? describe(selected) : null;
  const panelId = `${id}-details`;

  const chip = (component: ArchitectureComponent) => {
    const text = describe(component.key);
    const active = component.key === selected;
    return (
      <li key={component.key}>
        <button
          type="button"
          aria-pressed={active}
          aria-controls={panelId}
          onClick={() => setSelected(active ? null : component.key)}
          data-component={component.key}
          className={cx(
            "inline-flex min-h-11 max-w-full items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            active ? "border-brand bg-brand/[0.12] text-fg" : "border-line-default bg-surface-page text-fg-secondary hover:border-line-strong",
          )}
        >
          <span className="min-w-0">
            <span className="block font-medium text-fg">{text.title}</span>
            {text.meta && <span className="block text-xs text-fg-subtle">{text.meta}</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-5 [&>*]:min-w-0">
      <div>
        <h2 id={`${id}-title`} className={titleHidden ? "sr-only" : "t-h3-lg"}>
          {labels.title}
        </h2>
        <p className={cx("text-sm text-fg-muted", !titleHidden && "mt-1.5")}>{labels.note}</p>
      </div>

      <div className="tool-frame grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <ol className="grid gap-0" aria-label={labels.title} data-testid="solution-diagram">
          {flow.map((layer, index) => {
            const items = inLayer(layer);
            return (
              <li key={layer} className="grid" data-layer={layer}>
                <div className="grid gap-3 rounded-[var(--radius-md)] border border-line-subtle bg-surface-1 p-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <Icon name={LAYER_ICONS[layer]} className="h-4 w-4 shrink-0 text-brand" />
                    {labels.layers[layer]}
                  </h3>
                  {items.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">{items.map(chip)}</ul>
                  ) : (
                    <p className="text-sm text-fg-subtle">{labels.notUsed}</p>
                  )}
                </div>
                {index < flow.length - 1 && (
                  <span className="flex h-6 items-center justify-center text-fg-subtle" aria-hidden="true">
                    <Icon name="chevronDown" className="h-4 w-4" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <aside
          aria-labelledby={`${id}-monitoring`}
          className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-dashed border-line-strong p-3"
          data-layer="monitoring"
        >
          <h3 id={`${id}-monitoring`} className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Icon name={LAYER_ICONS.monitoring} className="h-4 w-4 shrink-0 text-brand" />
            {labels.layers.monitoring}
          </h3>
          <p className="text-xs text-fg-subtle">{labels.monitoringNote}</p>
          <ul className="flex flex-wrap gap-2 lg:flex-col">{inLayer("monitoring").map(chip)}</ul>
        </aside>
      </div>

      <div id={panelId} role="region" aria-label={labels.detailsLabel} aria-live="polite" className="min-h-16 rounded-[var(--radius-md)] border border-line-subtle bg-surface-1 px-4 py-3 text-sm">
        {current ? (
          <>
            <p className="font-semibold text-fg">{current.title}</p>
            <p className="mt-1 leading-relaxed text-fg-muted">{current.text}</p>
          </>
        ) : (
          <p className="text-fg-muted">{labels.hint}</p>
        )}
      </div>

      <details className="accordion group rounded-[var(--radius-lg)] border border-line-subtle bg-surface-1 px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg [&::-webkit-details-marker]:hidden">
          {labels.listTitle}
          <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-brand transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm" data-testid="solution-diagram-table">
            <thead className="text-fg-subtle">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {labels.table.layer}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {labels.table.component}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {labels.table.responsibility}
                </th>
              </tr>
            </thead>
            <tbody>
              {LAYERS.flatMap((layer) =>
                inLayer(layer).map((component) => {
                  const text = describe(component.key);
                  return (
                    <tr key={component.key} className="border-t border-line-subtle align-top">
                      <td className="py-2 pr-4 text-fg-muted">{labels.layers[layer]}</td>
                      <th scope="row" className="py-2 pr-4 font-medium text-fg">
                        {text.title}
                        {text.meta && <span className="block text-xs font-normal text-fg-subtle">{text.meta}</span>}
                      </th>
                      <td className="py-2 text-fg-secondary">{text.text}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
