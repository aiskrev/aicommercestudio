import Image from "next/image";

import { HomeLink } from "@/components/layout/HomeLink";
import logoMark from "@/assets/brand/logo-mark.webp";
import { getDictionary } from "@/i18n";
import { defaultLocale, splitLocale } from "@/i18n/config";
import { site } from "@/lib/site";

/**
 * Brand mark: the "orbital A" artwork the owner supplied on 2026-11-12 (replaces the earlier mark at the owner's
 * explicit request), cropped to its rounded square without the soft outer glow so it reads at 28–48 px. The
 * browser-tab icon (app/icon.png) and the iOS icon (app/apple-icon.png, on the page navy) are the same crop.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return <Image src={logoMark} alt="" width={64} height={64} className={className} sizes="48px" loading="eager" />;
}

export function Logo({ href }: { href: string }) {
  return (
    <HomeLink
      href={href}
      className="group inline-flex shrink-0 items-center gap-2.5"
      aria-label={`${site.name} — ${getDictionary(splitLocale(href)?.locale ?? defaultLocale).ui.logoHome}`}
    >
      <LogoMark />
      <span className="whitespace-nowrap font-display text-body-sm font-semibold tracking-tight text-fg">
        A.I. Commerce <span className="logo-gradient-text">Studio</span>
      </span>
    </HomeLink>
  );
}
