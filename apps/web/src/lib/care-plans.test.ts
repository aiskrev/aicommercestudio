import { describe, expect, it } from "vitest";

import { getContent, serviceByKey } from "@/content";
import { locales } from "@/i18n/config";
import { CARE_PLANS } from "@/lib/care-plans";
import { CARE_PLAN_PRICES } from "@/lib/prices";

describe("care plans", () => {
  it("publishes no included hours or response time until the owner confirms them; prices are decided", () => {
    for (const plan of CARE_PLANS) expect(plan.terms).toEqual({ includedHours: null, responseTime: null });
    for (const plan of CARE_PLANS) expect(CARE_PLAN_PRICES[plan.key].unit).toBe("month");
  });

  it.each(locales)("has text for every plan and links real services (%s)", (locale) => {
    const { carePlans } = getContent(locale);
    expect(CARE_PLANS.map((plan) => carePlans.plans[plan.key].name)).toEqual([
      "Website Care",
      "Commerce Care",
      "Automation Care",
      "Cloud & Platform Care",
      "Security & Performance Care",
    ]);
    for (const plan of CARE_PLANS) expect(serviceByKey(locale, plan.contactService).slug).toBeTruthy();
    expect(JSON.stringify(carePlans)).not.toMatch(/€|лв\.|\$\d|24\/7|99[.,]9/);
  });

  it.each(locales)("keeps the AI Managed Services tiers unchanged (%s)", (locale) => {
    expect(getContent(locale).aiManaged.packages.items.map((item) => item.name)).toEqual([
      "Essential Monitoring & Advisory",
      "Managed AI Operations",
      "Advanced AI Reliability & Optimization",
    ]);
  });
});
