import { describe, expect, it } from "vitest";

import { localizePath, locales } from "@/i18n/config";
import { demoTexts } from "@/i18n/demos";
import codes from "@/lib/demo-codes.json";
import { DEMO_FIELDS, DEMO_SERVICE } from "@/lib/demo-fields";
import { DEMO_KEYS, DEMO_SLUGS, demoBySlug } from "@/lib/demo-slugs";
import { routes } from "@/lib/routes";

describe("interactive demonstrations", () => {
  it("translate every code the server can return, in both languages", () => {
    for (const locale of locales) {
      const missing = (codes as string[]).filter((code) => !demoTexts[locale].codes[code]);
      expect(missing, `missing in ${locale}`).toEqual([]);
      // No text is left over for a code that no longer exists.
      expect(Object.keys(demoTexts[locale].codes).filter((code) => !(codes as string[]).includes(code))).toEqual([]);
    }
  });

  it("have a text for every scenario, field and option the server lists", () => {
    expect([...DEMO_KEYS].sort()).toEqual(Object.keys(DEMO_FIELDS).sort());
    for (const locale of locales) {
      for (const [key, fields] of Object.entries(DEMO_FIELDS)) {
        const text = demoTexts[locale].scenarios[key];
        expect(text, `${locale} ${key}`).toBeTruthy();
        expect(Object.keys(text.fields).sort()).toEqual(fields.map((field) => field.key).sort());
        for (const field of fields) expect(Object.keys(text.fields[field.key].options).sort()).toEqual([...field.options].sort());
        expect(text.shows.length).toBeGreaterThanOrEqual(3);
      }
      for (const step of ["trigger", "validation", "logic", "output_check", "approval", "proposal"]) expect(demoTexts[locale].steps[step].title).toBeTruthy();
      for (const status of ["ok", "flagged", "blocked", "skipped", "required", "not_required", "proposed"]) expect(demoTexts[locale].statuses[status]).toBeTruthy();
    }
  });

  it("have slugs that differ between the languages and route both ways", () => {
    for (const key of DEMO_KEYS) {
      const { bg, en } = DEMO_SLUGS[key];
      expect(bg).not.toBe(en);
      expect(demoBySlug(bg)).toBe(key);
      expect(localizePath("bg", routes.demoScenario(bg))).toBe(`/bg/demo-tsentar/${bg}`);
      expect(localizePath("en", routes.demoScenario(bg))).toBe(`/en/demo-centre/${en}`);
    }
    expect(new Set(DEMO_KEYS.map((key) => DEMO_SLUGS[key].bg)).size).toBe(DEMO_KEYS.length);
    expect(DEMO_KEYS.every((key) => DEMO_SERVICE[key])).toBe(true);
  });

  it("promise nothing: no guarantee, saving, price or deadline in the texts", () => {
    for (const locale of locales) {
      const all = JSON.stringify([demoTexts[locale].scenarios, demoTexts[locale].result, demoTexts[locale].badgeLong]);
      expect(all).not.toMatch(/€|EUR|лв.|ROI|you will save|ще спестите|ще получите|will increase|ще увеличи/i);
    }
  });
});
