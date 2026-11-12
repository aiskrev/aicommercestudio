import type { ServiceKey } from "@/content/types";
import type { CarePlanKey } from "@/lib/care-plans";
import model from "@/lib/configurator-model.json";
import { type FeatureKey, isFeatureAvailable, MODEL_PACKAGES, type PackageKey, type ProjectType } from "@/lib/configurator";

/**
 * Service selector (Future Commerce, docs/FUTURE_COMMERCE_REDESIGN_REPORT.md): a short, public guide from "what do
 * you want to build" to the matching package, its service and the related services. It reuses the configurator's
 * shared model (configurator-model.json: project types, features not available for a type, the package → service
 * and care-plan table, the triggers that need the complete store) and mirrors the package rule of the API
 * (apps/api/app/configurator/model.py → `recommend`) with fixed assumptions for what the selector does not ask:
 * a small catalogue (up to 50 products), standard design, no migration. It never computes, sends or stores an
 * amount and needs no feature flag: the configurator stays switched off.
 */

export type SelectorGoal = "landing" | "website" | "store" | "app" | "automate";
export type SelectorNeed = "payments" | "accounts" | "cms" | "integrations" | "languages" | "maintenance";

export interface SelectorAnswers {
  goal: SelectorGoal;
  needs: SelectorNeed[];
}

export interface SelectorResult {
  /** The package of the configurator model; `null` for automation (assessed first, no fixed package). */
  packageKey: PackageKey | null;
  /** The project type the answers were evaluated as (after an adjustment). */
  projectType: ProjectType | null;
  service: ServiceKey;
  related: ServiceKey[];
  carePlan: CarePlanKey | null;
  /** True when a landing page could not carry a chosen feature and the type moved up to a company website. */
  adjusted: boolean;
}

const GOAL_TYPE: Record<Exclude<SelectorGoal, "automate">, ProjectType> = {
  landing: "landing_page",
  website: "business_website",
  store: "online_store",
  app: "custom_application",
};

/** Selector needs expressed as configurator features (languages and maintenance are not features). */
const NEED_FEATURES: Partial<Record<SelectorNeed, FeatureKey[]>> = {
  payments: ["payments"],
  accounts: ["customer_accounts"],
  cms: ["cms"],
  integrations: ["crm", "erp"],
};

const STORE_COMPLETE_TRIGGERS = new Set<string>(model.store_complete_triggers);

export function featuresFor(needs: SelectorNeed[]): FeatureKey[] {
  return [...new Set(needs.flatMap((need) => NEED_FEATURES[need] ?? []))];
}

/** The package the answers lead to, by the configurator model's rules. */
function packageFor(type: ProjectType, features: FeatureKey[]): PackageKey {
  if (type === "landing_page") return "landing_page";
  if (type === "business_website") return "business_website";
  if (type === "custom_application") return "custom_web_app";
  // Online store with the selector's assumptions (up to 50 products, standard design, no migration, at most two languages).
  return features.some((feature) => STORE_COMPLETE_TRIGGERS.has(feature)) ? "store_complete" : "store_setup";
}

export function recommendService(answers: SelectorAnswers): SelectorResult {
  const needs = new Set(answers.needs);
  const features = featuresFor(answers.needs);
  const related = new Set<ServiceKey>();
  if (needs.has("payments")) related.add("payments_subscriptions");
  if (needs.has("integrations")) related.add("integrations");

  if (answers.goal === "automate") {
    related.add("ai_agents");
    if (needs.has("accounts") || needs.has("cms")) related.add("portals_web_apps");
    return {
      packageKey: null,
      projectType: null,
      service: "automation",
      related: [...related].filter((key) => key !== "automation"),
      carePlan: needs.has("maintenance") ? "automation" : null,
      adjusted: false,
    };
  }

  let type = GOAL_TYPE[answers.goal];
  let adjusted = false;
  // A landing page is one page: features it cannot carry (configurator model → unavailable_features) move the
  // recommendation up to a company website instead of silently dropping what was asked for.
  if (type === "landing_page" && (features.some((feature) => !isFeatureAvailable(type, feature)) || needs.has("cms"))) {
    type = "business_website";
    adjusted = true;
  }
  const packageKey = packageFor(type, features);
  const definition = MODEL_PACKAGES[packageKey];
  const service = definition.service as ServiceKey;
  // A company website with customer sign-in is on its way to a portal: name the portal service as related.
  if (type === "business_website" && needs.has("accounts")) related.add("portals_web_apps");
  if (needs.has("languages") && type !== "custom_application") related.add("seo");
  // Care after launch: the package's care plan (model → packages.*.care_plan); `null` = agreed separately.
  const carePlan = needs.has("maintenance") ? (definition.care_plan as CarePlanKey | null) : null;
  if (needs.has("maintenance") && type === "online_store") related.add("maintenance");

  return { packageKey, projectType: type, service, related: [...related].filter((key) => key !== service), carePlan, adjusted };
}
