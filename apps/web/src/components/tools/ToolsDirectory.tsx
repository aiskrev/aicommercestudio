"use client";

import { useState } from "react";

import { ToolCard, type ToolCardContent, type ToolCardLabels } from "@/components/tools/ToolCard";
import { cx } from "@/components/ui/primitives";

export interface DirectoryTool {
  content: ToolCardContent;
  category: string;
  status: "live" | "planned";
  href?: string;
  introHref?: string;
  minutes?: number;
}

export interface DirectoryLabels {
  filterCategory: string;
  filterStatus: string;
  all: string;
  statusLive: string;
  statusPlanned: string;
  showing: string;
  empty: string;
  reset: string;
  categories: Record<string, string>;
}

/**
 * Every tool of the hub with category and availability filters. The server renders all cards; the
 * filters only narrow the list in the browser, so the page works without JavaScript. Filter
 * buttons use `aria-pressed`, the count is announced through a polite live region.
 */
export function ToolsDirectory({
  tools,
  categories,
  labels,
  cardLabels,
}: {
  tools: DirectoryTool[];
  /** Category keys in display order. */
  categories: readonly string[];
  labels: DirectoryLabels;
  cardLabels: ToolCardLabels;
}) {
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "live" | "planned">("all");
  const shownCategories = categories.filter((key) => tools.some((tool) => tool.category === key));
  const visible = tools.filter((tool) => (category === "all" || tool.category === category) && (status === "all" || tool.status === status));

  const chip = (pressed: boolean, label: string, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
        pressed ? "border-brand bg-brand text-ink-950" : "border-line-default text-fg-secondary hover:border-line-strong hover:text-fg",
      )}
    >
      {label}
    </button>
  );

  return (
    <div data-testid="tools-directory">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label={labels.filterCategory} className="flex flex-wrap gap-2">
          {chip(category === "all", labels.all, () => setCategory("all"), "all")}
          {shownCategories.map((key) => chip(category === key, labels.categories[key] ?? key, () => setCategory(key), key))}
        </div>
        <div role="group" aria-label={labels.filterStatus} className="flex flex-wrap gap-2">
          {chip(status === "all", labels.all, () => setStatus("all"), "all")}
          {chip(status === "live", labels.statusLive, () => setStatus("live"), "live")}
          {chip(status === "planned", labels.statusPlanned, () => setStatus("planned"), "planned")}
        </div>
      </div>

      <p className="mt-6 text-sm text-fg-muted" aria-live="polite" data-testid="tools-count">
        {labels.showing.replace("{count}", String(visible.length))}
      </p>

      {visible.length > 0 ? (
        <ul className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((tool) => (
            <li key={tool.content.key} className="min-w-0">
              <ToolCard
                tool={tool.content}
                href={tool.href}
                introHref={tool.introHref}
                minutes={tool.minutes}
                labels={cardLabels}
                headingLevel={3}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="panel mt-4 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-fg-muted">{labels.empty}</p>
          <button
            type="button"
            onClick={() => {
              setCategory("all");
              setStatus("all");
            }}
            className="link self-start font-semibold sm:self-auto"
          >
            {labels.reset}
          </button>
        </div>
      )}
    </div>
  );
}
