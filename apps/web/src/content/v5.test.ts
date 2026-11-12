import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import type { HubContent, V5Content } from "@/content/v5-types";
import { locales } from "@/i18n/config";
import { SERVICE_PRICES } from "@/lib/prices";
import { PROJECT_PACKAGES } from "@/lib/project-packages";

/**
 * V5 content guard (docs/V5_FINAL_IMPLEMENTATION_REPORT.md): both languages have the same shape, the texts carry
 * no amounts, delivery times, guarantees, SLA or invented proof, and a price is shown only where the published
 * schedule has one.
 */

const [bg, en] = locales.map((locale) => getContent(locale).v5) as [V5Content, V5Content];

/** Shape of a value: arrays keep their length, objects their keys, leaves their type. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  return typeof value;
}

function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, inner]) => strings(inner, path ? `${path}.${key}` : key));
  return [];
}

/** Language-independent fields (keys, ids, services, hrefs) are equal in both languages. */
const STRUCTURAL = /(\.|^)(key|id|service|preview|price|icon|href|packages\[\d+\]|keys\[\d+\])$/;

describe("V5 content", () => {
  it("has the same structure in both languages, with the same keys, ids, services and prices", () => {
    expect(shape(en)).toEqual(shape(bg));
    // Labels (`labels.price`, `labels.service`) are words, not keys.
    const structural = ([path]: [string, string]) => STRUCTURAL.test(path) && !path.includes("labels.");
    const bgStructural = strings(bg).filter(structural);
    const enStructural = Object.fromEntries(strings(en).filter(structural));
    expect(bgStructural.length).toBeGreaterThan(40);
    for (const [path, value] of bgStructural) expect(enStructural[path], path).toBe(value);
  });

  it("leaves nothing empty and no Cyrillic in English", () => {
    for (const [path, value] of strings(bg)) expect(value.trim(), `bg ${path}`).not.toBe("");
    for (const [path, value] of strings(en)) {
      expect(value.trim(), `en ${path}`).not.toBe("");
      expect(/[А-Яа-я]/.test(value), `en ${path}: ${value}`).toBe(false);
    }
  });

  it("writes no amounts, delivery times, guarantees, SLA, ratings or invented proof", () => {
    const banned = {
      bg: /€|лв\.|\d{2,}\s?%|гарантира|гаранция за|(?<![а-яА-Я])(дни|дена|седмици)(?![а-яА-Я])|24\/7|\bsla\b|отзив|клиентите ни|доволни клиенти|сертифициран/i,
      en: /€|\d{2,}\s?%|\bguarantee(s|d)? (that|results|rankings)|\b\d+\s?(days?|weeks?)\b|\bsla\b|testimonial|our clients|happy clients|certified/i,
    };
    for (const locale of locales) {
      for (const [path, value] of strings(getContent(locale).v5)) {
        if (path.endsWith(".href")) continue;
        expect(value, `${locale} ${path}`).not.toMatch(banned[locale]);
      }
    }
  });

  it("shows a price only where the schedule has one for the offer's service", () => {
    for (const hub of [bg.websites, bg.ecommerce] as HubContent[]) {
      for (const offer of hub.offers) {
        if (offer.price === "service") expect(SERVICE_PRICES[offer.service], offer.id).toBeDefined();
      }
    }
    // The smaller website scopes and the platform setups have no separately approved price (D-09, D-51).
    const unpriced = [...bg.websites.offers, ...bg.ecommerce.offers].filter((offer) => offer.price === null).map((offer) => offer.id);
    expect(unpriced).toEqual(["landing", "static", "cms", "corporate", "redesign", "shopify", "woocommerce"]);
    for (const card of bg.home.showcase.cards) expect(SERVICE_PRICES[card.service], card.key).toBeDefined();
  });

  it("uses unique in-page anchors and refers only to existing project packages", () => {
    const known = new Set(PROJECT_PACKAGES.map((item) => item.key));
    for (const hub of [bg.websites, bg.ecommerce]) {
      const ids = [...hub.offers.map((offer) => offer.id), "compare", "costs", "packages", "faq"];
      expect(new Set(ids).size, hub.breadcrumb).toBe(ids.length);
      for (const key of hub.packages.keys) expect(known.has(key), key).toBe(true);
    }
    for (const key of bg.home.offers.packages) expect(known.has(key), key).toBe(true);
  });

  it("distinguishes static from interactive websites and needs no database for a static site", () => {
    const statik = bg.websites.offers.find((offer) => offer.id === "static")!;
    expect(statik.exclusions.join(" ")).toMatch(/база данни/);
    const row = bg.websites.compare.rows.find((item) => item.label === "База данни")!;
    expect(row.cells[0]).toBe("Не");
    expect(en.websites.compare.rows.find((item) => item.label === "Database")!.cells[0]).toBe("No");
  });

  it("cites the provider documentation behind the e-commerce cost table", () => {
    for (const content of [bg, en]) {
      const sources = content.ecommerce.costs!.sources;
      expect(sources.length).toBeGreaterThanOrEqual(3);
      for (const source of sources) expect(source.href).toMatch(/^https:\/\/(help\.shopify\.com|wordpress\.org)\//);
    }
  });
});
