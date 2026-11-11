import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { getDictionary } from "@/i18n";
import { CARE_PLANS } from "@/lib/care-plans";
import { EXCLUDED_COSTS, PRICE_GROUPS, priceScheduleSnapshot } from "@/lib/price-schedule";
import { PRICE_CURRENCY, PRICE_SCHEDULE_VERSION, PRICE_TAX_TREATMENT, priceText, roundPrice } from "@/lib/prices";
import { WORKSHOP_KEYS } from "@/lib/workshop-slugs";

const FILE = resolve(__dirname, "price-schedule.json");

describe("published price schedule (the copy the API reads)", () => {
  it("equals lib/prices.ts (regenerate with UPDATE_PRICE_SCHEDULE=1, then copy to apps/api/app/price_schedule.json)", () => {
    const current = priceScheduleSnapshot();
    if (process.env.UPDATE_PRICE_SCHEDULE === "1") writeFileSync(FILE, `${JSON.stringify(current, null, 1)}\n`, "utf-8");
    expect(JSON.parse(readFileSync(FILE, "utf-8"))).toEqual(current);
  });

  it("names its version, currency, approval and tax treatment, and is never binding", () => {
    const snapshot = priceScheduleSnapshot();
    expect(snapshot.version).toBe(PRICE_SCHEDULE_VERSION);
    expect(snapshot.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(snapshot.currency).toBe("EUR");
    expect(snapshot.currency).toBe(PRICE_CURRENCY);
    expect(snapshot.owner_approval).toBe("pending"); // the owner's decision, see docs/OWNER_DECISION_PRICE_SCHEDULE.md
    expect(snapshot.tax_treatment).toBe(PRICE_TAX_TREATMENT);
    expect(snapshot.binding).toBe(false);
  });

  it("maps every service, workshop, care plan and AI Managed level, and nothing else", () => {
    const { groups } = priceScheduleSnapshot();
    expect(Object.keys(groups.service).sort()).toEqual(getContent("bg").services.map((service) => service.key).sort());
    expect(Object.keys(groups.workshop).sort()).toEqual([...WORKSHOP_KEYS].sort());
    expect(Object.keys(groups.care_plan).sort()).toEqual(CARE_PLANS.map((plan) => plan.key).sort());
    expect(Object.keys(groups.ai_managed)).toEqual(["essential", "managed", "advanced"]);
  });

  it("holds whole, ordered, already rounded amounts", () => {
    for (const [group, items] of Object.entries(priceScheduleSnapshot().groups)) {
      for (const [key, entry] of Object.entries(items)) {
        const amounts = [entry.from, ...entry.typical];
        for (const amount of amounts) {
          expect(Number.isInteger(amount), `${group}.${key}`).toBe(true);
          expect(roundPrice(amount), `${group}.${key} is rounded`).toBe(amount);
        }
        expect(entry.from, `${group}.${key}`).toBeLessThanOrEqual(entry.typical[0]);
        expect(entry.typical[0], `${group}.${key}`).toBeLessThanOrEqual(entry.typical[1]);
        expect(entry.from).toBeGreaterThan(0);
      }
    }
  });

  it("separates one-time from recurring prices, and the page text carries the unit", () => {
    const { groups } = priceScheduleSnapshot();
    const monthly = Object.entries(groups.service)
      .filter(([, entry]) => entry.unit === "month")
      .map(([key]) => key)
      .sort();
    expect(monthly).toEqual(["ai_managed", "integration_care", "maintenance", "seo"]);
    for (const entry of Object.values(groups.workshop)) expect(entry.unit).toBe("project");
    for (const entry of [...Object.values(groups.care_plan), ...Object.values(groups.ai_managed)]) expect(entry.unit).toBe("month");
    for (const [group, items] of Object.entries(PRICE_GROUPS)) {
      for (const [key, price] of Object.entries(items)) {
        const bg = priceText("bg", price);
        const en = priceText("en", price);
        const recurring = price.unit === "month";
        expect(bg.from.includes("на месец"), `${group}.${key} bg`).toBe(recurring);
        expect(en.from.includes("per month"), `${group}.${key} en`).toBe(recurring);
        expect(bg.from).toContain("€");
        expect(en.from).toContain("€");
      }
    }
  });

  it("shows what the snapshot holds: same digits on the page, in both languages", () => {
    const digits = (text: string) => text.replace(/\D/g, "");
    const { groups } = priceScheduleSnapshot();
    for (const [group, items] of Object.entries(PRICE_GROUPS)) {
      for (const [key, price] of Object.entries(items)) {
        const entry = groups[group as keyof typeof groups][key];
        for (const locale of ["bg", "en"] as const) {
          const text = priceText(locale, price);
          expect(digits(text.from), `${group}.${key} ${locale}`).toBe(String(entry.from));
          expect(digits(text.typical), `${group}.${key} ${locale}`).toBe(`${entry.typical[0]}${entry.typical[1]}`);
        }
      }
    }
  });

  it("ties the public note to the tax treatment and to the excluded costs", () => {
    const bg = getDictionary("bg").prices.note;
    const en = getDictionary("en").prices.note;
    // On VAT registration PRICE_TAX_TREATMENT changes and this test forces the note (and the legal texts) to follow.
    expect(PRICE_TAX_TREATMENT).toBe("not_vat_registered");
    expect(bg).toMatch(/не е регистрирано по ДДС/);
    expect(en).toMatch(/not VAT registered/);
    expect(`${bg} ${en}`).not.toMatch(/\+\s?(ДДС|VAT)/);
    expect([...EXCLUDED_COSTS]).toEqual(["hosting", "licences", "ai_model_usage"]);
    expect(bg).toMatch(/[Хх]остинг/);
    expect(bg).toMatch(/лиценз/);
    expect(bg).toMatch(/AI модел/);
    expect(en).toMatch(/Hosting, licences and AI model usage are not included/);
  });
});
