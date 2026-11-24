/**
 * Scroll reveal primitive (docs/MOTION_SYSTEM.md). Server-safe helpers that return the data attributes read by
 * MotionRuntime and the `[data-reveal]` rules in globals.css. The server renders `data-reveal=""`, which is
 * always visible: the content never depends on JavaScript, and reduced motion, print and anything already on
 * screen when the page loads are never hidden.
 *
 *   <div {...reveal()}>…</div>           the element itself rises 12 px (8 px on phones) and fades in, once
 *   <ul {...revealGroup()}>…</ul>        its direct children do, 55 ms apart (card groups, CTA clusters)
 */
export type RevealAttributes = { "data-reveal": ""; "data-reveal-children"?: "" };

export function reveal(): RevealAttributes {
  return { "data-reveal": "" };
}

export function revealGroup(): RevealAttributes {
  return { "data-reveal": "", "data-reveal-children": "" };
}

/** True when the visitor asked for reduced motion, or when the environment cannot tell (server, tests). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
