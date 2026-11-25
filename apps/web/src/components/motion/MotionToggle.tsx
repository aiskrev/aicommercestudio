"use client";

import { useSyncExternalStore } from "react";

import { MOTION_EVENT, motionPaused } from "@/components/motion/pause";
import { Icon } from "@/components/ui/Icon";

function subscribe(callback: () => void) {
  window.addEventListener(MOTION_EVENT, callback);
  return () => window.removeEventListener(MOTION_EVENT, callback);
}

/**
 * Pause / resume every moving element of the page (WCAG 2.2.2 Pause, Stop, Hide). A real button with
 * `aria-pressed`; the flag lives on <html> for the current visit only (no cookie, no storage).
 */
export function MotionToggle({ pauseLabel, playLabel, className }: { pauseLabel: string; playLabel: string; className?: string }) {
  const paused = useSyncExternalStore(subscribe, motionPaused, () => false);
  const toggle = () => {
    const root = document.documentElement;
    if (paused) delete root.dataset.motion;
    else root.dataset.motion = "paused";
    window.dispatchEvent(new Event(MOTION_EVENT));
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={paused} className={`vl-motion-toggle ${className ?? ""}`} data-testid="motion-toggle">
      <Icon name={paused ? "arrowRight" : "clock"} className="size-3.5" />
      {paused ? playLabel : pauseLabel}
    </button>
  );
}
