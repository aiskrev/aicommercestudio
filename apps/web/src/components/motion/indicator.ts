"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * Sliding indicator (docs/MOTION_SYSTEM.md → Sliding indicator): one absolutely positioned element moves to the
 * selected item of a list (segmented tabs, the package filter pill, the comparison rail). Measured only when the
 * selection or the list's size changes (ResizeObserver), never on scroll. The first placement has no transition
 * (`data-indicator="ready"`); later ones animate (`"animate"`, CSS). Until it has been measured, and without
 * JavaScript, the selected item keeps its own styling, so nothing depends on this script.
 */
export function useSlidingIndicator(
  listRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
  itemsRef: RefObject<(HTMLElement | null)[]>,
  selected: number,
  enabled = true,
) {
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!enabled || !list || !indicator) return;
    const place = () => {
      const item = itemsRef.current[selected];
      if (!item) return;
      indicator.style.width = `${item.offsetWidth}px`;
      indicator.style.height = `${item.offsetHeight}px`;
      indicator.style.transform = `translate3d(${item.offsetLeft}px, ${item.offsetTop}px, 0)`;
    };
    place();
    let frame = 0;
    if (!list.dataset.indicator) {
      list.dataset.indicator = "ready";
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
  }, [listRef, indicatorRef, itemsRef, selected, enabled]);
}

/**
 * Direction of a change of selection in an ordered set: "next" when the new index is after the previous one,
 * "prev" otherwise; null until the first change (the panel shown at load never animates). For `.swap-stack`
 * (`data-dir`) and the AI demo stage.
 */
export function useSwapDirection<T>(order: readonly T[], value: T): "next" | "prev" | null {
  // React's "adjust state while rendering" pattern: no effect, no extra paint with a stale direction.
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  if (previous !== value) {
    setPrevious(value);
    setDirection(order.indexOf(value) >= order.indexOf(previous) ? "next" : "prev");
  }
  return direction;
}
