"use client";

import Link from "next/link";
import { type ComponentProps, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { AccountLinks, type AccountLinksData } from "@/components/layout/AccountEntry";
import { LanguageSwitcher, type LanguageSwitcherLabels } from "@/components/layout/LanguageSwitcher";
import { Logo } from "@/components/layout/Logo";
import { type SearchLabels, SiteSearch } from "@/components/layout/SiteSearch";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, Container, cx } from "@/components/ui/primitives";
import type { Locale, SlugMap } from "@/i18n/config";
import { UiPreview } from "@/components/v5/UiPreview";
import type { Navigation, NavItem, NavLink, NavMenu } from "@/lib/site-nav";
import { usePublicPathname } from "@/lib/use-public-pathname";

interface Labels {
  nav: string;
  openMenu: string;
  closeMenu: string;
  overview: string;
}

/** The href among `hrefs` that best matches the current page: exact, else the longest parent path. */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** Path part of a menu href (anchors and queries never mark a page as current). */
const pathOf = (href: string) => href.split(/[?#]/)[0];

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
 * Site header, V5 (docs/V5_LINK_AUDIT.md).
 *
 * Desktop (from 90rem = 1440 px, where the six Bulgarian labels fit): six menu buttons, each opening a full-width panel with an overview link, one or two
 * columns of links and a featured card; the quote button on the right. One panel at a time; outside click and
 * Escape close it and Escape returns focus to the trigger; arrow keys move within a column. Below 90rem: a
 * full-height sheet with one accordion per menu and a persistent quote button at the bottom. While the sheet is
 * open the rest of the page is `inert`, page scroll is locked and focus moves into the sheet.
 */
export function Header({
  homeHref,
  menus,
  cta,
  labels,
  locale,
  slugs,
  searchLabels,
  languageLabels,
  account,
  quick,
}: {
  homeHref: string;
  menus: NavMenu[];
  cta: NavItem;
  /** Quick-start strip under every desktop panel and in the mobile sheet (service selector + quote). */
  quick?: Navigation["quick"];
  labels: Labels;
  locale: Locale;
  slugs: SlugMap;
  /** Search box (button + dialog); left out where the header is rendered without it. */
  searchLabels?: SearchLabels;
  languageLabels: LanguageSwitcherLabels;
  /** Sign-in and sign-up links; shown only while customer accounts are switched on. */
  account?: AccountLinksData;
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
  const navRef = useRef<HTMLElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  // Natural width of the desktop menu row, measured while it is shown (labels change only with the language).
  const navNatural = useRef(0);
  // True when the full desktop bar does not fit next to the logo and the right-hand controls: the bar then
  // falls back to the menu button instead of letting the labels run under the search button.
  const [compact, setCompact] = useState(false);

  const menuHrefs = (menu: NavMenu) => [menu.overview.href, ...menu.columns.flatMap((column) => column.items.map((item) => item.href))].map(pathOf);
  const current = activeHref(pathname, menus.flatMap(menuHrefs));
  // Only a link to the page itself (no anchor) carries aria-current.
  const isCurrent = (href: string) => href === current && pathOf(href) === href;
  const menuActive = (menu: NavMenu) => current !== undefined && menuHrefs(menu).includes(current);
  // The mobile accordion opens on the group of the current page.
  const currentGroup = menus.find(menuActive)?.id;
  const [expanded, setExpanded] = useState<string | null>(currentGroup ?? null);

  // Close menus after navigation (state adjusted during render instead of in an effect).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
    setOpenMenu(null);
    setExpanded(currentGroup ?? null);
  }

  // Fit check. The CSS breakpoint (90rem) shows the full bar where it normally fits; this measures the real widths
  // (fonts, scrollbar, zoom, the optional sign-in icon) and switches to the menu button when the row would not fit
  // with a safety margin, so the labels can never overlap the controls on the right.
  useEffect(() => {
    const bar = headerRef.current?.firstElementChild as HTMLElement | null;
    const nav = navRef.current;
    const right = rightRef.current;
    if (!bar || !nav || !right || typeof ResizeObserver === "undefined") return;
    navNatural.current = 0;
    const SAFETY = 16;
    const measure = () => {
      const list = nav.querySelector("ul");
      // While the bar is folded the menu row is not rendered; show it for this synchronous read (no paint happens
      // in between), so a width taken before the web font loaded can never keep the bar folded for good.
      const header = headerRef.current!;
      const folded = header.hasAttribute("data-compact");
      if (folded) header.removeAttribute("data-compact");
      if (nav.offsetWidth > 0 && list) navNatural.current = list.scrollWidth;
      if (folded) header.setAttribute("data-compact", "true");
      if (!navNatural.current) return; // the bar is not shown at this width: nothing to decide
      const style = getComputedStyle(bar);
      const gap = parseFloat(style.columnGap) || 12;
      const available = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const logo = (bar.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
      const toggleButton = mobileButtonRef.current;
      const toggleWidth = toggleButton && toggleButton.offsetWidth > 0 ? toggleButton.offsetWidth + gap : 0;
      const controls = right.getBoundingClientRect().width - toggleWidth;
      const tooWide = logo + navNatural.current + controls + gap * 2 + SAFETY > available;
      setCompact(tooWide);
      if (tooWide) setOpenMenu(null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(right);
    const list = nav.querySelector("ul");
    if (list) observer.observe(list);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [menus]);

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
  // Following an in-page anchor of the current page does not change the path: close the menus explicitly.
  const closeAll = () => {
    setOpenMenu(null);
    setMobileOpen(false);
  };

  const menuLinkClass =
    "rounded-[var(--radius-md)] transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2 aria-[current=page]:bg-surface-2";

  return (
    <>
      <header
        ref={headerRef}
        data-compact={compact || undefined}
        className={cx(
          "sticky top-0 z-50 border-b transition-colors duration-300",
          scrolled || mobileOpen || openMenu
            ? "border-line-subtle bg-ink-950/92 backdrop-blur-xl"
            : "border-transparent bg-ink-950/70 backdrop-blur-md",
        )}
      >
        <Container size="wide" className="flex h-16 items-center justify-between gap-3">
          <Logo href={homeHref} />

          <nav ref={navRef} aria-label={labels.nav} className="hidden shrink-0 min-[90rem]:block" data-desktop-nav>
            <ul className="flex items-center">
              {menus.map((menu) => (
                <li
                  key={menu.id}
                  ref={(el) => {
                    menuRefs.current[menu.id] = el;
                  }}
                >
                  <button
                    ref={(el) => {
                      menuButtonRefs.current[menu.id] = el;
                    }}
                    type="button"
                    aria-expanded={openMenu === menu.id}
                    aria-controls={panelId(menu.id)}
                    onClick={() => toggle(menu.id)}
                    data-active={menuActive(menu) || undefined}
                    data-testid={`menu-${menu.id}`}
                    className={cx(
                      "nav-link inline-flex min-h-11 items-center gap-0.5 whitespace-nowrap px-1 text-sm font-medium transition-colors",
                      menuActive(menu) || openMenu === menu.id ? "text-fg" : "text-fg-muted hover:text-fg",
                    )}
                  >
                    {menu.label}
                    <Icon name="chevronDown" className={cx("h-3.5 w-3.5 transition-transform duration-200", openMenu === menu.id && "rotate-180")} />
                  </button>
                  {/* Positioned against the sticky header, so the panel spans the full width below it. */}
                  {/* The panel is mounted only while it is open: a closed one used to put the links, icons and previews of all six menus (about 700 elements) into the HTML, the data payload and the hydration of every page. */}
                  <div id={panelId(menu.id)} hidden={openMenu !== menu.id} className="absolute inset-x-0 top-full z-50" data-testid={`panel-${menu.id}`}>
                    {openMenu === menu.id && (
                    <div className="menu-enter max-h-[calc(100dvh-4.5rem)] origin-top overflow-y-auto border-b border-line-subtle bg-ink-950 shadow-[var(--shadow-panel)]">
                      <Container size="wide" className="grid gap-6 py-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,0.9fr)] xl:gap-8">
                        <div className="min-w-0 xl:border-r xl:border-line-subtle xl:pr-6">
                          <Link
                            href={menu.overview.href}
                            onClick={closeAll}
                            aria-current={isCurrent(menu.overview.href) ? "page" : undefined}
                            className={cx("group block p-3", menuLinkClass)}
                            data-testid={`overview-${menu.id}`}
                          >
                            <span className="t-label">{labels.overview}</span>
                            <span className="mt-2 flex items-center gap-2 text-base font-semibold leading-snug text-fg">
                              {menu.overview.label}
                              <Icon name="arrowRight" className="arrow-nudge h-4 w-4 text-brand" />
                            </span>
                            {menu.overview.description && (
                              <span className="mt-2 line-clamp-4 block text-caption leading-relaxed text-fg-muted">{menu.overview.description}</span>
                            )}
                          </Link>
                        </div>
                        <div className={cx("grid min-w-0 gap-6", menu.columns.length > 1 && "lg:grid-cols-2")}>
                          {menu.columns.map((column) => (
                            <div key={column.title} className="min-w-0">
                              <p className="t-label px-3 pb-2">{column.title}</p>
                              <ul className="grid gap-0.5" data-nav-column onKeyDown={onColumnKeyDown}>
                                {column.items.map((item) => (
                                  <li key={item.href}>
                                    <MenuLink item={item} current={isCurrent(item.href)} onNavigate={closeAll} className={menuLinkClass} />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                        <Link
                          href={menu.featured.href}
                          onClick={closeAll}
                          className="feature-panel group flex min-w-0 flex-col justify-between gap-4 self-start overflow-hidden p-5"
                          data-testid={`featured-${menu.id}`}
                        >
                          <UiPreview kind={menu.featured.preview} compact className="pointer-events-none -mx-1 hidden xl:block" />
                          <span>
                            <span className="block text-base font-semibold leading-snug text-fg">{menu.featured.title}</span>
                            <span className="mt-2 block text-caption leading-relaxed text-fg-muted">{menu.featured.text}</span>
                          </span>
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
                            {menu.featured.cta}
                            <Icon name="arrowRight" className="arrow-nudge h-4 w-4" />
                          </span>
                        </Link>
                      </Container>
                      {quick && (
                        <div className="border-t border-line-subtle bg-surface-1/60">
                          <Container size="wide" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3.5">
                            <p className="text-caption text-fg-muted">
                              <span className="font-semibold text-fg">{quick.title}</span> {quick.text}
                            </p>
                            <span className="flex items-center gap-2">
                              <Link href={quick.selector.href} onClick={closeAll} className={buttonClass("secondary", "sm")} data-testid={`quick-selector-${menu.id}`}>
                                <Icon name="target" className="h-3.5 w-3.5 text-brand" />
                                {quick.selector.label}
                              </Link>
                              <Link href={quick.quote.href} onClick={closeAll} className={buttonClass("primary", "sm")}>
                                {quick.quote.label}
                              </Link>
                            </span>
                          </Container>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </nav>

          <div ref={rightRef} className="flex shrink-0 items-center gap-1.5" data-header-controls>
            {searchLabels && <SiteSearch locale={locale} labels={searchLabels} />}
            <LanguageSwitcher locale={locale} slugs={slugs} labels={languageLabels} className="hidden lg:block" />
            {account && <AccountLinks links={account} variant="header" />}
            <div className="hidden sm:block">
              <Link href={cta.href} className={buttonClass("primary", "sm")} data-testid="header-cta">
                {cta.label}
              </Link>
            </div>
            <button
              ref={mobileButtonRef}
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-line-default text-fg transition-colors hover:border-brand/50 min-[90rem]:hidden"
              aria-expanded={mobileOpen}
              aria-controls={mobilePanelId}
              aria-label={mobileOpen ? labels.closeMenu : labels.openMenu}
              onClick={() => setMobileOpen((value) => !value)}
              data-menu-toggle
            >
              <Icon key={mobileOpen ? "close" : "menu"} name={mobileOpen ? "close" : "menu"} className="menu-enter h-5 w-5" />
            </button>
          </div>
        </Container>
      </header>

      {/* Quiet scrim under an open desktop panel (decorative; a click on it is an outside click and closes the panel). */}
      {openMenu && <div aria-hidden="true" className="menu-sheet-enter fixed inset-x-0 bottom-0 top-16 z-40 hidden bg-surface-deep/55 min-[90rem]:block" data-testid="menu-scrim" />}

      {/* Rendered outside <header>: its backdrop-filter would otherwise become the containing block of this fixed panel. */}
      <div
        id={mobilePanelId}
        ref={mobilePanelRef}
        hidden={!mobileOpen}
        className="menu-sheet-enter fixed inset-x-0 bottom-0 top-16 z-[70] flex flex-col border-t border-line-subtle bg-ink-950 min-[90rem]:hidden"
        data-testid="mobile-menu"
        data-mobile-sheet
        data-compact={compact || undefined}
      >
        {/* Mounted only while the sheet is open (see the desktop panels): on a phone it was the whole menu, twice, in every page. */}
        {mobileOpen && (
          <>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <Container className="py-4">
            <nav aria-label={labels.nav}>
              <ul className="grid gap-0.5">
                {menus.map((menu) => (
                  <li key={menu.id}>
                    <MobileGroup
                      id={`${mobilePanelId}-${menu.id}`}
                      label={menu.label}
                      icon={menu.overview.icon}
                      active={menuActive(menu)}
                      expanded={expanded === menu.id}
                      onToggle={() => setExpanded((open) => (open === menu.id ? null : menu.id))}
                    >
                      <MobileLink item={{ ...menu.overview, label: `${labels.overview}: ${menu.overview.label}` }} current={isCurrent(menu.overview.href)} icon={menu.overview.icon} strong onNavigate={closeAll} />
                      {menu.columns.map((column) => (
                        <div key={column.title} className="mt-1">
                          <p className="t-label px-4 pb-1 pt-2">{column.title}</p>
                          <ul className="grid gap-0.5">
                            {column.items.map((item) => (
                              <li key={item.href}>
                                <MobileLink item={item} current={isCurrent(item.href)} icon={item.icon} onNavigate={closeAll} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </MobileGroup>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-5 flex flex-col gap-4 border-t border-line-subtle pt-5">
              {quick && (
                <Link
                  href={quick.selector.href}
                  onClick={closeAll}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-line-default bg-surface-1 px-4 py-3 text-body-sm"
                  data-testid="mobile-selector"
                >
                  <Icon name="target" className="h-5 w-5 shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-fg">{quick.selector.label}</span>
                    <span className="block text-xs text-fg-muted">{quick.title}</span>
                  </span>
                  <Icon name="arrowRight" className="ml-auto h-4 w-4 shrink-0 text-brand" />
                </Link>
              )}
              <LanguageSwitcher locale={locale} slugs={slugs} labels={languageLabels} className="self-start" />
              {account && <AccountLinks links={account} variant="sheet" />}
            </div>
          </Container>
        </div>
        {/* Persistent quote action: always visible at the bottom of the sheet. */}
        <div className="border-t border-line-subtle bg-ink-950 py-3">
          <Container>
            <Link href={cta.href} onClick={closeAll} className={cx(buttonClass("primary", "lg"), "w-full")} data-testid="mobile-cta">
              {cta.label}
            </Link>
          </Container>
        </div>
          </>
        )}
      </div>
    </>
  );
}

function MenuLink({ item, current, onNavigate, className }: { item: NavLink; current: boolean; onNavigate: () => void; className: string }) {
  return (
    <Link href={item.href} onClick={onNavigate} aria-current={current ? "page" : undefined} className={cx("group flex min-h-11 gap-3 px-3 py-2.5", className)}>
      {item.icon && (
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand transition-colors group-hover:border-brand/50">
          <Icon name={item.icon} className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="min-w-0 self-center">
        <span className="block text-sm font-semibold leading-snug text-fg">{item.label}</span>
        {item.description && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-fg-muted">{item.description}</span>}
      </span>
    </Link>
  );
}

/** Disclosure group of the mobile sheet (button + region; the region is removed from the tab order when closed). */
function MobileGroup({
  id,
  label,
  icon,
  active,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  icon?: ComponentProps<typeof Icon>["name"];
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
          "flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-semibold transition-colors",
          active || expanded ? "text-fg" : "text-fg-secondary hover:bg-surface-2",
          expanded && "bg-surface-2",
        )}
      >
        <span className="flex items-center gap-3">
          {icon && (
            <span className={cx("inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border transition-colors", expanded || active ? "border-brand/50 bg-surface-3 text-brand" : "border-line-default bg-surface-1 text-fg-muted")} aria-hidden="true">
              <Icon name={icon} className="h-4 w-4" />
            </span>
          )}
          {label}
        </span>
        <Icon name="chevronDown" className={cx("h-4 w-4 text-fg-subtle transition-transform duration-200", expanded && "rotate-180")} />
      </button>
      <div id={id} hidden={!expanded} className="pb-3 pt-1">
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
  onNavigate,
}: {
  item: NavItem;
  current: boolean;
  icon?: ComponentProps<typeof Icon>["name"];
  strong?: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cx(
        "flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-body-sm transition-colors hover:bg-surface-2 aria-[current=page]:bg-surface-3 aria-[current=page]:text-fg",
        strong ? "font-semibold text-fg" : "text-fg-secondary",
      )}
    >
      {icon && <Icon name={icon} className="h-4 w-4 shrink-0 text-brand" />}
      <span className="min-w-0">{item.label}</span>
    </Link>
  );
}
