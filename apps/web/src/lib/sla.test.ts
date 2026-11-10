import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { locales } from "@/i18n/config";
import { AGREED_IN_CONTRACT, SERVICE_LEVEL_TEMPLATE, SEVERITY_LEVELS, slaText } from "@/lib/sla";

describe("service level schema", () => {
  it("promises nothing: every commitment is empty until an individual contract sets it", () => {
    expect(SERVICE_LEVEL_TEMPLATE.coverageHours).toBeNull();
    expect(SERVICE_LEVEL_TEMPLATE.availabilityTarget).toBeNull();
    expect(SERVICE_LEVEL_TEMPLATE.maintenanceWindows).toBeNull();
    expect(SERVICE_LEVEL_TEMPLATE.escalation).toBeNull();
    expect(SERVICE_LEVEL_TEMPLATE.remedies).toBeNull();
    for (const level of SEVERITY_LEVELS) {
      const terms = SERVICE_LEVEL_TEMPLATE.severity[level];
      expect([terms.firstResponse, terms.resolutionTarget, terms.channel]).toEqual([null, null, null]);
    }
  });

  it.each(locales)("prints the fixed fallback for an empty value (%s)", (locale) => {
    expect(slaText(locale, null)).toBe(AGREED_IN_CONTRACT[locale]);
    expect(AGREED_IN_CONTRACT.bg).toBe("Договаря се в индивидуалния договор");
    expect(AGREED_IN_CONTRACT.en).toBe("Agreed in the individual contract");
  });

  it("formats a contract's own value when one is given", () => {
    expect(slaText("en", { amount: 4, unit: "hours", clock: "business" })).toBe("4 h (in business hours)");
    expect(slaText("bg", "делнични дни")).toBe("делнични дни");
  });

  it.each(locales)("defines every level and states exclusions with no numbers (%s)", (locale) => {
    for (const level of SEVERITY_LEVELS) expect(SERVICE_LEVEL_TEMPLATE.severity[level].definition[locale].length).toBeGreaterThan(20);
    expect(SERVICE_LEVEL_TEMPLATE.exclusions[locale].length).toBeGreaterThan(2);
    const text = JSON.stringify(SERVICE_LEVEL_TEMPLATE.exclusions[locale]) + JSON.stringify(SERVICE_LEVEL_TEMPLATE.severity);
    expect(text).not.toMatch(/\d+\s?(min|мин|h\b|ч\.|%)|24\/7|99[.,]\d/i);
  });

  it.each(locales)("keeps public care-plan pages free of invented SLA figures (%s)", (locale) => {
    const { carePlans, aiManaged } = getContent(locale);
    expect(JSON.stringify(carePlans)).not.toMatch(/24\/7|99[.,]\d|\d+\s?(минути|minutes|hours|часа)/i);
    expect(JSON.stringify(aiManaged)).not.toMatch(/\b99[.,]\d|гарантирано време за реакция в рамките/i);
  });
});
