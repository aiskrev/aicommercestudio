"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { installLoopPausing, installPointerLayer } from "@/components/motion/pointer";
import { prefersReducedMotion } from "@/components/motion/reveal";

/** After this the reveal styles are dropped ("done"), so an element's own hover transitions apply again. */
const SETTLE_MS = 1400;

/**
 * The one client script behind the scroll reveal (components/motion/reveal.ts). Mounted once in the locale
 * layout; renders nothing. The reveal uses one IntersectionObserver per page, with no scroll listeners and no
 * layout reads; the pointer layer (fine pointers only) and the loop pausing are installed beside it. An element is hidden ("pending") only after the observer has reported it outside the viewport, so
 * nothing that is visible at load ever blinks; it is revealed once ("in") when it enters, then left alone.
 * Off with reduced motion and where IntersectionObserver is missing: the content simply stays as rendered.
 */
/** Grids of cards and lists in the page body that have no reveal of their own (most inner pages): their items reveal
 * as a group, in one of three ways (rise, scale, alternating sides) so neighbouring sections do not move alike. Set only
 * on the client, so server markup and pages without JavaScript are unchanged; nothing on screen at load is hidden. */
const AUTO_REVEAL =
  "main :is(ul, ol).grid:not([data-reveal]):not([role]), main div.grid:not([data-reveal]):has(> :is(.motion-card, .card-interactive, .price-card, .offer-card, .card))";
const VARIANTS = ["rise", "scale", "sides"] as const;

function autoReveal() {
  let index = 0;
  for (const element of document.querySelectorAll<HTMLElement>(AUTO_REVEAL)) {
    if (element.closest("[data-reveal], form, nav, [role=tablist], [inert]") || element.children.length < 2) continue;
    element.dataset.reveal = "";
    element.dataset.revealChildren = "";
    element.dataset.revealVariant = VARIANTS[index++ % VARIANTS.length];
  }
}

export function MotionRuntime() {
  const pathname = usePathname();

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
    autoReveal();
    for (const element of document.querySelectorAll<HTMLElement>('[data-reveal=""]')) observer.observe(element);
    return () => {
      observer.disconnect();
      for (const timer of timers) window.clearTimeout(timer);
      // Never leave anything hidden behind (fast navigation away while an element was pending).
      for (const element of document.querySelectorAll<HTMLElement>('[data-reveal="pending"], [data-reveal="in"]')) element.dataset.reveal = "done";
    };
  }, [pathname]);

  // Pointer layer (magnetic CTAs, service portals, hero field) and off-screen pausing of the ambient loops
  // (components/motion/pointer.ts). Not installed at all with reduced motion.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const removePointer = installPointerLayer();
    const removeLoops = installLoopPausing();
    return () => {
      removePointer();
      removeLoops();
    };
  }, [pathname]);

  return null;
}
