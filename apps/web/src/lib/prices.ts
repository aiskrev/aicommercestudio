import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";
import type { CarePlanKey } from "@/lib/care-plans";
import type { WorkshopKey } from "@/lib/workshop-slugs";

/**
 * Published indicative prices (docs/PRICING.md).
 *
 * The baseline of each row is the recommendation of the pricing report of 2026-11-10 ("Пазарни цени на
 * услугите", kept by the owner, not in this public repository): the lowest sensible scope ("from") and the
 * typical range. Two schedules are kept:
 *   * `bg`: the report's figures 10 % lower (BG_FACTOR).
 *   * `eu`: the report's EU uplift (+20 %, the middle of its 15–25 %) and then the same 10 % lower, +8 % on
 *     the baseline (EU_FACTOR).
 *
 * THE LANGUAGE OF A PAGE DOES NOT CHOOSE THE PRICE. A visitor may open either language version from anywhere;
 * charging by language would price by the visitor's place of residence or establishment (see Regulation (EU)
 * 2018/302 on unjustified geo-blocking, to be confirmed by a lawyer), so `ACTIVE_PRICE_SCHEDULE` is one value
 * for every language and country. It is the Bulgarian schedule, the conservative default. The `eu` schedule is
 * kept only so the owner can decide on a transparent, lawful basis for a different price (for example a
 * separately approved price list by country of the contracting party) — it is not shown anywhere.
 * `PRICE_SCHEDULE_OWNER_APPROVAL` records that this decision is still the owner's.
 *
 * Amounts are final: the company is not VAT registered, so nothing is added. Third-party costs (hosting,
 * licences, AI model usage) are never included. The exact price is always set in a written quote.
 *
 * To change prices, change a baseline row or a factor here; every page reads this module.
 */
export const BG_FACTOR = 0.9;
export const EU_FACTOR = 1.2 * 0.9;

export type PriceMarket = "bg" | "eu";

/** The one schedule shown in every language. */
export const ACTIVE_PRICE_SCHEDULE: PriceMarket = "bg";

/**
 * Whether the owner has approved this arrangement in writing. "pending" until recorded in docs/PRICING.md; it
 * is a status for the release review, not something the site displays.
 */
export const PRICE_SCHEDULE_OWNER_APPROVAL: "pending" | "approved" = "pending";

/** Every published amount is in this currency. */
export const PRICE_CURRENCY = "EUR";

/**
 * Tax treatment of the published amounts. It is a fact about the company today, not a constant of the system:
 * `not_vat_registered` = nothing is added and the site says so (`dict.prices.note`). On VAT registration this
 * value, that note and the legal texts change together (lib/price-schedule.test.ts ties the note to this value),
 * and the accountant decides whether the published amounts become net or gross.
 */
export type PriceTaxTreatment = "not_vat_registered" | "vat_exclusive" | "vat_inclusive";
export const PRICE_TAX_TREATMENT: PriceTaxTreatment = "not_vat_registered";

/**
 * Version of the published schedule. Change it whenever an amount, a factor, the active schedule, the approval
 * or the tax treatment changes; the API copy (apps/api/app/price_schedule.json) carries the same value, so a
 * stored estimate can always name the schedule it was computed from.
 */
export const PRICE_SCHEDULE_VERSION = "2026-11-10.1";

export type PriceUnit = "project" | "month";

/** Baseline in EUR: [from, typical low, typical high]. */
type Baseline = readonly [number, number, number];

export interface PriceBand {
  from: number;
  typical: readonly [number, number];
}

export interface PriceItem {
  unit: PriceUnit;
  bg: PriceBand;
  eu: PriceBand;
}

/** Round to amounts a person would quote: 5 below 100, 10 below 1 000, 50 above. */
export function roundPrice(value: number): number {
  const step = value < 100 ? 5 : value < 1000 ? 10 : 50;
  return Math.round(value / step) * step;
}

function band(baseline: Baseline, factor: number): PriceBand {
  const [from, low, high] = baseline.map((value) => roundPrice(value * factor));
  return { from, typical: [low, high] };
}

function item(unit: PriceUnit, baseline: Baseline): PriceItem {
  return { unit, bg: band(baseline, BG_FACTOR), eu: band(baseline, EU_FACTOR) };
}

/** Service pages (/uslugi/<slug>). Monthly services are priced per month. */
export const SERVICE_PRICES: Record<ServiceKey, PriceItem> = {
  business_websites: item("project", [900, 1500, 2500]),
  store_development: item("project", [1200, 2500, 4000]), // Shopify from, WooCommerce typical
  portals_web_apps: item("project", [4000, 8000, 15000]),
  payments_subscriptions: item("project", [500, 800, 7000]), // one provider … recurring billing
  security_performance: item("project", [300, 500, 900]),
  maintenance: item("month", [90, 180, 350]),
  seo: item("month", [200, 300, 500]),
  analytics: item("project", [300, 500, 1500]), // GA4 set-up … CRO audit
  integrations: item("project", [1500, 3000, 8000]),
  ai_agents: item("project", [2500, 5000, 10000]),
  automation: item("project", [800, 1500, 4000]),
  ai_tools: item("project", [900, 1500, 12000]), // website assistant … RAG assistant
  audit: item("project", [900, 2000, 3500]),
  ai_managed: item("month", [250, 350, 3000]), // Essential … Advanced, per system
  integration_care: item("month", [150, 250, 450]),
};

/** Workshops and advisory assessments (/rabotni-sreshti/<slug>), fixed packages. */
export const WORKSHOP_PRICES: Record<WorkshopKey, PriceItem> = {
  ai_strategy_discovery: item("project", [800, 1200, 1800]),
  ai_readiness_mapping: item("project", [1800, 2500, 3500]),
  agent_architecture: item("project", [2000, 3000, 4000]),
  landing_zone_assessment: item("project", [2000, 3000, 4500]),
  kubernetes_review: item("project", [1500, 2500, 4000]),
  devops_gitops_assessment: item("project", [1500, 2500, 4000]),
  observability_sre: item("project", [1800, 2500, 4000]),
  ecommerce_integration_discovery: item("project", [1000, 1500, 3000]),
  rag_data_readiness: item("project", [1800, 2500, 3500]),
  responsible_ai_review: item("project", [900, 1500, 3000]),
};

/** Care plans (/paketi), per month and per system. The report has no row for website, cloud and
 * security care: website and security follow store maintenance, cloud follows the Essential level. */
export const CARE_PLAN_PRICES: Record<CarePlanKey, PriceItem> = {
  website: item("month", [90, 180, 350]),
  commerce: item("month", [90, 180, 350]),
  automation: item("month", [150, 250, 450]),
  cloud: item("month", [250, 350, 500]),
  security: item("month", [90, 180, 350]),
};

/** AI Managed Services levels, per month and per system, without third-party costs. */
export const AI_MANAGED_PRICES: Record<"essential" | "managed" | "advanced", PriceItem> = {
  essential: item("month", [250, 350, 500]),
  managed: item("month", [700, 900, 1400]),
  advanced: item("month", [1800, 2200, 3000]),
};

/**
 * The schedule to show. The locale is accepted only so call sites stay explicit about formatting; it never
 * changes the amount. Do not make this depend on the language, the browser, the IP address or the country.
 */
export function marketFor(locale: Locale): PriceMarket {
  void locale;
  return ACTIVE_PRICE_SCHEDULE;
}

export interface PriceText {
  from: string;
  typical: string;
}

/** A whole euro amount in the notation of the locale ("1 350 €" / "€1,350"). Formatting only: it never changes the amount. */
export function formatEuro(locale: Locale, value: number): string {
  return euros(locale, value);
}

function euros(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** "от 1 350 €" / "From €1,600" and "Обикновено 2 250–3 600 €" / "Typically €2,700–€4,300" (+ "/месец"). */
export function priceText(locale: Locale, price: PriceItem): PriceText {
  const b = price[marketFor(locale)];
  const per = price.unit === "month" ? (locale === "bg" ? " на месец" : " per month") : "";
  const range = `${euros(locale, b.typical[0])}–${euros(locale, b.typical[1])}`;
  return locale === "bg"
    ? { from: `от ${euros(locale, b.from)}${per}`, typical: `Обикновено ${range}${per}` }
    : { from: `From ${euros(locale, b.from)}${per}`, typical: `Typically ${range}${per}` };
}
