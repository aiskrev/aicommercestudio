import { describe, expect, it } from "vitest";

import { getContent, serviceByKey } from "@/content";
import { locales, localizePath } from "@/i18n/config";
import { CARE_PLANS } from "@/lib/care-plans";
import { priceText, SERVICE_PRICES } from "@/lib/prices";
import { MAINTENANCE_CARE_PLANS, PROJECT_PACKAGES, packagePrice } from "@/lib/project-packages";
import { routes } from "@/lib/routes";

const KEYS = PROJECT_PACKAGES.map((item) => item.key);

describe("project packages", () => {
  it("has the same packages, in the same order, with the same list lengths in both languages", () => {
    const [bg, en] = locales.map((locale) => getContent(locale).projectPackages);
    expect(Object.keys(bg.packages)).toEqual(KEYS);
    expect(Object.keys(en.packages)).toEqual(KEYS);
    for (const key of KEYS) {
      for (const field of ["includes", "excludes", "prerequisites"] as const) {
        expect(en.packages[key][field], `${key}.${field}`).toHaveLength(bg.packages[key][field].length);
      }
    }
    expect(en.faq.items).toHaveLength(bg.faq.items.length);
  });

  it("presents existing services: every package belongs to a service with a page, stages and a published band", () => {
    for (const locale of locales) {
      for (const item of PROJECT_PACKAGES) {
        const service = serviceByKey(locale, item.service);
        expect(service.slug).toBeTruthy();
        expect(service.workflow.length, `${item.key}: stages come from the service`).toBeGreaterThan(0);
        expect(SERVICE_PRICES[item.service]).toBeDefined();
      }
    }
  });

  it("shows a price only where the schedule has one; the two smaller scopes have none until the owner sets it", () => {
    // Publishing a price for these two is an owner decision (docs/COMMERCIAL_EXPANSION_DECISIONS.md, D-09),
    // not an edit: this test fails if one appears without it.
    const withoutPrice = PROJECT_PACKAGES.filter((item) => item.price === null).map((item) => item.key);
    expect(withoutPrice).toEqual(["landing_page", "store_setup"]);
    for (const item of PROJECT_PACKAGES) {
      const price = packagePrice(item);
      if (item.price === null) expect(price).toBeNull();
      else expect(price).toBe(SERVICE_PRICES[item.service]);
    }
  });

  it("never presents custom engineering as a fixed-scope commodity", () => {
    const app = PROJECT_PACKAGES.find((item) => item.key === "custom_web_app")!;
    expect(app.delivery).toBe("staged");
    expect(app.carePlan).toBeNull();
    for (const locale of locales) {
      expect(getContent(locale).projectPackages.labels.stagedNote.length).toBeGreaterThan(40);
    }
  });

  it("writes no amounts, delivery times, guarantees or SLA into the package texts", () => {
    const banned = {
      // \b does not see Cyrillic letters as word characters, hence the explicit boundaries.
      bg: /гаранц|sla|24\/7|(?<![а-яА-Я])(дни|дена)(?![а-яА-Я])|седмиц|€|\d{3,}/i,
      en: /guarantee|\bsla\b|24\/7|\bdays?\b|\bweeks?\b|€|\d{3,}/i,
    };
    for (const locale of locales) {
      const t = getContent(locale).projectPackages;
      const texts = Object.values(t.packages).flatMap((item) => [
        item.name,
        item.audience,
        item.objective,
        ...item.includes,
        ...item.excludes,
        ...item.prerequisites,
        item.technical,
        item.design,
        item.integrations,
        item.content,
        ...Object.values(item.compare),
      ]);
      for (const text of texts) expect(text, `${locale}: ${text}`).not.toMatch(banned[locale]);
    }
  });

  it("shows the same amounts in both languages", () => {
    const digits = (text: string) => text.replace(/\D/g, "");
    for (const item of PROJECT_PACKAGES) {
      const price = packagePrice(item);
      if (!price) continue;
      expect(digits(priceText("bg", price).from)).toBe(digits(priceText("en", price).from));
      expect(digits(priceText("bg", price).typical)).toBe(digits(priceText("en", price).typical));
    }
  });

  it("links maintenance to the existing care plans instead of describing it twice", () => {
    const known = CARE_PLANS.map((plan) => plan.key);
    for (const key of MAINTENANCE_CARE_PLANS) expect(known).toContain(key);
    for (const item of PROJECT_PACKAGES) if (item.carePlan) expect(known).toContain(item.carePlan);
  });

  it("has a localized public URL in both languages", () => {
    expect(localizePath("bg", routes.projectPackages)).toBe("/bg/proektni-paketi");
    expect(localizePath("en", routes.projectPackages)).toBe("/en/project-packages");
  });
});
