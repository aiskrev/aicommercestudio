import type { ServiceKey } from "@/content/types";

export type CarePlanKey = "website" | "commerce" | "automation" | "cloud" | "security";

/**
 * Commercial terms stay out of the public site until the owner confirms them: `null` is shown as
 * "Agreed in writing". Setting one here is a decision, not an edit: the test in care-plans.test.ts fails
 * while any value is published without that decision. Prices were decided on 2026-11-10 and live in
 * lib/prices.ts (CARE_PLAN_PRICES); included hours and response times are still not published.
 */
export interface CarePlanTerms {
  includedHours: number | null;
  responseTime: string | null;
}

export interface CarePlanDefinition {
  key: CarePlanKey;
  /** Preselected in the contact form, so the enquiry keeps its service. */
  contactService: ServiceKey;
  /** Service page the plan follows on from. */
  service: ServiceKey;
  terms: CarePlanTerms;
}

const UNCONFIRMED: CarePlanTerms = { includedHours: null, responseTime: null };

export const CARE_PLANS: readonly CarePlanDefinition[] = [
  { key: "website", contactService: "business_websites", service: "business_websites", terms: UNCONFIRMED },
  { key: "commerce", contactService: "maintenance", service: "maintenance", terms: UNCONFIRMED },
  { key: "automation", contactService: "integration_care", service: "integration_care", terms: UNCONFIRMED },
  { key: "cloud", contactService: "integrations", service: "integrations", terms: UNCONFIRMED },
  { key: "security", contactService: "security_performance", service: "security_performance", terms: UNCONFIRMED },
];
