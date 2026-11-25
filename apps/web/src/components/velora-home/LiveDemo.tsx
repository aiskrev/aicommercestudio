"use client";

// Adapted from Velora UI src/components/home/live-demo.tsx (MIT, see THIRD_PARTY_NOTICES.md).
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { IconName } from "@/components/ui/Icon";
import type { VeloraHomeCopy } from "@/content/velora-home";

// One lazy chunk for every tile (and `motion` inside it); nothing loads until a tile nears the viewport, so none
// of it competes with the hero text, which stays server HTML and the LCP element.
const load = () => import("./showcase-demos");
const demos = {
  globe: dynamic(() => load().then((m) => m.GlobeDemo), { ssr: false }),
  "morphing-text": dynamic(() => load().then((m) => m.MorphingTextDemo), { ssr: false }),
  "border-beam": dynamic(() => load().then((m) => m.BorderBeamDemo), { ssr: false }),
  dock: dynamic(() => load().then((m) => m.DockDemo), { ssr: false }),
  "3d-card": dynamic(() => load().then((m) => m.Card3DDemo), { ssr: false }),
  "animated-list": dynamic(() => load().then((m) => m.AnimatedListDemo), { ssr: false }),
};

export type LiveDemoName = keyof typeof demos;

/** Mounts a showcase demo once its tile is within 200 px of the viewport. */
export function LiveDemo({ name, copy, links }: { name: LiveDemoName; copy: VeloraHomeCopy; links: { label: string; href: string; icon: IconName }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Mounted only after the page has loaded and the browser is idle, so the demo chunk (and `motion`) never
  // competes with the hero text for the LCP — on phones the bento is within 200 px of the first screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let observer: IntersectionObserver | null = null;
    let idle = 0;
    const watch = () => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          setVisible(true);
          observer?.disconnect();
        },
        { rootMargin: "200px" },
      );
      observer.observe(el);
    };
    const afterLoad = () => {
      idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(watch, { timeout: 1500 }) : window.setTimeout(watch, 300);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    return () => {
      window.removeEventListener("load", afterLoad);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
      observer?.disconnect();
    };
  }, []);

  const Demo = demos[name] as React.ComponentType<{ copy: VeloraHomeCopy; links: typeof links }>;
  return (
    <div ref={ref} className="flex size-full items-center justify-center" data-demo={name} data-mounted={visible || undefined}>
      {visible && <Demo copy={copy} links={links} />}
    </div>
  );
}
