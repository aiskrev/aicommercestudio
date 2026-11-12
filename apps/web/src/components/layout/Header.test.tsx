import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { activeHref, Header } from "@/components/layout/Header";
import { buildSlugMap, getContent, serviceByKey } from "@/content";
import type { ServiceKey } from "@/content/types";
import { bg } from "@/i18n/dictionaries/bg";
import { en } from "@/i18n/dictionaries/en";
import { DOMAINS } from "@/lib/domains";
import { AI_SERVICE_NAV, FOUNDATION_SERVICE_NAV } from "@/lib/navigation";
import { buildNavigation, navigationHrefs } from "@/lib/site-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/bg/uslugi/ai-managed-services" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const navigation = buildNavigation("bg", bg);
const props = {
  homeHref: "/bg",
  menus: navigation.menus,
  cta: navigation.cta,
  labels: { nav: "Основна навигация", openMenu: "Отворете менюто", closeMenu: "Затворете менюто", overview: "Преглед" },
  locale: "bg" as const,
  slugs: buildSlugMap(),
  languageLabels: bg.language,
};

const ALL_SERVICES: ServiceKey[] = [
  ...AI_SERVICE_NAV,
  ...FOUNDATION_SERVICE_NAV,
  "business_websites",
  "store_development",
  "portals_web_apps",
  "payments_subscriptions",
  "security_performance",
  "integration_care",
];

/** Every destination of the V3 header (two service groups, four links, About ▾, CTA). */
const V3_DESTINATIONS = [
  ...[...AI_SERVICE_NAV, ...FOUNDATION_SERVICE_NAV].map((key) => `/bg/uslugi/${serviceByKey("bg", key).slug}`),
  "/bg/uslugi",
  "/bg/ai-resheniya",
  "/bg/instrumenti",
  "/bg/za-kogo",
  "/bg/statii",
  "/bg/za-nas",
  "/bg/proces",
  "/bg/kontakti",
];

/** Destinations added by the V4 header (Solutions ▾, Company ▾, Start here) that must survive the V5 menus. */
const V4_DESTINATIONS = [
  "/bg/demo-tsentar",
  "/bg/proektni-paketi",
  "/bg/paketi",
  "/bg/tseni",
  "/bg/rabotni-sreshti",
  "/bg/za-nas/osnovatel",
  "/bg/ai-agenti",
  "/bg/uslugi/tehnicheski-odit",
];

/** Routes behind feature flags that are off by default; no menu may ever link to them. */
const FLAGGED = ["/konfigurator", "/zayavka", "/oferta", "/konto", "/proekti", "/configurator", "/quote-request", "/quotation", "/account", "/case-studies"];

const button = (name: string) => screen.getByRole("button", { name });
const panelOf = (toggle: HTMLElement) => document.getElementById(toggle.getAttribute("aria-controls")!)!;

describe("Header (V5)", () => {
  it("shows the six customer-facing menus in order and the quote button", () => {
    render(<Header {...props} />);
    const desktop = screen.getAllByRole("navigation", { name: "Основна навигация" })[0];
    const labels = within(desktop)
      .getAllByRole("button")
      .map((element) => element.textContent);
    expect(labels).toEqual(["Изработка на сайтове", "Онлайн магазини", "AI и автоматизация", "Поддръжка", "Пакети и цени", "Студио"]);
    expect(screen.getByTestId("header-cta")).toHaveAttribute("href", "/bg/kontakti?tip=oferta");
  });

  it("opens a menu and closes it with Escape, returning focus", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const toggle = button("Изработка на сайтове");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = panelOf(toggle);
    expect(panel).not.toHaveAttribute("hidden");
    expect(within(panel).getByTestId("overview-websites")).toHaveAttribute("href", "/bg/izrabotka-na-saytove");
    expect(panel.querySelector("a[href='/bg/izrabotka-na-saytove#static']")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("closes the open menu on outside click", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Header {...props} />
        <p>outside</p>
      </>,
    );
    const toggle = button("Онлайн магазини");
    await user.click(toggle);
    await user.click(screen.getByText("outside"));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens one menu at a time", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const websites = button("Изработка на сайтове");
    const studio = button("Студио");
    await user.click(websites);
    await user.click(studio);
    expect(websites).toHaveAttribute("aria-expanded", "false");
    expect(studio).toHaveAttribute("aria-expanded", "true");
    const panel = panelOf(studio);
    expect(panel.querySelector("a[href='/bg/proces']")).toHaveTextContent("Как работим");
    expect(panel.querySelector("a[href='/bg/za-nas/osnovatel']")).toHaveTextContent("За основателя");
  });

  it("mobile menu toggles, locks scrolling, focuses the first control, opens the current group and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    await user.click(button("Отворете менюто"));

    expect(button("Затворете менюто")).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toHaveTextContent("Изработка на сайтове");
    const sheet = screen.getByTestId("mobile-menu");
    // The current page (AI Managed Services) belongs to the Maintenance group, which is open and marks it.
    const group = within(sheet).getByRole("button", { name: "Поддръжка" });
    expect(group).toHaveAttribute("aria-expanded", "true");
    expect(within(panelOf(group)).getByRole("link", { name: "AI Managed Services и оптимизация" })).toHaveAttribute("aria-current", "page");
    // The quote action is always there, outside the scrolling list.
    expect(within(sheet).getByTestId("mobile-cta")).toHaveAttribute("href", "/bg/kontakti?tip=oferta");

    await user.keyboard("{Escape}");
    expect(button("Отворете менюто")).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("links every published domain and every service from the desktop menus", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const hrefs = new Set<string>();
    for (const menu of navigation.menus) {
      const toggle = screen.getByTestId(`menu-${menu.id}`);
      await user.click(toggle);
      for (const a of panelOf(toggle).querySelectorAll("a")) hrefs.add(a.getAttribute("href")!);
    }
    for (const definition of DOMAINS.filter((d) => d.published)) {
      const domain = getContent("bg").domains.find((d) => d.key === definition.key)!;
      expect(hrefs.has(`/bg/uslugi/${domain.slug}`), definition.key).toBe(true);
    }
    for (const key of ALL_SERVICES) expect(hrefs.has(`/bg/uslugi/${serviceByKey("bg", key).slug}`), key).toBe(true);
    expect(hrefs.has("/bg/izrabotka-na-saytove")).toBe(true);
    expect(hrefs.has("/bg/online-magazini")).toBe(true);
  });

  it("moves focus within a menu column with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const toggle = button("Изработка на сайтове");
    await user.click(toggle);
    const column = panelOf(toggle).querySelector<HTMLElement>("[data-nav-column]")!;
    const links = Array.from(column.querySelectorAll("a"));
    expect(links.length).toBeGreaterThanOrEqual(3);
    links[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(links[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(links[links.length - 1]).toHaveFocus(); // wraps around
    await user.keyboard("{Home}");
    expect(links[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(links[links.length - 1]).toHaveFocus();
  });

  it("keeps every destination of the V3 and V4 headers on desktop and mobile (migration)", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const desktop = screen.getAllByRole("navigation", { name: "Основна навигация" })[0];
    const desktopHrefs = new Set(Array.from(desktop.querySelectorAll("a")).map((a) => a.getAttribute("href")));
    await user.click(button("Отворете менюто"));
    const sheet = screen.getByTestId("mobile-menu");
    const mobileHrefs = new Set(Array.from(sheet.querySelectorAll("a")).map((a) => a.getAttribute("href")));
    for (const href of [...V3_DESTINATIONS, ...V4_DESTINATIONS]) {
      expect(desktopHrefs.has(href), `desktop ${href}`).toBe(true);
      expect(mobileHrefs.has(href), `mobile ${href}`).toBe(true);
    }
  });

  it("never links a feature behind a switched-off flag, in either language", () => {
    for (const [locale, dict] of [["bg", bg], ["en", en]] as const) {
      for (const href of navigationHrefs(buildNavigation(locale, dict))) {
        expect(href.startsWith(`/${locale}`), href).toBe(true);
        const path = href.split(/[?#]/)[0];
        expect(FLAGGED.some((flagged) => path === `/${locale}${flagged}` || path.startsWith(`/${locale}${flagged}/`)), href).toBe(false);
        expect(href, "empty or placeholder href").not.toMatch(/#$|undefined|null/);
      }
    }
  });

  it("builds the same menu structure in both languages", () => {
    const [bgNav, enNav] = [buildNavigation("bg", bg), buildNavigation("en", en)];
    expect(enNav.menus.map((menu) => menu.id)).toEqual(bgNav.menus.map((menu) => menu.id));
    bgNav.menus.forEach((menu, index) => {
      expect(enNav.menus[index].columns.map((column) => column.items.length), menu.id).toEqual(menu.columns.map((column) => column.items.length));
    });
    expect(enNav.menus.find((menu) => menu.id === "websites")!.overview.href).toBe("/en/website-development");
    expect(enNav.menus.find((menu) => menu.id === "ecommerce")!.overview.href).toBe("/en/ecommerce");
    expect(enNav.cta.href).toBe("/en/contact?type=quote");
  });

  it("marks only the most specific matching link as the current page", () => {
    const hrefs = ["/bg/za-nas", "/bg/za-nas/osnovatel", "/bg/proces"];
    expect(activeHref("/bg/za-nas/osnovatel", hrefs)).toBe("/bg/za-nas/osnovatel");
    expect(activeHref("/bg/za-nas", hrefs)).toBe("/bg/za-nas");
    expect(activeHref("/bg/statii/x", hrefs)).toBeUndefined();
  });

  it("makes the page behind the open mobile menu inert and restores it on close", async () => {
    const user = userEvent.setup();
    const main = document.createElement("main");
    document.body.appendChild(main);
    render(<Header {...props} />);
    await user.click(button("Отворете менюто"));
    expect(main.inert).toBe(true);
    await user.keyboard("{Escape}");
    expect(main.inert).toBe(false);
    main.remove();
  });
});
