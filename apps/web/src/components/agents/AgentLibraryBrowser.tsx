"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AGENT_ICONS } from "@/components/tools/team/AgentCard";
import { fill } from "@/components/tools/team/TeamControls";
import { Icon } from "@/components/ui/Icon";
import { Button, cx } from "@/components/ui/primitives";
import type { agentLibrary } from "@/content/bg/agent-library";
import { INTEGRATION_CATEGORIES, type IntegrationCategory, type LibraryFilter, type RiskLevel, filterLibrary } from "@/lib/agent-library";
import { type AgentKey, type Complexity, DEPARTMENTS, type Department } from "@/lib/ai-team";

type Content = typeof agentLibrary;

export interface LibraryCard {
  key: AgentKey;
  href: string;
  name: string;
  short: string;
  purpose: string;
  departments: string[];
  approval: string;
  complexityLabel: string;
}

const RISK_BADGE: Record<RiskLevel, string> = { low: "badge-success", medium: "badge-accent", high: "badge-warning" };
const RISKS: RiskLevel[] = ["low", "medium", "high"];
const COMPLEXITIES: Complexity[] = ["low", "medium", "high"];

/** Filterable catalogue of agent roles; every card links to its static detail page. */
export function AgentLibraryBrowser({
  content,
  cards,
  departmentNames,
  complexityNames,
  complexityLabel,
}: {
  content: Content;
  cards: LibraryCard[];
  departmentNames: Record<Department, string>;
  complexityNames: Record<Complexity, string>;
  complexityLabel: string;
}) {
  const [filter, setFilter] = useState<LibraryFilter>({});
  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);
  const visible = filterLibrary(filter, (key) => {
    const card = byKey.get(key)!;
    return `${card.name} ${card.short} ${card.purpose} ${card.departments.join(" ")}`;
  });
  const t = content.filters;
  const set = <K extends keyof LibraryFilter>(key: K, value: string) =>
    setFilter((current) => ({ ...current, [key]: value === "" ? undefined : (value as LibraryFilter[K]) }));
  const select = (id: string, label: string, value: string | undefined, options: [string, string][], key: keyof LibraryFilter) => (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="field" value={value ?? ""} onChange={(event) => set(key, event.target.value)}>
        <option value="">{t.all}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="grid gap-8">
      <form role="search" aria-label={t.label} className="panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="library-search" className="field-label">
            {t.search}
          </label>
          <input
            id="library-search"
            type="search"
            className="field"
            placeholder={t.searchPlaceholder}
            value={filter.query ?? ""}
            onChange={(event) => set("query", event.target.value)}
          />
        </div>
        {select("library-department", t.department, filter.department, DEPARTMENTS.filter((d) => d !== "custom").map((d) => [d, departmentNames[d]]), "department")}
        {select("library-risk", t.risk, filter.risk, RISKS.map((r) => [r, content.risk[r]]), "risk")}
        {select("library-complexity", t.complexity, filter.complexity, COMPLEXITIES.map((c) => [c, complexityNames[c]]), "complexity")}
        {select("library-category", t.category, filter.category, INTEGRATION_CATEGORIES.map((c: IntegrationCategory) => [c, content.categories[c].title]), "category")}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted" aria-live="polite" data-testid="library-count">
          {fill(t.count, { n: visible.length, total: cards.length })}
        </p>
        {Object.values(filter).some(Boolean) && (
          <Button variant="ghost" size="sm" onClick={() => setFilter({})}>
            {t.reset}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong p-8 text-center text-fg-muted">{t.empty}</p>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="library-cards">
          {visible.map((entry) => {
            const card = byKey.get(entry.key)!;
            return (
              <li key={entry.key}>
                <article className="card card-interactive relative flex h-full flex-col p-6" data-agent={entry.key}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-line-default text-brand" aria-hidden="true">
                      <Icon name={AGENT_ICONS[entry.key]} className="h-5 w-5" />
                    </span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                      <span className={cx("badge", RISK_BADGE[entry.risk])}>
                        {content.riskLabel}: {content.risk[entry.risk]}
                      </span>
                      <span className="badge">
                        {complexityLabel}: {card.complexityLabel}
                      </span>
                    </span>
                  </div>
                  <h2 className="t-h3 mt-4">
                    <Link href={card.href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                      {card.name}
                    </Link>
                  </h2>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{card.short}</p>
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div>
                      <dt className="sr-only">{t.department}</dt>
                      <dd className="text-fg-secondary">{card.departments.join(" · ")}</dd>
                    </div>
                    <div>
                      <dt className="inline text-fg-subtle">{content.card.approval}: </dt>
                      <dd className="inline text-fg-secondary">{card.approval}</dd>
                    </div>
                  </dl>
                  <p className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-medium text-brand">
                    {content.card.open}
                    <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
