import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { activeHref, Header } from "@/components/layout/Header";
import { buildSlugMap, getContent, serviceByKey } from "@/content";
import { bg } from "@/i18n/dictionaries/bg";
import { DOMAINS } from "@/lib/domains";
import { AI_SERVICE_NAV, FOUNDATION_SERVICE_NAV } from "@/lib/navigation";
import { buildNavigation } from "@/lib/site-nav";

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
  services: navigation.services,
  entries: navigation.entries,
  cta: { href: "/bg/kontakti", label: "Заяви консултация" },
  labels: { nav: "Основна навигация", openMenu: "Отвори менюто", closeMenu: "Затвори менюто" },
  locale: "bg" as const,
  slugs: buildSlugMap(),
  languageLabels: bg.language,
};

/** Every destination of the previous header (two service groups, four links, About ▾, CTA). */
const PREVIOUS_DESTINATIONS = [
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

describe("Header", () => {
  it("opens the services menu and closes it with Escape, returning focus", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const toggle = screen.getByRole("button", { name: "Услуги" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel.querySelector("a[href='/bg/uslugi/seo-optimizatsiya']")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("closes the services menu on outside click", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Header {...props} />
        <p>outside</p>
      </>,
    );
    const toggle = screen.getByRole("button", { name: "Услуги" });
    await user.click(toggle);
    await user.click(screen.getByText("outside"));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("mobile menu toggles, locks scrolling, focuses the first control and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const toggle = screen.getByRole("button", { name: "Отвори менюто" });
    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Затвори менюто" })).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    // The first control is the Services group, open because the current page is a service page.
    expect(document.activeElement).toHaveTextContent("Услуги");
    expect(document.activeElement).toHaveAttribute("aria-expanded", "true");
    const group = document.getElementById(document.activeElement!.getAttribute("aria-controls")!)!;
    expect(within(group).getByRole("link", { name: "AI Managed Services и оптимизация" })).toHaveAttribute("aria-current", "page");

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Отвори менюто" })).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("opens the Company menu and closes the other menu", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const services = screen.getByRole("button", { name: "Услуги" });
    const company = screen.getByRole("button", { name: "Компания" });
    await user.click(services);
    await user.click(company);
    expect(services).toHaveAttribute("aria-expanded", "false");
    expect(company).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(company.getAttribute("aria-controls")!)!;
    expect(panel.querySelector("a[href='/bg/proces']")).toHaveTextContent("Как работим");
    expect(panel.querySelector("a[href='/bg/za-nas/osnovatel']")).toHaveTextContent("За основателя");
  });

  it("groups the ten published domains in three bands with their services and a Start here column", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    await user.click(screen.getByRole("button", { name: "Услуги" }));
    const panel = document.getElementById(screen.getByRole("button", { name: "Услуги" }).getAttribute("aria-controls")!)!;
    for (const band of ["ai", "engineering", "operations"]) expect(within(panel).getByTestId(`menu-band-${band}`)).toBeInTheDocument();
    for (const definition of DOMAINS.filter((d) => d.published)) {
      const domain = getContent("bg").domains.find((d) => d.key === definition.key)!;
      expect(within(panel).getByRole("link", { name: new RegExp(`^${domain.name}`) })).toHaveAttribute("href", `/bg/uslugi/${domain.slug}`);
    }
    // Each existing service once (audit appears under its domain and under Start here).
    for (const key of [...AI_SERVICE_NAV, ...FOUNDATION_SERVICE_NAV]) {
      const links = panel.querySelectorAll(`a[href='/bg/uslugi/${serviceByKey("bg", key).slug}']`);
      expect(links.length, key).toBe(key === "audit" ? 2 : 1);
    }
    const start = within(panel).getByTestId("menu-start-here");
    expect(within(start).getByRole("link", { name: /^Всички услуги/ })).toHaveAttribute("href", "/bg/uslugi");
    expect(within(start).getAllByRole("link").length).toBeGreaterThanOrEqual(2);
  });

  it("moves focus within a menu column with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    await user.click(screen.getByRole("button", { name: "Услуги" }));
    const column = screen.getByTestId("menu-band-ai").querySelector<HTMLElement>("[data-nav-column]")!;
    const links = Array.from(column.querySelectorAll("a"));
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

  it("keeps every destination of the previous header (migration)", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const desktop = screen.getAllByRole("navigation", { name: "Основна навигация" })[0];
    const desktopHrefs = new Set(Array.from(desktop.querySelectorAll("a")).map((a) => a.getAttribute("href")));
    await user.click(screen.getByRole("button", { name: "Отвори менюто" }));
    const sheet = document.getElementById(screen.getByRole("button", { name: "Затвори менюто" }).getAttribute("aria-controls")!)!;
    const mobileHrefs = new Set(Array.from(sheet.querySelectorAll("a")).map((a) => a.getAttribute("href")));
    for (const href of PREVIOUS_DESTINATIONS) {
      expect(desktopHrefs.has(href) || href === "/bg/kontakti", `desktop ${href}`).toBe(true);
      expect(mobileHrefs.has(href), `mobile ${href}`).toBe(true);
    }
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
    await user.click(screen.getByRole("button", { name: "Отвори менюто" }));
    expect(main.inert).toBe(true);
    await user.keyboard("{Escape}");
    expect(main.inert).toBe(false);
    main.remove();
  });
});
