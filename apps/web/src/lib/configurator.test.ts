import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { getDictionary } from "@/i18n";
import { locales, localizePath } from "@/i18n/config";
import {
  ASSUMPTION_KEYS,
  CONFIGURATOR_MODEL_VERSION,
  type ConfiguratorDraft,
  EMPTY_DRAFT,
  EXCLUSION_KEYS,
  isComplete,
  isFeatureAvailable,
  missingInStep,
  MODEL_PACKAGES,
  normaliseDraft,
  OPTIONS,
  REVIEW_REASONS,
  RULE_KEYS,
  STEPS,
  UNPRICED_KEYS,
} from "@/lib/configurator";
import { EXCLUDED_COSTS } from "@/lib/price-schedule";
import { PROJECT_PACKAGES } from "@/lib/project-packages";
import { routes } from "@/lib/routes";

const draft = (patch: Partial<ConfiguratorDraft>): ConfiguratorDraft => ({ ...EMPTY_DRAFT, ...patch });

describe("project configurator model (shared with the API)", () => {
  it("has a version and the packages of the packages page", () => {
    expect(CONFIGURATOR_MODEL_VERSION).toMatch(/^\d{4}-\d{2}\.\d+$/);
    expect(Object.keys(MODEL_PACKAGES)).toEqual(PROJECT_PACKAGES.map((item) => item.key));
    for (const item of PROJECT_PACKAGES) {
      expect(MODEL_PACKAGES[item.key]).toEqual({ service: item.service, priced: item.price === "service", delivery: item.delivery, care_plan: item.carePlan });
    }
  });

  it("uses the budget and timeline values of the contact form", () => {
    const inquiry = getDictionary("bg").inquiry;
    expect(OPTIONS.budget_range).toEqual(Object.keys(inquiry.budgets));
    expect(OPTIONS.timeline).toEqual(Object.keys(inquiry.timelines));
  });

  it("names the third-party costs of the price schedule among its exclusions", () => {
    for (const cost of EXCLUDED_COSTS) expect(EXCLUSION_KEYS).toContain(cost);
  });

  it("has a label for every option and every key the server can return, in both languages", () => {
    for (const locale of locales) {
      const t = getContent(locale).configurator;
      const q = t.questions;
      expect(Object.keys(t.steps)).toEqual([...STEPS]);
      expect(Object.keys(q.project_type.options)).toEqual(OPTIONS.project_type);
      expect(Object.keys(q.pages.options)).toEqual(OPTIONS.pages);
      expect(Object.keys(q.products.options)).toEqual(OPTIONS.products);
      expect(Object.keys(q.languages.options)).toEqual(OPTIONS.languages);
      expect(Object.keys(q.build.options)).toEqual(OPTIONS.build);
      expect(Object.keys(q.features.options)).toEqual(OPTIONS.features);
      expect(Object.keys(q.branding.options)).toEqual(OPTIONS.branding);
      expect(Object.keys(q.design_level.options)).toEqual(OPTIONS.design_level);
      expect(Object.keys(q.operations.options)).toEqual(OPTIONS.operations);
      expect(Object.keys(t.review.unpricedLabels), locale).toEqual(UNPRICED_KEYS);
      expect(Object.keys(t.review.assumptionLabels), locale).toEqual(ASSUMPTION_KEYS);
      expect(Object.keys(t.review.exclusionLabels), locale).toEqual(EXCLUSION_KEYS);
      expect(Object.keys(t.review.reasonLabels), locale).toEqual(REVIEW_REASONS);
      expect(Object.keys(t.review.ruleLabels), locale).toEqual(RULE_KEYS);
      expect(Object.keys(t.review.delivery)).toEqual(["fixed_scope", "staged"]);
    }
  });

  it("writes no amount into the texts and says plainly that the result is not a quote", () => {
    for (const locale of locales) {
      const t = getContent(locale).configurator;
      const labels = [...Object.values(t.review.unpricedLabels), ...Object.values(t.review.reasonLabels), ...Object.values(t.review.assumptionLabels), ...Object.values(t.review.exclusionLabels)];
      for (const label of [...labels, t.review.notice, t.lead]) expect(label, label).not.toMatch(/€|\d{3,}/);
      expect(`${t.review.notice} ${t.lead}`).toMatch(locale === "bg" ? /не е оферта/ : /not a quote/);
      expect(t.review.notice).toMatch(locale === "bg" ? /човек/ : /person/);
    }
  });

  it("has a localized public URL", () => {
    expect(localizePath("bg", routes.configurator)).toBe("/bg/konfigurator");
    expect(localizePath("en", routes.configurator)).toBe("/en/configurator");
  });
});

describe("keeping a draft inside the supported combinations", () => {
  it("a landing page is one page, has no products and drops features that do not apply", () => {
    const next = normaliseDraft(draft({ project_type: "landing_page", pages: "up_to_15", products: "up_to_50", features: ["payments", "seo", "blog", "crm"], store_migration: true }));
    expect(next.pages).toBe("one");
    expect(next.products).toBe("none");
    expect(next.store_migration).toBe(false);
    expect(next.features).toEqual(["crm", "seo"]);
    expect(isFeatureAvailable("landing_page", "payments")).toBe(false);
    expect(isFeatureAvailable("business_website", "shipping")).toBe(false);
    expect(isFeatureAvailable("online_store", "shipping")).toBe(true);
    expect(isFeatureAvailable(undefined, "shipping")).toBe(true);
  });

  it("a store must have products, and only a store migrates a store", () => {
    expect(normaliseDraft(draft({ project_type: "online_store", products: "none" })).products).toBeUndefined();
    expect(normaliseDraft(draft({ project_type: "online_store", products: "up_to_50", store_migration: true })).store_migration).toBe(true);
    expect(normaliseDraft(draft({ project_type: "business_website", products: "up_to_500" })).products).toBe("none");
    expect(normaliseDraft(draft({ project_type: "custom_application", products: "up_to_500" })).products).toBe("up_to_500");
  });

  it("a dashboard needs customer accounts, and lists keep the model's order", () => {
    expect(normaliseDraft(draft({ project_type: "custom_application", features: ["user_dashboard"] })).features).toEqual([]);
    expect(normaliseDraft(draft({ features: ["seo", "user_dashboard", "customer_accounts", "cms"], operations: ["support", "hosting"] }))).toMatchObject({
      features: ["cms", "customer_accounts", "user_dashboard", "seo"],
      operations: ["hosting", "support"],
    });
  });

  it("knows what each step still needs", () => {
    expect(missingInStep("type", EMPTY_DRAFT)).toEqual(["project_type"]);
    expect(missingInStep("scope", normaliseDraft(draft({ project_type: "landing_page" })))).toEqual(["languages", "build"]);
    expect(missingInStep("features", EMPTY_DRAFT)).toEqual([]);
    const complete = normaliseDraft(
      draft({ project_type: "business_website", pages: "up_to_5", languages: "one", build: "new", branding: "existing", design_level: "standard", timeline: "flexible", budget_range: "undisclosed" }),
    );
    expect(isComplete(complete)).toBe(true);
    expect(isComplete(EMPTY_DRAFT)).toBe(false);
  });
});
