import type { ServiceKey } from "@/content/types";
import type { CarePlanKey } from "@/lib/care-plans";
import { CARE_PLAN_PRICES, type PriceItem, SERVICE_PRICES } from "@/lib/prices";

/**
 * Project packages (/proektni-paketi ↔ /en/project-packages): typical scopes of the build services, described for
 * comparison. A package is a presentation of an existing service, not a new catalogue entry: it always points at
 * the service page it belongs to and at the quote form for that service.
 *
 * Prices. A package shows a price only where the owner's schedule already has one (lib/prices.ts):
 * `"service"` = the published band of the package's service. `null` = no separately approved price for this scope
 * (a landing page is smaller than the business-website band describes, a starter store smaller than the store
 * band), so the page says "price in a written quote" and never derives an amount. Setting a price for those two is
 * an owner decision (docs/COMMERCIAL_EXPANSION_DECISIONS.md, D-09), not an edit.
 *
 * `delivery: "staged"` marks custom engineering: its scope is unknown before an assessment, so the page never
 * presents it as a fixed-price commodity even though the service has an indicative band.
 */
export type ProjectPackageKey = "landing_page" | "business_website" | "store_setup" | "store_complete" | "custom_web_app";

export interface ProjectPackageDefinition {
  key: ProjectPackageKey;
  /** Service page the package belongs to; also preselected in the quote form. */
  service: ServiceKey;
  price: "service" | null;
  delivery: "fixed_scope" | "staged";
  /** Care plan that follows on after launch (lib/care-plans.ts); `null` = agreed separately. */
  carePlan: CarePlanKey | null;
}

export const PROJECT_PACKAGES: readonly ProjectPackageDefinition[] = [
  { key: "landing_page", service: "business_websites", price: null, delivery: "fixed_scope", carePlan: "website" },
  { key: "business_website", service: "business_websites", price: "service", delivery: "fixed_scope", carePlan: "website" },
  { key: "store_setup", service: "store_development", price: null, delivery: "fixed_scope", carePlan: "commerce" },
  { key: "store_complete", service: "store_development", price: "service", delivery: "fixed_scope", carePlan: "commerce" },
  { key: "custom_web_app", service: "portals_web_apps", price: "service", delivery: "staged", carePlan: null },
];

/** Maintenance packages are the existing care plans; they are linked, not described a second time. */
export const MAINTENANCE_CARE_PLANS: readonly CarePlanKey[] = ["website", "commerce"];

/** The published band of a package, or `null` when its scope has no separately approved price. */
export function packagePrice(definition: ProjectPackageDefinition): PriceItem | null {
  return definition.price === "service" ? SERVICE_PRICES[definition.service] : null;
}

export function carePlanPrice(key: CarePlanKey): PriceItem {
  return CARE_PLAN_PRICES[key];
}
