"use client";

import { useId, useState } from "react";

import { OfferingCard } from "@/components/sections/Catalogue";
import { cx } from "@/components/ui/primitives";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { CatalogueEntry, OfferingType } from "@/lib/catalogue-shared";

/**
 * Filterable list of every published catalogue entry (services index). Rendered on the server with
 * all entries visible; the filters only narrow the list in the browser, so it works without JS.
 */
export function CatalogueBrowser({
  entries,
  hrefs,
  domains,
  locale,
  labels,
  statusLabels,
}: {
  entries: CatalogueEntry[];
  /** entry key → localized page URL */
  hrefs: Record<string, string>;
  /** Published domains in catalogue order (only those with entries are offered as filters). */
  domains: { key: string; name: string }[];
  locale: Locale;
  labels: Dictionary["catalogue"];
  statusLabels: Dictionary["domain"]["status"];
}) {
  const [type, setType] = useState<OfferingType | "all">("all");
  const [domain, setDomain] = useState<string>("all");
  const domainSelectId = useId();

  const types = (["service", "assessment", "workshop"] as const).filter((t) => entries.some((entry) => entry.offeringType === t));
  const domainOptions = domains.filter((d) => entries.some((entry) => entry.domain === d.key));
  const domainNames = Object.fromEntries(domains.map((d) => [d.key, d.name]));
  const visible = entries.filter((entry) => (type === "all" || entry.offeringType === type) && (domain === "all" || entry.domain === domain));

  const reset = () => {
    setType("all");
    setDomain("all");
  };

  return (
    <div data-testid="catalogue-browser">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        {types.length > 1 && (
          <div role="group" aria-label={labels.filterType} className="flex flex-wrap gap-2">
            {(["all", ...types] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={cx(
                  "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                  type === value
                    ? "border-brand bg-brand text-ink-950"
                    : "border-line-default text-fg-secondary hover:border-line-strong hover:text-fg",
                )}
              >
                {value === "all" ? labels.filterAll : labels.typesPlural[value]}
              </button>
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1.5 sm:max-w-sm">
          <label htmlFor={domainSelectId} className="t-label">
            {labels.filterDomain}
          </label>
          <select
            id={domainSelectId}
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            className="field min-h-11 w-full"
          >
            <option value="all">{labels.filterAll}</option>
            {domainOptions.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-6 text-sm text-fg-muted" aria-live="polite" data-testid="catalogue-count">
        {labels.showing.replace("{count}", String(visible.length))}
      </p>

      {visible.length > 0 ? (
        <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <li key={entry.key} className="min-w-0">
              <OfferingCard
                entry={entry}
                href={hrefs[entry.key]}
                locale={locale}
                labels={labels}
                statusLabels={statusLabels}
                domainName={domainNames[entry.domain]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="panel mt-4 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-fg-muted">{labels.empty}</p>
          <button type="button" onClick={reset} className="link self-start font-semibold sm:self-auto">
            {labels.reset}
          </button>
        </div>
      )}
    </div>
  );
}
