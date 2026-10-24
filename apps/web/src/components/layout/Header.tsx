"use client";

import Link from "next/link";
import { usePublicPathname } from "@/lib/use-public-pathname";
import { useEffect, useId, useRef, useState } from "react";

import { LanguageSwitcher, type LanguageSwitcherLabels } from "@/components/layout/LanguageSwitcher";
import { Logo } from "@/components/layout/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { buttonClass, Container, cx } from "@/components/ui/primitives";
import type { Locale, SlugMap } from "@/i18n/config";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavService extends NavItem {
  description: string;
  icon: IconName;
}

interface Labels {
  nav: string;
  openMenu: string;
  closeMenu: string;
  services: string;
  allServices: string;
}

export function Header({
  homeHref,
  servicesHref,
  services,
  items,
  cta,
  labels,
  locale,
  slugs,
  languageLabels,
}: {
  homeHref: string;
  servicesHref: string;
  services: NavService[];
  items: NavItem[];
  cta: NavItem;
  labels: Labels;
  locale: Locale;
  slugs: SlugMap;
  languageLabels: LanguageSwitcherLabels;
}) {
  const pathname = usePublicPathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const mobilePanelId = useId();
  const servicesPanelId = useId();
  const servicesRef = useRef<HTMLLIElement>(null);
  const servicesButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  // Close menus after navigation (state adjusted during render instead of in an effect).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
    setServicesOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Desktop services menu: close on outside click and Escape.
  useEffect(() => {
    if (!servicesOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!servicesRef.current?.contains(event.target as Node)) setServicesOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setServicesOpen(false);
        servicesButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [servicesOpen]);

  // Mobile menu: lock page scroll, move focus into the panel, close on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobilePanelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const servicesActive = isActive(servicesHref);

  return (
    <>
      <header
        className={cx(
          "sticky top-0 z-50 border-b transition-colors duration-300",
          scrolled || mobileOpen
            ? "border-line-subtle bg-ink-950/92 backdrop-blur-xl"
            : "border-transparent bg-ink-950/70 backdrop-blur-md",
        )}
      >
        <Container className="flex h-16 items-center justify-between gap-6">
          <Logo href={homeHref} />
  
          <nav aria-label={labels.nav} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              <li ref={servicesRef} className="relative">
                <button
                  ref={servicesButtonRef}
                  type="button"
                  aria-expanded={servicesOpen}
                  aria-controls={servicesPanelId}
                  onClick={() => setServicesOpen((value) => !value)}
                  className={cx(
                    "nav-link inline-flex items-center gap-1 px-3 py-2 text-[14.5px] font-medium transition-colors",
                    servicesActive || servicesOpen ? "text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {labels.services}
                  <Icon
                    name="chevronDown"
                    className={cx("h-4 w-4 transition-transform duration-200", servicesOpen && "rotate-180")}
                  />
                </button>
                <div
                  id={servicesPanelId}
                  hidden={!servicesOpen}
                  className="absolute left-0 top-full z-50 mt-3 w-[min(46rem,calc(100vw-4rem))] -translate-x-4"
                >
                  <div className="panel menu-enter origin-top-left p-2.5">
                    <ul className="grid grid-cols-2 gap-1">
                      {services.map((service) => (
                        <li key={service.href}>
                          <Link
                            href={service.href}
                            aria-current={isActive(service.href) ? "page" : undefined}
                            className="group flex gap-3 rounded-[var(--radius-md)] p-3 transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 aria-[current=page]:bg-surface-2"
                          >
                            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand transition-colors group-hover:border-brand/50">
                              <Icon name={service.icon} className="h-4.5 w-4.5" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-white">{service.label}</span>
                              <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
                                {service.description}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={servicesHref}
                      className="group mt-1.5 flex items-center justify-between rounded-[var(--radius-md)] border-t border-line-subtle px-4 py-3 text-sm font-semibold text-brand transition-colors duration-150 hover:bg-surface-2"
                    >
                      {labels.allServices}
                      <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </li>
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cx(
                      "nav-link px-3 py-2 text-[14.5px] font-medium transition-colors",
                      isActive(item.href) ? "text-fg" : "text-fg-muted hover:text-fg",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
  
          <div className="flex items-center gap-3">
            <LanguageSwitcher locale={locale} slugs={slugs} labels={languageLabels} className="hidden lg:block" />
            <div className="hidden sm:block lg:hidden xl:block">
              <Link href={cta.href} className={buttonClass("primary")}>
                {cta.label}
              </Link>
            </div>
            <button
              ref={mobileButtonRef}
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-line-default text-fg transition-colors hover:border-brand/50 lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls={mobilePanelId}
              aria-label={mobileOpen ? labels.closeMenu : labels.openMenu}
              onClick={() => setMobileOpen((value) => !value)}
            >
              <Icon key={mobileOpen ? "close" : "menu"} name={mobileOpen ? "close" : "menu"} className="menu-enter h-5 w-5" />
            </button>
          </div>
        </Container>
      </header>

      {/* Rendered outside <header>: its backdrop-filter would otherwise become the containing block of this fixed panel. */}
      <div
        id={mobilePanelId}
        ref={mobilePanelRef}
        hidden={!mobileOpen}
        className="menu-sheet-enter fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto overscroll-contain border-t border-line-subtle bg-ink-950 lg:hidden"
      >
        <Container className="flex min-h-full flex-col py-5">
          <nav aria-label={labels.nav}>
            <p className="t-label px-4 pb-2">{labels.services}</p>
            <ul className="grid gap-0.5">
              {services.map((service) => (
                <li key={service.href}>
                  <Link
                    href={service.href}
                    aria-current={isActive(service.href) ? "page" : undefined}
                    className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] text-slate-200 hover:bg-white/[0.04] aria-[current=page]:bg-white/[0.06] aria-[current=page]:text-white"
                  >
                    <Icon name={service.icon} className="h-4 w-4 text-cyan-300" />
                    {service.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={servicesHref}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold text-cyan-300 hover:bg-white/[0.04]"
                >
                  {labels.allServices}
                  <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
              </li>
            </ul>
            <div className="divider-glow my-4" aria-hidden="true" />
            <ul className="grid gap-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cx(
                      "flex items-center justify-between rounded-xl px-4 py-3 text-base font-medium",
                      isActive(item.href) ? "bg-white/[0.06] text-white" : "text-slate-200 hover:bg-white/[0.04]",
                    )}
                  >
                    {item.label}
                    <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto flex flex-col gap-4 pt-6">
            <LanguageSwitcher locale={locale} slugs={slugs} labels={languageLabels} className="self-start" />
            <Link href={cta.href} className={cx(buttonClass("primary", "lg"), "w-full")}>
              {cta.label}
            </Link>
          </div>
        </Container>
      </div>
    </>
  );
}
