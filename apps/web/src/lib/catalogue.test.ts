import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ApiSummary,
  CATALOGUE_REVALIDATE_SECONDS,
  CATALOGUE_TAG,
  contentEntries,
  domainOfferings,
  formatDuration,
  getCatalogue,
  getCatalogueDetail,
  mergeCatalogue,
} from "@/lib/catalogue";
import { getContent } from "@/content";

const SRC = resolve(__dirname, "..");

function apiItem(overrides: Partial<ApiSummary> & { key: string }): ApiSummary {
  return {
    offering_type: "workshop",
    slug: `${overrides.key.replace(/_/g, "-")}-bg`,
    alternate_slugs: { bg: `${overrides.key.replace(/_/g, "-")}-bg`, en: overrides.key.replace(/_/g, "-") },
    name: "Работна среща",
    short_name: null,
    summary: "Половин ден с екипа.",
    delivery_status: "available",
    primary_domain: { key: "commerce_engineering" },
    is_entry_offer: false,
    duration: { min_days: 0.5, max_days: 1 },
    ...overrides,
  };
}

const reserved = () => ({
  bg: new Set(getContent("bg").services.map((s) => s.slug).concat(getContent("bg").domains.map((d) => d.slug))),
  en: new Set(getContent("en").services.map((s) => s.slug).concat(getContent("en").domains.map((d) => d.slug))),
});

function listResponse(items: ApiSummary[]) {
  return new Response(JSON.stringify({ items, total: items.length, limit: 100, offset: 0 }), { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("content entries", () => {
  it("lists the nine existing services in domain order with reciprocal slugs", () => {
    const bg = contentEntries("bg");
    const en = contentEntries("en");
    expect(bg).toHaveLength(9);
    expect(bg.map((e) => e.key)).toEqual(en.map((e) => e.key));
    expect(bg[0].domain).toBe("ai_agents_automation"); // the AI band comes first; ai_strategy has no primary service
    for (const [index, entry] of bg.entries()) {
      expect(entry.origin).toBe("content");
      expect(entry.alternateSlugs.en).toBe(en[index].slug);
      expect(en[index].alternateSlugs.bg).toBe(entry.slug);
    }
  });
});

describe("merging the published catalogue", () => {
  it("keeps the TypeScript content when the API is unavailable", () => {
    const result = mergeCatalogue(contentEntries("bg"), null, reserved());
    expect(result.source).toBe("content");
    expect(result.entries).toHaveLength(9);
  });

  it("adds valid catalogue-only entries and never overrides the content", () => {
    const api = [
      apiItem({ key: "seo", offering_type: "service", name: "Changed in the admin" }), // content wins
      apiItem({ key: "migration_workshop" }),
      apiItem({ key: "unknown_domain", primary_domain: { key: "nope" } }),
      apiItem({ key: "no_domain", primary_domain: null }),
      apiItem({ key: "bad_type", offering_type: "course" as never }),
      apiItem({ key: "taken_slug", alternate_slugs: { bg: getContent("bg").services[0].slug, en: "free-slug" } }),
      apiItem({ key: "bad_slug", alternate_slugs: { bg: "Bad Slug", en: "bad-slug" } }),
    ];
    const result = mergeCatalogue(contentEntries("bg"), api, reserved());
    expect(result.source).toBe("api");
    const keys = result.entries.map((e) => e.key);
    expect(keys.filter((k) => !contentEntries("bg").some((c) => c.key === k))).toEqual(["migration_workshop"]);
    expect(result.entries.find((e) => e.key === "seo")?.name).toBe(contentEntries("bg").find((e) => e.key === "seo")?.name);
    // The workshop sits after the services of its domain.
    const workshop = keys.indexOf("migration_workshop");
    expect(keys[workshop - 1]).toBe("analytics");
    expect(result.entries[workshop]).toMatchObject({ origin: "catalogue", duration: { minDays: 0.5, maxDays: 1 } });
    expect(domainOfferings(result.entries, "commerce_engineering").map((e) => e.key)).toEqual(["migration_workshop"]);
    expect(domainOfferings(result.entries, "ai_strategy")).toEqual([]);
  });
});

describe("fetching from the API", () => {
  it("falls back to the content when the API cannot be reached (as during next build)", async () => {
    const result = await getCatalogue("en");
    expect(result.source).toBe("content");
    expect(result.entries).toHaveLength(9);
  });

  it("caches the list for the revalidation window under the catalogue tag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(listResponse([apiItem({ key: "migration_workshop" })]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getCatalogue("bg");
    expect(result.entries.some((e) => e.key === "migration_workshop")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/public/catalogue/services?locale=bg&limit=100&offset=0");
    expect(init.next).toEqual({ revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_TAG] });
  });

  it("treats an error response as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    expect((await getCatalogue("bg")).source).toBe("content");
  });

  it("looks up a detail only for a published catalogue-only slug", async () => {
    const detail = {
      ...apiItem({ key: "migration_workshop" }),
      body: "Първи абзац.\n\nВтори абзац.",
      seo: { title: "SEO заглавие", description: "SEO описание" },
      lead_category: null,
      capabilities: [{ title: "Пренасочвания", description: "Карта на адресите." }],
      deliverables: ["Карта на пренасочванията"],
      related: {
        services: [{ key: "seo", offering_type: "service", slug: "seo-optimizatsiya", name: "SEO" }],
        assessments: [{ key: "hidden_draft", offering_type: "assessment", slug: "x", name: "Not in the list" }],
        workshops: [],
      },
    };
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/services/migration_workshop") ? new Response(JSON.stringify(detail)) : listResponse([apiItem({ key: "migration_workshop" })]),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await getCatalogueDetail("bg", "Not A Slug")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    expect(await getCatalogueDetail("bg", "unknown-slug")).toBeNull();
    expect(fetchMock.mock.calls.every(([url]) => !url.includes("/services/migration_workshop"))).toBe(true);

    expect(await getCatalogueDetail("bg", getContent("bg").services[0].slug)).toBeNull(); // content pages are not catalogue entries

    const entry = await getCatalogueDetail("bg", "migration-workshop-bg");
    expect(entry).toMatchObject({ key: "migration_workshop", offeringType: "workshop", deliverables: ["Карта на пренасочванията"] });
    expect(entry?.related.services.map((r) => r.key)).toEqual(["seo"]);
    expect(entry?.related.assessments).toEqual([]); // not published, so not linked
  });
});

describe("helpers", () => {
  it("formats durations per locale", () => {
    expect(formatDuration({ minDays: 0.5, maxDays: 1 }, "bg")).toBe("0,5–1");
    expect(formatDuration({ minDays: 0.5, maxDays: 1 }, "en")).toBe("0.5–1");
    expect(formatDuration({ minDays: 2, maxDays: 2 }, "en")).toBe("2");
  });

  it("uses the same revalidation window on every catalogue route", () => {
    for (const file of ["app/[locale]/uslugi/page.tsx", "app/[locale]/uslugi/[slug]/page.tsx", "app/sitemap.ts"]) {
      const source = readFileSync(resolve(SRC, file), "utf-8");
      expect(source, file).toContain(`export const revalidate = ${CATALOGUE_REVALIDATE_SECONDS};`);
    }
  });
});
