"use client";

import Link from "next/link";
import { type ComponentProps, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { LanguageSwitcher, type LanguageSwitcherLabels } from "@/components/layout/LanguageSwitcher";
import { Logo } from "@/components/layout/Logo";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, Container, cx } from "@/components/ui/primitives";
import type { Locale, SlugMap } from "@/i18n/config";
import type { NavEntry, NavItem, ServiceMenu } from "@/lib/site-nav";
import { usePublicPathname } from "@/lib/use-public-pathname";

interface Labels {
  nav: string;
  openMenu: string;
  closeMenu: string;
}

const SERVICES = "services";

/** The href among `hrefs` that best matches the current page: exact, else the longest parent path. */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * Arrow keys move focus between the links of one menu column (`data-nav-column`); Home/End jump to
 * the first/last link. Tab keeps its normal order, so the menu never traps focus.
 */
function onColumnKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const target = event.target as HTMLElement;
  const column = target.closest<HTMLElement>("[data-nav-column]");
  if (!column || target.tagName !== "A") return;
  const links = Array.from(column.querySelectorAll<HTMLAnchorElement>("a"));
  const index = links.indexOf(target as HTMLAnchorElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? links.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
  event.preventDefault();
  links[next]?.focus();
}

/**
 * Site header (docs/INFORMATION_ARCHITECTURE_V2.md §4, phase IA-1).
 *
 * Desktop: "Services" opens a mega-menu with the published domains in three bands and a "Start here"
 * column; "Solutions" and "Company" open small menus; the rest are plain links. One panel at a time;
 * outside click and Escape close it and Escape returns focus to the trigger; arrow keys move within
 * a column. Mobile: a full-height sheet with accordion groups in the same order. While it is open the
 * rest of the page is `inert`, page scroll is locked and focus moves into the sheet.
 */
export function Header({
  homeHref,
  services,
  entries,
  cta,
  labels,
  locale,
  slugs,
  languageLabels,
}: {
  homeHref: string;
  services: ServiceMenu;
  entries: NavEntry[];
  cta: NavItem;
  labels: Labels;
  locale: Locale;
  slugs: SlugMap;
  languageLabels: LanguageSwitcherLabels;
}) {
  const pathname = usePublicPathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const idBase = useId();
  const mobilePanelId = `${idBase}-mobile`;
  const panelId = (id: string) => `${idBase}-${id}`;
  const headerRef = useRef<HTMLElement>(null);
  const menuRefs = useRef<Record<string, HTMLElement | null>>({});
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  const serviceHrefs = [
    services.href,
    ...services.bands.flatMap((band) => band.domains.flatMap((domain) => [domain.href, ...domain.services.map((s) => s.href)])),
    ...services.startHere.items.map((item) => item.href),
  ];
  const allHrefs = [
    ...serviceHrefs,
    ...entries.flatMap((entry) => (entry.kind === "link" ? [entry.href] : entry.items.map((item) => item.href))),
  ];
  const current = activeHref(pathname, allHrefs);
  const isCurrent = (href: string) => href === current;
  const servicesActive = pathname === services.href || pathname.startsWith(`${services.href}/`);
  const menuActive = (entry: NavEntry) => entry.kind === "menu" && entry.items.some((item) => isCurrent(item.href));
  // The mobile accordion opens on the group of the current page.
  const currentGroup = servicesActive ? SERVICES : entries.find(menuActive)?.label;
  const [expanded, setExpanded] = useState<string | null>(currentGroup ?? null);

  // Close menus after navigation (state adjusted during render instead of in an effect).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
    setOpenMenu(null);
    setExpanded(currentGroup ?? null);
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
    const onKey = (event: globalThis.KeyboardEvent) => {
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
    const onKey = (event: globalThis.KeyboardEvent) => {
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

  const toggle = (id: string) => setOpenMenu((open) => (open === id ? null : id));

  const menuButton = (id: string, label: string, active: boolean) => (
    <button
      ref={(el) => {
        menuButtonRefs.current[id] = el;
      }}
      type="button"
      aria-expanded={openMenu === id}
      aria-controls={panelId(id)}
      onClick={() => toggle(id)}
      data-active={active || undefined}
      className={cx(
        "nav-link inline-flex min-h-11 items-center gap-1 px-3 text-[14.5px] font-medium transition-colors",
        active || openMenu === id ? "text-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      {label}
      <Icon name="chevronDown" className={cx("h-4 w-4 transition-transform duration-200", openMenu === id && "rotate-180")} />
    </button>
  );

  const menuLinkClass =
    "rounded-[var(--radius-md)] transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 aria-[current=page]:bg-surface-2";

  return (
    <>
      <header
        ref={headerRef}
        className={cx(
          "sticky top-0 z-50 border-b transition-colors duration-300",
          scrolled || mobileOpen || openMenu
            ? "border-line-subtle bg-ink-950/92 backdrop-blur-xl"
            : "border-transparent bg-ink-950/70 backdrop-blur-md",
        )}
      >
        <Container className="flex h-16 items-center justify-between gap-4 xl:gap-6">
          <Logo href={homeHref} />

          <nav aria-label={labels.nav} className="hidden lg:block">
            <ul className="flex items-center gap-0.5 xl:gap-1">
              {/* ---------------------------------------------------------------- Services mega-menu */}
              <li
                ref={(el) => {
                  menuRefs.current[SERVICES] = el;
                }}
              >
                {menuButton(SERVICES, services.label, servicesActive)}
                {/* Positioned against the sticky header, so the panel spans the full width below it. */}
                <div id={panelId(SERVICES)} hidden={openMenu !== SERVICES} className="absolute inset-x-0 top-full z-50">
                  <div className="menu-enter max-h-[calc(100dvh-4.5rem)] origin-top overflow-y-auto border-b border-line-subtle bg-ink-950 shadow-[var(--shadow-panel)] backdrop-blur-xl">
                    <Container className="grid gap-6 py-6 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,0.85fr)] xl:gap-8">
                      {services.bands.map((band) => (
                        <div key={band.key} className="min-w-0" data-testid={`menu-band-${band.key}`}>
                          <p className="t-label px-3 pb-2">{band.title}</p>
                          <ul className="grid gap-1" data-nav-column onKeyDown={onColumnKeyDown}>
                            {band.domains.map((domain) => (
                              <li key={domain.href}>
                                <Link
                                  href={domain.href}
                                  aria-current={isCurrent(domain.href) ? "page" : undefined}
                                  className={cx("group flex min-h-11 gap-3 p-3", menuLinkClass)}
                                >
                                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand transition-colors group-hover:border-brand/50">
                                    <Icon name={domain.icon} className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold leading-snug text-fg">{domain.label}</span>
                                    <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-fg-muted">{domain.description}</span>
                                  </span>
                                </Link>
                                {domain.services.length > 0 && (
                                  <ul className="mb-1 ml-[1.625rem] grid border-l border-line-subtle pl-[1.125rem]">
                                    {domain.services.map((service) => (
                                      <li key={service.href}>
                                        <Link
                                          href={service.href}
                                          aria-current={isCurrent(service.href) ? "page" : undefined}
                                          className={cx(
                                            "flex min-h-11 items-center px-3 text-[13.5px] text-fg-secondary hover:text-fg aria-[current=page]:text-fg",
                                            menuLinkClass,
                                          )}
                                        >
                                          {service.label}
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <div className="min-w-0 lg:border-l lg:border-line-subtle lg:pl-6" data-testid="menu-start-here">
                        <p className="t-label px-3 pb-2">{services.startHere.title}</p>
                        <ul className="grid gap-1" data-nav-column onKeyDown={onColumnKeyDown}>
                          {services.startHere.items.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                aria-current={isCurrent(item.href) ? "page" : undefined}
                                className={cx("group flex min-h-11 gap-3 p-3", menuLinkClass)}
                              >
                                <Icon name={item.icon} className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-2" />
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold leading-snug text-fg">{item.label}</span>
                                  <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-fg-muted">{item.description}</span>
                                </span>
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              href={services.href}
                              aria-current={pathname === services.href ? "page" : undefined}
                              className={cx(
                                "group mt-2 flex min-h-11 items-center justify-between border-t border-line-subtle px-3 text-sm font-semibold text-brand",
                                menuLinkClass,
                              )}
                            >
                              {services.allLabel}
                              <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </Container>
                  </div>
                </div>
              </li>

              {/* ---------------------------------------------------------------- other entries */}
              {entries.map((entry) =>
                entry.kind === "link" ? (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      aria-current={isCurrent(entry.href) ? "page" : undefined}
                      className={cx(
                        "nav-link inline-flex min-h-11 items-center px-3 text-[14.5px] font-medium transition-colors",
                        isCurrent(entry.href) ? "text-fg" : "text-fg-muted hover:text-fg",
                      )}
                    >
                      {entry.label}
                    </Link>
                  </li>
                ) : (
                  <li
                    key={entry.id}
                    ref={(el) => {
                      menuRefs.current[entry.id] = el;
                    }}
                    className="relative"
                  >
                    {menuButton(entry.id, entry.label, menuActive(entry))}
                    <div id={panelId(entry.id)} hidden={openMenu !== entry.id} className="absolute right-0 top-full z-50 mt-3 w-64">
                      <ul className="panel menu-enter origin-top-right grid gap-1 p-2" data-nav-column onKeyDown={onColumnKeyDown}>
                        {entry.items.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              aria-current={isCurrent(item.href) ? "page" : undefined}
                              className={cx(
                                "flex min-h-11 items-center px-3 text-sm font-medium text-fg-secondary hover:text-fg aria-[current=page]:text-fg",
                                menuLinkClass,
                              )}
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ),
              )}
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
            <ul className="grid gap-0.5">
              <li>
                <MobileGroup
                  id={`${mobilePanelId}-${SERVICES}`}
                  label={services.label}
                  active={servicesActive}
                  expanded={expanded === SERVICES}
                  onToggle={() => setExpanded((open) => (open === SERVICES ? null : SERVICES))}
                >
                  {services.bands.map((band) => (
                    <div key={band.key} className="mt-2">
                      <p className="t-label px-4 pb-1.5 pt-2">{band.title}</p>
                      <ul className="grid gap-0.5">
                        {band.domains.map((domain) => (
                          <li key={domain.href}>
                            <MobileLink item={domain} current={isCurrent(domain.href)} icon={domain.icon} strong />
                            {domain.services.length > 0 && (
                              <ul className="ml-6 grid border-l border-line-subtle pl-2">
                                {domain.services.map((service) => (
                                  <li key={service.href}>
                                    <MobileLink item={service} current={isCurrent(service.href)} small />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="t-label mt-2 px-4 pb-1.5 pt-2">{services.startHere.title}</p>
                  <ul className="grid gap-0.5">
                    {services.startHere.items.map((item) => (
                      <li key={item.href}>
                        <MobileLink item={item} current={isCurrent(item.href)} icon={item.icon} />
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={services.href}
                    aria-current={pathname === services.href ? "page" : undefined}
                    className="mt-1 flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold text-brand hover:bg-surface-2"
                  >
                    {services.allLabel}
                    <Icon name="arrowRight" className="h-4 w-4" />
                  </Link>
                </MobileGroup>
              </li>
              {entries.map((entry) =>
                entry.kind === "link" ? (
                  <li key={entry.href}>
                    <MobileLink item={entry} current={isCurrent(entry.href)} chevron />
                  </li>
                ) : (
                  <li key={entry.id}>
                    <MobileGroup
                      id={`${mobilePanelId}-${entry.id}`}
                      label={entry.label}
                      active={menuActive(entry)}
                      expanded={expanded === entry.label}
                      onToggle={() => setExpanded((open) => (open === entry.label ? null : entry.label))}
                    >
                      <ul className="grid gap-0.5">
                        {entry.items.map((item) => (
                          <li key={item.href}>
                            <MobileLink item={item} current={isCurrent(item.href)} />
                          </li>
                        ))}
                      </ul>
                    </MobileGroup>
                  </li>
                ),
              )}
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

/** Disclosure group of the mobile sheet (button + region; the region is removed from the tab order when closed). */
function MobileGroup({
  id,
  label,
  active,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={onToggle}
        data-active={active || undefined}
        className={cx(
          "flex min-h-11 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-medium transition-colors",
          active || expanded ? "text-fg" : "text-fg-secondary hover:bg-surface-2",
          expanded && "bg-surface-2",
        )}
      >
        {label}
        <Icon name="chevronDown" className={cx("h-4 w-4 text-fg-subtle transition-transform duration-200", expanded && "rotate-180")} />
      </button>
      <div id={id} hidden={!expanded} className="pb-2">
        {children}
      </div>
    </>
  );
}

function MobileLink({
  item,
  current,
  icon,
  strong = false,
  small = false,
  chevron = false,
}: {
  item: NavItem;
  current: boolean;
  icon?: ComponentProps<typeof Icon>["name"];
  strong?: boolean;
  small?: boolean;
  chevron?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cx(
        "flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 transition-colors hover:bg-surface-2 aria-[current=page]:bg-surface-3 aria-[current=page]:text-fg",
        small ? "text-[14px] text-fg-muted" : "text-[15px] text-fg-secondary",
        strong && "font-semibold text-fg",
        chevron && "justify-between text-base font-medium",
      )}
    >
      {icon && <Icon name={icon} className="h-4 w-4 shrink-0 text-brand" />}
      <span className="min-w-0">{item.label}</span>
      {chevron && <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-fg-subtle" />}
    </Link>
  );
}
