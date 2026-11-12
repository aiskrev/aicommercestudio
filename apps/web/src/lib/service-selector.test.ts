import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { locales } from "@/i18n/config";
import { MODEL_PACKAGES } from "@/lib/configurator";
import { PROJECT_PACKAGES } from "@/lib/project-packages";
import { featuresFor, recommendService, type SelectorGoal, type SelectorNeed } from "@/lib/service-selector";

const GOALS: SelectorGoal[] = ["landing", "website", "store", "app", "automate"];
const NEEDS: SelectorNeed[] = ["payments", "accounts", "cms", "integrations", "languages", "maintenance"];

/** Every subset of the needs (64 combinations). */
const subsets = NEEDS.reduce<SelectorNeed[][]>((all, need) => [...all, ...all.map((set) => [...set, need])], [[]]);

describe("service selector", () => {
  it("follows the configurator model's package rules", () => {
    expect(recommendService({ goal: "landing", needs: [] }).packageKey).toBe("landing_page");
    expect(recommendService({ goal: "website", needs: ["cms"] }).packageKey).toBe("business_website");
    expect(recommendService({ goal: "store", needs: [] }).packageKey).toBe("store_setup");
    expect(recommendService({ goal: "store", needs: ["payments"] }).packageKey).toBe("store_setup");
    // CRM/ERP and customer accounts are store_complete triggers in the shared model.
    expect(recommendService({ goal: "store", needs: ["integrations"] }).packageKey).toBe("store_complete");
    expect(recommendService({ goal: "store", needs: ["accounts"] }).packageKey).toBe("store_complete");
    expect(recommendService({ goal: "app", needs: [] }).packageKey).toBe("custom_web_app");
  });

  it("moves a landing page up to a company website when it cannot carry a chosen feature", () => {
    const result = recommendService({ goal: "landing", needs: ["payments"] });
    expect(result).toMatchObject({ packageKey: "business_website", adjusted: true, service: "business_websites" });
    expect(recommendService({ goal: "landing", needs: ["maintenance"] }).adjusted).toBe(false);
  });

  it("gives automation no fixed package and the automation service", () => {
    const result = recommendService({ goal: "automate", needs: ["integrations", "maintenance"] });
    expect(result).toMatchObject({ packageKey: null, service: "automation", carePlan: "automation" });
    expect(result.related).toContain("integrations");
  });

  it("returns a published package, its own service and a consistent care plan for every combination", () => {
    const keys = new Set(PROJECT_PACKAGES.map((item) => item.key));
    for (const goal of GOALS) {
      for (const needs of subsets) {
        const result = recommendService({ goal, needs });
        if (result.packageKey) {
          expect(keys.has(result.packageKey), `${goal} ${needs}`).toBe(true);
          expect(result.service).toBe(MODEL_PACKAGES[result.packageKey].service);
          expect(result.carePlan).toBe(needs.includes("maintenance") ? MODEL_PACKAGES[result.packageKey].care_plan : null);
        }
        expect(result.related).not.toContain(result.service);
        expect(new Set(result.related).size).toBe(result.related.length);
      }
    }
  });

  it("maps needs onto configurator features only", () => {
    expect(featuresFor(["payments", "integrations", "languages", "maintenance"])).toEqual(["payments", "crm", "erp"]);
  });

  it("has a label for every goal and need in both languages", () => {
    for (const locale of locales) {
      const selector = getContent(locale).v5.future.selector;
      expect(selector.goals.map((goal) => goal.key)).toEqual(GOALS);
      expect(selector.needs.map((need) => need.key)).toEqual(NEEDS);
    }
  });
});
