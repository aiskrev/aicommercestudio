import { describe, expect, it } from "vitest";

import { normalize, search, type SearchEntry, stem, tokens } from "@/lib/search";

const entry = (title: string, description = "", text = "", type: SearchEntry["type"] = "service"): SearchEntry => ({
  type,
  url: `/bg/${normalize(title).replace(/ /g, "-")}`,
  title,
  description,
  text,
});

const entries = [
  entry("Поддръжка на онлайн магазини", "Месечна грижа за магазина", "обновления сигурност"),
  entry("SEO оптимизация", "Видимост в търсачките", "ключови думи"),
  entry("Технически одит", "Платена оценка на магазина и процесите"),
  entry("AI съветник за автоматизация", "Първоначална оценка на процес", "", "tool"),
  entry("Статия за поддръжка на WooCommerce", "Как се подхожда към обновленията", "", "article"),
  entry("Kubernetes платформа", "Преглед на клъстери", "namespaces RBAC"),
];

describe("normalize and tokens", () => {
  it("lower-cases, drops punctuation and keeps Cyrillic and digits", () => {
    expect(normalize("  AI-съветник, 2026!  ")).toBe("ai съветник 2026");
    expect(tokens("SEO  и онлайн")).toEqual(["seo", "и", "онлайн"]);
    expect(tokens("   ")).toEqual([]);
  });

  it("cuts endings from longer words only", () => {
    expect(stem("ai")).toBe("ai");
    expect(stem("магазин")).toBe("магаз");
    expect(stem("цени")).toBe("цен");
    expect(stem("seo")).toBe("seo");
    expect(stem("поддръжката")).toBe("поддръжк");
  });
});

describe("search", () => {
  it("returns nothing for an empty query", () => {
    expect(search(entries, "")).toEqual([]);
    expect(search(entries, "   ")).toEqual([]);
  });

  it("finds a word whatever its ending", () => {
    const titles = search(entries, "поддръжката").map((h) => h.entry.title);
    expect(titles).toContain("Поддръжка на онлайн магазини");
    expect(titles).toContain("Статия за поддръжка на WooCommerce");
  });

  it("finds a page by what it is described with, not only by its title", () => {
    expect(search(entries, "клъстери")[0].entry.title).toBe("Kubernetes платформа");
    expect(search(entries, "namespaces")[0].entry.title).toBe("Kubernetes платформа");
  });

  it("requires every word to match", () => {
    expect(search(entries, "магазини сигурност").map((h) => h.entry.title)).toEqual(["Поддръжка на онлайн магазини"]);
    expect(search(entries, "магазини kubernetes")).toEqual([]);
  });

  it("ranks a title match above a description match", () => {
    expect(search(entries, "поддръжка")[0].entry.title).toBe("Поддръжка на онлайн магазини");
    expect(search(entries, "магазин")[0].entry.title).toBe("Поддръжка на онлайн магазини");
  });

  it("does not match short words in the middle of other words", () => {
    expect(search(entries, "ai").map((h) => h.entry.title)).toEqual(["AI съветник за автоматизация"]);
  });

  it("matches a Latin term typed in any case and respects the limit", () => {
    expect(search(entries, "SEO")[0].entry.title).toBe("SEO оптимизация");
    expect(search(entries, "на", 2)).toHaveLength(2);
  });
});
