"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Logo } from "@/components/layout/Logo";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, Container, cx } from "@/components/ui/primitives";

export interface NavItem {
  href: string;
  label: string;
}

export function Header({
  homeHref,
  items,
  cta,
  labels,
}: {
  homeHref: string;
  items: NavItem[];
  cta: NavItem;
  labels: { nav: string; openMenu: string; closeMenu: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const panelId = useId();

  // Close the mobile menu after navigation (adjusting state during render, not in an effect).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Logo href={homeHref} />

        <nav aria-label={labels.nav} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cx(
                    "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive(item.href) ? "bg-white/[0.06] text-white" : "text-slate-400 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <Link href={cta.href} className={buttonClass("primary")}>
              {cta.label}
            </Link>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-200 lg:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? labels.closeMenu : labels.openMenu}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </Container>

      <div id={panelId} hidden={!open} className="border-t border-white/[0.06] bg-ink-950/95 lg:hidden">
        <Container className="py-4">
          <nav aria-label={labels.nav}>
            <ul className="grid gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cx(
                      "flex items-center justify-between rounded-xl px-4 py-3 text-base font-medium",
                      isActive(item.href) ? "bg-white/[0.06] text-white" : "text-slate-300 hover:bg-white/[0.04]",
                    )}
                  >
                    {item.label}
                    <Icon name="chevronRight" className="h-4 w-4 text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link href={cta.href} className={cx(buttonClass("primary", "lg"), "mt-4 w-full")}>
            {cta.label}
          </Link>
        </Container>
      </div>
    </header>
  );
}
