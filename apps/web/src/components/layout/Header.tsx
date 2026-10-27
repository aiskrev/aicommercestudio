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

export interface NavServiceGroup {
  title: string;
  items: NavService[];
}

interface Labels {
  nav: string;
  openMenu: string;
  closeMenu: string;
  services: string;
  allServices: string;
}

type MenuId = "services" | "about";

/**
 * Site header. Desktop: Services and About open as panels (one at a time; outside click and
 * Escape close them, Escape returns focus to the trigger); the other destinations are plain links.
 * Mobile: a full-height sheet with the same grouping; while it is open the rest of the page is
 * `inert`, page scroll is locked and focus moves into the sheet.
 */
export function Header({
  homeHref,
  servicesHref,
  serviceGroups,
  items,
  aboutMenu,
  cta,
  labels,
  locale,
  slugs,
  languageLabels,
}: {
  homeHref: string;
  servicesHref: string;
  serviceGroups: NavServiceGroup[];
  items: NavItem[];
  aboutMenu: { label: string; items: NavItem[] };
  cta: NavItem;
  labels: Labels;
  locale: Locale;
  slugs: SlugMap;
  languageLabels: LanguageSwitcherLabels;
}) {
  const pathname = usePublicPathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const mobilePanelId = useId();
  const servicesPanelId = useId();
  const aboutPanelId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const menuRefs = useRef<Record<MenuId, HTMLLIElement | null>>({ services: null, about: null });
  const menuButtonRefs = useRef<Record<MenuId, HTMLButtonElement | null>>({ services: null, about: null });
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  // Close menus after navigation (state adjusted during render instead of in an effect).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
    setOpenMenu(null);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Desktop menus: close on outside click and Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRefs.current[openMenu]?.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        menuButtonRefs.current[openMenu]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // Mobile menu: lock page scroll, make the page behind inert, move focus into the panel, close on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el !== headerRef.current && el !== mobilePanelRef.current && !el.inert,
    );
    for (const el of background) el.inert = true;
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
      for (const el of background) el.inert = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const servicesActive = isActive(servicesHref);
  const aboutActive = aboutMenu.items.some((item) => isActive(item.href));
  const toggle = (id: MenuId) => setOpenMenu((current) => (current === id ? null : id));

  const menuButton = (id: MenuId, label: string, panelId: string, active: boolean) => (
    <button
      ref={(el) => {
        menuButtonRefs.current[id] = el;
      }}
      type="button"
      aria-expanded={openMenu === id}
      aria-controls={panelId}
      onClick={() => toggle(id)}
      className={cx(
        "nav-link inline-flex items-center gap-1 px-3 py-2 text-[14.5px] font-medium transition-colors",
        active || openMenu === id ? "text-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      {label}
      <Icon name="chevronDown" className={cx("h-4 w-4 transition-transform duration-200", openMenu === id && "rotate-180")} />
    </button>
  );

  return (
    <>
      <header
        ref={headerRef}
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
              <li
                ref={(el) => {
                  menuRefs.current.services = el;
                }}
                className="relative"
              >
                {menuButton("services", labels.services, servicesPanelId, servicesActive)}
                <div
                  id={servicesPanelId}
                  hidden={openMenu !== "services"}
                  className="absolute left-0 top-full z-50 mt-3 w-[min(52rem,calc(100vw-4rem))] -translate-x-4"
                >
                  <div className="panel menu-enter origin-top-left p-2.5">
                    <div className="grid gap-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                      {serviceGroups.map((group, index) => (
                        <div key={group.title} className={cx("min-w-0", index > 0 && "xl:border-l xl:border-line-subtle xl:pl-2")}>
                          <p className="t-label px-3 pb-1 pt-2">{group.title}</p>
                          <ul className={cx("grid gap-1", index === 0 && "sm:grid-cols-2")}>
                            {group.items.map((service) => (
                              <li key={service.href}>
                                <Link
                                  href={service.href}
                                  aria-current={isActive(service.href) ? "page" : undefined}
                                  className="group flex gap-3 rounded-[var(--radius-md)] p-3 transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 aria-[current=page]:bg-surface-2"
                                >
                                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand transition-colors group-hover:border-brand/50">
                                    <Icon name={service.icon} className="h-4.5 w-4.5" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-fg">{service.label}</span>
                                    <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-fg-muted">
                                      {service.description}
                                    </span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <Link
                      href={servicesHref}
                      aria-current={pathname === servicesHref ? "page" : undefined}
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
              <li
                ref={(el) => {
                  menuRefs.current.about = el;
                }}
                className="relative"
              >
                {menuButton("about", aboutMenu.label, aboutPanelId, aboutActive)}
                <div id={aboutPanelId} hidden={openMenu !== "about"} className="absolute right-0 top-full z-50 mt-3 w-60">
                  <ul className="panel menu-enter origin-top-right grid gap-1 p-2">
                    {aboutMenu.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive(item.href) ? "page" : undefined}
                          className="block rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:text-fg"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
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
            {serviceGroups.map((group) => (
              <div key={group.title} className="mb-3">
                <p className="t-label px-4 pb-2">{group.title}</p>
                <ul className="grid gap-0.5">
                  {group.items.map((service) => (
                    <li key={service.href}>
                      <Link
                        href={service.href}
                        aria-current={isActive(service.href) ? "page" : undefined}
                        className="flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] text-fg-secondary hover:bg-surface-2 aria-[current=page]:bg-surface-3 aria-[current=page]:text-fg"
                      >
                        <Icon name={service.icon} className="h-4 w-4 shrink-0 text-brand" />
                        {service.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link
              href={servicesHref}
              aria-current={pathname === servicesHref ? "page" : undefined}
              className="flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold text-brand hover:bg-surface-2"
            >
              {labels.allServices}
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <div className="divider-glow my-4" aria-hidden="true" />
            <ul className="grid gap-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <MobileLink item={item} active={isActive(item.href)} />
                </li>
              ))}
            </ul>
            <p className="t-label mt-4 px-4 pb-2">{aboutMenu.label}</p>
            <ul className="grid gap-0.5">
              {aboutMenu.items.map((item) => (
                <li key={item.href}>
                  <MobileLink item={item} active={isActive(item.href)} />
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

function MobileLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-h-11 items-center justify-between rounded-xl px-4 py-3 text-base font-medium",
        active ? "bg-surface-3 text-fg" : "text-fg-secondary hover:bg-surface-2",
      )}
    >
      {item.label}
      <Icon name="chevronRight" className="h-4 w-4 text-fg-subtle" />
    </Link>
  );
}
