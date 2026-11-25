/**
 * Site-wide "pause animations" flag (WCAG 2.2.2, docs/MOTION_SYSTEM.md → Pause control): `data-motion="paused"` on
 * <html>. CSS pauses every CSS animation; the JavaScript loops (globe, morphing text, animated list) check
 * `motionPaused()` before each step. Set by components/motion/MotionToggle.tsx for the current visit (no storage).
 */
export const MOTION_EVENT = "acs:motion";

export function motionPaused(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.motion === "paused";
}
