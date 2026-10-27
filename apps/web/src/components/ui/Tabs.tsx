"use client";

import { type KeyboardEvent, type ReactNode, useRef } from "react";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** Optional count shown after the label (e.g. pending items). */
  count?: number;
}

/**
 * WAI-ARIA tabs (automatic activation): one tab stop for the list, ← → Home End move and select,
 * every tab controls the single panel below. Controlled: the parent owns `value`.
 * Styling: `.tabs`, `.tab` in globals.css (underline indicator, ≥ 44 px targets, focus ring).
 */
export function Tabs<T extends string>({
  id,
  label,
  items,
  value,
  onChange,
  children,
  className,
}: {
  id: string;
  /** Accessible name of the tab list. */
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Panel content for the selected tab. */
  children: ReactNode;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, items.findIndex((item) => item.value === value));
  const tabId = (index: number) => `${id}-tab-${index}`;
  const panelId = `${id}-panel`;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = items.length - 1;
    const target = { ArrowRight: selected === last ? 0 : selected + 1, ArrowLeft: selected === 0 ? last : selected - 1, Home: 0, End: last }[
      event.key
    ];
    if (target === undefined) return;
    event.preventDefault();
    onChange(items[target].value);
    refs.current[target]?.focus();
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="tabs" onKeyDown={onKeyDown}>
        {items.map((item, index) => (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={tabId(index)}
            aria-selected={index === selected}
            aria-controls={panelId}
            tabIndex={index === selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className="tab"
          >
            {item.label}
            {item.count !== undefined && <span className="tab-count">{item.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selected)} tabIndex={0} className="tab-panel">
        {children}
      </div>
    </div>
  );
}
