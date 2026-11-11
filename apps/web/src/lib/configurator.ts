import model from "@/lib/configurator-model.json";

/**
 * Project configurator: the form's vocabulary and the few rules the form needs to stay inside what the server
 * accepts. `configurator-model.json` is the shared model (copied byte for byte to
 * apps/api/app/configurator/model.json). The evaluation — which package, what is priced, what needs an assessment —
 * exists only on the server (apps/api/app/configurator/model.py): the browser never computes or sends an amount.
 */
export const CONFIGURATOR_MODEL_VERSION: string = model.version;

export type ProjectType = "landing_page" | "business_website" | "online_store" | "custom_application";
export type PagesBand = "one" | "up_to_5" | "up_to_15" | "more_than_15";
export type ProductsBand = "none" | "up_to_50" | "up_to_500" | "more_than_500";
export type LanguagesBand = "one" | "two" | "three_plus";
export type BuildKind = "new" | "redesign";
export type FeatureKey =
  | "cms"
  | "blog"
  | "search"
  | "product_filters"
  | "customer_accounts"
  | "user_dashboard"
  | "payments"
  | "shipping"
  | "invoicing"
  | "booking"
  | "crm"
  | "erp"
  | "analytics"
  | "seo"
  | "ai_assistant"
  | "marketing";
export type BrandingKind = "existing" | "new";
export type DesignLevel = "standard" | "bespoke";
export type OperationKey = "hosting" | "maintenance" | "backups" | "security" | "monitoring" | "support";
export type TimelineKey = "asap" | "within_1_month" | "within_3_months" | "flexible";
export type BudgetKey = "undisclosed" | "under_2500" | "2500_10000" | "10000_25000" | "over_25000";
export type PackageKey = "landing_page" | "business_website" | "store_setup" | "store_complete" | "custom_web_app";

export const OPTIONS = {
  project_type: model.project_types as ProjectType[],
  pages: model.pages as PagesBand[],
  products: model.products as ProductsBand[],
  languages: model.languages as LanguagesBand[],
  build: model.build as BuildKind[],
  features: model.features as FeatureKey[],
  branding: model.branding as BrandingKind[],
  design_level: model.design_level as DesignLevel[],
  operations: model.operations as OperationKey[],
  timeline: model.timeline as TimelineKey[],
  budget_range: model.budget_range as BudgetKey[],
};

/** What the browser sends: enumerations and booleans only. */
export interface ConfiguratorAnswers {
  project_type: ProjectType;
  pages: PagesBand;
  products: ProductsBand;
  languages: LanguagesBand;
  build: BuildKind;
  content_migration: boolean;
  store_migration: boolean;
  features: FeatureKey[];
  branding: BrandingKind;
  design_level: DesignLevel;
  accessibility: boolean;
  interactive_elements: boolean;
  operations: OperationKey[];
  timeline: TimelineKey;
  budget_range: BudgetKey;
}

/** A draft may still miss the single-choice answers. */
export type ConfiguratorDraft = Partial<ConfiguratorAnswers> & Pick<ConfiguratorAnswers, "features" | "operations" | "content_migration" | "store_migration" | "accessibility" | "interactive_elements">;

export const EMPTY_DRAFT: ConfiguratorDraft = {
  features: [],
  operations: [],
  content_migration: false,
  store_migration: false,
  accessibility: false,
  interactive_elements: false,
};

const UNAVAILABLE = model.unavailable_features as Record<ProjectType, FeatureKey[]>;

export function isFeatureAvailable(type: ProjectType | undefined, feature: FeatureKey): boolean {
  return !type || !UNAVAILABLE[type].includes(feature);
}

export const sellsProducts = (type: ProjectType | undefined) => type === "online_store" || type === "custom_application";

/**
 * Keeps a draft inside the supported combinations after an answer changes (the server refuses the others):
 * a landing page is one page, only stores migrate a store, features that do not apply to the type are dropped,
 * and a dashboard needs customer accounts.
 */
export function normaliseDraft(draft: ConfiguratorDraft): ConfiguratorDraft {
  const type = draft.project_type;
  const next: ConfiguratorDraft = { ...draft, features: draft.features.filter((feature) => isFeatureAvailable(type, feature)) };
  if (type === "landing_page") next.pages = "one";
  if (type && !sellsProducts(type)) next.products = "none";
  if (type === "online_store" && next.products === "none") next.products = undefined;
  if (type !== "online_store") next.store_migration = false;
  if (next.features.includes("user_dashboard") && !next.features.includes("customer_accounts")) {
    next.features = next.features.filter((feature) => feature !== "user_dashboard");
  }
  // The model's own order, so the same choices always serialise the same way.
  next.features = OPTIONS.features.filter((feature) => next.features.includes(feature));
  next.operations = OPTIONS.operations.filter((operation) => next.operations.includes(operation));
  return next;
}

export const STEPS = ["type", "scope", "features", "design", "operations", "business", "review"] as const;
export type StepKey = (typeof STEPS)[number];

/** Required single-choice answers of a step that are still missing. */
export function missingInStep(step: StepKey, draft: ConfiguratorDraft): (keyof ConfiguratorAnswers)[] {
  const required: Record<StepKey, (keyof ConfiguratorAnswers)[]> = {
    type: ["project_type"],
    scope: ["pages", "products", "languages", "build"],
    features: [],
    design: ["branding", "design_level"],
    operations: [],
    business: ["timeline", "budget_range"],
    review: [],
  };
  return required[step].filter((key) => draft[key] === undefined);
}

export function isComplete(draft: ConfiguratorDraft): draft is ConfiguratorAnswers {
  return STEPS.every((step) => missingInStep(step, draft).length === 0);
}

/* ------------------------------------------------------------------ the server's review */

export interface ReviewBand {
  unit: "project" | "month";
  from: number;
  typical: [number, number];
}

export interface ReviewItem {
  kind: "package" | "service" | "care_plan";
  key: string;
  reason: string;
  band: ReviewBand | null;
}

export interface ConfiguratorReview {
  model_version: string;
  schedule_version: string;
  currency: string;
  owner_approval: "pending" | "approved";
  tax_treatment: string;
  binding: false;
  package: PackageKey;
  service: string;
  delivery: "fixed_scope" | "staged";
  items: ReviewItem[];
  included: FeatureKey[];
  unpriced: string[];
  assumptions: string[];
  exclusions: string[];
  totals: { one_time_from: number; monthly_from: number; primary_priced: boolean };
  human_review: { required: true; reasons: string[] };
}

/** Keys the server can return (shared model file); the content test requires a label for each in both languages. */
export const UNPRICED_KEYS: string[] = model.unpriced_keys;
export const ASSUMPTION_KEYS: string[] = model.assumption_keys;
export const EXCLUSION_KEYS: string[] = model.exclusion_keys;
export const REVIEW_REASONS: string[] = model.review_reasons;
export const RULE_KEYS: string[] = model.rules;

/** The packages as the configurator knows them; lib/project-packages.test.ts keeps them equal to PROJECT_PACKAGES. */
export const MODEL_PACKAGES = model.packages as Record<PackageKey, { service: string; priced: boolean; delivery: "fixed_scope" | "staged"; care_plan: string | null }>;
