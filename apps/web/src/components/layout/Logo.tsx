import Link from "next/link";

import { getDictionary } from "@/i18n";
import { defaultLocale, splitLocale } from "@/i18n/config";
import { site } from "@/lib/site";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    // Monogram: an "A" drawn as a routed path that ends in a node — commerce flow + automation.
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7" fill="#111c2b" stroke="#69d9df" strokeOpacity="0.55" strokeWidth="1.5" />
      <path d="M8.5 23 15 8.5 21.5 23M11.2 17.4h7.6" fill="none" stroke="#f4f7fb" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21.5 23h2.5" stroke="#69d9df" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="24.6" cy="23" r="2.1" fill="#69d9df" />
    </svg>
  );
}

export function Logo({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5"
      aria-label={`${site.name} — ${getDictionary(splitLocale(href)?.locale ?? defaultLocale).ui.logoHome}`}
    >
      <LogoMark />
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className="font-display text-[15.5px] font-bold tracking-[-0.02em] text-fg">A.I. Commerce</span>
        <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-brand">Studio</span>
      </span>
    </Link>
  );
}
