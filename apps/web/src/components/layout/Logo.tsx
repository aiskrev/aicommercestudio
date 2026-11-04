import Image from "next/image";
import Link from "next/link";

import logoMark from "@/assets/brand/logo-mark.webp";
import { getDictionary } from "@/i18n";
import { defaultLocale, splitLocale } from "@/i18n/config";
import { site } from "@/lib/site";

/** Brand mark, cropped from the owner's approved artwork. The favicon (app/icon.png) is the same crop. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return <Image src={logoMark} alt="" width={64} height={64} className={className} sizes="48px" loading="eager" />;
}

export function Logo({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex shrink-0 items-center gap-2.5"
      aria-label={`${site.name} — ${getDictionary(splitLocale(href)?.locale ?? defaultLocale).ui.logoHome}`}
    >
      <LogoMark />
      <span className="whitespace-nowrap font-display text-body-sm font-semibold tracking-tight text-fg">
        A.I. Commerce <span className="logo-gradient-text">Studio</span>
      </span>
    </Link>
  );
}
