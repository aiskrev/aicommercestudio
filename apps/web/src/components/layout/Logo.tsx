import Link from "next/link";

import { getDictionary } from "@/i18n";
import { defaultLocale, splitLocale } from "@/i18n/config";
import { site } from "@/lib/site";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#0c1222" stroke="url(#logo-gradient)" strokeWidth="1.5" />
      <path d="M9 22 15 9l6 13M11.6 17h6.8" fill="none" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="10" r="2" fill="#22d3ee" />
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
      <span className="font-display text-[15px] font-semibold tracking-tight text-white">
        A.I. Commerce <span className="text-gradient">Studio</span>
      </span>
    </Link>
  );
}
