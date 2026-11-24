"use client";

import Link from "next/link";
import { type ReactNode, useId, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { ArrowLink } from "@/components/v5/blocks";
import type { CompareOptionKey, FutureContent } from "@/content/v5-types";

/**
 * Service comparison (Future Commerce): static site, CMS site, interactive site, online store, custom web
 * application. A semantic table (caption, scope, scrolls in its own focusable frame on phones) plus a column
 * picker: the chosen option is highlighted in the table and summarised beside it with its contextual actions
 * (its page and the quote form preselected with its service). Prices are rendered on the server from the
 * published schedule and passed in; nothing here computes an amount.
 */
export function ServiceComparison({
  text,
  prices,
  links,
  initial = "interactive",
}: {
  text: FutureContent["compare"];
  prices: Record<CompareOptionKey, ReactNode>;
  links: Record<CompareOptionKey, { href: string; quote: string }>;
  initial?: CompareOptionKey;
}) {
  const [focus, setFocusState] = useState<CompareOptionKey>(initial);
  const [swapped, setSwapped] = useState(false);
  const setFocus = (key: CompareOptionKey) => {
    setFocusState(key);
    setSwapped(true);
  };
  const name = useId();
  const option = text.options.find((item) => item.key === focus) ?? text.options[0];
  const focusIndex = text.options.indexOf(option);

  return (
    <div className="grid gap-6" data-testid="service-comparison">
      <fieldset>
        <legend className="t-label">{text.focusLabel}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {text.options.map((item) => (
            <label key={item.key} className="fc-choice">
              <input type="radio" name={name} value={item.key} checked={focus === item.key} onChange={() => setFocus(item.key)} data-testid={`compare-pick-${item.key}`} />
              <span>
                <span className="fc-choice-mark" aria-hidden="true" />
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6">
        <div className="compare-scroll min-w-0" tabIndex={0} role="region" aria-label={text.caption}>
          <table className="compare-table" style={{ minWidth: "52rem" }}>
            <caption>{text.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{text.corner}</th>
                {text.options.map((item) => (
                  <th key={item.key} scope="col" className={cx(item.key === focus && "is-focus")}>
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {text.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell, index) => (
                    <td key={text.options[index].key} className={cx(index === focusIndex && "is-focus")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">{text.priceRow}</th>
                {text.options.map((item, index) => (
                  <td key={item.key} className={cx(index === focusIndex && "is-focus")} data-testid={`compare-price-${item.key}`}>
                    {prices[item.key] ?? text.priceOnRequest}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* One summary per option in a shared grid cell (.swap-stack): the chosen one cross-fades in, the panel keeps
            the height of the longest and never jumps; only the shown one is in the accessibility tree and tab order. */}
        <aside className="feature-panel order-first p-6" data-testid="compare-focus">
          {/* Toggling aria-hidden on the panels is not announced reliably, so a polite status repeats the chosen
              summary as text (empty on load, so nothing is read before the visitor chooses). */}
          <p className="sr-only" aria-live="polite" data-testid="compare-announce">
            {swapped ? `${option.label}. ${option.summary}` : ""}
          </p>
          <div className="swap-stack" data-swapped={swapped}>
            {text.options.map((item) => {
              const active = item.key === option.key;
              return (
                <div
                  key={item.key}
                  data-active={active}
                  aria-hidden={!active || undefined}
                  inert={!active}
                  className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10"
                >
                  <div className="min-w-0">
                    <p className="t-label">{text.focusLabel}</p>
                    <h3 className="t-h3-lg mt-2">{item.label}</h3>
                    <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-fg-secondary">{item.summary}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Link href={links[item.key].quote} className={buttonClass("primary", "md")} data-testid={active ? "compare-quote" : undefined}>
                      <span className="btn-label">{text.quote}</span>
                      <Icon name="arrowRight" className="btn-icon h-4 w-4" />
                    </Link>
                    <ArrowLink href={links[item.key].href} label={`${text.more}: ${item.label}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
      <p className="text-xs text-fg-subtle">{text.priceNote}</p>
    </div>
  );
}
