import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/Header";
import { buildSlugMap } from "@/content";
import { bg } from "@/i18n/dictionaries/bg";

vi.mock("next/navigation", () => ({ usePathname: () => "/bg/uslugi/ai-managed-services" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const props = {
  homeHref: "/",
  servicesHref: "/uslugi",
  serviceGroups: [
    {
      title: "AI услуги",
      items: [
        { href: "/uslugi/seo-optimizatsiya", label: "SEO и органичен растеж", description: "SEO описание", icon: "trending" as const },
        { href: "/uslugi/tehnicheski-odit", label: "Технически одит", description: "Одит описание", icon: "clipboard" as const },
      ],
    },
  ],
  items: [{ href: "/instrumenti", label: "Инструменти" }],
  aboutMenu: {
    label: "За нас",
    items: [
      { href: "/za-nas", label: "Кои сме" },
      { href: "/proces", label: "Как работим" },
    ],
  },
  cta: { href: "/kontakti", label: "Заяви консултация" },
  labels: {
    nav: "Основна навигация",
    openMenu: "Отвори менюто",
    closeMenu: "Затвори менюто",
    services: "Услуги",
    allServices: "Всички услуги",
  },
  locale: "bg" as const,
  slugs: buildSlugMap(),
  languageLabels: bg.language,
};

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
    expect(panel.querySelector("a[href='/uslugi/seo-optimizatsiya']")).toBeInTheDocument();

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

  it("mobile menu toggles, locks scrolling, focuses the first link and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const toggle = screen.getByRole("button", { name: "Отвори менюто" });
    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Затвори менюто" })).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toHaveAttribute("href", "/uslugi/seo-optimizatsiya");

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Отвори менюто" })).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("opens the About menu and closes the other menu", async () => {
    const user = userEvent.setup();
    render(<Header {...props} />);
    const services = screen.getByRole("button", { name: "Услуги" });
    const about = screen.getByRole("button", { name: "За нас" });
    await user.click(services);
    await user.click(about);
    expect(services).toHaveAttribute("aria-expanded", "false");
    expect(about).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(about.getAttribute("aria-controls")!)!;
    expect(panel.querySelector("a[href='/proces']")).toHaveTextContent("Как работим");
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
