"use client";

import Link from "next/link";
import { usePublicPathname } from "@/lib/use-public-pathname";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";

const STORAGE_KEY = "acs-quote-bar-dismissed";

/**
 * Mobile-only quote CTA. Appears after the visitor has scrolled past the first screen, hides while
 * the footer or an in-page CTA block is visible, never shows on the contact page and can be
 * dismissed for the session. Does not cover content (the page reserves no space; it sits above it).
 */
export function StickyQuoteBar({
  href,
  label,
  hint,
  dismissLabel,
  hiddenOn,
}: {
  href: string;
  label: string;
  hint: string;
  dismissLabel: string;
  hiddenOn: string[];
}) {
  const pathname = usePublicPathname();
  const [scrolled, setScrolled] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  // Lazy read is hydration-safe: the bar is hidden on first render on both server and client.
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll("footer, #cta-title, [data-testid='inline-cta'], form");
    if (targets.length === 0) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setCtaVisible(visible.size > 0);
    });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [pathname]);

  if (hiddenOn.includes(pathname)) return null;
  const show = scrolled && !ctaVisible && !dismissed;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cx(
        "fixed inset-x-3 bottom-3 z-40 transition-[transform,opacity] duration-300 sm:hidden",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[120%] opacity-0",
      )}
      data-testid="sticky-quote-bar"
      aria-hidden={!show}
      inert={!show}
    >
      <div className="card-accent flex items-center gap-3 rounded-2xl p-2.5 pl-4 shadow-[0_20px_50px_-15px_rgb(0_0_0_/_0.9)]">
        <p className="flex-1 text-xs leading-snug text-slate-300">{hint}</p>
        <Link href={href} className={buttonClass("primary", "sm")}>
          {label}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={dismissLabel}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-white"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
