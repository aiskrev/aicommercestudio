import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { CARE_PLANS } from "@/lib/care-plans";
import {
  AI_MANAGED_PRICES,
  BG_FACTOR,
  CARE_PLAN_PRICES,
  EU_FACTOR,
  type PriceItem,
  priceText,
  roundPrice,
  SERVICE_PRICES,
  WORKSHOP_PRICES,
} from "@/lib/prices";
import { WORKSHOP_KEYS } from "@/lib/workshop-slugs";

const ALL: [string, PriceItem][] = [
  ...Object.entries(SERVICE_PRICES),
  ...Object.entries(WORKSHOP_PRICES),
  ...Object.entries(CARE_PLAN_PRICES),
  ...Object.entries(AI_MANAGED_PRICES),
];

describe("published prices", () => {
  it("follow the owner's rule: Bulgaria = report −10 %, EU = report +20 % −10 %", () => {
    expect(BG_FACTOR).toBe(0.9);
    expect(EU_FACTOR).toBeCloseTo(1.08);
    // Spot checks against the report's baseline (2026-11-10).
    expect(SERVICE_PRICES.store_development.bg).toEqual({ from: 1100, typical: [2250, 3600] });
    expect(SERVICE_PRICES.store_development.eu).toEqual({ from: 1300, typical: [2700, 4300] });
    expect(AI_MANAGED_PRICES.essential.bg).toEqual({ from: 230, typical: [320, 450] });
    expect(WORKSHOP_PRICES.ai_strategy_discovery.eu).toEqual({ from: 860, typical: [1300, 1950] });
  });

  it("cover every service, workshop, care plan and AI Managed level", () => {
    const services = getContent("bg").services.map((s) => s.key);
    for (const key of services) expect(SERVICE_PRICES[key], key).toBeDefined();
    expect(Object.keys(WORKSHOP_PRICES).sort()).toEqual([...WORKSHOP_KEYS].sort());
    expect(Object.keys(CARE_PLAN_PRICES).sort()).toEqual(CARE_PLANS.map((p) => p.key).sort());
    expect(Object.keys(AI_MANAGED_PRICES)).toEqual(getContent("bg").aiManaged.packages.items.map((p) => p.key));
  });

  it.each(ALL)("%s: ordered, rounded and higher for the EU than for Bulgaria", (_key, price) => {
    for (const band of [price.bg, price.eu]) {
      expect(band.from).toBeGreaterThan(0);
      expect(band.from).toBeLessThanOrEqual(band.typical[0]);
      expect(band.typical[0]).toBeLessThan(band.typical[1]);
      for (const value of [band.from, ...band.typical]) expect(roundPrice(value)).toBe(value);
    }
    expect(price.eu.from).toBeGreaterThan(price.bg.from);
    expect(price.eu.typical[1]).toBeGreaterThan(price.bg.typical[1]);
  });

  it("formats per language and market, with the unit", () => {
    // Intl puts no-break spaces between amount and currency; compare with plain spaces.
    const plain = (text: { from: string; typical: string }) => ({
      from: text.from.replace(/[  ]/g, " "),
      typical: text.typical.replace(/[  ]/g, " "),
    });
    expect(plain(priceText("bg", SERVICE_PRICES.maintenance))).toEqual({ from: "от 80 € на месец", typical: "Обикновено 160 €–320 € на месец" });
    expect(plain(priceText("en", SERVICE_PRICES.maintenance))).toEqual({ from: "From €95 per month", typical: "Typically €190–€380 per month" });
    expect(plain(priceText("en", SERVICE_PRICES.portals_web_apps)).from).toBe("From €4,300");
  });
});
