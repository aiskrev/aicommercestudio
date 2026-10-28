import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { catalogueSeedSnapshot } from "@/lib/catalogue-seed";

const FILE = resolve(__dirname, "catalogue-seed.json");

describe("service catalogue seed snapshot", () => {
  it("equals the current content (regenerate with UPDATE_CATALOGUE_SEED=1)", () => {
    const current = catalogueSeedSnapshot();
    if (process.env.UPDATE_CATALOGUE_SEED === "1") writeFileSync(FILE, `${JSON.stringify(current, null, 1)}\n`, "utf-8");
    // Parsed comparison: independent of line endings in the checkout.
    expect(JSON.parse(readFileSync(FILE, "utf-8"))).toEqual(current);
  });

  it("covers the ten domains, every family and every service", () => {
    const snapshot = catalogueSeedSnapshot();
    expect(snapshot.domains).toHaveLength(10);
    expect(snapshot.families).toHaveLength(60);
    expect(snapshot.services.map((s) => s.key).sort()).toEqual(getContent("bg").services.map((s) => s.key).sort());
    for (const service of snapshot.services) {
      expect(service.translations.bg.primary_keyword, service.key).toBeTruthy();
      expect(service.translations.en.primary_keyword, service.key).toBeTruthy();
    }
  });
});
