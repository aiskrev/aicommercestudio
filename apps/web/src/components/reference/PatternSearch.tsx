"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/reference/ReferenceBlocks";
import { type IntegrationStatus, type PatternKey, searchPatterns } from "@/lib/reference";

export interface PatternCard {
  key: PatternKey;
  href: string;
  title: string;
  summary: string;
  status: IntegrationStatus;
  statusLabel: string;
}

/** Search over the localized pattern titles and summaries; the list is server-rendered without JavaScript too. */
export function PatternSearch({ cards, labels }: {
  cards: PatternCard[];
  labels: { search: string; placeholder: string; count: string; empty: string; open: string };
}) {
  const [query, setQuery] = useState("");
  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);
  const visible = searchPatterns(query, (key) => `${byKey.get(key)?.title} ${byKey.get(key)?.summary}`).filter((key) => byKey.has(key));
  const count = labels.count.replace("{n}", String(visible.length)).replace("{total}", String(cards.length));
  return (
    <div className="grid gap-6">
      <form role="search" aria-label={labels.search} className="panel grid gap-2 p-5" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="pattern-search" className="field-label">
          {labels.search}
        </label>
        <input id="pattern-search" type="search" className="field" placeholder={labels.placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      </form>
      <p className="text-sm text-fg-muted" aria-live="polite" data-testid="pattern-count">
        {count}
      </p>
      {visible.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-line-strong p-8 text-center text-fg-muted">{labels.empty}</p>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="pattern-cards">
          {visible.map((key) => {
            const card = byKey.get(key)!;
            return (
              <li key={key}>
                <article className="card card-interactive relative flex h-full flex-col p-6" data-pattern={key}>
                  <StatusBadge status={card.status} label={card.statusLabel} />
                  <h2 className="t-h3 mt-4">
                    <Link href={card.href} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                      {card.title}
                    </Link>
                  </h2>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{card.summary}</p>
                  <p className="mt-auto pt-5 text-sm font-medium text-brand">{labels.open}</p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
