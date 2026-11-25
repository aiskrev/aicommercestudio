"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { installLoopPausing, installPointerLayer } from "@/components/motion/pointer";
import { prefersReducedMotion } from "@/components/motion/reveal";

/** After this the reveal styles are dropped ("done"), so an element's own hover transitions apply again. */
const SETTLE_MS = 1400;

/**
 * The one client script behind the scroll reveal (components/motion/reveal.ts). Mounted once in the locale
 * layout; renders nothing. One IntersectionObserver per page: no scroll or pointer listeners and no layout
 * reads. An element is hidden ("pending") only after the observer has reported it outside the viewport, so
 * nothing that is visible at load ever blinks; it is revealed once ("in") when it enters, then left alone.
 * Off with reduced motion and where IntersectionObserver is missing: the content simply stays as rendered.
 */
export function MotionRuntime() {
  const pathname = usePathname();

  // Pointer layer (magnetic CTAs, service portals, hero field) and off-screen pausing of the ambient loops.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const removePointer = installPointerLayer();
    const removeLoops = installLoopPausing();
    return () => {
      removePointer();
      removeLoops();
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    const timers = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          observer.unobserve(element);
          if (element.dataset.reveal !== "pending") continue; // on screen from the start: nothing to reveal
          element.dataset.reveal = "in";
          const timer = window.setTimeout(() => {
            timers.delete(timer);
            if (element.dataset.reveal === "in") element.dataset.reveal = "done";
          }, SETTLE_MS);
          timers.add(timer);
        } else if (element.dataset.reveal === "") {
          element.dataset.reveal = "pending";
        }
      }
    });
    for (const element of document.querySelectorAll<HTMLElement>('[data-reveal=""]')) observer.observe(element);
    return () => {
      observer.disconnect();
      for (const timer of timers) window.clearTimeout(timer);
      // Never leave anything hidden behind (fast navigation away while an element was pending).
      for (const element of document.querySelectorAll<HTMLElement>('[data-reveal="pending"], [data-reveal="in"]')) element.dataset.reveal = "done";
    };
  }, [pathname]);

  return null;
}
