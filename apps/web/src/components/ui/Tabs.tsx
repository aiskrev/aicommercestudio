"use client";

import { type KeyboardEvent, type ReactNode, useLayoutEffect, useRef } from "react";

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
  variant = "underline",
  panelClassName,
}: {
  /** `segmented`: pills on a quiet track (Future Commerce showcase and filters). */
  variant?: "underline" | "segmented";
  panelClassName?: string;
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
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const selected = Math.max(0, items.findIndex((item) => item.value === value));
  const tabId = (index: number) => `${id}-tab-${index}`;
  const panelId = `${id}-panel`;

  // Segmented variant: one indicator slides to the selected tab (transform, 220 ms; globals.css → .tab-indicator).
  // Measured only when the selection or the list's size changes, never on scroll. Until the first measurement
  // the selected tab keeps its own background, so nothing depends on this script.
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (variant !== "segmented" || !list || !indicator) return;
    const place = () => {
      const tab = refs.current[selected];
      if (!tab) return;
      indicator.style.width = `${tab.offsetWidth}px`;
      indicator.style.height = `${tab.offsetHeight}px`;
      indicator.style.transform = `translate3d(${tab.offsetLeft}px, ${tab.offsetTop}px, 0)`;
    };
    place();
    let frame = 0;
    if (!list.dataset.indicator) {
      list.dataset.indicator = "ready"; // placed without a transition the first time
      frame = requestAnimationFrame(() => {
        list.dataset.indicator = "animate";
      });
    }
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [selected, variant]);

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
      <div ref={listRef} role="tablist" aria-label={label} className={variant === "segmented" ? "tabs tabs-segmented" : "tabs"} onKeyDown={onKeyDown}>
        {variant === "segmented" && <span ref={indicatorRef} className="tab-indicator" aria-hidden="true" />}
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
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selected)} tabIndex={0} className={panelClassName ? `tab-panel ${panelClassName}` : "tab-panel"}>
        {children}
      </div>
    </div>
  );
}
