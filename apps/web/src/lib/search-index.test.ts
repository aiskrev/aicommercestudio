import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { locales } from "@/i18n/config";
import { SEARCH_TYPES, search } from "@/lib/search";
import { buildSearchIndex } from "@/lib/search-index";

describe("search index", () => {
  it.each(locales)("%s: every entry has a title, a path in this language and a known type", async (locale) => {
    const entries = await buildSearchIndex(locale);
    expect(entries.length).toBeGreaterThan(80);
    for (const entry of entries) {
      expect(entry.title.trim(), entry.url).not.toBe("");
      expect(entry.url.startsWith(`/${locale}`), entry.url).toBe(true);
      expect(SEARCH_TYPES).toContain(entry.type);
    }
    expect(new Set(entries.map((e) => e.url)).size, "duplicate URLs").toBe(entries.length);
  });

  it("offers only pages the sitemap publishes", async () => {
    const published = new Set((await sitemap()).map((item) => new URL(item.url).pathname));
    for (const locale of locales) {
      for (const entry of await buildSearchIndex(locale)) expect(published.has(entry.url), entry.url).toBe(true);
    }
  });

  it("finds the main things by their everyday words in both languages", async () => {
    const bg = await buildSearchIndex("bg");
    const en = await buildSearchIndex("en");
    expect(search(bg, "поддръжка").length).toBeGreaterThan(0);
    expect(search(bg, "kubernetes").length).toBeGreaterThan(0);
    expect(search(bg, "съветник").some((h) => h.entry.type === "tool")).toBe(true);
    expect(search(en, "maintenance").length).toBeGreaterThan(0);
    expect(search(en, "kubernetes").length).toBeGreaterThan(0);
  });

  it("leads to the pages that publish prices when someone searches for prices", async () => {
    const bgUrls = search(await buildSearchIndex("bg"), "цени", 30).map((h) => h.entry.url);
    expect(bgUrls).toContain("/bg/paketi");
    const enUrls = search(await buildSearchIndex("en"), "prices", 30).map((h) => h.entry.url);
    expect(enUrls).toContain("/en/care-plans");
  });
});
