import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { buildSlugMap } from "@/content";
import { bg } from "@/i18n/dictionaries/bg";

let pathname = "/bg/uslugi/rabotna-sreshta-migratsiya";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function addAlternate(hreflang: string, href: string) {
  const link = document.createElement("link");
  link.rel = "alternate";
  link.hreflang = hreflang;
  link.href = href;
  document.head.appendChild(link);
}

afterEach(() => {
  document.head.querySelectorAll("link[rel=alternate]").forEach((link) => link.remove());
});

describe("language switcher", () => {
  it("uses the page's hreflang alternate for a catalogue-only entry", () => {
    pathname = "/bg/uslugi/rabotna-sreshta-migratsiya";
    addAlternate("bg", "http://localhost:3000/bg/uslugi/rabotna-sreshta-migratsiya");
    addAlternate("en", "http://localhost:3000/en/services/migration-workshop");
    render(<LanguageSwitcher locale="bg" slugs={buildSlugMap()} labels={bg.language} />);
    expect(screen.getByTestId("lang-en")).toHaveAttribute("href", "/en/services/migration-workshop");
  });

  it("keeps the slug map for known pages and the homepage fallback without an alternate", () => {
    pathname = "/bg/uslugi/seo-optimizatsiya";
    render(<LanguageSwitcher locale="bg" slugs={buildSlugMap()} labels={bg.language} />);
    expect(screen.getByTestId("lang-en").getAttribute("href")).toMatch(/^\/en\/services\/[a-z-]+$/);

    pathname = "/bg/uslugi/nyama-takava";
    render(<LanguageSwitcher locale="bg" slugs={buildSlugMap()} labels={bg.language} />);
    expect(screen.getAllByTestId("lang-en")[1]).toHaveAttribute("href", "/en");
  });
});
