"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import type { Locale } from "@/i18n/config";
import { registerAnalyticsSink } from "@/lib/analytics";
import {
  type Collector,
  createCollector,
  describeClick,
  isMeasuredPath,
  postEvents,
  trackingAllowed,
} from "@/lib/site-analytics";

/**
 * Anonymous page views, clicks and tool events for the dashboard under /admin/analytics. No cookie, no
 * storage, nothing typed into a field. The server decides whether statistics are on (it answers
 * `{"enabled": false}` otherwise and this stops); visitors who send Do Not Track or Global Privacy Control are
 * never measured. See docs/ANALYTICS.md.
 */
export function SiteTracker({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const collector = useRef<Collector | null>(null);
  const firstView = useRef(true);
  const lastView = useRef<{ path: string; at: number } | null>(null);

  // One collector for the page load; clicks, tool events and leaving the page are wired once.
  useEffect(() => {
    if (!trackingAllowed(navigator as Navigator & { globalPrivacyControl?: boolean })) return;
    const instance = createCollector({ send: postEvents });
    collector.current = instance;

    const onClick = (event: MouseEvent) => {
      const path = window.location.pathname;
      if (!isMeasuredPath(path)) return;
      const click = describeClick(event.target, window.location.origin);
      if (click) instance.push({ type: "click", path, locale, ...click });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") void instance.flush();
    };
    const unregister = registerAnalyticsSink((tool) => {
      const path = window.location.pathname;
      if (isMeasuredPath(path)) instance.push({ type: "tool", path, locale, label: `${tool.tool}:${tool.name}` });
    });

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      unregister();
      void instance.flush();
      collector.current = null;
    };
  }, [locale]);

  // A page view for the first page and for every client-side navigation.
  useEffect(() => {
    const instance = collector.current;
    const path = window.location.pathname;
    if (!instance || !isMeasuredPath(path)) return;
    // The same page twice within a moment is one view (a double render, a quick reload of the route).
    const now = Date.now();
    if (lastView.current?.path === path && now - lastView.current.at < 1500) return;
    lastView.current = { path, at: now };
    const referrer = firstView.current ? document.referrer || undefined : undefined;
    firstView.current = false;
    instance.push({ type: "view", path, locale, ...(referrer ? { referrer } : {}) });
  }, [pathname, locale]);

  return null;
}
