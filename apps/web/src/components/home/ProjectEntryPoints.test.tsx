import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ProjectEntryPoints } from "@/components/home/ProjectEntryPoints";
import { getContent, serviceByKey } from "@/content";
import { type Locale, localizePath, locales } from "@/i18n/config";
import { SERVICE_PRICES } from "@/lib/prices";
import { quoteWithService, routes } from "@/lib/routes";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const EXPECTED = ["business_websites", "store_development", "portals_web_apps", "automation", "ai_managed"];

function entries(locale: Locale) {
  const { home } = getContent(locale);
  return home.entry.items.map((item) => ({
    ...item,
    detailsHref: localizePath(locale, routes.service(serviceByKey(locale, item.key).slug)),
    quoteHref: localizePath(locale, quoteWithService(item.key)),
    price: SERVICE_PRICES[item.key],
  }));
}

describe("homepage commercial entry points", () => {
  it("covers the five commercial directions in the same order in both languages", () => {
    for (const locale of locales) {
      expect(getContent(locale).home.entry.items.map((item) => item.key)).toEqual(EXPECTED);
    }
  });

  for (const locale of locales) {
    it(`${locale}: each card links to its service page and to a quote request for that service`, () => {
      const { home } = getContent(locale);
      render(
        <ProjectEntryPoints
          locale={locale}
          items={entries(locale)}
          labels={{ details: home.entry.detailsLabel, quote: home.entry.quoteLabel, priceNote: home.entry.priceNote }}
        />,
      );
      for (const item of entries(locale)) {
        const card = screen.getByTestId(`entry-${item.key}`);
        const quote = within(card).getByRole("link", { name: home.entry.quoteLabel });
        // Bulgarian URLs use ?usluga=<key>&tip=oferta, English ones ?service=<key>&type=quote.
        const query = locale === "bg" ? [`usluga=${item.key}`, "tip=oferta"] : [`service=${item.key}`, "type=quote"];
        for (const part of query) expect(quote.getAttribute("href")).toContain(part);
        expect(within(card).getByRole("link", { name: home.entry.detailsLabel })).toHaveAttribute("href", item.detailsHref);
        // The price is labelled as indicative, never as a quote or a checkout amount.
        expect(card).toHaveTextContent(home.entry.priceNote);
      }
    });
  }

  it("shows the same amounts in both languages (the language never selects a price)", () => {
    const digits = (text: string) => text.replace(/\D/g, "");
    for (const key of EXPECTED) {
      const [bg, en] = locales.map((locale) => {
        const { container } = render(
          <ProjectEntryPoints
            locale={locale}
            items={entries(locale).filter((item) => item.key === key)}
            labels={{ details: "d", quote: "q", priceNote: "n" }}
          />,
        );
        const text = container.querySelector("p.font-display")!.textContent ?? "";
        container.remove();
        return digits(text);
      });
      expect(bg).toBe(en);
    }
  });
});
